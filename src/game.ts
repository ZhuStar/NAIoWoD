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
import {
  CardValue, CardMap, parseCardText, formatCardText, inlineCardText, asNamedList,
} from "./core/cardtext";
import { Rng } from "./core/dice";
import { SeverityName, HealthSummary } from "./core/damage";
import {
  parseStoryDate, formatStoryDate, parseDuration, addDuration, diffCalendar, formatCalendarSpan, Duration,
  countDayBoundaries, countFullMoons, nextFullMoon,
} from "./core/time";
import {
  TEMPLATES, ResourceDef, resourceEffect,
  EffectSpec, EffectOp, describeEffect,
  makeConstraintGroup, describeConstraint, checkConstraints, OwnedTraits,
  ConstraintRelation, ConstraintDomain, CONSTRAINT_RELATIONS, CONSTRAINT_DOMAINS,
  makeAfflictionDef, describeAfflictionDef, parseAfflictionDuration, describeDuration,
  AfflictionExpiry, makeAfflictionExpiry, describeExpiry, rollSpendsCharge, expiryElapsed,
  OrphanPolicy, makeOrphanPolicy, describeOrphanPolicy, PassiveGrant, grantIsAutomatic,
  expiryIsAdvisoryOnly,
  AfflictionDef,
  MeritFlawRequirements, resolvePowerInstance, passiveOpsOf, grantBindings, grantLevel,
  DIFFICULTY_MODIFIER, afflictionOpsOf,
  magicRulesFrom, FELLOWSHIPS, isAwakened, foldAfflictionTiers, uncancelableCap,
  uncancelableAllowance, isCastingRoll, CASTING_TAGS,
  rollFloorFrom,
  advancementCostsFrom, CostTable, COST_PURSES,
  BackgroundDef, makeBackgroundDef, backgroundTierAt, TraitGrant,
  CreationBudget, creationBudgetFor, TraitLimit, CLANS, clanByName, clanFamilyOf, clanFamilies, fellowshipByName, ATTRIBUTES,
  isTraitCategory, singularCategory, ALL_TRAIT_CATEGORIES, ATTRIBUTE_CATEGORIES, ABILITY_CATEGORIES,
  BudgetDef, BudgetEntry, budgetDef, budgetBuyable, NOT_PURCHASABLE,
  GRANT_SOURCES, sourceDrawsOnPurse, grantSourceNote, CreationGrant, describeCreationGrant,
  CAPABILITIES, capabilityNote, affinityDisciplines, AFFINITY_SOURCES,
  roadRatingExpr, roadByName, ROADS,
  TemplateDef, makeTemplateDef, DEFAULT_TEMPLATE_DEFS, SOAK_TABLES,
  DEFAULT_SUPERNATURAL_CATEGORIES, DEFAULT_SUPERNATURAL_TRAITS, supernaturalTraitOf, categoryOpenTo,
  MeritFlawDef, ArcanumDef, OwnedPowerDef, parsePassiveOps, describePassiveOp, SRD_HEADER_MARKER, disciplineDef,
  meritFlawFromCard, arcanumFromCard, InstanceLimit, instanceLimitsOf,
  meritCostFor, budgetOfKind, kindSpends,
  MERIT_FLAW_KINDS, MeritFlawKind, ARCANUM_KINDS, ArcanumKind, OwnedPowerKind, isArcanumKind,
  ARCANA_CAPABILITY, capabilitiesOpenArcana,
  TemplateVariant,
} from "./rules";
import {
  MeritFlawRegistry, ArcanumRegistry, reloadAllConfigStores, LorebookManager, ScopedStorage, PostOffice, Bus,
  TrackedLorebook, ReconcileFinding, combineConfigTexts, structuralHash,
  writeTrackedEntry, ensurePath, TABLE_GENERAL_HEADER,
  configEntryText, namedDefsToCard,
} from "./services";
import {
  RollSpec, RollModifier, TraitResolver, makeRollSpec, executeRoll, formatExecution, overrideSpec, describeSpec,
  ExtendedRoll, applyInterval, describeExtended, parseBotchPolicy, parsePoolExpression,
  SuccessTable, SuccessTableRegistry, readSuccessTable, describeTableReading, describeTable,
  parseTableRows, DEFAULT_SUCCESS_TABLES, RollOutcomeKind,
  ContestMode, ContestOutcome, compareRolls, ExtendedContest, applyContestRound, describeContest, RollExecution,
  ContestEntrant, FieldOutcome, compareField, describeStandings, ContestSide,
  CONTEST_OPEN, CONTEST_DRAW, migrateContest,
  BotchPolicy,
} from "./rolls";
import {
  WizardDefinition, WizardPrompt, WizardStateData, WizardResult, resolveReply, renderPromptText,
} from "./wizard";
import {
  ParsedCommand, CommandParser, CommandContext, CommandHandler, CommandRouter, ParamSpec, sys,
  commandEnvelope, commandChannel, COMMAND_CHANNEL, sysNote, stripSys,
  flagOf, IN_STORY_KEY,
} from "./command";
import {
  PlayableCharacter, CharacterStore, PLAYER_CHARACTERS_CATEGORY, characterToCard,
  permanentRatingOf, traitKindOf, TraitInstance,
  BackgroundRegistry, grantedTraitsOf, effectiveTraitOf, BACKGROUNDS_ENTRY,
  NamedRollStore, ExtendedRollStore, ExtendedContestStore,
  StoryClock, DateBook, Scene, SceneStore, GenCounter,
  PlayerStore, AliasScope, AliasRef, parseAliasToken, AliasRegistry, SHOW_ALL_TOKEN,
  traitCategoryOf, traitInCategory, traitsInCategory, traitKindsOf, AbilityCategories,
  resolveTraitFromRecord, ownedMeritInstances, ownedArcanumInstances, ownedPowerInstances,
  OwnedPowerInstance, enhancementsFor, SavedRoll, ExtendedSavedConfig,
  OpposedSavedConfig, ProcedureStep, ProcedureCondition,
  ResourceOverrides, RESOURCE_CONFIG_ENTRY, TableLibrary, TableAliases, TABLES_CATEGORY,
  ConstraintRegistry, AfflictionRegistry,
  ActiveAffliction, CharacterAfflictions, CharacterCooldowns,
  CharacterResources, CharacterHealth, CharacterBoosts, EffectUses,
  MagicRulesConfig, CastAttempts, CrayStore, CrayState,
  AdvancementCosts, COSTS_CONFIG_ENTRY,
  RollRulesConfig, ROLLS_CONFIG_ENTRY,
  ActiveWizard, WizardSession, CreatorMode,
  characterScope, traitValueOf, evalOn, numericOn, derivedValuesOf, DerivedValue, ScopeExtension, roadOf,
  TemplateRegistry, lastTemplateProblems, resourceNumbers,
} from "./state";
import { Numeric, ExprScope, evaluateExpr, describeTerms, BUILTIN_FUNCTIONS, evaluateCondition } from "./core/expr";
import { SYSTEM, BusHandler } from "./core/bus";

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
// A named argument as an integer, or undefined when absent or unparseable -
// "not given" and "given as nonsense" both mean "the caller decides".
function intOrUndef(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const v = parseInt(s, 10);
  return Number.isNaN(v) ? undefined : v;
}

// The refusal every character-scoped verb gives. It was written out 36 times;
// one copy is one place to change how the engine asks you to pick someone.
const NO_CHARACTER = `No active character. Select one with [[play name="..."]]`;
const noCharacter = (orElse = ""): string => sys(`${NO_CHARACTER}${orElse ? ` ${orElse}` : ""}.`);

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
  const { synced, failed, emptied: justNow } = await syncFromCreatorEdits();
  const emptied = justNow.length ? justNow : lastEmptied;
  lastEmptied = [];
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
function runRoll(spec: RollSpec, resolve: TraitResolver, opts: { rng?: Rng; extra?: Partial<RollModifier>; usedTags?: string[] } = {}): RollExecution {
  const floor = spec.minDifficulty ?? rollFloorFrom(RollRulesConfig.current());
  return executeRoll(floor === undefined ? spec : { ...spec, minDifficulty: floor }, resolve, opts);
}

// Ops the roll pipeline executes directly, and WHICH RollModifier field each
// one moves. THE one place that knows: `undefined` means "not a roll op", so
// the membership test and the translation can never disagree.
function rollOpPatch(op: string, amount: number): Partial<RollModifier> | undefined {
  switch (op.toLowerCase()) {
    case "difficulty": return { difficultyMod: amount };
    case "dice": return { diceMod: amount };
    case "successes": return { autoSuccesses: amount };
    case "uncancelable": return { uncancelableSuccesses: amount };
    case "nagain": return { nAgain: amount };
    default: return undefined;
  }
}
const isRollOp = (o: EffectOp): boolean => rollOpPatch(o.op, 0) !== undefined;

// Fold roll-modifier patches into an accumulator. Every field ADDS, except
// `nAgain`, which TIGHTENS - the lowest explosion threshold offered wins.
function mergeRollExtra(into: Partial<RollModifier>, ...patches: Array<Partial<RollModifier>>): Partial<RollModifier> {
  for (const p of patches) {
    if (p.difficultyMod) into.difficultyMod = (into.difficultyMod ?? 0) + p.difficultyMod;
    if (p.diceMod) into.diceMod = (into.diceMod ?? 0) + p.diceMod;
    if (p.autoSuccesses) into.autoSuccesses = (into.autoSuccesses ?? 0) + p.autoSuccesses;
    if (p.uncancelableSuccesses) into.uncancelableSuccesses = (into.uncancelableSuccesses ?? 0) + p.uncancelableSuccesses;
    if (p.nAgain !== undefined) into.nAgain = Math.min(into.nAgain ?? 10, p.nAgain);
  }
  return into;
}

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
      // An op marked `once` fires once per spend, however many units rode it
      // (Living Resolve's "ONE un-cancelable success per roll, whatever else
      // the points bought").
      const mult = op.once ? 1 : effectUnits;
      if (kind === "difficulty") extra.difficultyMod = (extra.difficultyMod ?? 0) + (op.amount ?? 1) * mult;
      else if (kind === "dice") extra.diceMod = (extra.diceMod ?? 0) + (op.amount ?? 1) * mult;
      else if (kind === "successes") extra.autoSuccesses = (extra.autoSuccesses ?? 0) + (op.amount ?? 1) * mult;
      else if (kind === "uncancelable") extra.uncancelableSuccesses = (extra.uncancelableSuccesses ?? 0) + (op.amount ?? 1) * mult;
      else if (kind === "nagain") extra.nAgain = Math.min(extra.nAgain ?? 10, op.amount ?? 10);
      if (kind === "uncancelable") {
        // Pouring EXTRA Willpower into one action for extra certainty is a
        // spellcasting rule; everywhere else the old law holds - one Willpower
        // per action, so however many points rode the spend, one of them counts
        // as the Willpower. On a spell it stacks up to what the Foundation holds.
        const casting = isCastingRoll(opts.rollTags);
        const cap = uncancelableAllowance(casting, resolveFoundation(undefined, resolver).rating, magicRulesFrom(MagicRulesConfig.current()));
        if ((extra.uncancelableSuccesses ?? 0) > cap) {
          extra.uncancelableSuccesses = cap;
          notes.push(casting
            ? `capped at ${cap} sure (Foundation)`
            : `1 sure only (stacking Willpower is a casting rule)`);
        }
      }
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
async function applySpend(char: PlayableCharacter, cmd: ParsedCommand, ctx: CommandContext, rollTags: string[], rollTraits: string[], spendOverride?: string, amountOverride?: number): Promise<{ extra?: Partial<RollModifier>; note: string; refuse?: string }> {
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

  // How many points ride this spend. The command wins over the saved roll's
  // own amount; a resource's `limits.maxPerUse` clamps it and says so.
  const applications = Math.max(1, intOrUndef(cmd.named["spend-amount"]) ?? amountOverride ?? 1);

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
  // What the spend DID, not what the resource IS. The effect's label is a
  // paragraph of rules prose - it belongs to [[show-resource]], not to the tail of
  // every punch. What the dice actually got is already on the roll line
  // ("+2 auto +1 sure vs diff 2"); these notes carry what that line cannot say:
  // how many points left the pool, and anything that capped or skipped an op.
  return { extra: r.extra, note: r.notes.join("; ") };
}

// A resource the character ROLLS as a trait (def.rollAs): pooling its name (or
// a name it replaces) resolves to min(cap, current). Living Resolve's Willpower/
// Resolve rolls work this way - and its points above the shield threshold
// negate dice of penalties (applyPenaltyShield).
interface RollAsBinding { def: ResourceDef; current: number; names: string[] }

// A character's live roll environment: traits + active boosts, the wound
// penalty to fold into the dice pool, and any rollAs resource bindings.
// Shared by rolls and contests.
async function characterRollEnv(char: PlayableCharacter): Promise<{ resolver: (n: string) => number; penalty: number; rollAs: RollAsBinding[]; resourceAt: (nameOrRole: string) => number }> {
  const boosts = await CharacterBoosts.all(char);
  const enh = enhancementsFor(char);   // Trait Enhancement: permanent, beside the temporary boosts
  const penalty = (await CharacterHealth.summary(char)).penalty;
  const rollAs: RollAsBinding[] = [];
  const views = await CharacterResources.all(char);
  for (const view of views) {
    if (!view.def.rollAs) continue;
    rollAs.push({
      def: view.def, current: view.current,
      names: [view.def.name, ...(view.def.replaces ?? [])].map(n => StringUtil.normalize(n)),
    });
  }
  // How much of a resource the character holds RIGHT NOW, by name, by a role it
  // fills, or by a name it replaced - the live side of a `requiresResource` gate.
  const resourceAt = (nameOrRole: string): number => {
    const key = StringUtil.normalize(nameOrRole);
    const hit = views.find(v => StringUtil.normalize(v.def.name) === key)
      ?? views.find(v => (v.def.roles ?? []).some(r => StringUtil.normalize(r) === key))
      ?? views.find(v => (v.def.replaces ?? []).some(r => StringUtil.normalize(r) === key));
    return hit?.current ?? 0;
  };
  return {
    resolver: (n: string): number => {
      const key = StringUtil.normalize(n);
      const bound = rollAs.find(b => b.names.includes(key));
      if (bound) return Math.max(0, Math.min(bound.def.rollAs?.cap ?? Infinity, bound.current));
      // traitValueOf, not the raw bucket: a rating a Background CONFERS and a
      // value the template DERIVES are as real as one the player typed, so
      // `[[roll willpower+courage]]` works on a sheet that states neither.
      return traitValueOf(char, key) + (enh[key] ?? 0) + (boosts[key] ?? 0);
    },
    penalty,
    rollAs,
    resourceAt,
  };
}

// The penalty shield: when the roll's POOL used a rollAs resource with
// `negatesPenaltiesAbove`, each point above that threshold negates 1 die of the
// roll's reductions (the wound penalty + explicit negative dice mods already in
// `extra`/the spec). Mutates `extra`; returns the note ("" when nothing
// shielded). Tag-driven dice reductions inside resolveSpec are NOT seen here
// (recorded limitation).
function applyPenaltyShield(rollAs: RollAsBinding[], poolTraits: string[], specDiceMod: number, extra: Partial<RollModifier>): string {
  const bound = rollAs.find(b => b.def.rollAs?.negatesPenaltiesAbove !== undefined && b.names.some(n => poolTraits.includes(n)));
  if (!bound) return "";
  const shield = Math.max(0, bound.current - (bound.def.rollAs?.negatesPenaltiesAbove ?? Infinity));
  const reductions = Math.max(0, -(extra.diceMod ?? 0)) + Math.max(0, -specDiceMod);
  const offset = Math.min(shield, reductions);
  if (offset <= 0) return "";
  extra.diceMod = (extra.diceMod ?? 0) + offset;
  return `${bound.def.name} shields ${offset} ${offset === 1 ? "die" : "dice"} of penalties`;
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

// Did this pool use the trait an op is gated on? A plain name matches itself; a
// CATEGORY matches any trait the chronicle files under it, which is what lets a
// merit say "every Talent" or an arcanum say "pick a Knowledge".
function poolUsesTrait(poolTraits: string[], gate: string): boolean {
  const want = StringUtil.normalize(gate);
  if (poolTraits.includes(want)) return true;
  return isTraitCategory(want) && poolTraits.some(t => traitInCategory(t, want));
}

// Fold the character's PASSIVE roll ops (owned merits/arcana - Trait Affinity
// et al.) into a roll: trait-gated ops fire iff the pool used the trait,
// actionTag-gated ops iff the roll carries the tag; unmet gates skip SILENTLY
// (passives must not spam every unrelated roll). "enhance" is env-level and
// ignored here.
function passiveRollExtra(char: PlayableCharacter, poolTraits: string[], tags: string[], resourceAt?: (n: string) => number, afflicted: Array<{ from: string; ops: EffectOp[] }> = []): { extra: Partial<RollModifier>; notes: string[]; usedTags: string[] } {
  const extra: Partial<RollModifier> = {};
  const notes: string[] = [];
  // Tags these ops gated on: they DID something, so the roll must not go on to
  // call them unknown.
  const usedTags: string[] = [];
  // Both categories - a die is a die, and Trait Affinity is an arcanum - plus
  // whatever is currently ON him: a merit's passive and an affliction's ops are
  // the same currency, judged by the same two gates.
  const sources: Array<{ label: string; ops: EffectOp[] }> = [
    ...ownedPowerInstances(char).map(inst => ({
      label: `${StringUtil.normalize(inst.def.name)}${inst.param ? ` (${inst.param})` : ""}`,
      ops: passiveOpsOf(inst.def, inst.param, inst.points),
    })),
    ...afflicted.map(a => ({ label: a.from, ops: a.ops })),
  ];
  for (const inst of sources) {
    for (const op of inst.ops) {
      const kind = op.op.toLowerCase();
      const patch = (n: number): Partial<RollModifier> => rollOpPatch(kind, n) ?? {};
      if (!rollOpPatch(kind, 0)) continue;
      if (op.target && !tags.includes(StringUtil.normalize(op.target))) continue;
      // The trait gate names a TRAIT ("melee") or a CATEGORY ("knowledge",
      // "talents"): "-1 difficulty on every Knowledge" is one op, not ten.
      if (op.trait && !poolUsesTrait(poolTraits, op.trait)) continue;
      // A "while I still hold N of this" gate - checked live, so it lapses the
      // moment the pool runs dry.
      if (op.requiresResource && (resourceAt?.(op.requiresResource.resource) ?? 0) < op.requiresResource.atLeast) continue;
      const amount = op.amount ?? 1;
      mergeRollExtra(extra, patch(amount));
      // Difficulty runs backwards - a MINUS is easier - so the note says which,
      // and nobody has to hold the convention in their head.
      const sense = kind === "difficulty" ? ` (${amount < 0 ? "easier" : "harder"})` : "";
      notes.push(`${inst.label}: ${kind} ${amount > 0 ? "+" : ""}${amount}${sense}`);
      if (op.target) usedTags.push(StringUtil.normalize(op.target));
    }
  }
  return { extra, notes, usedTags };
}

// Fold the character's ACTIVE afflictions' rating-scaled tiers into a roll -
// the twin of passiveRollExtra, but the magnitude comes from a Background
// (Sanctum 8 grants more than Sanctum 2). Gates: `requiresAwakened` defs skip
// the unawakened entirely; an op's `target` still names an action tag the roll
// must carry, and its `trait` the trait the pool must have used - with
// "@foundation" standing for the caster's own Foundation trait, whatever their
// fellowship calls it. Unmet gates skip SILENTLY, as passives do.
function afflictionRollExtra(char: PlayableCharacter, active: ActiveAffliction[], poolTraits: string[], tags: string[]): { extra: Partial<RollModifier>; notes: string[] } {
  const extra: Partial<RollModifier> = {};
  const notes: string[] = [];
  const awakened = isAwakened(char.templates);
  const foundation = resolveFoundation(undefined, (n: string) => resolveTraitFromRecord(char, n)).trait;
  for (const inst of active) {
    const def = AfflictionRegistry.get(inst.def);
    if (!def?.tiers?.length) continue;
    if (def.requiresAwakened && !awakened) continue;
    const rating = def.scalesWith ? effectiveTraitOf(char, def.scalesWith) : 0;
    if (def.scalesWith && rating <= 0) continue;
    for (const op of foldAfflictionTiers(rating, def.tiers).ops) {
      const kind = op.op.toLowerCase();
      const amount = op.amount ?? 1;
      const patch = rollOpPatch(kind, amount);
      if (!patch) continue;
      if (op.target && !tags.includes(StringUtil.normalize(op.target))) continue;
      if (op.trait) {
        const wanted = StringUtil.normalize(op.trait) === "@foundation" ? foundation : StringUtil.normalize(op.trait);
        if (!poolTraits.includes(wanted)) continue;
      }
      mergeRollExtra(extra, patch);
      notes.push(`${inst.def}${def.scalesWith ? ` ${rating}` : ""}: ${kind} ${amount > 0 ? "+" : ""}${amount}`);
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
    if (hits.length === 0) return { note: `no specialty "${ref}" (see [[show-specialty]])` };
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
// A table REF -> the table, or the note explaining why not. Both readers below
// need exactly this, and a reading that quietly used the wrong table would be
// worse than one that says it cannot find it.
async function lookupTable(raw: string): Promise<{ table?: SuccessTable; note?: string }> {
  const ref = await resolveTableRef(raw);
  if (ref.error) return { note: ref.error };
  const table = SuccessTableRegistry.get(ref.key!);
  return table ? { table } : { note: `unknown table "${ref.key}" (see [[show-table]])` };
}

async function tableNote(raw: string | undefined, outcome: RollOutcomeKind, successes: number): Promise<string> {
  if (!raw) return "";
  const { table, note } = await lookupTable(raw);
  if (!table) return note!;
  return `${table.name}: ${describeTableReading(readSuccessTable(table, outcome, successes))}`;
}

// Table reading for an EXTENDED interval. A value-per-success table (climbing:
// 10 ft/success) reports the ACCUMULATED total - "how far the whole action has
// gone", the distance climbed so far - because that is the point of an extended
// action: the climb ends when you have climbed the entire distance. Qualitative
// tables (degrees) still read this interval's own net, since each interval has
// its own quality. When the pool is empty (nothing banked, or a botch reset it)
// the value branch falls back to this interval's outcome flavour.
async function extendedTableNote(raw: string | undefined, outcome: RollOutcomeKind, net: number, accumulated: number): Promise<string> {
  if (!raw) return "";
  const { table, note } = await lookupTable(raw);
  if (!table) return note!;
  if (table.valuePerSuccess !== undefined && accumulated > 0) {
    return `${table.name}: ${describeTableReading(readSuccessTable(table, "success", accumulated))} so far`;
  }
  return `${table.name}: ${describeTableReading(readSuccessTable(table, outcome, net))}`;
}

// Execute ONE roll for a character with the full live env - the shared path for
// extended intervals so they respect the SAME modifiers a single roll does:
// active affliction tags bite, enhancements/boosts fold into the resolver, the
// wound penalty comes off the pool, and owned passive roll-ops apply (gated by
// the pool's traits AND the roll's tags - this is how a `climb` tag lets a
// grip power's `-2 difficulty` reach an extended climb). No spend/specialty
// here - those are single-roll concerns.
async function execCharacterRoll(char: PlayableCharacter, spec: RollSpec, ctx: CommandContext, seed?: Partial<RollModifier>): Promise<{ exec: RollExecution; notes: string[] }> {
  const tagged = await withAfflictionTags(char.name, spec);
  const poolTraits = poolTraitsOf(char, tagged.pool);
  const env = await characterRollEnv(char);
  const passive = passiveRollExtra(char, poolTraits, tagged.tags, env.resourceAt, await CharacterAfflictions.ops(char.name));
  const place = afflictionRollExtra(char, await CharacterAfflictions.list(char.name), poolTraits, tagged.tags);
  const extra = mergeRollExtra({ ...(seed ?? {}) }, passive.extra, place.extra);
  if (env.penalty !== 0) extra.diceMod = (extra.diceMod ?? 0) + env.penalty;
  const shieldNote = applyPenaltyShield(env.rollAs, poolTraits, tagged.diceMod, extra);
  const exec = runRoll(tagged, env.resolver, { rng: ctx.rng, extra, usedTags: passive.usedTags });
  const notes = [...passive.notes, ...place.notes, env.penalty !== 0 ? `wound penalty ${env.penalty}` : "", shieldNote].filter(Boolean);
  return { exec, notes };
}

// Start an extended action and roll its first interval as `char`. THE one
// launcher - used by [[extended-roll]] and by invoking a saved extended roll.
// `base.requires` is forced to 1 by callers (each interval is a plain roll; the
// accumulated `target` is the extended goal). Reads `table` against the
// interval's net so each report shows what the successes MEAN (10 ft/success).
async function launchExtended(char: PlayableCharacter, base: RollSpec, opts: { target: number; maxRolls: number; interval: string; onBotch: BotchPolicy; label: string; table?: string; stepsTail?: string; firstExtra?: Partial<RollModifier>; preNotes?: string[] }, ctx: CommandContext): Promise<string> {
  const action: ExtendedRoll = {
    id: api.v1.uuid(), label: opts.label,
    base, target: opts.target, maxRolls: opts.maxRolls,
    interval: opts.interval, onBotch: opts.onBotch, table: opts.table,
    accumulated: 0, rollsUsed: 0, status: "open", log: [],
  };
  const { exec, notes } = await execCharacterRoll(char, base, ctx, opts.firstExtra);
  const { action: after, note } = applyInterval(action, exec, char.name);
  await ExtendedRollStore.save(after);
  if (after.status === "open") await ExtendedRollStore.setCurrent(after.id);
  const extras = [...(opts.preNotes ?? []), ...notes, await extendedTableNote(after.table, exec.outcome, exec.result?.net ?? 0, after.accumulated)].filter(Boolean).join("; ");
  const tail = after.status === "open" ? ` Continue with [[continue-roll]] (id ${after.id}).` : "";
  return sys(`${disp(char.name)} starts extended ${describeExtended(after)}. Interval 1: ${note}${extras ? ` (${extras})` : ""}.${tail}${opts.stepsTail ?? ""}`);
}

// Invoke a saved EXTENDED roll: the save holds the shape (pool, difficulty,
// tags, table, botch/interval defaults); the TARGET and any overrides come at
// play time. `requires=`/`target=` is the accumulated goal (the full climb).
async function launchExtendedFromSaved(char: PlayableCharacter, name: string, saved: SavedRoll, cmd: ParsedCommand, args: Partial<RollSpec>, ctx: CommandContext): Promise<string> {
  const target = args.requires ?? intOrUndef(cmd.named["target"]);
  if (target === undefined || target < 1) {
    return sys(`"${name}" is an extended roll - give it a target, e.g. [[roll @${name} requires=4]] (the successes = the whole action; for climbing, wall height / ft-per-success).`);
  }
  const cfg = saved.extended ?? {};
  const maxRolls = intOrUndef(cmd.named["intervals"]) ?? cfg.intervals;
  if (maxRolls === undefined || maxRolls < 1) return sys(`"${name}" needs intervals=<max rolls> (its save defines none), e.g. [[roll @${name} requires=${target} intervals=6]].`);
  const onBotch = cmd.named["on-botch"] ? parseBotchPolicy(cmd.named["on-botch"]) : (cfg.onBotch ?? "fail");
  const base = overrideSpec(saved, { ...args, requires: 1 });   // each interval is a plain roll
  return launchExtended(char, base, {
    target, maxRolls, interval: cmd.named["interval"] ?? cfg.interval ?? "",
    onBotch, label: cmd.named["label"] ?? name, table: saved.table,
    stepsTail: surfaceSteps(saved.steps, undefined),
  }, ctx);
}

async function rollAndReport(char: PlayableCharacter, cmd: ParsedCommand, ctx: CommandContext, offset: number): Promise<string> {
  const args = extractRollArgs(cmd, offset);
  if (!args.pool) return sys(`roll needs a pool, e.g. [[roll strength+brawl]] or a saved [[roll @name]].`);
  let spec: RollSpec;
  let savedSpend: string | undefined;
  let savedSpendAmount: number | undefined;
  let savedSpecialty: string | undefined;
  let savedTable: string | undefined;
  let savedSteps: ProcedureStep[] | undefined;
  if (args.pool.startsWith("@")) {
    // Saved roll: load the base spec, then apply the supplied overrides (pool is
    // never overridden, so passing `args` straight through to overrideSpec is safe).
    const name = StringUtil.normalize(args.pool.slice(1));
    const base = await NamedRollStore.get(name);
    if (!base) return sys(`No saved roll named "${name}". Try [[show-roll]] or [[name-roll ${name} <pool> ...]].`);
    // A saved EXTENDED roll (a "named procedure") launches an extended action
    // instead of a single roll - the target is play-time input, not baked in.
    // An OPPOSED saved roll launches a contest; an EXTENDED one an extended
    // action. Both take play-time input (vs= / requires=) the save never bakes.
    if (base.opposed) return launchOpposedFromSaved(char, name, base, cmd, args, ctx);
    if (base.extended) return launchExtendedFromSaved(char, name, base, cmd, args, ctx);
    savedSpend = base.spend;         // auto-paid unless the command overrides spend=
    savedSpendAmount = base.spendAmount;
    savedSpecialty = base.specialty; // auto-applied unless the command overrides specialty=
    savedTable = base.table;         // read against the outcome unless table= overrides
    savedSteps = base.steps;         // a procedure's follow-ups, surfaced after the entry roll
    spec = overrideSpec(base, args);
  } else {
    spec = makeRollSpec({ ...args, pool: args.pool });
  }
  // Active afflictions bite: their tags join the roll, firing any registered
  // RollModifiers (unregistered ones surface as the usual unknown-tag note).
  spec = await withAfflictionTags(char.name, spec);
  const poolTraits = poolTraitsOf(char, spec.pool);
  const spend = await applySpend(char, cmd, ctx, spec.tags, poolTraits, savedSpend, savedSpendAmount);
  if (spend.refuse) return sys(`${disp(char.name)} can't: ${spend.refuse}.`);
  // Rolls see live state: enhancements + boosts add to the record's dots, the
  // wound penalty (negative) comes off the dice pool, owned passives (Trait
  // Affinity et al.) fold in, and at most one specialty grants its die.
  const env = await characterRollEnv(char);
  const passive = passiveRollExtra(char, poolTraits, spec.tags, env.resourceAt, await CharacterAfflictions.ops(char.name));
  const place = afflictionRollExtra(char, await CharacterAfflictions.list(char.name), poolTraits, spec.tags);
  const specialtyRef = cmd.named["specialty"] ?? savedSpecialty;
  const specialty = specialtyRef ? resolveSpecialty(char, specialtyRef, poolTraits) : { note: "" };
  const extra = mergeRollExtra({ ...(spend.extra ?? {}) }, passive.extra, place.extra, specialty.extra ?? {});
  if (env.penalty !== 0) extra.diceMod = (extra.diceMod ?? 0) + env.penalty;
  const shieldNote = applyPenaltyShield(env.rollAs, poolTraits, spec.diceMod, extra);
  const exec = runRoll(spec, env.resolver, { rng: ctx.rng, extra, usedTags: passive.usedTags });
  // The roll HAPPENED, so anything counting rolls counts this one - after the
  // dice, because a charge buys the roll it was spent on.
  const charges = await spendAfflictionCharges(char.name, spec.tags, poolTraits);
  const notes = [
    spend.note,
    ...passive.notes,
    ...place.notes,
    specialty.note,
    env.penalty !== 0 ? `wound penalty ${env.penalty}` : "",
    shieldNote,
    ...charges,
    await tableNote(cmd.named["table"] ?? savedTable, exec.outcome, exec.result?.net ?? 0),
  ].filter(Boolean).join("; ");
  return sys(`${disp(char.name)} - ${formatExecution(exec)}${notes ? ` - ${notes}` : ""}${surfaceSteps(savedSteps, exec.outcome)}`);
}

async function cmdRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
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
    saved.opposed ? describeOpposedSaved(saved.opposed) : "",
    saved.extended ? describeExtendedSaved(saved.extended) : "",
    saved.steps && saved.steps.length ? `[${saved.steps.length}-step procedure]` : "",
    saved.spend ? `spend=${saved.spend}${saved.spendAmount && saved.spendAmount > 1 ? ` x${saved.spendAmount}` : ""}` : "",
    saved.specialty ? `specialty=${saved.specialty}` : "",
    saved.table ? `table=${saved.table}` : "",
  ].filter(Boolean).join(", ");
}

// The extended shape of a saved procedure (its defaults; the target is play-time).
function describeExtendedSaved(cfg: ExtendedSavedConfig): string {
  const bits = ["extended"];
  if (cfg.intervals !== undefined) bits.push(`≤${cfg.intervals} rolls`);
  if (cfg.interval) bits.push(`every ${cfg.interval}`);
  if (cfg.onBotch) bits.push(`botch ${cfg.onBotch}`);
  return `[${bits.join(", ")}]`;
}

// The opposed shape of a saved roll (the opponent is play-time input via vs=).
function describeOpposedSaved(cfg: OpposedSavedConfig): string {
  const bits = [cfg.extended ? `extended-${cfg.mode}` : cfg.mode];
  bits.push(`vs ${cfg.pool ?? "same pool"}`);
  if (cfg.vsDifficulty !== undefined) bits.push(`their diff ${cfg.vsDifficulty}`);
  if (cfg.extended?.intervals !== undefined) bits.push(`≤${cfg.extended.intervals} rounds`);
  return `[opposed: ${bits.join(", ")}]`;
}

// A procedure's follow-up steps, surfaced after the entry roll as runnable next
// command(s). Advisory: only the steps whose `when` matches the entry's outcome
// are shown (all of them when the outcome is unknown, e.g. an extended entry);
// the Storyteller/player picks and runs the branch.
function surfaceSteps(steps: ProcedureStep[] | undefined, outcome: RollOutcomeKind | undefined): string {
  if (!steps || !steps.length) return "";
  const matches = (w: ProcedureCondition): boolean =>
    w === "always" || outcome === undefined ||
    (w === "on-success" && outcome === "success") ||
    (w === "on-fail" && outcome === "failure") ||
    (w === "on-botch" && outcome === "botch");
  const shown = steps.filter(s => matches(s.when));
  if (!shown.length) return "";
  const items = shown.map(s => `${s.when} -> [[roll ${s.roll}]]${s.note ? ` (${s.note})` : ""}`).join("; ");
  return ` Next: ${items}.`;
}

// A procedure's full step list (for [[show-roll]]) - every step, condition first.
function describeSteps(steps: ProcedureStep[]): string {
  return steps.map((s, i) => `${i + 1}. ${s.when}: [[roll ${s.roll}]]${s.note ? ` - ${s.note}` : ""}`).join("; ");
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
  const description = cmd.named["description"]?.trim();   // literal channel: verbatim prose
  const saved: SavedRoll = { ...spec };
  if (spend) saved.spend = spend;
  const spendAmount = intOrUndef(cmd.named["spend-amount"]);
  if (spend && spendAmount !== undefined && spendAmount > 1) saved.spendAmount = spendAmount;
  if (specialty) saved.specialty = specialty;
  if (table) saved.table = table;
  if (description) saved.description = description;
  // A "named procedure": extended=true (or any extended knob) makes invoking it
  // launch an extended action; the target stays play-time input.
  const intervals = intOrUndef(cmd.named["intervals"]);
  const interval = cmd.named["interval"]?.trim();
  const onBotchRaw = cmd.named["on-botch"]?.trim();
  const extendedFlag = flagOf(cmd, "extended") === true;
  if (extendedFlag || intervals !== undefined || interval || onBotchRaw) {
    const cfg: ExtendedSavedConfig = {};
    if (intervals !== undefined) cfg.intervals = intervals;
    if (interval) cfg.interval = interval;
    if (onBotchRaw) cfg.onBotch = parseBotchPolicy(onBotchRaw);
    saved.extended = cfg;
  }
  // An OPPOSED saved roll: invoking launches a contest (the opponent is play-time
  // vs=). opposed + the extended knobs above = an extended contest (a race, e.g.
  // Pursuit) - the extended cfg rides on opposed so the top-level branch is clean.
  const opposedRaw = cmd.named["opposed"]?.trim().toLowerCase();
  if (opposedRaw === "resisted" || opposedRaw === "contested") {
    const opp: OpposedSavedConfig = { mode: opposedRaw };
    const vsPool = cmd.named["vs-pool"]?.trim();
    const vsDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
    if (vsPool) opp.pool = vsPool;
    if (vsDiff !== undefined) opp.vsDifficulty = vsDiff;
    if (saved.extended) { opp.extended = saved.extended; delete saved.extended; }
    saved.opposed = opp;
  }
  await NamedRollStore.save(name, saved);
  const key = StringUtil.normalize(name);
  const sidecars = describeSidecars(saved);
  const descBit = saved.description ? " (+description)" : "";
  return sys(`Saved roll "${key}" = ${describeSpec(spec)}${sidecars ? `, ${sidecars}` : ""}${descBit}. Use it with ${invokeHint(key, saved)}.`);
}

// The invocation hint for a saved roll: opposed rolls need vs=<opponent>; extended
// rolls (and extended contests) need requires=<target>; a plain roll needs neither.
function invokeHint(key: string, saved: SavedRoll): string {
  const bits: string[] = [];
  if (saved.opposed) bits.push(`vs="<opponent>"`);
  if (saved.extended || saved.opposed?.extended) bits.push(`requires=<target>`);
  return `[[roll @${key}${bits.length ? ` ${bits.join(" ")}` : ""}]]`;
}

async function cmdListRolls(): Promise<string> {
  const map = await NamedRollStore.all();
  const names = Object.keys(map);
  if (!names.length) return sys(`No saved rolls yet. Save one with [[name-roll <name> <pool> ...]].`);
  const items = names.map(n => {
    const sidecars = describeSidecars(map[n]);
    return `${n} (${describeSpec(map[n])}${sidecars ? `, ${sidecars}` : ""})`;
  }).join("; ");
  return sys(`Saved rolls: ${items}. [[show-roll <name>]] for detail.`);
}

// Full detail of one saved roll: spec, sidecars, and the rules description.
async function cmdRollInfo(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`roll-info needs a name, e.g. [[show-roll climbing]]. [[show-roll]] lists them.`);
  // "@name" is how a roll is INVOKED, so accept it here too rather than
  // refusing the spelling the player just used.
  const key = StringUtil.normalize(name.startsWith("@") ? name.slice(1) : name);
  const saved = await NamedRollStore.get(key);
  if (!saved) return sys(`No saved roll named "${key}". See [[show-roll]].`);
  const sidecars = describeSidecars(saved);
  const parts = [`${key} = ${describeSpec(saved)}${sidecars ? `, ${sidecars}` : ""}`];
  if (saved.description) parts.push(saved.description);
  if (saved.steps && saved.steps.length) parts.push(`Steps: ${describeSteps(saved.steps)}`);
  parts.push(`Invoke: ${invokeHint(key, saved)}`);
  // Join as sentences without doubling a period a part already ends with
  // (the description is verbatim prose and usually ends in one).
  return sys(parts.map(p => p.replace(/\.\s*$/, "")).join(". "));
}

// Append a follow-up step to a saved procedure (its entry must already exist as a
// saved roll). Steps compose named rolls: each is [when -> @follow-up (note)].
async function cmdAddStep(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`add-step needs a procedure name, e.g. [[add-step bribery when=on-success roll=@bribery-convince note=\`convince the official\`]].`);
  const key = StringUtil.normalize(name);
  const saved = await NamedRollStore.get(key);
  if (!saved) return sys(`No saved roll named "${key}" to add a step to - save its entry first with [[name-roll ${key} <pool> ...]].`);
  const whenRaw = (cmd.named["when"] ?? "always").trim().toLowerCase();
  const when = (["always", "on-success", "on-fail", "on-botch"].includes(whenRaw) ? whenRaw : "always") as ProcedureCondition;
  let roll = cmd.named["roll"]?.trim();
  if (!roll) return sys(`add-step needs roll=@<saved-roll> (the follow-up to run), e.g. [[add-step ${key} when=${when} roll=@grab-ledge]].`);
  if (!roll.startsWith("@")) roll = `@${StringUtil.normalize(roll)}`;
  const note = cmd.named["note"]?.trim();
  const step: ProcedureStep = { when, roll };
  if (note) step.note = note;
  saved.steps = [...(saved.steps ?? []), step];
  await NamedRollStore.save(key, saved);
  return sys(`Added step ${saved.steps.length} to "${key}": ${when} -> [[roll ${roll}]]${note ? ` (${note})` : ""}. Now a ${saved.steps.length}-step procedure - [[show-roll ${key}]] for the whole sequence.`);
}

// Drop all follow-up steps from a saved procedure (its entry roll is untouched).
async function cmdClearSteps(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`clear-steps needs a procedure name, e.g. [[clear-steps bribery]].`);
  const key = StringUtil.normalize(name);
  const saved = await NamedRollStore.get(key);
  if (!saved) return sys(`No saved roll named "${key}".`);
  const had = saved.steps?.length ?? 0;
  if (!had) return sys(`"${key}" has no steps to clear.`);
  delete saved.steps;
  await NamedRollStore.save(key, saved);
  return sys(`Cleared ${had} step${had === 1 ? "" : "s"} from "${key}".`);
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
  const o: Partial<RollSpec> = {};
  const diffRaw = cmd.named["difficulty"]?.trim();
  if (diffRaw) {
    if (/^-?\d+$/.test(diffRaw)) o.difficulty = parseInt(diffRaw, 10);
    else o.difficultyExpr = diffRaw;
  }
  const difficultyMod = intOrUndef(cmd.named["difficulty-modifier"] ?? cmd.named["diff-mod"]);
  if (difficultyMod !== undefined) o.difficultyMod = difficultyMod;
  const diceMod = intOrUndef(cmd.named["dice-modifier"]);
  if (diceMod !== undefined) o.diceMod = diceMod;
  const minDifficulty = intOrUndef(cmd.named["min-difficulty"]);
  if (minDifficulty !== undefined) o.minDifficulty = minDifficulty;
  const autoSuccesses = intOrUndef(cmd.named["successes"] ?? cmd.named["auto"]);
  if (autoSuccesses !== undefined) o.autoSuccesses = autoSuccesses;
  const uncancelable = intOrUndef(cmd.named["uncancelable"] ?? cmd.named["sure"]);
  if (uncancelable !== undefined) o.uncancelableSuccesses = uncancelable;
  if (cmd.named["tags"] !== undefined) o.tags = cmd.named["tags"].split(",").map(t => t.trim()).filter(t => t.length > 0);
  return o;
}

// Start an extended action and roll its first interval as the current character.
async function cmdExtendedRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const args = extractRollArgs(cmd, 0);
  if (!args.pool) return sys(`extended-roll needs a pool, e.g. [[extended-roll strength+stamina requires=8 intervals=4]].`);
  if (args.pool.startsWith("@")) return sys(`extended-roll takes a pool expression (e.g. strength+stamina), not a saved @name - invoke a saved extended roll with [[roll @name requires=<target>]].`);
  const maxRolls = intOrUndef(cmd.named["intervals"]) ?? 0;
  if (maxRolls < 1) return sys(`extended-roll needs intervals=<max rolls> (at least 1).`);
  const base = makeRollSpec({ ...args, pool: args.pool, requires: 1 });   // each interval is a plain roll
  return launchExtended(char, base, {
    target: args.requires ?? 1,   // `requires=` is the accumulated target
    maxRolls, interval: cmd.named["interval"] ?? "",
    onBotch: parseBotchPolicy(cmd.named["on-botch"]),
    label: cmd.named["label"] ?? "", table: cmd.named["table"],
  }, ctx);
}

async function cmdContinueRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const action = await ExtendedRollStore.resolve(cmd.positional[0]);
  if (!action) return sys(`No open extended action. Start one with [[extended-roll ...]] or name its id.`);
  if (action.status !== "open") return sys(`That extended action is already ${action.status}.`);
  const spec = overrideSpec(action.base, rollOverridesFromNamed(cmd));
  const { exec, notes } = await execCharacterRoll(char, spec, ctx);
  const { action: after, note } = applyInterval(action, exec, char.name);
  await ExtendedRollStore.save(after);
  if (after.status !== "open" && (await ExtendedRollStore.currentId()) === after.id) await ExtendedRollStore.clearCurrent();
  const extras = [...notes, await extendedTableNote(after.table, exec.outcome, exec.result?.net ?? 0, after.accumulated)].filter(Boolean).join("; ");
  return sys(`${disp(char.name)} continues ${describeExtended(after)}. This interval: ${note}${extras ? ` (${extras})` : ""}.`);
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

async function cmdResources(forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const views = await CharacterResources.all(char);
  if (!views.length) return sys(`${disp(char.name)} has no resources.`);
  const uses = await EffectUses.counts(char);
  const items = views.map(v => {
    const roles = (v.def.roles ?? []).filter(r => StringUtil.normalize(r) !== StringUtil.normalize(v.def.name));
    // The per-turn limit may be an expression (Quintessence's is the Fount
    // ladder), so it is resolved for THIS character rather than printed raw.
    const perTurn = resourceNumbers(char, v.def).perTurn;
    const named = Object.keys(v.def.effects ?? {}).map(n => {
      const used = uses[`${StringUtil.normalize(v.def.name)}:${StringUtil.normalize(n)}`] ?? 0;
      return `${n}${used > 0 ? ` (used ${used})` : ""}`;
    });
    const meta = [
      v.def.replaces?.length ? `replaces: ${v.def.replaces.join("/")}` : "",
      roles.length ? `roles: ${roles.join("/")}` : "",
      perTurn !== undefined && Number.isFinite(perTurn) ? `${perTurn}/turn (ST)` : "",
      v.def.rollAs ? `pools as min(${v.def.rollAs.cap ?? "∞"}, current)${v.def.rollAs.negatesPenaltiesAbove !== undefined ? `; points over ${v.def.rollAs.negatesPenaltiesAbove} shield penalties` : ""}` : "",
      v.def.recovery?.length ? `recovers ${v.def.recovery.map(r => `${r.amount}/${r.per}${r.requires ? ` if ${(Array.isArray(r.requires) ? r.requires : [r.requires]).join("+")}` : ""}`).join(", ")}` : "",
      v.def.effect ? describeEffect(v.def.effect) : "",
      named.length ? `spend:${named.join("/")}` : "",
    ].filter(Boolean).join("; ");
    const blurb = v.def.description ? ` - ${v.def.description}` : "";
    // Points he holds and cannot burn. Said first, because it is the only thing
    // about that pool that matters until it changes.
    const inert = v.blocked.length ? ` ⚠ held but UNUSABLE (needs ${v.blocked.join(", ")}; [[attune]])` : "";
    return `${v.def.name} ${v.current}/${v.max}${inert}${meta ? ` (${meta})` : ""}${blurb}`;
  }).join("; ");
  return sys(`${disp(char.name)} resources - ${items}.`);
}

// attune [<capability>] [off] - what this character can actually USE. A pool is
// a thing you hold; using it is a thing you are able to do, and the two come
// apart the moment an object hands someone a Resolve pool he cannot channel.
async function cmdAttune(cmd: ParsedCommand, forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const raw = (cmd.named["capability"] ?? cmd.positional[0])?.trim();
  const fromTemplates = char.templates.flatMap(t => TEMPLATES[StringUtil.normalize(t)]?.Capabilities ?? []);
  if (!raw) {
    const own = (char.capabilities ?? []).filter(c => !fromTemplates.includes(c));
    const held = CharacterResources.capabilities(char);
    const views = await CharacterResources.all(char);
    const inert = views.filter(v => v.blocked.length).map(v => `${v.def.name} (needs ${v.blocked.join(", ")})`);
    return sys(`${disp(char.name)} can use: ${held.length ? held.join(", ") : "nothing in particular"}`
      + `${own.length ? ` (attuned: ${own.join(", ")})` : ""}. `
      + `${inert.length ? `Held and unusable: ${inert.join(", ")}. ` : ""}`
      + `Known: ${Object.entries(CAPABILITIES).map(([k, v]) => `${k} - ${v}`).join("; ")}. `
      + `[[attune <capability>]] grants one; [[attune <capability> off]] takes it back.`);
  }
  const capability = StringUtil.normalize(raw);
  const off = ["off", "no", "remove"].includes(StringUtil.normalize(cmd.positional[1] ?? cmd.named["off"] ?? ""));
  if (off) {
    if (fromTemplates.includes(capability)) {
      return sys(`${disp(char.name)} has "${capability}" from ${char.templates.join("+")} itself - `
        + `a sheet cannot take back what the template is. Change the template instead.`);
    }
    char.capabilities = (char.capabilities ?? []).filter(c => c !== capability);
    if (!char.capabilities.length) delete char.capabilities;
    await CharacterStore.save(char);
    return sys(`${disp(char.name)} is no longer attuned to "${capability}".`);
  }
  char.capabilities = [...new Set([...(char.capabilities ?? []), capability])];
  await CharacterStore.save(char);
  const views = await CharacterResources.all(char);
  const freed = views.filter(v => (v.def.requires ?? []).map(r => StringUtil.normalize(r)).includes(capability) && !v.blocked.length);
  return sys(`${disp(char.name)} is attuned to "${capability}"`
    + `${capabilityNote(capability) ? ` - ${capabilityNote(capability)}` : " (the engine knows no rule for it; nothing requires it)"}`
    + `${freed.length ? `. He can now spend ${freed.map(v => v.def.name).join(", ")}` : ""}.`);
}

// =============================================================================
// MAGIC - the Dark Ages: Mage casting procedure ([[cast]], [[seal-spell]])
// -----------------------------------------------------------------------------
// The numbers all come from MagicRules (rules.ts defaults overlaid with the
// wod:config:magic knob entry). Foundation and Pillar RATINGS live on the
// character (the free `traits` bucket; foundation= names the trait when the
// fellowship calls it something else); the REQUIRED levels are what the desired
// effect needs - play-time input, per pillar, never baked anywhere.
// =============================================================================
interface PillarReq { name: string; required: number; own: number }

// A trait the sheet ought to have but reads as 0 is USUALLY a lorebook edit
// that never synced: the pc: cards are only read back while creator mode is on
// (§7.20 - the router won't re-read the lorebook on every command). Say so
// where the player hits it, not just in the docs.
async function staleSheetHint(): Promise<string> {
  return (await CreatorMode.enabled())
    ? ` ([[show-sheet]] shows what the engine has.)`
    : ` If you just edited the sheet in the lorebook, it has NOT synced yet - `
      + `[[creator-mode set=true]] pulls it in on the next command ([[show-sheet]] shows what the engine has).`;
}

// "warrior:4,chieftain:2" -> requirements, with the caster's own ratings.
function parsePillars(raw: string, resolve: (n: string) => number): PillarReq[] | { error: string } {
  const out: PillarReq[] = [];
  for (const item of raw.split(",").map(s => s.trim()).filter(s => s.length > 0)) {
    const m = item.match(/^(.+?)[:=]\s*(\d+)$/);
    if (!m) return { error: `Can't read pillar "${item}" - use name:required-level (e.g. incantation:3).` };
    const name = StringUtil.normalize(m[1]);
    const required = parseInt(m[2], 10);
    if (required < 1) return { error: `Pillar level must be at least 1 in "${item}".` };
    out.push({ name, required, own: resolve(name) });
  }
  return out;
}

// Does spending this resource carry the fused-Willpower rider? (Living Resolve:
// any spend grants ONE un-cancelable success when a dice pool is involved.)
function grantsUncancelableOnSpend(def: ResourceDef): boolean {
  const specs = [def.effect, ...Object.values(def.effects ?? {})].filter((e): e is EffectSpec => !!e);
  return specs.some(e => e.apply.some(o => o.op.toLowerCase() === "uncancelable"));
}

// What `points` of the fused substance pay, read straight off the resource's
// default effect - so re-tuning the def moves the casting maths with it.
// The one rule that isn't a plain sum: a point lowers the difficulty ONCE, by
// the DEEPEST break any of its natures gives. Resolve's -2 and the
// Quintessence's -1 are the same break seen from two sides, not two breaks to
// add (the owner's ruling), so they are folded by depth, never summed.
// Successes are NOT the same: the Resolve's automatic success and the
// Willpower's un-cancelable one are different things and both land.
function fusedComponentExtra(def: ResourceDef, points: number, uncancelableLimit: number, tags: string[]): { extra: Partial<RollModifier>; bits: string[] } {
  const extra: Partial<RollModifier> = {};
  const bits: string[] = [];
  let deepest = 0;
  for (const op of def.effect?.apply ?? []) {
    // An op aimed at an action tag counts only when this roll carries it.
    if (op.target && !op.target.split(",").map(t => StringUtil.normalize(t)).some(t => tags.includes(t))) continue;
    const kind = op.op.toLowerCase();
    const total = (op.amount ?? 1) * points;
    if (kind === "difficulty") { deepest = Math.min(deepest, op.amount ?? 0); }
    else if (kind === "successes") { extra.autoSuccesses = (extra.autoSuccesses ?? 0) + total; bits.push(`+${total} automatic success${total === 1 ? "" : "es"}`); }
    else if (kind === "uncancelable") {
      const capped = Math.min(total, uncancelableLimit);
      extra.uncancelableSuccesses = (extra.uncancelableSuccesses ?? 0) + capped;
      bits.push(`${capped} un-cancelable success${capped === 1 ? "" : "es"}${total > capped ? ` (capped at ${uncancelableLimit})` : ""}`);
    } else if (kind === "nagain") {
      extra.nAgain = Math.min(extra.nAgain ?? 10, op.amount ?? 10);
      bits.push(`${op.amount ?? 10}-again`);
    }
  }
  if (deepest < 0) {
    extra.difficultyMod = (extra.difficultyMod ?? 0) + deepest * points;
    bits.push(`${deepest * points} difficulty`);
  }
  return { extra, bits };
}

// Which trait is this caster's Foundation? An explicit foundation= wins; else a
// literal "foundation" trait; else the first FELLOWSHIPS entry whose Foundation
// trait the caster actually has (Order of Hermes -> Modus). Returns the trait
// name plus the fellowship it came from, when that's how it was found.
function resolveFoundation(arg: string | undefined, resolve: (n: string) => number, chosen?: string): { trait: string; rating: number; fellowship?: string } {
  if (arg?.trim()) { const t = StringUtil.normalize(arg); return { trait: t, rating: resolve(t) }; }
  // A character who CHOSE a fellowship casts on its Foundation, whatever else
  // they happen to have a rating in.
  const picked = chosen ? fellowshipByName(chosen) : undefined;
  if (picked) {
    const t = StringUtil.normalize(picked.foundation);
    return { trait: t, rating: resolve(t), fellowship: picked.name };
  }
  if (resolve("foundation") > 0) return { trait: "foundation", rating: resolve("foundation") };
  for (const f of Object.values(FELLOWSHIPS)) {
    const t = StringUtil.normalize(f.foundation);
    if (resolve(t) > 0) return { trait: t, rating: resolve(t), fellowship: f.name };
  }
  return { trait: "foundation", rating: 0 };
}

async function cmdCast(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const rules = magicRulesFrom(MagicRulesConfig.current());

  const pillarsRaw = (cmd.named["pillars"] ?? cmd.positional[0])?.trim();
  if (!pillarsRaw) {
    return sys(`cast needs the required pillars, e.g. [[cast pillars="incantation:3"]] (simple) or [[cast pillars="warrior:4,chieftain:2"]] (complex). `
      + `Knobs: foundation=<trait> quintessence=N label=... requires=N extended=true interval="..." ongoing=true spend=...`);
  }
  const env = await characterRollEnv(char);
  const pillars = parsePillars(pillarsRaw, env.resolver);
  if ("error" in pillars) return sys(pillars.error);

  // The caster must know each Pillar at the required level...
  for (const p of pillars) {
    if (p.own < p.required) {
      return sys(`${disp(char.name)} has ${disp(p.name)} ${p.own} - the effect needs ${p.required}. `
        + `The spell is beyond their teaching.${await staleSheetHint()}`);
    }
  }
  // ...and have a Foundation to channel it through (their fellowship's, when
  // the sheet carries it - Order of Hermes casts on Modus).
  const found = resolveFoundation(cmd.named["foundation"], env.resolver, char.choices?.["fellowship"]);
  const foundationTrait = found.trait;
  const foundationRating = env.resolver(foundationTrait);
  if (foundationRating <= 0) {
    const known = Object.values(FELLOWSHIPS).map(f => `${disp(f.foundation)} (${f.name})`).join(", ");
    return sys(`${disp(char.name)} has no ${disp(foundationTrait)} rating. Put the Foundation in the sheet's traits bucket `
      + `(e.g. "modus": 3) or name it with foundation=<trait>. Known fellowships: ${known}.${await staleSheetHint()}`);
  }

  // The primary Pillar is the highest REQUIRED one (ties: the caster adds their
  // best score, per the book). Complex spells add 1 die and +1 difficulty per
  // additional Pillar.
  const sorted = [...pillars].sort((a, b) => b.required - a.required || b.own - a.own);
  const primary = sorted[0];
  const extras = pillars.length - 1;
  const complex = extras > 0;
  const pool = complex ? `${foundationTrait}+${primary.name}+${extras}` : `${foundationTrait}+${primary.name}`;
  let difficulty = complex ? rules.complexBase + primary.required + extras : rules.simpleBase + primary.required;
  const notes: string[] = [
    complex
      ? `complex spell: diff ${rules.complexBase}+${primary.required}+${extras} = ${difficulty}`
      : `simple spell: diff ${rules.simpleBase}+${primary.required} = ${difficulty}`,
  ];

  // Same-scene retries pile difficulty on: +1 per prior unsuccessful casting,
  // or +2 per prior attempt once one of them BOTCHED.
  const sceneName = (await SceneStore.currentName()) ?? "";
  const label = cmd.named["label"]?.trim() ?? "";
  const spellKey = label || pillars.map(p => `${p.name}:${p.required}`).join(",");
  const rec = await CastAttempts.get(char, sceneName, spellKey);
  if (rec.unsuccessful > 0) {
    const per = rec.botched ? rules.botchRetryPenalty : rules.retryPenalty;
    const penalty = per * rec.unsuccessful;
    difficulty += penalty;
    notes.push(`retry this scene: +${penalty} difficulty (${rec.unsuccessful} prior attempt${rec.unsuccessful === 1 ? "" : "s"}${rec.botched ? ", one botched" : ""})`);
  }

  // Quintessence: MANDATORY point when the effect outstrips the Foundation
  // (stabilization - no difficulty break), plus optional extra points at -1
  // difficulty each, all within the per-turn cap and the difficulty floor.
  const seed: Partial<RollModifier> = {};
  const castTags = [...CASTING_TAGS];
  const mandatory = primary.required > foundationRating ? 1 : 0;
  const requested = Math.max(0, intOrUndef(cmd.named["quintessence"] ?? cmd.named["quint"]) ?? 0);
  const fuelDef = CharacterResources.resolveDef(char, "magic-fuel");
  if (mandatory > 0 && !fuelDef) {
    return sys(`${disp(char.name)} can't cast: the effect (${disp(primary.name)} ${primary.required}) outstrips ${disp(foundationTrait)} ${foundationRating}, and casting then REQUIRES a point of Quintessence - but they have no magic-fuel resource.`);
  }
  // A FUSED point is never wasted at the Quintessence floor: its Willpower and
  // Resolve still have work to do, so only the per-turn cap and the pool bind,
  // and its whole break comes from the rider below. ORDINARY Quintessence has
  // nothing else to give, so only points that actually lower the difficulty
  // leave the pool - and they are the ones that lower it.
  const fused = !!fuelDef && grantsUncancelableOnSpend(fuelDef);
  let optional = Math.max(0, Math.min(requested, rules.quintPerTurn - mandatory));
  if (!fused) optional = Math.min(optional, Math.max(0, difficulty - rules.minDifficulty));
  if (fuelDef && (mandatory > 0 || optional > 0)) {
    const have = await CharacterResources.current(char, fuelDef);
    if (have < mandatory) {
      return sys(`${disp(char.name)} can't cast: ${disp(primary.name)} ${primary.required} outstrips ${disp(foundationTrait)} ${foundationRating}, so casting REQUIRES 1 ${fuelDef.name} - they have ${have}.`);
    }
    optional = Math.min(optional, have - mandatory);
    const total = mandatory + optional;
    if (total > 0) {
      await CharacterResources.spend(char, fuelDef.name, total);
      const bits: string[] = [];
      if (mandatory) bits.push(`1 to stabilize (${disp(primary.name)} ${primary.required} > ${disp(foundationTrait)} ${foundationRating})`);
      if (optional) bits.push(fused ? `${optional} more` : `${optional} for -${optional} difficulty`);
      notes.push(`${fuelDef.name}: ${bits.join(" + ")}`);
      if (optional < requested) {
        // Name the limiter that actually bound. The difficulty floor only stops
        // an ORDINARY Quintessence point - a fused one still has three other
        // components to pay, so it is spent regardless.
        const why = [`cap ${rules.quintPerTurn}/turn`, `pool ${have}`];
        if (!fused && difficulty - rules.minDifficulty < requested) why.unshift(`min diff ${rules.minDifficulty}`);
        notes.push(`only ${optional} of ${requested} points could be spent (${why.join(", ")})`);
      }
      if (total > rules.quintFreeLimit) notes.push(`spending >${rules.quintFreeLimit}/turn needs the Fount Background (ST)`);
      if (fused) {
        // Every point spent here IS a Quintessence and a Willpower and a Resolve
        // at once, so its whole payout comes from one place - including the
        // difficulty break, which is Resolve's rather than Resolve's plus the
        // Quintessence's. The mandatory point pays it too: it is the same
        // substance, not a fee taken off the top.
        const rider = fusedComponentExtra(fuelDef, total, uncancelableCap(foundationRating, rules), castTags);
        for (const [k, v] of Object.entries(rider.extra) as Array<[keyof RollModifier, number]>) {
          if (k === "nAgain") seed.nAgain = Math.min(seed.nAgain ?? 10, v);
          else (seed as Record<string, number>)[k] = ((seed as Record<string, number>)[k] ?? 0) + v;
        }
        if (rider.bits.length) {
          notes.push(`all ${total} point${total === 1 ? "" : "s"} spend as Quintessence AND Willpower AND Resolve at once: ${rider.bits.join(", ")}`);
        }
      } else {
        difficulty -= optional;
      }
    }
  } else if (requested > 0 && !fuelDef) {
    notes.push(`no magic-fuel resource - the requested Quintessence reduction is skipped`);
  }

  // The spell's roll: over the cap, difficulty converts to extra required
  // successes (resolveSpec notes it); reductions buy those off first.
  const requires = Math.max(1, intOrUndef(cmd.named["requires"]) ?? 1);
  const ongoing = flagOf(cmd, "ongoing") === true;
  const extended = ongoing || flagOf(cmd, "extended") === true;
  const spec = makeRollSpec({
    pool, difficulty, requires: extended ? 1 : requires,
    tags: castTags, difficultyCap: rules.difficultyCap,
  });

  // spend= rides along (Living Resolve's focus/fuel-surge, a plain Willpower...).
  const poolTraits = poolTraitsOf(char, pool);
  const spend = await applySpend(char, cmd, ctx, spec.tags, poolTraits);
  if (spend.refuse) return sys(`${disp(char.name)} can't cast: ${spend.refuse}.`);
  if (spend.extra) {
    if (spend.extra.difficultyMod) seed.difficultyMod = (seed.difficultyMod ?? 0) + spend.extra.difficultyMod;
    if (spend.extra.diceMod) seed.diceMod = (seed.diceMod ?? 0) + spend.extra.diceMod;
    if (spend.extra.autoSuccesses) seed.autoSuccesses = (seed.autoSuccesses ?? 0) + spend.extra.autoSuccesses;
    if (spend.extra.uncancelableSuccesses) {
      // A spend= rider and the fuel's own grant are the same certainty - take
      // the larger, then let the Foundation cap stand.
      seed.uncancelableSuccesses = Math.min(
        uncancelableCap(foundationRating, rules),
        Math.max(seed.uncancelableSuccesses ?? 0, spend.extra.uncancelableSuccesses));
    }
    if (spend.extra.nAgain !== undefined) seed.nAgain = Math.min(seed.nAgain ?? 10, spend.extra.nAgain);
  }
  if (spend.note) notes.push(spend.note);

  const spellName = label ? `"${label}"` : `${pillars.map(p => `${disp(p.name)} ${p.required}`).join(" + ")}`;

  if (extended) {
    // Extended / ongoing: successes accrue over intervals; a botch ends the
    // casting (Backlash + every accrued success lost) unless on-botch says
    // otherwise. Ongoing spells need x10 successes and per-success fuel.
    const target = ongoing ? requires * rules.ongoingMultiplier : requires;
    if (!intOrUndef(cmd.named["requires"])) return sys(`An ${ongoing ? "ongoing" : "extended"} casting needs requires=N (the Storyteller's success total${ongoing ? ` - it is then ×${rules.ongoingMultiplier}` : ""}).`);
    if (ongoing) notes.push(`ongoing spell: ${requires}×${rules.ongoingMultiplier} = ${target} successes; fuel ${rules.ongoingFuelPerSuccess} magic-fuel per success as they land (ST-enforced); seal with [[seal-spell pillar=${primary.required}]] at the end`);
    const maxRolls = intOrUndef(cmd.named["intervals"]) ?? 20;
    return launchExtended(char, spec, {
      target, maxRolls,
      interval: cmd.named["interval"] ?? "",
      onBotch: parseBotchPolicy(cmd.named["on-botch"]),   // default "fail": a botch ends the casting
      label: label ? `cast: ${label}` : `cast: ${spellKey}`,
      firstExtra: seed, preNotes: notes,
      stepsTail: ` A botch is Backlash: successes lost, the Storyteller describes the price.`,
    }, ctx);
  }

  const { exec, notes: execNotes } = await execCharacterRoll(char, spec, ctx, seed);
  await CastAttempts.record(char, sceneName, spellKey, exec.outcome === "botch" ? "botch" : exec.outcome === "success" ? "success" : "failure");
  // In their own sanctum a mage is immune to Backlash at ANY rating - the spell
  // still fails utterly, but the power doesn't turn on them.
  const inSanctum = (await CharacterAfflictions.list(char.name)).some(a => a.def === "in-sanctum");
  const backlash = exec.outcome !== "botch" ? ""
    : inSanctum
      ? ` The spell fails utterly - but this is their sanctum: NO Backlash (retrying this scene: +${rules.botchRetryPenalty}/attempt).`
      : ` ⚡ BACKLASH - the spell fails utterly and the power turns on the caster (Storyteller describes; retrying this scene: +${rules.botchRetryPenalty}/attempt).`;
  const allNotes = [...notes, ...execNotes].filter(Boolean).join("; ");
  return sys(`${disp(char.name)} casts ${spellName} - ${formatExecution(exec)}${allNotes ? ` [${allNotes}]` : ""}.${backlash}`);
}

// The permanence seal on an ongoing spell: 5 Quintessence per dot of the
// highest Pillar involved + 1 Willpower per 10 of that Quintessence (rounded
// up). A fused payer (one resource filling both roles - Living Resolve) covers
// both components with the same points. pay=true spends now; otherwise the
// price is quoted, payable over time (ST tracks the debt).
async function cmdSealSpell(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const rules = magicRulesFrom(MagicRulesConfig.current());
  const level = parseInt(cmd.named["pillar"] ?? cmd.positional[0] ?? "", 10);
  if (Number.isNaN(level) || level < 1) return sys(`seal-spell needs the highest Pillar level involved, e.g. [[seal-spell pillar=3]].`);
  const sealQ = rules.sealPerPillarDot * level;
  const sealW = Math.ceil(sealQ / rules.sealWillpowerPer);
  const price = `${sealQ} Quintessence + ${sealW} Willpower (1 per ${rules.sealWillpowerPer}, rounded up)`;

  const fuelDef = CharacterResources.resolveDef(char, "magic-fuel");
  const willDef = CharacterResources.resolveDef(char, "willpower");
  const fused = fuelDef && willDef && StringUtil.normalize(fuelDef.name) === StringUtil.normalize(willDef.name);

  if (flagOf(cmd, "pay") !== true) {
    const how = fused ? ` ${fuelDef.name} is the fused substance - the same ${Math.max(sealQ, sealW)} points cover both components.` : "";
    return sys(`Sealing (highest Pillar ${level}): ${price}.${how} Payable over time (ST tracks the debt) - [[seal-spell pillar=${level} pay=true]] to spend now.`);
  }

  const linesOut: string[] = [];
  if (fused) {
    const cost = Math.max(sealQ, sealW);
    const { spent } = await CharacterResources.spend(char, fuelDef.name, cost);
    const now = await CharacterResources.current(char, fuelDef);
    linesOut.push(`${spent}/${cost} ${fuelDef.name} (the fused substance covers both components) -> ${now}/${resourceNumbers(char, fuelDef).max}`);
    if (spent < cost) linesOut.push(`${cost - spent} still owed - payable over time (ST tracks the debt)`);
  } else {
    if (fuelDef) {
      const { spent } = await CharacterResources.spend(char, fuelDef.name, sealQ);
      linesOut.push(`${spent}/${sealQ} ${fuelDef.name}${spent < sealQ ? ` (${sealQ - spent} owed)` : ""}`);
    } else linesOut.push(`no magic-fuel resource - ${sealQ} Quintessence owed (ST tracks)`);
    if (willDef) {
      const { spent } = await CharacterResources.spend(char, willDef.name, sealW);
      linesOut.push(`${spent}/${sealW} ${willDef.name}${spent < sealW ? ` (${sealW - spent} owed)` : ""}`);
    } else linesOut.push(`no willpower resource - ${sealW} Willpower owed (ST tracks)`);
  }
  return sys(`${disp(char.name)} seals the spell (highest Pillar ${level}; ${price}): ${linesOut.join("; ")}.`);
}

// The fellowships the engine knows: their Foundation and Pillars, so a caster
// can see what [[cast]] expects in the sheet's traits bucket.
async function cmdFellowships(cmd: ParsedCommand): Promise<string> {
  const which = cmd.positional[0]?.trim();
  const entries = Object.entries(FELLOWSHIPS);
  if (which) {
    const key = StringUtil.normalize(which);
    const hit = fellowshipByName(key);
    if (!hit) return sys(`No fellowship "${which}". Known: ${entries.map(([k]) => k).join(", ")}.`);
    const pillars = Object.entries(hit.pillars).map(([p, gloss]) => `${disp(p)} (${gloss})`).join(", ");
    return sys(`${hit.name} - Foundation: ${disp(hit.foundation)}${hit.foundationGloss ? ` (${hit.foundationGloss})` : ""}. `
      + `Pillars: ${pillars}. Rate them in the sheet's traits bucket; [[cast]] finds the Foundation on its own.`);
  }
  if (!entries.length) return sys(`No fellowships defined.`);
  const items = entries.map(([k, f]) => `${k}: ${disp(f.foundation)} + ${Object.keys(f.pillars).map(p => disp(p)).join("/")}`).join("; ");
  return sys(`Fellowships - ${items}. Detail with [[show-fellowship <name>]].`);
}

// =============================================================================
// BUDGETS - what a character may spend, per purse
// -----------------------------------------------------------------------------
// Arcana are NOT merits: they trade in a purse of their own, so counting them
// as merits would make a legal character look overspent. A budget is an
// EXPRESSION ("25", and later one written in terms of another), declared on the
// template and overridable on the sheet. Everything here is ADVISORY - there is
// no creation engine yet, so [[show-budget]] reports and the Storyteller decides.
// =============================================================================

// Every purse this character has a budget for: the creation pools first, then
// each template's, then the sheet's - each layer merging FIELD BY FIELD, so
// pricing a purse never erases the allowance underneath and vice versa.
//
// The prices come from the chronicle's cost table when nobody states them, so
// a purse always knows what one of its dots costs in freebies and in
// experience. A template says otherwise when its creature is otherwise: the
// Ouroboros' Arcana are NOT_PURCHASABLE from either.
function budgetsOf(char: PlayableCharacter): Record<string, BudgetDef> {
  // The creation budget already answers three of these purses; [[show-budget]] and
  // [[show-creation]] must not disagree about how many Background dots you get.
  const creation = creationBudgetFor(char.templates);
  const out: Record<string, BudgetDef> = {
    background: { allows: String(creation.backgrounds) },
    freebie: { allows: String(creation.freebies) },
    ...(creation.disciplines !== undefined ? { discipline: { allows: String(creation.disciplines) } } : {}),
  };
  const layer = (purse: string, entry: BudgetEntry): void => {
    const key = StringUtil.normalize(purse);
    out[key] = { ...(out[key] ?? {}), ...budgetDef(entry) };
  };
  for (const t of char.templates) {
    for (const [purse, entry] of Object.entries(TEMPLATES[StringUtil.normalize(t)]?.Budgets ?? {})) layer(purse, entry);
  }
  for (const [purse, entry] of Object.entries(char.budgets ?? {})) layer(purse, entry);
  // Chronicle bonuses ADD to the allowance rather than replacing it, and keep
  // their reason attached - "everyone here is Suspect" is part of the budget
  // now, not a number somebody remembers.
  for (const g of char.purseGrants ?? []) {
    const key = StringUtil.normalize(g.purse);
    const base = out[key]?.allows;
    out[key] = {
      ...(out[key] ?? {}),
      allows: base ? `(${base}) + ${g.points}` : String(g.points),
      note: [out[key]?.note, `+${g.points} from ${g.source}${g.note ? `: ${g.note}` : ""}`].filter(Boolean).join("; "),
    };
  }
  // The default price of a dot is what the chronicle's table says a dot of that
  // kind costs - the purses whose names ARE the kind ("background",
  // "discipline", "virtue"). A purse the table has never heard of keeps its
  // silence, and [[show-budget]] reports it as the Storyteller's call.
  const table = advancementCostsFrom(AdvancementCosts.current() as CostTable);
  for (const [purse, def] of Object.entries(out)) {
    const priced = table[purse];
    if (!priced) continue;
    if (def.freebie === undefined && priced.freebie) def.freebie = priced.freebie;
    if (def.experience === undefined && priced.experience) def.experience = priced.experience;
  }
  return out;
}

// An expression -> a number, through the one expression language, so a budget
// may be written in terms of the character's own traits.
function evalBudget(char: PlayableCharacter, expr: string): number {
  return Math.max(0, evalOn(char, expr).value);
}

// The allowance a purse holds for this character, or undefined when nobody has
// said - which is a different answer from zero and must stay one.
function budgetAllowance(char: PlayableCharacter, def: BudgetDef | undefined): number | undefined {
  return def?.allows === undefined ? undefined : evalBudget(char, def.allows);
}

// The two prices, said the way [[show-budget]] and [[show-cost]] both want them.
function budgetPrices(def: BudgetDef): string {
  const bits = (["freebie", "experience"] as const)
    .filter(p => def[p] !== undefined)
    .map(p => budgetBuyable(def[p]) ? `${p} ${def[p]}` : `not bought with ${p === "freebie" ? "freebies" : "experience"}`);
  return bits.join(", ");
}

// The purse namespaces an expression may reach: `budget:freebie` (what the
// purse holds), `spent:freebie` (what has left it) and `left:freebie` (the
// difference). state.ts cannot compute these - the ledger lives up here - so it
// takes them as a scope EXTENSION, which is the seam a legality proof will use
// to say "you have four Background dots you never assigned".
function purseScope(char: PlayableCharacter): ScopeExtension {
  return (path) => {
    const [head, ...rest] = path;
    if (!["budget", "spent", "left"].includes(head)) return undefined;
    const purse = rest.join(":");
    // The ledger reads traits, and a trait may itself be derived - but a purse
    // is never part of a derivation, so the plain trait scope breaks the knot.
    const resolve = (n: string): number => traitValueOf(char, n);
    const spent = purseLedger(char, resolve)[purse]?.spent ?? 0;
    if (head === "spent") return { value: spent };
    const allows = budgetsOf(char)[purse]?.allows;
    if (allows === undefined) return undefined;
    const budget = Math.max(0, evaluateExpr(allows, characterScope(char)).value);
    return { value: head === "budget" ? budget : budget - spent };
  };
}

// What each owned merit / flaw / arcanum / taint draws from its purse. The
// listed price is the default; `paid` on the sheet overrides it, because price
// paid is not price listed - a Storyteller may simply GRANT a thing.
function purseLedger(char: PlayableCharacter, resolve: TraitResolver): Record<string, { spent: number; items: string[] }> {
  const out: Record<string, { spent: number; items: string[] }> = {};
  // Background DOTS are a purse of their own, and dots are not cost: a
  // Background the chronicle handed you rates 5 and cost nothing, which is
  // exactly what `paid` records. A CONFERRED rating never cost anything either.
  const conferred = grantedTraitsOf(char);
  const backgrounds = { spent: 0, items: [] as string[] };
  // A purchase whose SOURCE is not a creation purse costs the purse nothing -
  // and the ledger says which source, so the proof reads "template" or
  // "storyteller" rather than an unexplained zero.
  const sourceOf = (key: string): string | undefined => char.source?.[StringUtil.normalize(key)];
  const offPurse = (key: string): boolean => !sourceDrawsOnPurse(sourceOf(key));
  for (const [name, rating] of Object.entries(char.backgrounds ?? {})) {
    if (rating <= 0) continue;
    if (offPurse(name)) { backgrounds.items.push(`${name} ${rating} (${sourceOf(name)})`); continue; }
    const held = char.instances?.[name];
    const each = held?.length ? held : [{ rating, paid: char.paid?.[name] }];
    for (const one of each) {
      const override = (one as { paid?: string }).paid;
      const cost = override !== undefined ? evalBudget(char, override) : one.rating;
      backgrounds.spent += cost;
      backgrounds.items.push(`${name} ${one.rating}${override !== undefined ? ` (paid ${cost})` : ""}`);
    }
  }
  for (const [name, g] of Object.entries(conferred)) {
    backgrounds.items.push(`${name} ${g.rating} (from ${g.from}, free)`);
  }
  if (backgrounds.items.length) out["background"] = backgrounds;
  // Discipline DOTS are a purse too, and like Backgrounds a dot is not a cost:
  // `paid` records what the chronicle actually charged for one.
  const disciplines = { spent: 0, items: [] as string[] };
  for (const [name, rating] of Object.entries(char.disciplines ?? {})) {
    if (rating <= 0) continue;
    if (offPurse(name)) { disciplines.items.push(`${name} ${rating} (${sourceOf(name)})`); continue; }
    const override = char.paid?.[name];
    const cost = override !== undefined ? evalBudget(char, override) : rating;
    disciplines.spent += cost;
    disciplines.items.push(`${name} ${rating}${override !== undefined ? ` (paid ${cost})` : ""}`);
  }
  if (disciplines.items.length) out["discipline"] = disciplines;
  // BOTH categories: a purse ledger is machinery, and the whole reason arcana
  // are their own category is that they draw on their own purse. Each instance
  // says which one it trades in.
  for (const inst of ownedPowerInstances(char)) {
    const purse = budgetOfKind(inst.def);
    if (offPurse(inst.key)) {
      const row = out[purse] ?? { spent: 0, items: [] };
      row.items.push(`${inst.key} (${sourceOf(inst.key)})`);
      out[purse] = row;
      continue;
    }
    const override = char.paid?.[inst.key];
    const listed = inst.points;
    const cost = override !== undefined ? evalBudget(char, override) : listed;
    const signed = kindSpends(inst.def.kind) ? cost : -cost;
    const row = out[purse] ?? { spent: 0, items: [] };
    row.spent += signed;
    row.items.push(`${inst.key} ${signed >= 0 ? signed : `+${-signed}`}${override !== undefined ? " (set)" : ""}`);
    out[purse] = row;
  }
  return out;
}

// budget - each purse: what it allows, what the sheet has spent, what is left.
async function cmdBudget(cmd: ParsedCommand): Promise<string> {
  const raw = (cmd.named["character"] ?? cmd.positional[0])?.trim();
  const char = raw ? await CharacterStore.load((await resolveCharacterRef(raw)).name ?? raw) : await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const { resolver } = await characterRollEnv(char);
  const budgets = budgetsOf(char);
  const ledger = purseLedger(char, resolver);
  const purses = [...new Set([...Object.keys(budgets), ...Object.keys(ledger)])].sort();
  if (!purses.length) return sys(`${disp(char.name)} has no budgets and has bought nothing that draws on one.`);
  const lines = purses.map(purse => {
    const def = budgets[purse] ?? {};
    const spent = ledger[purse]?.spent ?? 0;
    const items = ledger[purse]?.items ?? [];
    const detail = items.length ? ` [${items.join(", ")}]` : "";
    // A purse says three things: what it holds, what it has spent, and what a
    // dot of it costs to buy - and "cannot be bought" is one of those answers.
    const prices = budgetPrices(def);
    const tail = `${prices ? ` - ${prices}` : ""}${def.note ? ` (${def.note})` : ""}${detail}`;
    const total = budgetAllowance(char, def);
    if (total === undefined) return `${purse}: ${spent} spent, no budget set (Storyteller's call)${tail}`;
    const shown = def.allows !== String(total) ? ` (${def.allows})` : "";
    return `${purse}: ${spent}/${total}${shown}, ${total - spent} left${tail}`;
  });
  return sys(`${disp(char.name)} budgets - ${lines.join("; ")}. Advisory: nothing is enforced until creation is. `
    + `Override one on the sheet's "budgets" block or with [[extend-template ... budgets=\`purse=expr\`]]; `
    + `set what a purchase really cost with [[paid <key> <expr>]].`);
}

// grant - where something came from, when it was not bought from a purse.
//
// Two shapes, because the owner named two different things:
//   [[grant potence source=template]]        this trait costs the purse nothing
//   [[grant freebie 3 source=storyteller note=`everyone here is Suspect`]]
//                                            the chronicle ADDS to a purse
// The second is the ruling he described: Flaws past the cap that still pay,
// recorded as a bonus with its reason rather than as a silently larger budget.
async function cmdGrant(cmd: ParsedCommand, forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const key = StringUtil.normalize(cmd.positional[0] ?? "");
  const source = StringUtil.normalize(cmd.named["source"] ?? "storyteller");
  if (!key) {
    const owned = Object.entries(char.source ?? {}).map(([k, v]) => `${k}: ${v}`);
    const bonuses = (char.purseGrants ?? []).map(g => `${g.purse} +${g.points} (${g.source}${g.note ? `: ${g.note}` : ""})`);
    return sys(`${disp(char.name)} - ${owned.length ? `granted: ${owned.join(", ")}` : "nothing granted"}`
      + `${bonuses.length ? `; purse bonuses: ${bonuses.join(", ")}` : ""}. `
      + `Sources: ${Object.entries(GRANT_SOURCES).map(([k, v]) => `${k} (${v})`).join("; ")}. `
      + `[[grant <trait> source=template]] marks one; [[grant <purse> <points> source=storyteller note=\`why\`]] adds to a purse.`);
  }
  if (!(source in GRANT_SOURCES)) {
    return sys(`No grant source "${source}". Known: ${Object.keys(GRANT_SOURCES).join(", ")}.`);
  }
  const points = intOrUndef(cmd.positional[1] ?? "");
  if (points !== undefined) {
    // A PURSE bonus: more points to spend, and the reason travels with them.
    const note = cmd.named["note"]?.trim();
    char.purseGrants = [
      ...(char.purseGrants ?? []).filter(g => !(g.purse === key && g.source === source)),
      { purse: key, points, source, ...(note ? { note } : {}) },
    ];
    await CharacterStore.save(char);
    return sys(`${disp(char.name)}: ${key} purse +${points} (${source}${note ? ` - ${note}` : ""}). `
      + `[[show-budget]] counts it, with the reason attached.`);
  }
  // A TRAIT or merit instance: it costs the purse nothing, and this says why.
  char.source = { ...(char.source ?? {}), [key]: source };
  await CharacterStore.save(char);
  return sys(`${disp(char.name)}: ${disp(key)} is ${source} - ${grantSourceNote(source)}. `
    + `It costs no creation purse${sourceDrawsOnPurse(source) ? " differently than before" : ""}; [[show-budget]] shows it.`);
}

async function cmdUngrant(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const key = StringUtil.normalize(cmd.positional[0] ?? "");
  if (!key) return sys(`forget-grant needs a trait or a purse.`);
  const hadSource = char.source?.[key] !== undefined;
  if (hadSource) { delete char.source![key]; if (!Object.keys(char.source!).length) delete char.source; }
  const before = (char.purseGrants ?? []).length;
  char.purseGrants = (char.purseGrants ?? []).filter(g => g.purse !== key);
  if (!char.purseGrants.length) delete char.purseGrants;
  await CharacterStore.save(char);
  const dropped = (hadSource ? 1 : 0) + (before - (char.purseGrants?.length ?? 0));
  return dropped
    ? sys(`${disp(char.name)}: ${disp(key)} is back to being bought normally.`)
    : sys(`${disp(char.name)} had no grant for "${key}".`);
}

// paid <key> [expr] - what a purchase ACTUALLY cost. No expression means 0: the
// Storyteller granted it. Bare [[paid]] lists the overrides.
async function cmdPaid(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const rawKey = cmd.positional[0]?.trim();
  if (!rawKey) {
    const entries = Object.entries(char.paid ?? {});
    return entries.length
      ? sys(`${disp(char.name)} - prices the Storyteller set: ${entries.map(([k, v]) => `${k} = ${v}`).join(", ")}. `
        + `[[paid <key> <expr>]] sets one; [[paid <key> listed]] puts it back.`)
      : sys(`${disp(char.name)} paid the listed price for everything. [[paid <key> [expr]]] records otherwise (no expression = granted).`);
  }
  const key = StringUtil.normalize(rawKey);
  const expr = cmd.positional[1]?.trim() ?? cmd.named["expr"]?.trim() ?? "0";
  char.paid = { ...(char.paid ?? {}) };
  if (expr.toLowerCase() === "listed") {
    if (!(key in char.paid)) return sys(`No price was set for "${key}".`);
    delete char.paid[key];
    if (!Object.keys(char.paid).length) delete char.paid;
    await CharacterStore.save(char);
    return sys(`${key} pays the listed price again.`);
  }
  char.paid[key] = expr;
  await CharacterStore.save(char);
  const { resolver } = await characterRollEnv(char);
  const value = evalBudget(char, expr);
  return sys(`${key} cost ${value}${expr !== String(value) ? ` (${expr})` : ""}${value === 0 ? " - granted, not bought" : ""}. `
    + `[[show-budget]] counts it.`);
}

// =============================================================================
// CREATION - the budget a fresh character is built against
// -----------------------------------------------------------------------------
// Reports, never enforces. The numbers live in the template's CreationBudget
// (rules.ts); this walks the sheet and says what each pool has actually taken.
// =============================================================================
// The trait names in one priority category. Attributes come from the fixed
// three (rules.ts); Abilities come from the CHRONICLE's own lists, so a
// house-ruled Ability counts in whichever of them names it. Both the plural and
// the singular answer, because both are what a player types.
async function categoryTraits(kind: "attributes" | "abilities"): Promise<{ order: string[]; of: Record<string, string[]> }> {
  const order: string[] = [];
  const of: Record<string, string[]> = {};
  const put = (category: string, names: readonly string[]): void => {
    const list = names.map(n => StringUtil.normalize(n));
    order.push(category);
    of[category] = list;
    if (category.endsWith("s")) of[category.slice(0, -1)] = list;
  };
  if (kind === "attributes") {
    for (const [category, names] of Object.entries(ATTRIBUTES)) put(category, names);
    return { order, of };
  }
  put("talents", await LorebookManager.allTalents());
  put("skills", await LorebookManager.allSkills());
  put("knowledges", await LorebookManager.allKnowledges());
  return { order, of };
}

// The template's budget (templates stack - see creationBudgetFor).
function creationOf(char: PlayableCharacter): CreationBudget {
  return creationBudgetFor(char.templates);
}

// The trait limits in force: the template's, plus the chosen clan's (a
// Nosferatu's Appearance is 0 and stays 0).
function limitsFor(char: PlayableCharacter): Record<string, TraitLimit> {
  const clan = char.choices?.["clan"] ? clanByName(char.choices["clan"]) : undefined;
  return { ...(creationOf(char).limits ?? {}), ...(clan?.limits ?? {}) };
}

// The Disciplines that are this character's own, from every source at once: the
// clan or bloodline family he picked, and what his templates say outright.
// Templates stack the same way their budgets do - and a "replace" anywhere
// means the families have nothing to add.
function affinityOf(char: PlayableCharacter): { disciplines: string[]; sources: string[] } {
  const own: string[] = [];
  let replace = false;
  for (const t of char.templates) {
    const a = TEMPLATES[StringUtil.normalize(t)]?.Affinity;
    if (!a) continue;
    own.push(...a.disciplines);
    if (a.mode === "replace") replace = true;
  }
  return affinityDisciplines(char.choices, { disciplines: own, ...(replace ? { mode: "replace" as const } : {}) });
}

// choose <what> <value> - the picks a template asks for.
async function cmdChoose(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const what = StringUtil.normalize(cmd.positional[0] ?? cmd.named["what"] ?? "");
  const value = (cmd.positional[1] ?? cmd.named["value"] ?? "").trim();
  if (!what) {
    const made = Object.entries(char.choices ?? {}).map(([k, v]) => `${k}: ${disp(v)}`);
    // The family choices carry Disciplines with them; two of the three
    // registries are empty for now, and a template's own list covers for them.
    const families = AFFINITY_SOURCES.filter(s => s.choice !== "clan")
      .map(s => `[[choose ${s.choice} <name>]]${Object.keys(s.families).length ? "" : " (none defined yet)"}`);
    return sys(`${disp(char.name)} - ${made.length ? made.join(", ") : "nothing chosen yet"}. `
      + `[[choose clan <name>]] ([[show-clan]]), [[choose fellowship <name>]] ([[show-fellowship]]), `
      + `[[choose road <name>]] (${Object.values(ROADS).map(r => r.name).join(", ")}), `
      + `[[choose attributes physical,social,mental]] (primary, secondary, tertiary), `
      + `${families.join(", ")}.`);
  }
  if (what === "attributes" || what === "abilities") {
    const groups = await categoryTraits(what);
    const order = value.split(",").map(x => StringUtil.normalize(x)).filter(Boolean);
    const wrong = order.filter(c => !(c in groups.of));
    if (order.length !== 3 || wrong.length) {
      return sys(`${wrong.length ? `No ${what} category ${wrong.map(w => `"${w}"`).join(", ")}. ` : ""}`
        + `${what} needs three categories in priority order, e.g. [[choose ${what} ${groups.order.join(",")}]]. `
        + `Known: ${groups.order.join(", ")}.`);
    }
    char.priorities = { ...(char.priorities ?? {}) };
    (["primary", "secondary", "tertiary"] as const).forEach((slot, i) => { char.priorities![`${what}-${slot}`] = order[i]; });
    await CharacterStore.save(char);
    return sys(`${disp(char.name)} ${what}: ${order.map((o, i) => `${["primary", "secondary", "tertiary"][i]} ${disp(o)}`).join(", ")}. [[show-creation]] checks the pools.`);
  }
  if (!value) return sys(`[[choose ${what} <value>]] needs a value.`);
  if (what === "road") {
    const road = roadByName(value);
    if (!road) return sys(`No road "${value}". Known: ${Object.values(ROADS).map(r => r.name).join(", ")}.`);
    char.choices = { ...(char.choices ?? {}), road: StringUtil.normalize(road.name) };
    await CharacterStore.save(char);
    return sys(`${disp(char.name)} walks the ${road.name}. Virtues: ${road.virtues.map(v => disp(v)).join(", ")}; `
      + `the rating is ${road.ratingVirtues.map(v => disp(v)).join(" + ")}. [[show-derived]] shows what follows.`);
  }
  if (what === "clan") {
    const clan = clanByName(value);
    if (!clan) return sys(`No clan "${value}". [[show-clan]] lists them.`);
    char.choices = { ...(char.choices ?? {}), clan: clan.id };
    await CharacterStore.save(char);
    const bounds = Object.values(clan.limits ?? {}).map(l => l.note).filter(Boolean).join(" ");
    return sys(`${disp(char.name)} is ${clan.name}. Clan Disciplines: ${clan.disciplines.map(d => disp(d)).join(", ")}. `
      + `${bounds ? `${bounds} ` : ""}Rate them with [[set-trait <discipline> <n> group=discipline]].`);
  }
  if (what === "fellowship") {
    const f = fellowshipByName(value);
    if (!f) return sys(`No fellowship "${value}". [[show-fellowship]] lists them.`);
    char.choices = { ...(char.choices ?? {}), fellowship: f.id };
    await CharacterStore.save(char);
    return sys(`${disp(char.name)} follows the ${f.name}${f.theme ? ` (${f.theme})` : ""}. `
      + `Foundation: ${disp(f.foundation)}. Pillars: ${Object.entries(f.pillars).map(([p, g]) => `${disp(p)} (${g})`).join(", ")}. `
      + `Rate them with [[set-trait <pillar> <n>]].`);
  }
  char.choices = { ...(char.choices ?? {}), [what]: StringUtil.normalize(value) };
  await CharacterStore.save(char);
  return sys(`${disp(char.name)} ${what}: ${disp(value)} (recorded; the engine knows no rules for it).`);
}

// clans / clan <name>
async function cmdClans(cmd: ParsedCommand): Promise<string> {
  const which = cmd.positional[0]?.trim();
  if (which) {
    const clan = clanByName(which);
    if (!clan) return sys(`No clan "${which}". Known: ${Object.values(CLANS).map(c => c.name).join(", ")}.`);
    const limits = Object.entries(clan.limits ?? {}).map(([t, l]) => `${disp(t)} ${l.start ?? 0}-${l.max ?? 5}${l.note ? ` (${l.note})` : ""}`);
    return sys(`${clan.name} - Disciplines: ${clan.disciplines.map(d => disp(d)).join(", ")}`
      + `${limits.length ? `; ${limits.join("; ")}` : ""}. [[choose clan ${clan.id}]] picks it.`);
  }
  return sys(`Clans: ${Object.values(CLANS).map(c => `${c.name} (${c.disciplines.map(d => disp(d)).join("/")})`).join("; ")}. `
    + `[[show-clan <name>]] for one; [[choose clan <name>]] picks it.`);
}

// creation - every pool, against what the sheet actually holds.
async function cmdCreation(cmd: ParsedCommand): Promise<string> {
  const raw = (cmd.named["character"] ?? cmd.positional[0])?.trim();
  const char = raw ? await CharacterStore.load((await resolveCharacterRef(raw)).name ?? raw) : await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const budget = creationOf(char);
  const limits = limitsFor(char);
  const lines: string[] = [];
  // Every number below may be an EXPRESSION over this very character - a
  // vampire's Attribute ceiling is `trait-max(generation)`, not 5 - so each is
  // read through the character's own scope (state.ts).
  const num = (v: Numeric | undefined, fallback: number): number => numericOn(char, v, fallback, purseScope(char));
  const startOf = (name: string, free: number): number => num(limits[name]?.start, free);

  // Attributes and Abilities are per CATEGORY, so the priorities must be set.
  for (const kind of ["attributes", "abilities"] as const) {
    const pools = kind === "attributes" ? budget.attributes : budget.abilities;
    const free = num(kind === "attributes" ? budget.attributeStart : budget.abilityStart, kind === "attributes" ? 1 : 0);
    const groups = await categoryTraits(kind);
    const slots = (["primary", "secondary", "tertiary"] as const).map(slot => ({
      slot, category: char.priorities?.[`${kind}-${slot}`], allowed: num(pools[slot], 0),
    }));
    if (slots.some(x => !x.category)) {
      lines.push(`${kind}: ${slots.map(x => `${x.allowed}`).join("/")} to spend - `
        + `[[choose ${kind} ${groups.order.join(",")}]] first (primary, secondary, tertiary)`);
      continue;
    }
    const bucket = (kind === "attributes" ? char.attributes : char.abilities) ?? {};
    const counted = new Set<string>();
    const bits = slots.map(x => {
      const names = groups.of[x.category!];
      if (!names) return `${x.slot} ${disp(x.category!)} ?/${x.allowed} ⚠ no such category`;
      const spent = names.reduce((sum, n) => {
        counted.add(n);
        return sum + Math.max(0, (bucket[n] ?? free) - startOf(n, free));
      }, 0);
      return `${x.slot} ${disp(x.category!)} ${spent}/${x.allowed}`;
    });
    // Dots on the sheet that no priority category claims: an Ability the
    // chronicle's lists don't name, or a category the player never made a
    // priority. They are real dots, and silently dropping them would lie.
    const stray = Object.entries(bucket)
      .filter(([n, v]) => !counted.has(n) && v > startOf(n, free))
      .map(([n]) => disp(n));
    lines.push(`${kind}: ${bits.join(", ")}${stray.length ? ` ⚠ uncounted: ${stray.join(", ")}` : ""}`);
  }

  // ONE ledger, so [[show-creation]] and [[show-budget]] can never disagree about what a
  // Background cost. (They used to: this counted `paid` with parseInt while the
  // ledger evaluated it as an expression.)
  const bgSpent = purseLedger(char, (n) => traitValueOf(char, n))["background"]?.spent ?? 0;
  lines.push(`backgrounds: ${bgSpent}/${num(budget.backgrounds, 5)}`);

  if (budget.disciplines !== undefined) {
    // Whose Disciplines are properly his: his clan's, his bloodline family's,
    // or - for a creature no book speaks for - his template's own.
    const affinity = affinityOf(char);
    const spent = purseLedger(char, (n) => traitValueOf(char, n))["discipline"]?.spent ?? 0;
    const out = Object.keys(char.disciplines ?? {}).filter(d => affinity.disciplines.length && !affinity.disciplines.includes(d));
    const whose = affinity.disciplines.length
      ? ` (${affinity.sources.join(" + ")}: ${affinity.disciplines.map(d => disp(d)).join(", ")})`
      : ` - nothing names his Disciplines yet ([[choose clan …]], or [[extend-template … disciplines=\`…\`]])`;
    lines.push(`disciplines: ${spent}/${num(budget.disciplines, 0)}${whose}`
      + `${out.length ? ` ⚠ out of affinity: ${out.map(d => disp(d)).join(", ")}` : ""}`);
  }
  if (budget.virtues !== undefined) {
    const free = num(budget.virtueStart, 1);
    const spent = Object.values(char.virtues ?? {}).reduce((a, b) => a + b, 0) - free * Object.keys(char.virtues ?? {}).length;
    lines.push(`virtues: ${Math.max(0, spent)}/${num(budget.virtues, 0)} (over ${free} free dot each)`);
  }
  lines.push(`freebies: ${num(budget.freebies, 15)} to spend ([[show-cost]] prices them)`
    + `${budget.flawMax !== undefined ? `, Flaws pay up to ${num(budget.flawMax, 7)}` : ""}`);
  // What the TEMPLATE hands out free. Reported, never auto-applied: a ghoul's
  // dot is usually Potence and sometimes Fortitude, and that is the player's
  // pick, not the engine's.
  for (const g of budget.grants ?? []) {
    const has = g.trait ? traitValueOf(char, g.trait) > 0
      : (g.choose ?? []).some(c => traitValueOf(char, c) > 0);
    lines.push(`free: ${describeCreationGrant(g)}${has ? " ✓" : " - not on the sheet yet"}`
      + `${has ? "" : ` ([[set-trait ${g.trait ?? g.choose?.[0]} ${g.rating} group=${g.bucket ?? "discipline"}]] then [[grant ${g.trait ?? g.choose?.[0]} source=template]])`}`);
  }

  // The ceilings, which for a vampire are a consequence of generation rather
  // than a number: Attributes 1-6 at the 7th. Per-trait exceptions follow.
  const ceilings: Array<[string, keyof PlayableCharacter, Numeric | undefined, Numeric | undefined]> = [
    ["attributes", "attributes", budget.attributeStart, budget.attributeMax],
    ["abilities", "abilities", budget.abilityStart, budget.abilityMax],
    ...(budget.disciplines !== undefined ? [["disciplines", "disciplines", 0, budget.disciplineMax ?? budget.abilityMax] as [string, keyof PlayableCharacter, Numeric, Numeric]] : []),
  ];
  const over: string[] = [];
  const caps = ceilings.map(([label, bucketKey, start, max]) => {
    const lo = num(start, 0), hi = num(max, 5);
    for (const [t, v] of Object.entries((char[bucketKey] ?? {}) as Record<string, number>)) {
      const cap = limits[t]?.max !== undefined ? num(limits[t].max, hi) : hi;
      if (v > cap) over.push(`${disp(t)} ${v} > ${cap}`);
    }
    return `${label} ${lo}-${hi}`;
  });
  // A rating a per-trait limit forbids: a Nosferatu sheet still carrying the
  // free Appearance dot every other character gets. Said, not corrected.
  const exceptions = Object.entries(limits).map(([t, l]) => `${disp(t)} ${num(l.start, 0)}-${num(l.max, 5)}`);
  lines.push(`ceilings: ${[...caps, ...exceptions].join(", ")}${over.length ? ` ⚠ over: ${over.join(", ")}` : ""}`);

  // What the sheet IMPLIES rather than states, with its arithmetic shown.
  const derived = derivedValuesOf(char, purseScope(char));
  if (derived.length) lines.push(`derived: ${derived.map(d => derivedLine(d, char)).join(", ")}`);

  // The notes are whole sentences the splat's own book states; they follow the
  // pools rather than joining them, so the punctuation stays readable.
  const notes = budget.notes?.length ? ` ${budget.notes.join(" ")}` : "";

  return sys(`${disp(char.name)} creation - ${lines.join("; ")}.${notes} Advisory: nothing is enforced.`);
}

// derived - what this sheet implies rather than states, and why.
async function cmdDerived(cmd: ParsedCommand): Promise<string> {
  const raw = (cmd.named["character"] ?? cmd.positional[0])?.trim();
  const char = raw ? await CharacterStore.load((await resolveCharacterRef(raw)).name ?? raw) : await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const derived = derivedValuesOf(char, purseScope(char));
  if (!derived.length) {
    return sys(`${disp(char.name)} derives nothing - this template states every number outright. `
      + `[[show-eval <expression>]] still reads the sheet.`);
  }
  const lines = derived.map(d => {
    const kind = d.when === "always" ? "always" : d.overridden !== undefined ? "started here, now the sheet's" : "starts here";
    return `${derivedLine(d, char)} [${kind}]${d.note ? ` - ${d.note}` : ""}`;
  });
  return sys(`${disp(char.name)} derived - ${lines.join("; ")}. `
    + `An "always" value recomputes whatever the sheet says; a starting one steps aside once you rate it.`);
}

// eval <expression> - the whole reference system, exposed. This is how you find
// out what the engine thinks a name means without guessing from a report.
async function cmdEval(cmd: ParsedCommand, forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const expr = (cmd.named["expression"] ?? cmd.positional.join(" ")).trim();
  if (!expr) {
    return sys(`[[show-eval <expression>]] reads an expression against ${disp(char.name)}. `
      + `Names are traits (\`courage\`, \`self-control\`); a path asks one place (\`background:generation\`, `
      + `\`derived:willpower\`, \`granted:sanctum\`, \`budget:freebie\`, \`spent:freebie\`, \`left:freebie\`, `
      + `\`resource:quintessence:max\` for that pool by name, \`role:willpower\` for whatever fills that role here). `
      + `Arithmetic is + - * / and ( ); functions are ${BUILTIN_FUNCTIONS.join(", ")}, trait-max, blood-max, road-virtues. `
      + `Mind the hyphen: \`a - b\` needs the spaces, \`self-control\` does not.`);
  }
  // [[show-eval]] sees everything a rules expression sees, INCLUDING the clock - it
  // is where you test an affliction's until-condition before writing it onto a
  // card. Elapsed time is measured from the story's start, since a bare
  // expression has no "when this began".
  const clock = await StoryClock.get();
  const scope = await timedScope(char, clock?.start ?? 0, clock?.now ?? 0);
  const purse = purseScope(char);
  const out = evaluateCondition(expr, {
    lookup: (path) => scope.lookup(path) ?? purse(path),
    call: scope.call,
  });
  if (out.error) return sys(`Cannot read "${expr}": ${out.error}.`);
  // Showing the work is only worth it when there IS work: a single reference
  // restating itself ("road = 2 = road 2") is noise, unless it came from
  // somewhere worth naming.
  const one = out.terms.length === 1 ? out.terms[0] : undefined;
  const work = one && !one.from ? "" : ` = ${describeTerms(out.terms)}`;
  const missed = out.unknown.length ? ` ⚠ nothing answers to ${out.unknown.join(", ")}` : "";
  return sys(`${disp(char.name)}: ${expr} = ${out.value}${work}${missed}`);
}

// One derived value, said the way a Storyteller would check it: the number, the
// arithmetic behind it, and whether the sheet has overridden a starting value.
function derivedLine(d: DerivedValue, char?: PlayableCharacter): string {
  if (d.error) return `${disp(d.trait)} ⚠ ${d.error}`;
  const shown = d.overridden ?? d.value;
  const why = d.overridden !== undefined
    ? `sheet ${d.overridden}, would start at ${d.value}`
    // `road-virtues()` is opaque until it says WHICH Virtues; the Road knows.
    : describeTerms(d.terms).replace("road-virtues()", char ? roadRatingExpr(roadOf(char)) : "road-virtues()");
  return `${disp(d.trait)} ${shown} (${why})`;
}

// =============================================================================
// TEMPLATES - the chronicle's own splats, written rather than compiled
// -----------------------------------------------------------------------------
// A template EXTENDS another and states only what differs. That is what makes a
// unique creature (the Ouroboros: a mage who soaks like a ghoul and carries one
// fused pool) a thing a player can write instead of a thing the engine ships.
// =============================================================================
async function cmdTemplates(cmd: ParsedCommand): Promise<string> {
  const which = cmd.positional[0]?.trim();
  if (which) {
    const key = StringUtil.normalize(which);
    const tpl = TEMPLATES[key];
    if (!tpl) return sys(`No template "${which}". Known: ${Object.keys(TEMPLATES).sort().join(", ")}.`);
    const def = TemplateRegistry.get(key) ?? DEFAULT_TEMPLATE_DEFS.find(d => StringUtil.normalize(d.name) === key);
    const purses = Object.entries(tpl.Budgets).map(([purse, entry]) => {
      const d = budgetDef(entry);
      const prices = budgetPrices(d);
      return `${purse} ${d.allows ?? "?"}${prices ? ` (${prices})` : ""}`;
    });
    const bits = [
      `resources: ${tpl.Pools.map(p => disp(p.name)).join(", ") || "none"}`,
      `soak: ${Object.entries(SOAK_TABLES).find(([, v]) => v === tpl.Soak)?.[0] ?? "custom"}`,
      `morality: ${tpl.Morality?.name ?? "none"}${tpl.HasVirtues ? " (with Virtues)" : ""}`,
      tpl.Capabilities.length ? `can use: ${tpl.Capabilities.join(", ")}` : "",
      tpl.Affinity.disciplines.length
        ? `Disciplines: ${tpl.Affinity.disciplines.map(d => disp(d)).join(", ")}${tpl.Affinity.mode === "replace" ? " (and no family's)" : ""}`
        : tpl.Affinity.mode === "replace" ? "Disciplines: his own, none named yet" : "",
      purses.length ? `budgets: ${purses.join(", ")}` : "",
      def?.extends ? `extends ${disp(def.extends)}` : "built in",
    ].filter(Boolean);
    return sys(`${tpl.Name} - ${bits.join("; ")}. ${def ? `Written as data; ` : ""}`
      + `[[create-playable name="..." templates=${key}]] uses it.`);
  }
  const written = new Set([...DEFAULT_TEMPLATE_DEFS, ...TemplateRegistry.all()].map(d => StringUtil.normalize(d.name)));
  const listed = Object.keys(TEMPLATES).sort().map(k => `${k}${written.has(k) ? "*" : ""}`);
  const problems = lastTemplateProblems.length ? ` ⚠ ${lastTemplateProblems.join("; ")}` : "";
  return sys(`Templates: ${listed.join(", ")} (* = written as data, editable). `
    + `[[show-template <name>]] details one; [[extend-template]] makes a new one from an old one.${problems}`);
}

// "a=b,c=d" -> {a: "b", c: "d"}. The one place a command carries a small map,
// used for budgets and for the creation pools alike. Keys come back RAW: a
// budget key is `purse:field` and the colon must survive to be split on.
function pairsArg(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const bit of (raw ?? "").split(",")) {
    const at = bit.indexOf("=");
    if (at <= 0) continue;
    const key = bit.slice(0, at).trim();
    const value = bit.slice(at + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

// The creation pools a command may set, by the name it writes them under. Every
// one of them is Numeric, so "5" and "trait-max(generation)" both land.
const CREATION_FIELDS: Array<[string, keyof CreationBudget]> = [
  ["attribute-start", "attributeStart"], ["attribute-max", "attributeMax"],
  ["ability-start", "abilityStart"], ["ability-max", "abilityMax"],
  ["backgrounds", "backgrounds"], ["freebies", "freebies"],
  ["disciplines", "disciplines"], ["discipline-max", "disciplineMax"],
  ["virtues", "virtues"], ["virtue-start", "virtueStart"],
];

// A creation pool value: a plain integer stays a number, anything else is an
// expression the character resolves for itself.
function numericArg(raw: string): Numeric {
  const v = raw.trim();
  return /^-?\d+$/.test(v) ? parseInt(v, 10) : v;
}

// extend-template <name> extends=<parent> [soak=] [morality=] [awakened=]
//   [capabilities=] [budgets=`arcana=role:willpower`] [creation=`disciplines=4`]
//   [disciplines=`celerity,potence`] [description=]
async function cmdExtendTemplate(cmd: ParsedCommand): Promise<string> {
  const rawName = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!rawName) {
    return sys(`extend-template needs a name and a parent, e.g. `
      + `[[extend-template name=\`Ouroboros\` extends=mage soak=ghoul description=\`...\`]]. `
      + `Any part of its budget is yours: budgets=\`arcana=role:willpower\` (allowance), `
      + `budgets=\`arcana:freebie=-\` (a price; "-" means it cannot be bought at all), `
      + `creation=\`disciplines=4,discipline-max=5\` (the creation pools). `
      + `Add resources with [[define-resource]].`);
  }
  // This verb EDITS as well as creates: the second call must not gut what the
  // first one wrote. Start from the def already in force (the chronicle's, else
  // the shipped one) and lay the arguments over it, so "set the Ouroboros'
  // arcana purse" costs one line and keeps his soak, his pools and his notes.
  const existingKey = StringUtil.normalize(rawName);
  const existing = TemplateRegistry.get(existingKey)
    ?? DEFAULT_TEMPLATE_DEFS.find(d => StringUtil.normalize(d.name) === existingKey);
  const parts: Partial<TemplateDef> & { name: string } = { ...(existing ?? {}), name: rawName };
  for (const key of ["extends", "soak", "morality", "ruleset", "description"] as const) {
    const v = (cmd.named[key] ?? (key === "extends" ? cmd.positional[1] : undefined))?.trim();
    if (v) parts[key] = v;
  }
  for (const key of ["awakened", "has-virtues"] as const) {
    const v = cmd.named[key]?.trim().toLowerCase();
    if (v === "true" || v === "false") {
      if (key === "awakened") parts.awakened = v === "true"; else parts.hasVirtues = v === "true";
    }
  }
  const resources = (cmd.named["resources"] ?? "").split(",").map(r => StringUtil.normalize(r)).filter(Boolean);
  if (resources.length) {
    const known = ResourceOverrides.current();
    const missing = resources.filter(r => !(r in known));
    if (missing.length) {
      return sys(`No resource ${missing.map(m => `"${m}"`).join(", ")} - define it first with `
        + `[[define-resource name=\`...\` kind=pool start=N max=N]].`);
    }
    parts.resources = resources.map(r => ({ ...(known[r] as ResourceDef), name: r }));
  }
  const capabilities = (cmd.named["capabilities"] ?? "").split(",").map(c => StringUtil.normalize(c)).filter(Boolean);
  if (capabilities.length) parts.capabilities = [...new Set([...(parts.capabilities ?? []), ...capabilities])];
  // Any part of a budget, and the whole of one: `arcana=role:willpower` sets the
  // allowance, `arcana:freebie=-` prices it, and either one leaves the rest of
  // that purse alone.
  const budgets: Record<string, BudgetEntry> = { ...(parts.budgets ?? {}) };
  for (const [raw, value] of Object.entries(pairsArg(cmd.named["budgets"]))) {
    const at = raw.indexOf(":");
    // A purse's own name never contains a colon; an ALLOWANCE may ("role:…"),
    // and that is on the right of the "=", so only the KEY is split here.
    const purse = StringUtil.normalize(at < 0 ? raw : raw.slice(0, at));
    const field = StringUtil.normalize(at < 0 ? "" : raw.slice(at + 1));
    const entry = budgetDef(budgets[purse]);
    if (field && ["allows", "freebie", "experience", "note"].includes(field)) {
      entry[field as keyof BudgetDef] = value;
    } else entry.allows = value;
    budgets[purse] = entry;
  }
  if (Object.keys(budgets).length) parts.budgets = budgets;
  const creation: Partial<CreationBudget> = { ...(parts.creation ?? {}) };
  const unknownPools: string[] = [];
  for (const [raw, value] of Object.entries(pairsArg(cmd.named["creation"]))) {
    const field = CREATION_FIELDS.find(([name]) => name === StringUtil.normalize(raw))?.[1];
    if (!field) { unknownPools.push(raw); continue; }
    (creation as Record<string, Numeric>)[field] = numericArg(value);
  }
  if (unknownPools.length) {
    return sys(`No creation pool ${unknownPools.map(p => `"${p}"`).join(", ")}. `
      + `Known: ${CREATION_FIELDS.map(([n]) => n).join(", ")}.`);
  }
  if (Object.keys(creation).length) parts.creation = creation;
  // "=celerity,potence" (or mode=replace) means THESE and no others - the way a
  // creature no clan speaks for still has Disciplines of his own.
  const rawDisc = (cmd.named["disciplines"] ?? "").trim();
  if (rawDisc) {
    const replace = rawDisc.startsWith("=") || StringUtil.normalize(cmd.named["disciplines-mode"] ?? "") === "replace"
      || (!rawDisc.startsWith("+") && parts.disciplines?.mode === "replace");
    const listed = rawDisc.replace(/^[=+]/, "").split(",").map(d => StringUtil.normalize(d)).filter(Boolean);
    parts.disciplines = { disciplines: listed, ...(replace ? { mode: "replace" as const } : {}) };
  }
  const def = makeTemplateDef(parts);
  if (def.extends && !TEMPLATES[StringUtil.normalize(def.extends)]) {
    return sys(`No template "${def.extends}" to extend. Known: ${Object.keys(TEMPLATES).sort().join(", ")}.`);
  }
  await TemplateRegistry.put(def);
  const problems = lastTemplateProblems.length ? ` ⚠ ${lastTemplateProblems.join("; ")}` : "";
  const built = TEMPLATES[def.name];
  return sys(`Template "${disp(def.name)}"${def.extends ? ` extends ${disp(def.extends)}` : ""} - `
    + `resources: ${built?.Pools.map(p => disp(p.name)).join(", ") || "none"}. `
    + `[[show-template ${def.name}]] shows it.${problems}`);
}

async function cmdForgetTemplate(cmd: ParsedCommand): Promise<string> {
  const name = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!name) return sys(`forget-template needs a name. [[show-template]] lists them.`);
  if (!TemplateRegistry.get(name)) return sys(`No chronicle template "${name}" to forget (the built-ins cannot be removed).`);
  await TemplateRegistry.remove(name);
  return sys(`Forgot the chronicle's "${disp(name)}"${TEMPLATES[name] ? ` - the shipped one resurfaces` : ""}.`);
}

// define-resource - a pool or tracker written from a command. It lands in the
// resources card (the same overlay [[configure-resources]] edits), so a
// template can then name it.
async function cmdDefineResource(cmd: ParsedCommand): Promise<string> {
  const rawName = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!rawName) {
    return sys(`define-resource needs a name, e.g. [[define-resource name=\`Living Resolve\` kind=pool `
      + `start=30 max=30 roles=\`blood,willpower,quintessence\` replaces=\`blood,willpower,quintessence\`]].`);
  }
  const name = StringUtil.normalize(rawName);
  const kind = StringUtil.normalize(cmd.named["kind"] ?? "pool") === "tracker" ? "tracker" : "pool";
  const patch: Partial<ResourceDef> = { kind };
  // start / max / per-turn are NUMERIC: an integer, or an expression over the
  // character ("10 + 2 * background:fount"). A bare integer stays a number.
  const numeric = (raw: string | undefined): Numeric | undefined => {
    const v = raw?.trim();
    if (!v) return undefined;
    return /^-?\d+$/.test(v) ? parseInt(v, 10) : v;
  };
  patch.start = numeric(cmd.named["start"]) ?? 0;
  patch.max = numeric(cmd.named["max"]) ?? (typeof patch.start === "number" ? Math.max(10, patch.start) : 10);
  // `requires` is what a character must be CAPABLE OF to spend this at all -
  // the difference between holding a talisman's pool and being able to use it.
  for (const key of ["roles", "replaces", "requires"] as const) {
    const list = (cmd.named[key] ?? "").split(",").map(r => StringUtil.normalize(r)).filter(Boolean);
    if (list.length) patch[key] = list;
  }
  const perTurn = numeric(cmd.named["per-turn"]);
  if (perTurn !== undefined) patch.perTurnLimit = perTurn;
  const description = cmd.named["description"]?.trim();
  if (description) patch.description = description;
  await ResourceOverrides.save({ ...ResourceOverrides.current(), [name]: { ...(ResourceOverrides.current()[name] ?? {}), ...patch } });
  return sys(`Resource "${disp(name)}" - ${kind} ${patch.start}/${patch.max}`
    + `${patch.roles?.length ? `, roles ${patch.roles.join("/")}` : ""}`
    + `${patch.replaces?.length ? `, replaces ${patch.replaces.join("/")}` : ""}`
    + `${patch.requires?.length ? `, usable only by the ${patch.requires.join("/")}-capable` : ""}. `
    + `Give it to a template with [[extend-template ... resources=${name}]]; `
    + `[[configure-resources]] tunes it.`);
}

// backgrounds / background <name> - the bag Backgrounds never had.
async function cmdBackgrounds(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  const defs = BackgroundRegistry.all();
  const held = char?.backgrounds ?? {};
  const granted = char ? grantedTraitsOf(char) : {};
  const mine = Object.entries(held).filter(([, v]) => v > 0)
    .map(([n, v]) => `${disp(n)} ${v}${char?.paid?.[n] !== undefined ? ` (paid ${char.paid![n]})` : ""}`);
  const conferred = Object.entries(granted).map(([n, g]) => `${disp(n)} ${g.rating} (from ${disp(g.from)})`);
  const parts = [`Defined: ${defs.map(d => d.name).join(", ")}`];
  if (mine.length) parts.push(`${disp(char!.name)} holds: ${mine.join(", ")}`);
  if (conferred.length) parts.push(`Conferred: ${conferred.join(", ")}`);
  return sys(`${parts.join(". ")}. [[show-background <name>]] for one; [[set-trait <name> <n>]] rates one; `
    + `[[define-background]] adds one.`);
}

async function cmdBackground(cmd: ParsedCommand): Promise<string> {
  const raw = cmd.positional[0]?.trim();
  if (!raw) return cmdBackgrounds();
  const def = BackgroundRegistry.get(StringUtil.normalize(raw));
  if (!def) return sys(`No background "${raw}". [[show-background]] lists them.`);
  const char = await CharacterStore.getCurrent();
  const rating = char ? char.backgrounds?.[StringUtil.normalize(def.name)] ?? 0 : 0;
  const bits = [`background "${disp(def.name)}"`, `max ${def.max ?? 5}`];
  if (def.templates?.length) bits.push(`only ${def.templates.join("/")}`);
  if (char) bits.push(`${disp(char.name)} has ${rating}`);
  const tier = backgroundTierAt(def, rating);
  for (const t of def.tiers ?? []) {
    const marks = [t.max !== undefined ? `hold ${t.max}` : "", t.perTurn !== undefined ? `${t.perTurn}/turn` : "", t.note ?? ""].filter(Boolean);
    bits.push(`${t === tier ? "• " : ""}${t.atLeast}: ${marks.join(", ")}`);
  }
  for (const g of def.grants ?? []) {
    bits.push(`grants ${disp(g.trait)} ${g.rating}${(g.atLeast ?? 1) > 1 ? ` at ${g.atLeast}+` : ""}${g.note ? ` - ${g.note}` : ""}`);
  }
  return sys(`${bits.join("; ")}.${def.description ? ` ${def.description}` : ""}${def.note ? ` ${def.note}` : ""}`);
}

// define-background name=... [max=] [templates=] [grants="sanctum:5,library:5"] [description=]
async function cmdDefineBackground(cmd: ParsedCommand): Promise<string> {
  const rawName = cmd.named["name"] ?? cmd.positional[0];
  if (!rawName?.trim()) {
    return sys(`define-background needs a name, e.g. [[define-background name=\`Talisman\` max=5 `
      + `grants=\`cray:5,library:5,sanctum:5\` description=\`…\`]].`);
  }
  const parts: Partial<BackgroundDef> & { name: string } = { name: rawName.trim() };
  const max = intOrUndef(cmd.named["max"] ?? "");
  if (max !== undefined) parts.max = max;
  const templates = (cmd.named["templates"] ?? "").split(",").map(t => t.trim()).filter(Boolean);
  if (templates.length) parts.templates = templates;
  const description = cmd.named["description"]?.trim();
  if (description) parts.description = description;
  const grants = (cmd.named["grants"] ?? "").split(",").map(g => g.trim()).filter(Boolean)
    .map(g => { const [t, n] = g.split(":"); return { trait: t, rating: intOrUndef(n ?? "") ?? 1 }; })
    .filter(g => g.trait);
  if (grants.length) parts.grants = grants as TraitGrant[];
  const def = makeBackgroundDef(parts);
  const shadows = BackgroundRegistry.get(def.name) && !BackgroundRegistry.all().some(d => d.name === def.name && d !== def) ? "" : "";
  await BackgroundRegistry.put(def);
  const grantBits = (def.grants ?? []).map(g => `${disp(g.trait)} ${g.rating}`);
  return sys(`Defined background "${disp(def.name)}" (max ${def.max ?? 5})`
    + `${grantBits.length ? `, granting ${grantBits.join(", ")}` : ""}${shadows}. `
    + `Rate it with [[set-trait ${def.name} <n>]].`);
}

async function cmdForgetBackground(cmd: ParsedCommand): Promise<string> {
  const raw = cmd.positional[0]?.trim() ?? cmd.named["name"]?.trim();
  if (!raw) return sys(`forget-background needs a name.`);
  const key = StringUtil.normalize(raw);
  const removed = await BackgroundRegistry.remove(key);
  if (!removed) {
    return BackgroundRegistry.get(key)
      ? sys(`"${key}" is a built-in - it can be shadowed with [[define-background]] but not deleted.`)
      : sys(`No custom background "${key}".`);
  }
  return sys(`Forgot custom ${key}.${BackgroundRegistry.get(key) ? ` The built-in "${key}" resurfaces.` : ""}`);
}

// supernatural [category] - which families of power this character may have,
// what they hold in each, and whether anything hangs from a Discipline they do
// not have. Reports; enforces nothing.
async function cmdSupernatural(cmd: ParsedCommand, forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const which = cmd.positional[0]?.trim();
  const cats = DEFAULT_SUPERNATURAL_CATEGORIES;
  if (which) {
    const key = StringUtil.normalize(which);
    const cat = cats.find(c => StringUtil.normalize(c.name) === key);
    if (!cat) return sys(`No supernatural category "${which}". Known: ${cats.map(c => c.name).join(", ")}.`);
    const open = categoryOpenTo(cat, char.templates);
    const members = DEFAULT_SUPERNATURAL_TRAITS.filter(t => StringUtil.normalize(t.category) === key);
    const memberBits = members.map(m => `${m.name}${m.parent ? ` (needs ${disp(m.parent)})` : ""}`);
    return sys(`${cat.label ?? cat.name} - ${open ? `open to ${disp(char.name)}` : `NOT open to ${char.templates.join("+")}`}`
      + `${cat.templates?.length ? ` (templates: ${cat.templates.join(", ")})` : " (anyone)"}; `
      + `ratings live in the ${cat.bucket ?? "traits"} group.${cat.note ? ` ${cat.note}` : ""}`
      + `${memberBits.length ? ` Known: ${memberBits.join(", ")}.` : ""}`);
  }
  const lines: string[] = [];
  for (const cat of cats) {
    if (!categoryOpenTo(cat, char.templates)) continue;
    const bucket = (char[(cat.bucket ?? "traits") as keyof PlayableCharacter] ?? {}) as Record<string, number>;
    const held = Object.entries(bucket).filter(([, v]) => v > 0);
    const mine = held.filter(([n]) => {
      const def = supernaturalTraitOf(n);
      return def ? StringUtil.normalize(def.category) === StringUtil.normalize(cat.name) : cat.bucket === "disciplines";
    });
    lines.push(`${cat.label ?? cat.name}: ${mine.length ? mine.map(([n, v]) => `${disp(n)} ${v}`).join(", ") : "nothing yet"}`);
  }
  // A path that hangs from a Discipline the character does not have.
  const orphans: string[] = [];
  for (const [name, rating] of Object.entries({ ...char.traits, ...char.disciplines })) {
    if (rating <= 0) continue;
    const def = supernaturalTraitOf(name);
    if (!def?.parent) continue;
    if (resolveTraitFromRecord(char, def.parent) <= 0) orphans.push(`${disp(name)} needs ${disp(def.parent)}`);
  }
  if (orphans.length) lines.push(`⚠ ${orphans.join("; ")} (Storyteller-adjudicated)`);
  return sys(`${disp(char.name)} - ${lines.join("; ")}. [[show-supernatural <category>]] for one; `
    + `set a rating with [[set-trait <name> <n>]].`);
}

// costs [kind] - what a dot costs, from each purse. Prices are CHRONICLE rules
// (rules.ts DEFAULT_ADVANCEMENT_COSTS + the wod:config:costs card), never
// character data - which is why they are not on the sheet. Nothing evaluates
// them yet; this surfaces them for the Storyteller, and the advancement engine
// will read the same table when it lands.
async function cmdCosts(cmd: ParsedCommand): Promise<string> {
  const table = advancementCostsFrom(AdvancementCosts.current() as CostTable);
  const which = cmd.positional[0]?.trim();
  const priced = (purses: Record<string, string>): string =>
    COST_PURSES.filter(p => purses[p]).map(p => `${p} ${purses[p]}`).join(", ");
  if (which) {
    const key = StringUtil.normalize(which);
    const purses = table[key];
    if (!purses) return sys(`No cost kind "${which}". Known: ${Object.keys(table).join(", ")}.`);
    return sys(`${disp(key)} - ${priced(purses)}. "current" is the rating you raise FROM. `
      + `Storyteller-applied: the engine records prices, it does not spend for you.`);
  }
  const items = Object.entries(table).map(([kind, purses]) => `${disp(kind)}: ${priced(purses)}`).join("; ");
  return sys(`Advancement costs - ${items}. [[show-cost <kind>]] for one; edit them in the "${COSTS_CONFIG_ENTRY}" card. `
    + `A template may price its own purse instead ([[show-budget]] shows the one in force) - `
    + `"${NOT_PURCHASABLE}" there means that purse cannot be bought from at all. `
    + `🚧 maturation is recorded here and spent by nobody: there is no downtime engine yet.`);
}

// =============================================================================
// PLACES OF POWER - the sanctum, the library, and the cray within it
// -----------------------------------------------------------------------------
// Where a mage stands is mechanical: rating-scaled afflictions (in-sanctum /
// in-library, §rules.ts) fold their tiers into every roll, and a cray is a real
// site with points that run out. The Talisman ritual below is the door.
// =============================================================================
const LIBRARY_STATES = ["in-sanctum", "in-umbra", "in-library"];

// BEING SOMEWHERE IS AN AFFLICTION. That is the whole model: a sanctum grants
// no affordances of its own - it applies `in-sanctum`, and what THAT grants is
// data (rules.ts DEFAULT_AFFLICTIONS, editable as a story card, tier by tier
// against the character's rating). So the place verbs below are thin: they
// afflict and they lift, and every affordance stays describable without code.
const PLACES: Record<string, { states: string[]; needs: string; blurb: string }> = {
  sanctum: {
    states: ["in-sanctum"], needs: "sanctum",
    blurb: "his own place of power - what its rating grants is on the in-sanctum card",
  },
  library: {
    states: ["in-library"], needs: "library",
    blurb: "the shelves he knows - what its rating grants is on the in-library card",
  },
};

// enter <place> / exit <place>, shared: afflict or lift, and say what the place
// is doing right now rather than what it is.
async function enterPlace(key: string, enter: boolean): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const place = PLACES[key];
  const subject = StringUtil.normalize(char.name);
  if (enter) {
    const rating = effectiveTraitOf(char, place.needs);
    if (rating <= 0) {
      return sys(`${disp(char.name)} has no ${disp(place.needs)} to enter - rate one with `
        + `[[set-trait ${place.needs} <n>]], or it is somebody else's.`);
    }
    const applied: string[] = [];
    for (const state of place.states) {
      const def = AfflictionRegistry.get(state);
      if (!def) { applied.push(`⚠ "${state}" is not defined`); continue; }
      const r = await applyAffliction(subject, def, {});
      if (!r.error) applied.push(state);
    }
    return sys(`${disp(char.name)} enters his ${disp(key)} (${disp(place.needs)} ${rating}) - ${place.blurb}. `
      + `Now ${applied.join(" + ")}; [[show-affliction]] shows what it grants. Leave with [[exit-${key}]].`);
  }
  const lifted: string[] = [];
  for (const state of place.states) {
    const r = await removeAffliction(subject, state);
    if (!r.error) lifted.push(state);
  }
  if (!lifted.length) return sys(`${disp(char.name)} is not in his ${disp(key)}.`);
  return sys(`${disp(char.name)} leaves his ${disp(key)} (${lifted.join(", ")} lifted).`);
}

// The Talisman "Cosmos Within the Measure": ritually measure any door (ten
// minutes, no roll, no resource) and it opens onto the Library of the Unseen -
// an Umbral realm that is also the mage's sanctum, hence all three states.
async function cmdMeasureDoor(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  if (effectiveTraitOf(char, "library") <= 0) {
    return sys(`${disp(char.name)} has no Library to open a door onto (the Talisman measures the way to YOUR library).`);
  }
  const clock = await StoryClock.get();
  if (clock) await StoryClock.advance({ months: 0, seconds: 10 * 60 });
  for (const state of LIBRARY_STATES) {
    const def = AfflictionRegistry.get(state);
    if (def) await applyAffliction(StringUtil.normalize(char.name), def, {});
  }
  const when = clock ? ` Ten minutes pass (${formatStoryDate((await StoryClock.get())!.now)}).` : "";
  return sys(`${disp(char.name)} measures the door - jamb, lintel, threshold - and it opens onto the Library of the Unseen.${when} `
    + `Now ${LIBRARY_STATES.join(" + ")}; [[show-affliction]] shows what they grant. Leave with [[leave-library]].`);
}

async function cmdLeaveLibrary(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const lifted: string[] = [];
  for (const state of LIBRARY_STATES) {
    const r = await removeAffliction(StringUtil.normalize(char.name), state);
    if (!r.error) lifted.push(state);
  }
  if (!lifted.length) return sys(`${disp(char.name)} is not in the Library.`);
  return sys(`${disp(char.name)} steps back through the measured door (${lifted.join(", ")} lifted).`);
}

// One line of cray state, for the status command and after every draw.
function crayLine(char: PlayableCharacter, state: CrayState): string {
  const rating = CrayStore.rating(char);
  const status = state.status === "active" ? "" : ` - ${state.status.toUpperCase()}`;
  return `cray ${rating} (${state.points}/${CrayStore.capacity(char)} points${status})`;
}

async function cmdCray(forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  if (CrayStore.rating(char) <= 0) return sys(`${disp(char.name)} has no Cray (it is a Background - rate it on the sheet).`);
  const state = await CrayStore.get(char);
  const regen = state.status === "dead" ? "never regenerates"
    : state.status === "dormant" ? "1 point per YEAR (dormant)"
    : "1 point per day it goes untapped";
  return sys(`${disp(char.name)}'s ${crayLine(char, state)}: ${regen}. `
    + `[[harvest N]] to draw it ritually, [[absorb]] to tear it out (Wits + Foundation vs ${10 - CrayStore.rating(char)}).`);
}

// Draw `want` points out of the cray and into the mage. Shared by the ritual
// harvest and the dangerous absorption: both can OVERDRAW, and overdrawing is
// what breaks a site (a dot lost, then dormancy or death).
async function drawFromCray(char: PlayableCharacter, want: number, ctx: CommandContext): Promise<{ gained: number; notes: string[]; refuse?: string }> {
  const notes: string[] = [];
  const state = await CrayStore.get(char);
  if (state.status === "dead") return { gained: 0, notes, refuse: `the cray is dead - it will never give again` };
  const rating = CrayStore.rating(char);
  const day = Math.floor(((await StoryClock.get())?.now ?? 0) / 86400);
  const overdraw = Math.max(0, want - state.points);
  if (overdraw > rating) {
    return { gained: 0, notes, refuse: `the cray holds ${state.points} and can be forced ${rating} beyond that - ${want} would tear it apart entirely` };
  }

  const fromPool = await CrayStore.tap(char, want, day);
  let gained = fromPool;
  if (overdraw > 0) {
    // Past empty: the site itself pays. A dot goes, and its own (reduced)
    // rating decides whether it recovers, sleeps for years, or dies.
    gained += overdraw;
    const reduced = Math.max(0, rating - 1);
    char.backgrounds = { ...char.backgrounds, cray: reduced };
    await CharacterStore.save(char);
    const exec = runRoll(makeRollSpec({ pool: `${reduced}`, difficulty: 8 }), () => 0, { rng: ctx.rng });
    const status: CrayState["status"] = exec.outcome === "botch" ? "dead" : exec.met ? "active" : "dormant";
    await CrayStore.set(char, { points: 0, status, lastTapDay: day });
    notes.push(`OVERDRAWN by ${overdraw}: the cray drops to ${reduced} dot${reduced === 1 ? "" : "s"} and is drained`);
    notes.push(exec.result!.message);
    notes.push(status === "dead" ? `💀 the cray DIES - it will never generate Quintessence again`
      : status === "dormant" ? `the cray falls DORMANT - one point per year until it wakes`
      : `the cray survives, depleted, and will refill at its normal rate`);
  }
  const def = CharacterResources.resolveDef(char, "magic-fuel");
  if (!def) return { gained: 0, notes, refuse: `has no magic-fuel resource to hold Quintessence` };
  const before = await CharacterResources.current(char, def);
  const { value } = await CharacterResources.gain(char, def.name, gained);
  notes.push(value - before < gained
    ? `${value - before} of ${gained} fit - ${def.name} is at ${value}/${resourceNumbers(char, def).max}, the rest spills`
    : `+${gained} ${def.name} -> ${value}/${resourceNumbers(char, def).max}`);
  return { gained, notes };
}

// The ritual method: no roll, the mage controls exactly how much - but it is
// time-consuming (pass time= to advance the clock with it).
async function cmdHarvest(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  if (CrayStore.rating(char) <= 0) return sys(`${disp(char.name)} has no Cray to harvest.`);
  const want = Math.max(1, parseInt(cmd.positional[0] ?? "1", 10) || 1);
  const r = await drawFromCray(char, want, ctx);
  if (r.refuse) return sys(`${disp(char.name)} can't harvest ${want}: ${r.refuse}.`);
  let timeNote = "";
  const timeArg = cmd.named["time"]?.trim();
  if (timeArg) {
    const dur = parseDuration(timeArg);
    if ("error" in dur) return sys(dur.error);
    const before = await StoryClock.get();
    if (before) {
      const after = (await StoryClock.advance(dur))!;
      timeNote = ` The ritual takes until ${formatStoryDate(after.now)}.`;
      timeNote += await applyRecovery(before.now, after.now);
    }
  }
  const state = await CrayStore.get(char);
  return sys(`${disp(char.name)} harvests the cray - ${r.notes.join("; ")}. Now ${crayLine(char, state)}.${timeNote}`);
}

// The dangerous method: tear it out directly. Wits + Foundation vs 10 - rating,
// one point per success - and the mage must absorb everything drawn.
async function cmdAbsorb(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const rating = CrayStore.rating(char);
  if (rating <= 0) return sys(`${disp(char.name)} has no Cray to draw from.`);
  const found = resolveFoundation(cmd.named["foundation"], (n: string) => resolveTraitFromRecord(char, n));
  const spec = makeRollSpec({ pool: `wits+${found.trait}`, difficulty: Math.max(2, 10 - rating), tags: ["magic"] });
  const { exec, notes } = await execCharacterRoll(char, spec, ctx);
  const net = exec.outcome === "botch" ? 0 : Math.max(0, exec.result?.net ?? 0);
  if (net <= 0) {
    return sys(`${disp(char.name)} reaches into the cray - ${formatExecution(exec)}${notes.length ? ` [${notes.join("; ")}]` : ""}. Nothing comes.`);
  }
  const r = await drawFromCray(char, net, ctx);
  if (r.refuse) return sys(`${disp(char.name)} draws ${net} - but ${r.refuse}.`);
  const state = await CrayStore.get(char);
  return sys(`${disp(char.name)} tears ${net} point${net === 1 ? "" : "s"} from the cray - ${formatExecution(exec)} - ${r.notes.join("; ")}. Now ${crayLine(char, state)}.`);
}

// Search the library: Intelligence + Library, the Storyteller setting the
// difficulty by how obscure the secret is. What the pages SAY is theirs to
// narrate; the roll says how much of it the mage finds.
async function cmdResearch(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const topic = cmd.positional.join(" ").trim() || cmd.named["topic"]?.trim();
  if (!topic) return sys(`research needs a topic, e.g. [[research \`the seals of Belial\` difficulty=8]].`);
  const rating = effectiveTraitOf(char, "library");
  if (rating <= 0) return sys(`${disp(char.name)} has no Library to search.`);
  const present = (await CharacterAfflictions.list(char.name)).some(a => a.def === "in-library");
  if (!present) return sys(`${disp(char.name)} is not in their library - [[measure-door]] opens the way, or [[afflict in-library]] if they are simply there.`);
  const difficulty = parseInt(cmd.named["difficulty"] ?? "6", 10) || 6;
  const spec = makeRollSpec({ pool: "intelligence+library", difficulty, tags: (cmd.named["tags"] ?? "").split(",").map(t => t.trim()).filter(Boolean) });
  const { exec, notes } = await execCharacterRoll(char, spec, ctx);
  const found = exec.outcome === "botch" ? "the sources contradict each other - worse than nothing"
    : exec.met ? `${exec.result!.net} success${exec.result!.net === 1 ? "" : "es"} of material - the Storyteller says what it says`
    : "nothing useful surfaces";
  return sys(`${disp(char.name)} searches the library for "${topic}" - ${formatExecution(exec)}${notes.length ? ` [${notes.join("; ")}]` : ""}. ${found}.`);
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
  if (!char) return noCharacter();
  const raw = cmd.positional[0]?.trim();
  if (!raw) return sys(`spend needs a resource, e.g. [[spend willpower]], [[spend blood:heal 2]] or [[spend blood:boost strength 2]].`);
  const [which, effectName] = raw.split(":").map(s => s.trim());
  const def = CharacterResources.resolveDef(char, which);
  if (!def) return sys(`${disp(char.name)} has no resource "${which}".`);
  // Having the points and being able to burn them are different questions, and
  // this is where they come apart: a talisman may hand anyone a pool.
  const blocked = CharacterResources.cannotUse(char, def);
  if (blocked.length) {
    return sys(`${disp(char.name)} holds ${def.name} but cannot use it - that needs ${blocked.join(", ")} `
      + `(${blocked.map(b => capabilityNote(b)).filter(Boolean).join("; ") || "no rule the engine knows"}). `
      + `[[attune ${blocked[0]}]] if something granted it to him.`);
  }
  const e = resourceEffect(def, effectName || undefined);
  if (effectName && !e) return sys(`${def.name} has no "${effectName}" effect.`);

  if (!e) {
    // No effect configured: plain deduction (with optional reason).
    const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
    const { spent } = await CharacterResources.spend(char, which, amount);
    if (spent === 0) return sys(`${disp(char.name)} has no ${def.name} to spend.`);
    const now = await CharacterResources.current(char, def);
    const reason = cmd.named["reason"] ? ` (${cmd.named["reason"]})` : "";
    return sys(`${disp(char.name)} spends ${spent} ${def.name}${reason}. Now ${now}/${resourceNumbers(char, def).max}.`);
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
  return sys(`${disp(char.name)} - ${r.notes.join("; ")}. ${def.name} now ${now}/${resourceNumbers(char, def).max}.${tail}`);
}

async function cmdResetUses(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  await EffectUses.resetAll(char);
  return sys(`${disp(char.name)}'s effect-use counters reset (new scene/turn).`);
}

async function cmdDamage(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const severity = (cmd.positional[0] ?? "").trim().toLowerCase();
  if (severity !== "bashing" && severity !== "lethal" && severity !== "aggravated") {
    return sys(`damage needs a severity (bashing, lethal or aggravated), e.g. [[damage lethal 2]].`);
  }
  const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
  const summary = await CharacterHealth.damage(char, severity, amount);
  return sys(`${disp(char.name)} takes ${amount} ${severity}. Health: ${healthLine(summary)}.`);
}

async function cmdHealth(forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const summary = await CharacterHealth.summary(char);
  const boosts = await CharacterBoosts.all(char);
  const boostBits = Object.entries(boosts).map(([k, v]) => `${StringUtil.toTitleCase(k)} +${v}`).join(", ");
  return sys(`${disp(char.name)} - ${healthLine(summary)}${boostBits ? `. Boosts: ${boostBits}` : ""}.`);
}

async function cmdClearBoosts(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  await CharacterBoosts.clear(char);
  return sys(`${disp(char.name)}'s attribute boosts fade.`);
}

async function cmdConfigureResources(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter(`first - the wizard configures the resources your templates grant`);
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
  if (!char) return noCharacter();
  const which = cmd.positional[0]?.trim();
  if (!which) return sys(`gain needs a resource, e.g. [[gain willpower]].`);
  const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
  const def = CharacterResources.resolveDef(char, which);
  if (!def) return sys(`${disp(char.name)} has no resource "${which}".`);
  const { value } = await CharacterResources.gain(char, which, amount);
  return sys(`${disp(char.name)} regains ${def.name}. Now ${value}/${resourceNumbers(char, def).max}.`);
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

// Roll one side of a contest. A named character rolls live (traits + boosts +
// wound penalty); an ad-hoc side rolls its pool with a zero resolver, so only
// literal numbers count. A char that no longer exists degrades to ad-hoc.
// Every side of a contest rolls, in order. A named character rolls live off its
// own sheet; an ad-hoc side rolls literals. One place, because three callers
// need it and a field of five must not be spelled out at each.
async function rollContestSides(sides: ContestSide[], ctx: CommandContext, overrides?: (side: ContestSide, i: number) => RollSpec): Promise<RollExecution[]> {
  const out: RollExecution[] = [];
  for (const [i, side] of sides.entries()) {
    out.push(await execContestSide(overrides ? overrides(side, i) : side.base, side.char, ctx.rng));
  }
  return out;
}

// Apply one round, persist it, and keep the "current contest" pointer honest:
// an open contest becomes the current one, a finished one stops being it. The
// three callers used to hand-roll this, and the two that OPEN a contest forgot
// to clear the pointer when a contest ended on its first round.
async function commitContestRound(contest: ExtendedContest, execs: RollExecution[]): Promise<{ after: ExtendedContest; note: string; tail: string }> {
  const { contest: after, note } = applyContestRound(contest, execs);
  await ExtendedContestStore.save(after);
  if (after.status === CONTEST_OPEN) await ExtendedContestStore.setCurrent(after.id);
  else if ((await ExtendedContestStore.currentId()) === after.id) await ExtendedContestStore.clearCurrent();
  const tail = after.status === CONTEST_OPEN ? ` Continue with [[continue-contest]] (id ${after.id}).` : "";
  return { after, note, tail };
}

async function execContestSide(base: RollSpec, charName: string | undefined, rng: Rng | undefined, extra?: Partial<RollModifier>): Promise<RollExecution> {
  if (charName) {
    const c = await CharacterStore.load(charName);
    if (c) {
      const env = await characterRollEnv(c);
      const spec = await withAfflictionTags(c.name, base);
      // Owned passives (Trait Affinity et al.) apply to contest sides too.
      const passive = passiveRollExtra(c, poolTraitsOf(c, spec.pool), spec.tags, undefined, await CharacterAfflictions.ops(c.name));
      const merged: Partial<RollModifier> = { ...(extra ?? {}) };
      if (passive.extra.difficultyMod) merged.difficultyMod = (merged.difficultyMod ?? 0) + passive.extra.difficultyMod;
      if (passive.extra.diceMod) merged.diceMod = (merged.diceMod ?? 0) + passive.extra.diceMod;
      if (passive.extra.autoSuccesses) merged.autoSuccesses = (merged.autoSuccesses ?? 0) + passive.extra.autoSuccesses;
      if (passive.extra.nAgain !== undefined) merged.nAgain = Math.min(merged.nAgain ?? 10, passive.extra.nAgain);
      if (env.penalty !== 0) merged.diceMod = (merged.diceMod ?? 0) + env.penalty;
      return runRoll(spec, env.resolver, { rng, extra: merged, usedTags: passive.usedTags });
    }
  }
  return runRoll(base, () => 0, { rng, extra });
}

// From the actor's side, what does a table read? The actor's winning margin (the
// successes that actually land) at "success"; an actor botch reads as botch; any
// non-win (resisted, out-contested, tie) reads as failure.
function contestTableInput(o: FieldOutcome, actor: string): { outcome: RollOutcomeKind; successes: number } {
  const mine = o.standings.find(s => StringUtil.normalize(s.name) === StringUtil.normalize(actor));
  if (mine?.botch) return { outcome: "botch", successes: 0 };
  // Sharing the top with somebody is not winning it.
  if (o.winners.length !== 1 || StringUtil.normalize(o.winners[0]) !== StringUtil.normalize(actor)) {
    return { outcome: "failure", successes: 0 };
  }
  return { outcome: "success", successes: o.margin };
}

// THE OPPOSITION - one name or SEVERAL. `vs=` takes a comma-separated list, so
// two men wrestling and five thieves reaching for the same purse are the same
// command with a longer argument. Each entry is a character, an @alias, or a
// bare label (an ad-hoc side that rolls only literal numbers). No vs= at all
// leaves one ad-hoc opponent, exactly as before.
interface Opponent { char?: PlayableCharacter; name: string }
async function resolveOpponents(cmd: ParsedCommand, mode: ContestMode): Promise<{ error?: string; all: Opponent[] }> {
  const raw = (cmd.named["vs"] ?? "").split(",").map(t => t.trim()).filter(Boolean);
  if (!raw.length) {
    return { all: [{ name: mode === "resisted" ? "the-resistance" : "the-opposition" }] };
  }
  const all: Opponent[] = [];
  for (const token of raw) {
    let arg = token;
    if (arg.startsWith("@")) {
      const ref = await resolveCharacterRef(arg);
      if (ref.error) return { error: ref.error, all: [] };
      arg = ref.name!;
    }
    const char = await CharacterStore.load(arg);
    const name = char ? char.name : arg;
    // The same name twice would make the standings ambiguous, and it is always
    // a typo rather than a man contesting himself.
    if (all.some(o => StringUtil.normalize(o.name) === StringUtil.normalize(name))) {
      return { error: `"${name}" is named twice in vs= - each side contests once.`, all: [] };
    }
    all.push({ char, name });
  }
  return { all };
}

// The pool each opponent rolls. `vs-pool=` may give one per opponent (in vs=
// order) or a single pool everyone rolls; failing that they all roll the pool
// given positionally, which is the two-sided form unchanged.
function opponentPools(cmd: ParsedCommand, shared: string, count: number): string[] {
  const listed = (cmd.named["vs-pool"] ?? "").split(",").map(t => t.trim()).filter(Boolean);
  if (!listed.length) return Array.from({ length: count }, () => shared);
  if (listed.length === 1) return Array.from({ length: count }, () => listed[0]);
  return Array.from({ length: count }, (_, i) => listed[i] ?? shared);
}

// Run ONE resisted/contested round against ANY NUMBER of opponents: the actor
// rolls mySpec through the live env (spend + wound penalty, exactly like
// [[roll spend=...]]), every opponent rolls its own, compareField adjudicates,
// and a table (override or a saved sidecar) reads the actor's winning margin.
// Returns a BODY string (the caller wraps it in sys - so a procedure can append
// its next-steps inside the same reply).
async function runSingleContest(mode: ContestMode, me: PlayableCharacter, mySpec: RollSpec, theirSpecs: Array<{ spec: RollSpec; opp: Opponent }>, cmd: ParsedCommand, ctx: CommandContext, tableOverride?: string): Promise<string> {
  const spend = await applySpend(me, cmd, ctx, mySpec.tags, poolTraitsOf(me, mySpec.pool));
  if (spend.refuse) return `${disp(me.name)} can't: ${spend.refuse}.`;
  const myExtra: Partial<RollModifier> = { ...(spend.extra ?? {}) };
  const myEnv = await characterRollEnv(me);
  if (myEnv.penalty !== 0) myExtra.diceMod = (myExtra.diceMod ?? 0) + myEnv.penalty;
  const myExec = runRoll(mySpec, myEnv.resolver, { rng: ctx.rng, extra: myExtra });
  const entrants: ContestEntrant[] = [{ name: me.name, exec: myExec }];
  const shown = [`${disp(me.name)}: ${formatExecution(myExec)}`];
  for (const { spec, opp } of theirSpecs) {
    const exec = await execContestSide(spec, opp.char?.name, ctx.rng);
    entrants.push({ name: opp.name, exec });
    shown.push(`${disp(opp.name)}: ${formatExecution(exec)}`);
  }
  const field = compareField(mode, entrants);
  // The table still reads the ACTOR's result - a table says what HIS margin
  // bought, and the field only changes who he had to beat.
  const t = contestTableInput(field, me.name);
  const standing = entrants.length > 2 ? `standings ${describeStandings(field)}` : "";
  const notes = [field.note, standing, await tableNote(tableOverride ?? cmd.named["table"], t.outcome, t.successes), spend.note].filter(Boolean).join("; ");
  return `${mode}${entrants.length > 2 ? ` (${entrants.length} ways)` : ""} - ${shown.join(" vs ")} - ${notes}`;
}

async function cmdVersus(mode: ContestMode, cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const me = await CharacterStore.getCurrent();
  if (!me) return noCharacter();
  const myPool = cmd.positional[0]?.trim();
  const theirPool = cmd.positional[1]?.trim();
  const verb = mode === "resisted" ? "resist" : "contest";
  // The opposition's pool comes from the second positional OR from vs-pool=
  // (which is what a field of several with different pools needs).
  if (!myPool || (!theirPool && !cmd.named["vs-pool"]?.trim())) {
    return sys(`${verb} needs your pool and the opposition's, e.g. [[${verb} dexterity+stealth perception+alertness vs="Erik"]]. `
      + `More than one opposing: vs="Erik,Rok,Sigrid" - they all roll the second pool, or vs-pool="a,b,c" gives each its own.`);
  }
  const opp = await resolveOpponents(cmd, mode);
  if (opp.error) return sys(`${opp.error}`);
  const myTags = cmd.named["tags"] ? cmd.named["tags"].split(",").map(t => t.trim()).filter(Boolean) : undefined;
  const mySpec = await withAfflictionTags(me.name, makeRollSpec({ pool: myPool, difficulty: intOrUndef(cmd.named["difficulty"] ?? cmd.named["diff"]), tags: myTags }));
  const vsDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
  const pools = opponentPools(cmd, theirPool ?? "", opp.all.length);
  const theirSpecs = opp.all.map((o, i) => ({ opp: o, spec: makeRollSpec({ pool: pools[i], difficulty: vsDiff }) }));
  return sys(await runSingleContest(mode, me, mySpec, theirSpecs, cmd, ctx));
}

// Invoke a saved OPPOSED roll: the save holds the actor's shape + the opposition
// descriptor (mode, opposing pool, default vs-difficulty); the OPPONENT is play-
// time input (vs=). opposed+extended launches an extended contest instead. Any
// `steps` are surfaced after the round (procedure composition).
async function launchOpposedFromSaved(char: PlayableCharacter, name: string, saved: SavedRoll, cmd: ParsedCommand, args: Partial<RollSpec>, ctx: CommandContext): Promise<string> {
  const opp = saved.opposed!;
  const mySpec = await withAfflictionTags(char.name, overrideSpec(saved, args));
  const oppRes = await resolveOpponents(cmd, opp.mode);
  if (oppRes.error) return sys(`${oppRes.error}`);
  const theirPool = (cmd.named["vs-pool"] ?? "").split(",")[0]?.trim() || opp.pool || mySpec.pool;
  const theirDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]) ?? opp.vsDifficulty;
  if (opp.extended) return launchOpposedExtended(char, name, saved, opp, mySpec, theirPool, theirDiff, oppRes, cmd, args, ctx);
  const pools = opponentPools(cmd, theirPool, oppRes.all.length);
  const theirSpecs = oppRes.all.map((o, i) => ({ opp: o, spec: makeRollSpec({ pool: pools[i], difficulty: theirDiff }) }));
  const body = await runSingleContest(opp.mode, char, mySpec, theirSpecs, cmd, ctx, saved.table);
  return sys(`${body}${surfaceSteps(saved.steps, undefined)}`);
}

// opposed + extended = an extended contest (a race like Pursuit). Both race to a
// play-time `target`; `rounds`/`intervals` cap it (falling back to the save).
async function launchOpposedExtended(char: PlayableCharacter, name: string, saved: SavedRoll, opp: OpposedSavedConfig, mySpec: RollSpec, theirPool: string, theirDiff: number | undefined, oppRes: { all: Opponent[] }, cmd: ParsedCommand, args: Partial<RollSpec>, ctx: CommandContext): Promise<string> {
  const cfg = opp.extended!;
  const target = args.requires ?? intOrUndef(cmd.named["target"]);
  if (target === undefined || target < 1) {
    return sys(`"${name}" is an extended contest - give it a target, e.g. [[roll @${name} requires=5 vs="Erik"]] (the successes = winning the race).`);
  }
  const maxRounds = intOrUndef(cmd.named["rounds"] ?? cmd.named["intervals"]) ?? cfg.intervals;
  if (maxRounds === undefined || maxRounds < 1) return sys(`"${name}" needs rounds=<max> (its save defines none), e.g. [[roll @${name} requires=${target} rounds=5 vs="Erik"]].`);
  const aSpec = makeRollSpec({ ...mySpec, requires: 1 });
  const pools = opponentPools(cmd, theirPool, oppRes.all.length);
  const contest: ExtendedContest = {
    id: api.v1.uuid(), label: cmd.named["label"] ?? name,
    sides: [
      { name: char.name, base: aSpec, accumulated: 0, char: char.name },
      ...oppRes.all.map((o, i) => ({
        name: o.name, base: makeRollSpec({ pool: pools[i], difficulty: theirDiff, requires: 1 }),
        accumulated: 0, char: o.char?.name,
      })),
    ],
    target, maxRounds,
    interval: cmd.named["interval"] ?? cfg.interval ?? "",
    onBotch: cmd.named["on-botch"] ? parseBotchPolicy(cmd.named["on-botch"]) : (cfg.onBotch ?? "fail"),
    rounds: 0, status: CONTEST_OPEN, log: [],
  };
  const execs = await rollContestSides(contest.sides, ctx);
  const { after, note, tail } = await commitContestRound(contest, execs);
  return sys(`${disp(char.name)} opens ${describeContest(after)}. Round 1: ${note}.${tail}${surfaceSteps(saved.steps, undefined)}`);
}

const cmdResist: CommandHandler = (cmd, ctx) => cmdVersus("resisted", cmd, ctx);
const cmdContest: CommandHandler = (cmd, ctx) => cmdVersus("contested", cmd, ctx);

// =============================================================================
// EXTENDED CONTESTS - both sides accumulate across rounds; first to the goal wins
// =============================================================================
async function cmdExtendedContest(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const me = await CharacterStore.getCurrent();
  if (!me) return noCharacter();
  const myPool = cmd.positional[0]?.trim();
  const theirPool = cmd.positional[1]?.trim();
  if (!myPool || !theirPool) {
    return sys(`extended-contest needs both pools, e.g. [[extended-contest wits+melee wits+melee vs="Erik" target=5 rounds=5]]. `
      + `vs= takes a LIST for a race with more than two in it: vs="Erik,Rok,Sigrid".`);
  }
  const opp = await resolveOpponents(cmd, "contested");
  if (opp.error) return sys(`${opp.error}`);

  const target = intOrUndef(cmd.named["target"] ?? cmd.named["requires"]) ?? 0;
  if (target < 1) return sys(`extended-contest needs target=<successes> (the goal both race to).`);
  const maxRounds = intOrUndef(cmd.named["rounds"] ?? cmd.named["intervals"]) ?? 0;
  if (maxRounds < 1) return sys(`extended-contest needs rounds=<max> (at least 1).`);

  const aSpec = makeRollSpec({ pool: myPool, difficulty: intOrUndef(cmd.named["difficulty"] ?? cmd.named["diff"]), requires: 1 });
  const vsDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
  const pools = opponentPools(cmd, theirPool, opp.all.length);
  const contest: ExtendedContest = {
    id: api.v1.uuid(),
    label: cmd.named["label"] ?? "",
    sides: [
      { name: me.name, base: aSpec, accumulated: 0, char: me.name },
      ...opp.all.map((o, i) => ({
        name: o.name, base: makeRollSpec({ pool: pools[i], difficulty: vsDiff, requires: 1 }),
        accumulated: 0, char: o.char?.name,
      })),
    ],
    target, maxRounds,
    interval: cmd.named["interval"] ?? "",
    onBotch: parseBotchPolicy(cmd.named["on-botch"]),
    rounds: 0, status: CONTEST_OPEN, log: [],
  };
  const execs = await rollContestSides(contest.sides, ctx);
  const { after, note, tail } = await commitContestRound(contest, execs);
  return sys(`${disp(me.name)} opens ${describeContest(after)}. Round 1: ${note}.${tail}`);
}

async function cmdContinueContest(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return sys(`No open contest. Start one with [[extended-contest ...]] or name its id.`);
  if (contest.status !== CONTEST_OPEN) {
    const who = contest.status === CONTEST_DRAW ? "a draw" : `won by ${disp(contest.status)}`;
    return sys(`That contest is already ${who}.`);
  }
  // The ACTOR (side 0) takes this round's roll overrides; every other side may
  // be re-difficultied at once with vs-difficulty=, as before.
  const mine = rollOverridesFromNamed(cmd);
  const vDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
  const execs = await rollContestSides(contest.sides, ctx, (side, i) =>
    i === 0 ? overrideSpec(side.base, mine)
      : vDiff !== undefined ? overrideSpec(side.base, { difficulty: vDiff }) : side.base);
  const { after, note } = await commitContestRound(contest, execs);
  return sys(`${describeContest(after)}. This round: ${note}.`);
}

async function cmdContestStatus(cmd: ParsedCommand): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return sys(`No extended contest found. Start one with [[extended-contest ...]].`);
  const recent = contest.log.slice(-3)
    .map(l => `r${l.round}: ${Object.entries(l.nets ?? {}).map(([n, v]) => `${disp(n)} +${v}`).join("/")}`)
    .join(", ");
  return sys(`${describeContest(contest)}${recent ? ` | recent: ${recent}` : ""}.`);
}

async function cmdCancelContest(cmd: ParsedCommand): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return sys(`No extended contest to cancel.`);
  await ExtendedContestStore.remove(contest.id);
  if ((await ExtendedContestStore.currentId()) === contest.id) await ExtendedContestStore.clearCurrent();
  const progress = contest.sides.map(s => `${disp(s.name)} ${s.accumulated}/${contest.target}`).join(" vs ");
  return sys(`Cancelled contest${contest.label ? ` "${contest.label}"` : ""} (was ${progress}).`);
}

// =============================================================================
// TIME - the story clock: set when it begins, advance it, read it, bookmark &
// measure. Real Gregorian dates (core/time.ts); the clock lives in storyStorage.
// =============================================================================
const NO_CLOCK = `No story clock yet - set when the story begins with [[story-start 1197-03-15-08]] (yyyy-mm-dd-hh).`;

// Resolve a date token for [[show-time-between]]: a saved bookmark, "now", "start",
// or an ad-hoc yyyy-mm-dd-hh literal.
async function resolveDateToken(tok: string): Promise<{ epoch?: number; label: string; error?: string }> {
  const t = tok.trim();
  const lc = t.toLowerCase();
  if (lc === "now" || lc === "start") {
    const c = await StoryClock.get();
    if (!c) return { label: t, error: NO_CLOCK };
    return { epoch: lc === "now" ? c.now : c.start, label: lc };
  }
  const saved = await DateBook.get(t);
  if (saved !== undefined) return { epoch: saved, label: StringUtil.normalize(t) };
  const parsed = parseStoryDate(t);
  if (typeof parsed === "number") return { epoch: parsed, label: formatStoryDate(parsed) };
  return { label: t, error: `"${t}" is not a saved date, "now"/"start", or a yyyy-mm-dd-hh date.` };
}

async function cmdStoryStart(cmd: ParsedCommand): Promise<string> {
  const parsed = parseStoryDate(cmd.positional[0]);
  if (typeof parsed !== "number") return sys(parsed.error);
  const s = await StoryClock.setStart(parsed);
  return sys(`The story begins ${formatStoryDate(s.start)}. Move time with [[advance-time 1d]]; read it with [[show-date]].`);
}

// Clock-driven recovery: credit every character's recovery-bearing resources
// for the day boundaries and full moons crossed in (from, to]. Gated rules
// (`requires`) check the character's ACTIVE afflictions (def names and tags -
// "in-umbra" for Umbral communion). Returns "" when nothing was credited (a
// short hop inside one day, or everyone already full).
// AFFLICTIONS IN TIME, half one: the CLOCK side. Anything whose expiry has run
// out at `now` is lifted - through removeAffliction, so a mirror on somebody
// else goes with it. Every character, not just the current one: a curse on an
// absent NPC ends whether or not anyone was looking at his sheet.
// "UNTIL X", decided. The condition sees the CHARACTER plus the handful of
// clock facts an affliction cares about, all measured from when it began - so
// `full-moons >= 1` is "until the next full moon" and `blood <= 0` is "until his
// blood runs out". A condition the engine cannot read is FALSE and says so:
// nothing ends because a card was malformed.
// The TIME NAMESPACE, `system::time::…` (the parser folds `::` to `:`).
// Everything the clock can tell an expression lives under one prefix, so a
// chronicle can see at a glance which names are the engine's and which are its
// own traits. Two forms of each fact, and the short one is the point:
//
//   system:time:full-moons-since(a, b)   the general function, any two dates
//   system:time:full-moons               the same, with a = when this began
//                                        and b = now, filled in implicitly
//   full-moons                           the bare shorthand, for readability
//
// Dates come from anywhere a date can: an epoch literal, or a SAVED date by
// name (`system:time:date:my-wedding`, from the DateBook that [[save-date]]
// writes). So "until the full moon after the wedding" is expressible without
// anyone hard-coding a number.
const TIME_PREFIX = "system:time";
async function timeScopeExtension(fromEpoch: number, now: number): Promise<ScopeExtension> {
  const dates = await DateBook.all();
  const facts: Record<string, number> = {
    now, applied: fromEpoch,
    "full-moons": countFullMoons(fromEpoch, now),
    "elapsed-days": countDayBoundaries(fromEpoch, now),
    "elapsed-hours": Math.floor((now - fromEpoch) / 3600),   // the story clock counts SECONDS
  };
  return (path) => {
    // The bare shorthands, so a condition reads like English.
    if (path.length === 1 && path[0] in facts) return { value: facts[path[0]] };
    const joined = path.join(":");
    if (!joined.startsWith(`${TIME_PREFIX}:`)) return undefined;
    const rest = joined.slice(TIME_PREFIX.length + 1);
    if (rest in facts) return { value: facts[rest], from: TIME_PREFIX };
    // A SAVED date by name - the same book [[show-date]] lists.
    const named = rest.startsWith("date:") ? dates[rest.slice("date:".length)] : undefined;
    return named === undefined ? undefined : { value: named, from: "saved date" };
  };
}

// The general functions, taking any two dates. `-since` reads left to right:
// how many of these fell between the first and the second.
function timeScopeCalls(): (name: string, args: number[]) => number | undefined {
  return (name, args) => {
    if (!name.startsWith(`${TIME_PREFIX}:`)) return undefined;
    const [a, b] = [args[0] ?? 0, args[1] ?? 0];
    switch (name.slice(TIME_PREFIX.length + 1)) {
      case "full-moons-since": return countFullMoons(a, b);
      case "days-since": return countDayBoundaries(a, b);
      case "hours-since": return Math.floor((b - a) / 3600);
      default: return undefined;
    }
  };
}

// One scope for anything asked "has this run out yet?" - an affliction's
// until-condition, and a cooldown's.
async function timedScope(char: PlayableCharacter | undefined, fromEpoch: number, now: number): Promise<ExprScope> {
  const extend = await timeScopeExtension(fromEpoch, now);
  const calls = timeScopeCalls();
  const base = char ? characterScope(char, extend) : { lookup: extend, call: undefined };
  return {
    lookup: base.lookup,
    // The time functions answer first; the character's own (trait-max,
    // road-virtues) answer for everything else.
    call: (name: string, args: number[]) => calls(name, args) ?? base.call?.(name, args),
  };
}

async function expiryCondition(char: PlayableCharacter | undefined, c: { expiry?: AfflictionExpiry; at?: number }, now: number): Promise<boolean> {
  if (!c.expiry?.untilExpr) return false;
  const scope = await timedScope(char, c.at ?? now, now);
  return evaluateCondition(c.expiry.untilExpr, scope).truth;
}

// Has this instance ended, by any of its measures at once?
async function afflictionEnded(char: PlayableCharacter | undefined, c: ActiveAffliction, now: number): Promise<boolean> {
  if (!c.expiry) return false;
  return expiryElapsed(c.expiry, now, await expiryCondition(char, c, now));
}

async function expireAfflictions(now: number): Promise<string[]> {
  const lifted: string[] = [];
  for (const name of await CharacterStore.listNames()) {
    const char = await CharacterStore.load(name);
    for (const c of await CharacterAfflictions.list(name)) {
      if (!(await afflictionEnded(char ?? undefined, c, now))) continue;
      const r = await removeAffliction(name, c.def);
      if (r.removed) lifted.push(`${disp(name)}: ${disp(c.def)} ends${r.alsoLifted ? ` (and ${disp(r.alsoLifted)})` : ""}`);
    }
  }
  return lifted;
}

// AFFLICTIONS IN TIME, half two: the ROLL side. A roll spends a charge only on
// the afflictions whose filter it matches ("your next three MELEE rolls"), and
// whatever hits zero is lifted right here - so the reply that says the roll
// happened is the same reply that says the effect ended.
async function spendAfflictionCharges(subject: string, tags: string[], poolTraits: string[]): Promise<string[]> {
  const active = await CharacterAfflictions.list(subject);
  if (!active.some(c => c.expiry?.rolls !== undefined)) return [];
  const notes: string[] = [];
  const next = active.map(c => {
    if (c.expiry?.rolls === undefined || !rollSpendsCharge(c.expiry, tags, poolTraits)) return c;
    return { ...c, expiry: { ...c.expiry, rolls: c.expiry.rolls - 1 } };
  });
  await CharacterAfflictions.replace(subject, next);
  await countDownCooldowns("rolls", 1, subject);
  const now = (await StoryClock.get())?.now ?? 0;
  const char = await CharacterStore.load(subject);
  for (const c of next) {
    if (!c.expiry) continue;
    if (await afflictionEnded(char ?? undefined, c, now)) {
      const r = await removeAffliction(subject, c.def);
      if (r.removed) notes.push(`${disp(c.def)} ends${r.alsoLifted ? ` (and ${disp(r.alsoLifted)})` : ""}`);
    } else if (c.expiry.rolls !== undefined && active.find(a => a.def === c.def)?.expiry?.rolls !== c.expiry.rolls) {
      notes.push(`${disp(c.def)}: ${c.expiry.rolls} roll${c.expiry.rolls === 1 ? "" : "s"} left`);
    }
  }
  return notes;
}

// The TURN and SCENE sides. Same shape as the roll charges: decrement, then
// lift whatever ended - across every character, since a scene ends for the
// whole table and not only for whoever is selected.
async function countDownAfflictions(field: "turns" | "scenes", n: number): Promise<string[]> {
  const ended: string[] = [];
  await countDownCooldowns(field, n);
  const now = (await StoryClock.get())?.now ?? 0;
  for (const name of await CharacterStore.listNames()) {
    const active = await CharacterAfflictions.list(name);
    if (!active.some(c => c.expiry?.[field] !== undefined)) continue;
    const next = active.map(c => c.expiry?.[field] === undefined
      ? c
      : { ...c, expiry: { ...c.expiry, [field]: c.expiry[field]! - n } });
    await CharacterAfflictions.replace(name, next);
    const char = await CharacterStore.load(name);
    for (const c of next) {
      if (!(await afflictionEnded(char ?? undefined, c, now))) continue;
      const r = await removeAffliction(name, c.def);
      if (r.removed) ended.push(`${disp(name)}: ${disp(c.def)} ends`);
    }
  }
  return ended;
}

async function applyRecovery(fromEpoch: number, toEpoch: number): Promise<string> {
  const days = countDayBoundaries(fromEpoch, toEpoch);
  const moons = countFullMoons(fromEpoch, toEpoch);
  if (days <= 0 && moons <= 0) return "";
  const lines: string[] = [];
  for (const name of await CharacterStore.listNames()) {
    const char = await CharacterStore.load(name);
    if (!char) continue;
    const gates = new Set<string>([
      ...(await CharacterAfflictions.tags(char.name)).map(t => StringUtil.normalize(t)),
      ...(await CharacterAfflictions.list(char.name)).map(c => StringUtil.normalize(c.def)),
    ]);
    for (const def of CharacterResources.defsFor(char)) {
      if (!def.recovery?.length) continue;
      let credit = 0;
      const parts: string[] = [];
      for (const rule of def.recovery) {
        // A single gate, or several that must ALL be active at once
        // (full-rested AND in-sanctum).
        const needs = rule.requires === undefined ? [] : Array.isArray(rule.requires) ? rule.requires : [rule.requires];
        if (!needs.every(n => gates.has(StringUtil.normalize(n)))) continue;
        // A Background threshold too (the sanctum's sleep point is Sanctum 4's).
        if (rule.requiresTrait && effectiveTraitOf(char, rule.requiresTrait.trait) < rule.requiresTrait.atLeast) continue;
        const times = rule.per === "day" ? days : moons;
        if (times <= 0) continue;
        credit += rule.amount * times;
        parts.push(`${rule.per === "full-moon" ? "🌕 " : ""}${rule.amount}/${rule.per}×${times}${rule.note ? ` (${rule.note})` : ""}`);
      }
      if (credit <= 0) continue;
      const had = await CharacterResources.current(char, def);
      const { value } = await CharacterResources.gain(char, def.name, credit);
      if (value > had) lines.push(`${disp(char.name)} +${value - had} ${def.name} -> ${value}/${resourceNumbers(char, def).max} (${parts.join(", ")})`);
    }
    // A cray bubbles back too - 1/day on the days it went untapped.
    if (CrayStore.rating(char) > 0) {
      const gained = await CrayStore.replenish(char, Math.floor(fromEpoch / 86400), Math.floor(toEpoch / 86400));
      if (gained > 0) {
        const state = await CrayStore.get(char);
        lines.push(`${disp(char.name)}'s cray +${gained} -> ${state.points}/${CrayStore.capacity(char)}`);
      }
    }
  }
  return lines.length ? ` Recovery: ${lines.join("; ")}.` : "";
}

async function cmdAdvanceTime(cmd: ParsedCommand): Promise<string> {
  const before = await StoryClock.get();
  if (!before) return sys(NO_CLOCK);
  const dur = parseDuration(cmd.positional.join(" ").trim());
  if ("error" in dur) return sys(dur.error);
  const after = (await StoryClock.advance(dur))!;
  const span = diffCalendar(after.start, after.now);
  const since = after.now === after.start ? "back to the very beginning" : `${formatCalendarSpan(span)} since it began`;
  const recovery = await applyRecovery(before.now, after.now);
  const ended = await expireAfflictions(after.now);
  const endedBit = ended.length ? ` ${ended.join("; ")}.` : "";
  return sys(`Time advances: ${formatStoryDate(before.now)} -> ${formatStoryDate(after.now)} (${since}).${recovery}${endedBit}`);
}

async function cmdStoryDate(): Promise<string> {
  const c = await StoryClock.get();
  if (!c) return sys(NO_CLOCK);
  const moon = ` Next full moon: ${formatStoryDate(nextFullMoon(c.now))} (mean cycle).`;
  if (c.now === c.start) return sys(`Story date: ${formatStoryDate(c.now)} - the story has just begun.${moon}`);
  const span = diffCalendar(c.start, c.now);
  return sys(`Story date: ${formatStoryDate(c.now)} - ${formatCalendarSpan(span)} since it began (${formatStoryDate(c.start)}).${moon}`);
}

async function cmdSaveDate(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`save-date needs a name, e.g. [[save-date siege-began]] (saves the current date) or [[save-date yuletide 1197-12-25-00]].`);
  let epoch: number;
  const dateArg = cmd.positional[1]?.trim();
  if (dateArg) {
    const p = parseStoryDate(dateArg);
    if (typeof p !== "number") return sys(p.error);
    epoch = p;
  } else {
    const c = await StoryClock.get();
    if (!c) return sys(`No story clock yet - [[story-start ...]] first, or pass a date: [[save-date ${StringUtil.normalize(name)} 1197-06-01-00]].`);
    epoch = c.now;
  }
  await DateBook.save(name, epoch);
  return sys(`Saved date "${StringUtil.normalize(name)}" = ${formatStoryDate(epoch)}.`);
}

async function cmdForgetDate(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`forget-date needs a name, e.g. [[forget-date siege-began]].`);
  const key = StringUtil.normalize(name);
  return (await DateBook.remove(name)) ? sys(`Forgot date "${key}".`) : sys(`No saved date named "${key}".`);
}

async function cmdDates(): Promise<string> {
  const map = await DateBook.all();
  const names = Object.keys(map);
  if (!names.length) return sys(`No saved dates yet. Save one with [[save-date <name>]] (or [[save-date <name> yyyy-mm-dd-hh]]).`);
  const items = names.map(n => `${n} (${formatStoryDate(map[n])})`).join("; ");
  return sys(`Saved dates: ${items}. [[show-time-between <a> <b>]] measures any two.`);
}

async function cmdTimeBetween(cmd: ParsedCommand): Promise<string> {
  const a = cmd.positional[0]?.trim(), b = cmd.positional[1]?.trim();
  if (!a || !b) return sys(`time-between needs two dates, e.g. [[show-time-between start now]] or [[show-time-between siege-began 1197-12-25-00]] (each: a saved name, "now", "start", or yyyy-mm-dd-hh).`);
  const ra = await resolveDateToken(a);
  if (ra.error) return sys(ra.error);
  const rb = await resolveDateToken(b);
  if (rb.error) return sys(rb.error);
  const span = diffCalendar(ra.epoch!, rb.epoch!);
  if (span.totalSeconds === 0) return sys(`${ra.label} and ${rb.label} are the same moment (${formatStoryDate(ra.epoch!)}).`);
  const totalDays = Math.floor(span.totalSeconds / 86400);
  const totalBit = totalDays >= 1 ? ` (${totalDays} day${totalDays === 1 ? "" : "s"} total)` : "";
  const dir = span.negative ? "before" : "after";
  return sys(`${rb.label} is ${formatCalendarSpan(span)} ${dir} ${ra.label}${totalBit}. [${formatStoryDate(ra.epoch!)} -> ${formatStoryDate(rb.epoch!)}]`);
}

// =============================================================================
// SCENES - the named unit of play on the story clock (§7.31). A scene has one
// location and as many turns as it needs; [[turn]] advances by its turnLength.
// =============================================================================
function describeTurnLength(d: Duration | undefined): string {
  if (!d) return "freeform";
  const parts: string[] = [];
  if (d.months) parts.push(`${d.months} month${d.months === 1 ? "" : "s"}`);
  if (d.seconds) parts.push(formatCalendarSpan(diffCalendar(0, d.seconds)));   // fixed part as a span
  return parts.join(", ") || "freeform";
}

async function cmdScene(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`scene needs a name, e.g. [[scene "The Parapet" location=\`Buda ramparts\` turn=3s]].`);
  const clock = await StoryClock.get();
  if (!clock) return sys(NO_CLOCK);
  let turnLength: Duration | undefined;
  const turnRaw = cmd.named["turn"]?.trim();
  if (turnRaw) {
    const d = parseDuration(turnRaw);
    if ("error" in d) return sys(d.error);
    turnLength = d;
  }
  // Auto-close any other open scene at the current instant (a new scene = a new place).
  const prev = await SceneStore.current();
  let closedNote = "";
  if (prev && StringUtil.normalize(prev.name) !== StringUtil.normalize(name)) {
    prev.status = "closed"; prev.endedAt = clock.now;
    await SceneStore.save(prev);
    closedNote = ` (closed "${prev.name}")`;
  }
  const scene: Scene = {
    name: StringUtil.normalize(name),
    startedAt: clock.now, turnsElapsed: 0, status: "open",
  };
  const location = cmd.named["location"]?.trim();
  const chapter = cmd.named["chapter"]?.trim();
  if (location) scene.location = location;
  if (chapter) scene.chapter = chapter;
  if (turnLength) scene.turnLength = turnLength;
  await SceneStore.save(scene);
  await SceneStore.setCurrent(scene.name);
  await syncSceneToAuthorNote(scene);   // a fresh scene has no plan yet -> clears any prior plan block
  return sys(`Scene "${scene.name}" opens${location ? ` at ${location}` : ""} (${formatStoryDate(clock.now)}; turns: ${describeTurnLength(turnLength)})${closedNote}.`);
}

async function cmdTurn(cmd: ParsedCommand): Promise<string> {
  const scene = await SceneStore.current();
  if (!scene) return sys(`No open scene. Start one with [[scene "name" turn=3s]].`);
  const n = intOrUndef(cmd.positional[0]) ?? 1;
  if (n < 1) return sys(`turn count must be at least 1.`);
  let clockNote = "";
  if (scene.turnLength) {
    const total: Duration = { months: scene.turnLength.months * n, seconds: scene.turnLength.seconds * n };
    const after = await StoryClock.advance(total);
    if (after) clockNote = ` -> ${formatStoryDate(after.now)}`;
  }
  scene.turnsElapsed += n;
  await SceneStore.save(scene);
  const tag = scene.turnLength ? `${describeTurnLength(scene.turnLength)}/turn${clockNote}` : "freeform - no clock move";
  const ended = await countDownAfflictions("turns", n);
  // A turn that moved the clock may also have run a TIMED affliction out.
  if (scene.turnLength) ended.push(...await expireAfflictions((await StoryClock.get())?.now ?? 0));
  return sys(`${disp(scene.name)}: turn ${scene.turnsElapsed}${n > 1 ? ` (+${n})` : ""} (${tag}).`
    + `${ended.length ? ` ${ended.join("; ")}.` : ""}`);
}

async function cmdEndScene(): Promise<string> {
  const scene = await SceneStore.current();
  if (!scene) return sys(`No open scene to end.`);
  const clock = await StoryClock.get();
  scene.status = "closed";
  if (clock) scene.endedAt = clock.now;
  await SceneStore.save(scene);
  await SceneStore.clearCurrent();
  await syncSceneToAuthorNote(undefined);   // no open scene -> clear the plan block from the Author's Note
  const span = clock && scene.startedAt !== clock.now ? diffCalendar(scene.startedAt, clock.now) : undefined;
  const spanBit = span && span.totalSeconds ? `, ${formatCalendarSpan(span)} of story time` : "";
  const ended = await countDownAfflictions("scenes", 1);
  return sys(`Scene "${scene.name}" ends after ${scene.turnsElapsed} turn${scene.turnsElapsed === 1 ? "" : "s"}${spanBit}.`
    + `${ended.length ? ` ${ended.join("; ")}.` : ""}`);
}

async function cmdDowntime(cmd: ParsedCommand): Promise<string> {
  const before = await StoryClock.get();
  if (!before) return sys(NO_CLOCK);
  const dur = parseDuration(cmd.positional.join(" ").trim());
  if ("error" in dur) return sys(dur.error);
  const scene = await SceneStore.current();
  let sceneNote = "";
  if (scene) {
    scene.status = "closed"; scene.endedAt = before.now;
    await SceneStore.save(scene);
    await SceneStore.clearCurrent();
    await syncSceneToAuthorNote(undefined);
    sceneNote = ` (closed "${scene.name}")`;
  }
  const after = (await StoryClock.advance(dur))!;
  return sys(`Downtime: ${formatStoryDate(before.now)} -> ${formatStoryDate(after.now)}${sceneNote}.`);
}

async function cmdScenes(): Promise<string> {
  const names = await SceneStore.names();
  if (!names.length) return sys(`No scenes yet. Start one with [[scene "name"]].`);
  const cur = await SceneStore.currentName();
  const items: string[] = [];
  for (const n of names) {
    const s = await SceneStore.get(n);
    if (s) items.push(`${disp(s.name)}${s.name === cur ? " (open)" : ""} [${formatStoryDate(s.startedAt)}, ${s.turnsElapsed} turn${s.turnsElapsed === 1 ? "" : "s"}]`);
  }
  return sys(`Scenes: ${items.join("; ")}. [[show-scene <name>]] for detail.`);
}

async function cmdSceneInfo(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  const scene = name ? await SceneStore.get(name) : await SceneStore.current();
  if (!scene) return sys(name ? `No scene named "${StringUtil.normalize(name)}".` : `No open scene. Name one, or start with [[scene "name"]].`);
  const bits = [`${disp(scene.name)} [${scene.status}]`];
  if (scene.location) bits.push(`at ${scene.location}`);
  if (scene.chapter) bits.push(`chapter ${scene.chapter}`);
  bits.push(`began ${formatStoryDate(scene.startedAt)}`);
  if (scene.endedAt) bits.push(`ended ${formatStoryDate(scene.endedAt)}`);
  bits.push(`${scene.turnsElapsed} turn${scene.turnsElapsed === 1 ? "" : "s"} of ${describeTurnLength(scene.turnLength)}`);
  const planBit = scene.plan ? ` Plan: ${scene.plan}` : "";
  return sys(`${bits.join(", ")}.${planBit}`);
}

async function cmdForgetScene(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`forget-scene needs a name, e.g. [[forget-scene the-parapet]].`);
  const key = StringUtil.normalize(name);
  if ((await SceneStore.currentName()) === key) { await SceneStore.clearCurrent(); await syncSceneToAuthorNote(undefined); }
  return (await SceneStore.remove(name)) ? sys(`Forgot scene "${key}".`) : sys(`No scene named "${key}".`);
}

// =============================================================================
// STORYTELLER OUTPUT - the AI's private plans (§7.31, Pass B). The AI writes
// <hide op="append|overwrite">...</hide> in its narration; an onResponse hook
// strips those blocks from the story and folds them into the CURRENT scene's
// `plan`, which is mirrored into the Author's Note - semi-hidden: the AI re-reads
// it every turn, the player can peek at the AN panel, but it never lands in the
// prose. The Author's Note write is best-effort (needs the storyEdit permission);
// without it the plan still lives in the scene store (visible via scene-info).
// =============================================================================
export interface HideDirective { op: "append" | "overwrite"; content: string }

// Pull every <hide [op=...]>...</hide> block out of text. Returns the text with
// them removed and the directives in order (default op = append). PURE.
export function extractHideBlocks(text: string): { cleaned: string; directives: HideDirective[] } {
  const directives: HideDirective[] = [];
  const re = /<hide(?:\s+op\s*=\s*"?(append|overwrite)"?)?\s*>([\s\S]*?)<\/hide>/gi;
  const cleaned = text.replace(re, (_m, op: string | undefined, content: string) => {
    directives.push({ op: op === "overwrite" ? "overwrite" : "append", content: content.trim() });
    return "";
  });
  return { cleaned, directives };
}

const AN_PLAN_START = "<!--wod:scene-plan-->";
const AN_PLAN_END = "<!--/wod:scene-plan-->";

// Remove the engine-owned marked block from a text, leaving any player-authored
// Author's Note around it intact.
function stripMarkedBlock(text: string, start: string, end: string): string {
  const s = text.indexOf(start);
  if (s === -1) return text;
  const e = text.indexOf(end, s);
  const cut = e === -1 ? text.slice(0, s) : text.slice(0, s) + text.slice(e + end.length);
  return cut.replace(/\n{3,}/g, "\n\n").trim();
}

// Mirror the active scene's plan into the Author's Note as an engine-owned block
// (leaving the player's own note intact). Best-effort: swallow the storyEdit-
// permission error so the plan simply stays in the scene store.
async function syncSceneToAuthorNote(scene: Scene | undefined): Promise<void> {
  const plan = scene?.plan?.trim() ?? "";
  const block = plan ? `${AN_PLAN_START}\n[Scene: ${disp(scene!.name)}] ${plan}\n${AN_PLAN_END}` : "";
  try {
    const current = String((await api.v1.an.get()) ?? "");
    const base = stripMarkedBlock(current, AN_PLAN_START, AN_PLAN_END);
    await api.v1.an.set(block ? (base ? `${base}\n${block}` : block) : base);
  } catch { /* no storyEdit permission - the plan still lives in the scene store */ }
}

// Apply hide directives to the current scene's plan, then re-sync the Author's
// Note. Returns whether a scene received them (a directive with no open scene is
// still stripped from the story, but has nowhere to be recorded).
async function applyHideDirectives(directives: HideDirective[]): Promise<boolean> {
  if (!directives.length) return false;
  const scene = await SceneStore.current();
  if (!scene) return false;
  let plan = scene.plan ?? "";
  for (const d of directives) plan = d.op === "overwrite" ? d.content : (plan ? `${plan}\n${d.content}` : d.content);
  scene.plan = plan.trim() || undefined;
  await SceneStore.save(scene);
  await syncSceneToAuthorNote(scene);
  return true;
}

// The onResponse handler: strip <hide> blocks from the AI's generated text and
// route them to the scene plan / Author's Note. Returns the cleaned text array
// for the host to insert, or undefined when there was nothing to change.
export async function processGeneratedText(text: string[]): Promise<string[] | undefined> {
  const joined = text.join("");
  if (!joined.toLowerCase().includes("<hide")) return undefined;
  const { cleaned, directives } = extractHideBlocks(joined);
  await applyHideDirectives(directives);
  return [cleaned];
}

// [[hide `text`]] / [[hide op=overwrite `text`]] - the manual counterpart: the ST
// or player writes to the current scene's plan directly (same routing).
async function cmdHide(cmd: ParsedCommand): Promise<string> {
  const scene = await SceneStore.current();
  if (!scene) return sys(`No open scene to note. Start one with [[scene "name"]] first.`);
  const content = (cmd.named["text"] ?? cmd.positional.join(" ")).trim();
  if (!content) return sys(`hide needs text, e.g. [[hide text=\`the baron is the killer\`]] or [[hide op=overwrite text=\`...\`]].`);
  const op = (cmd.named["op"] ?? "append").toLowerCase() === "overwrite" ? "overwrite" : "append";
  await applyHideDirectives([{ op, content }]);
  const s = (await SceneStore.current())!;
  return sys(`Noted (${op}) to "${s.name}"'s plan. It rides the Author's Note now (${(s.plan ?? "").length} chars).`);
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
    return sys(`No success table "${ref.key}". See [[show-table]].`);
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
  return sys(`Success tables - ${groups.join(" | ")}.${aliasBit} [[show-table <name|sub|sub::name>]] for detail; add table=<key|@alias> to a roll/resist/contest.`);
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
    const def = resolvePowerInstance(name, n => MeritFlawRegistry.get(n))?.def ?? MeritFlawRegistry.get(name);
    (def && def.kind === "flaw" ? flaws : merits).push(StringUtil.normalize(name));
  }
  return {
    backgrounds: Object.keys(char.backgrounds).map(n => StringUtil.normalize(n)),
    merits,
    flaws,
    // Their own list, so a constraint over an arcanum matches an arcanum and a
    // constraint over merits never accidentally catches one.
    arcana: Object.keys(char.arcana ?? {}).map(n => StringUtil.normalize(n)),
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
  return sys(`Constraint groups: ${items}. [[show-constraint <name>]] for detail.`);
}

async function cmdConstraint(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`constraint needs a name, e.g. [[show-constraint clan-only-backgrounds]]. [[show-constraint]] lists them.`);
  const g = ConstraintRegistry.get(name);
  if (!g) return sys(`No constraint group "${StringUtil.normalize(name)}". See [[show-constraint]].`);
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

async function cmdCheckConstraints(forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
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

// A def whose rating ceiling is a TRAIT ("no more purchases than his Resolve"),
// resolved against this character - undefined when the def has no such cap.
// The name resolves through resources too, so the Ouroboros is capped by his
// Living Resolve without the def having to know that.
function meritTraitCeiling(char: PlayableCharacter, def: OwnedPowerDef): { trait: string; cap: number } | undefined {
  if (!def.maxFromTrait) return undefined;
  const trait = StringUtil.normalize(def.maxFromTrait);
  return { trait, cap: permanentRatingOf(char, trait) };
}

// Which instances of `def` would sit at or above a limit's rating, if `pending`
// were also taken. Returns one complaint per limit that would be broken - by
// total slots, or by how many of a KIND fill them.
function instanceLimitBreaches(
  char: PlayableCharacter, def: OwnedPowerDef, pending?: { key: string; points: number },
): string[] {
  const limits = instanceLimitsOf(def);
  if (!limits.length) return [];
  // Same name AND same category: two registries may legitimately hold a def of
  // the same name, and one category's instances never fill the other's slots.
  const held = ownedPowerInstances(char)
    .filter(i => StringUtil.normalize(i.def.name) === StringUtil.normalize(def.name)
      && isArcanumKind(i.def.kind) === isArcanumKind(def.kind)
      && i.key !== pending?.key)
    .map(i => ({ label: i.param ?? i.key, points: i.points }));
  if (pending) held.push({ label: pending.key.includes(":") ? pending.key.slice(pending.key.lastIndexOf(":") + 1) : pending.key, points: pending.points });

  const out: string[] = [];
  const name = StringUtil.normalize(def.name);
  for (const limit of limits) {
    const at = held.filter(h => h.points >= limit.atRating);
    if (at.length > limit.slots) {
      out.push(`${name} allows ${limit.slots} trait${limit.slots === 1 ? "" : "s"} at ${limit.atRating} `
        + `(have ${at.length}: ${at.map(h => h.label).join(", ")})`);
    }
    for (const [rawKind, allowed] of Object.entries(limit.perKind ?? {})) {
      // "at most one of them an Attribute" counts by KIND; "at most one a
      // Knowledge" counts by CATEGORY. A limit may be written either way.
      const kind = singularCategory(rawKind);
      const ofKind = at.filter(h => traitKindsOf(char, h.label).includes(kind));
      if (ofKind.length > allowed) {
        out.push(`${name} allows ${allowed} ${kind}${allowed === 1 ? "" : "s"} at ${limit.atRating} `
          + `(have ${ofKind.length}: ${ofKind.map(h => h.label).join(", ")})`);
      }
    }
  }
  return out;
}

// Advisory owned-power findings: unknown/malformed keys and instance-limit
// violations ("one favoured trait" caps). Reported, never enforced - the
// creation engine will enforce. Walks BOTH buckets, and names the bucket a
// stray key sits in, because "unknown merit/flaw" is a bad thing to say about
// an arcanum somebody typed into the wrong list.
function meritInstanceFindings(char: PlayableCharacter): string[] {
  const findings: string[] = [];
  const known = new Set<string>();
  const checkedDefs = new Set<string>();
  for (const inst of ownedPowerInstances(char)) {
    known.add(inst.key);
    // The ceiling is a trait, so it can MOVE: a Resolve that drops leaves the
    // purchases stranded above it. Reported, never silently trimmed.
    const ceiling = meritTraitCeiling(char, inst.def);
    if (ceiling && inst.points > ceiling.cap) {
      findings.push(`${StringUtil.normalize(inst.def.name)} is at ${inst.points} but ${ceiling.trait} is only ${ceiling.cap}`);
    }
    // Cross-instance limits are about the DEF, so ask each one once.
    const defKey = StringUtil.normalize(inst.def.name);
    if (!checkedDefs.has(defKey)) {
      checkedDefs.add(defKey);
      findings.push(...instanceLimitBreaches(char, inst.def));
    }
  }
  for (const key of Object.keys(char.meritsFlaws)) {
    const k = StringUtil.normalize(key);
    if (known.has(k)) continue;
    // It may be an arcanum somebody filed as a merit - the registry knows, and
    // saying so is more use than "unknown".
    const asArcanum = resolvePowerInstance(k, n => ArcanumRegistry.get(n));
    findings.push(asArcanum
      ? `"${k}" is an ${asArcanum.def.kind}, not a merit or flaw - [[take-arcanum ${k}]] files it right`
      : `unknown merit/flaw "${k}"`);
  }
  for (const key of Object.keys(char.arcana ?? {})) {
    const k = StringUtil.normalize(key);
    if (known.has(k)) continue;
    const asMerit = resolvePowerInstance(k, n => MeritFlawRegistry.get(n));
    findings.push(asMerit
      ? `"${k}" is a ${asMerit.def.kind}, not an arcanum or taint - [[take-merit ${k}]] files it right`
      : `unknown arcanum/taint "${k}"`);
  }
  // A pool start naming a resource the templates don't grant: a hand-edited
  // card can give a mage a "Resolve" he cannot have, and every trait lookup
  // would then find it. The same phantom the Willpower seeding guards against,
  // caught on the way in from the lorebook.
  for (const name of Object.keys(char.poolStarts ?? {})) {
    if (!CharacterResources.resolveDef(char, name)) {
      findings.push(`pool "${StringUtil.normalize(name)}" is not granted by ${char.templates.join("+")} - `
        + `trait lookups will still find it`);
    }
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
  // A choice, not a template: what only a Nosferatu or only a Valdaermen may
  // have. A clan matches by CLAN, so all three Assamite castes pass an
  // Assamite-exclusive gate.
  for (const [what, want] of Object.entries(req.choices ?? {})) {
    const key = StringUtil.normalize(what);
    const has = StringUtil.normalize(char.choices?.[key] ?? "");
    const asked = StringUtil.normalize(want);
    const met = key === "clan" ? has !== "" && clanFamilyOf(has) === clanFamilyOf(asked) : has === asked;
    if (!met) missing.push(`${key}:${asked}`);
  }
  return missing;
}

// =============================================================================
// TWO FAMILIES OF OWNED POWER - one mechanism, two categories that never mix
// -----------------------------------------------------------------------------
// Merits & Flaws and Arcana & Taints are handled by the SAME code and are NOT
// THE SAME THING. The difference is a `PowerFamily`: which registry answers a
// name, which lorebook category holds the custom ones, which bucket on the
// sheet owns the instances, which verbs to name in a reply - and, for arcana,
// which capability a character must have before the list is open to him at all.
//
// This is why [[define-merit]] CANNOT define an arcanum: it is not a check it
// forgets to make, it is a different family object with different kinds, a
// different registry and a different card. And it is why a regular vampire's
// [[show-merit]] shows no Arcana: they were never in that list.
// =============================================================================
interface PowerFamily<T extends OwnedPowerDef> {
  kinds: readonly OwnedPowerKind[];
  defaultKind: OwnedPowerKind;
  registry: {
    get(name: string): T | undefined;
    all(): T[];
    register(def: T): void;
    reset(): void;
    loadFromLorebook(): Promise<number>;
  };
  category: string;
  entry: string;
  read(name: string, body: CardMap): T | undefined;
  // Where this family's instances live on the sheet. `ensure` creates the
  // bucket (arcana is absent on the sheets that have none).
  bucket(char: PlayableCharacter): Record<string, number>;
  ensureBucket(char: PlayableCharacter): Record<string, number>;
  instances(char: PlayableCharacter): Array<OwnedPowerInstance<T>>;
  one: string;              // "merit/flaw" - what one of them is, in a message
  aOne: string;             // ...with its article ("a merit/flaw", "an arcanum/taint")
  many: string;             // "Merits & Flaws" - the list's name
  verbs: { define: string; forget: string; take: string; drop: string; list: string; info: string };
  // The capability that opens this list, if any. Merits are open to everyone.
  requires?: string;
  requiresNote?: string;
  cardHeader: string[];
  // The other family, so every "wrong drawer" message can point somewhere.
  other(): PowerFamily<OwnedPowerDef>;
}

const MERITS_CATEGORY = "srd:merits-flaws";
const MERITS_CUSTOM_ENTRY = "srd:merits-flaws:custom";
const ARCANA_CATEGORY = "srd:arcana";
const ARCANA_CUSTOM_ENTRY = "srd:arcana:custom";

const MERIT_FAMILY: PowerFamily<MeritFlawDef> = {
  kinds: MERIT_FLAW_KINDS,
  defaultKind: "merit",
  registry: MeritFlawRegistry,
  category: MERITS_CATEGORY,
  entry: MERITS_CUSTOM_ENTRY,
  read: meritFlawFromCard,
  bucket: char => char.meritsFlaws ?? {},
  ensureBucket: char => (char.meritsFlaws ??= {}),
  instances: ownedMeritInstances,
  one: "merit/flaw",
  aOne: "a merit/flaw",
  many: "Merits & Flaws",
  verbs: { define: "define-merit", forget: "forget-merit", take: "take-merit", drop: "drop-merit", list: "show-merit", info: "show-merit" },
  cardHeader: [
    `Custom Merits & Flaws. Below the ${SRD_HEADER_MARKER} line each one is its NAME,`,
    "with its fields indented under it; the list is merged over the built-ins.",
    "[[define-merit]] writes this for you; hand-editing is equally fine. The fields:",
    "kind (merit|flaw), points (a number, or `1, 2, 3`), param, passive (always-on",
    "ops), requires, limit-at/limit-slots, description.",
    "Arcana and Taints are NOT merits - they live in srd:arcana ([[define-arcanum]]).",
  ],
  other: () => ARCANUM_FAMILY as unknown as PowerFamily<OwnedPowerDef>,
};

const ARCANUM_FAMILY: PowerFamily<ArcanumDef> = {
  kinds: ARCANUM_KINDS,
  defaultKind: "arcanum",
  registry: ArcanumRegistry,
  category: ARCANA_CATEGORY,
  entry: ARCANA_CUSTOM_ENTRY,
  read: arcanumFromCard,
  bucket: char => char.arcana ?? {},
  ensureBucket: char => (char.arcana ??= {}),
  instances: ownedArcanumInstances,
  one: "arcanum/taint",
  aOne: "an arcanum/taint",
  many: "Arcana & Taints",
  verbs: { define: "define-arcanum", forget: "forget-arcanum", take: "take-arcanum", drop: "drop-arcanum", list: "show-arcanum", info: "show-arcanum" },
  requires: ARCANA_CAPABILITY,
  requiresNote: "Arcana belong to the infernal: a demon has them, and so does anyone at all "
    + "who has become a demon's thrall. Nobody else has this list open.",
  cardHeader: [
    `Custom Arcana & Taints (Dark Ages: Devil's Due). Below the ${SRD_HEADER_MARKER} line each one`,
    "is its NAME, with its fields indented under it; merged over the built-ins.",
    "AN ARCANUM IS NOT A MERIT: its own category, its own purse, and open only to",
    "characters bound to the infernal. [[define-arcanum]] writes this for you. Fields:",
    "kind (arcanum|taint), points (a number, or `1, 2, 3`), per-template, param,",
    "passive, requires, limit-at/limit-slots, description.",
  ],
  other: () => MERIT_FAMILY as unknown as PowerFamily<OwnedPowerDef>,
};

// The family a name belongs to, whichever registry knows it - for the "you
// asked the wrong verb" replies, and for nothing else.
function familyOwning(key: string): PowerFamily<OwnedPowerDef> | undefined {
  const k = StringUtil.normalize(key);
  if (resolvePowerInstance(k, n => MeritFlawRegistry.get(n))) return MERIT_FAMILY as unknown as PowerFamily<OwnedPowerDef>;
  if (resolvePowerInstance(k, n => ArcanumRegistry.get(n))) return ARCANUM_FAMILY as unknown as PowerFamily<OwnedPowerDef>;
  return undefined;
}

// Is this list open to this character at all? A family with no `requires` is
// open to everyone (Merits and Flaws are). Returns the refusal, or undefined.
function familyClosedTo(char: PlayableCharacter, family: PowerFamily<OwnedPowerDef>): string | undefined {
  if (!family.requires) return undefined;
  if (capabilitiesOpenArcana(CharacterResources.capabilities(char))) return undefined;
  return `${disp(char.name)} (${char.templates.join("+")}) has no ${family.many} at all. `
    + `${family.requiresNote ?? ""} `
    + `Add the template, [[attune ${family.requires}]] if this chronicle says otherwise, or waive=true for one purchase.`;
}

// --- THE CUSTOM-DEFINITION OVERLAY -------------------------------------------
// Each family's custom definitions live in its own lorebook category
// (name-keyed blocks merged over the built-ins). These commands write it for
// you; hand-editing the card stays equally valid.
async function customDefs<T extends OwnedPowerDef>(family: PowerFamily<T>): Promise<T[]> {
  const text = await LorebookManager.entryText(family.category, family.entry);
  const parsed = parseCardText(LorebookManager.contentBelowHeader(text ?? "").trim());
  return asNamedList(parsed)
    .map(({ name, body }) => family.read(name, body))
    .filter((d): d is T => d !== undefined);
}

async function writeCustomDefs<T extends OwnedPowerDef>(family: PowerFamily<T>, defs: T[]): Promise<void> {
  const text = configEntryText(family.cardHeader, namedDefsToCard(defs));
  const { id } = await LorebookManager.ensureCategory(family.category);
  const created = await LorebookManager.ensureEntry(id, family.entry, text);
  if (!created) await LorebookManager.updateEntryText(family.category, family.entry, text);
  await family.registry.loadFromLorebook();
}

// define-merit name="Inviolate Soul" points=0 description=`…`
//   passive="immune:possession,soul-control; immune:fear,mind-control while=living-resolve"
// ...and define-arcanum, which is the same code over the other family.
async function defineOwnedPower<T extends OwnedPowerDef>(cmd: ParsedCommand, family: PowerFamily<T>): Promise<string> {
  const rawName = cmd.named["name"] ?? cmd.positional[0];
  if (!rawName?.trim()) {
    return sys(`${family.verbs.define} needs a name, e.g. [[${family.verbs.define} name=\`Inviolate Soul\` points=0 `
      + "passive=`immune:possession; immune:fear while=living-resolve` description=`…`]]. "
      + 'Passives read "<op>[:<target>] [+N|-N] [if=<trait>] [while=<resource>[>=N]] [once]", ";"-separated '
      + "(or a raw ops array in JSON). Use BACKTICKS for name/passive/description - a quoted value is normalized (spaces become hyphens).");
  }
  const name = rawName.trim();
  const kindRaw = (cmd.named["kind"] ?? family.defaultKind).toLowerCase() as OwnedPowerKind;
  // THE STRUCTURAL REFUSAL. define-merit cannot make an arcanum and
  // define-arcanum cannot make a merit - not because either forgets to check,
  // but because a family holds the kinds it holds and no others.
  if (!family.kinds.includes(kindRaw)) {
    const elsewhere = family.other();
    return elsewhere.kinds.includes(kindRaw)
      ? sys(`"${kindRaw}" is not ${family.aOne}. ${elsewhere.many} are a different category - `
        + `a different list, a different purse, and not open to every character. `
        + `Use [[${elsewhere.verbs.define} name=\`${name}\` kind=${kindRaw}]].`)
      : sys(`kind must be one of ${family.kinds.join(", ")} (got "${kindRaw}").`);
  }

  // points: a single number or a "1,2,3" ladder of allowed ratings.
  const pointsRaw = (cmd.named["points"] ?? "0").trim();
  const ladder = pointsRaw.split(",").map(p => parseInt(p.trim(), 10));
  if (ladder.some(n => Number.isNaN(n))) return sys(`points must be a number or a list like "1,2,3" (got "${pointsRaw}").`);
  const points: number | number[] = ladder.length === 1 ? ladder[0] : ladder;

  const def = { name, kind: kindRaw, points } as T;
  if (cmd.named["description"]?.trim()) def.description = cmd.named["description"].trim();
  if (cmd.named["param"]?.trim()) def.param = StringUtil.normalize(cmd.named["param"]);
  const budget = (cmd.named["budget"] ?? "").trim();
  if (budget) def.budget = StringUtil.normalize(budget);
  // per-template="demon:7,thrall:5,mortal:no" - a price each, or `no` for a
  // template the definition is closed to.
  const perTemplateRaw = (cmd.named["per-template"] ?? "").trim();
  if (perTemplateRaw) {
    const variants: Record<string, TemplateVariant> = {};
    for (const pair of perTemplateRaw.split(",").map(x => x.trim()).filter(Boolean)) {
      const [rawT, rawV] = pair.split(":");
      if (!rawT) continue;
      const t = StringUtil.normalize(rawT);
      const v = (rawV ?? "").trim().toLowerCase();
      if (v === "no" || v === "none" || v === "false") variants[t] = { available: false };
      else { const n = intOrUndef(v); if (n !== undefined) variants[t] = { cost: n }; }
    }
    if (Object.keys(variants).length) def.perTemplate = variants;
  }
  const limitAt = intOrUndef(cmd.named["limit-at"] ?? "");
  if (limitAt !== undefined) {
    const limit: InstanceLimit = { atRating: limitAt, slots: intOrUndef(cmd.named["limit-slots"] ?? "") ?? 1 };
    const perKind: Record<string, number> = {};
    for (const pair of (cmd.named["limit-per-kind"] ?? "").split(",").map(x => x.trim()).filter(Boolean)) {
      const [kind, n] = pair.split(":");
      const v = intOrUndef(n ?? "");
      if (kind && v !== undefined) perKind[StringUtil.normalize(kind)] = v;
    }
    if (Object.keys(perKind).length) limit.perKind = perKind;
    def.limits = [limit];
  }
  const maxFromTrait = (cmd.named["max-from-trait"] ?? "").trim();
  if (maxFromTrait) def.maxFromTrait = StringUtil.normalize(maxFromTrait);
  const paramFrom = (cmd.named["param-from"] ?? "").trim();
  if (paramFrom) {
    if (!isTraitCategory(paramFrom)) {
      return sys(`param-from names a trait category - one of ${ALL_TRAIT_CATEGORIES.join(", ")} (got "${paramFrom}").`);
    }
    def.paramFrom = singularCategory(paramFrom);
  }
  if (cmd.named["passive"]?.trim()) {
    const raw = cmd.named["passive"];
    // A quoted (not backticked) value came through the boundary normalizer, so
    // its spaces are now hyphens - say so rather than parsing nonsense.
    if (/-(?:if|while|on|target|amount|once)\b/.test(raw)) {
      return sys("passive= lost its spaces to normalization - wrap it in BACKTICKS: "
        + "passive=`immune:fear while=living-resolve`.");
    }
    const ops = parsePassiveOps(raw);
    if ("error" in ops) return sys(ops.error);
    def.passive = ops;
  }
  const templates = (cmd.named["templates"] ?? "").split(",").map(t => StringUtil.normalize(t)).filter(Boolean);
  if (templates.length) def.requires = { templates };

  // WHAT TAKING IT TURNS ON. A built-in merit could declare a PassiveGrant and
  // a chronicle's could not, which made "simple merits should be able to define
  // the passive affliction they grant" impossible to say in a command.
  //   grants=<affliction> [grants-mode=automatic|offered] [grants-togglable]
  //   [grants-orphan=<policy>]
  // If the affliction does not exist yet, it is CREATED from this definition -
  // a simple merit is one command, not two - and the reply says so.
  let seeded = "";
  const grantsRaw = (cmd.named["grants"] ?? "").trim();
  if (grantsRaw) {
    const afflicts = StringUtil.normalize(grantsRaw);
    const grant: PassiveGrant = { afflicts };
    const mode = StringUtil.normalize(cmd.named["grants-mode"] ?? "");
    if (mode === "offered" || mode === "automatic") grant.mode = mode;
    if (flagOf(cmd, "grants-togglable") === true) grant.togglable = true;
    const orphan = (cmd.named["grants-orphan"] ?? "").trim();
    if (orphan) grant.orphan = orphan;
    def.grants = grant;
    if (!AfflictionRegistry.get(afflicts)) {
      // No `tags`: a tag is a thing a ROLL carries, and one nobody has written
      // a modifier for is reported as unknown on every roll the character makes.
      // A merit's passive is a STATE. [[define-affliction]] adds tags if the
      // chronicle wants them to bite.
      await AfflictionRegistry.put(makeAfflictionDef({
        name: afflicts,
        description: def.description ?? `Applied while ${name} is held.`,
      }));
      seeded = ` Affliction "${afflicts}" did not exist, so it was defined too ([[define-affliction]] to flesh it out).`;
    }
  }

  const key = StringUtil.normalize(name);
  const defs = await customDefs(family);
  const existing = defs.findIndex(d => StringUtil.normalize(d.name) === key);
  const shadows = existing < 0 && family.registry.get(key) ? ` (shadowing the built-in "${key}")` : "";
  if (existing >= 0) defs[existing] = def; else defs.push(def);
  await writeCustomDefs(family, defs);

  const bits = [`${def.kind} "${name}"`, `${Array.isArray(points) ? `[${points.join(", ")}]` : points} point${points === 1 ? "" : "s"}`];
  if (def.param) bits.push(`parameterized by ${def.param}${def.paramFrom ? ` (must be a ${def.paramFrom})` : ""}`);
  if (def.passive?.length) bits.push(`passive: ${def.passive.map(describePassiveOp).join("; ")}`);
  if (def.grants) bits.push(`applies "${def.grants.afflicts}"${grantIsAutomatic(def.grants) ? "" : " when invoked"}${def.grants.togglable ? ", togglable" : ""}`);
  return sys(`${existing >= 0 ? "Redefined" : "Defined"} ${bits.join(", ")}${shadows}.${seeded} `
    + `Take it with [[${family.verbs.take} ${key}${def.param ? `::<${def.param}>` : ""}${Array.isArray(points) ? ` ${points[0]}` : ""}]].`);
}

async function forgetOwnedPower<T extends OwnedPowerDef>(cmd: ParsedCommand, family: PowerFamily<T>): Promise<string> {
  const raw = cmd.positional[0]?.trim() ?? cmd.named["name"]?.trim();
  if (!raw) return sys(`${family.verbs.forget} needs a name, e.g. [[${family.verbs.forget} inviolate-soul]].`);
  const key = StringUtil.normalize(raw);
  const defs = await customDefs(family);
  const rest = defs.filter(d => StringUtil.normalize(d.name) !== key);
  if (rest.length === defs.length) {
    if (family.registry.get(key)) return sys(`"${key}" is a built-in - it can be shadowed with [[${family.verbs.define}]] but not deleted.`);
    const elsewhere = familyOwning(key);
    return elsewhere
      ? sys(`"${key}" is ${elsewhere.aOne}, not ${family.aOne}. Use [[${elsewhere.verbs.forget} ${key}]].`)
      : sys(`No custom ${family.one} "${key}".`);
  }
  await writeCustomDefs(family, rest);
  family.registry.reset();
  await family.registry.loadFromLorebook();
  const shipped = family.registry.get(key) ? ` The built-in "${key}" resurfaces.` : "";
  return sys(`Forgot custom ${key}.${shipped}`);
}

// merit [name] / arcanum [name] - list the definitions, or inspect one in full.
async function ownedPowerInfo<T extends OwnedPowerDef>(cmd: ParsedCommand, family: PowerFamily<T>): Promise<string> {
  const raw = cmd.positional[0]?.trim();
  if (!raw) {
    const defs = family.registry.all();
    if (!defs.length) return sys(`No ${family.many} defined. [[${family.verbs.define}]] adds one.`);
    const items = defs.map(d => `${StringUtil.normalize(d.name)}${d.kind === family.defaultKind ? "" : ` (${d.kind})`}`).join(", ");
    return sys(`Defined ${family.many}: ${items}. [[${family.verbs.info} <name>]] for detail; [[${family.verbs.define}]] adds one.`);
  }
  const key = StringUtil.normalize(raw);
  const def = family.registry.get(key);
  if (!def) {
    // It may be perfectly well defined - in the other list. Say so; "no such
    // merit" about an arcanum is the confusion this split exists to end.
    const elsewhere = familyOwning(key);
    return elsewhere
      ? sys(`"${key}" is ${elsewhere.aOne}, not ${family.aOne} - a different category entirely. Use [[${elsewhere.verbs.info} ${key}]].`)
      : sys(`No ${family.one} "${key}". [[${family.verbs.info}]] lists them.`);
  }
  const bits = [`${def.kind} "${def.name}"`];
  const perTemplate = Object.entries(def.perTemplate ?? {});
  if (perTemplate.length) {
    bits.push(`${budgetOfKind(def)} cost - ${perTemplate.map(([t, v]) =>
      v.available === false ? `${t}: not available` : `${t}: ${Array.isArray(v.cost) ? `[${v.cost.join(", ")}]` : v.cost ?? def.points}`).join(", ")}`);
    for (const [t, v] of perTemplate) if (v.note) bits.push(`${t}: ${v.note}`);
  } else {
    bits.push(`${Array.isArray(def.points) ? `[${def.points.join(", ")}]` : def.points} ${budgetOfKind(def)} point${def.points === 1 ? "" : "s"}`);
  }
  if (!kindSpends(def.kind)) bits.push(`GRANTS points rather than costing them`);
  if (def.param) bits.push(`parameterized by ${def.param}${def.paramFrom ? ` (must be a ${def.paramFrom})` : ""}`);
  for (const l of instanceLimitsOf(def)) {
    const kinds = Object.entries(l.perKind ?? {}).map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`);
    bits.push(`at most ${l.slots} at ${l.atRating}${kinds.length ? ` (of those, ${kinds.join(", ")})` : ""} - advisory`);
  }
  if (def.maxFromTrait) bits.push(`never more purchases than ${disp(def.maxFromTrait)}`);
  if (def.requires?.templates?.length) bits.push(`templates: ${def.requires.templates.join("/")}`);
  if (family.requires) bits.push(`needs the "${family.requires}" capability ([[attune]])`);
  if (def.passive?.length) bits.push(`passive - ${def.passive.map(describePassiveOp).join("; ")}`);
  if (def.grants) {
    // Its effect may live in the affliction it applies rather than in a passive
    // of its own - say what that affliction DOES, or the definition reads empty.
    const applied = AfflictionRegistry.get(def.grants.afflicts);
    const does = (applied?.apply ?? []).map(describePassiveOp).join("; ");
    bits.push(`applies "${def.grants.afflicts}"${does ? ` - ${does}` : ""}`
      + `${grantIsAutomatic(def.grants) ? "" : " when invoked"}${def.grants.togglable ? ", togglable" : ""}`);
  }
  const note = def.passive?.some(o => !isRollOp(o))
    ? " Ops the engine has no interpreter for are recorded and surfaced for the Storyteller (immunities have no system to enforce them yet)."
    : "";
  return sys(`${bits.join("; ")}.${def.description ? ` ${def.description}` : ""}${note}`);
}

async function takeOwnedPower<T extends OwnedPowerDef>(cmd: ParsedCommand, family: PowerFamily<T>): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const raw = cmd.positional[0]?.trim();
  if (!raw) return sys(`${family.verbs.take} needs a name, e.g. [[${family.verbs.take} trait-affinity::melee 2]].`);
  const key = StringUtil.normalize(raw);
  const waived = flagOf(cmd, "waive") === true;
  const hit = resolvePowerInstance(key, n => family.registry.get(n));
  if (!hit) {
    const elsewhere = familyOwning(key);
    if (elsewhere) {
      return sys(`${key} is ${elsewhere.aOne}, not ${family.aOne}. Use [[${elsewhere.verbs.take} ${key}]].`);
    }
    const bare = family.registry.get(key);
    return bare?.param
      ? sys(`"${key}" is parameterized - name its ${bare.param}: [[${family.verbs.take} ${key}::<${bare.param}>]].`)
      : sys(`Unknown ${family.one} "${key}". Custom definitions go in the ${family.category} lorebook category.`);
  }
  // "PICK A KNOWLEDGE" - the param's category, checked where the pick is made.
  if (hit.param && hit.def.paramFrom && !waived && !traitInCategory(hit.param, hit.def.paramFrom)) {
    const want = singularCategory(hit.def.paramFrom);
    const options = traitsInCategory(want);
    return sys(`${hit.def.name} is taken on a ${want}, and "${hit.param}" is not one`
      + `${traitCategoryOf(hit.param) ? ` (it is a ${traitCategoryOf(hit.param)})` : ""}. `
      + `${options.length ? `Choose from: ${options.join(", ")}. ` : ""}Add waive=true to override.`);
  }
  // IS THIS LIST OPEN TO HIM AT ALL? Asked before price, because "a vampire has
  // no Arcana" is a truer answer than "that costs 5 arcana points".
  const closed = waived ? undefined : familyClosedTo(char, family as unknown as PowerFamily<OwnedPowerDef>);
  if (closed) return sys(closed);
  // The price - and whether it may be taken at all - can differ per template.
  const priced = meritCostFor(hit.def, char.templates);
  if (!priced.available && !waived) {
    const who = char.templates.join("+");
    return sys(`${hit.def.name} is not open to ${who}${priced.note ? ` - ${priced.note}` : ""}. `
      + `[[${family.verbs.info} ${key}]] lists who may take it. Add waive=true to override.`);
  }
  const listed = typeof priced.points === "string" ? intOrUndef(priced.points) ?? 0 : priced.points;
  const allowed = Array.isArray(listed) ? listed : [listed];
  const points = intOrUndef(cmd.positional[1] ?? "") ?? allowed[0];
  if (!allowed.includes(points)) {
    return sys(`${hit.def.name} must be taken at one of [${allowed.join(", ")}] points (got ${points})`
      + `${priced.from ? ` for a ${priced.from}` : ""}.`);
  }
  const missing = unmetRequirements(char, hit.def.requires);
  if (missing.length && !waived) {
    return sys(`${hit.def.name} prerequisites not met: ${missing.join(", ")}. Add waive=true to override.`);
  }
  const breaches = instanceLimitBreaches(char, hit.def, { key, points });
  if (breaches.length && !waived) {
    return sys(`${breaches.join("; ")}. Lower another instance first, or add waive=true to override.`);
  }
  const ceiling = meritTraitCeiling(char, hit.def);
  if (ceiling && points > ceiling.cap && !waived) {
    // A ceiling of 0 is not a low cap, it is the WRONG KIND OF BEING: a mage
    // has Quintessence and Willpower, never Resolve, so an arcanum measured
    // against Resolve is not open to him at all. Say that, not "0".
    return ceiling.cap === 0
      ? sys(`${disp(char.name)} has no ${disp(ceiling.trait)}, and ${hit.def.name} is measured against it - `
        + `none of ${disp(char.name)}'s templates (${char.templates.join("+")}) grant one. Add waive=true if the chronicle says otherwise.`)
      : sys(`${hit.def.name} may not be taken more times than ${disp(ceiling.trait)} (${ceiling.cap}) - `
        + `asked for ${points}. Raise ${disp(ceiling.trait)} first, or add waive=true to override.`);
  }
  family.ensureBucket(char)[key] = points;
  // The Storyteller may set what it REALLY cost, right here.
  const paidExpr = cmd.named["paid"]?.trim();
  if (paidExpr !== undefined) char.paid = { ...(char.paid ?? {}), [key]: paidExpr };
  await CharacterStore.save(char);
  // Taking it turns it ON: the passive affliction is applied here, not by the
  // player remembering to. The reply says so.
  const granted = hit.def.grants
    ? await applyPassiveGrant(StringUtil.normalize(char.name), hit.def.kind, key, hit.def.grants,
        { param: hit.param, rating: points })
    : "";
  const passiveBits = passiveOpsOf(hit.def, hit.param, points).map(describePassiveOp);
  const purse = budgetOfKind(hit.def);
  const paidBit = paidExpr !== undefined ? `, paid ${paidExpr}` : "";
  return sys(`${disp(char.name)} takes ${hit.def.name}${hit.param ? `::${hit.param}` : ""} `
    + `(${points} ${purse} point${points === 1 ? "" : "s"}${priced.from ? ` - a ${priced.from}'s price` : ""}${paidBit})`
    + `${granted ? `. ${granted}` : ""}`
    + `${priced.note ? ` - ${priced.note}` : ""}`
    + `${passiveBits.length ? ` - passive: ${passiveBits.join(", ")}` : ""}. [[show-budget]] tracks the purse.`);
}

async function dropOwnedPower<T extends OwnedPowerDef>(cmd: ParsedCommand, family: PowerFamily<T>): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const key = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!key) return sys(`${family.verbs.drop} needs a name.`);
  const bucket = family.bucket(char);
  if (!(key in bucket)) {
    const elsewhere = family.other();
    if (key in elsewhere.bucket(char)) {
      return sys(`${key} is ${elsewhere.aOne}, not ${family.aOne}. Use [[${elsewhere.verbs.drop} ${key}]].`);
    }
    return sys(`${disp(char.name)} does not have "${key}". [[${family.verbs.list}]] lists them.`);
  }
  delete bucket[key];
  if (char.arcana && !Object.keys(char.arcana).length) delete char.arcana;
  await CharacterStore.save(char);
  // Losing a power loses what it granted. Every affliction that named this as
  // its source is re-measured through its own orphan policy - immediately,
  // after a while, unchanged, or by an expression over what was left. The
  // source is written `<kind>:<key>`, and a bare key is matched too because a
  // chronicle may have afflicted by name.
  const subject = StringUtil.normalize(char.name);
  const notes: string[] = [];
  for (const kind of family.kinds) notes.push(...await orphanAfflictions(subject, `${kind}:${key}`));
  notes.push(...await orphanAfflictions(subject, key));
  return sys(`${disp(char.name)} drops ${key}.${notes.length ? ` ${notes.join("; ")}.` : ""}`);
}

// merits / arcana - what this character OWNS from one list.
async function ownedPowerList<T extends OwnedPowerDef>(family: PowerFamily<T>, forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const insts = family.instances(char);
  const bucket = family.bucket(char);
  if (!insts.length && !Object.keys(bucket).length) {
    const closed = familyClosedTo(char, family as unknown as PowerFamily<OwnedPowerDef>);
    if (closed) return sys(closed);
    return sys(`${disp(char.name)} has no ${family.many}. [[${family.verbs.take} <name[::param]> [points]]] takes one.`);
  }
  const items = insts.map(i => `${i.key} (${i.points}${i.def.kind === family.defaultKind ? "" : `, ${i.def.kind}`})`);
  // Enhancements and findings are about the WHOLE sheet, so they are reported
  // by the list a player is most likely to be looking at when they matter.
  const enhBits = Object.entries(enhancementsFor(char)).map(([t, n]) => {
    const base = resolveTraitFromRecord(char, t);
    return `${t}: base ${base} -> effective ${base + n} (ceiling +${n}, advisory)`;
  });
  const issues = meritInstanceFindings(char);
  const parts = [`${family.many}: ${items.join("; ")}`];
  if (enhBits.length) parts.push(`Enhancements - ${enhBits.join("; ")}`);
  if (issues.length) parts.push(`Issues (ST-enforced): ${issues.join("; ")}`);
  return sys(`${parts.join(". ")}.`);
}

// --- THE VERBS, one line each per family --------------------------------------
const cmdDefineMerit = (cmd: ParsedCommand): Promise<string> => defineOwnedPower(cmd, MERIT_FAMILY);
const cmdForgetMerit = (cmd: ParsedCommand): Promise<string> => forgetOwnedPower(cmd, MERIT_FAMILY);
const cmdMeritInfo = (cmd: ParsedCommand): Promise<string> => ownedPowerInfo(cmd, MERIT_FAMILY);
const cmdTakeMerit = (cmd: ParsedCommand): Promise<string> => takeOwnedPower(cmd, MERIT_FAMILY);
const cmdDropMerit = (cmd: ParsedCommand): Promise<string> => dropOwnedPower(cmd, MERIT_FAMILY);
const cmdMerits = (forChar?: PlayableCharacter): Promise<string> => ownedPowerList(MERIT_FAMILY, forChar);

const cmdDefineArcanum = (cmd: ParsedCommand): Promise<string> => defineOwnedPower(cmd, ARCANUM_FAMILY);
const cmdForgetArcanum = (cmd: ParsedCommand): Promise<string> => forgetOwnedPower(cmd, ARCANUM_FAMILY);
const cmdArcanumInfo = (cmd: ParsedCommand): Promise<string> => ownedPowerInfo(cmd, ARCANUM_FAMILY);
const cmdTakeArcanum = (cmd: ParsedCommand): Promise<string> => takeOwnedPower(cmd, ARCANUM_FAMILY);
const cmdDropArcanum = (cmd: ParsedCommand): Promise<string> => dropOwnedPower(cmd, ARCANUM_FAMILY);
// [[show-arcanum]] with a name inspects it, the way [[show-arcanum]] always has.
const cmdArcana = (cmd: ParsedCommand, forChar?: PlayableCharacter): Promise<string> =>
  cmd.positional[0]?.trim() ? ownedPowerInfo(cmd, ARCANUM_FAMILY) : ownedPowerList(ARCANUM_FAMILY, forChar);

async function cmdSpecialty(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
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
  if (!char) return noCharacter();
  const trait = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  const label = cmd.positional[1]?.trim();
  const list = char.specialties?.[trait];
  if (!trait || !list?.length) return sys(`No specialties under "${trait}". [[show-specialty]] lists them.`);
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

async function cmdSpecialties(forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
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

// One line of active affliction. Given the CHARACTER, a rating-scaled def also
// reports what it is granting right now ("what is my sanctum doing for me?").
function afflictionLine(c: ActiveAffliction, char?: PlayableCharacter): string {
  const def = AfflictionRegistry.get(c.def);
  const bits = [c.def];
  const bound = Object.entries(c.bindings).map(([k, v]) => `${k}: ${disp(v)}`).join(", ");
  if (bound) bits.push(`(${bound})`);
  // What the ENGINE is counting comes first; the def's prose duration is the
  // fallback for an affliction nobody gave an expiry to.
  const left = describeExpiry(c.expiry, formatStoryDate);
  if (left) bits.push(`- ${left}${expiryIsAdvisoryOnly(c.expiry) ? " ⚠ advisory: nothing ends this but [[lift]]" : ""}`);
  // The source is an IDENTIFIER ("arcanum:sharpened-senses"), not a display
  // name: title-casing it would mangle the very thing that makes it matchable.
  if (c.from) bits.push(`- from ${c.from}${c.orphan ? ` (${describeOrphanPolicy(c.orphan)})` : ""}`);
  const dur = describeDuration(def?.duration);
  if (!left && dur && dur !== "instant") bits.push(`- ${dur} (ST-enforced)`);
  if (def?.then) bits.push(`- then ${def.then}`);
  if (char && def?.tiers?.length) {
    if (def.requiresAwakened && !isAwakened(char.templates)) {
      bits.push(`- ${def.scalesWith ?? "its"} benefits need the Awakened`);
    } else {
      const rating = def.scalesWith ? effectiveTraitOf(char, def.scalesWith) : 0;
      const folded = foldAfflictionTiers(rating, def.tiers);
      const ops = folded.ops.map(o => {
        const amount = o.amount ?? 1;
        const where = o.target ? ` on ${o.target}` : o.trait ? ` when the pool uses ${o.trait}` : "";
        return `${o.op} ${amount > 0 ? "+" : ""}${amount}${where}`;
      });
      const at = def.scalesWith ? `${def.scalesWith} ${rating}` : "grants";
      const all = [...ops, ...folded.notes];
      bits.push(all.length ? `- ${at}: ${all.join("; ")}` : `- ${at}: nothing yet`);
    }
  }
  if (c.note) bits.push(c.note);
  return bits.join(" ");
}

// Apply one definition to a subject: validate + resolve bindings, write the
// instance, then fire the def's mirror onto the bound target. Shared by
// afflict and advance. Returns the reply fragments or an error.
async function applyAffliction(subject: string, def: AfflictionDef, rawBindings: Record<string, string>, note?: string, expiry?: AfflictionExpiry, from?: string, cooldown?: AfflictionExpiry, orphan?: OrphanPolicy, level?: number): Promise<{ lines?: string[]; error?: string }> {
  const bindings: Record<string, string> = {};
  for (const slot of def.bindings ?? []) {
    const raw = rawBindings[slot];
    if (!raw) return { error: `${def.name} needs ${slot}=<name|@alias>.` };
    const r = await resolveBindingValue(raw);
    if (r.error) return { error: r.error };
    bindings[slot] = r.value!;
  }
  // A `$binding` an op reads but the def does not REQUIRE is optional: the tag
  // gate on difficulty-modifier is exactly this - give `tags=` and the op only
  // fires on rolls carrying it, leave it off and it fires on every roll using
  // the trait. Taken verbatim: these are tags and traits, not character names.
  for (const op of def.apply ?? []) {
    for (const raw of [op.trait, op.target]) {
      if (!raw?.startsWith("$")) continue;
      const slot = StringUtil.normalize(raw.slice(1));
      if (bindings[slot] !== undefined) continue;
      const given = rawBindings[slot];
      if (given?.trim()) bindings[slot] = StringUtil.normalize(given);
    }
  }
  const inst: ActiveAffliction = { def: def.name, bindings };
  // The MAGNITUDE rides on the instance, so one definition serves the 1/2/3
  // ladder every rated Merit is written on.
  if (level !== undefined && level !== 1) inst.level = level;
  if (note) inst.note = note;
  // The expiry rides on the INSTANCE, not the def: the same affliction may be
  // three rolls long on one man and an hour long on another.
  if (expiry) inst.expiry = expiry;
  // Where it came from (an arcanum, a spell, a Discipline, a botch) and when it
  // began - the second is what an "until X" condition measures against.
  // `::` is the path separator and folds to `:` - StringUtil.normalize does not
  // do that (only the command boundary does), and a source arriving inside
  // backticks skips the boundary entirely. Fold it here or an orphan sweep
  // would look for a name one colon different from the one it stored.
  if (from) inst.from = StringUtil.normalize(from).replace(/::+/g, ":");
  if (cooldown) inst.cooldown = cooldown;
  if (orphan) inst.orphan = orphan;
  inst.at = (await StoryClock.get())?.now ?? 0;
  await CharacterAfflictions.afflict(subject, inst);
  const lines = [`${disp(subject)} is now ${afflictionLine(inst)}`];
  if (def.mirror && bindings["target"]) {
    const mirrorDef = AfflictionRegistry.get(def.mirror);
    if (!mirrorDef) lines.push(`mirror "${def.mirror}" is not defined - skipped`);
    else {
      // A mirror ends when its original does: same expiry, copied.
      const mirrorInst: ActiveAffliction = { def: mirrorDef.name, bindings: { target: subject }, note: "(mirror)" };
      if (expiry) mirrorInst.expiry = { ...expiry };
      await CharacterAfflictions.afflict(bindings["target"], mirrorInst);
      lines.push(`${disp(bindings["target"])} is now ${afflictionLine(mirrorInst)}`);
    }
  }
  return { lines };
}

// Remove one affliction from a subject AND its mirror from the bound target.
// THE SOURCE IS NO MORE. Every affliction whose `from` names the thing that
// just went is re-measured through its orphan policy - which is one expression
// over what remains, so the owner's four behaviours are one code path:
//
//   ends at once      the policy evaluates to 0 and the affliction is lifted
//   ends in T         the policy is T, and what remains becomes T
//   carries on        no policy, nothing recomputed
//   an expression     `remaining-seconds / 2` and the like, with the remainder
//                     in scope
//
// `from` matches by PREFIX, so dropping `arcanum:trait-aptitude` takes the
// afflictions of `arcanum:trait-aptitude:melee` with it - the instance is a
// path, and losing the arcanum loses every trait it was applied to.
async function orphanAfflictions(subject: string, sourceKey: string): Promise<string[]> {
  const key = StringUtil.normalize(sourceKey).replace(/::+/g, ":");
  const active = await CharacterAfflictions.list(subject);
  const touched = active.filter(c => c.from && (c.from === key || c.from.startsWith(`${key}:`)));
  if (!touched.length) return [];
  const notes: string[] = [];
  const clock = await StoryClock.get();
  const now = clock?.now ?? 0;
  const char = await CharacterStore.load(subject);
  const next: ActiveAffliction[] = [];
  for (const c of active) {
    if (!touched.includes(c)) { next.push(c); continue; }
    // No policy is the owner's third case: the duration continues as normal.
    if (!c.orphan || (!c.orphan.rolls && !c.orphan.seconds)) {
      notes.push(`${disp(c.def)} outlives ${c.from}`);
      next.push(c);
      continue;
    }
    // What is LEFT, put in scope so a policy can speak about it.
    const remainingSeconds = c.expiry?.until !== undefined ? Math.max(0, c.expiry.until - now) : 0;
    const remainingRolls = c.expiry?.rolls ?? 0;
    const scope = await timedScope(char ?? undefined, c.at ?? now, now);
    const withRemainder: ExprScope = {
      lookup: (path) => (path.length === 1 && path[0] === "remaining-seconds" ? { value: remainingSeconds }
        : path.length === 1 && path[0] === "remaining-rolls" ? { value: remainingRolls }
        : scope.lookup(path)),
      call: scope.call,
    };
    const expiry: AfflictionExpiry = { ...(c.expiry ?? {}) };
    if (c.orphan.seconds !== undefined) {
      const secs = Math.max(0, Math.round(evaluateExpr(c.orphan.seconds, withRemainder).value));
      expiry.until = now + secs;
    }
    if (c.orphan.rolls !== undefined) {
      expiry.rolls = Math.max(0, Math.round(evaluateExpr(c.orphan.rolls, withRemainder).value));
    }
    next.push({ ...c, expiry });
  }
  await CharacterAfflictions.replace(subject, next);
  // Anything the policy reduced to nothing goes now, mirrors and all.
  for (const c of next) {
    if (!(await afflictionEnded(char ?? undefined, c, now))) continue;
    const r = await removeAffliction(subject, c.def);
    if (r.removed) notes.push(`${disp(c.def)} ends with ${c.from}`);
  }
  for (const c of next) {
    if (!touched.some(t => t.def === c.def) || !c.expiry?.until) continue;
    if (await afflictionEnded(char ?? undefined, c, now)) continue;
    notes.push(`${disp(c.def)} lingers - ${describeExpiry(c.expiry, formatStoryDate)}`);
  }
  return notes;
}

// TAKING A POWER APPLIES ITS PASSIVE. One function for all three kinds, because
// a Discipline, an Arcanum and a Merit differ in what they ARE and not in this:
// Potence is simply on, and so is an always-on arcanum, and so is Iron Will.
//
// The source is written `<kind>:<key>`, which is what makes losing it work:
// orphanAfflictions matches by prefix, so dropping the arcanum takes every
// trait it was applied to with it. The orphan policy defaults to `immediately`,
// because a power you no longer have is not working.
//
// Every application is ANNOUNCED on the bus (channel `affliction:applied`), so
// a distributed engine's other scripts learn about it without being asked.
async function applyPassiveGrant(subject: string, kind: string, key: string, grant: PassiveGrant, ctx: { param?: string; rating?: number } = {}): Promise<string> {
  // The command does NOT apply the affliction. It says a power was taken, and
  // the handler registered below decides what that means - which is the whole
  // difference between an event that announces and an event that causes.
  // `ctx` is what the instance knows and the affliction needs: its parameter
  // and the rating it was taken at.
  const event = await PostOffice.publish(SYSTEM.powerTaken, {
    character: subject, kind, key: StringUtil.normalize(key), grant, ctx,
  });
  const said = (event.data as { said?: string }).said;
  return event.errors.length ? `⚠ ${event.errors.join("; ")}` : (said ?? "");
}

// --- THE SYSTEM HANDLERS ------------------------------------------------------
// These are the "someone" the owner asked for: the parts that DO the work when
// a system event says something happened. They live on `local:` channels, so
// they never touch the wire, and they are registered once at module load beside
// every other registration in this file.
//
// A handler is synchronous (the bus wants a verdict on the next line) but its
// WORK is not, so it pushes its promise onto `event.pending` and the publisher
// awaits it. See core/bus.ts.
// Registration is a FUNCTION, not a bare side effect, and it is idempotent:
// calling it twice keeps one of each. A distributed engine will want to say
// explicitly which handlers a given script owns, and a test that silences one
// needs a way to put it back.
export function registerSystemHandlers(): void {
  for (const channel of [SYSTEM.powerTaken, SYSTEM.powerLost]) {
    for (const l of Bus.listeners(channel)) Bus.off(l.id);
  }
  Bus.on(SYSTEM.powerTaken, onPowerTaken);
  Bus.on(SYSTEM.powerLost, onPowerLost);
}

const onPowerTaken: BusHandler = (event) => {
  const d = event.data as { character: string; kind: string; key: string; grant: PassiveGrant; said?: string; ctx?: { param?: string; rating?: number } };
  event.pending.push((async () => {
    const def = AfflictionRegistry.get(d.grant.afflicts);
    if (!def) { event.errors.push(`"${d.grant.afflicts}" is not a defined affliction`); return; }
    const from = `${d.kind}:${d.key}`;
    // OFFERED means the power gives you the ABILITY, not the state: nothing is
    // applied now, and [[invoke]] is how it happens later.
    if (!grantIsAutomatic(d.grant)) {
      d.said = `${disp(def.name)} is now available - [[invoke ${def.name}]] to use it`;
      return;
    }
    const bindings = grantBindings(d.grant, d.ctx ?? {});
    const level = grantLevel(d.grant, d.ctx ?? {});
    const r = await applyAffliction(d.character, def, bindings, d.grant.note, undefined, from,
      undefined, makeOrphanPolicy(d.grant.orphan ?? "immediately"), level);
    if (r.error) { event.errors.push(r.error); return; }
    const about = Object.values(bindings).filter(Boolean);
    d.said = `${disp(def.name)} is now applied${about.length ? ` (${about.join(", ")})` : ""} (from ${from}${d.grant.note ? ` - ${d.grant.note}` : ""})`
      + `${d.grant.togglable ? ` - [[toggle ${def.name}]] switches it off` : ""}`;
    // ...and the OUTSIDE world hears about it on a channel that does leave.
    await PostOffice.publish("affliction:applied", {
      character: d.character, affliction: def.name, from, automatic: true,
    });
  })());
};

const onPowerLost: BusHandler = (event) => {
  const d = event.data as { character: string; kind: string; key: string; said?: string };
  event.pending.push((async () => {
    const notes = await orphanAfflictions(d.character, `${d.kind}:${d.key}`);
    if (notes.length) d.said = notes.join("; ");
  })());
};

registerSystemHandlers();

// When an affliction ends, arm whatever cooldown it carried. One place, so it
// happens whether it was lifted by hand, ran out of charges, or timed out.
async function armCooldown(subject: string, c: ActiveAffliction | undefined): Promise<void> {
  if (!c?.cooldown) return;
  await CharacterCooldowns.arm(subject, c.def, { expiry: { ...c.cooldown }, at: (await StoryClock.get())?.now ?? 0 });
}

// Is this def still cooling for this character? Returns how long is left, or
// undefined when it is ready. Also SWEEPS: a cooldown whose expiry has elapsed
// is deleted on the way past, so "ready" needs no separate tick.
async function cooldownLeft(char: PlayableCharacter | undefined, subject: string, def: string): Promise<string | undefined> {
  const armed = (await CharacterCooldowns.all(subject))[StringUtil.normalize(def)];
  if (!armed) return undefined;
  const now = (await StoryClock.get())?.now ?? 0;
  const condition = await expiryCondition(char, { expiry: armed.expiry, at: armed.at }, now);
  if (expiryElapsed(armed.expiry, now, condition)) {
    await CharacterCooldowns.clear(subject, def);
    return undefined;
  }
  return describeExpiry(armed.expiry, formatStoryDate);
}

// The counted sides of a cooldown tick exactly as an affliction's do.
async function countDownCooldowns(field: "rolls" | "turns" | "scenes", n: number, only?: string): Promise<void> {
  for (const name of only ? [only] : await CharacterStore.listNames()) {
    const map = await CharacterCooldowns.all(name);
    let touched = false;
    for (const [def, armed] of Object.entries(map)) {
      if (armed.expiry[field] === undefined) continue;
      map[def] = { ...armed, expiry: { ...armed.expiry, [field]: armed.expiry[field]! - n } };
      touched = true;
    }
    if (touched) await CharacterCooldowns.replace(name, map);
  }
}

async function removeAffliction(subject: string, defName: string): Promise<{ removed?: ActiveAffliction; alsoLifted?: string; error?: string }> {
  const removed = await CharacterAfflictions.lift(subject, defName);
  if (!removed) return { error: `${disp(subject)} does not have "${StringUtil.normalize(defName)}". [[afflictions${subject ? ` ${subject}` : ""}]] lists them.` };
  await armCooldown(subject, removed);
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
  // WHAT IT DOES WHILE IT IS ON - the same shorthand a merit's passive uses, so
  // there is one grammar for "-2 difficulty when the pool uses drive".
  let apply: EffectOp[] | undefined;
  if (cmd.named["apply"]?.trim()) {
    const ops = parsePassiveOps(cmd.named["apply"]);
    if ("error" in ops) return sys(ops.error);
    apply = ops;
  }
  const def = makeAfflictionDef({
    name,
    description: cmd.named["description"],
    bindings: (cmd.named["bindings"] ?? "").split(",").map(s => s.trim()).filter(Boolean),
    duration,
    then: cmd.named["then"],
    mirror: cmd.named["mirror"],
    tags: (cmd.named["tags"] ?? "").split(",").map(s => s.trim()).filter(Boolean),
    note: cmd.named["note"],
    apply,
  });
  await AfflictionRegistry.put(def);
  return sys(`Defined affliction ${describeAfflictionDef(def)}.`);
}

async function cmdAfflictionInfo(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) {
    const items = AfflictionRegistry.all().map(d => d.name).join(", ");
    return sys(`Defined afflictions: ${items}. [[show-affliction <name>]] for detail; [[show-affliction]] shows who has what.`);
  }
  const def = AfflictionRegistry.get(name);
  if (!def) return sys(`No affliction "${StringUtil.normalize(name)}". [[show-affliction]] lists them.`);
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
  if (!name) return sys(`afflict needs an affliction, e.g. [[afflict concentrating-on target="Wolf"]]. [[show-affliction]] lists them.`);
  const def = AfflictionRegistry.get(name);
  if (!def) return sys(`No affliction "${StringUtil.normalize(name)}". Define it with [[define-affliction]].`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  const expiry = await expiryFromArgs(cmd);
  if (expiry.error) return sys(expiry.error);
  // A cooldown is checked HERE and nowhere else: the one moment somebody tries
  // to apply the thing again.
  const cooling = await cooldownLeft(await CharacterStore.load(subject.name!) ?? undefined, subject.name!, def.name);
  if (cooling && flagOf(cmd, "waive") !== true) {
    return sys(`${disp(subject.name!)} cannot take ${def.name} again yet - ${cooling}. Add waive=true to override.`);
  }
  const cooldown = await expiryFromArgs(cmd, "cooldown-");
  if (cooldown.error) return sys(cooldown.error);
  // A bare duration ("1 hour") is the only orphan form that needs the clock;
  // everything else is already an expression in seconds.
  let orphan = makeOrphanPolicy(cmd.named["orphan"]);
  if (orphan?.seconds && !/^[\d\s+\-*/().]*$/.test(orphan.seconds)) {
    const dur = parseDuration(orphan.seconds);
    if (!("error" in dur)) orphan = { ...orphan, seconds: String(dur.seconds + dur.months * 2_592_000) };
  }
  const level = intOrUndef(cmd.named["level"] ?? "");
  const r = await applyAffliction(subject.name!, def, cmd.named, undefined, expiry.value, cmd.named["from"], cooldown.value, orphan, level);
  if (r.error) return sys(`${r.error}`);
  return sys(`${r.lines!.join("; ")}.`);
}

// How long, read off a command. `rolls=` is the counted side and its four
// filters narrow WHICH rolls count; `for=` is the timed side, taken as a
// duration off the story clock. Both may be given - whichever ends first wins.
//
// A COOLDOWN is read by the same function with a `cooldown-` prefix, because it
// is the same six measures asking the opposite question. `cooldown-for=1 day`,
// `cooldown-scenes=1`, `` cooldown-until=`full-moons >= 1` `` - all of it, free.
async function expiryFromArgs(cmd: ParsedCommand, prefix = ""): Promise<{ value?: AfflictionExpiry; error?: string }> {
  const arg = (key: string): string | undefined => cmd.named[`${prefix}${key}`];
  const list = (key: string): string[] => (arg(key) ?? "").split(",").map(t => t.trim()).filter(Boolean);
  let until: number | undefined;
  const forRaw = arg("for")?.trim();
  if (forRaw) {
    const clock = await StoryClock.get();
    if (!clock) return { error: NO_CLOCK };
    const dur = parseDuration(forRaw);
    if ("error" in dur) return { error: dur.error };
    until = addDuration(clock.now, dur);
  }
  return {
    value: makeAfflictionExpiry({
      rolls: intOrUndef(arg("rolls") ?? ""),
      withTags: list("with-tags"), withoutTags: list("without-tags"),
      usingTraits: list("using"), notUsingTraits: list("not-using"),
      turns: intOrUndef(arg("turns") ?? ""),
      scenes: intOrUndef(arg("scenes") ?? ""),
      untilExpr: arg("until"),
      untilEvent: arg("until-event"),
      until,
    }),
  };
}

// toggle <affliction> - switch a TOGGLABLE passive off, or back on. The power
// is not lost either way; the character is choosing whether it is working.
// Like everything else here it goes through a system event, so the deciding and
// the doing stay separate.
async function cmdToggle(cmd: ParsedCommand): Promise<string> {
  const name = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!name) return sys(`toggle needs an affliction, e.g. [[toggle potent]]. [[show-affliction]] lists what is on.`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  const char = await CharacterStore.load(subject.name!);
  if (!char) return sys(`No character named "${subject.name}".`);
  const on = (await CharacterAfflictions.list(subject.name!)).find(c => c.def === name);
  // WHICH power offers this, so toggling back on can restore the same source.
  const source = passiveSourceFor(char, name);
  if (!on && !source) {
    return sys(`Nothing ${disp(char.name)} has offers "${name}", and it is not active. `
      + `[[afflict ${name}]] applies it outright.`);
  }
  if (on) {
    const r = await removeAffliction(subject.name!, name);
    return sys(`${disp(char.name)} switches ${disp(name)} OFF${r.alsoLifted ? ` (${r.alsoLifted})` : ""}. `
      + `${source ? `[[toggle ${name}]] switches it back on.` : ""}`);
  }
  const said = await applyPassiveGrant(subject.name!, source!.kind, source!.key, source!.grant, source!.ctx);
  return sys(`${disp(char.name)} switches ${disp(name)} ON. ${said}`);
}

// invoke <affliction> - use a power that was OFFERED rather than automatic.
// Same door, and the cooldown check in [[afflict]] is what rations it.
async function cmdInvoke(cmd: ParsedCommand): Promise<string> {
  const name = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!name) return sys(`invoke needs an affliction, e.g. [[invoke veil]].`);
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const source = passiveSourceFor(char, name);
  if (!source) {
    return sys(`Nothing ${disp(char.name)} has offers "${name}". [[show-merit]], [[show-arcanum]] and [[show-sheet]] show what he holds.`);
  }
  const said = await applyPassiveGrant(StringUtil.normalize(char.name), source.kind, source.key,
    { ...source.grant, mode: "automatic" }, source.ctx);
  return sys(`${disp(char.name)} invokes ${disp(name)}. ${said}`);
}

// Which power a character holds that deals in this affliction - the arcanum,
// the merit or the Discipline. One walk, used by both verbs above; the KIND it
// reports is the def's own, which is what makes the source key (`<kind>:<key>`)
// match again when the power is dropped.
function passiveSourceFor(char: PlayableCharacter, affliction: string):
    { kind: string; key: string; grant: PassiveGrant; ctx: { param?: string; rating?: number } } | undefined {
  for (const inst of ownedPowerInstances(char)) {
    if (inst.def.grants?.afflicts === affliction) {
      // The instance's own parameter and rating go with it, so switching a
      // passive back on restores THE SAME one - the right trait, at the right
      // level - and not a bare copy of the definition.
      return { kind: inst.def.kind, key: inst.key, grant: inst.def.grants,
        ctx: { param: inst.param, rating: inst.points } };
    }
  }
  for (const [trait, rating] of Object.entries(char.disciplines ?? {})) {
    const d = rating > 0 ? disciplineDef(trait) : undefined;
    if (d?.grants?.afflicts === affliction) return { kind: "discipline", key: trait, grant: d.grants, ctx: { rating } };
  }
  return undefined;
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
    if (!cur) return noCharacter(`or name someone: [[show-affliction "Wolf"]]`);
    subject = StringUtil.normalize(cur.name);
  }
  const list = await CharacterAfflictions.list(subject);
  const char = await CharacterStore.load(subject);   // a sheet lets scaled afflictions report their tiers
  // What is COOLING belongs on the same listing: "why can't I do that again"
  // is the same question as "what is on me", asked from the other side. The
  // read sweeps expired cooldowns on its way past, so nothing else has to.
  const cooling: string[] = [];
  for (const def of Object.keys(await CharacterCooldowns.all(subject))) {
    const left = await cooldownLeft(char ?? undefined, subject, def);
    if (left) cooling.push(`${disp(def)} (cooling - ${left})`);
  }
  if (!list.length && !cooling.length) return sys(`${disp(subject)} has no afflictions.`);
  const bits = [...list.map(c => afflictionLine(c, char)), ...cooling];
  return sys(`${disp(subject)} - ${bits.join("; ")}.`);
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
  return target ? { name: target } : { error: `Unknown alias "@${ref.alias}". [[show-alias]] lists them; [[alias @${ref.alias} "Name"]] defines it.` };
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
  if (flagOf(cmd, "default") === true) { await PlayerStore.setDefault(name); note = " (also the default player now)"; }
  return sys(`Current player is now ${disp(StringUtil.normalize(name))}${note}.`);
}

// --- DISCOVERABILITY -------------------------------------------------------
// [[help]] surfaces the command registry; [[show-character]] and [[set-default]]
// round out character selection (creation sets the first default; this changes it).
async function cmdHelp(cmd: ParsedCommand): Promise<string> {
  const verb = cmd.positional[0]?.trim().toLowerCase();
  if (verb) {
    // Asking about a name that MOVED is the most useful moment to say so.
    const spec = CommandRouter.specFor(verb);
    const help = CommandRouter.helpFor(verb);
    if (help && spec?.deprecated) {
      return sys(`${verb} is now [[${spec.deprecated}]] - it still works. `
        + `${spec.deprecated} - ${CommandRouter.helpFor(spec.deprecated)}`);
    }
    return help
      ? sys(`${verb} - ${help}`)
      : sys(`No command "${verb}". [[help]] lists them all.`);
  }
  // The CURRENT vocabulary only. Old names still route; listing them would
  // double the wall of text a player is reading to find out what exists.
  const verbs = CommandRouter.verbs();
  const older = CommandRouter.deprecatedVerbs().length;
  return sys(`${verbs.length} commands: ${verbs.join(", ")}. [[help <verb>]] for one's usage. `
    + `Anything named show-* only LOOKS at things, and its reply is kept out of the AI's context `
    + `(add in-story=true to keep one). ${older} older name${older === 1 ? "" : "s"} still work and say what replaced them.`);
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

// set-trait <name> <rating> - the writing counterpart of [[show-sheet]]. Merits have
// [[take-merit]] and specialties have [[specialty]]; every OTHER rating - an
// Attribute, an Ability, a Background, a Discipline, a Pillar - had only the
// lorebook card, which is fine until you want one command. The group is
// inferred from what the trait already is (traitKindOf), named with group=, or
// falls back to the free `traits` bucket.
const TRAIT_GROUPS: Record<string, keyof PlayableCharacter> = {
  attribute: "attributes", attributes: "attributes",
  ability: "abilities", abilities: "abilities",
  background: "backgrounds", backgrounds: "backgrounds",
  virtue: "virtues", virtues: "virtues",
  discipline: "disciplines", disciplines: "disciplines",
  trait: "traits", traits: "traits",
  pool: "poolStarts", pools: "poolStarts", "pool-starts": "poolStarts",
};

// What the chronicle's own lists say a name is - the lorebook is the authority
// on which Abilities and Backgrounds exist.
async function srdGroupOf(trait: string): Promise<string | undefined> {
  const key = StringUtil.normalize(trait);
  const has = (list: string[]): boolean => list.some(n => StringUtil.normalize(n) === key);
  if (has(await LorebookManager.allBackgrounds())) return "background";
  for (const list of [LorebookManager.allTalents, LorebookManager.allSkills, LorebookManager.allKnowledges]) {
    if (has(await list())) return "ability";
  }
  return undefined;
}

async function cmdSetTrait(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const rawName = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!rawName) {
    return sys(`set-trait needs a trait and a rating, e.g. [[set-trait sanctum 8]] or `
      + `[[set-trait mentor 5 note=\`his mother\` paid=0]]. Groups: ${Object.keys(TRAIT_GROUPS).filter(g => !g.endsWith("s")).join(", ")}.`);
  }
  const trait = StringUtil.normalize(rawName);
  const rating = intOrUndef((cmd.named["rating"] ?? cmd.positional[1]) ?? "");
  if (rating === undefined) return sys(`set-trait needs a rating, e.g. [[set-trait ${trait} 3]].`);

  // The character's own buckets answer first; failing that the chronicle's SRD
  // lists do, so a Background nobody has rated yet still files as a Background
  // rather than landing in the free `traits` bucket.
  const askedGroup = StringUtil.normalize(cmd.named["group"] ?? "");
  const kind = traitKindOf(char, trait) ?? await srdGroupOf(trait);
  const group = askedGroup ? TRAIT_GROUPS[askedGroup] : TRAIT_GROUPS[kind ?? ""] ?? "traits";
  if (askedGroup && !group) {
    return sys(`No trait group "${askedGroup}". Known: ${[...new Set(Object.values(TRAIT_GROUPS))].join(", ")}.`);
  }
  const bucket = char[group] as Record<string, number>;
  const had = trait in bucket ? bucket[trait] : undefined;

  const note = cmd.named["note"]?.trim();
  const paid = cmd.named["paid"]?.trim();
  const add = flagOf(cmd, "add") === true;
  if (add || note !== undefined || (char.instances?.[trait]?.length ?? 0) > 1) {
    // More than one of the same Background: keep them as instances, each with
    // its own note and its own price.
    const list = add ? [...(char.instances?.[trait] ?? [])] : [];
    if (add && !list.length && had !== undefined) list.push({ rating: had });
    const inst: TraitInstance = { rating };
    if (note) inst.note = note;
    if (paid !== undefined) inst.paid = paid;
    list.push(inst);
    char.instances = { ...(char.instances ?? {}), [trait]: list };
    bucket[trait] = Math.max(...list.map(i => i.rating));
  } else {
    bucket[trait] = rating;
    if (char.instances?.[trait]) { const rest = { ...char.instances }; delete rest[trait]; char.instances = rest; }
    if (paid !== undefined) char.paid = { ...(char.paid ?? {}), [trait]: paid };
  }
  await CharacterStore.save(char);
  // A Discipline that is simply ON (Potence, Fortitude) applies its passive the
  // moment it is rated, and takes it away again at 0 - the same rule the take
  // verbs follow, because a Discipline is a power like any other.
  let passiveNote = "";
  const disc = group === "disciplines" ? disciplineDef(trait) : undefined;
  if (disc?.grants) {
    const who = StringUtil.normalize(char.name);
    if (rating > 0 && (had ?? 0) <= 0) passiveNote = ` ${await applyPassiveGrant(who, "discipline", trait, disc.grants, { rating })}.`;
    else if (rating <= 0 && (had ?? 0) > 0) {
      const lost = await PostOffice.publish(SYSTEM.powerLost, { character: who, kind: "discipline", key: trait });
      const said = (lost.data as { said?: string }).said;
      if (said) passiveNote = ` ${said}.`;
    }
  }
  const held = char.instances?.[trait];
  const shown = held && held.length > 1
    ? held.map(i => `${i.rating}${i.note ? ` (${i.note})` : ""}`).join(" + ")
    : String(bucket[trait]);
  return sys(`${disp(char.name)} ${group === "poolStarts" ? "pool start" : StringUtil.normalize(group).replace(/ies$/, "y").replace(/s$/, "")} `
    + `${disp(trait)}: ${shown}${had !== undefined && !add ? ` (was ${had})` : ""}`
    + `${paid !== undefined ? `, paid ${paid}` : ""}.${passiveNote} [[show-sheet]] shows the whole record.`);
}

// --- MIGRATION: the one place that still understands the old JSON cards ------
// Cards written before the readable format hold JSON. Nothing READS that any
// more (core/cardtext.ts is the only card language), so this rewrites them in
// place: same header, same data, new language. Idempotent - a card already in
// the new format is not JSON and is left alone - and safe on a card the engine
// doesn't own, because only wod:/srd: categories are visited.
function jsonCardBody(text: string): CardValue | undefined {
  const body = LorebookManager.contentBelowHeader(text).trim();
  if (!body.startsWith("{") && !body.startsWith("[")) return undefined;
  try { return JSON.parse(body) as CardValue; } catch { return undefined; }
}

async function cmdConvertCards(): Promise<string> {
  const converted: string[] = [];
  const failed: string[] = [];
  for (const cat of await api.v1.lorebook.categories()) {
    const category = (cat.name ?? "").trim().toLowerCase();
    if (!category.startsWith("wod:") && !category.startsWith("srd:")) continue;
    for (const entry of await api.v1.lorebook.entries(cat.id)) {
      const text = entry.text ?? "";
      const parsed = jsonCardBody(text);
      if (parsed === undefined) continue;
      const label = (entry.displayName ?? "(unnamed)").trim();
      const header = text.slice(0, text.length - LorebookManager.contentBelowHeader(text).length);
      let value: CardValue | undefined;
      if (category === PLAYER_CHARACTERS_CATEGORY) {
        const char = parsed as unknown as PlayableCharacter;
        if (char && typeof char.name === "string" && Array.isArray(char.templates)) value = characterToCard(char);
      } else if (Array.isArray(parsed)) {
        // A list of named defs reads far better keyed by its names.
        value = parsed.every(d => typeof (d as Record<string, unknown>)?.["name"] === "string")
          ? namedDefsToCard(parsed as unknown as Array<{ name: string }>)
          : parsed;
      } else {
        value = parsed;
      }
      if (value === undefined) { failed.push(label); continue; }
      await api.v1.lorebook.updateEntry(entry.id, { text: `${header}\n${formatCardText(value)}` });
      await TrackedLorebook.refreshBackup(category, label, `${header}\n${formatCardText(value)}`);
      converted.push(label);
    }
  }
  if (!converted.length && !failed.length) return sys("Nothing to convert - every card is already in the readable format.");
  const sync = await CharacterStore.syncFromLorebook();
  await MeritFlawRegistry.loadFromLorebook();
  await ArcanumRegistry.loadFromLorebook();
  await reloadAllConfigStores();
  const bits = [`Converted ${converted.length} card${converted.length === 1 ? "" : "s"} from JSON: ${converted.join(", ")}.`];
  if (failed.length) bits.push(`Left alone (unreadable): ${failed.join(", ")}.`);
  if (sync.synced.length) bits.push(`Re-synced ${sync.synced.map(n => StringUtil.toTitleCase(n)).join(", ")}.`);
  if (sync.emptied.length) bits.push(`⚠ A whole group went empty: ${sync.emptied.join("; ")} - the card is the source of truth, so a group left OFF it is a group erased.`);
  return sys(`${bits.join(" ")} Open a card to see the new format; [[show-sheet]] confirms what the engine reads.`);
}

// The record as the ENGINE reads it: every numeric bucket, with the effective
// value marked wherever enhancements/boosts change what a roll will actually
// use. This is the verification half of the creator-mode loop: hand-edit the
// lorebook card, run [[show-sheet]], see exactly what synced.
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
    if (!char) return noCharacter();
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
  // BY CATEGORY, because that is how a sheet is read and how the creation
  // budget is allocated: Physical/Social/Mental and Talents/Skills/Knowledges.
  // A trait the chronicle's lists do not name still shows, under "other" -
  // nothing is ever hidden because it could not be filed.
  const byCategory = (bucket: Record<string, number>, categories: readonly string[], skipZeros: boolean): string => {
    const held = Object.keys(bucket ?? {});
    const bits: string[] = [];
    const filed = new Set<string>();
    for (const category of categories) {
      const mine = held.filter(n => traitInCategory(n, category));
      mine.forEach(n => filed.add(n));
      const shown = Object.fromEntries(mine.map(n => [n, bucket[n]]));
      const text = fmt(shown, skipZeros);
      if (text !== "none") bits.push(`${disp(category)}: ${text}`);
    }
    const rest = held.filter(n => !filed.has(n));
    if (rest.length) {
      const text = fmt(Object.fromEntries(rest.map(n => [n, bucket[n]])), skipZeros);
      if (text !== "none") bits.push(`Other: ${text}`);
    }
    return bits.length ? bits.join(" | ") : "none";
  };
  const parts = [
    `${disp(char.name)} [${char.templates.join("+")}, ${char.stage}]`,
    `Attributes - ${byCategory(char.attributes, ATTRIBUTE_CATEGORIES, false)}`,
    `Abilities (nonzero) - ${byCategory(char.abilities, ABILITY_CATEGORIES, true)}`,
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
    parts.push(`Merits/Flaws: ${Object.entries(char.meritsFlaws).map(([k, v]) => `${StringUtil.normalize(k)} ${v}`).join(", ")} ([[show-merit]] for detail)`);
  }
  // Its own line, because it is its own category - and absent entirely from the
  // sheets of the characters (nearly all of them) who have no Arcana.
  if (Object.keys(char.arcana ?? {}).length) {
    parts.push(`Arcana/Taints: ${Object.entries(char.arcana!).map(([k, v]) => `${StringUtil.normalize(k)} ${v}`).join(", ")} ([[show-arcanum]] for detail)`);
  }
  const specs = Object.entries(char.specialties ?? {}).filter(([, labels]) => labels.length);
  if (specs.length) parts.push(`Specialties: ${specs.map(([t, labels]) => `${t}: ${labels.join(", ")}`).join("; ")}`);
  // More than one of the same Background: the slot shows the highest, so say
  // what else is held (which one a roll means is the Storyteller's call).
  const held = Object.entries(char.instances ?? {}).filter(([, list]) => list.length > 1);
  if (held.length) {
    parts.push(`Held more than once: ${held.map(([t, list]) =>
      `${t} ${list.map(i => `${i.rating}${i.note ? ` (${i.note})` : ""}${i.paid !== undefined ? ` [paid ${i.paid}]` : ""}`).join(" + ")}`).join("; ")} - the slot rates the highest; which one a roll is about is Storyteller-adjudicated`);
  }
  const priced = Object.entries(char.paid ?? {});
  if (priced.length) parts.push(`Prices the Storyteller set: ${priced.map(([k, v]) => `${k} = ${v}`).join(", ")}`);
  if (char.tags.length) parts.push(`Tags: ${char.tags.join(", ")}`);
  // A pool start naming a resource this character doesn't have is a leftover -
  // most often a Willpower entry on someone whose Willpower was REPLACED. Trait
  // lookups can still find it, so say so rather than let it lurk.
  const own = new Set(CharacterResources.defsFor(char).map(d => StringUtil.normalize(d.name)));
  const stale = Object.keys(char.poolStarts ?? {}).filter(k => !own.has(StringUtil.normalize(k)));
  if (stale.length) {
    parts.push(`⚠️ pool start${stale.length === 1 ? "" : "s"} for ${stale.join(", ")} - this character has no such resource `
      + `(replaced or never granted). Delete the line in creator mode; [[show-resource]] is the truth`);
  }
  parts.push(`Live pools via [[show-resource]], damage via [[show-health]]`);
  return sys(`${parts.join(". ")}.`);
}

async function cmdSetDefault(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) return sys(`set-default needs a name, e.g. [[set-default name="Rok"]].`);
  const ref = await resolveCharacterRef(name);
  if (ref.error) return sys(`${ref.error}`);
  const c = await CharacterStore.load(ref.name!);
  if (!c) return sys(`No character named "${ref.name}". [[show-character]] lists them.`);
  await CharacterStore.setDefault(c.name);
  return sys(`${disp(c.name)} is now the default character ([[play]] with no name selects it).`);
}


// --- CREATOR-MODE SYNC (the router's game-side hook) -------------------------
// While creator mode is on, the player may have hand-edited character entries
// or any wod:config entry: re-sync characters (player edits win) and reload
// every config store before a command runs, and again when leaving the mode.
// The beforeRoute hook syncs BEFORE the command runs, so by the time
// [[creator-mode set=false]] does its own sync there is nothing left to notice.
// Whatever the last sync saw is kept here so the reply can still say it.
let lastEmptied: string[] = [];
async function syncFromCreatorEdits(): Promise<{ synced: string[]; failed: string[]; emptied: string[] }> {
  await reconcileLorebook();   // tracked-card drift first (may open modals)
  const result = await CharacterStore.syncFromLorebook();
  await reloadAllConfigStores();
  if (result.emptied.length) lastEmptied = result.emptied;
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
// `hint` is the GRAMMAR (it goes in the one-line usage [[help]] prints);
// `example` is what a window shows inside the empty field, so it must be
// something a player could type. The grammar reads: a resource name, "::effect"
// to pick one of its NAMED effects (heal, boost, fuel, cast...) instead of the
// default, and a trailing "!" to make payment REQUIRED - unpayable means the
// action is refused rather than rolled for free.
const SPEND_HINT = "res[::effect][!]";
const SPEND_EXAMPLE = "blood  ·  blood::heal  ·  willpower!";
const ROLL_KNOBS: ParamSpec[] = [
  { key: "difficulty", kind: "positional", hint: "[difficulty|expr]" },
  { key: "diff-mod", kind: "positional", hint: "[diff-mod]" },
  { key: "requires", kind: "named", type: "int", desc: "Successes required" },
  { key: "dice-modifier", kind: "named", type: "int", desc: "Dice added or removed" },
  { key: "min-difficulty", kind: "named", type: "int", desc: "Floor the die target never drops below (overrides the chronicle's)" },
  { key: "successes", kind: "named", type: "int", desc: "Automatic successes, granted before the dice (a rolled 1 can cancel these)" },
  { key: "uncancelable", kind: "named", type: "int", desc: "Un-cancelable successes: certain ones no rolled 1 can ever take away" },
  { key: "tags", kind: "named", hint: '"a,b"', desc: "Roll tags (fire registered modifiers)" },
  { key: "spend", kind: "named", hint: SPEND_HINT, example: SPEND_EXAMPLE,
    desc: 'Resource to spend on the roll — "::effect" picks a named effect, "!" means no payment, no roll' },
  { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1; a resource may cap it per use)" },
  { key: "specialty", kind: "named", hint: "<trait|label>", example: "Swords  ·  or its trait: melee",
    desc: "Apply ONE specialty (+1 die; pool must use its trait)" },
];

CommandRouter.register("help", cmdHelp, {
  summary: "list commands, or show one's usage",
  params: [{ key: "verb", kind: "positional", hint: "<verb>" }],
});
CommandRouter.register("creator-mode", cmdCreatorMode, {
  summary: "toggle lorebook hand-editing; edits sync in while on",
  params: [{ key: "set", kind: "named", type: "bool", required: true }],
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
CommandRouter.register("set-trait", cmdSetTrait, {
  summary: "set any rating the sheet holds (Attribute, Ability, Background, Discipline, Pillar, pool start)",
  note: "merits use [[take-merit]]; specialties use [[specialty]]",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<trait>", example: "sanctum" },
    { key: "rating", kind: "positional", required: true, hint: "<n>", example: "8" },
    { key: "group", kind: "named", desc: "Which group it belongs to (inferred when the trait is already known)", example: "background" },
    { key: "note", kind: "named", type: "literal", desc: "Whose/which one this is - keeps it as a separate instance" },
    { key: "paid", kind: "named", desc: "What it really cost (0 = the Storyteller granted it)" },
    { key: "add", kind: "named", type: "bool", desc: "Hold ANOTHER of the same trait rather than replacing" },
  ],
});
CommandRouter.register("convert-cards", cmdConvertCards, {
  summary: "rewrite any lorebook card still holding JSON in the readable format (one-shot)",
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
  summary: "save a roll under a name; @name invokes it with its spend/specialty/table baked in (extended=true makes a procedure, opposed= makes a contest)",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>" },
    { key: "pool", kind: "positional", required: true, hint: "<pool>" }, ...ROLL_KNOBS,
    { key: "table", kind: "named", desc: "Success table read when the roll is invoked" },
    { key: "extended", kind: "named", type: "bool", desc: "Make it an extended procedure (target supplied at invoke)" },
    { key: "intervals", kind: "named", type: "int", desc: "Extended: default max rolls" },
    { key: "interval", kind: "named", desc: "Extended: advisory spacing (e.g. 1 turn)" },
    { key: "on-botch", kind: "named", type: "enum", options: ["fail", "lose-successes", "ignore"], desc: "Extended: botch policy" },
    { key: "opposed", kind: "named", type: "enum", options: ["resisted", "contested"], desc: "Make it a contest (opponent supplied at invoke via vs=); with extended=, a race" },
    { key: "vs-pool", kind: "named", desc: "Opposed: the opposition's pool (default: your own pool)" },
    { key: "vs-difficulty", kind: "named", type: "int", desc: "Opposed: default difficulty for the opposition's roll" },
    { key: "description", kind: "named", type: "literal", desc: "Rules prose (verbatim)" }],
});
CommandRouter.register("list-rolls", cmdListRolls, { summary: "list the chronicle's saved rolls" });
CommandRouter.register("roll-info", cmdRollInfo, {
  summary: "show a saved roll's full spec, sidecars, procedure steps, and description",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("add-step", cmdAddStep, {
  summary: "append a follow-up step to a saved procedure (composes named rolls)",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<procedure>" },
    { key: "roll", kind: "named", required: true, hint: "@<saved-roll>", desc: "The follow-up roll to run" },
    { key: "when", kind: "named", type: "enum", options: ["always", "on-success", "on-fail", "on-botch"], desc: "When this step applies, by the entry's outcome" },
    { key: "note", kind: "named", type: "literal", desc: "What this step is, in fiction" }],
});
CommandRouter.register("clear-steps", cmdClearSteps, {
  summary: "drop all follow-up steps from a saved procedure (its entry roll stays)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<procedure>" }],
});
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
    { key: "spend", kind: "named", hint: SPEND_HINT, example: SPEND_EXAMPLE },
    { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1)" },
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
    { key: "spend", kind: "named", hint: SPEND_HINT, example: SPEND_EXAMPLE },
    { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1)" },
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
CommandRouter.register("resources", () => cmdResources(), { summary: "list the current character's resources" });
CommandRouter.register("attune", cmd => cmdAttune(cmd), {
  summary: "what this character can USE (a pool he cannot use is only points)",
  params: [
    { key: "capability", kind: "positional", hint: "[awakened|vitae|resolve]" },
    { key: "off", kind: "positional", hint: "[off]" },
  ],
});
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
CommandRouter.register("health", () => cmdHealth(), { summary: "show the current character's health track" });
CommandRouter.register("clear-boosts", cmdClearBoosts, { summary: "clear trait boosts (the ST calls the duration)" });
CommandRouter.register("reset-uses", cmdResetUses, { summary: "scene/turn change: clears effect-use counters" });
CommandRouter.register("configure-resources", cmdConfigureResources, { summary: "guided resource setup; plain replies answer it" });
CommandRouter.register("cancel-wizard", cmdCancelWizard, { summary: "abandon the running wizard" });
// Both sides, the same shape: [[resist]] and [[contest]] differ only in how the
// margin is read, so their grammar is one list.
const TWO_SIDED_PARAMS: ParamSpec[] = [
  { key: "your-pool", kind: "positional", required: true, hint: "<your-pool>" },
  { key: "their-pool", kind: "positional", required: true, hint: "<their-pool>" },
  { key: "vs", kind: "named", hint: '"Name"', desc: "Opposing character (stored characters roll live)" },
  { key: "difficulty", kind: "named", type: "int" },
  { key: "vs-difficulty", kind: "named", type: "int" },
  { key: "table", kind: "named", desc: "Success table read with your margin" },
  { key: "spend", kind: "named", hint: SPEND_HINT, example: SPEND_EXAMPLE },
  { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1)" },
];
CommandRouter.register("resist", cmdResist, {
  summary: "resisted action: your margin over theirs counts (tie = fail)",
  params: [...TWO_SIDED_PARAMS],
});
CommandRouter.register("contest", cmdContest, {
  summary: "contested action: higher total wins (tie = draw)",
  params: [...TWO_SIDED_PARAMS],
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
CommandRouter.register("story-start", cmdStoryStart, {
  summary: "set when the story begins (yyyy-mm-dd-hh)",
  params: [{ key: "date", kind: "positional", required: true, hint: "yyyy-mm-dd-hh", example: "1197-03-15-08" }],
});
CommandRouter.register("advance-time", cmdAdvanceTime, {
  summary: "move the story clock forward (s/m/h/d/w/mo/y); crossing midnights/full moons applies recovery",
  params: [{ key: "duration", kind: "positional", required: true, hint: "<duration>", example: "2d 6h" }],
});
// MAGICK, with the k, and the reason is disambiguation rather than flavour:
// Sorcery, Blood Sorcery (Kulunic among them) and Disciplines that look like
// spellcasting (Chimerstry) are all "casting" too, and each will want its own
// verb. `magick` is the AWAKENED one and says so in its name.
CommandRouter.register("magick", cmdCast, {
  summary: "work Awakened magick (Dark Ages: Mage) - pillars carry the REQUIRED levels",
  params: [
    { key: "pillars", kind: "named", required: true, hint: '"name:level[,name:level...]"', example: 'e.g. "warrior:4,chieftain:2"' },
    { key: "foundation", kind: "named", hint: "<trait>", desc: "Foundation trait name (default: foundation)" },
    { key: "quintessence", kind: "named", type: "int", desc: "Extra points: -1 difficulty each (min 4; 3/turn cap)" },
    { key: "label", kind: "named", desc: "Spell name (keys the same-scene retry ledger)" },
    { key: "requires", kind: "named", type: "int", desc: "Successes needed (extended/ongoing: the ST's total)" },
    { key: "extended", kind: "named", type: "bool", desc: "Accrue successes over intervals" },
    { key: "ongoing", kind: "named", type: "bool", desc: "Indefinite-duration spell (successes ×10; per-success fuel; seal at the end)" },
    { key: "interval", kind: "named", desc: "Time between extended rolls (advisory)" },
    { key: "intervals", kind: "named", type: "int", desc: "Max rolls for an extended casting" },
    { key: "on-botch", kind: "named", type: "enum", options: ["fail", "lose-successes", "ignore"], desc: "Extended botch policy (default fail: Backlash ends it)" },
    { key: "spend", kind: "named", hint: "<res[:effect][!]>", desc: "Resource to spend on the roll" },
    { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1; a resource may cap it per use)" },
  ],
});
// @deprecated - the old name for [[magick]]. Kept so live stories and saved
// rolls do not break; Sorcery and Blood Sorcery will want "cast" for themselves.
CommandRouter.register("cast", cmdCast, {
  summary: "@deprecated - use [[magick]] (Awakened magic); this name is wanted for Sorcery",
  params: CommandRouter.specFor("magick")?.params ?? [],
});
CommandRouter.register("seal-spell", cmdSealSpell, {
  summary: "seal an ongoing spell: 5 Quintessence per highest-Pillar dot + 1 Willpower per 10",
  params: [
    { key: "pillar", kind: "named", type: "int", required: true, desc: "Highest Pillar level involved" },
    { key: "pay", kind: "named", type: "bool", desc: "Spend now (else the price is quoted as a debt)" },
  ],
});
CommandRouter.register("creation", cmdCreation, {
  summary: "the creation budget: every pool against what the sheet holds (advisory)",
  params: [{ key: "character", kind: "positional", hint: '"[name|@alias]"' }],
});
CommandRouter.register("derived", cmdDerived, {
  summary: "what the sheet implies rather than states: Road, Willpower, generation, and why",
  params: [{ key: "character", kind: "positional", hint: '"[name|@alias]"' }],
});
CommandRouter.register("eval", cmd => cmdEval(cmd), {
  summary: "read an expression against the current character (the reference system, exposed)",
  params: [{ key: "expression", kind: "positional", hint: "<expression>", example: "12 - background:generation" }],
});
CommandRouter.register("choose", cmdChoose, {
  summary: "pick a clan, a fellowship, or the Attribute/Ability priorities",
  params: [
    { key: "what", kind: "positional", hint: "<clan|fellowship|attributes|abilities>", example: "clan" },
    { key: "value", kind: "positional", hint: "<value>", example: "tremere" },
  ],
});
CommandRouter.register("clans", cmdClans, {
  summary: "the clans and their Disciplines",
  params: [{ key: "name", kind: "positional", hint: "[name]", example: "nosferatu" }],
});
CommandRouter.register("clan", cmdClans, {
  summary: "one clan: its Disciplines and what it bounds",
  params: [{ key: "name", kind: "positional", hint: "<name>", example: "nosferatu" }],
});
CommandRouter.register("templates", cmdTemplates, {
  summary: "the templates this chronicle knows, and what each one is made of",
  params: [{ key: "name", kind: "positional", hint: "[name]", example: "ouroboros" }],
});
CommandRouter.register("extend-template", cmdExtendTemplate, {
  inStory: false,
  summary: "a new template from an old one: state only what differs",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>", example: "Ouroboros" },
    { key: "extends", kind: "named", hint: "<template>", example: "mage", desc: "The template it inherits everything else from" },
    { key: "description", kind: "named", hint: "<text>", desc: "Its display name" },
    { key: "soak", kind: "named", type: "enum", options: Object.keys(SOAK_TABLES), desc: "Which soak table it uses" },
    { key: "morality", kind: "named", type: "enum", options: ["humanity", "torment", "none"], desc: "Its Road/Humanity, or none" },
    { key: "awakened", kind: "named", type: "bool", desc: "Does it work Awakened magic?" },
    { key: "has-virtues", kind: "named", type: "bool" },
    { key: "resources", kind: "named", hint: '"a,b"', desc: "Resources to ADD (define them first with [[define-resource]])" },
    { key: "capabilities", kind: "named", hint: '"vitae,resolve"', desc: "What it can USE, added to the parent's" },
    {
      key: "budgets", kind: "named", hint: '"arcana=role:willpower"', example: "arcana=role:willpower,arcana:freebie=-",
      desc: 'Any part of any purse: "purse=<allowance expression>", or "purse:freebie=" / "purse:experience=" for what a dot costs ("-" = cannot be bought)',
    },
    {
      key: "creation", kind: "named", hint: '"disciplines=4"', example: "disciplines=4,discipline-max=5",
      desc: `The creation pools: ${CREATION_FIELDS.map(([n]) => n).join(", ")}`,
    },
    {
      key: "disciplines", kind: "named", hint: '"celerity,potence"', example: "=celerity,potence",
      desc: "The Disciplines that are its own; a leading = means these and no family's",
    },
  ],
});
CommandRouter.register("forget-template", cmdForgetTemplate, {
  inStory: false,
  summary: "drop a chronicle template (the shipped one, if any, resurfaces)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("define-resource", cmdDefineResource, {
  inStory: false,
  summary: "define a pool or tracker a template can then grant",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>", example: "Living Resolve" },
    { key: "kind", kind: "named", type: "enum", options: ["pool", "tracker"] },
    { key: "start", kind: "named", type: "int", desc: "What it starts at" },
    { key: "max", kind: "named", type: "int", desc: "Its ceiling" },
    { key: "roles", kind: "named", hint: '"a,b"', desc: "Names it also answers to (blood, willpower, magic-fuel...)" },
    { key: "replaces", kind: "named", hint: '"a,b"', desc: "Resources it stands in for, hiding them" },
    { key: "requires", kind: "named", hint: '"vitae"', desc: `What a character must be able to USE (${Object.keys(CAPABILITIES).join(", ")}) to spend it at all` },
    { key: "per-turn", kind: "named", type: "int", desc: "Most that may be spent in one turn" },
    { key: "description", kind: "named", hint: "<text>" },
  ],
});
CommandRouter.register("backgrounds", cmdBackgrounds, {
  summary: "the backgrounds this chronicle defines, what you hold, and what they confer",
});
CommandRouter.register("background", cmdBackground, {
  summary: "one background in full: ceiling, ladder, and what it grants",
  params: [{ key: "name", kind: "positional", hint: "[name]", example: "fount" }],
});
CommandRouter.register("define-background", cmdDefineBackground, {
  inStory: false,
  summary: "define/replace a background (a Talisman that IS a place grants that place's ratings)",
  params: [
    { key: "name", kind: "named", required: true, type: "literal", desc: "Name - BACKTICKS", example: "Talisman" },
    { key: "max", kind: "named", type: "int", desc: "Ceiling (default 5)", example: "5" },
    { key: "templates", kind: "named", hint: '"a,b"', desc: "Who may take it (blank = anyone)" },
    { key: "grants", kind: "named", hint: '"trait:n,trait:n"', desc: "Other traits it confers", example: "cray:5,library:5,sanctum:5" },
    { key: "description", kind: "named", type: "literal", desc: "Description - BACKTICKS" },
  ],
});
CommandRouter.register("forget-background", cmdForgetBackground, {
  inStory: false,
  summary: "remove a custom background (a built-in resurfaces)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("supernatural", cmd => cmdSupernatural(cmd), {
  summary: "the families of power open to this character (disciplines, magic, sorcery, blood-sorcery)",
  params: [{ key: "category", kind: "positional", hint: "[category]", example: "blood-sorcery" }],
});
CommandRouter.register("budget", cmdBudget, {
  summary: "what each purse allows, what is spent, what is left (advisory)",
  params: [{ key: "character", kind: "positional", hint: '"[name|@alias]"' }],
});
CommandRouter.register("grant", cmd => cmdGrant(cmd), {
  summary: "where something came from when it wasn't bought: a template's free dot, or a Storyteller's bonus",
  params: [
    { key: "what", kind: "positional", hint: "<trait|merit|purse>", example: "potence  ·  freebie" },
    { key: "points", kind: "positional", type: "int", hint: "[points]", desc: "Given: this ADDS to that purse" },
    { key: "source", kind: "named", type: "enum", options: Object.keys(GRANT_SOURCES), desc: "Where it came from (default: storyteller)" },
    { key: "note", kind: "named", hint: "<text>", example: "everyone in this chronicle is Suspect" },
  ],
});
CommandRouter.register("forget-grant", cmdUngrant, {
  summary: "drop a grant - the thing goes back to being bought normally",
  params: [{ key: "what", kind: "positional", required: true, hint: "<trait|purse>" }],
});
CommandRouter.register("paid", cmdPaid, {
  summary: "record what a purchase really cost (no expression = the Storyteller granted it)",
  params: [
    { key: "key", kind: "positional", hint: "<trait|merit-key>", example: "mentor" },
    { key: "expr", kind: "positional", hint: "[expr|listed]", example: "0" },
  ],
});
CommandRouter.register("costs", cmdCosts, {
  summary: "what a dot costs from each purse (chronicle rules, Storyteller-applied)",
  params: [{ key: "kind", kind: "positional", hint: "[kind]", example: "discipline" }],
});
CommandRouter.register("fellowships", cmdFellowships, {
  summary: "the mystic fellowships' Foundation & Pillars (bare: list them)",
  params: [{ key: "name", kind: "positional", hint: "[name]", example: "order-of-hermes" }],
});
CommandRouter.register("flush-context", cmdFlushContext, {
  summary: "clean the story now: strip engine notes and hidden blocks (run this if things feel slow)",
});
// Being somewhere IS an affliction: these four only afflict and lift, and every
// affordance they grant lives in the affliction's own card.
CommandRouter.register("enter-sanctum", () => enterPlace("sanctum", true), { summary: "enter your sanctum (applies in-sanctum)" });
CommandRouter.register("exit-sanctum", () => enterPlace("sanctum", false), { summary: "leave your sanctum (lifts in-sanctum)" });
CommandRouter.register("enter-library", () => enterPlace("library", true), { summary: "enter your library (applies in-library)" });
CommandRouter.register("exit-library", () => enterPlace("library", false), { summary: "leave your library (lifts in-library)" });
CommandRouter.register("measure-door", cmdMeasureDoor, {
  summary: "the Talisman ritual: ten minutes measuring a door opens the Library of the Unseen",
});
CommandRouter.register("leave-library", cmdLeaveLibrary, {
  summary: "step back through the measured door",
});
CommandRouter.register("cray", () => cmdCray(), { summary: "the cray's points, status and how it refills" });
CommandRouter.register("harvest", cmdHarvest, {
  summary: "draw Quintessence from the cray ritually (no roll; overdrawing costs the site a dot)",
  params: [
    { key: "points", kind: "positional", type: "int", hint: "[points]", example: "3" },
    { key: "time", kind: "named", desc: "How long the ritual takes (advances the clock)", example: "2h" },
  ],
});
CommandRouter.register("absorb", cmdAbsorb, {
  summary: "tear Quintessence from the cray directly: Wits + Foundation vs 10 - its rating",
  params: [{ key: "foundation", kind: "named", hint: "<trait>", desc: "Foundation trait (default: auto)" }],
});
CommandRouter.register("research", cmdResearch, {
  summary: "search the library: Intelligence + Library (must be in it)",
  params: [
    { key: "topic", kind: "positional", required: true, hint: "<topic>", example: "`the seals of Belial`" },
    { key: "difficulty", kind: "named", type: "int", desc: "How obscure the secret is (default 6)" },
    { key: "tags", kind: "named", hint: '"a,b"', desc: "Roll tags (e.g. hermetic, in the rotunda)" },
  ],
});
CommandRouter.register("story-date", cmdStoryDate, {
  summary: "show the current story date and how long since it began",
});
CommandRouter.register("save-date", cmdSaveDate, {
  summary: "bookmark the current moment (or a given date) under a name",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>" },
    { key: "date", kind: "positional", hint: "[yyyy-mm-dd-hh]", example: "1197-12-25-00" }],
});
CommandRouter.register("forget-date", cmdForgetDate, {
  summary: "delete a saved date bookmark",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("dates", cmdDates, { summary: "list the saved date bookmarks" });
CommandRouter.register("time-between", cmdTimeBetween, {
  summary: "measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh)",
  params: [
    { key: "a", kind: "positional", required: true, hint: "<date>", example: "start" },
    { key: "b", kind: "positional", required: true, hint: "<date>", example: "now" }],
});
CommandRouter.register("scene", cmdScene, {
  summary: "open a named scene at the current story time (one location; turn=<len> sets a Turn's length)",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>" },
    { key: "location", kind: "named", type: "literal", desc: "The scene's single location" },
    { key: "turn", kind: "named", desc: "A Turn's length here (e.g. 3s for combat); omit for freeform", example: "3s" },
    { key: "chapter", kind: "named", type: "literal", desc: "Optional grouping label" }],
});
CommandRouter.register("turn", cmdTurn, {
  summary: "advance the current scene by one turn (moves the clock by its turn length)",
  params: [{ key: "count", kind: "positional", type: "int", hint: "[n]", desc: "How many turns (default 1)" }],
});
CommandRouter.register("end-scene", cmdEndScene, { summary: "close the current scene" });
CommandRouter.register("downtime", cmdDowntime, {
  summary: "close the current scene and gloss the clock forward",
  params: [{ key: "duration", kind: "positional", required: true, hint: "<duration>", example: "3d" }],
});
CommandRouter.register("scenes", cmdScenes, { summary: "list the chronicle's scenes" });
CommandRouter.register("scene-info", cmdSceneInfo, {
  summary: "show a scene in full (defaults to the open one)",
  params: [{ key: "name", kind: "positional", hint: "[name]" }],
});
CommandRouter.register("forget-scene", cmdForgetScene, {
  summary: "delete a scene record",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("hide", cmdHide, {
  summary: "write to the current scene's private plan (mirrored into the Author's Note)",
  note: "the AI does this automatically via <hide op=append|overwrite>...</hide> in its narration",
  params: [
    { key: "text", kind: "named", type: "literal", desc: "The plan text (verbatim)" },
    { key: "op", kind: "named", type: "enum", options: ["append", "overwrite"], desc: "Append (default) or overwrite the plan" }],
});
CommandRouter.register("tables", cmdTables, {
  summary: "list success tables (grouped by category), or lay one out in full",
  params: [{ key: "name", kind: "positional", hint: "<name|sub|sub::name|@alias>" }],
});
CommandRouter.register("define-table", cmdDefineTable, {
  inStory: false,
  summary: "define/replace a success table in its category's general card",
  note: "a missing subcategory prompts a modal to create it",
  params: [
    { key: "name", kind: "named", required: true, hint: '"[sub::]name"', desc: "Name (optionally sub::name)", example: "e.g. combat::quick-kill" },
    { key: "rows", kind: "named", type: "literal", hint: "`1:Cowed, 3:Terrified[=2]`", desc: "Ladder rows: <successes>:<label>[=<value>], separated by ; (or , when no label needs one)", example: "e.g. 1:Cowed, 3:Terrified" },
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
  inStory: false,
  summary: "remove a table from its category's general card; built-ins can only be shadowed",
  params: [{ key: "name", kind: "positional", required: true, hint: "<[sub::]name|@alias>" }],
});
CommandRouter.register("define-table-category", cmdDefineTableCategory, {
  inStory: false,
  summary: "create a table subcategory (a real lorebook category with its general card)",
  params: [{ key: "name", kind: "named", required: true, desc: "Category name (single segment)", example: "e.g. combat" }],
});
CommandRouter.register("table-alias", cmdTableAlias, {
  inStory: false,
  summary: "define a table alias, or list them (no args); table=@alias resolves it",
  params: [
    { key: "token", kind: "positional", hint: "<@alias>" },
    { key: "target", kind: "positional", hint: '"<[sub::]name>"' },
  ],
});
CommandRouter.register("forget-table-alias", cmdForgetTableAlias, {
  inStory: false,
  summary: "remove a table alias",
  params: [{ key: "token", kind: "positional", required: true, hint: "<@alias>" }],
});
CommandRouter.register("define-constraint", cmdDefineConstraint, {
  inStory: false,
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
  inStory: false,
  summary: "remove a constraint group",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("check-constraints", () => cmdCheckConstraints(), { summary: "flag the current character's constraint conflicts (incl. merit-instance caps)" });
CommandRouter.register("take-merit", cmdTakeMerit, {
  summary: "take a merit/flaw; parameterized defs take name::param instances",
  note: "Merits and Flaws only. Arcana and Taints are a different category - [[take-arcanum]]",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name[::param]>" },
    { key: "points", kind: "positional", hint: "[points]" },
    { key: "paid", kind: "named", desc: "What it REALLY cost (0 = the Storyteller granted it)" },
    { key: "waive", kind: "named", type: "bool", desc: "Waive unmet prerequisites" },
  ],
});
CommandRouter.register("drop-merit", cmdDropMerit, {
  summary: "drop an owned merit/flaw instance",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name[::param]>" }],
});
CommandRouter.register("merits", () => cmdMerits(), {
  summary: "list owned merits/flaws, enhancement totals and advisory issues",
  note: "Never lists Arcana - they are not merits. [[show-arcanum]] is their list",
});
// A verb that writes a DEFINITION CARD is the player editing the chronicle's
// rulebook, not a beat of the story: `inStory: false` keeps every "Defined
// merit X" out of the AI's context, where it was pure noise. Sheet edits
// ([[set-trait]], [[take-merit]], [[specialty]], [[grant]]) are NOT in this set
// - those are things that happen to a character, and the Storyteller should see
// them. `in-story` still overrides either way, per call.
CommandRouter.register("define-merit", cmdDefineMerit, {
  inStory: false,
  summary: "define a merit or flaw (writes the srd:merits-flaws overlay)",
  note: "kind= takes merit or flaw ONLY - an arcanum is not a merit; use [[define-arcanum]]",
  params: [
    { key: "name", kind: "named", required: true, type: "literal", hint: "`<name>`", example: "e.g. `Inviolate Soul`" },
    { key: "kind", kind: "named", type: "enum", options: ["merit", "flaw"], desc: "Merits cost freebies, flaws grant them (default merit)" },
    { key: "points", kind: "named", hint: "<n|1,2,3>", desc: "Cost, or the ladder of allowed ratings (default 0)" },
    { key: "passive", kind: "named", type: "literal", hint: "`<op>[:<target>] [+N] [if=] [while=]`", desc: 'Always-on ops, ";"-separated (or a raw JSON array) - BACKTICKS' },
    { key: "param", kind: "named", desc: "Instance-parameter slot (owned as name::value)" },
    { key: "templates", kind: "named", hint: '"a,b"', desc: "Templates that may take it" },
    { key: "budget", kind: "named", desc: "Which purse it trades in (default: freebie)", example: "freebie" },
    { key: "per-template", kind: "named", hint: '"vampire:3,ghoul:1"', desc: "Price per template; `no` closes it to one", example: "vampire:3,ghoul:1" },
    { key: "limit-at", kind: "named", type: "int", desc: "The rating that is rationed across instances", example: "3" },
    { key: "limit-slots", kind: "named", type: "int", desc: "How many instances may hold that rating (default 1)", example: "2" },
    { key: "limit-per-kind", kind: "named", desc: "And at most this many of a trait kind", example: "attribute:1" },
    { key: "max-from-trait", kind: "named", desc: "Rating ceiling is this trait (\"no more purchases than his Resolve\")", example: "resolve" },
    { key: "param-from", kind: "named", type: "enum", options: [...ALL_TRAIT_CATEGORIES],
      desc: "The param must be a trait of this category (\"pick a Knowledge\")", example: "knowledge" },
    { key: "grants", kind: "named", desc: "Affliction this applies when taken (defined for you if new)", example: "iron-willed" },
    { key: "grants-mode", kind: "named", type: "enum", options: ["automatic", "offered"],
      desc: "automatic = on as soon as it is taken; offered = it grants the ABILITY, [[invoke]] uses it" },
    { key: "grants-togglable", kind: "named", type: "bool", desc: "The character may switch it off without losing the power" },
    { key: "grants-orphan", kind: "named", desc: "What happens to the affliction when the power is lost (default: immediately)", example: "immediately" },
    { key: "description", kind: "named", type: "literal", hint: "`<text>`", desc: "Rules text" },
  ],
});
CommandRouter.register("merit", cmdMeritInfo, {
  summary: "inspect a merit/flaw definition (bare: list them)",
  params: [{ key: "name", kind: "positional", hint: "[name]", example: "inviolate-soul" }],
});
CommandRouter.register("forget-merit", cmdForgetMerit, {
  inStory: false,
  summary: "delete a custom merit/flaw definition (built-ins resurface)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});

// --- ARCANA & TAINTS - a category of their own, not a flavour of merit -------
// Dark Ages: Devil's Due. These verbs are the merit verbs' equals, not their
// wrappers: their own registry, their own lorebook category, their own bucket
// on the sheet, and a list that opens only for a character bound to the
// infernal. A vampire who types [[show-merit]] sees no Arcana, because he has none.
CommandRouter.register("arcana", cmd => cmdArcana(cmd), {
  summary: "the Arcana & Taints this character owns (bare), or one in detail",
  note: "They trade in the ARCANA purse, never freebies, and only a demon or a demon's thrall has this list at all",
  params: [{ key: "name", kind: "positional", hint: "[name]", example: "celestial-radiance" }],
});
CommandRouter.register("arcanum", cmdArcanumInfo, {
  summary: "inspect an arcanum/taint definition (bare: list them)",
  params: [{ key: "name", kind: "positional", hint: "[name]", example: "celestial-radiance" }],
});
CommandRouter.register("define-arcanum", cmdDefineArcanum, {
  inStory: false,
  summary: "define an arcanum or taint (writes the srd:arcana overlay)",
  note: "per-template= gives it a price per splat; kind=taint makes it GRANT points. NOT [[define-merit]] - a different list",
  params: [
    { key: "name", kind: "named", required: true, type: "literal", desc: "Name - BACKTICKS" },
    { key: "kind", kind: "named", type: "enum", options: ["arcanum", "taint"], desc: "Default arcanum" },
    { key: "points", kind: "named", hint: "<n|1,2,3>", desc: "Cost, or the ladder of allowed ratings" },
    { key: "per-template", kind: "named", hint: '"demon:7,thrall:5"', desc: "Price per template; `no` closes it to one" },
    { key: "param", kind: "named", desc: "Instance-parameter slot (owned as name::value)" },
    { key: "templates", kind: "named", hint: '"a,b"', desc: "Templates that may take it" },
    { key: "budget", kind: "named", desc: "Which purse it trades in (default: arcana)", example: "arcana" },
    { key: "limit-at", kind: "named", type: "int", desc: "The rating that is rationed across instances", example: "3" },
    { key: "limit-slots", kind: "named", type: "int", desc: "How many instances may hold that rating (default 1)", example: "2" },
    { key: "limit-per-kind", kind: "named", desc: "And at most this many of a trait kind", example: "attribute:1" },
    { key: "max-from-trait", kind: "named", desc: "Rating ceiling is this trait", example: "resolve" },
    { key: "passive", kind: "named", type: "literal", desc: 'Always-on ops, ";"-separated - BACKTICKS' },
    { key: "param-from", kind: "named", type: "enum", options: [...ALL_TRAIT_CATEGORIES],
      desc: "The param must be a trait of this category (\"pick a Knowledge\")", example: "knowledge" },
    { key: "grants", kind: "named", desc: "Affliction this applies when taken (defined for you if new)", example: "iron-willed" },
    { key: "grants-mode", kind: "named", type: "enum", options: ["automatic", "offered"],
      desc: "automatic = on as soon as it is taken; offered = it grants the ABILITY, [[invoke]] uses it" },
    { key: "grants-togglable", kind: "named", type: "bool", desc: "The character may switch it off without losing the power" },
    { key: "grants-orphan", kind: "named", desc: "What happens to the affliction when the power is lost (default: immediately)", example: "immediately" },
    { key: "description", kind: "named", type: "literal", desc: "Description - BACKTICKS" },
  ],
});
CommandRouter.register("take-arcanum", cmdTakeArcanum, {
  summary: "take an arcanum or taint (needs the arcana capability - [[attune]])",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name[::param]>" },
    { key: "points", kind: "positional", hint: "[points]" },
    { key: "paid", kind: "named", desc: "What it REALLY cost (0 = the Storyteller granted it)" },
    { key: "waive", kind: "named", type: "bool", desc: "Waive prerequisites / template limits / the capability gate" },
  ],
});
CommandRouter.register("drop-arcanum", cmdDropArcanum, {
  summary: "drop an owned arcanum or taint (its passives lift with it)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name[::param]>" }],
});
CommandRouter.register("forget-arcanum", cmdForgetArcanum, {
  inStory: false,
  summary: "remove a custom arcanum/taint definition (a built-in resurfaces)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
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
CommandRouter.register("specialties", () => cmdSpecialties(), {
  summary: "list the current character's specialties",
});
CommandRouter.register("define-affliction", cmdDefineAffliction, {
  inStory: false,
  summary: "define/replace an affliction (overlay; may shadow a built-in)",
  params: [
    { key: "name", kind: "named", required: true, desc: "Name", example: "e.g. dazed" },
    { key: "bindings", kind: "named", hint: '"target"', desc: "Required slots (comma-separated)", example: "e.g. target" },
    { key: "duration", kind: "named", hint: '"1 turn|until x|instant"', desc: "Advisory duration" },
    { key: "then", kind: "named", desc: "Successor affliction ([[advance]] applies it)" },
    { key: "mirror", kind: "named", desc: "Affliction the bound target gains, bound back" },
    { key: "apply", kind: "named", type: "literal",
      hint: "`<op>[:<tag>] [+N|-N] [if=<trait|category>]`", example: "difficulty -2 if=drive on=reckless",
      desc: 'What it DOES while it is on - the same shorthand a merit passive uses; "$slot" reads a binding' },
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
  inStory: false,
  summary: "remove an overlay definition; built-ins can only be shadowed",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
// Every way an affliction can end, on one verb. They compose: whichever
// measure runs out first ends it.
const EXPIRY_PARAMS: ParamSpec[] = [
  { key: "rolls", kind: "named", type: "int", desc: "Ends after this many MATCHING rolls" },
  { key: "with-tags", kind: "named", hint: '"a,b"', desc: "Only rolls carrying all of these count" },
  { key: "without-tags", kind: "named", hint: '"a,b"', desc: "Rolls carrying any of these do not count" },
  { key: "using", kind: "named", hint: '"melee"', desc: "Only rolls whose pool uses one of these count" },
  { key: "not-using", kind: "named", hint: '"wits"', desc: "Rolls whose pool uses any of these do not count" },
  { key: "turns", kind: "named", type: "int", desc: "Ends after this many turns ([[turn]] counts them)" },
  { key: "scenes", kind: "named", type: "int", desc: "Ends after this many scenes ([[end-scene]] counts them)" },
  { key: "for", kind: "named", hint: "<duration>", example: "1 hour", desc: "Ends after this much story time" },
  {
    key: "until", kind: "named", hint: "<condition>", example: "full-moons >= 1",
    desc: "Ends when this becomes true: full-moons, elapsed-days, elapsed-hours and any trait, with > < >= <= = != and and/or/not",
  },
  { key: "until-event", kind: "named", hint: "<text>", example: "you next attend the voivode", desc: "ADVISORY: nothing ends it but [[lift]]" },
  { key: "from", kind: "named", hint: "<source>", example: "arcanum:sharpened-senses", desc: "What inflicted it - an arcanum, a spell, a Discipline, a botch" },
  // A cooldown is the same six measures asking "when may this happen again",
  // so it is the same argument names behind one prefix.
  { key: "cooldown-for", kind: "named", hint: "<duration>", example: "1 day", desc: "After it ends, this long before it may be taken again" },
  { key: "cooldown-rolls", kind: "named", type: "int" },
  { key: "cooldown-turns", kind: "named", type: "int" },
  { key: "cooldown-scenes", kind: "named", type: "int" },
  { key: "cooldown-until", kind: "named", hint: "<condition>", example: "full-moons >= 1" },
  { key: "waive", kind: "named", type: "bool", desc: "Apply it even while cooling" },
  {
    key: "orphan", kind: "named", hint: "immediately | keep | <expression>", example: "immediately",
    desc: "What happens if its source goes: end at once, carry on unchanged, or an expression over what is left (remaining-seconds, remaining-rolls)",
  },
];
CommandRouter.register("afflict", cmdAfflict, {
  summary: "apply an affliction; extra <slot>=<name|@alias> args fill its bindings",
  note: "mirror defs also afflict the bound target",
  openNamed: true,
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>", desc: "Who (default: the current character)" },
    { key: "level", kind: "named", type: "int", example: "2",
      desc: "How MANY steps - its ops scale by this (the 1/2/3 ladder every rated merit is written on)" },
    ...EXPIRY_PARAMS,
  ],
});
CommandRouter.register("toggle", cmdToggle, {
  summary: "switch a togglable passive off, or back on (the power is not lost either way)",
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>", desc: "Who (default: the current character)" },
  ],
});
CommandRouter.register("invoke", cmdInvoke, {
  summary: "use a power that OFFERS an affliction rather than applying it automatically",
  params: [{ key: "affliction", kind: "positional", required: true, hint: "<affliction>" }],
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
    { key: "spend", kind: "named", hint: SPEND_HINT, example: SPEND_EXAMPLE },
    { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1)" },
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
    { key: "default", kind: "named", type: "bool", desc: "Also make it the default player" },
  ],
});

// =============================================================================
// SHOW - one way to look at anything, and none of it reaches the AI
// -----------------------------------------------------------------------------
// Roughly forty verbs only REPORT. They arrived one at a time, so they were
// named inconsistently (`merits` vs `merit`, `scenes` vs `scene-info`, `arcana`
// vs `arcanum`, `list-rolls` vs `roll-info`) and the singular/plural split was
// really a SCOPE distinction nobody had declared: `merit` meant "what the
// chronicle defines", `merits` meant "what this character owns". Two names for
// one question asked of two places.
//
// So: every read-only verb is `show-<thing>`, takes a NAME (`@all` = the whole
// list) and a SCOPE (`in=<where to look>`), and its reply is stripped from the
// AI's context unless the player says `in-story=true`.
//
// THE NAME IS THE POLICY. A verb is hidden from context because it is called
// `show-`, not because somebody remembered to add it to a list - the old
// QUIET_VERBS set was a hand-maintained register that a new verb was trivially
// forgotten from. What remains in that set is only the read-only verbs that are
// not listings at all (maintenance).
// =============================================================================

// Where to look. Seven kinds, because a chronicle has seven kinds of place a
// question can be asked of - and the last three are NOT reducible to a template:
// the code deliberately holds clans and fellowships apart from templates (they
// are CHOICES a character made, and exclusive merits gate on them), a scene is
// a record with its own clock, and a player is who is holding the dice.
export type ShowScopeKind =
  | "campaign"      // what the chronicle DEFINES
  | "current"       // the character being played
  | "character"     // a named character's sheet
  | "template"      // what that kind of creature may have
  | "clan"          // ...or that clan / bloodline
  | "fellowship"    // ...or that mystic fellowship
  | "scene"         // a scene's own records
  | "player";       // a player's pointers and aliases

export interface ResolvedScope {
  kind: ShowScopeKind;
  key?: string;                 // the normalized name, for every kind but campaign
  char?: PlayableCharacter;     // loaded for `current` and `character`
  label: string;                // how a reply should name it
}

// The words that mean "the chronicle itself" and "whoever I am playing". Both
// spelled several ways on purpose: a player types what they think of first.
const SCOPE_CAMPAIGN = ["campaign", "chronicle", "story", "world", "game"];
const SCOPE_CURRENT = ["current", "me", "self", "mine", "here"];
// An explicit `kind::name` disambiguates when a name means two things. `::`
// folds to `:` at the boundary (docs/invariants.md §2), so both spellings work.
const SCOPE_PREFIXES: Record<string, ShowScopeKind> = {
  character: "character", char: "character", pc: "character",
  template: "template", splat: "template",
  clan: "clan", bloodline: "clan",
  fellowship: "fellowship",
  scene: "scene",
  player: "player",
  campaign: "campaign", chronicle: "campaign",
};

// The order a bare name is tried in. Characters first because a player names
// their own characters and types those names most; a collision is REPORTED
// rather than guessed at, so being wrong here is never silent.
const SCOPE_SEARCH: ShowScopeKind[] = ["character", "template", "clan", "fellowship", "scene", "player"];

async function scopeKindsMatching(key: string): Promise<ShowScopeKind[]> {
  const hits: ShowScopeKind[] = [];
  if ((await CharacterStore.listNames()).includes(key)) hits.push("character");
  if (TEMPLATES[key] || TemplateRegistry.get(key)) hits.push("template");
  if (CLANS[key] || clanFamilies().some(c => c.id === key)) hits.push("clan");
  if (FELLOWSHIPS[key]) hits.push("fellowship");
  if ((await SceneStore.names()).includes(key)) hits.push("scene");
  if (key === PlayerStore.STORYTELLER || (await PlayerStore.known()).includes(key)) hits.push("player");
  return SCOPE_SEARCH.filter(k => hits.includes(k));
}

// `in=<raw>` -> where to look, or a refusal that says what would have worked.
// `allowed` is the subject's own vocabulary: health belongs to a character, and
// "health in the campaign" is a question worth answering with a correction
// rather than an empty list.
export async function resolveShowScope(
  raw: string | undefined, allowed: ShowScopeKind[], fallback: ShowScopeKind,
): Promise<ResolvedScope | { error: string }> {
  const asked = StringUtil.normalize(raw ?? "").replace(/::+/g, ":");
  const wants = (kind: ShowScopeKind): string | undefined =>
    allowed.includes(kind) ? undefined
      : `That is a ${kind}, and this one is only asked of ${allowed.join(" / ")}.`;

  // Nothing said: the subject's own default.
  if (!asked) return finishScope(fallback, undefined, allowed);

  // An explicit kind::name is never guessed at.
  const colon = asked.indexOf(":");
  if (colon > 0) {
    const kind = SCOPE_PREFIXES[asked.slice(0, colon)];
    const key = asked.slice(colon + 1);
    if (!kind) {
      return { error: `"${asked.slice(0, colon)}" is not a scope. Try ${Object.keys(SCOPE_PREFIXES).join(", ")}, `
        + `or a bare name and the engine works out which it is.` };
    }
    const no = wants(kind);
    if (no) return { error: no };
    return finishScope(kind, key, allowed);
  }

  if (SCOPE_CAMPAIGN.includes(asked)) {
    return wants("campaign") ? { error: wants("campaign")! } : finishScope("campaign", undefined, allowed);
  }
  if (SCOPE_CURRENT.includes(asked)) {
    return wants("current") ? { error: wants("current")! } : finishScope("current", undefined, allowed);
  }

  // A bare name: ask every place that could hold it. Two answers is a real
  // ambiguity - name both explicit forms rather than picking one silently.
  const hits = await scopeKindsMatching(asked);
  const usable = hits.filter(k => allowed.includes(k));
  if (usable.length > 1) {
    return { error: `"${asked}" is a ${hits.join(" AND a ")}. Say which: `
      + usable.map(k => `in=${k}::${asked}`).join(" or ") + "." };
  }
  if (usable.length === 1) return finishScope(usable[0], asked, allowed);
  if (hits.length) {
    return { error: `"${asked}" is a ${hits.join("/")}, and this one is only asked of ${allowed.join(" / ")}.` };
  }
  return { error: `Nothing named "${asked}" - not a character, template, clan, fellowship, scene or player. `
    + `[[show-character @all]] and [[show-template @all]] list two of those.` };
}

// Load what the kind needs and give it a label. Split out so every path above
// returns the same shape.
async function finishScope(
  kind: ShowScopeKind, key: string | undefined, allowed: ShowScopeKind[],
): Promise<ResolvedScope | { error: string }> {
  if (!allowed.includes(kind)) {
    return { error: `This one is only asked of ${allowed.join(" / ")}.` };
  }
  if (kind === "campaign") return { kind, label: "the chronicle" };
  if (kind === "current") {
    const char = await CharacterStore.getCurrent();
    if (!char) return { error: `No current character. [[play name="..."]] picks one, or name a scope with in=.` };
    return { kind, key: StringUtil.normalize(char.name), char, label: disp(char.name) };
  }
  if (kind === "character") {
    const ref = await resolveCharacterRef(key ?? "");
    if (ref.error) return { error: ref.error };
    const char = await CharacterStore.load(ref.name!);
    if (!char) return { error: `No character named "${ref.name}". [[show-character @all]] lists them.` };
    return { kind, key: StringUtil.normalize(char.name), char, label: disp(char.name) };
  }
  return { kind, key: key ?? "", label: `${StringUtil.toTitleCase(key ?? "")} (${kind})` };
}

// --- THE SUBJECTS ------------------------------------------------------------
// One entry per thing a player can look at. `render` mostly DELEGATES to the
// handler that already exists - this pass renames and re-scopes the surface, it
// does not rewrite thirty reports.
type ShowRender = (name: string | undefined, scope: ResolvedScope, cmd: ParsedCommand) => Promise<string>;

interface ShowSubject {
  verb: string;                       // "show-merit"
  summary: string;
  note?: string;
  nameHint?: string;                  // what a name means here (help/window)
  nameExample?: string;
  /** Old verbs that meant this, each with the scope it meant. */
  replaces?: Array<{ verb: string; scope?: ShowScopeKind }>;
  scopes: ShowScopeKind[];
  defaultScope: ShowScopeKind;
  extra?: ParamSpec[];                // knobs the old verb had that still apply
  render: ShowRender;
}

// `@all` is the wildcard, and `@` is the alias sigil - state.ts reserves the
// token so the two can never collide.
function isShowAll(name: string | undefined): boolean {
  return name !== undefined && StringUtil.normalize(name) === "all";
}
// The name a subject was asked for: undefined when absent or `@all`.
function showName(cmd: ParsedCommand): { name?: string; all: boolean } {
  const raw = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!raw) return { all: false };
  if (raw === SHOW_ALL_TOKEN || isShowAll(raw.replace(/^@/, ""))) return { all: true };
  return { name: raw, all: false };
}
// A synthetic command for a delegate that reads positionals/named of its own.
function asCmd(name: string | undefined, cmd: ParsedCommand, named: Record<string, string> = {}): ParsedCommand {
  return {
    ...cmd,
    positional: name === undefined ? [] : [name],
    named: { ...cmd.named, ...named },
  };
}
// The character a character-scoped subject reports on.
function scopeChar(scope: ResolvedScope): PlayableCharacter | undefined { return scope.char; }
// "this subject has nothing to say about that scope" - said once, the same way.
function notForScope(scope: ResolvedScope, what: string): string {
  return sys(`${what} is not something ${scope.label} has. Try in=campaign or in=current.`);
}

// The scopes a sheet-bound subject understands: the character being played, or
// any other by name. Written once because a dozen subjects want exactly this.
const ON_A_SHEET: ShowScopeKind[] = ["current", "character"];
// ...and what the chronicle defines, which a template/clan/fellowship narrows.
const IN_THE_BOOKS: ShowScopeKind[] = ["campaign", "template", "clan", "fellowship", "current", "character"];

const SHOW_SUBJECTS: ShowSubject[] = [
  // --- THE CHRONICLE'S OWN VOCABULARY ---------------------------------------
  {
    verb: "show-character", summary: "the chronicle's playable characters (marks current/default)",
    replaces: [{ verb: "characters" }], scopes: ["campaign"], defaultScope: "campaign",
    render: async () => cmdCharacters(),
  },
  {
    verb: "show-template", summary: "the templates this chronicle knows, and what each is made of",
    replaces: [{ verb: "templates" }], scopes: ["campaign", "template", "current", "character"],
    defaultScope: "campaign", nameExample: "vampire",
    render: async (name, scope, cmd) =>
      cmdTemplates(asCmd(name ?? (scope.kind === "template" ? scope.key : scope.char?.templates[0]), cmd)),
  },
  {
    verb: "show-clan", summary: "the clans and their Disciplines",
    replaces: [{ verb: "clans" }, { verb: "clan" }], scopes: ["campaign", "clan", "current", "character"],
    defaultScope: "campaign", nameExample: "nosferatu",
    render: async (name, scope, cmd) =>
      cmdClans(asCmd(name ?? (scope.kind === "clan" ? scope.key : scope.char?.choices?.["clan"]), cmd)),
  },
  {
    verb: "show-fellowship", summary: "the mystic fellowships' Foundation & Pillars",
    replaces: [{ verb: "fellowships" }], scopes: ["campaign", "fellowship", "current", "character"],
    defaultScope: "campaign", nameExample: "valdaermen",
    render: async (name, scope, cmd) =>
      cmdFellowships(asCmd(name ?? (scope.kind === "fellowship" ? scope.key : scope.char?.choices?.["fellowship"]), cmd)),
  },
  {
    verb: "show-cost", summary: "what a dot costs from each purse (chronicle rules, Storyteller-applied)",
    replaces: [{ verb: "costs" }], scopes: ["campaign"], defaultScope: "campaign",
    render: async (name, _scope, cmd) => cmdCosts(asCmd(name, cmd)),
  },
  {
    verb: "show-table", summary: "success tables, grouped by category, or one laid out in full",
    replaces: [{ verb: "tables" }], scopes: ["campaign"], defaultScope: "campaign",
    extra: [{ key: "category", kind: "named", desc: "Only this table category" }],
    render: async (name, _scope, cmd) => cmdTables(asCmd(name, cmd)),
  },
  {
    verb: "show-roll", summary: "the chronicle's saved rolls, or one in full",
    replaces: [{ verb: "list-rolls" }, { verb: "roll-info" }], scopes: ["campaign"], defaultScope: "campaign",
    nameExample: "sword-strike",
    render: async (name, _scope, cmd) => (name ? cmdRollInfo(asCmd(name, cmd)) : cmdListRolls()),
  },
  {
    verb: "show-scene", summary: "the chronicle's scenes, or one in full (defaults to the open one)",
    replaces: [{ verb: "scenes" }, { verb: "scene-info", scope: "scene" }],
    scopes: ["campaign", "scene"], defaultScope: "campaign",
    render: async (name, scope, cmd) => {
      const which = name ?? (scope.kind === "scene" ? scope.key : undefined);
      // Bare + campaign means the list; anything that names one means that one.
      return which || scope.kind === "scene" ? cmdSceneInfo(asCmd(which, cmd)) : cmdScenes();
    },
  },
  {
    verb: "show-date", summary: "the story date, and the bookmarks the chronicle keeps",
    replaces: [{ verb: "dates" }, { verb: "story-date" }], scopes: ["campaign"], defaultScope: "campaign",
    // Bare: where we are, and every bookmark. Named: how far that one is from now.
    render: async (name, _scope, cmd) => (name
      ? cmdTimeBetween({ ...cmd, positional: [name, "now"] })
      : sysNote(await cmdStoryDate(), stripSys(await cmdDates()))),
  },
  {
    verb: "show-time-between", summary: "measure the span between two dates (saved name, now, start, or yyyy-mm-dd-hh)",
    replaces: [{ verb: "time-between" }], scopes: ["campaign"], defaultScope: "campaign",
    extra: [
      { key: "from", kind: "positional", hint: "<date|name>", example: "story-start" },
      { key: "to", kind: "positional", hint: "[date|name]", example: "now" },
    ],
    render: async (_name, _scope, cmd) => cmdTimeBetween(cmd),
  },
  {
    verb: "show-alias", summary: "every alias, grouped by scope",
    replaces: [{ verb: "aliases" }], scopes: ["campaign", "player", "character", "current"],
    defaultScope: "campaign",
    render: async () => cmdAliases(),
  },
  {
    verb: "show-player", summary: "the current player (the storyteller, unless somebody took a seat)",
    scopes: ["campaign", "player"], defaultScope: "campaign",
    render: async (_name, _scope, cmd) => cmdPlayer({ ...cmd, positional: [], named: {} }),
  },
  {
    verb: "show-constraint", summary: "the story's constraint groups, and what the character breaks",
    replaces: [{ verb: "constraints" }, { verb: "constraint" }, { verb: "check-constraints", scope: "current" }],
    scopes: IN_THE_BOOKS, defaultScope: "campaign", nameExample: "clan-only-backgrounds",
    render: async (name, scope, cmd) => {
      if (name) return cmdConstraint(asCmd(name, cmd));
      // Asked of a CHARACTER, the question is "what do I break", which is the
      // report [[show-constraint]] used to be.
      return scopeChar(scope) ? cmdCheckConstraints(scopeChar(scope)) : cmdConstraints();
    },
  },

  // --- WHAT A CHARACTER HAS -------------------------------------------------
  {
    verb: "show-sheet", summary: "a character's record as the engine reads it (effective values marked)",
    replaces: [{ verb: "sheet" }], scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdSheet(asCmd(scope.key, cmd)),
  },
  {
    verb: "show-merit", summary: "merits & flaws: what a character owns, or what the chronicle defines",
    note: "in=campaign lists the definitions; a name shows one in full. NEVER lists Arcana - [[show-arcanum]] is their list",
    replaces: [{ verb: "merits", scope: "current" }, { verb: "merit", scope: "campaign" }],
    scopes: IN_THE_BOOKS, defaultScope: "current", nameExample: "iron-will",
    // A NAME shows one; a SHEET scope shows what that character owns; anything
    // else (campaign, template, clan, fellowship) shows what is open there.
    render: async (name, scope, cmd) =>
      name ? cmdMeritInfo(asCmd(name, cmd))
        : scopeChar(scope) ? cmdMerits(scopeChar(scope))
          : scopedPowerDefs(MERIT_FAMILY, scope),
  },
  {
    verb: "show-arcanum", summary: "arcana & taints: what a character owns, or what the chronicle defines",
    note: "Their own category - not merits, and only a demon or a demon's thrall has this list at all",
    replaces: [{ verb: "arcana", scope: "current" }, { verb: "arcanum", scope: "campaign" }],
    scopes: IN_THE_BOOKS, defaultScope: "current", nameExample: "celestial-radiance",
    render: async (name, scope, cmd) =>
      name ? cmdArcanumInfo(asCmd(name, cmd))
        : scopeChar(scope) ? cmdArcana(asCmd(undefined, cmd), scopeChar(scope))
          : scopedPowerDefs(ARCANUM_FAMILY, scope),
  },
  {
    verb: "show-background", summary: "backgrounds: what a character holds and confers, or what the chronicle defines",
    replaces: [{ verb: "backgrounds", scope: "current" }, { verb: "background", scope: "campaign" }],
    scopes: IN_THE_BOOKS, defaultScope: "current", nameExample: "fount",
    render: async (name, scope, cmd) =>
      name ? cmdBackground(asCmd(name, cmd))
        : scopeChar(scope) ? cmdBackgrounds() : scopedBackgroundDefs(scope),
  },
  {
    verb: "show-affliction", summary: "afflictions on a character, or the ones the chronicle defines",
    replaces: [{ verb: "afflictions", scope: "current" }, { verb: "affliction", scope: "campaign" }],
    scopes: ["campaign", "current", "character", "scene"], defaultScope: "current",
    nameExample: "in-sanctum",
    render: async (name, scope, cmd) =>
      name ? cmdAfflictionInfo(asCmd(name, cmd))
        : scope.kind === "campaign" ? cmdAfflictionInfo(asCmd(undefined, cmd))
          : cmdAfflictions(asCmd(scope.key, cmd)),
  },
  {
    verb: "show-specialty", summary: "a character's specialties (one applies per roll, via specialty=)",
    replaces: [{ verb: "specialties" }], scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope) => cmdSpecialties(scopeChar(scope)),
  },
  {
    verb: "show-resource", summary: "a character's live pools and trackers (and what they cannot use)",
    replaces: [{ verb: "resources" }], scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope) => cmdResources(scopeChar(scope)),
  },
  {
    verb: "show-capability", summary: "what a character can USE (a pool he cannot use is only points)",
    scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdAttune({ ...cmd, positional: [], named: {} }, scopeChar(scope)),
  },
  {
    verb: "show-health", summary: "a character's health track, penalty and what soaks what",
    replaces: [{ verb: "health" }], scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope) => cmdHealth(scopeChar(scope)),
  },
  {
    verb: "show-budget", summary: "what each purse allows, what is spent, what is left (advisory)",
    replaces: [{ verb: "budget" }], scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdBudget(asCmd(scope.key, cmd)),
  },
  {
    verb: "show-grant", summary: "what a purchase really cost and where it came from",
    scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdGrant({ ...cmd, positional: [], named: {} }, scopeChar(scope)),
  },
  {
    verb: "show-creation", summary: "the creation budget: every pool against what the sheet holds (advisory)",
    replaces: [{ verb: "creation" }], scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdCreation(asCmd(scope.key, cmd)),
  },
  {
    verb: "show-derived", summary: "what the sheet implies rather than states: Road, Willpower, generation, and why",
    replaces: [{ verb: "derived" }], scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope, cmd) => cmdDerived(asCmd(scope.key, cmd)),
  },
  {
    verb: "show-supernatural", summary: "the families of power open to a character (disciplines, magic, sorcery, blood-sorcery)",
    replaces: [{ verb: "supernatural" }], scopes: ON_A_SHEET, defaultScope: "current",
    nameExample: "disciplines",
    render: async (name, scope, cmd) => cmdSupernatural(asCmd(name, cmd), scopeChar(scope)),
  },
  {
    verb: "show-cray", summary: "the cray's points, status and how it refills",
    replaces: [{ verb: "cray" }], scopes: ON_A_SHEET, defaultScope: "current",
    render: async (_name, scope) => cmdCray(scopeChar(scope)),
  },
  {
    verb: "show-eval", summary: "read an expression against a character (the reference system, exposed)",
    replaces: [{ verb: "eval" }], scopes: ON_A_SHEET, defaultScope: "current",
    nameHint: "<expression>", nameExample: "`courage + 2`",
    render: async (_name, scope, cmd) => cmdEval(cmd, scopeChar(scope)),
  },
  // These two take an ID, not a character: the NAME is the extended action or
  // contest to look at, and bare means "the one that is running". (Passing the
  // scope's character here read the character name as an id and found nothing.)
  {
    verb: "show-roll-status", summary: "an extended action's progress (bare: the one that is running)",
    replaces: [{ verb: "roll-status" }], scopes: ON_A_SHEET, defaultScope: "current",
    nameHint: "[id]",
    render: async (name, _scope, cmd) => cmdRollStatus(asCmd(name, cmd)),
  },
  {
    verb: "show-contest-status", summary: "an extended contest's progress (bare: the one that is running)",
    replaces: [{ verb: "contest-status" }], scopes: ON_A_SHEET, defaultScope: "current",
    nameHint: "[id]",
    render: async (name, _scope, cmd) => cmdContestStatus(asCmd(name, cmd)),
  },
];

// --- ASKING A LIST OF A PLACE ------------------------------------------------
// The point of a scope on a DEFINITION list: "what may a Nosferatu take" was
// unaskable before, because clan-exclusive merits gate on a CHOICE and nothing
// filtered by one. `in=clan::nosferatu` now means it.
//
// The rule is the same one [[take-merit]] enforces at the door: a definition is
// open to a place if the place meets its `requires` and its per-template price
// admits it. Advisory, like everything creation-side - this REPORTS what is
// open, it does not stop anyone.
function scopeTemplates(scope: ResolvedScope): string[] {
  if (scope.kind === "template") return [scope.key!];
  return scope.char?.templates ?? [];
}
function scopeChoices(scope: ResolvedScope): Record<string, string> {
  if (scope.kind === "clan") return { clan: scope.key! };
  if (scope.kind === "fellowship") return { fellowship: scope.key! };
  return scope.char?.choices ?? {};
}
// Does this definition's `requires` admit the place? Only the parts the place
// can answer are checked - a clan scope knows nothing about tags, and refusing
// on what it cannot know would hide everything.
function openToScope(def: OwnedPowerDef, scope: ResolvedScope): boolean {
  if (scope.kind === "campaign") return true;
  const templates = scopeTemplates(scope);
  const choices = scopeChoices(scope);
  const req = def.requires;
  if (req?.templates?.length && templates.length
    && !req.templates.some(t => templates.includes(StringUtil.normalize(t)))) return false;
  for (const [what, want] of Object.entries(req?.choices ?? {})) {
    const key = StringUtil.normalize(what);
    const has = StringUtil.normalize(choices[key] ?? "");
    if (!has) return false;                      // gated on a choice this place has not made
    const asked = StringUtil.normalize(want);
    const met = key === "clan" ? clanFamilyOf(has) === clanFamilyOf(asked) : has === asked;
    if (!met) return false;
  }
  // A printed "(7/5)" names everyone who may have it; a place outside that list
  // is not admitted (meritCostFor is the same call take-merit makes).
  if (templates.length && !meritCostFor(def, templates).available) return false;
  return true;
}

// What a place can USE - the capability roster, so a list that is closed to a
// kind of creature says so instead of pricing things for someone who cannot
// have any of them. A clan or fellowship is NOT a template and settles nothing
// here (a Nosferatu may perfectly well be a demon's thrall), so it is skipped.
function scopeCapabilities(scope: ResolvedScope): string[] | undefined {
  if (scope.char) return CharacterResources.capabilities(scope.char);
  if (scope.kind === "template") return [...(TEMPLATES[scope.key!]?.Capabilities ?? [])];
  return undefined;
}

// The definition list of one owned-power family, narrowed to a place.
function scopedPowerDefs<T extends OwnedPowerDef>(family: PowerFamily<T>, scope: ResolvedScope): string {
  // Is the LIST open to this place at all? Asked first, because "a vampire has
  // no Arcana" is a truer answer than a priced catalogue he can never buy from.
  const caps = family.requires ? scopeCapabilities(scope) : undefined;
  if (family.requires && caps && !caps.includes(family.requires)) {
    return sys(`${scope.label} has no ${family.many} at all. ${family.requiresNote ?? ""} `
      + `[[${family.verbs.list} @all in=campaign]] lists them anyway.`);
  }
  const open = family.registry.all().filter(d => openToScope(d, scope));
  if (!open.length) {
    return sys(`Nothing in ${family.many} is open to ${scope.label}. `
      + `[[${family.verbs.list} @all in=campaign]] lists every definition.`);
  }
  const items = open.map(d => `${StringUtil.normalize(d.name)}${d.kind === family.defaultKind ? "" : ` (${d.kind})`}`);
  const heading = scope.kind === "campaign"
    ? `Defined ${family.many}`
    : `${family.many} open to ${scope.label}`;
  return sys(`${heading}: ${items.join(", ")}. `
    + `[[${family.verbs.info} <name>]] for detail; [[${family.verbs.define}]] adds one.`);
}

// ...and the backgrounds, whose gate is a plain template list.
function scopedBackgroundDefs(scope: ResolvedScope): string {
  const templates = scopeTemplates(scope).map(t => StringUtil.normalize(t));
  const open = BackgroundRegistry.all().filter(d => {
    if (scope.kind === "campaign" || !d.templates?.length || !templates.length) return true;
    return d.templates.some(t => templates.includes(StringUtil.normalize(t)));
  });
  if (!open.length) return sys(`No backgrounds are open to ${scope.label}.`);
  const where = scope.kind === "campaign" ? "" : ` open to ${scope.label}`;
  return sys(`Backgrounds${where}: ${open.map(d => d.name).join(", ")}. `
    + `[[show-background <name>]] for one; [[set-trait <name> <n>]] rates one; [[define-background]] adds one.`);
}

// --- REGISTRATION ------------------------------------------------------------
// Every show verb, and every old name that meant it, from the one table. A
// subject cannot be half-wired: declaring it registers the verb, its `in=` and
// `in-story=` knobs, and the deprecation pointer on each name it replaces.
export const SHOW_VERB_PREFIX = "show-";
// The verbs the subject table owns. Exported so a test can check the real list
// rather than guessing from the prefix - `show-help` wears the prefix but is an
// alias of [[help]], not a subject.
export const SHOW_SUBJECT_VERBS: string[] = [];
const SHOW_ALL_HINT = "name|@all";

function showParams(subject: ShowSubject): ParamSpec[] {
  return [
    { key: "name", kind: "positional", hint: subject.nameHint ?? SHOW_ALL_HINT,
      example: subject.nameExample,
      desc: `What to show; ${SHOW_ALL_TOKEN} means the whole list` },
    { key: "in", kind: "named", hint: "<where>", example: subject.scopes.slice(0, 3).join(" · "),
      desc: `Where to look: ${subject.scopes.join(", ")} (default ${subject.defaultScope}); `
        + `a bare name is worked out, kind::name is explicit` },
    ...(subject.extra ?? []),
    // `in-story` is NOT listed here: CommandRouter.register attaches it to every
    // verb, show or not (src/command.ts IN_STORY_PARAM).
  ];
}

for (const subject of SHOW_SUBJECTS) {
  const handler: CommandHandler = async (cmd) => {
    const { name } = showName(cmd);
    const scope = await resolveShowScope(cmd.named["in"] ?? cmd.named["from"], subject.scopes, subject.defaultScope);
    if ("error" in scope) return sys(scope.error);
    return subject.render(name, scope, cmd);
  };
  CommandRouter.register(subject.verb, handler, {
    summary: subject.summary,
    note: subject.note,
    params: showParams(subject),
  });
  SHOW_SUBJECT_VERBS.push(subject.verb);
}

// ...and every name that used to mean it now says so. ONE table, so a rename
// cannot leave a dangling pointer: an unregistered verb here fails the suite.
export const SHOW_DEPRECATIONS: Array<{ from: string; to: string; hidden?: boolean }> =
  SHOW_SUBJECTS.flatMap(s => (s.replaces ?? []).map(r => ({ from: r.verb, to: s.verb })));
for (const { from, to } of SHOW_DEPRECATIONS) CommandRouter.deprecate(from, to);

// HELP IS THE EXCEPTION, and it runs the other way. Everything else that only
// reports was renamed to `show-*`, but [[help]] is what a player types before
// they know anything at all - in this engine and in every other one - so it
// KEEPS its name and is not deprecated. `show-help` is registered as the alias,
// for the players who will now reasonably guess it. Both are quiet.
CommandRouter.register("show-help",
  (cmd, ctx) => CommandRouter.route(`help ${cmd.positional.join(" ")}`.trim(), ctx), {
    summary: "alias of [[help]], which keeps its name - it is the one command everybody already knows",
    params: [{ key: "verb", kind: "positional", hint: "[verb]", example: "show-merit" }],
  });

const COMMAND_PATTERN = /\[\[([\s\S]*?)\]\]/g;

// QUIET: a verb whose reply is for the PLAYER, not the AI. Issuing one
// suppresses generation for the turn even amid prose - the player is querying
// the system, not narrating an action the Storyteller should continue.
// (Generation belongs to in-fiction ACTIONS: rolls, spends, damage, afflicting.)
//
// THE NAME IS THE POLICY. Every `show-*` verb is quiet by construction, so a
// new listing cannot be forgotten from a register - which is exactly what the
// old hand-maintained set kept happening to. What is left below is the handful
// of read-only verbs that are not listings at all, plus the deprecated aliases,
// which are quiet because the verb they now point at is.
//
// This is the game-layer "quiet the turn" policy; it stays OUT of the pure
// CommandSpec (which describes grammar).
const QUIET_VERBS = new Set<string>([
  // [[help]] keeps its name (see the registration after SHOW_SUBJECTS): it is
  // the one command a player already knows before they know anything, so it is
  // named for discovery rather than for this scheme - and listed here instead.
  "help", "show-help",
  // Maintenance: the player operating the machine, never a story beat.
  "flush-context", "convert-cards",
]);

export function isQuietVerb(verb: string): boolean {
  const v = verb.toLowerCase();
  if (v.startsWith(SHOW_VERB_PREFIX)) return true;
  if (QUIET_VERBS.has(v)) return true;
  // A deprecated name is as quiet as what replaced it.
  const replacedBy = CommandRouter.specFor(v)?.deprecated;
  return replacedBy !== undefined && (replacedBy.startsWith(SHOW_VERB_PREFIX) || QUIET_VERBS.has(replacedBy));
}

// DOES THIS REPLY BELONG IN THE STORY? Three answers, in order:
//   1. what the player said on THIS call - `in-story`, `in-story=false`
//   2. what the verb declares (CommandSpec.inStory)
//   3. its name: a quiet verb is for the player, so no; anything else, yes
//
// Both directions matter. `[[show-sheet in-story]]` lets the Storyteller read
// the sheet; `[[roll stealth in-story=false]]` is a roll behind the screen.
//
// It does NOT change generation for the turn: looking something up is still not
// an action, so a show reply sits in the story and is read on the NEXT
// generation rather than prompting one now.
export function wantsInStory(cmd: ParsedCommand): boolean {
  const said = flagOf(cmd, IN_STORY_KEY);
  if (said !== undefined) return said;
  const declared = CommandRouter.specFor(cmd.name)?.inStory;
  if (declared !== undefined) return declared;
  return !isQuietVerb(cmd.name);
}

// =============================================================================
// CONTEXT HYGIENE - keep engine noise out of the AI's context (§7.32)
// -----------------------------------------------------------------------------
// A QUIET reply (help, listings, sheet, scene-info, ...) is for the PLAYER, not
// the AI - it is pure noise in the model's context. Such replies are wrapped in
// a marker tagged with the generation count at which they were written; the
// onContextBuilt hook strips marked spans out of the messages before generation
// (so the AI never reads them), and Pass 2 will age-delete the blocks from the
// document itself after a few generations. onContextBuilt is also the reliable
// place to COUNT real generations: it fires for every generation AND for the
// player's context inspections, and the `dryRun` flag tells them apart.
// =============================================================================
const CTX_SKIP_TAG = "wod:ctx-skip";
const CTX_SKIP_RE = /<!--wod:ctx-skip:\d+-->[\s\S]*?<!--\/wod:ctx-skip-->/g;

// Wrap a reply the AI should not see, tagged with the current generation count
// (for later age-out). No newlines - the marker rides the single input line.
async function markCtxSkip(reply: string): Promise<string> {
  return `<!--${CTX_SKIP_TAG}:${await GenCounter.get()}-->${reply}<!--/${CTX_SKIP_TAG}-->`;
}
// Remove every ctx-skip block from a text (leaving surrounding prose intact).
export function stripCtxSkip(text: string): string {
  return text.replace(CTX_SKIP_RE, "");
}

// The onContextBuilt handler: count the generation (real ones only), then strip
// ctx-skip noise from the messages so the AI never reads it. Returns the modified
// message array, or undefined when nothing changed. Emptied messages are dropped.
export async function processContextBuilt(messages: Message[], dryRun: boolean): Promise<Message[] | undefined> {
  if (!dryRun) await GenCounter.increment();
  let changed = false;
  const out: Message[] = [];
  for (const msg of messages) {
    const content = msg.content ?? "";
    if (!content.includes(`<!--${CTX_SKIP_TAG}:`)) { out.push(msg); continue; }
    changed = true;
    const stripped = stripCtxSkip(content).replace(/[ \t]{2,}/g, " ").trim();
    if (stripped) out.push({ ...msg, content: stripped });   // else: drop the now-empty message
  }
  return changed ? out : undefined;
}

// Age-out: remove the ctx-skip blocks whose creation generation is at least
// `keepFor` generations behind `now` (leaving fresher ones + surrounding prose).
// Returns the new text, or null when nothing was old enough to drop.
export function stripAgedCtxSkip(text: string, now: number, keepFor: number): string | null {
  let changed = false;
  const out = text.replace(/<!--wod:ctx-skip:(\d+)-->[\s\S]*?<!--\/wod:ctx-skip-->/g, (m, g: string) => {
    if (now - parseInt(g, 10) >= keepFor) { changed = true; return ""; }
    return m;
  });
  return changed ? out : null;
}

const CTX_SKIP_KEEP = 2;   // keep a noise block visible for this many generations, then delete it from the story

// The onGenerationEnd handler: post-generation DOCUMENT cleanup (best-effort,
// needs documentEdit). Two jobs: (a) the streaming <hide> backstop - a block
// that survived a chunk split lands in the document, so scan for any complete
// <hide>...</hide>, route it to the scene plan/Author's Note, and strip it out;
// (b) age-out - delete ctx-skip noise blocks older than CTX_SKIP_KEEP generations
// from the story itself (onContextBuilt already keeps them out of the AI's view).
// `keepFor` is how many generations a noise block stays visible before it is
// deleted from the story. The automatic pass keeps them briefly (a player may
// want to read the reply they just got); an EXPLICIT flush passes 0, because
// somebody asking for a clean story now means now.
export async function processGenerationEnd(keepFor: number = CTX_SKIP_KEEP): Promise<{ scanned: number; cleaned: number; recovered: number } | undefined> {
  let sections: { sectionId: number; section: { text: string } }[];
  try { sections = await api.v1.document.scan(); }
  catch { return undefined; }   // no documentEdit permission - nothing to clean
  const now = await GenCounter.get();
  const recovered: HideDirective[] = [];
  let cleaned = 0;
  for (const { sectionId, section } of sections) {
    let text = section.text ?? "";
    let dirty = false;
    if (/<hide[\s>]/i.test(text) && /<\/hide>/i.test(text)) {   // (a) a surviving hide block
      const ex = extractHideBlocks(text);
      recovered.push(...ex.directives);
      text = ex.cleaned; dirty = true;
    }
    const aged = stripAgedCtxSkip(text, now, keepFor);          // (b) old noise
    if (aged !== null) { text = aged; dirty = true; }
    if (!dirty) continue;
    cleaned++;
    text = text.replace(/[ \t]{2,}/g, " ").trimEnd();           // tidy the gap a removed block left
    try {
      if (text.trim()) await api.v1.document.updateParagraph(sectionId, { text });
      else await api.v1.document.removeParagraph(sectionId);
    } catch { /* best-effort per section */ }
  }
  if (recovered.length) await applyHideDirectives(recovered);
  return { scanned: sections.length, cleaned, recovered: recovered.length };
}

// flush-context - do the post-generation cleanup NOW, on demand.
//
// The same work onGenerationEnd does, and the heaviest thing the engine asks of
// the host: one document scan plus an edit per dirty paragraph. On a slow
// device that is exactly the work worth doing when the PLAYER chooses rather
// than while they wait - so it is also a verb. If the story feels sluggish or
// engine notes are showing through, run it, wait a beat, carry on.
async function cmdFlushContext(): Promise<string> {
  const r = await processGenerationEnd(0);   // everything, not just what has aged out
  if (!r) {
    return sys(`Cannot reach the story text - the script needs the documentEdit permission. Nothing was changed.`);
  }
  const bits = [
    `${r.scanned} paragraph${r.scanned === 1 ? "" : "s"} scanned`,
    r.cleaned ? `${r.cleaned} cleaned` : "nothing needed clearing",
    r.recovered ? `${r.recovered} hidden block${r.recovered === 1 ? "" : "s"} recovered to the scene plan` : "",
  ].filter(Boolean);
  return sys(`Flushed: ${bits.join(", ")}. Engine notes are out of the story and out of the AI's context.`);
}

// Replace every [[command]] in the player's adventure-mode input with its
// [SYSTEM: ...] note, running commands in order. Generation is suppressed when
// the input was ONLY commands (no prose) OR any command was a QUIET (query) one
// - either way the player is operating the system, not advancing the story.
// A QUIET reply is also wrapped in a ctx-skip marker (kept out of the AI's
// context by onContextBuilt); a signal reply (a roll, a scene change) is not.
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
  let anyQuiet = false;
  for (const m of matches) {
    out += rawInputText.slice(cursor, m.index);
    // Through the ROUTER's parse, so a bare flag (`[[show-sheet in-story]]`) is
    // promoted here exactly as it is when the command is dispatched.
    const parsed = CommandRouter.parse(m[1]);
    const quiet = isQuietVerb(parsed.name);
    if (quiet) anyQuiet = true;
    // EVERY command is announced on the bus, in the formalized envelope, on
    // both the catch-all channel and its own verb's. Locally this costs a
    // function call; in a distributed engine it is how a script that owns a
    // verb hears about it. Nothing subscribes yet - the announcement is the
    // seam, and it exists before anything needs it.
    const envelope = commandEnvelope(parsed, {
      id: `${Date.now()}-${m.index}`, character: (await CharacterStore.getCurrent())?.name, at: Date.now(),
    });
    await PostOffice.publish(COMMAND_CHANNEL, envelope);
    await PostOffice.publish(commandChannel(parsed.name), envelope);
    const reply = await CommandRouter.route(m[1]);
    // ONE question, asked of every command: does this reply belong in the story?
    // (The turn's quietness is a separate matter, decided above.)
    out += wantsInStory(parsed) ? reply : await markCtxSkip(reply);
    cursor = (m.index ?? 0) + m[0].length;
  }
  out += rawInputText.slice(cursor);

  const prose = rawInputText.replace(COMMAND_PATTERN, "").trim();
  // The host forbids newlines in inputText (it would replace them with spaces).
  return { inputText: out.replace(/\n/g, " "), stopGeneration: prose.length === 0 || anyQuiet };
}
