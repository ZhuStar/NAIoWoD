// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { ParsedCommand, sys } from "../command";
import { CardValue, inlineCardText } from "../core/cardtext";
import { Rng } from "../core/dice";
import { Numeric } from "../core/expr";
import { StringUtil } from "../core/traits";
import { RollExecution, RollModifier, RollSpec, TraitResolver, executeRoll } from "../rolls";
import { EffectOp, EffectSpec, ResourceDef, TEMPLATES, rollFloorFrom } from "../rules";
import { ActiveWizard, CharacterStore, CreatorMode, PLAYER_CHARACTERS_CATEGORY, RESOURCE_CONFIG_ENTRY, ResourceOverrides, RollRulesConfig, WizardSession } from "../state";
import { WizardDefinition, WizardPrompt, WizardResult, WizardStateData, renderPromptText, resolveReply } from "../wizard";
import { takeLastEmptied, resolveCharacterRef, syncFromCreatorEdits } from "./afflictions";
import { rollOverridesFromNamed } from "./effects";


// --- The "resources" wizard: a guided editor for ResourceOverrides -----------
interface RwState {
  charName: string;
  defs: ResourceDef[];                              // snapshot, overrides applied
  overrides: Record<string, Partial<ResourceDef>>;  // edits being built
  queue: string[];                                  // resources still to visit
  current: string;                                  // resource being customized
  phase: "pick" | "start" | "max" | "effect" | "roles" | "confirm";
  total: number;
}
const rwState = (s: RwState): WizardStateData => s as unknown as WizardStateData;

// The wizard tunes the first numeric roll op of a default effect (its "knob").
const TUNABLE_OPS = ["difficulty", "dice", "successes", "uncancelable"];
const knobIndex = (e?: EffectSpec): number =>
  e ? e.apply.findIndex(o => TUNABLE_OPS.includes(o.op.toLowerCase())) : -1;

const rw = {
  def(state: RwState, name: string): ResourceDef {
    const k = StringUtil.normalize(name);
    return state.defs.find(d => StringUtil.normalize(d.name) === k)!;
  },
  patch(state: RwState, name: string): Partial<ResourceDef> {
    const k = StringUtil.normalize(name);
    return (state.overrides[k] ??= {});
  },
  steps(state: RwState): number { return state.total + 2; }, // resources + roles + confirm

  pickPrompt(state: RwState): WizardPrompt {
    const def = rw.def(state, state.queue[0]);
    const eff = def.effect ? ` Spend: ${def.effect.label}.` : "";
    return {
      step: `pick:${def.name}`, title: `Resource "${def.name}"`,
      body: `${def.kind}, start ${def.start}, max ${def.max}.${eff}`,
      kind: "choice",
      options: [
        { value: "keep", label: "Keep as is" },
        { value: "customize", label: "Customize start/max/effect" },
      ],
      default: "keep",
      progress: { at: state.total - state.queue.length + 1, of: rw.steps(state) },
    };
  },
  numberPrompt(state: RwState, field: "start" | "max", current: number): WizardPrompt {
    return {
      step: `${field}:${state.current}`, title: `"${state.current}" ${field}`,
      body: `currently ${current}.`, kind: "number", default: String(current),
      progress: { at: state.total - state.queue.length, of: rw.steps(state) },
    };
  },
  effectPrompt(state: RwState): WizardPrompt {
    const e = rw.def(state, state.current).effect!;
    const op = e.apply[knobIndex(e)];
    const cur = op.amount ?? 1;
    return {
      step: `effect:${state.current}`, title: `"${state.current}" spend effect`,
      body: `${e.label} - new ${op.op} amount (currently ${cur}).`, kind: "number", default: String(cur),
      progress: { at: state.total - state.queue.length, of: rw.steps(state) },
    };
  },
  rolesPrompt(state: RwState): WizardPrompt {
    // Show THIS character's resources and the roles each fills right now
    // (overrides included), so the step reflects the sheet in front of you -
    // and take the example from those resources rather than a stock name the
    // character may not even have.
    const rolesOf = (d: ResourceDef): string[] => {
      const patched = state.overrides[StringUtil.normalize(d.name)]?.roles;
      return (patched ?? d.roles ?? []).filter(r => StringUtil.normalize(r) !== StringUtil.normalize(d.name));
    };
    const current = state.defs
      .map(d => { const roles = rolesOf(d); return `${d.name}${roles.length ? `: ${roles.join("/")}` : " (no extra roles)"}`; })
      .join("; ");
    const sample = state.defs[0];
    const sampleRole = sample ? (rolesOf(sample)[0] ?? "resolve") : "resolve";
    return {
      step: "roles", title: "Extra roles",
      body: `Let one resource fill another's job: reply "resource: role" (e.g. "${sample?.name ?? "quintessence"}: ${sampleRole}" spends it as ${StringUtil.toTitleCase(sampleRole)}).`
        + ` Now: ${current || "no resources"}. "done" moves on.`,
      kind: "text", default: "done",
      progress: { at: state.total + 1, of: rw.steps(state) },
    };
  },
  confirmPrompt(state: RwState): WizardPrompt {
    const changes = Object.entries(state.overrides)
      .filter(([, p]) => Object.keys(p).length > 0)
      .map(([k, p]) => `${k} (${inlineCardText(p as CardValue)})`).join("; ");
    return {
      step: "confirm", title: "Save changes?",
      body: changes ? `Changes: ${changes}.` : "No changes were made.",
      kind: "confirm", default: "yes",
      progress: { at: state.total + 2, of: rw.steps(state) },
    };
  },
  advance(state: RwState): WizardResult {
    state.current = "";
    if (state.queue.length > 0) { state.phase = "pick"; return { state: rwState(state), prompt: rw.pickPrompt(state) }; }
    state.phase = "roles";
    return { state: rwState(state), prompt: rw.rolesPrompt(state) };
  },
};

