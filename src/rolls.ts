// =============================================================================
// ROLLS - turn a player's roll request into dice, with contextual modifiers
// -----------------------------------------------------------------------------
// Pure: depends only on core (Dice + StringUtil). A RollSpec is the declarative,
// serializable description of a roll (pool expression, difficulty, requirement,
// dice/difficulty modifiers, tags). resolveSpec turns it into concrete numbers
// against a TraitResolver, folding in any tag-driven RollModifiers; executeRoll
// then rolls it via core Dice. Keeping the spec separate and serializable is
// what will let players save and re-run "named rolls" later.
// =============================================================================
import { Dice, Rng, RollResult } from "./core/dice";
import { StringUtil } from "./core/traits";

// Resolves a trait name to its dice value (0 when the character lacks it).
export type TraitResolver = (name: string) => number;

export const DEFAULT_DIFFICULTY = 6;

// A declarative, serializable roll. `pool` is an expression ("strength+brawl",
// "7", "3+2", "willpower"); the rest are the Storyteller's knobs.
export interface RollSpec {
  pool: string;
  difficulty: number;     // base target number (default 6); ignored if difficultyExpr is set
  difficultyExpr?: string; // difficulty as a pool expression (a trait or calculation,
                          // e.g. "stamina+3"); evaluated against the roller's traits
  difficultyMod: number;  // +/- applied to difficulty (default 0)
  requires: number;       // successes needed to count as a success (default 1)
  diceMod: number;        // +/- dice added to the resolved pool (default 0)
  tags: string[];         // contextual mechanic keys (normalized)
}

// Fill defaults and normalize tags. `requires` is at least 1.
export function makeRollSpec(parts: Partial<RollSpec> & { pool: string }): RollSpec {
  const spec: RollSpec = {
    pool: parts.pool,
    difficulty: parts.difficulty ?? DEFAULT_DIFFICULTY,
    difficultyMod: parts.difficultyMod ?? 0,
    requires: Math.max(1, parts.requires ?? 1),
    diceMod: parts.diceMod ?? 0,
    tags: (parts.tags ?? []).map(t => StringUtil.normalize(t)).filter(t => t.length > 0),
  };
  if (parts.difficultyExpr && parts.difficultyExpr.trim()) spec.difficultyExpr = parts.difficultyExpr.trim();
  return spec;
}

// --- POOL EXPRESSION ---
export interface PoolPart { token: string; value: number; isLiteral: boolean; }
export interface PoolBreakdown { parts: PoolPart[]; total: number; }

// "strength+brawl" / "3+2" / "7" / "willpower" -> summed dice (>= 0). Each
// '+'-separated part is an integer literal or a trait name resolved via
// `resolve`. The pool source is a single token (no spaces) so it never collides
// with the positional difficulty / difficulty-modifier that follow it.
export function parsePoolExpression(expr: string, resolve: TraitResolver): PoolBreakdown {
  const parts: PoolPart[] = [];
  for (const raw of expr.split("+")) {
    const token = raw.trim();
    if (token.length === 0) continue;
    if (/^-?\d+$/.test(token)) parts.push({ token, value: parseInt(token, 10), isLiteral: true });
    else parts.push({ token, value: resolve(token), isLiteral: false });
  }
  return { parts, total: Math.max(0, parts.reduce((s, p) => s + p.value, 0)) };
}

function prettyPool(expr: string): string {
  return expr.split("+").map(t => t.trim()).filter(t => t.length > 0)
    .map(t => /^-?\d+$/.test(t) ? t : StringUtil.toTitleCase(t)).join(" + ");
}

// --- CONTEXTUAL MODIFIERS (tags) ---
// A modifier keyed by a roll tag: matching tags adjust the difficulty, the dice
// pool, free successes, or the n-again threshold before the roll. This is how
// "rules for things" (merits/flaws, situational modifiers) attach to a roll -
// the roll carries tags, each matching modifier fires. Tags are strings, so
// they ride along in a saved (named) roll unchanged.
export interface RollModifier {
  tag: string;             // normalized on registration
  describe: string;
  difficultyMod?: number;
  diceMod?: number;
  autoSuccesses?: number;
  nAgain?: number;         // tighten n-again (e.g. 9 for 9-again); never loosens
}

