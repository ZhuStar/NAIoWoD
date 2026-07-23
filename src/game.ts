// =============================================================================
// GAME - the live layer's surface: effect interpreter, wizards, command handlers
// -----------------------------------------------------------------------------
// This module implements the verbs. It reads/writes the stores in state.ts,
// interprets effect specs against live characters, and registers every command
// (with its CommandSpec - the one declarative description help text and
// windows derive from) on the CommandRouter in command.ts. The creator-mode
// lorebook sync is a beforeRoute hook registered here: the router dispatches,
// the game decides what must happen first.
// =============================================================================
// `api`, `UIPart`, `OnTextAdventureInputReturnValue` are ambient host globals
// (types vendored in types/novelai/script-types.d.ts).
import { StringUtil } from "./core/traits";
import { Rng } from "./core/dice";
import { SeverityName, HealthSummary } from "./core/damage";
import {
  TEMPLATES, ResourceDef, resourceEffect,
  EffectSpec, EffectOp, describeEffect,
  makeConstraintGroup, describeConstraint, checkConstraints, OwnedTraits,
  ConstraintRelation, ConstraintDomain, CONSTRAINT_RELATIONS, CONSTRAINT_DOMAINS,
  makeAfflictionDef, describeAfflictionDef, parseAfflictionDuration, describeDuration,
  AfflictionDef,
  MeritFlawRequirements, resolveMeritInstance, passiveOpsOf,
} from "./rules";
import {
  MeritFlawRegistry, reloadAllConfigStores, LorebookManager, ScopedStorage,
  TrackedLorebook, ReconcileFinding, combineConfigTexts, structuralHash,
  writeTrackedEntry, ensurePath, TABLE_GENERAL_HEADER,
} from "./services";
import {
  RollSpec, RollModifier, makeRollSpec, executeRoll, formatExecution, overrideSpec, describeSpec,
  ExtendedRoll, applyInterval, describeExtended, parseBotchPolicy, parsePoolExpression,
  SuccessTable, SuccessTableRegistry, readSuccessTable, describeTableReading, describeTable,
  parseTableRows, DEFAULT_SUCCESS_TABLES, RollOutcomeKind,
  ContestMode, ContestOutcome, compareRolls, ExtendedContest, applyContestRound, describeContest, RollExecution,
} from "./rolls";
import {
  WizardDefinition, WizardPrompt, WizardStateData, WizardResult, resolveReply, renderPromptText,
} from "./wizard";
import {
  ParsedCommand, CommandContext, CommandHandler, CommandRouter, ParamSpec, sys,
} from "./command";
import {
  PlayableCharacter, CharacterStore, PLAYER_CHARACTERS_CATEGORY,
  NamedRollStore, ExtendedRollStore, ExtendedContestStore,
  PlayerStore, AliasScope, AliasRef, parseAliasToken, AliasRegistry,
  resolveTraitFromRecord, ownedMeritInstances, enhancementsFor, SavedRoll,
  ResourceOverrides, RESOURCE_CONFIG_ENTRY, TableLibrary, TableAliases, TABLES_CATEGORY,
  ConstraintRegistry, AfflictionRegistry,
  ActiveAffliction, CharacterAfflictions,
  CharacterResources, CharacterHealth, CharacterBoosts, EffectUses,
  ActiveWizard, WizardSession, CreatorMode,
} from "./state";

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
const TUNABLE_OPS = ["difficulty", "dice", "successes"];
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
    const added = Object.entries(state.overrides)
      .filter(([, p]) => p.roles !== undefined)
      .map(([k, p]) => `${k}: ${(p.roles ?? []).join("/")}`).join("; ");
    return {
      step: "roles", title: "Extra roles",
      body: `Let one resource fill another's job: reply "resource: role" (e.g. "quintessence: resolve" spends Quintessence as Resolve).${added ? ` Set: ${added}.` : ""} "done" moves on.`,
      kind: "text", default: "done",
      progress: { at: state.total + 1, of: rw.steps(state) },
    };
  },
  confirmPrompt(state: RwState): WizardPrompt {
    const changes = Object.entries(state.overrides)
      .filter(([, p]) => Object.keys(p).length > 0)
      .map(([k, p]) => `${k} ${JSON.stringify(p)}`).join("; ");
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
          return { state: rwState(state), prompt: rw.numberPrompt(state, "start", rw.def(state, state.current).start) };
        }
        state.queue.shift();
        return rw.advance(state);
      }
      case "start": {
        const v = parseInt(reply, 10);
        const def = rw.def(state, state.current);
        if (v !== def.start) rw.patch(state, state.current).start = v;
        state.phase = "max";
        return { state: rwState(state), prompt: rw.numberPrompt(state, "max", def.max) };
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
async function answerActiveWizard(active: ActiveWizard, raw: string): Promise<string> {
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
const disp = (name: string): string => StringUtil.toTitleCase(name);

async function cmdCreatorMode(cmd: ParsedCommand): Promise<string> {
  const set = (cmd.named["set"] ?? cmd.positional[0] ?? "").toLowerCase();
  if (set !== "true" && set !== "false") {
    return sys(`creator-mode needs set=true or set=false.`);
  }
  if (set === "true") {
    await CreatorMode.set(true);
    return sys(`Creator mode ON. You may now edit entries in "${PLAYER_CHARACTERS_CATEGORY}" directly; edits are synced in when you issue a command or turn creator mode off.`);
  }
  // Leaving creator mode: capture any final lorebook edits, then switch off.
  const { synced, failed } = await syncFromCreatorEdits();
  await CreatorMode.set(false);
  const parts = [`Creator mode OFF.`];
  if (synced.length) parts.push(`Synced from lorebook: ${synced.join(", ")}.`);
  if (failed.length) parts.push(`Could not parse: ${failed.join(", ")} - fix the JSON and sync again.`);
  return sys(`${parts.join(" ")}`);
}

async function cmdCreatePlayable(cmd: ParsedCommand): Promise<string> {
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

async function cmdPlay(cmd: ParsedCommand): Promise<string> {
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
function extractRollArgs(cmd: ParsedCommand, offset: number): Partial<RollSpec> {
  const intOf = (s: string | undefined): number | undefined => {
    if (s === undefined) return undefined;
    const v = parseInt(s, 10);
    return Number.isNaN(v) ? undefined : v;
  };
  const args: Partial<RollSpec> = {};
  const pool = cmd.positional[offset];
  if (pool !== undefined) args.pool = pool;
  // Difficulty may be a plain integer OR an expression (a trait / calculation
  // like "stamina+3"). A strict integer test keeps "3+2" an expression (-> 5),
  // not the number 3.
  const diffRaw = (cmd.named["difficulty"] ?? cmd.positional[offset + 1])?.trim();
  if (diffRaw) {
    if (/^-?\d+$/.test(diffRaw)) args.difficulty = parseInt(diffRaw, 10);
    else args.difficultyExpr = diffRaw;
  }
  const difficultyMod = intOf(cmd.named["difficulty-modifier"] ?? cmd.named["diff-mod"] ?? cmd.positional[offset + 2]);
  if (difficultyMod !== undefined) args.difficultyMod = difficultyMod;
  const requires = intOf(cmd.named["requires"]);
  if (requires !== undefined) args.requires = requires;
  const diceMod = intOf(cmd.named["dice-modifier"]);
  if (diceMod !== undefined) args.diceMod = diceMod;
  if (cmd.named["tags"] !== undefined) {
    args.tags = cmd.named["tags"].split(",").map(t => t.trim()).filter(t => t.length > 0);
  }
  return args;
}

// Ops the roll pipeline executes directly (as the roll's `extra` modifier).
const ROLL_OPS = new Set(["difficulty", "dice", "successes", "nagain"]);
const isRollOp = (o: EffectOp): boolean => ROLL_OPS.has(o.op.toLowerCase());

// =============================================================================
// THE EFFECT INTERPRETER - execute one EffectSpec for a character
// -----------------------------------------------------------------------------
// Pays the cost (after any cost-reducing roll), records limited uses in the
// ledger, then walks `apply`: roll ops accumulate into an `extra` modifier
// (optionally gated on an action tag the roll must carry); "increase" raises a
// trait through the boost layer (constraint targets, expression caps, fill-to-
// cap); "heal" mends the live track; anything else - "suspend", "resist",
// words that don't exist yet - is preserved and NOTED for the Storyteller to
// adjudicate until its interpreter lands.
// =============================================================================
interface EffectApplication {
  extra?: Partial<RollModifier>;
  notes: string[];
  refuse?: string;        // configuration problem (bad target, missing effect) - always surface
  insufficient?: string;  // can't pay - caller decides (mandatory refuses, optional just notes)
}

async function applyEffectSpec(
  char: PlayableCharacter, def: ResourceDef, effectName: string, spec: EffectSpec,
  opts: { targetArg?: string; applications?: number; rng?: Rng; rollTags?: string[]; rollTraits?: string[] } = {}
): Promise<EffectApplication> {
  const notes: string[] = [];
  const resolver = (n: string): number => resolveTraitFromRecord(char, n);
  const tag = effectName ? ` (${effectName})` : "";

  // Validate increase targets BEFORE any cost is paid - a misconfigured
  // command must not charge the character.
  for (const op of spec.apply) {
    if (op.op.toLowerCase() !== "increase") continue;
    const res = CharacterBoosts.resolveIncreaseTarget(char, op.target, opts.targetArg);
    if ("need" in res) return { notes, refuse: `${def.name}${tag} needs a target - ${res.need}` };
    if ("error" in res) return { notes, refuse: res.error };
  }

  // Applications, clamped by the per-use limit.
  let applications = Math.max(1, opts.applications ?? 1);
  if (spec.limits?.maxPerUse !== undefined && applications > spec.limits.maxPerUse) {
    applications = Math.max(1, spec.limits.maxPerUse);
    notes.push(`capped at ${applications} per use`);
  }

  // Cost, minus the reduction roll (Iron Will and friends) - can reach zero.
  let units = Math.max(0, (spec.cost?.units ?? 1) * applications);
  if (spec.cost?.reducedBy && units > 0) {
    const rb = spec.cost.reducedBy;
    const exec = executeRoll(makeRollSpec({ pool: rb.pool, difficulty: rb.difficulty }), resolver, { rng: opts.rng });
    const cut = Math.min(units, Math.max(0, exec.result?.net ?? 0) * (rb.perSuccess ?? 1));
    if (cut > 0) { units -= cut; notes.push(`${rb.pool} roll offsets ${cut} cost`); }
  }
  const have = await CharacterResources.current(char, def);
  if (units > have) return { notes, insufficient: `not enough ${def.name} (needs ${units})` };
  if (units > 0) await CharacterResources.spend(char, def.name, units);
  notes.unshift(`spent ${units} ${def.name}${tag}`);
  const effectUnits = applications * Math.max(1, spec.cost?.buys ?? 1);

  // Usage ledger for limited effects (ST-enforced until the turn system).
  if (spec.limits?.uses || spec.limits?.cooldown) {
    const used = await EffectUses.record(char, def.name, effectName);
    if (spec.limits.uses) {
      const { n, per } = spec.limits.uses;
      notes.push(`use ${used}/${n} per ${per}${used > n ? " - OVER LIMIT" : ""} (ST-enforced; [[reset-uses]] at ${per} change)`);
    }
    if (spec.limits.cooldown) notes.push(`cooldown ${spec.limits.cooldown.n} ${spec.limits.cooldown.unit} (ST-enforced)`);
  }

  // Execute the operations.
  const extra: Partial<RollModifier> = {};
  let anyRollOp = false;
  for (const op of spec.apply) {
    const kind = op.op.toLowerCase();
    if (isRollOp(op)) {
      // An action-tag target gates the op on the roll carrying that tag.
      if (op.target) {
        const wanted = StringUtil.normalize(op.target);
        if (!(opts.rollTags ?? []).includes(wanted)) { notes.push(`${kind} needs tag "${wanted}" - skipped`); continue; }
      }
      // A trait gate: the op applies only when the roll's POOL used the trait
      // (a trait appearing only in the difficulty expression doesn't count).
      if (op.trait) {
        const wanted = StringUtil.normalize(op.trait);
        if (!(opts.rollTraits ?? []).includes(wanted)) { notes.push(`${kind} needs a roll using "${wanted}" - skipped`); continue; }
      }
      anyRollOp = true;
      if (kind === "difficulty") extra.difficultyMod = (extra.difficultyMod ?? 0) + (op.amount ?? 1) * effectUnits;
      else if (kind === "dice") extra.diceMod = (extra.diceMod ?? 0) + (op.amount ?? 1) * effectUnits;
      else if (kind === "successes") extra.autoSuccesses = (extra.autoSuccesses ?? 0) + (op.amount ?? 1) * effectUnits;
      else if (kind === "nagain") extra.nAgain = Math.min(extra.nAgain ?? 10, op.amount ?? 10);
    } else if (kind === "increase") {
      const res = CharacterBoosts.resolveIncreaseTarget(char, op.target, opts.targetArg);
      if ("need" in res || "error" in res) continue; // pre-validated above; defensive
      const cap = op.cap === undefined ? (op.fillToCap ? 5 : Infinity)
        : typeof op.cap === "number" ? op.cap
        : parsePoolExpression(op.cap, resolver).total;
      const boosts = await CharacterBoosts.all(char);
      const base = resolveTraitFromRecord(char, res.trait) + (boosts[res.trait] ?? 0);
      const want = op.fillToCap ? Math.max(0, cap - base) : (op.amount ?? 1) * effectUnits;
      const { added, total } = await CharacterBoosts.add(char, res.trait, want, cap);
      notes.push(added > 0
        ? `${StringUtil.toTitleCase(res.trait)} +${added} (boost total +${total})`
        : `${StringUtil.toTitleCase(res.trait)} is already at its cap`);
    } else if (kind === "heal") {
      const targets = (op.target ?? "all").toLowerCase() === "all"
        ? ["bashing", "lethal", "aggravated"]
        : (op.target ?? "").split(",").map(s => s.trim()).filter(s => s.length > 0);
      const amount = op.fillToCap ? Number.MAX_SAFE_INTEGER : (op.amount ?? 1) * effectUnits;
      const { healed, summary } = await CharacterHealth.heal(char, targets, amount);
      notes.push(`healing ${healed} box${healed === 1 ? "" : "es"}. Health: ${healthLine(summary)}`);
    } else {
      // Open vocabulary: preserved, surfaced, adjudicated - not rejected.
      notes.push(`${kind}${op.target ? ` ${op.target}` : ""}: recorded - Storyteller adjudicates (no interpreter yet)`);
    }
  }

  // Non-instant durations are advisory until the turn system exists.
  if (spec.duration && spec.duration.kind !== "instant") {
    const d = spec.duration;
    notes.push(`lasts ${d.kind === "until" ? `until ${d.until}` : `${d.n ?? 1} ${d.unit ?? d.kind}`} (ST-enforced)`);
  }

  return { extra: anyRollOp ? extra : undefined, notes };
}

// Read a spend=<resource|role>[:effect][!] request off a command (with optional
// spend-amount=N stacking), pay it, and return the roll modifier. A trailing
// "!" makes it MANDATORY: if it can't be paid, `refuse` is set and the caller
// does NOT roll (Willpower/Resolve as required spell fuel). Only roll-op (or
// pure-cost) effects belong inside a roll; standalone ops point at [[spend]].
async function applySpend(char: PlayableCharacter, cmd: ParsedCommand, ctx: CommandContext, rollTags: string[], rollTraits: string[], spendOverride?: string): Promise<{ extra?: Partial<RollModifier>; note: string; refuse?: string }> {
  // An explicit spend= on the command wins; otherwise a saved roll's own spend
  // (the `@name` sidecar) applies automatically.
  const raw = cmd.named["spend"] ?? spendOverride;
  if (!raw) return { note: "" };
  let token = raw.trim();
  const mandatory = token.endsWith("!");
  if (mandatory) token = token.slice(0, -1).trim();
  const [nameOrRole, effectName] = token.split(":").map(s => s.trim());
  const def = CharacterResources.resolveDef(char, nameOrRole);
  if (!def) return mandatory ? { note: "", refuse: `has no resource "${nameOrRole}"` } : { note: `no resource "${nameOrRole}" to spend` };
  const e = resourceEffect(def, effectName || undefined);
  if (effectName && !e) return { note: "", refuse: `${def.name} has no "${effectName}" effect` };

  const applications = Math.max(1, parseInt(cmd.named["spend-amount"] ?? "1", 10) || 1);

  if (!e) {
    // No effect configured: a plain deduction rides along with the roll.
    const { spent } = await CharacterResources.spend(char, nameOrRole, applications);
    if (spent === 0) return mandatory ? { note: "", refuse: `not enough ${def.name}` } : { note: `not enough ${def.name} to spend` };
    return { note: `spent ${spent} ${def.name}` };
  }

  const standalone = e.apply.find(o => !isRollOp(o));
  if (standalone) {
    const kind = standalone.op.toLowerCase() === "heal" ? "healing"
      : standalone.op.toLowerCase() === "increase" ? "boost" : `"${standalone.op}"`;
    return { note: "", refuse: `${def.name}::${effectName} is a ${kind} effect - use [[spend ${def.name}::${effectName} ...]] outside a roll` };
  }

  const r = await applyEffectSpec(char, def, effectName ?? "", e, { applications, rng: ctx.rng, rollTags, rollTraits });
  if (r.insufficient) return mandatory ? { note: "", refuse: r.insufficient } : { note: `${r.insufficient} - spent nothing` };
  if (r.refuse) return { note: "", refuse: r.refuse };
  return { extra: r.extra, note: `${r.notes.join("; ")}: ${e.label}` };
}

// A character's live roll environment: traits + active boosts, and the wound
// penalty to fold into the dice pool. Shared by rolls and contests.
async function characterRollEnv(char: PlayableCharacter): Promise<{ resolver: (n: string) => number; penalty: number }> {
  const boosts = await CharacterBoosts.all(char);
  const enh = enhancementsFor(char);   // Trait Enhancement: permanent, beside the temporary boosts
  const penalty = (await CharacterHealth.summary(char)).penalty;
  return {
    resolver: (n: string): number => {
      const key = StringUtil.normalize(n);
      return resolveTraitFromRecord(char, key) + (enh[key] ?? 0) + (boosts[key] ?? 0);
    },
    penalty,
  };
}

// Which traits a POOL expression actually resolves (normalized). This is the
// gate for Trait Affinity, trait-gated ops and specialties - deliberately a
// pre-parse of the pool ONLY: a trait that appears just in the difficulty
// expression must not count as "using" it.
function poolTraitsOf(char: PlayableCharacter, pool: string): string[] {
  const used = new Set<string>();
  parsePoolExpression(pool, (n: string): number => {
    const key = StringUtil.normalize(n);
    used.add(key);
    return resolveTraitFromRecord(char, key);
  });
  return [...used];
}

// Fold the character's PASSIVE roll ops (owned merits/arcana - Trait Affinity
// et al.) into a roll: trait-gated ops fire iff the pool used the trait,
// actionTag-gated ops iff the roll carries the tag; unmet gates skip SILENTLY
// (passives must not spam every unrelated roll). "enhance" is env-level and
// ignored here.
function passiveRollExtra(char: PlayableCharacter, poolTraits: string[], tags: string[]): { extra: Partial<RollModifier>; notes: string[] } {
  const extra: Partial<RollModifier> = {};
  const notes: string[] = [];
  for (const inst of ownedMeritInstances(char)) {
    for (const op of passiveOpsOf(inst.def, inst.param, inst.points)) {
      const kind = op.op.toLowerCase();
      if (!ROLL_OPS.has(kind)) continue;
      if (op.target && !tags.includes(StringUtil.normalize(op.target))) continue;
      if (op.trait && !poolTraits.includes(StringUtil.normalize(op.trait))) continue;
      const amount = op.amount ?? 1;
      if (kind === "difficulty") extra.difficultyMod = (extra.difficultyMod ?? 0) + amount;
      else if (kind === "dice") extra.diceMod = (extra.diceMod ?? 0) + amount;
      else if (kind === "successes") extra.autoSuccesses = (extra.autoSuccesses ?? 0) + amount;
      else if (kind === "nagain") { extra.nAgain = Math.min(extra.nAgain ?? 10, amount); }
      const who = `${StringUtil.normalize(inst.def.name)}${inst.param ? ` (${inst.param})` : ""}`;
      notes.push(`${who}: ${kind} ${amount > 0 ? "+" : ""}${amount}`);
    }
  }
  return { extra, notes };
}

// Resolve a specialty= reference (a trait name, or a specialty label) against
// the character's specialties. AT MOST ONE specialty applies per roll - the
// argument names it. Applying requires the pool to have used the trait
// (advisory note otherwise, no die).
function resolveSpecialty(char: PlayableCharacter, ref: string, poolTraits: string[]): { note: string; extra?: Partial<RollModifier> } {
  const want = StringUtil.normalize(ref);
  const specs = char.specialties ?? {};
  let trait: string | undefined;
  let label: string | undefined;
  const traitLabels = specs[want];
  if (traitLabels && traitLabels.length > 0) {
    if (traitLabels.length > 1) return { note: `specialty: "${want}" has several (${traitLabels.join(", ")}) - name one` };
    trait = want;
    label = traitLabels[0];
  } else {
    const hits: Array<{ trait: string; label: string }> = [];
    for (const [t, labels] of Object.entries(specs)) {
      for (const l of labels) if (StringUtil.normalize(l) === want) hits.push({ trait: t, label: l });
    }
    if (hits.length === 0) return { note: `no specialty "${ref}" (see [[specialties]])` };
    if (hits.length > 1) return { note: `specialty "${ref}" is ambiguous (${hits.map(h => h.trait).join(", ")}) - use the trait` };
    trait = hits[0].trait;
    label = hits[0].label;
  }
  if (!poolTraits.includes(trait)) return { note: `specialty ${label} (${trait}): pool didn't use ${trait} - no die` };
  return { note: `specialty: ${label} (+1 die)`, extra: { diceMod: 1 } };
}

// Merge the tags granted by someone's active afflictions into a roll spec
// (deduped). This is how afflictions bite mechanically today: a def's tags fire
// registered RollModifiers on every roll the afflicted character makes.
async function withAfflictionTags(name: string, spec: RollSpec): Promise<RollSpec> {
  const condTags = await CharacterAfflictions.tags(name);
  if (!condTags.length) return spec;
  return { ...spec, tags: [...new Set([...spec.tags, ...condTags])] };
}

// A table argument may be a key ("degrees", "combat::quick-kill" -> the
// boundary folds :: to :) or a @table-alias; this is the ONE seam turning
// either into a registry key. Paths go one level deep for now (policy).
async function resolveTableRef(raw: string): Promise<{ key?: string; error?: string }> {
  const t = StringUtil.normalize(raw);
  if (t.startsWith("@")) {
    const hit = await TableAliases.resolve(t.slice(1));
    return hit ? { key: hit } : { error: `Unknown table alias "${t}". [[table-alias]] lists them.` };
  }
  if (t.split(":").filter(Boolean).length > 2) {
    return { error: `Table paths go one level deep for now ("sub::name").` };
  }
  return { key: t };
}

// Read a table ref (table=<key|@alias>, or a saved roll's table sidecar)
// against an outcome. The roll itself never interprets its successes - the
// table does (or the reading is an unknown-table note).
async function tableNote(raw: string | undefined, outcome: RollOutcomeKind, successes: number): Promise<string> {
  if (!raw) return "";
  const ref = await resolveTableRef(raw);
  if (ref.error) return ref.error;
  const table = SuccessTableRegistry.get(ref.key!);
  if (!table) return `unknown table "${ref.key}" (see [[tables]])`;
  return `${table.name}: ${describeTableReading(readSuccessTable(table, outcome, successes))}`;
}

async function rollAndReport(char: PlayableCharacter, cmd: ParsedCommand, ctx: CommandContext, offset: number): Promise<string> {
  const args = extractRollArgs(cmd, offset);
  if (!args.pool) return sys(`roll needs a pool, e.g. [[roll strength+brawl]] or a saved [[roll @name]].`);
  let spec: RollSpec;
  let savedSpend: string | undefined;
  let savedSpecialty: string | undefined;
  let savedTable: string | undefined;
  if (args.pool.startsWith("@")) {
    // Saved roll: load the base spec, then apply the supplied overrides (pool is
    // never overridden, so passing `args` straight through to overrideSpec is safe).
    const name = StringUtil.normalize(args.pool.slice(1));
    const base = await NamedRollStore.get(name);
    if (!base) return sys(`No saved roll named "${name}". Try [[list-rolls]] or [[name-roll ${name} <pool> ...]].`);
    savedSpend = base.spend;         // auto-paid unless the command overrides spend=
    savedSpecialty = base.specialty; // auto-applied unless the command overrides specialty=
    savedTable = base.table;         // read against the outcome unless table= overrides
    spec = overrideSpec(base, args);
  } else {
    spec = makeRollSpec({ ...args, pool: args.pool });
  }
  // Active afflictions bite: their tags join the roll, firing any registered
  // RollModifiers (unregistered ones surface as the usual unknown-tag note).
  spec = await withAfflictionTags(char.name, spec);
  const poolTraits = poolTraitsOf(char, spec.pool);
  const spend = await applySpend(char, cmd, ctx, spec.tags, poolTraits, savedSpend);
  if (spend.refuse) return sys(`${disp(char.name)} can't: ${spend.refuse}.`);
  // Rolls see live state: enhancements + boosts add to the record's dots, the
  // wound penalty (negative) comes off the dice pool, owned passives (Trait
  // Affinity et al.) fold in, and at most one specialty grants its die.
  const env = await characterRollEnv(char);
  const passive = passiveRollExtra(char, poolTraits, spec.tags);
  const specialtyRef = cmd.named["specialty"] ?? savedSpecialty;
  const specialty = specialtyRef ? resolveSpecialty(char, specialtyRef, poolTraits) : { note: "" };
  const extra: Partial<RollModifier> = { ...(spend.extra ?? {}) };
  for (const p of [passive.extra, specialty.extra ?? {}]) {
    if (p.difficultyMod) extra.difficultyMod = (extra.difficultyMod ?? 0) + p.difficultyMod;
    if (p.diceMod) extra.diceMod = (extra.diceMod ?? 0) + p.diceMod;
    if (p.autoSuccesses) extra.autoSuccesses = (extra.autoSuccesses ?? 0) + p.autoSuccesses;
    if (p.nAgain !== undefined) extra.nAgain = Math.min(extra.nAgain ?? 10, p.nAgain);
  }
  if (env.penalty !== 0) extra.diceMod = (extra.diceMod ?? 0) + env.penalty;
  const exec = executeRoll(spec, env.resolver, { rng: ctx.rng, extra });
  const notes = [
    spend.note,
    ...passive.notes,
    specialty.note,
    env.penalty !== 0 ? `wound penalty ${env.penalty}` : "",
    await tableNote(cmd.named["table"] ?? savedTable, exec.outcome, exec.result?.net ?? 0),
  ].filter(Boolean).join("; ");
  return sys(`${disp(char.name)} - ${formatExecution(exec)}${notes ? ` - ${notes}` : ""}`);
}

async function cmdRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  return rollAndReport(char, cmd, ctx, 0);
}

async function cmdRollFor(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const target = cmd.positional[0]?.trim();
  if (!target) return sys(`roll-for needs a character name, e.g. [[roll-for "Erik" strength+brawl]].`);
  const ref = await resolveCharacterRef(target);
  if (ref.error) return sys(`${ref.error}`);
  const char = await CharacterStore.load(ref.name!);
  if (!char) return sys(`No character named "${ref.name}".`);
  return rollAndReport(char, cmd, ctx, 1);
}

// The sidecars a saved roll carries beyond its spec, as "k=v" display pairs.
function describeSidecars(saved: SavedRoll): string {
  return [
    saved.spend ? `spend=${saved.spend}` : "",
    saved.specialty ? `specialty=${saved.specialty}` : "",
    saved.table ? `table=${saved.table}` : "",
  ].filter(Boolean).join(", ");
}

// Save a reusable roll: name is positional[0], then the roll grammar at offset 1.
async function cmdNameRoll(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`name-roll needs a name, e.g. [[name-roll dodge dexterity+dodge 6]].`);
  const args = extractRollArgs(cmd, 1);
  if (!args.pool) return sys(`name-roll needs a pool, e.g. [[name-roll dodge dexterity+dodge 6]].`);
  // A @reference can't be saved: invocation doesn't chain saved rolls, so the
  // stored pool must be a real expression (same guard as extended-roll).
  if (args.pool.startsWith("@")) return sys(`name-roll takes a pool expression (e.g. dexterity+dodge), not a saved @name.`);
  const spec = makeRollSpec({ ...args, pool: args.pool });
  const spend = cmd.named["spend"]?.trim();
  const specialty = cmd.named["specialty"]?.trim();
  const table = cmd.named["table"]?.trim();
  const saved: SavedRoll = { ...spec };
  if (spend) saved.spend = spend;
  if (specialty) saved.specialty = specialty;
  if (table) saved.table = table;
  await NamedRollStore.save(name, saved);
  const key = StringUtil.normalize(name);
  const sidecars = describeSidecars(saved);
  return sys(`Saved roll "${key}" = ${describeSpec(spec)}${sidecars ? `, ${sidecars}` : ""}. Use it with [[roll @${key}]].`);
}

async function cmdListRolls(): Promise<string> {
  const map = await NamedRollStore.all();
  const names = Object.keys(map);
  if (!names.length) return sys(`No saved rolls yet. Save one with [[name-roll <name> <pool> ...]].`);
  const items = names.map(n => {
    const sidecars = describeSidecars(map[n]);
    return `${n} (${describeSpec(map[n])}${sidecars ? `, ${sidecars}` : ""})`;
  }).join("; ");
  return sys(`Saved rolls: ${items}.`);
}

async function cmdForgetRoll(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`forget-roll needs a name, e.g. [[forget-roll dodge]].`);
  const key = StringUtil.normalize(name);
  return (await NamedRollStore.remove(key))
    ? sys(`Forgot saved roll "${key}".`)
    : sys(`No saved roll named "${key}".`);
}

// Named-only roll overrides for a continuation (no positional pool/difficulty, so
// the optional id positional is never mistaken for a pool). `requires` is not
// per-interval overridable - the target is fixed on the action.
function rollOverridesFromNamed(cmd: ParsedCommand): Partial<RollSpec> {
  const intOf = (s: string | undefined): number | undefined => {
    if (s === undefined) return undefined;
    const v = parseInt(s, 10);
    return Number.isNaN(v) ? undefined : v;
  };
  const o: Partial<RollSpec> = {};
  const diffRaw = cmd.named["difficulty"]?.trim();
  if (diffRaw) {
    if (/^-?\d+$/.test(diffRaw)) o.difficulty = parseInt(diffRaw, 10);
    else o.difficultyExpr = diffRaw;
  }
  const difficultyMod = intOf(cmd.named["difficulty-modifier"] ?? cmd.named["diff-mod"]);
  if (difficultyMod !== undefined) o.difficultyMod = difficultyMod;
  const diceMod = intOf(cmd.named["dice-modifier"]);
  if (diceMod !== undefined) o.diceMod = diceMod;
  if (cmd.named["tags"] !== undefined) o.tags = cmd.named["tags"].split(",").map(t => t.trim()).filter(t => t.length > 0);
  return o;
}

// Start an extended action and roll its first interval as the current character.
async function cmdExtendedRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const args = extractRollArgs(cmd, 0);
  if (!args.pool) return sys(`extended-roll needs a pool, e.g. [[extended-roll strength+stamina requires=8 intervals=4]].`);
  if (args.pool.startsWith("@")) return sys(`extended-roll takes a pool expression (e.g. strength+stamina), not a saved @name.`);
  const intOf = (s: string | undefined): number | undefined => { if (s === undefined) return undefined; const v = parseInt(s, 10); return Number.isNaN(v) ? undefined : v; };
  const maxRolls = intOf(cmd.named["intervals"]) ?? 0;
  if (maxRolls < 1) return sys(`extended-roll needs intervals=<max rolls> (at least 1).`);
  const target = args.requires ?? 1;   // `requires=` is the accumulated target
  const base = makeRollSpec({ ...args, pool: args.pool, requires: 1 });
  const action: ExtendedRoll = {
    id: api.v1.uuid(),
    label: cmd.named["label"] ?? "",
    base, target, maxRolls,
    interval: cmd.named["interval"] ?? "",
    onBotch: parseBotchPolicy(cmd.named["on-botch"]),
    accumulated: 0, rollsUsed: 0, status: "open", log: [],
  };
  const exec = executeRoll(base, n => resolveTraitFromRecord(char, n), { rng: ctx.rng });
  const { action: after, note } = applyInterval(action, exec, char.name);
  await ExtendedRollStore.save(after);
  if (after.status === "open") await ExtendedRollStore.setCurrent(after.id);
  const tail = after.status === "open" ? ` Continue with [[continue-roll]] (id ${after.id}).` : "";
  return sys(`${disp(char.name)} starts extended ${describeExtended(after)}. Interval 1: ${note}.${tail}`);
}