// A resource number the WIZARD can show: it edits one resource at a time with
// no character in hand, so an expression (a Fount-scaled capacity) has nothing
// to evaluate against and shows as 0 - typing a number over it replaces the
// expression with a flat one, which is exactly what a house rule wants.
const flatNumber = (v: Numeric | undefined): number => (typeof v === "number" ? v : 0);

export const RESOURCES_WIZARD: WizardDefinition = {
  id: "resources",
  title: "Resource configuration",
  start(ctx: unknown): WizardResult {
    const { charName, defs } = ctx as { charName: string; defs: ResourceDef[] };
    const state: RwState = {
      charName, defs, overrides: {},
      queue: defs.map(d => StringUtil.normalize(d.name)),
      current: "", phase: "pick", total: defs.length,
    };
    return { state: rwState(state), prompt: rw.pickPrompt(state) };
  },
  async answer(stateData: WizardStateData, reply: string): Promise<WizardResult> {
    const state = stateData as unknown as RwState;
    switch (state.phase) {
      case "pick": {
        if (reply === "customize") {
          state.current = state.queue.shift()!;
          state.phase = "start";
          return { state: rwState(state), prompt: rw.numberPrompt(state, "start", flatNumber(rw.def(state, state.current).start)) };
        }
        state.queue.shift();
        return rw.advance(state);
      }
      case "start": {
        const v = parseInt(reply, 10);
        const def = rw.def(state, state.current);
        if (v !== def.start) rw.patch(state, state.current).start = v;
        state.phase = "max";
        return { state: rwState(state), prompt: rw.numberPrompt(state, "max", flatNumber(def.max)) };
      }
      case "max": {
        const v = parseInt(reply, 10);
        const def = rw.def(state, state.current);
        if (v !== def.max) rw.patch(state, state.current).max = v;
        if (knobIndex(def.effect) >= 0) { state.phase = "effect"; return { state: rwState(state), prompt: rw.effectPrompt(state) }; }
        return rw.advance(state);
      }
      case "effect": {
        const v = parseInt(reply, 10);
        const e = rw.def(state, state.current).effect!;
        const i = knobIndex(e);
        if (v !== (e.apply[i].amount ?? 1)) {
          rw.patch(state, state.current).effect = { ...e, apply: e.apply.map((o, j) => j === i ? { ...o, amount: v } : o) };
        }
        return rw.advance(state);
      }
      case "roles": {
        if (reply === "done" || reply === "") {
          state.phase = "confirm";
          return { state: rwState(state), prompt: rw.confirmPrompt(state) };
        }
        const m = reply.match(/^([^:]+):(.+)$/);
        if (!m) return { error: 'use "resource: role" (e.g. "quintessence: resolve"), or "done"' };
        const name = StringUtil.normalize(m[1]);
        const role = StringUtil.normalize(m[2]);
        const def = state.defs.find(d => StringUtil.normalize(d.name) === name);
        if (!def) return { error: `no resource "${name}" on this character` };
        const patch = rw.patch(state, name);
        patch.roles = [...new Set([...(patch.roles ?? def.roles ?? []), role])];
        return { state: rwState(state), prompt: rw.rolesPrompt(state) };
      }
      case "confirm": {
        if (reply !== "yes") return { done: true, summary: "Discarded - existing configuration kept." };
        const map = { ...ResourceOverrides.current() };
        let changed = 0;
        for (const [k, p] of Object.entries(state.overrides)) {
          if (Object.keys(p).length === 0) continue;
          map[k] = { ...(map[k] ?? {}), ...p };
          changed++;
        }
        if (changed === 0) return { done: true, summary: "Nothing changed - existing configuration kept." };
        await ResourceOverrides.save(map);
        return { done: true, summary: `Saved ${changed} resource override${changed === 1 ? "" : "s"} to "${RESOURCE_CONFIG_ENTRY}" - view or hand-edit that lorebook entry anytime.` };
      }
    }
    return { error: "wizard state is confused - reply cancel and restart" };
  },
};