// Starter set; a chronicle can register more. These name the *situation* (the
// ST tags the roll), not the character's owned merits - auto-deriving modifiers
// from a character's Merits/Flaws is a planned follow-up.
export const DEFAULT_ROLL_MODIFIERS: RollModifier[] = [
  { tag: "Acute Senses", describe: "Acute Senses: -2 difficulty on the sharpened sense.", difficultyMod: -2 },
  { tag: "off-hand", describe: "Off-hand action: +1 difficulty (cancelled by Ambidextrous).", difficultyMod: 1 },
  { tag: "Ambidextrous", describe: "Ambidextrous: cancels the off-hand penalty.", difficultyMod: -1 },
  { tag: "Willpower", describe: "Spent Willpower: +1 automatic success.", autoSuccesses: 1 },
  { tag: "specialty", describe: "Relevant specialty: 9s count again (9-again).", nAgain: 9 },
];

export class RollModifierRegistry {
  private static _mods: Map<string, RollModifier> =
    new Map(DEFAULT_ROLL_MODIFIERS.map(m => [StringUtil.normalize(m.tag), { ...m, tag: StringUtil.normalize(m.tag) }]));

  static register(mod: RollModifier): void {
    const tag = StringUtil.normalize(mod.tag);
    RollModifierRegistry._mods.set(tag, { ...mod, tag });
  }
  static get(tag: string): RollModifier | undefined { return RollModifierRegistry._mods.get(StringUtil.normalize(tag)); }
  static all(): RollModifier[] { return [...RollModifierRegistry._mods.values()]; }
  static reset(): void {
    RollModifierRegistry._mods = new Map(DEFAULT_ROLL_MODIFIERS.map(m => [StringUtil.normalize(m.tag), { ...m, tag: StringUtil.normalize(m.tag) }]));
  }
}

// --- RESOLUTION & EXECUTION ---
// How to treat a final difficulty above 10. Default charges an extra required
// success per point over 10 (the die target caps at 10); "impossible" fails the
// action outright. Both are Storyteller-authentic; extra-success is the default.
export type OverDifficultyPolicy = "extra-success" | "impossible";

export interface ResolvedRoll {
  spec: RollSpec;
  breakdown: PoolBreakdown;
  dice: number;               // pool after diceMod (>= 0)
  dieDifficulty: number;      // clamped to [2, 10] - what the dice actually use
  requires: number;           // successes needed (incl. any over-10 surcharge)
  automaticSuccesses: number;
  nAgain: number;
  rawDifficulty: number;      // pre-clamp difficulty (may exceed 10 or dip below 2)
  overflow: number;           // max(0, rawDifficulty - 10)
  impossible: boolean;        // over-10 under the "impossible" policy
  appliedTags: string[];
  unknownTags: string[];
  notes: string[];
}