async function cmdContinueRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const action = await ExtendedRollStore.resolve(cmd.positional[0]);
  if (!action) return sys(`No open extended action. Start one with [[extended-roll ...]] or name its id.`);
  if (action.status !== "open") return sys(`That extended action is already ${action.status}.`);
  const spec = overrideSpec(action.base, rollOverridesFromNamed(cmd));
  const exec = executeRoll(spec, n => resolveTraitFromRecord(char, n), { rng: ctx.rng });
  const { action: after, note } = applyInterval(action, exec, char.name);
  await ExtendedRollStore.save(after);
  if (after.status !== "open" && (await ExtendedRollStore.currentId()) === after.id) await ExtendedRollStore.clearCurrent();
  return sys(`${disp(char.name)} continues ${describeExtended(after)}. This interval: ${note}.`);
}

async function cmdRollStatus(cmd: ParsedCommand): Promise<string> {
  const action = await ExtendedRollStore.resolve(cmd.positional[0]);
  if (!action) return sys(`No extended action found. Start one with [[extended-roll ...]].`);
  const recent = action.log.slice(-3).map(l => `${disp(l.by)}: ${l.outcome === "botch" ? "botch" : `+${l.net}`}`).join(", ");
  return sys(`${describeExtended(action)}${recent ? ` | recent: ${recent}` : ""}.`);
}