const WIZARD_DEFS: Record<string, WizardDefinition> = { resources: RESOURCES_WIZARD };

// Feed a plain-input reply to the active wizard; returns the OOC line.
export async function answerActiveWizard(active: ActiveWizard, raw: string): Promise<string> {
  if (/^\s*cancel\s*$/i.test(raw)) {
    await WizardSession.clear();
    return sys(`Wizard cancelled - nothing saved.`);
  }
  const def = WIZARD_DEFS[active.def];
  if (!def) {
    await WizardSession.clear();
    return sys(`The active wizard "${active.def}" no longer exists - session cleared.`);
  }
  const resolved = resolveReply(active.prompt, raw);
  if ("error" in resolved) {
    return sys(`${resolved.error}. ${renderPromptText(active.prompt)}`);
  }
  const r = await def.answer(active.state, resolved.value);
  if (r.error) return sys(`${r.error}. ${renderPromptText(active.prompt)}`);
  if (r.done) {
    await WizardSession.clear();
    return sys(`${def.title} finished. ${r.summary ?? ""}`);
  }
  await WizardSession.set({ def: active.def, state: r.state!, prompt: r.prompt! });
  return sys(`${renderPromptText(r.prompt!)}`);
}

// --- COMMAND HANDLERS -------------------------------------------------------
// Each returns a single OOC line. Registered into CommandRouter at the bottom.

// Names are stored normalized ("erik-the-red"); replies show them in Title Case
// ("Erik The Red"). Backtick literals are the verbatim escape hatch for text
// that must not be normalized at all.
export const disp = (name: string): string => StringUtil.toTitleCase(name);
// A named argument as an integer, or undefined when absent or unparseable -
// "not given" and "given as nonsense" both mean "the caller decides".
export function intOrUndef(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const v = parseInt(s, 10);
  return Number.isNaN(v) ? undefined : v;
}

// The refusal every character-scoped verb gives. It was written out 36 times;
// one copy is one place to change how the engine asks you to pick someone.
const NO_CHARACTER = `No active character. Select one with [[play name="..."]]`;
export const noCharacter = (orElse = ""): string => sys(`${NO_CHARACTER}${orElse ? ` ${orElse}` : ""}.`);