export function resolveSpec(spec: RollSpec, resolve: TraitResolver, opts: { overDifficulty?: OverDifficultyPolicy; extra?: Partial<RollModifier> } = {}): ResolvedRoll {
  const breakdown = parsePoolExpression(spec.pool, resolve);
  // Difficulty may be a plain number or an expression (a trait/calculation)
  // evaluated against the SAME resolver as the pool - e.g. "stamina+3".
  const baseDifficulty = spec.difficultyExpr ? parsePoolExpression(spec.difficultyExpr, resolve).total : spec.difficulty;
  let difficulty = baseDifficulty + spec.difficultyMod;
  let dice = breakdown.total + spec.diceMod;
  let automaticSuccesses = 0;
  let nAgain = 10;
  const appliedTags: string[] = [];
  const unknownTags: string[] = [];
  for (const tag of spec.tags) {
    const mod = RollModifierRegistry.get(tag);
    if (!mod) { unknownTags.push(tag); continue; }
    appliedTags.push(tag);
    difficulty += mod.difficultyMod ?? 0;
    dice += mod.diceMod ?? 0;
    automaticSuccesses += mod.autoSuccesses ?? 0;
    if (mod.nAgain !== undefined) nAgain = Math.min(nAgain, mod.nAgain);
  }

  // An ad-hoc modifier (e.g. a spent resource's effect) applied like a matched tag.
  if (opts.extra) {
    difficulty += opts.extra.difficultyMod ?? 0;
    dice += opts.extra.diceMod ?? 0;
    automaticSuccesses += opts.extra.autoSuccesses ?? 0;
    if (opts.extra.nAgain !== undefined) nAgain = Math.min(nAgain, opts.extra.nAgain);
  }

  const rawDifficulty = difficulty;
  const dieDifficulty = Math.max(2, Math.min(10, rawDifficulty));
  const overflow = Math.max(0, rawDifficulty - 10);
  const policy = opts.overDifficulty ?? "extra-success";
  const impossible = overflow > 0 && policy === "impossible";

  let requires = Math.max(1, spec.requires);
  const notes: string[] = [];
  if (overflow > 0) {
    if (impossible) notes.push(`difficulty ${rawDifficulty} exceeds 10 -> impossible`);
    else { requires += overflow; notes.push(`difficulty ${rawDifficulty} > 10 -> +${overflow} required success${overflow === 1 ? "" : "es"}`); }
  }
  if (unknownTags.length) notes.push(`unknown tag${unknownTags.length === 1 ? "" : "s"}: ${unknownTags.join(", ")}`);

  return {
    spec, breakdown, dice: Math.max(0, dice), dieDifficulty, requires,
    automaticSuccesses, nAgain, rawDifficulty, overflow, impossible, appliedTags, unknownTags, notes,
  };
}

export type RollOutcomeKind = "success" | "failure" | "botch" | "impossible";
export interface RollExecution {
  resolved: ResolvedRoll;
  result: RollResult | null;   // null when impossible (never rolled)
  met: boolean;                // requirement met
  outcome: RollOutcomeKind;
}

export function executeRoll(
  spec: RollSpec, resolve: TraitResolver,
  opts: { rng?: Rng; overDifficulty?: OverDifficultyPolicy; extra?: Partial<RollModifier> } = {}
): RollExecution {
  const resolved = resolveSpec(spec, resolve, opts);
  if (resolved.impossible) return { resolved, result: null, met: false, outcome: "impossible" };
  const result = Dice.roll(resolved.dice, {
    difficulty: resolved.dieDifficulty,
    nAgain: resolved.nAgain,
    automaticSuccesses: resolved.automaticSuccesses,
    rng: opts.rng,
    label: prettyPool(spec.pool) || "Pool",
  });
  const met = !result.isBotch && result.net >= resolved.requires;
  const outcome: RollOutcomeKind = result.isBotch ? "botch" : (met ? "success" : "failure");
  return { resolved, result, met, outcome };
}

// A single-line summary (no character name; the caller prefixes that).
export function formatExecution(exec: RollExecution): string {
  if (exec.outcome === "impossible") {
    return `${prettyPool(exec.resolved.spec.pool)}: impossible - difficulty ${exec.resolved.rawDifficulty} exceeds 10.`;
  }
  const r = exec.result!;
  const verdict = r.isBotch ? "botch"
    : (exec.met ? `meets requirement (${exec.resolved.requires})` : `short of requirement (${exec.resolved.requires})`);
  const extra = exec.resolved.notes.length ? ` [${exec.resolved.notes.join("; ")}]` : "";
  return `${r.message} - ${verdict}${extra}`;
}

// --- PARTIAL OVERRIDE (named rolls, and later extended-roll continuations) ---
// Return a copy of `base` with only the DEFINED fields of `overrides` applied.
// `pool` is intentionally never overridden - a saved roll keeps its own pool;
// callers tweak the knobs (difficulty, dice, requirement, tags). This is the
// shared primitive behind named rolls and the future extended-roll continuations
// (helpers changing the dice modifier, etc.).
export function overrideSpec(base: RollSpec, overrides: Partial<RollSpec>): RollSpec {
  const merged: RollSpec = { ...base, tags: [...base.tags] };
  // A numeric difficulty override replaces any expression, and vice versa
  // (extractRollArgs supplies exactly one of them).
  if (overrides.difficulty !== undefined) { merged.difficulty = overrides.difficulty; merged.difficultyExpr = undefined; }
  if (overrides.difficultyExpr !== undefined) merged.difficultyExpr = overrides.difficultyExpr || undefined;
  if (overrides.difficultyMod !== undefined) merged.difficultyMod = overrides.difficultyMod;
  if (overrides.requires !== undefined) merged.requires = Math.max(1, overrides.requires);
  if (overrides.diceMod !== undefined) merged.diceMod = overrides.diceMod;
  if (overrides.tags !== undefined) merged.tags = overrides.tags.map(t => StringUtil.normalize(t)).filter(t => t.length > 0);
  return merged;
}