async function cmdCancelRoll(cmd: ParsedCommand): Promise<string> {
  const action = await ExtendedRollStore.resolve(cmd.positional[0]);
  if (!action) return sys(`No extended action to cancel.`);
  await ExtendedRollStore.remove(action.id);
  if ((await ExtendedRollStore.currentId()) === action.id) await ExtendedRollStore.clearCurrent();
  return sys(`Cancelled extended action${action.label ? ` "${action.label}"` : ""} (was ${action.accumulated}/${action.target}).`);
}

async function cmdResources(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const views = await CharacterResources.all(char);
  if (!views.length) return sys(`${disp(char.name)} has no resources.`);
  const uses = await EffectUses.counts(char);
  const items = views.map(v => {
    const roles = (v.def.roles ?? []).filter(r => StringUtil.normalize(r) !== StringUtil.normalize(v.def.name));
    const named = Object.keys(v.def.effects ?? {}).map(n => {
      const used = uses[`${StringUtil.normalize(v.def.name)}:${StringUtil.normalize(n)}`] ?? 0;
      return `${n}${used > 0 ? ` (used ${used})` : ""}`;
    });
    const meta = [
      v.def.replaces?.length ? `replaces: ${v.def.replaces.join("/")}` : "",
      roles.length ? `roles: ${roles.join("/")}` : "",
      v.def.effect ? describeEffect(v.def.effect) : "",
      named.length ? `spend:${named.join("/")}` : "",
    ].filter(Boolean).join("; ");
    return `${v.def.name} ${v.current}/${v.max}${meta ? ` (${meta})` : ""}`;
  }).join("; ");
  return sys(`${disp(char.name)} resources - ${items}.`);
}

// One line of health state for OOC replies.
function healthLine(s: HealthSummary): string {
  const state = s.isDead ? " - DEAD" : s.isIncapacitated ? " - INCAPACITATED" : "";
  const overkill = s.overkill ? ` +${s.overkill} overkill` : "";
  return `${s.level} (penalty ${s.penalty}): ${s.bashing}B/${s.lethal}L/${s.aggravated}A, ${s.filled}/${s.capacity}${overkill}${state}`;
}

// spend <resource[::effect]> [target] [applications] - a plain deduction, or any
// configured effect run through the interpreter (heal, increase, pure cost,
// advisory ops...). The target argument is only consumed when an "increase" op
// has a group/bucket constraint to pick within.
async function cmdSpend(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const raw = cmd.positional[0]?.trim();
  if (!raw) return sys(`spend needs a resource, e.g. [[spend willpower]], [[spend blood:heal 2]] or [[spend blood:boost strength 2]].`);
  const [which, effectName] = raw.split(":").map(s => s.trim());
  const def = CharacterResources.resolveDef(char, which);
  if (!def) return sys(`${disp(char.name)} has no resource "${which}".`);
  const e = resourceEffect(def, effectName || undefined);
  if (effectName && !e) return sys(`${def.name} has no "${effectName}" effect.`);

  if (!e) {
    // No effect configured: plain deduction (with optional reason).
    const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
    const { spent } = await CharacterResources.spend(char, which, amount);
    if (spent === 0) return sys(`${disp(char.name)} has no ${def.name} to spend.`);
    const now = await CharacterResources.current(char, def);
    const reason = cmd.named["reason"] ? ` (${cmd.named["reason"]})` : "";
    return sys(`${disp(char.name)} spends ${spent} ${def.name}${reason}. Now ${now}/${def.max}.`);
  }

  // Does any increase op need the player to pick a trait within a constraint?
  const needsTarget = e.apply.some(o =>
    o.op.toLowerCase() === "increase" && "need" in CharacterBoosts.resolveIncreaseTarget(char, o.target, undefined));
  const targetArg = needsTarget ? cmd.positional[1]?.trim() : undefined;
  if (needsTarget && !targetArg) {
    return sys(`${def.name}${effectName ? `:${effectName}` : ""} needs a trait, e.g. [[spend ${raw} strength 2]].`);
  }
  const applications = Math.max(1, parseInt(cmd.positional[needsTarget ? 2 : 1] ?? "1", 10) || 1);

  const r = await applyEffectSpec(char, def, effectName ?? "", e, { targetArg, applications, rng: ctx.rng });
  if (r.insufficient) return sys(`${disp(char.name)} has no ${def.name} to spend - ${r.insufficient}.`);
  if (r.refuse) return sys(`${r.refuse}.`);
  const now = await CharacterResources.current(char, def);
  const rollOnly = r.extra !== undefined && e.apply.every(isRollOp) && e.apply.length > 0;
  const tail = rollOnly ? " (roll modifiers apply only inside a roll - use [[roll ... spend=...]])" : "";
  return sys(`${disp(char.name)} - ${r.notes.join("; ")}. ${def.name} now ${now}/${def.max}.${tail}`);
}

async function cmdResetUses(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  await EffectUses.resetAll(char);
  return sys(`${disp(char.name)}'s effect-use counters reset (new scene/turn).`);
}

async function cmdDamage(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const severity = (cmd.positional[0] ?? "").trim().toLowerCase();
  if (severity !== "bashing" && severity !== "lethal" && severity !== "aggravated") {
    return sys(`damage needs a severity (bashing, lethal or aggravated), e.g. [[damage lethal 2]].`);
  }
  const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
  const summary = await CharacterHealth.damage(char, severity, amount);
  return sys(`${disp(char.name)} takes ${amount} ${severity}. Health: ${healthLine(summary)}.`);
}

async function cmdHealth(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const summary = await CharacterHealth.summary(char);
  const boosts = await CharacterBoosts.all(char);
  const boostBits = Object.entries(boosts).map(([k, v]) => `${StringUtil.toTitleCase(k)} +${v}`).join(", ");
  return sys(`${disp(char.name)} - ${healthLine(summary)}${boostBits ? `. Boosts: ${boostBits}` : ""}.`);
}

async function cmdClearBoosts(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  await CharacterBoosts.clear(char);
  return sys(`${disp(char.name)}'s attribute boosts fade.`);
}

async function cmdConfigureResources(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]] first - the wizard configures the resources your templates grant.`);
  if (await WizardSession.get()) return sys(`A wizard is already running - answer it, or [[cancel-wizard]].`);
  const defs = CharacterResources.defsFor(char);
  const r = await RESOURCES_WIZARD.start({ charName: char.name, defs });
  if (r.done || !r.prompt || !r.state) return sys(`${r.summary ?? "Nothing to configure."}`);
  await WizardSession.set({ def: RESOURCES_WIZARD.id, state: r.state, prompt: r.prompt });
  return sys(`${RESOURCES_WIZARD.title} - your next plain messages answer the wizard. ${renderPromptText(r.prompt)}`);
}

async function cmdCancelWizard(): Promise<string> {
  if (!(await WizardSession.get())) return sys(`No wizard is running.`);
  await WizardSession.clear();
  return sys(`Wizard cancelled - nothing saved.`);
}

async function cmdGain(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const which = cmd.positional[0]?.trim();
  if (!which) return sys(`gain needs a resource, e.g. [[gain willpower]].`);
  const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
  const def = CharacterResources.resolveDef(char, which);
  if (!def) return sys(`${disp(char.name)} has no resource "${which}".`);
  const { value } = await CharacterResources.gain(char, which, amount);
  return sys(`${disp(char.name)} regains ${def.name}. Now ${value}/${def.max}.`);
}

// =============================================================================
// RESISTED / CONTESTED ROLLS - two pools, one adjudication
// -----------------------------------------------------------------------------
// The active character is side A; side B is either a named character
// (vs="Erik", who rolls their pool against their own traits) or an ad-hoc
// opposition (vs="the sturdy lock", or no vs= at all, rolling its pool with only
// literal numbers counting). oWoD classic tie rules live in compareRolls; an
// optional table= reads what the actor's winning margin MEANS.
// =============================================================================
function intOrUndef(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const v = parseInt(s, 10);
  return Number.isNaN(v) ? undefined : v;
}

// Roll one side of a contest. A named character rolls live (traits + boosts +
// wound penalty); an ad-hoc side rolls its pool with a zero resolver, so only
// literal numbers count. A char that no longer exists degrades to ad-hoc.
async function execContestSide(base: RollSpec, charName: string | undefined, rng: Rng | undefined, extra?: Partial<RollModifier>): Promise<RollExecution> {
  if (charName) {
    const c = await CharacterStore.load(charName);
    if (c) {
      const env = await characterRollEnv(c);
      const spec = await withAfflictionTags(c.name, base);
      // Owned passives (Trait Affinity et al.) apply to contest sides too.
      const passive = passiveRollExtra(c, poolTraitsOf(c, spec.pool), spec.tags);
      const merged: Partial<RollModifier> = { ...(extra ?? {}) };
      if (passive.extra.difficultyMod) merged.difficultyMod = (merged.difficultyMod ?? 0) + passive.extra.difficultyMod;
      if (passive.extra.diceMod) merged.diceMod = (merged.diceMod ?? 0) + passive.extra.diceMod;
      if (passive.extra.autoSuccesses) merged.autoSuccesses = (merged.autoSuccesses ?? 0) + passive.extra.autoSuccesses;
      if (passive.extra.nAgain !== undefined) merged.nAgain = Math.min(merged.nAgain ?? 10, passive.extra.nAgain);
      if (env.penalty !== 0) merged.diceMod = (merged.diceMod ?? 0) + env.penalty;
      return executeRoll(spec, env.resolver, { rng, extra: merged });
    }
  }
  return executeRoll(base, () => 0, { rng, extra });
}

// From the actor's side, what does a table read? The actor's winning margin (the
// successes that actually land) at "success"; an actor botch reads as botch; any
// non-win (resisted, out-contested, tie) reads as failure.
function contestTableInput(o: ContestOutcome): { outcome: RollOutcomeKind; successes: number } {
  if (o.aBotch) return { outcome: "botch", successes: 0 };
  if (o.winner !== "a") return { outcome: "failure", successes: 0 };
  return { outcome: "success", successes: o.margin };
}

async function cmdVersus(mode: ContestMode, cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const me = await CharacterStore.getCurrent();
  if (!me) return sys(`No active character. Select one with [[play name="..."]].`);
  const myPool = cmd.positional[0]?.trim();
  const theirPool = cmd.positional[1]?.trim();
  const verb = mode === "resisted" ? "resist" : "contest";
  if (!myPool || !theirPool) {
    return sys(`${verb} needs your pool and the opposition's, e.g. [[${verb} dexterity+stealth perception+alertness vs="Erik"]].`);
  }
  let oppArg = cmd.named["vs"]?.trim();
  if (oppArg?.startsWith("@")) {
    const ref = await resolveCharacterRef(oppArg);
    if (ref.error) return sys(`${ref.error}`);
    oppArg = ref.name!;
  }
  const oppChar = oppArg ? await CharacterStore.load(oppArg) : undefined;
  const oppName = oppChar ? oppChar.name : (oppArg || (mode === "resisted" ? "the-resistance" : "the-opposition"));

  const myTags = cmd.named["tags"] ? cmd.named["tags"].split(",").map(t => t.trim()).filter(Boolean) : undefined;
  const mySpec = await withAfflictionTags(me.name, makeRollSpec({ pool: myPool, difficulty: intOrUndef(cmd.named["difficulty"] ?? cmd.named["diff"]), tags: myTags }));
  const theirSpec = makeRollSpec({ pool: theirPool, difficulty: intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]) });

  // The actor may spend on their own roll (fuel / roll-op effects only), exactly
  // like [[roll spend=...]]; standalone effects refuse with the [[spend]] pointer.
  const spend = await applySpend(me, cmd, ctx, mySpec.tags, poolTraitsOf(me, mySpec.pool));
  if (spend.refuse) return sys(`${disp(me.name)} can't: ${spend.refuse}.`);

  const myExtra: Partial<RollModifier> = { ...(spend.extra ?? {}) };
  const myEnv = await characterRollEnv(me);
  if (myEnv.penalty !== 0) myExtra.diceMod = (myExtra.diceMod ?? 0) + myEnv.penalty;
  const myExec = executeRoll(mySpec, myEnv.resolver, { rng: ctx.rng, extra: myExtra });
  const theirExec = await execContestSide(theirSpec, oppChar?.name, ctx.rng);

  const outcome = compareRolls(mode, myExec, theirExec);
  const t = contestTableInput(outcome);
  const notes = [outcome.note, await tableNote(cmd.named["table"], t.outcome, t.successes), spend.note].filter(Boolean).join("; ");
  return sys(`${mode} - ${disp(me.name)}: ${formatExecution(myExec)} vs ${disp(oppName)}: ${formatExecution(theirExec)} - ${notes}`);
}