export async function cmdCreatorMode(cmd: ParsedCommand): Promise<string> {
  const set = (cmd.named["set"] ?? cmd.positional[0] ?? "").toLowerCase();
  if (set !== "true" && set !== "false") {
    return sys(`creator-mode needs set=true or set=false.`);
  }
  if (set === "true") {
    await CreatorMode.set(true);
    return sys(`Creator mode ON. You may now edit entries in "${PLAYER_CHARACTERS_CATEGORY}" directly; edits are synced in when you issue a command or turn creator mode off.`);
  }
  // Leaving creator mode: capture any final lorebook edits, then switch off.
  const { synced, failed, emptied: justNow } = await syncFromCreatorEdits();
  // Cleared unconditionally, exactly as before - the take happens whichever
  // branch supplies the value, so a stale list cannot survive into a later run.
  const remembered = takeLastEmptied();
  const emptied = justNow.length ? justNow : remembered;
  await CreatorMode.set(false);
  const parts = [`Creator mode OFF.`];
  if (synced.length) parts.push(`Synced from lorebook: ${synced.join(", ")}.`);
  // The card is the source of truth, so a group left off it is a group erased.
  // That is correct, and it is exactly how a sheet quietly loses its
  // Backgrounds - so it is never quiet.
  if (emptied.length) parts.push(`⚠ A whole group went empty: ${emptied.join("; ")} - a group left OFF the card is erased. [[set-trait]] puts ratings back.`);
  if (failed.length) parts.push(`Could not read: ${failed.join(", ")} - a sheet needs at least a name and a template. Fix the card and sync again; the convert-cards command rewrites any card still holding the old JSON.`);
  return sys(`${parts.join(" ")}`);
}

export async function cmdCreatePlayable(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) return sys(`create-playable needs name="...".`);
  const rawTemplates = (cmd.named["templates"] ?? cmd.named["template"] ?? "").split(",").map(t => StringUtil.normalize(t)).filter(t => t.length > 0);
  if (rawTemplates.length === 0) return sys(`create-playable needs templates="a,b,..." (at least one).`);
  const unknown = rawTemplates.filter(t => !(t in TEMPLATES));
  if (unknown.length) {
    return sys(`Unknown template(s): ${unknown.join(", ")}. Valid: ${Object.keys(TEMPLATES).join(", ")}.`);
  }
  if (name.startsWith("@")) {
    return sys(`Character names cannot start with "@" - that sigil is reserved for aliases.`);
  }
  if (await CharacterStore.load(name)) {
    return sys(`A character named "${name}" already exists. Edit it in creator mode, or pick another name.`);
  }
  const char = await CharacterStore.newPotential(name, rawTemplates);
  await CharacterStore.save(char);
  // Auto-select the first character created as the default (and current).
  let note = "";
  if (!(await CharacterStore.getDefaultName())) {
    await CharacterStore.setDefault(name);
    await CharacterStore.setCurrent(name);
    note = " Selected as your default character.";
  }
  return sys(`Created playable character "${name}" [${rawTemplates.join("+")}] - Attributes at 1, Abilities at 0, everything else unassigned.${note} Its sheet is the "pc:${StringUtil.normalize(name)}" entry in "${PLAYER_CHARACTERS_CATEGORY}"; use creator mode to edit it. Tip: [[configure-resources]] walks you through tuning how resources work.`);
}

export async function cmdPlay(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) {
    // No argument: hand control back to the default character.
    const def = await CharacterStore.getDefaultName();
    const dc = def ? await CharacterStore.load(def) : undefined;
    if (!dc) return sys(`No default character to return to. Name one with [[play name="..."]].`);
    await CharacterStore.setCurrent(dc.name);
    return sys(`Playing your default character, "${disp(dc.name)}".`);
  }
  const ref = await resolveCharacterRef(name);
  if (ref.error) return sys(`${ref.error}`);
  const char = await CharacterStore.load(ref.name!);
  if (!char) return sys(`No character named "${ref.name}". Create it with [[create-playable ...]].`);
  await CharacterStore.setCurrent(char.name);
  return sys(`Now playing "${disp(char.name)}".`);
}