// A short one-line summary of a spec, for save/list confirmations.
export function describeSpec(spec: RollSpec): string {
  const mod = spec.difficultyMod ? (spec.difficultyMod > 0 ? `+${spec.difficultyMod}` : `${spec.difficultyMod}`) : "";
  const parts = [spec.pool, `diff ${spec.difficultyExpr ?? spec.difficulty}${mod}`];
  if (spec.requires !== 1) parts.push(`requires ${spec.requires}`);
  if (spec.diceMod) parts.push(`dice ${spec.diceMod > 0 ? "+" : ""}${spec.diceMod}`);
  if (spec.tags.length) parts.push(`tags ${spec.tags.join(",")}`);
  return parts.join(", ");
}

// --- EXTENDED ROLLS (persistent, interval-aware accumulating actions) --------
// An extended action accumulates net successes toward `target` across up to
// `maxRolls` intervals (which may be far apart in time). A botch triggers the
// configurable `onBotch` policy. This state machine is pure; persistence and the
// commands live in game.ts.
export type BotchPolicy = "fail" | "lose-successes" | "ignore";
export type ExtendedStatus = "open" | "succeeded" | "failed";

export interface ExtendedInterval {
  by: string;              // character who rolled this interval
  net: number;             // successes credited (0 on a botch)
  outcome: RollOutcomeKind;
  total: number;           // accumulated successes after this interval
}

export interface ExtendedRoll {
  id: string;
  label: string;           // description ("" if none)
  base: RollSpec;          // the roll each interval makes
  target: number;          // successes needed to succeed
  maxRolls: number;        // intervals allowed
  interval: string;        // advisory spacing label ("" if none)
  onBotch: BotchPolicy;
  accumulated: number;
  rollsUsed: number;
  status: ExtendedStatus;
  log: ExtendedInterval[];
}

export function parseBotchPolicy(s: string | undefined): BotchPolicy {
  const n = (s ?? "").trim().toLowerCase();
  if (n === "lose-successes" || n === "lose" || n === "reset") return "lose-successes";
  if (n === "ignore" || n === "continue") return "ignore";
  return "fail";
}

// Apply one interval's result to an OPEN action. Pure: returns a NEW action plus
// a short human note. Caller must ensure `action.status === "open"`.
export function applyInterval(action: ExtendedRoll, exec: RollExecution, by: string): { action: ExtendedRoll; note: string } {
  const next: ExtendedRoll = { ...action, log: [...action.log] };
  const net = exec.result ? exec.result.net : 0;
  let credited = 0;
  let note: string;

  next.rollsUsed += 1;
  if (exec.outcome === "botch") {
    if (action.onBotch === "fail") { next.status = "failed"; note = "botch - the action fails"; }
    else if (action.onBotch === "lose-successes") { next.accumulated = 0; note = "botch - accumulated successes lost"; }
    else { note = "botch - counted as no progress"; }
  } else {
    credited = Math.max(0, net);
    next.accumulated += credited;
    note = `+${credited} (total ${next.accumulated}/${action.target})`;
  }

  if (next.status === "open") {
    if (next.accumulated >= action.target) next.status = "succeeded";
    else if (next.rollsUsed >= action.maxRolls) next.status = "failed";
  }
  next.log.push({ by, net: credited, outcome: exec.outcome, total: next.accumulated });
  return { action: next, note };
}

// One-line status summary.
export function describeExtended(a: ExtendedRoll): string {
  const head = a.label ? `"${a.label}" ` : "";
  const bits = [`${a.accumulated}/${a.target} successes`, `roll ${a.rollsUsed}/${a.maxRolls}`];
  if (a.interval) bits.push(`interval ${a.interval}`);
  bits.push(a.status);
  return `${head}[${describeSpec(a.base)}] - ${bits.join(", ")}`;
}