const cmdResist: CommandHandler = (cmd, ctx) => cmdVersus("resisted", cmd, ctx);
const cmdContest: CommandHandler = (cmd, ctx) => cmdVersus("contested", cmd, ctx);

// =============================================================================
// EXTENDED CONTESTS - both sides accumulate across rounds; first to the goal wins
// =============================================================================
async function cmdExtendedContest(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const me = await CharacterStore.getCurrent();
  if (!me) return sys(`No active character. Select one with [[play name="..."]].`);
  const myPool = cmd.positional[0]?.trim();
  const theirPool = cmd.positional[1]?.trim();
  if (!myPool || !theirPool) {
    return sys(`extended-contest needs both pools, e.g. [[extended-contest wits+melee wits+melee vs="Erik" target=5 rounds=5]].`);
  }
  let oppArg = cmd.named["vs"]?.trim();
  if (oppArg?.startsWith("@")) {
    const ref = await resolveCharacterRef(oppArg);
    if (ref.error) return sys(`${ref.error}`);
    oppArg = ref.name!;
  }
  const oppChar = oppArg ? await CharacterStore.load(oppArg) : undefined;
  const oppName = oppChar ? oppChar.name : (oppArg || "the-opposition");

  const target = intOrUndef(cmd.named["target"] ?? cmd.named["requires"]) ?? 0;
  if (target < 1) return sys(`extended-contest needs target=<successes> (the goal both race to).`);
  const maxRounds = intOrUndef(cmd.named["rounds"] ?? cmd.named["intervals"]) ?? 0;
  if (maxRounds < 1) return sys(`extended-contest needs rounds=<max> (at least 1).`);

  const aSpec = makeRollSpec({ pool: myPool, difficulty: intOrUndef(cmd.named["difficulty"] ?? cmd.named["diff"]), requires: 1 });
  const bSpec = makeRollSpec({ pool: theirPool, difficulty: intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]), requires: 1 });
  const contest: ExtendedContest = {
    id: api.v1.uuid(),
    label: cmd.named["label"] ?? "",
    a: { name: me.name, base: aSpec, accumulated: 0, char: me.name },
    b: { name: oppName, base: bSpec, accumulated: 0, char: oppChar?.name },
    target, maxRounds,
    interval: cmd.named["interval"] ?? "",
    onBotch: parseBotchPolicy(cmd.named["on-botch"]),
    rounds: 0, status: "open", log: [],
  };
  const aExec = await execContestSide(aSpec, me.name, ctx.rng);
  const bExec = await execContestSide(bSpec, oppChar?.name, ctx.rng);
  const { contest: after, note } = applyContestRound(contest, aExec, bExec);
  await ExtendedContestStore.save(after);
  if (after.status === "open") await ExtendedContestStore.setCurrent(after.id);
  const tail = after.status === "open" ? ` Continue with [[continue-contest]] (id ${after.id}).` : "";
  return sys(`${disp(me.name)} opens ${describeContest(after)}. Round 1: ${note}.${tail}`);
}

async function cmdContinueContest(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return sys(`No open contest. Start one with [[extended-contest ...]] or name its id.`);
  if (contest.status !== "open") {
    const who = contest.status === "draw" ? "a draw" : `won by ${contest.status === "a" ? contest.a.name : contest.b.name}`;
    return sys(`That contest is already ${who}.`);
  }
  const aSpec = overrideSpec(contest.a.base, rollOverridesFromNamed(cmd));
  const vDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
  const bSpec = vDiff !== undefined ? overrideSpec(contest.b.base, { difficulty: vDiff }) : contest.b.base;
  const aExec = await execContestSide(aSpec, contest.a.char, ctx.rng);
  const bExec = await execContestSide(bSpec, contest.b.char, ctx.rng);
  const { contest: after, note } = applyContestRound(contest, aExec, bExec);
  await ExtendedContestStore.save(after);
  if (after.status !== "open" && (await ExtendedContestStore.currentId()) === after.id) await ExtendedContestStore.clearCurrent();
  return sys(`${describeContest(after)}. This round: ${note}.`);
}

async function cmdContestStatus(cmd: ParsedCommand): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return sys(`No extended contest found. Start one with [[extended-contest ...]].`);
  const recent = contest.log.slice(-3).map(l => `r${l.round}: ${disp(contest.a.name)} +${l.aNet}/${disp(contest.b.name)} +${l.bNet}`).join(", ");
  return sys(`${describeContest(contest)}${recent ? ` | recent: ${recent}` : ""}.`);
}

async function cmdCancelContest(cmd: ParsedCommand): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return sys(`No extended contest to cancel.`);
  await ExtendedContestStore.remove(contest.id);
  if ((await ExtendedContestStore.currentId()) === contest.id) await ExtendedContestStore.clearCurrent();
  const progress = `${disp(contest.a.name)} ${contest.a.accumulated}/${contest.target} vs ${disp(contest.b.name)} ${contest.b.accumulated}/${contest.target}`;
  return sys(`Cancelled contest${contest.label ? ` "${contest.label}"` : ""} (was ${progress}).`);
}

// List the success tables, or lay one out in full. A table interprets a number
// of successes; attach table=<name> to a roll/resist/contest to read it.
async function cmdTables(cmd: ParsedCommand): Promise<string> {
  const arg = cmd.positional[0]?.trim();
  if (arg) {
    const ref = await resolveTableRef(arg);
    if (ref.error) return sys(`${ref.error}`);
    const t = SuccessTableRegistry.get(ref.key!);
    if (t) return sys(`${describeTable(t)}.`);
    // Not a table - maybe a subcategory: list its contents.
    const subs = await TableLibrary.subcategories();
    if (subs.includes(ref.key!)) {
      const items = SuccessTableRegistry.all().filter(x => x.name.startsWith(`${ref.key}:`))
        .map(x => x.name.slice(ref.key!.length + 1));
      return sys(`Tables in "${ref.key}": ${items.length ? items.join(", ") : "(none yet)"}. Address them as ${ref.key}::<name>.`);
    }
    return sys(`No success table "${ref.key}". See [[tables]].`);
  }
  const all = SuccessTableRegistry.all();
  const label = (t: SuccessTable): string => t.description ? `${t.name} (${t.description})` : t.name;
  const groups = [`general: ${all.filter(t => !t.name.includes(":")).map(label).join("; ")}`];
  for (const sub of await TableLibrary.subcategories()) {
    const items = all.filter(t => t.name.startsWith(`${sub}:`)).map(t => t.name.slice(sub.length + 1));
    groups.push(`${sub}: ${items.length ? items.join(", ") : "(empty)"}`);
  }
  const aliases = await TableAliases.all();
  const aliasBit = Object.keys(aliases).length
    ? ` Aliases: ${Object.entries(aliases).map(([a, k]) => `@${a} -> ${k}`).join(", ")}.` : "";
  return sys(`Success tables - ${groups.join(" | ")}.${aliasBit} [[tables <name|sub|sub::name>]] for detail; add table=<key|@alias> to a roll/resist/contest.`);
}

// Author a success table from the command line (or the win-table window): the
// addressed category's GENERAL card - the same card the player can hand-edit.
// name may be "[sub::]name"; a missing subcategory prompts a modal. Labels
// ride the backtick-literal channel, so their case survives.
async function cmdDefineTable(cmd: ParsedCommand): Promise<string> {
  const rawName = cmd.named["name"]?.trim();
  if (!rawName) return sys(`define-table needs name="..". See [[help define-table]].`);
  const segs = StringUtil.normalize(rawName).split(":").filter(Boolean);
  if (segs.length === 0) return sys(`define-table needs name="..". See [[help define-table]].`);
  if (segs.length > 2) return sys(`Table paths go one level deep for now (name="sub::name").`);
  const sub = segs.length === 2 ? segs[0] : undefined;
  const name = segs[segs.length - 1];
  const rows = parseTableRows(cmd.named["rows"]);
  if ("error" in rows) return sys(`${rows.error}`);
  // Only supplied fields land in the def; a supplied-but-unreadable number is
  // refused rather than silently dropped.
  const num = (key: string): number | undefined | { error: string } => {
    const raw = cmd.named[key];
    if (raw === undefined) return undefined;
    const n = intOrUndef(raw);
    return n === undefined ? { error: `${key}= must be a whole number (got "${raw}").` } : n;
  };
  const t: SuccessTable = { name: StringUtil.normalize(name) };
  if (rows.length) t.rows = rows;
  const vps = num("value-per-success");
  if (typeof vps === "object") return sys(`${vps.error}`);
  if (vps !== undefined) t.valuePerSuccess = vps;
  const cap = num("cap");
  if (typeof cap === "object") return sys(`${cap.error}`);
  if (cap !== undefined) t.cap = cap;
  const per = num("overflow-per");
  const value = num("overflow-value");
  if (typeof per === "object") return sys(`${per.error}`);
  if (typeof value === "object") return sys(`${value.error}`);
  const overflowLabel = cmd.named["overflow-label"]?.trim();
  if ((value !== undefined || overflowLabel) && per === undefined) {
    return sys(`overflow needs overflow-per=N (the batch size beyond the last row).`);
  }
  if (per !== undefined) {
    t.overflow = { per };
    if (value !== undefined) t.overflow.value = value;
    if (overflowLabel) t.overflow.label = overflowLabel;
  }
  for (const key of ["botch", "failure", "description"] as const) {
    const v = cmd.named[key]?.trim();
    if (v) t[key] = v;
  }
  if (!t.rows && t.valuePerSuccess === undefined && !t.botch && !t.failure) {
    return sys(`A table needs something to read - give it rows=, value-per-success=, botch= or failure=.`);
  }
  const key = sub ? `${sub}:${t.name}` : t.name;
  const shadows = !sub && DEFAULT_SUCCESS_TABLES.some(d => StringUtil.normalize(d.name) === t.name);
  if (sub && !(await LorebookManager.categoryIdByName(`${TABLES_CATEGORY}:${sub}`))) {
    // The subcategory doesn't exist: confirm its creation via a modal; the
    // pending def rides the closure and lands only on confirmation.
    void confirmModal(`Create table category "${sub}"?`,
      `Table category **${sub}** doesn't exist yet (lorebook category \`${TABLES_CATEGORY}:${sub}\`). Create it and define **${t.name}** inside it?`,
      [{
        label: "Create & define",
        run: async () => {
          const r = await TableLibrary.put(t, sub);
          return `Created "${sub}" and defined ${describeTable({ ...t, name: key })}.${r.shadowed ? " (currently shadowed by another card)" : ""}`;
        },
      }]);
    return sys(`Table category "${sub}" doesn't exist yet - answer the modal to create it and define ${t.name}.`);
  }
  const r = await TableLibrary.put(t, sub);
  const note = shadows ? ` (shadows the built-in - [[forget-table ${t.name}]] restores it)`
    : r.shadowed ? ` (note: another card in the category shadows this name right now)` : "";
  return sys(`Defined table ${describeTable({ ...t, name: key })}.${note} Attach with table=${sub ? `${sub}::${t.name}` : t.name}.`);
}

// Create a table subcategory outright (the modal-less path).
async function cmdDefineTableCategory(cmd: ParsedCommand): Promise<string> {
  const raw = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!raw) return sys(`define-table-category needs name="..".`);
  const sub = StringUtil.normalize(raw);
  if (sub.includes(":") || sub.startsWith("@")) {
    return sys(`A table category is a single name (no "::" and no "@") - subcategories go one level deep for now.`);
  }
  const existed = await LorebookManager.categoryIdByName(`${TABLES_CATEGORY}:${sub}`) !== undefined;
  await ensurePath(`config:success-tables:${sub}`, TABLE_GENERAL_HEADER);
  return existed
    ? sys(`Table category "${sub}" already exists.`)
    : sys(`Created table category "${sub}" (lorebook category "${TABLES_CATEGORY}:${sub}", card "general"). Define into it with [[define-table name="${sub}::<name>" ...]].`);
}