// Extract only the roll fields the player actually supplied (no defaults filled
// in), so callers can tell "keep the saved value" from "reset to default".
// `offset` is where the pool sits among the positionals (0 for [[roll]], 1 for
// [[roll-for "Name" ...]]). Difficulty and its modifier may be positional OR
// named (named wins); requires, dice-modifier and tags are named-only.
export function extractRollArgs(cmd: ParsedCommand, offset: number): Partial<RollSpec> {
  // The NAMED knobs are the same everywhere a roll can be described, so they
  // are read in one place (rollOverridesFromNamed). This adds only what is
  // peculiar to typing a roll out: the pool, and the positional difficulty and
  // difficulty-modifier that follow it. (Keeping two readers is how `successes=`
  // reached saved rolls but not `[[roll]]` itself.)
  const args: Partial<RollSpec> = rollOverridesFromNamed(cmd);
  const pool = cmd.positional[offset];
  if (pool !== undefined) args.pool = pool;
  // Difficulty may be a plain integer OR an expression (a trait / calculation
  // like "stamina+3"). A strict integer test keeps "3+2" an expression (-> 5),
  // not the number 3. Named wins; this is the positional fallback.
  const diffRaw = cmd.positional[offset + 1]?.trim();
  if (diffRaw && args.difficulty === undefined && args.difficultyExpr === undefined) {
    if (/^-?\d+$/.test(diffRaw)) args.difficulty = parseInt(diffRaw, 10);
    else args.difficultyExpr = diffRaw;
  }
  if (args.difficultyMod === undefined) {
    const difficultyMod = intOrUndef(cmd.positional[offset + 2]);
    if (difficultyMod !== undefined) args.difficultyMod = difficultyMod;
  }
  const requires = intOrUndef(cmd.named["requires"]);
  if (requires !== undefined) args.requires = requires;
  return args;
}

// EVERY roll the engine executes goes through here, so the chronicle's floor
// (wod:config:rolls -> min-difficulty) reaches all of them. A spec that names
// its own floor keeps it; when neither is set there is no floor at all beyond
// the engine's hard minimum of 2.
export function runRoll(spec: RollSpec, resolve: TraitResolver, opts: { rng?: Rng; extra?: Partial<RollModifier>; usedTags?: string[] } = {}): RollExecution {
  const floor = spec.minDifficulty ?? rollFloorFrom(RollRulesConfig.current());
  return executeRoll(floor === undefined ? spec : { ...spec, minDifficulty: floor }, resolve, opts);
}

// Ops the roll pipeline executes directly, and WHICH RollModifier field each
// one moves. THE one place that knows: `undefined` means "not a roll op", so
// the membership test and the translation can never disagree.
export function rollOpPatch(op: string, amount: number): Partial<RollModifier> | undefined {
  switch (op.toLowerCase()) {
    case "difficulty": return { difficultyMod: amount };
    case "dice": return { diceMod: amount };
    case "successes": return { autoSuccesses: amount };
    case "uncancelable": return { uncancelableSuccesses: amount };
    case "nagain": return { nAgain: amount };
    default: return undefined;
  }
}
export const isRollOp = (o: EffectOp): boolean => rollOpPatch(o.op, 0) !== undefined;

// Fold roll-modifier patches into an accumulator. Every field ADDS, except
// `nAgain`, which TIGHTENS - the lowest explosion threshold offered wins.
export function mergeRollExtra(into: Partial<RollModifier>, ...patches: Array<Partial<RollModifier>>): Partial<RollModifier> {
  for (const p of patches) {
    if (p.difficultyMod) into.difficultyMod = (into.difficultyMod ?? 0) + p.difficultyMod;
    if (p.diceMod) into.diceMod = (into.diceMod ?? 0) + p.diceMod;
    if (p.autoSuccesses) into.autoSuccesses = (into.autoSuccesses ?? 0) + p.autoSuccesses;
    if (p.uncancelableSuccesses) into.uncancelableSuccesses = (into.uncancelableSuccesses ?? 0) + p.uncancelableSuccesses;
    if (p.nAgain !== undefined) into.nAgain = Math.min(into.nAgain ?? 10, p.nAgain);
  }
  return into;
}