// =============================================================================
// SUCCESS TABLES - what a number of successes MEANS
// -----------------------------------------------------------------------------
// A roll never interprets its own successes; it hands the count to a table.
// Tables are pure data: qualitative ladders (discipline effects, the classic
// degrees of success), direct numeric functions (damage: 1 level per success),
// or both. `cap` makes extra successes useless; `overflow` gives each batch of
// extras a rule-specified bonus beyond the last row.
// =============================================================================
export interface SuccessTableRow { at: number; label: string; value?: number }
export interface SuccessTable {
  name: string;
  description?: string;
  rows?: SuccessTableRow[];      // sorted ascending; the highest `at` <= n applies
  valuePerSuccess?: number;      // direct numeric output: value = counted * this
  cap?: number;                  // successes beyond this are useless
  overflow?: { per: number; label?: string; value?: number }; // per batch beyond the last row
  botch?: string;                // what a botch means here
  failure?: string;              // what failure means here
}
export interface SuccessReading {
  table: string;
  outcome: RollOutcomeKind;
  successes: number;             // counted (after cap)
  wasted: number;                // beyond the cap
  label: string;
  value?: number;                // numeric output when the table defines one
  extra?: string;                // overflow annotation
}

export function readSuccessTable(table: SuccessTable, outcome: RollOutcomeKind, successes: number): SuccessReading {
  const base: SuccessReading = { table: table.name, outcome, successes: 0, wasted: 0, label: "" };
  if (outcome === "botch") return { ...base, label: table.botch ?? "Botch" };
  if (outcome !== "success" || successes <= 0) return { ...base, label: table.failure ?? "Failure" };

  const counted = table.cap !== undefined ? Math.min(successes, table.cap) : successes;
  const wasted = successes - counted;
  let label = `${counted} success${counted === 1 ? "" : "es"}`;
  let value: number | undefined;
  let extra: string | undefined;

  if (table.valuePerSuccess !== undefined) value = counted * table.valuePerSuccess;
  const rows = [...(table.rows ?? [])].sort((a, b) => a.at - b.at);
  if (rows.length > 0) {
    const hit = [...rows].reverse().find(r => r.at <= counted);
    if (!hit) return { ...base, successes: counted, wasted, label: table.failure ?? "Failure" };
    label = hit.label;
    if (hit.value !== undefined) value = (value ?? 0) + hit.value;
    const last = rows[rows.length - 1];
    if (table.overflow && counted > last.at) {
      const batches = Math.floor((counted - last.at) / Math.max(1, table.overflow.per));
      if (batches > 0) {
        if (table.overflow.value !== undefined) value = (value ?? 0) + batches * table.overflow.value;
        extra = `+${batches} x ${table.overflow.label ?? "overflow"}`;
      }
    }
  }
  return { table: table.name, outcome, successes: counted, wasted, label, value, extra };
}

export function describeTableReading(r: SuccessReading): string {
  const bits = [r.label];
  if (r.value !== undefined) bits.push(`= ${r.value}`);
  if (r.extra) bits.push(r.extra);
  if (r.wasted > 0) bits.push(`(${r.wasted} wasted)`);
  return bits.join(" ");
}

// A whole table laid out (for [[tables <name>]]): its ladder and every dimension
// that shapes a reading, so a Storyteller can see exactly what it does.
export function describeTable(t: SuccessTable): string {
  const dims: string[] = [];
  const rows = [...(t.rows ?? [])].sort((a, b) => a.at - b.at);
  if (rows.length > 0) {
    dims.push(rows.map(r => `${r.at}:${r.label}${r.value !== undefined ? `=${r.value}` : ""}`).join(", "));
  }
  if (t.valuePerSuccess !== undefined) dims.push(`${t.valuePerSuccess}/success`);
  if (t.cap !== undefined) dims.push(`cap ${t.cap}`);
  if (t.overflow) dims.push(`overflow ${t.overflow.value ?? "?"}/${t.overflow.per} (${t.overflow.label ?? "overflow"})`);
  if (t.botch) dims.push(`botch: ${t.botch}`);
  if (t.failure) dims.push(`failure: ${t.failure}`);
  const head = t.description ? `${t.name} - ${t.description}` : t.name;
  return dims.length ? `${head} [${dims.join("; ")}]` : head;
}