async function cmdForgetTable(cmd: ParsedCommand): Promise<string> {
  const raw = cmd.positional[0]?.trim();
  if (!raw) return sys(`forget-table needs a name.`);
  const ref = await resolveTableRef(raw);
  if (ref.error) return sys(`${ref.error}`);
  const key = ref.key!;
  const { removed, still } = await TableLibrary.remove(key);
  if (!removed) {
    if (!SuccessTableRegistry.get(key)) return sys(`No table "${key}".`);
    return DEFAULT_SUCCESS_TABLES.some(d => StringUtil.normalize(d.name) === key)
      ? sys(`"${key}" is a built-in table - it can be shadowed with [[define-table]] but not deleted.`)
      : sys(`"${key}" isn't in its category's general card - it lives in another card; edit that card in creator mode.`);
  }
  const note = still === "built-in" ? ` The built-in "${key}" resurfaces.`
    : still === "another-card" ? ` Another card in the category still defines "${key}".` : "";
  return sys(`Forgot table "${key}".${note}`);
}

// --- TABLE ALIASES ------------------------------------------------------------
async function cmdTableAlias(cmd: ParsedCommand): Promise<string> {
  const token = cmd.positional[0]?.trim();
  if (!token) {
    const all = await TableAliases.all();
    const items = Object.entries(all).map(([a, k]) => `@${a} -> ${k}`);
    return items.length
      ? sys(`Table aliases: ${items.join(", ")}. [[table-alias @a "<[sub::]name>"]] defines one.`)
      : sys(`No table aliases yet. [[table-alias @a "<[sub::]name>"]] defines one.`);
  }
  if (!token.startsWith("@")) return sys(`Table aliases start with "@", e.g. [[table-alias @qk "combat::quick-kill"]].`);
  const target = cmd.positional[1]?.trim();
  if (!target) return sys(`table-alias needs a target table, e.g. [[table-alias ${token} "combat::quick-kill"]].`);
  const ref = await resolveTableRef(target);
  if (ref.error) return sys(`${ref.error}`);
  await TableAliases.set(token, ref.key!);
  const advisory = SuccessTableRegistry.get(ref.key!) ? "" : ` (no table "${ref.key}" exists yet - the alias waits for it)`;
  return sys(`${token} now means table ${ref.key}.${advisory}`);
}

async function cmdForgetTableAlias(cmd: ParsedCommand): Promise<string> {
  const token = cmd.positional[0]?.trim();
  if (!token || !token.startsWith("@")) return sys(`forget-table-alias needs an @alias.`);
  const removed = await TableAliases.remove(token);
  return removed
    ? sys(`Forgot table alias ${token}.`)
    : sys(`No table alias ${token}. [[table-alias]] lists them.`);
}

// =============================================================================
// LOREBOOK MODALS & RECONCILIATION
// -----------------------------------------------------------------------------
// Game-flow confirmations rendered as api.v1.ui MODALS (blocking, centered) -
// distinct from the spec-driven form WINDOWS in src/window.ts. Each action
// button runs its effect and shows the outcome in-modal; Cancel/Close dismiss.
// Reconciliation (the tracked-card drift check, services.ts) runs at init and
// on the creator-mode sync; identical recreations were already adopted
// silently there - only conflicts and deletions reach a modal, and each
// distinct drift prompts at most once per session (tempStorage guard).
// =============================================================================
const _reconGuard = new ScopedStorage();

async function confirmModal(title: string, body: string, actions: { label: string; run: () => Promise<string> }[]): Promise<void> {
  const part = api.v1.ui.part;
  const handle = await api.v1.ui.modal.open({ title, size: "small", content: [] });
  const render = async (result?: string): Promise<void> => {
    const content: UIPart[] = [part.text({ text: body, markdown: true })];
    if (result === undefined) {
      content.push(part.row({ content: actions.map(a => part.button({ text: a.label, callback: async () => render(await a.run()) })) }));
      content.push(part.row({ content: [part.button({ text: "Cancel", callback: () => handle.close() })] }));
    } else {
      content.push(part.box({ content: [part.text({ text: result })] }));
      content.push(part.row({ content: [part.button({ text: "Close", callback: () => handle.close() })] }));
    }
    await handle.update({ content });
  };
  await render();
}

function openConflictModal(f: ReconcileFinding): void {
  const actions: { label: string; run: () => Promise<string> }[] = [{
    label: "Keep the new card",
    run: async () => {
      await TrackedLorebook.adopt(f.category, f.entry, f.foundId!, f.foundText!);
      await reloadAllConfigStores();
      return "Kept your new card - it is the tracked one now.";
    },
  }];
  const combined = f.backupText !== undefined && f.foundText !== undefined
    ? combineConfigTexts(f.backupText, f.foundText) : undefined;
  if (combined !== undefined) {
    actions.push({
      label: "Combine both",
      run: async () => {
        await api.v1.lorebook.updateEntry(f.foundId!, { text: combined });
        await TrackedLorebook.adopt(f.category, f.entry, f.foundId!, combined);
        await reloadAllConfigStores();
        return "Combined - your newer definitions won any collisions.";
      },
    });
  }
  if (f.backupText !== undefined) {
    actions.push({
      label: "Restore the old card",
      run: async () => {
        await api.v1.lorebook.updateEntry(f.foundId!, { text: f.backupText! });
        await TrackedLorebook.adopt(f.category, f.entry, f.foundId!, f.backupText!);
        await reloadAllConfigStores();
        return "Restored the card's last tracked text.";
      },
    });
  }
  void confirmModal(`Recreated card: ${f.entry}`,
    `The card **${f.entry}** in **${f.category}** was deleted and recreated with different content. What should happen?`,
    actions);
}

function openMissingModal(f: ReconcileFinding): void {
  const actions: { label: string; run: () => Promise<string> }[] = [];
  if (f.backupText !== undefined) {
    actions.push({
      label: "Restore from backup",
      run: async () => {
        await writeTrackedEntry(f.category, f.entry, f.backupText!);
        await reloadAllConfigStores();
        return "Restored the card from its backup.";
      },
    });
  }
  actions.push({
    label: "Forget it",
    run: async () => {
      await TrackedLorebook.forget(f.category, f.entry);
      await reloadAllConfigStores();
      return "Forgot the card - the engine no longer tracks or restores it.";
    },
  });
  void confirmModal(`Deleted card: ${f.entry}`,
    `The tracked card **${f.entry}** in **${f.category}** is gone from the lorebook. Restore it from the engine's backup, or let it go?`,
    actions);
}

// Detect tracked-card drift and surface it. Returns one-line notes for the
// caller's log/OOC reply; modals open fire-and-forget.
export async function reconcileLorebook(): Promise<string[]> {
  const notes: string[] = [];
  for (const f of await TrackedLorebook.reconcile()) {
    const card = `"${f.entry}" (${f.category})`;
    if (f.kind === "adopted") { notes.push(`re-adopted recreated card ${card}`); continue; }
    const sig = `recon:${f.category}/${f.entry}:${f.kind}:${structuralHash(f.foundText ?? f.backupText ?? "")}`;
    if (await _reconGuard.tempGet(sig)) continue;
    await _reconGuard.tempSet(sig, true);
    if (f.kind === "conflict") { openConflictModal(f); notes.push(`card ${card} was recreated with different content - a modal is waiting`); }
    else { openMissingModal(f); notes.push(`tracked card ${card} is gone - a modal is waiting`); }
  }
  return notes;
}

// =============================================================================
// CONSTRAINT GROUP COMMANDS - define/list/inspect the allow-deny rules, and
// check the current character against them. [[win-constraint]] (src/window.ts)
// is a UI over [[define-constraint]] - it composes and routes the same command.
// =============================================================================

// A character's owned traits, normalized, for checkConstraints. Merit vs flaw is
// resolved via the registry; an unknown merit/flaw is treated as a merit (only
// membership matters for the check, so the fallback is harmless).
function ownedTraitsOf(char: PlayableCharacter): OwnedTraits {
  const merits: string[] = [];
  const flaws: string[] = [];
  for (const name of Object.keys(char.meritsFlaws)) {
    // Parameterized instances ("trait-affinity:melee") resolve to their base
    // def for the merit/flaw split; the full instance key stays the trait.
    const def = resolveMeritInstance(name, n => MeritFlawRegistry.get(n))?.def ?? MeritFlawRegistry.get(name);
    (def && def.kind === "flaw" ? flaws : merits).push(StringUtil.normalize(name));
  }
  return {
    backgrounds: Object.keys(char.backgrounds).map(n => StringUtil.normalize(n)),
    merits,
    flaws,
    templates: (char.templates ?? []).map(t => StringUtil.normalize(t)),
  };
}

async function cmdDefineConstraint(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) return sys(`define-constraint needs name="...", e.g. [[define-constraint name="clan-only-backgrounds" relation=restricted domain=background members="cappadocian-lore" scope="cappadocian"]].`);
  const members = (cmd.named["members"] ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const scope = (cmd.named["scope"] ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const maxRaw = cmd.named["max"];
  const group = makeConstraintGroup({
    name,
    relation: cmd.named["relation"] as ConstraintRelation | undefined,
    domain: cmd.named["domain"] as ConstraintDomain | undefined,
    members,
    scope,
    max: maxRaw !== undefined ? parseInt(maxRaw, 10) : undefined,
    note: cmd.named["note"],
  });
  await ConstraintRegistry.put(group);
  return sys(`Defined constraint ${describeConstraint(group)}.`);
}

async function cmdConstraints(): Promise<string> {
  const all = ConstraintRegistry.all();
  if (!all.length) return sys(`No constraint groups defined. Add one with [[define-constraint ...]] or [[win-constraint]].`);
  const items = all.map(g => `${g.name} (${g.relation}/${g.domain}, ${g.members.length} member${g.members.length === 1 ? "" : "s"})`).join("; ");
  return sys(`Constraint groups: ${items}. [[constraint <name>]] for detail.`);
}

async function cmdConstraint(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`constraint needs a name, e.g. [[constraint clan-only-backgrounds]]. [[constraints]] lists them.`);
  const g = ConstraintRegistry.get(name);
  if (!g) return sys(`No constraint group "${StringUtil.normalize(name)}". See [[constraints]].`);
  return sys(`${describeConstraint(g)}.`);
}

async function cmdForgetConstraint(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`forget-constraint needs a name, e.g. [[forget-constraint clan-only-backgrounds]].`);
  const key = StringUtil.normalize(name);
  return (await ConstraintRegistry.remove(key))
    ? sys(`Forgot constraint group "${key}".`)
    : sys(`No constraint group "${key}".`);
}

async function cmdCheckConstraints(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const groups = ConstraintRegistry.all();
  const violations = groups.length ? checkConstraints(groups, ownedTraitsOf(char)) : [];
  const meritIssues = meritInstanceFindings(char);
  const total = violations.length + meritIssues.length;
  if (!total) {
    return groups.length
      ? sys(`${disp(char.name)} satisfies all ${groups.length} constraint group${groups.length === 1 ? "" : "s"}.`)
      : sys(`No constraint groups defined and ${disp(char.name)}'s merits/flaws check out - nothing to flag.`);
  }
  const lines = [...violations.map(v => v.detail), ...meritIssues].join("; ");
  return sys(`${disp(char.name)} - ${total} constraint issue${total === 1 ? "" : "s"} (ST-enforced): ${lines}.`);
}

// Advisory merit-instance findings: unknown/malformed keys and atMostOneAt
// violations ("one favoured trait" caps). Reported, never enforced - the
// creation engine will enforce.
function meritInstanceFindings(char: PlayableCharacter): string[] {
  const findings: string[] = [];
  const atTop = new Map<string, string[]>();   // def name -> instance keys at the capped value
  const known = new Set<string>();
  for (const inst of ownedMeritInstances(char)) {
    known.add(inst.key);
    const cap = inst.def.atMostOneAt;
    if (cap !== undefined && inst.points >= cap) {
      const list = atTop.get(inst.def.name) ?? [];
      list.push(inst.param ?? inst.key);
      atTop.set(inst.def.name, list);
    }
  }
  for (const key of Object.keys(char.meritsFlaws)) {
    if (!known.has(StringUtil.normalize(key))) findings.push(`unknown merit/flaw "${StringUtil.normalize(key)}"`);
  }
  for (const [defName, traits] of atTop) {
    if (traits.length > 1) findings.push(`${StringUtil.normalize(defName)} allows only ONE instance at the top value (have: ${traits.join(", ")})`);
  }
  return findings;
}

// =============================================================================
// OWNED POWERS - merits/flaws (incl. parameterized instances) + specialties
// -----------------------------------------------------------------------------
// take-merit/drop-merit edit the record's meritsFlaws bucket (write-through:
// lorebook first). Parameterized defs are taken as name::<param> instances;
// their passive ops fold into every roll automatically. Specialties live on
// the record (verbatim labels); the specialty= roll argument applies one.
// =============================================================================
function unmetRequirements(char: PlayableCharacter, req?: MeritFlawRequirements): string[] {
  if (!req) return [];
  const missing: string[] = [];
  if (req.templates?.length) {
    const mine = char.templates.map(t => StringUtil.normalize(t));
    if (!req.templates.some(t => mine.includes(StringUtil.normalize(t)))) missing.push(`template:${req.templates.join("|")}`);
  }
  const tags = char.tags.map(t => StringUtil.normalize(t));
  for (const t of req.tags ?? []) if (!tags.includes(StringUtil.normalize(t))) missing.push(`tag:${StringUtil.normalize(t)}`);
  for (const m of req.meritsFlaws ?? []) if (!(StringUtil.normalize(m) in char.meritsFlaws)) missing.push(`merit-flaw:${StringUtil.normalize(m)}`);
  return missing;
}

async function cmdTakeMerit(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const raw = cmd.positional[0]?.trim();
  if (!raw) return sys(`take-merit needs a name, e.g. [[take-merit trait-affinity::melee 2]].`);
  const key = StringUtil.normalize(raw);
  const hit = resolveMeritInstance(key, n => MeritFlawRegistry.get(n));
  if (!hit) {
    const bare = MeritFlawRegistry.get(key);
    return bare?.param
      ? sys(`"${key}" is parameterized - name its ${bare.param}: [[take-merit ${key}::<${bare.param}>]].`)
      : sys(`Unknown merit/flaw "${key}". Custom definitions go in the srd:merits-flaws lorebook category.`);
  }
  const allowed = Array.isArray(hit.def.points) ? hit.def.points : [hit.def.points];
  const points = intOrUndef(cmd.positional[1] ?? "") ?? allowed[0];
  if (!allowed.includes(points)) {
    return sys(`${hit.def.name} must be taken at one of [${allowed.join(", ")}] points (got ${points}).`);
  }
  const missing = unmetRequirements(char, hit.def.requires);
  if (missing.length && cmd.named["waive"] !== "true") {
    return sys(`${hit.def.name} prerequisites not met: ${missing.join(", ")}. Add waive=true to override.`);
  }
  char.meritsFlaws[key] = points;
  await CharacterStore.save(char);
  const passiveBits = passiveOpsOf(hit.def, hit.param, points)
    .map(o => `${o.op}${o.trait ? ` [${o.trait}]` : o.target ? ` [${o.target}]` : ""} ${(o.amount ?? 1) > 0 ? "+" : ""}${o.amount ?? 1}`);
  return sys(`${disp(char.name)} takes ${key} (${points} pt${points === 1 ? "" : "s"})${passiveBits.length ? ` - passive: ${passiveBits.join(", ")}` : ""}.`);
}

async function cmdDropMerit(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const key = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!key) return sys(`drop-merit needs a name.`);
  if (!(key in char.meritsFlaws)) return sys(`${disp(char.name)} does not have "${key}". [[merits]] lists them.`);
  delete char.meritsFlaws[key];
  await CharacterStore.save(char);
  return sys(`${disp(char.name)} drops ${key}.`);
}

async function cmdMerits(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const insts = ownedMeritInstances(char);
  if (!insts.length && !Object.keys(char.meritsFlaws).length) {
    return sys(`${disp(char.name)} has no merits or flaws. [[take-merit <name[::param]> [points]]] takes one.`);
  }
  const items = insts.map(i => `${i.key} (${i.points}${i.def.kind === "flaw" ? ", flaw" : ""})`);
  const enh = enhancementsFor(char);
  const enhBits = Object.entries(enh).map(([t, n]) => {
    const base = resolveTraitFromRecord(char, t);
    return `${t}: base ${base} -> effective ${base + n} (ceiling +${n}, advisory)`;
  });
  const issues = meritInstanceFindings(char);
  const parts = [`Merits/Flaws: ${items.join("; ")}`];
  if (enhBits.length) parts.push(`Enhancements - ${enhBits.join("; ")}`);
  if (issues.length) parts.push(`Issues (ST-enforced): ${issues.join("; ")}`);
  return sys(`${parts.join(". ")}.`);
}

async function cmdSpecialty(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const trait = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  const label = cmd.positional[1]?.trim();   // backtick literal keeps its case
  if (!trait || !label) return sys(`specialty needs a trait and a label, e.g. [[specialty melee \`Swords\`]].`);
  char.specialties ??= {};
  const list = (char.specialties[trait] ??= []);
  if (list.some(l => StringUtil.normalize(l) === StringUtil.normalize(label))) {
    return sys(`${disp(char.name)} already has specialty ${label} (${trait}).`);
  }
  list.push(label);
  await CharacterStore.save(char);
  return sys(`${disp(char.name)} gains specialty ${label} (${trait}). Apply it with specialty=${trait} on a roll.`);
}

async function cmdForgetSpecialty(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const trait = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  const label = cmd.positional[1]?.trim();
  const list = char.specialties?.[trait];
  if (!trait || !list?.length) return sys(`No specialties under "${trait}". [[specialties]] lists them.`);
  let removed: string;
  if (label) {
    const i = list.findIndex(l => StringUtil.normalize(l) === StringUtil.normalize(label));
    if (i < 0) return sys(`No specialty "${label}" under ${trait}.`);
    removed = list.splice(i, 1)[0];
  } else if (list.length === 1) {
    removed = list.splice(0, 1)[0];
  } else {
    return sys(`${trait} has several specialties (${list.join(", ")}) - name the one to forget.`);
  }
  if (!list.length) delete char.specialties![trait];
  await CharacterStore.save(char);
  return sys(`${disp(char.name)} forgets specialty ${removed} (${trait}).`);
}

async function cmdSpecialties(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  const entries = Object.entries(char.specialties ?? {}).filter(([, l]) => l.length);
  if (!entries.length) return sys(`${disp(char.name)} has no specialties. [[specialty <trait> \`<Label>\`]] adds one.`);
  const items = entries.map(([t, labels]) => `${t}: ${labels.join(", ")}`);
  return sys(`Specialties - ${items.join("; ")}. One applies per roll via specialty=.`);
}

// --- AFFLICTIONS --------------------------------------------------------------
// Parameterized states on characters (and NPCs - no sheet required). afflict
// validates the def's binding slots (values may be @aliases), mirrors onto the
// bound target when the def says so, advance walks the chain (concentrating-on
// -> feral-whispers) carrying bindings forward, and lift removes both sides
// (optionally paying a spend - the Willpower shrug-off).

// Resolve one binding value: @aliases through the alias registry, everything
// else normalized as-is (an NPC name needs no record).
async function resolveBindingValue(raw: string): Promise<{ value?: string; error?: string }> {
  if (raw.startsWith("@")) {
    const ref = await resolveCharacterRef(raw);
    return ref.error ? { error: ref.error } : { value: ref.name };
  }
  return { value: StringUtil.normalize(raw) };
}

// Who an affliction command operates on: on=<name|@alias> if given (record NOT
// required - NPCs carry afflictions too), else the current character.
async function afflictionSubject(cmd: ParsedCommand): Promise<{ name?: string; error?: string }> {
  const on = cmd.named["on"]?.trim();
  if (on) {
    const ref = await resolveBindingValue(on);
    return ref.error ? { error: ref.error } : { name: ref.value };
  }
  const cur = await CharacterStore.getCurrent();
  if (!cur) return { error: `No active character. Select one with [[play name="..."]] or name a subject with on="...".` };
  return { name: StringUtil.normalize(cur.name) };
}

function afflictionLine(c: ActiveAffliction): string {
  const def = AfflictionRegistry.get(c.def);
  const bits = [c.def];
  const bound = Object.entries(c.bindings).map(([k, v]) => `${k}: ${disp(v)}`).join(", ");
  if (bound) bits.push(`(${bound})`);
  const dur = describeDuration(def?.duration);
  if (dur && dur !== "instant") bits.push(`- ${dur} (ST-enforced)`);
  if (def?.then) bits.push(`- then ${def.then}`);
  if (c.note) bits.push(c.note);
  return bits.join(" ");
}

// Apply one definition to a subject: validate + resolve bindings, write the
// instance, then fire the def's mirror onto the bound target. Shared by
// afflict and advance. Returns the reply fragments or an error.
async function applyAffliction(subject: string, def: AfflictionDef, rawBindings: Record<string, string>, note?: string): Promise<{ lines?: string[]; error?: string }> {
  const bindings: Record<string, string> = {};
  for (const slot of def.bindings ?? []) {
    const raw = rawBindings[slot];
    if (!raw) return { error: `${def.name} needs ${slot}=<name|@alias>.` };
    const r = await resolveBindingValue(raw);
    if (r.error) return { error: r.error };
    bindings[slot] = r.value!;
  }
  const inst: ActiveAffliction = { def: def.name, bindings };
  if (note) inst.note = note;
  await CharacterAfflictions.afflict(subject, inst);
  const lines = [`${disp(subject)} is now ${afflictionLine(inst)}`];
  if (def.mirror && bindings["target"]) {
    const mirrorDef = AfflictionRegistry.get(def.mirror);
    if (!mirrorDef) lines.push(`mirror "${def.mirror}" is not defined - skipped`);
    else {
      const mirrorInst: ActiveAffliction = { def: mirrorDef.name, bindings: { target: subject }, note: "(mirror)" };
      await CharacterAfflictions.afflict(bindings["target"], mirrorInst);
      lines.push(`${disp(bindings["target"])} is now ${afflictionLine(mirrorInst)}`);
    }
  }
  return { lines };
}

// Remove one affliction from a subject AND its mirror from the bound target.
async function removeAffliction(subject: string, defName: string): Promise<{ removed?: ActiveAffliction; alsoLifted?: string; error?: string }> {
  const removed = await CharacterAfflictions.lift(subject, defName);
  if (!removed) return { error: `${disp(subject)} does not have "${StringUtil.normalize(defName)}". [[afflictions${subject ? ` ${subject}` : ""}]] lists them.` };
  const def = AfflictionRegistry.get(removed.def);
  if (def?.mirror && removed.bindings["target"]) {
    const gone = await CharacterAfflictions.lift(removed.bindings["target"], def.mirror);
    if (gone) return { removed, alsoLifted: `${def.mirror} lifted from ${disp(removed.bindings["target"])}` };
  }
  return { removed };
}

async function cmdDefineAffliction(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) return sys(`define-affliction needs name="...", e.g. [[define-affliction name="dazed" tags="off-hand" duration="1 scene"]].`);
  const durationRaw = cmd.named["duration"];
  const duration = parseAfflictionDuration(durationRaw);
  if (durationRaw && !duration) return sys(`Can't read duration "${durationRaw}" - use "1 turn", "2 scenes", "until <x>" or "instant".`);
  const def = makeAfflictionDef({
    name,
    description: cmd.named["description"],
    bindings: (cmd.named["bindings"] ?? "").split(",").map(s => s.trim()).filter(Boolean),
    duration,
    then: cmd.named["then"],
    mirror: cmd.named["mirror"],
    tags: (cmd.named["tags"] ?? "").split(",").map(s => s.trim()).filter(Boolean),
    note: cmd.named["note"],
  });
  await AfflictionRegistry.put(def);
  return sys(`Defined affliction ${describeAfflictionDef(def)}.`);
}

async function cmdAfflictionInfo(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) {
    const items = AfflictionRegistry.all().map(d => d.name).join(", ");
    return sys(`Defined afflictions: ${items}. [[affliction <name>]] for detail; [[afflictions]] shows who has what.`);
  }
  const def = AfflictionRegistry.get(name);
  if (!def) return sys(`No affliction "${StringUtil.normalize(name)}". [[affliction]] lists them.`);
  return sys(`${describeAfflictionDef(def)}.`);
}

async function cmdForgetAffliction(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`forget-affliction needs a name.`);
  const key = StringUtil.normalize(name);
  const removed = await AfflictionRegistry.remove(key);
  if (!removed) {
    return AfflictionRegistry.get(key)
      ? sys(`"${key}" is a built-in affliction - it can be shadowed with [[define-affliction]] but not deleted.`)
      : sys(`No affliction "${key}".`);
  }
  const shipped = AfflictionRegistry.get(key) ? ` The built-in "${key}" resurfaces.` : "";
  return sys(`Forgot affliction "${key}".${shipped}`);
}

async function cmdAfflict(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`afflict needs an affliction, e.g. [[afflict concentrating-on target="Wolf"]]. [[affliction]] lists them.`);
  const def = AfflictionRegistry.get(name);
  if (!def) return sys(`No affliction "${StringUtil.normalize(name)}". Define it with [[define-affliction]].`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  const r = await applyAffliction(subject.name!, def, cmd.named);
  if (r.error) return sys(`${r.error}`);
  return sys(`${r.lines!.join("; ")}.`);
}

// The manual chain trigger (the turn system will automate it): end the
// affliction now and apply its `then` successor, carrying the bindings forward.
async function cmdAdvance(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`advance needs an affliction, e.g. [[advance concentrating-on]].`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  const current = (await CharacterAfflictions.list(subject.name!)).find(c => c.def === StringUtil.normalize(name));
  if (!current) return sys(`${disp(subject.name!)} does not have "${StringUtil.normalize(name)}".`);
  const def = AfflictionRegistry.get(current.def);
  if (!def?.then) return sys(`"${current.def}" has no successor to advance into - [[lift ${current.def}]] to end it.`);
  const next = AfflictionRegistry.get(def.then);
  if (!next) return sys(`Successor "${def.then}" is not defined.`);
  await removeAffliction(subject.name!, current.def);
  const r = await applyAffliction(subject.name!, next, current.bindings);
  if (r.error) return sys(`${current.def} ended, but ${def.then} could not begin: ${r.error}`);
  return sys(`${current.def} ends; ${r.lines!.join("; ")}.`);
}

async function cmdLift(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`lift needs an affliction, e.g. [[lift feral-whispers]].`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  let spendNote = "";
  if (cmd.named["spend"]) {
    // The shrug-off: pay to end it. Only someone with a sheet can spend.
    const char = await CharacterStore.load(subject.name!);
    if (!char) return sys(`${disp(subject.name!)} has no sheet to spend from.`);
    const spend = await applySpend(char, cmd, ctx, [], []);
    if (spend.refuse) return sys(`${disp(char.name)} can't: ${spend.refuse}.`);
    spendNote = spend.note ? ` (${spend.note})` : "";
  }
  const r = await removeAffliction(subject.name!, name);
  if (r.error) return sys(`${r.error}`);
  const also = r.alsoLifted ? `; ${r.alsoLifted}` : "";
  return sys(`${disp(subject.name!)} shakes off ${r.removed!.def}${spendNote}${also}.`);
}

async function cmdAfflictions(cmd: ParsedCommand): Promise<string> {
  let subject: string;
  const arg = cmd.positional[0]?.trim();
  if (arg) {
    const r = await resolveBindingValue(arg);
    if (r.error) return sys(`${r.error}`);
    subject = r.value!;
  } else {
    const cur = await CharacterStore.getCurrent();
    if (!cur) return sys(`No active character. Select one with [[play name="..."]] or name someone: [[afflictions "Wolf"]].`);
    subject = StringUtil.normalize(cur.name);
  }
  const list = await CharacterAfflictions.list(subject);
  if (!list.length) return sys(`${disp(subject)} has no afflictions.`);
  return sys(`${disp(subject)} - ${list.map(afflictionLine).join("; ")}.`);
}

// --- ALIASES & PLAYERS ------------------------------------------------------
// A character argument may be a real name or an @alias; this is the ONE place
// that turns either into a concrete (normalized) character name. Pool-position
// @ is different machinery (saved rolls) and never comes through here.

// Resolve an explicit-scope owner ("default" -> the default player/character).
async function resolveAliasOwner(ref: AliasRef): Promise<string | undefined> {
  if (!ref.owner) return undefined;
  if (ref.scope === "player") return ref.owner === "default" ? PlayerStore.getDefault() : ref.owner;
  if (ref.owner === "default") return CharacterStore.getDefaultName();
  return ref.owner;
}

async function resolveCharacterRef(token: string): Promise<{ name?: string; error?: string }> {
  const t = StringUtil.normalize(token);
  if (!t.startsWith("@")) return { name: t };
  const ref = parseAliasToken(t);
  if (!ref) return { error: `Malformed alias "${t}" - use @alias, @global::a, @player::<id>::a or @char::<name>::a.` };
  let target: string | undefined;
  if (ref.scope) {
    const owner = await resolveAliasOwner(ref);
    if (ref.scope !== "global" && !owner) return { error: `Alias "${t}" names no ${ref.scope} to look in.` };
    target = await AliasRegistry.lookup(ref.scope, owner, ref.alias);
  } else {
    const cur = await CharacterStore.getCurrent();
    target = await AliasRegistry.resolve(ref.alias, {
      charKey: cur ? StringUtil.normalize(cur.name) : undefined,
      playerKey: await PlayerStore.current(),
    });
  }
  return target ? { name: target } : { error: `Unknown alias "@${ref.alias}". [[aliases]] lists them; [[alias @${ref.alias} "Name"]] defines it.` };
}