// The classic ladders every chronicle starts with; the lorebook can overlay
// more (wod:config:success-tables). Damage and soak are the "direct function"
// generalization: same mechanism, numeric output.
export const DEFAULT_SUCCESS_TABLES: SuccessTable[] = [
  {
    name: "degrees", description: "Classic degrees of success",
    botch: "Botch - catastrophic failure", failure: "Failure",
    rows: [
      { at: 1, label: "Marginal" }, { at: 2, label: "Moderate" }, { at: 3, label: "Complete" },
      { at: 4, label: "Exceptional" }, { at: 5, label: "Phenomenal" },
    ],
  },
  { name: "damage", description: "Each success is one level of damage", valuePerSuccess: 1, botch: "Botch - you may hit an ally or yourself", failure: "No damage" },
  { name: "soak", description: "Each success soaks one level", valuePerSuccess: 1, failure: "Nothing soaked" },
];

export class SuccessTableRegistry {
  private static _tables: Map<string, SuccessTable> =
    new Map(DEFAULT_SUCCESS_TABLES.map(t => [StringUtil.normalize(t.name), { ...t, name: StringUtil.normalize(t.name) }]));

  static register(table: SuccessTable): void {
    const name = StringUtil.normalize(table.name);
    SuccessTableRegistry._tables.set(name, { ...table, name });
  }
  static get(name: string): SuccessTable | undefined { return SuccessTableRegistry._tables.get(StringUtil.normalize(name)); }
  static all(): SuccessTable[] { return [...SuccessTableRegistry._tables.values()]; }
  static reset(): void {
    SuccessTableRegistry._tables = new Map(DEFAULT_SUCCESS_TABLES.map(t => [StringUtil.normalize(t.name), { ...t, name: StringUtil.normalize(t.name) }]));
  }
}

// =============================================================================
// RESISTED & CONTESTED ROLLS - two rolls, one comparison
// -----------------------------------------------------------------------------
// oWoD classic defaults: RESISTED - only the actor's margin over the resister
// counts; a tie (or the resister winning) means the action simply fails.
// CONTESTED - symmetric: more successes wins, a tie is a draw. A botched side
// contributes 0 successes (flagged); both sides botching is a mutual disaster.
// =============================================================================
export type ContestMode = "resisted" | "contested";
export interface ContestOutcome {
  mode: ContestMode;
  aNet: number; bNet: number;       // successes counted for each side (botch -> 0)
  aBotch: boolean; bBotch: boolean;
  winner: "a" | "b" | "none";
  margin: number;                   // the winner's lead (0 when none)
  note: string;
}

export function compareRolls(mode: ContestMode, a: RollExecution, b: RollExecution): ContestOutcome {
  const aBotch = a.outcome === "botch";
  const bBotch = b.outcome === "botch";
  const aNet = aBotch ? 0 : Math.max(0, a.result?.net ?? 0);
  const bNet = bBotch ? 0 : Math.max(0, b.result?.net ?? 0);
  const base = { mode, aNet, bNet, aBotch, bBotch };

  if (aBotch && bBotch) return { ...base, winner: "none", margin: 0, note: "both sides botch - mutual disaster" };
  if (mode === "resisted") {
    if (aBotch) return { ...base, winner: "none", margin: 0, note: "the actor botches" };
    const margin = aNet - bNet;
    if (margin > 0) return { ...base, winner: "a", margin, note: `prevails by ${margin}${bBotch ? " (resister botched)" : ""}` };
    return { ...base, winner: "none", margin: 0, note: "the action is resisted" };
  }
  // contested
  if (aNet > bNet) return { ...base, winner: "a", margin: aNet - bNet, note: `wins by ${aNet - bNet}${bBotch ? " (opponent botched)" : ""}` };
  if (bNet > aNet) return { ...base, winner: "b", margin: bNet - aNet, note: `loses by ${bNet - aNet}${aBotch ? " (own botch)" : ""}` };
  return { ...base, winner: "none", margin: 0, note: "tie" };
}