// Define (or overwrite) an alias. Bare @alias defines GLOBAL; the explicit
// prefixes pin a scope ("@char::default::sire" = the default character's).
async function cmdAlias(cmd: ParsedCommand): Promise<string> {
  const token = cmd.positional[0]?.trim();
  const target = (cmd.named["to"] ?? cmd.positional[1])?.trim();
  if (!token || !token.startsWith("@") || !target) {
    return sys(`alias needs an @token and a target, e.g. [[alias @kat "Katarina"]] or [[alias @char::erik::sire "Katarina"]].`);
  }
  if (target.startsWith("@")) return sys(`An alias must point at a character name, not another alias.`);
  const ref = parseAliasToken(StringUtil.normalize(token));
  if (!ref) return sys(`Malformed alias "${token}" - use @alias, @global::a, @player::<id>::a or @char::<name>::a.`);
  const scope: AliasScope = ref.scope ?? "global";
  const owner = ref.scope ? await resolveAliasOwner(ref) : undefined;
  if (scope !== "global" && !owner) return sys(`Alias "${token}" names no ${scope} to define it for.`);
  await AliasRegistry.set(scope, owner, ref.alias, target);
  const where = scope === "global" ? "globally" : `for ${scope} ${disp(owner!)}`;
  return sys(`@${ref.alias} now means ${disp(StringUtil.normalize(target))} ${where}.`);
}

async function cmdAliases(): Promise<string> {
  const m = await AliasRegistry.all();
  const bits: string[] = [];
  const fmt = (map: Record<string, string>): string => Object.entries(map).map(([a, t]) => `@${a}->${disp(t)}`).join(", ");
  if (Object.keys(m.global).length) bits.push(`global: ${fmt(m.global)}`);
  for (const [p, map] of Object.entries(m.players)) if (Object.keys(map).length) bits.push(`player ${disp(p)}: ${fmt(map)}`);
  for (const [c, map] of Object.entries(m.characters)) if (Object.keys(map).length) bits.push(`character ${disp(c)}: ${fmt(map)}`);
  if (!bits.length) return sys(`No aliases defined. Add one with [[alias @kat "Katarina"]].`);
  return sys(`Aliases - ${bits.join(" | ")}.`);
}

async function cmdForgetAlias(cmd: ParsedCommand): Promise<string> {
  const token = cmd.positional[0]?.trim();
  if (!token || !token.startsWith("@")) return sys(`forget-alias needs an @token, e.g. [[forget-alias @kat]] or [[forget-alias @char::erik::sire]].`);
  const ref = parseAliasToken(StringUtil.normalize(token));
  if (!ref) return sys(`Malformed alias "${token}".`);
  const scope: AliasScope = ref.scope ?? "global";
  const owner = ref.scope ? await resolveAliasOwner(ref) : undefined;
  if (scope !== "global" && !owner) return sys(`Alias "${token}" names no ${scope} to forget it from.`);
  return (await AliasRegistry.remove(scope, owner, ref.alias))
    ? sys(`Forgot @${ref.alias}${scope === "global" ? "" : ` (${scope} ${disp(owner!)})`}.`)
    : sys(`No such alias @${ref.alias}${scope === "global" ? "" : ` for ${scope} ${disp(owner!)}`}.`);
}

// The current player is whoever is issuing commands; the default player is what
// "default" resolves to in alias scopes (the human, in a single-player story).
async function cmdPlayer(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) {
    const cur = await PlayerStore.current();
    const def = await PlayerStore.getDefault();
    return sys(`Current player: ${disp(cur)}; default player: ${disp(def)}. [[player name="..."]] switches.`);
  }
  await PlayerStore.setCurrent(name);
  let note = "";
  if ((cmd.named["default"] ?? "") === "true") { await PlayerStore.setDefault(name); note = " (also the default player now)"; }
  return sys(`Current player is now ${disp(StringUtil.normalize(name))}${note}.`);
}

// --- DISCOVERABILITY -------------------------------------------------------
// [[help]] surfaces the command registry; [[characters]] and [[set-default]]
// round out character selection (creation sets the first default; this changes it).
async function cmdHelp(cmd: ParsedCommand): Promise<string> {
  const verb = cmd.positional[0]?.trim().toLowerCase();
  if (verb) {
    const help = CommandRouter.helpFor(verb);
    return help
      ? sys(`${verb} - ${help}`)
      : sys(`No command "${verb}". [[help]] lists them all.`);
  }
  const verbs = CommandRouter.verbs();
  return sys(`${verbs.length} commands: ${verbs.join(", ")}. [[help <verb>]] for one's usage.`);
}

async function cmdCharacters(): Promise<string> {
  const names = await CharacterStore.listNames();
  if (!names.length) return sys(`No characters yet. Make one with [[create-playable name="..." templates="..."]].`);
  const currentName = (await CharacterStore.getCurrent())?.name;
  const currentKey = currentName ? StringUtil.normalize(currentName) : undefined;
  const defKey = await CharacterStore.getDefaultName();
  const items: string[] = [];
  for (const key of names) {
    const c = await CharacterStore.load(key);
    const marks: string[] = [];
    if (key === currentKey) marks.push("current");
    if (key === defKey) marks.push("default");
    items.push(marks.length ? `${disp(c?.name ?? key)} (${marks.join(", ")})` : disp(c?.name ?? key));
  }
  return sys(`Characters: ${items.join("; ")}. [[play name="..."]] to switch.`);
}

// The record as the ENGINE reads it: every numeric bucket, with the effective
// value marked wherever enhancements/boosts change what a roll will actually
// use. This is the verification half of the creator-mode loop: hand-edit the
// lorebook JSON, run [[sheet]], see exactly what synced.
async function cmdSheet(cmd: ParsedCommand): Promise<string> {
  const raw = (cmd.named["character"] ?? cmd.positional[0])?.trim();
  let char: PlayableCharacter | undefined;
  if (raw) {
    const ref = await resolveCharacterRef(raw);
    if (ref.error) return sys(`${ref.error}`);
    char = await CharacterStore.load(ref.name!);
    if (!char) return sys(`No character named "${ref.name}".`);
  } else {
    char = await CharacterStore.getCurrent();
    if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
  }
  const { resolver } = await characterRollEnv(char);
  const fmt = (bucket: Record<string, number>, skipZeros: boolean): string => {
    const bits = Object.entries(bucket ?? {})
      .filter(([, v]) => !skipZeros || v !== 0)
      .map(([k, v]) => {
        const eff = resolver(k);
        return eff !== v ? `${k} ${v} (${eff} eff)` : `${k} ${v}`;
      });
    return bits.length ? bits.join(", ") : "none";
  };
  const parts = [
    `${disp(char.name)} [${char.templates.join("+")}, ${char.stage}]`,
    `Attributes: ${fmt(char.attributes, false)}`,
    `Abilities (nonzero): ${fmt(char.abilities, true)}`,
  ];
  const optional: Array<[string, Record<string, number>]> = [
    ["Backgrounds", char.backgrounds], ["Virtues", char.virtues],
    ["Disciplines", char.disciplines], ["Traits", char.traits],
    ["Pool starts", char.poolStarts],
  ];
  for (const [label, bucket] of optional) {
    if (Object.keys(bucket ?? {}).length) parts.push(`${label}: ${fmt(bucket, false)}`);
  }
  if (Object.keys(char.meritsFlaws ?? {}).length) {
    parts.push(`Merits/Flaws: ${Object.entries(char.meritsFlaws).map(([k, v]) => `${StringUtil.normalize(k)} ${v}`).join(", ")} ([[merits]] for detail)`);
  }
  const specs = Object.entries(char.specialties ?? {}).filter(([, labels]) => labels.length);
  if (specs.length) parts.push(`Specialties: ${specs.map(([t, labels]) => `${t}: ${labels.join(", ")}`).join("; ")}`);
  if (char.tags.length) parts.push(`Tags: ${char.tags.join(", ")}`);
  parts.push(`Live pools via [[resources]], damage via [[health]]`);
  return sys(`${parts.join(". ")}.`);
}

async function cmdSetDefault(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) return sys(`set-default needs a name, e.g. [[set-default name="Rok"]].`);
  const ref = await resolveCharacterRef(name);
  if (ref.error) return sys(`${ref.error}`);
  const c = await CharacterStore.load(ref.name!);
  if (!c) return sys(`No character named "${ref.name}". [[characters]] lists them.`);
  await CharacterStore.setDefault(c.name);
  return sys(`${disp(c.name)} is now the default character ([[play]] with no name selects it).`);
}


// --- CREATOR-MODE SYNC (the router's game-side hook) -------------------------
// While creator mode is on, the player may have hand-edited character entries
// or any wod:config entry: re-sync characters (player edits win) and reload
// every config store before a command runs, and again when leaving the mode.
async function syncFromCreatorEdits(): Promise<{ synced: string[]; failed: string[] }> {
  await reconcileLorebook();   // tracked-card drift first (may open modals)
  const result = await CharacterStore.syncFromLorebook();
  await reloadAllConfigStores();
  return result;
}
CommandRouter.beforeRoute(async () => {
  if (await CreatorMode.enabled()) await syncFromCreatorEdits();
});

// --- REGISTRATIONS ------------------------------------------------------------
// Every verb registers with its CommandSpec: the ONE declarative description
// of its arguments. [[help]] derives from it; windows render forms and compose
// command strings from it. Handlers stay the validators - a spec describes,
// it never rejects.
const SPEND_HINT = "res[::effect][!]";
const ROLL_KNOBS: ParamSpec[] = [
  { key: "difficulty", kind: "positional", hint: "[difficulty|expr]" },
  { key: "diff-mod", kind: "positional", hint: "[diff-mod]" },
  { key: "requires", kind: "named", type: "int", desc: "Successes required" },
  { key: "dice-modifier", kind: "named", type: "int", desc: "Dice added or removed" },
  { key: "tags", kind: "named", hint: '"a,b"', desc: "Roll tags (fire registered modifiers)" },
  { key: "spend", kind: "named", hint: SPEND_HINT, desc: "Resource to spend on the roll" },
  { key: "specialty", kind: "named", hint: "<trait|label>", desc: "Apply ONE specialty (+1 die; pool must use its trait)" },
];