// =============================================================================
// EXTENDED CONTESTS - both sides accumulate; first to the goal wins
// =============================================================================
// `char` is an opaque game-layer key (a character name, or undefined for an
// ad-hoc side); rolls.ts never reads it - the interpreter uses it to re-resolve
// this side's pool each round.
export interface ContestSide { name: string; base: RollSpec; accumulated: number; char?: string; }
export type ContestStatus = "open" | "a" | "b" | "draw";
export interface ExtendedContest {
  id: string;
  label: string;
  a: ContestSide;
  b: ContestSide;
  target: number;
  maxRounds: number;
  interval: string;                 // advisory spacing, like extended rolls
  onBotch: BotchPolicy;             // per side: fail -> that side loses outright
  rounds: number;
  status: ContestStatus;
  log: { round: number; aNet: number; bNet: number; note: string }[];
}

// One round: both sides have rolled; accumulate and settle. Pure.
export function applyContestRound(c: ExtendedContest, aExec: RollExecution, bExec: RollExecution): { contest: ExtendedContest; note: string } {
  const next: ExtendedContest = { ...c, a: { ...c.a }, b: { ...c.b }, log: [...c.log] };
  next.rounds += 1;
  const aBotch = aExec.outcome === "botch";
  const bBotch = bExec.outcome === "botch";
  const aNet = aBotch ? 0 : Math.max(0, aExec.result?.net ?? 0);
  const bNet = bBotch ? 0 : Math.max(0, bExec.result?.net ?? 0);
  let note: string;

  // Side names are stored normalized; notes show them in Title Case.
  const aLabel = StringUtil.toTitleCase(c.a.name);
  const bLabel = StringUtil.toTitleCase(c.b.name);
  if (aBotch || bBotch) {
    if (c.onBotch === "fail") {
      if (aBotch && bBotch) { next.status = "draw"; note = "both sides botch - the contest collapses"; }
      else if (aBotch) { next.status = "b"; note = `${aLabel} botches - ${bLabel} wins outright`; }
      else { next.status = "a"; note = `${bLabel} botches - ${aLabel} wins outright`; }
      next.log.push({ round: next.rounds, aNet, bNet, note });
      return { contest: next, note };
    }
    if (c.onBotch === "lose-successes") {
      if (aBotch) next.a.accumulated = 0;
      if (bBotch) next.b.accumulated = 0;
      note = "botch - progress lost";
    } else note = "botch - a wasted round";
  } else note = "";

  next.a.accumulated += aNet;
  next.b.accumulated += bNet;
  const aDone = next.a.accumulated >= c.target;
  const bDone = next.b.accumulated >= c.target;
  if (aDone || bDone) {
    if (aDone && bDone) {
      if (next.a.accumulated > next.b.accumulated) next.status = "a";
      else if (next.b.accumulated > next.a.accumulated) next.status = "b";
      // dead heat: stays open - nobody got there FIRST
    } else next.status = aDone ? "a" : "b";
  }
  if (next.status === "open" && next.rounds >= c.maxRounds) next.status = "draw";
  const progress = `${aLabel} ${next.a.accumulated}/${c.target} vs ${bLabel} ${next.b.accumulated}/${c.target}`;
  note = note ? `${note}; ${progress}` : progress;
  next.log.push({ round: next.rounds, aNet, bNet, note });
  return { contest: next, note };
}

export function describeContest(c: ExtendedContest): string {
  const aLabel = StringUtil.toTitleCase(c.a.name);
  const bLabel = StringUtil.toTitleCase(c.b.name);
  const head = c.label ? `"${c.label}" ` : "";
  const state = c.status === "open" ? "open" : c.status === "draw" ? "draw" : `${c.status === "a" ? aLabel : bLabel} WINS`;
  const bits = [
    `${aLabel} ${c.a.accumulated}/${c.target} vs ${bLabel} ${c.b.accumulated}/${c.target}`,
    `round ${c.rounds}/${c.maxRounds}`,
  ];
  if (c.interval) bits.push(`interval ${c.interval}`);
  bits.push(state);
  return `${head}${bits.join(", ")}`;
}