CommandRouter.register("help", cmdHelp, {
  summary: "list commands, or show one's usage",
  params: [{ key: "verb", kind: "positional", hint: "<verb>" }],
});
CommandRouter.register("creator-mode", cmdCreatorMode, {
  summary: "toggle lorebook hand-editing; edits sync in while on",
  params: [{ key: "set", kind: "named", type: "enum", options: ["true", "false"], required: true }],
});
CommandRouter.register("create-playable", cmdCreatePlayable, {
  summary: "create a playable character (attributes 1, abilities 0 - allocation is opt-in)",
  params: [
    { key: "name", kind: "named", required: true, desc: "Name", example: "e.g. Erik the Red" },
    { key: "templates", kind: "named", required: true, hint: '"a,b"', desc: "Templates (comma-separated; hybrids legal)", example: "e.g. vampire" },
  ],
});
CommandRouter.register("play", cmdPlay, {
  summary: "switch to a character; no name selects the default",
  params: [{ key: "name", kind: "named", hint: '"<name|@alias>"' }],
});
CommandRouter.register("characters", cmdCharacters, {
  summary: "list playable characters; marks current/default",
});
CommandRouter.register("sheet", cmdSheet, {
  summary: "show a character's record as the engine reads it (effective values marked)",
  params: [{ key: "character", kind: "positional", hint: '"<name|@alias>"' }],
});
CommandRouter.register("set-default", cmdSetDefault, {
  summary: "change the default character",
  params: [{ key: "name", kind: "named", required: true, hint: '"<name|@alias>"' }],
});
CommandRouter.register("roll", cmdRoll, {
  summary: "roll a dice pool for the current character",
  params: [{ key: "pool", kind: "positional", required: true, hint: "<pool|@name>" }, ...ROLL_KNOBS,
    { key: "table", kind: "named", desc: "Success table to read the outcome" }],
});
CommandRouter.register("roll-for", cmdRollFor, {
  summary: "roll for a named character without switching to them",
  params: [
    { key: "character", kind: "positional", required: true, hint: '"<name|@alias>"' },
    { key: "pool", kind: "positional", required: true, hint: "<pool|@name>" }, ...ROLL_KNOBS,
    { key: "table", kind: "named", desc: "Success table to read the outcome" }],
});
CommandRouter.register("name-roll", cmdNameRoll, {
  summary: "save a roll under a name; @name invokes it with its spend/specialty/table baked in",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>" },
    { key: "pool", kind: "positional", required: true, hint: "<pool>" }, ...ROLL_KNOBS,
    { key: "table", kind: "named", desc: "Success table read when the roll is invoked" }],
});
CommandRouter.register("list-rolls", cmdListRolls, { summary: "list the chronicle's saved rolls" });
CommandRouter.register("forget-roll", cmdForgetRoll, {
  summary: "delete a saved roll",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("extended-roll", cmdExtendedRoll, {
  summary: "start an extended action (rolls interval 1 now)",
  note: "plus the usual roll knobs",
  params: [
    { key: "pool", kind: "positional", required: true, hint: "<pool>" },
    { key: "requires", kind: "named", type: "int", required: true, hint: "<target>", desc: "Accumulated successes to reach" },
    { key: "intervals", kind: "named", type: "int", required: true, hint: "<max>", desc: "Maximum rolls" },
    { key: "interval", kind: "named", desc: "In-fiction spacing (ST-enforced)", example: "e.g. 1 night" },
    { key: "label", kind: "named", type: "literal", desc: "Display label" },
    { key: "on-botch", kind: "named", type: "enum", options: ["fail", "lose-successes", "ignore"] },
    { key: "difficulty", kind: "named", type: "int" },
    { key: "dice-modifier", kind: "named", type: "int" },
    { key: "tags", kind: "named", hint: '"a,b"' },
    { key: "spend", kind: "named", hint: SPEND_HINT },
  ],
});
CommandRouter.register("continue-roll", cmdContinueRoll, {
  summary: "whoever is current rolls the next interval (named-only overrides)",
  params: [
    { key: "id", kind: "positional", hint: "[id]" },
    { key: "difficulty", kind: "named", type: "int" },
    { key: "diff-mod", kind: "named", type: "int" },
    { key: "dice-modifier", kind: "named", type: "int" },
    { key: "tags", kind: "named", hint: '"a,b"' },
    { key: "spend", kind: "named", hint: SPEND_HINT },
  ],
});
CommandRouter.register("roll-status", cmdRollStatus, {
  summary: "show an extended action's progress",
  params: [{ key: "id", kind: "positional", hint: "[id]" }],
});
CommandRouter.register("cancel-roll", cmdCancelRoll, {
  summary: "cancel an extended action",
  params: [{ key: "id", kind: "positional", hint: "[id]" }],
});
CommandRouter.register("resources", cmdResources, { summary: "list the current character's resources" });
CommandRouter.register("spend", cmdSpend, {
  summary: "spend a resource / fire a named effect outside a roll",
  params: [
    { key: "resource", kind: "positional", required: true, hint: "<resource[::effect]>" },
    { key: "target", kind: "positional", hint: "[target]" },
    { key: "amount", kind: "positional", hint: "[amount]" },
    { key: "reason", kind: "named", type: "literal", desc: "Why (echoed in the note)" },
  ],
});
CommandRouter.register("gain", cmdGain, {
  summary: "regain a resource",
  params: [
    { key: "resource", kind: "positional", required: true, hint: "<resource>" },
    { key: "amount", kind: "positional", hint: "[amount]" },
  ],
});
CommandRouter.register("damage", cmdDamage, {
  summary: "mark damage on the current character",
  params: [
    { key: "severity", kind: "positional", required: true, type: "enum", options: ["bashing", "lethal", "aggravated"], hint: "<bashing|lethal|aggravated>" },
    { key: "n", kind: "positional", hint: "[n]" },
  ],
});
CommandRouter.register("health", cmdHealth, { summary: "show the current character's health track" });
CommandRouter.register("clear-boosts", cmdClearBoosts, { summary: "clear trait boosts (the ST calls the duration)" });
CommandRouter.register("reset-uses", cmdResetUses, { summary: "scene/turn change: clears effect-use counters" });
CommandRouter.register("configure-resources", cmdConfigureResources, { summary: "guided resource setup; plain replies answer it" });
CommandRouter.register("cancel-wizard", cmdCancelWizard, { summary: "abandon the running wizard" });
CommandRouter.register("resist", cmdResist, {
  summary: "resisted action: your margin over theirs counts (tie = fail)",
  params: [
    { key: "your-pool", kind: "positional", required: true, hint: "<your-pool>" },
    { key: "their-pool", kind: "positional", required: true, hint: "<their-pool>" },
    { key: "vs", kind: "named", hint: '"Name"', desc: "Opposing character (stored characters roll live)" },
    { key: "difficulty", kind: "named", type: "int" },
    { key: "vs-difficulty", kind: "named", type: "int" },
    { key: "table", kind: "named", desc: "Success table read with your margin" },
    { key: "spend", kind: "named", hint: SPEND_HINT },
  ],
});
CommandRouter.register("contest", cmdContest, {
  summary: "contested action: higher total wins (tie = draw)",
  params: [
    { key: "your-pool", kind: "positional", required: true, hint: "<your-pool>" },
    { key: "their-pool", kind: "positional", required: true, hint: "<their-pool>" },
    { key: "vs", kind: "named", hint: '"Name"', desc: "Opposing character (stored characters roll live)" },
    { key: "difficulty", kind: "named", type: "int" },
    { key: "vs-difficulty", kind: "named", type: "int" },
    { key: "table", kind: "named", desc: "Success table read with your margin" },
    { key: "spend", kind: "named", hint: SPEND_HINT },
  ],
});
CommandRouter.register("extended-contest", cmdExtendedContest, {
  summary: "both sides accumulate; first to the goal wins (dead heat stays open)",
  params: [
    { key: "your-pool", kind: "positional", required: true, hint: "<your-pool>" },
    { key: "their-pool", kind: "positional", required: true, hint: "<their-pool>" },
    { key: "target", kind: "named", type: "int", required: true, hint: "<n>", desc: "Accumulated successes to win" },
    { key: "rounds", kind: "named", type: "int", required: true, hint: "<max>", desc: "Maximum rounds" },
    { key: "vs", kind: "named", hint: '"Name"' },
    { key: "label", kind: "named", type: "literal", desc: "Display label" },
    { key: "interval", kind: "named", desc: "In-fiction spacing (ST-enforced)" },
    { key: "on-botch", kind: "named", type: "enum", options: ["fail", "lose-successes", "ignore"] },
    { key: "difficulty", kind: "named", type: "int" },
    { key: "vs-difficulty", kind: "named", type: "int" },
  ],
});
CommandRouter.register("continue-contest", cmdContinueContest, {
  summary: "roll the next contest round",
  params: [
    { key: "id", kind: "positional", hint: "[id]" },
    { key: "difficulty", kind: "named", type: "int" },
    { key: "vs-difficulty", kind: "named", type: "int" },
    { key: "diff-mod", kind: "named", type: "int" },
    { key: "dice-modifier", kind: "named", type: "int" },
    { key: "tags", kind: "named", hint: '"a,b"' },
  ],
});
CommandRouter.register("contest-status", cmdContestStatus, {
  summary: "show an extended contest's progress",
  params: [{ key: "id", kind: "positional", hint: "[id]" }],
});
CommandRouter.register("cancel-contest", cmdCancelContest, {
  summary: "cancel an extended contest",
  params: [{ key: "id", kind: "positional", hint: "[id]" }],
});
CommandRouter.register("tables", cmdTables, {
  summary: "list success tables (grouped by category), or lay one out in full",
  params: [{ key: "name", kind: "positional", hint: "<name|sub|sub::name|@alias>" }],
});
CommandRouter.register("define-table", cmdDefineTable, {
  summary: "define/replace a success table in its category's general card",
  note: "a missing subcategory prompts a modal to create it",
  params: [
    { key: "name", kind: "named", required: true, hint: '"[sub::]name"', desc: "Name (optionally sub::name)", example: "e.g. combat::quick-kill" },
    { key: "rows", kind: "named", type: "literal", hint: "`1:Cowed, 3:Terrified[=2]`", desc: "Ladder rows: <successes>:<label>[=<value>], comma-separated", example: "e.g. 1:Cowed, 3:Terrified" },
    { key: "value-per-success", kind: "named", type: "int", desc: "Direct numeric output per success" },
    { key: "cap", kind: "named", type: "int", desc: "Successes beyond this are wasted" },
    { key: "overflow-per", kind: "named", type: "int", desc: "Batch size beyond the last row" },
    { key: "overflow-value", kind: "named", type: "int", desc: "Value added per overflow batch" },
    { key: "overflow-label", kind: "named", type: "literal", desc: "Overflow annotation" },
    { key: "botch", kind: "named", type: "literal", desc: "What a botch means here" },
    { key: "failure", kind: "named", type: "literal", desc: "What failure means here" },
    { key: "description", kind: "named", type: "literal", desc: "Description" },
  ],
});
CommandRouter.register("forget-table", cmdForgetTable, {
  summary: "remove a table from its category's general card; built-ins can only be shadowed",
  params: [{ key: "name", kind: "positional", required: true, hint: "<[sub::]name|@alias>" }],
});
CommandRouter.register("define-table-category", cmdDefineTableCategory, {
  summary: "create a table subcategory (a real lorebook category with its general card)",
  params: [{ key: "name", kind: "named", required: true, desc: "Category name (single segment)", example: "e.g. combat" }],
});
CommandRouter.register("table-alias", cmdTableAlias, {
  summary: "define a table alias, or list them (no args); table=@alias resolves it",
  params: [
    { key: "token", kind: "positional", hint: "<@alias>" },
    { key: "target", kind: "positional", hint: '"<[sub::]name>"' },
  ],
});
CommandRouter.register("forget-table-alias", cmdForgetTableAlias, {
  summary: "remove a table alias",
  params: [{ key: "token", kind: "positional", required: true, hint: "<@alias>" }],
});
CommandRouter.register("define-constraint", cmdDefineConstraint, {
  summary: "define/replace a constraint group",
  params: [
    { key: "name", kind: "named", required: true, desc: "Name", example: "e.g. clan-only-backgrounds" },
    { key: "relation", kind: "named", type: "enum", options: [...CONSTRAINT_RELATIONS], default: "exclusive", desc: "Relation" },
    { key: "domain", kind: "named", type: "enum", options: [...CONSTRAINT_DOMAINS], default: "background", desc: "Domain" },
    { key: "members", kind: "named", hint: '"a,b"', desc: "Members (comma-separated Backgrounds or Merits/Flaws)", example: "e.g. status, anonymity" },
    { key: "max", kind: "named", type: "int", desc: "Max to hold (exclusive only; default 1)" },
    { key: "scope", kind: "named", desc: "Scope: templates/choices it applies to (comma-separated; empty = everyone)", example: "e.g. tzimisce" },
    { key: "note", kind: "named", desc: "Note (optional)" },
  ],
});
CommandRouter.register("constraints", cmdConstraints, { summary: "list the story's constraint groups" });
CommandRouter.register("constraint", cmdConstraint, {
  summary: "show one constraint group in full",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("forget-constraint", cmdForgetConstraint, {
  summary: "remove a constraint group",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("check-constraints", cmdCheckConstraints, { summary: "flag the current character's constraint conflicts (incl. merit-instance caps)" });
CommandRouter.register("take-merit", cmdTakeMerit, {
  summary: "take a merit/flaw; parameterized defs take name::param instances",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name[::param]>" },
    { key: "points", kind: "positional", hint: "[points]" },
    { key: "waive", kind: "named", type: "enum", options: ["true"], desc: "Waive unmet prerequisites" },
  ],
});
CommandRouter.register("drop-merit", cmdDropMerit, {
  summary: "drop an owned merit/flaw instance",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name[::param]>" }],
});
CommandRouter.register("merits", cmdMerits, {
  summary: "list owned merits/flaws, enhancement totals and advisory issues",
});
CommandRouter.register("specialty", cmdSpecialty, {
  summary: "add a specialty to a trait (labels keep their case)",
  params: [
    { key: "trait", kind: "positional", required: true, hint: "<trait>" },
    { key: "label", kind: "positional", required: true, type: "literal", hint: "`<Label>`" },
  ],
});
CommandRouter.register("forget-specialty", cmdForgetSpecialty, {
  summary: "remove a specialty (label needed only when a trait has several)",
  params: [
    { key: "trait", kind: "positional", required: true, hint: "<trait>" },
    { key: "label", kind: "positional", type: "literal", hint: "[`<Label>`]" },
  ],
});
CommandRouter.register("specialties", cmdSpecialties, {
  summary: "list the current character's specialties",
});
CommandRouter.register("define-affliction", cmdDefineAffliction, {
  summary: "define/replace an affliction (overlay; may shadow a built-in)",
  params: [
    { key: "name", kind: "named", required: true, desc: "Name", example: "e.g. dazed" },
    { key: "bindings", kind: "named", hint: '"target"', desc: "Required slots (comma-separated)", example: "e.g. target" },
    { key: "duration", kind: "named", hint: '"1 turn|until x|instant"', desc: "Advisory duration" },
    { key: "then", kind: "named", desc: "Successor affliction ([[advance]] applies it)" },
    { key: "mirror", kind: "named", desc: "Affliction the bound target gains, bound back" },
    { key: "tags", kind: "named", hint: '"a,b"', desc: "Tags joined to the afflicted character's rolls" },
    { key: "description", kind: "named", type: "literal", desc: "Description" },
    { key: "note", kind: "named", desc: "Note (optional)" },
  ],
});
CommandRouter.register("affliction", cmdAfflictionInfo, {
  summary: "list defined afflictions, or show one in full",
  params: [{ key: "name", kind: "positional", hint: "[name]" }],
});
CommandRouter.register("forget-affliction", cmdForgetAffliction, {
  summary: "remove an overlay definition; built-ins can only be shadowed",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("afflict", cmdAfflict, {
  summary: "apply an affliction; extra <slot>=<name|@alias> args fill its bindings",
  note: "mirror defs also afflict the bound target",
  openNamed: true,
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>", desc: "Who (default: the current character)" },
  ],
});
CommandRouter.register("advance", cmdAdvance, {
  summary: "end an affliction and begin its successor, bindings carried forward",
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>" },
  ],
});
CommandRouter.register("lift", cmdLift, {
  summary: "remove an affliction - and its mirror; spend = shrug-off",
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>" },
    { key: "spend", kind: "named", hint: SPEND_HINT },
  ],
});
CommandRouter.register("afflictions", cmdAfflictions, {
  summary: "active afflictions; NPCs work too",
  params: [{ key: "who", kind: "positional", hint: "<name|@alias>" }],
});
CommandRouter.register("alias", cmdAlias, {
  summary: "define an alias for a character",
  note: "bare @a = global; @global::a, @player::<id|storyteller|default>::a, @char::<name|default>::a pin a scope",
  params: [
    { key: "token", kind: "positional", required: true, hint: "<@token>" },
    { key: "target", kind: "positional", required: true, hint: '"Target Name"' },
  ],
});
CommandRouter.register("aliases", cmdAliases, { summary: "list every alias, grouped by scope" });
CommandRouter.register("forget-alias", cmdForgetAlias, {
  summary: "remove an alias (bare @a = global; scoped tokens as in alias)",
  params: [{ key: "token", kind: "positional", required: true, hint: "<@token>" }],
});
CommandRouter.register("player", cmdPlayer, {
  summary: "show or switch the current player; storyteller is always valid",
  params: [
    { key: "name", kind: "named", hint: '"<id>"' },
    { key: "default", kind: "named", type: "enum", options: ["true"], desc: "Also make it the default player" },
  ],
});

const COMMAND_PATTERN = /\[\[([\s\S]*?)\]\]/g;

// Replace every [[command]] in the player's adventure-mode input with its OOC
// note, running commands in order. If the input was ONLY commands (no prose),
// generation is suppressed - the player is operating the system, not the story.
export async function processAdventureInput(rawInputText: string): Promise<OnTextAdventureInputReturnValue | undefined> {
  const matches = [...rawInputText.matchAll(COMMAND_PATTERN)];
  if (matches.length === 0) {
    // A running wizard claims plain (command-less) input as its reply - the
    // text "prompt -> reply" medium. [[commands]] still route normally below.
    const active = await WizardSession.get();
    if (active) {
      const out = await answerActiveWizard(active, rawInputText);
      return { inputText: out.replace(/\n/g, " "), stopGeneration: true };
    }
    return undefined; // not ours; leave input untouched
  }

  let out = "";
  let cursor = 0;
  for (const m of matches) {
    out += rawInputText.slice(cursor, m.index);
    out += await CommandRouter.route(m[1]);
    cursor = (m.index ?? 0) + m[0].length;
  }
  out += rawInputText.slice(cursor);

  const prose = rawInputText.replace(COMMAND_PATTERN, "").trim();
  // The host forbids newlines in inputText (it would replace them with spaces).
  return { inputText: out.replace(/\n/g, " "), stopGeneration: prose.length === 0 };
}
