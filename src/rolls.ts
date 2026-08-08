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
import { evaluateExpr, ExprScope } from "./core/expr";

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
  // Successes granted before a die is thrown. `autoSuccesses` are ordinary ones
  // that a rolled 1 can cancel; `uncancelableSuccesses` are the certain kind
  // (fused Willpower). Both exist on the spend/passive path already - these are
  // the SPEC's own, so a Storyteller can hand them out and a named roll can
  // bake them in ("Potence punch: +2 automatic").
  autoSuccesses?: number;
  uncancelableSuccesses?: number;
  tags: string[];         // contextual mechanic keys (normalized)
  difficultyCap?: number; // ceiling the die target clamps to (default 10); anything
                          // above it becomes +1 required success per point - Mage
                          // spellcasting sets 10 (or the book's 9) here
  // Floor the die target never drops below, however deep the reductions run.
  // Unset = no floor of its own; the chronicle's global floor (if it set one)
  // fills in, and failing that only the engine's hard minimum of 2 applies.
  minDifficulty?: number;
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
  if (parts.autoSuccesses) spec.autoSuccesses = parts.autoSuccesses;
  if (parts.uncancelableSuccesses) spec.uncancelableSuccesses = parts.uncancelableSuccesses;
  if (parts.difficultyExpr && parts.difficultyExpr.trim()) spec.difficultyExpr = parts.difficultyExpr.trim();
  if (parts.difficultyCap !== undefined) spec.difficultyCap = Math.max(2, Math.min(10, parts.difficultyCap));
  if (parts.minDifficulty !== undefined) spec.minDifficulty = Math.max(2, Math.min(10, parts.minDifficulty));
  return spec;
}

// --- POOL EXPRESSION ---
export interface PoolPart { token: string; value: number; isLiteral: boolean; }
export interface PoolBreakdown { parts: PoolPart[]; total: number; unknown: string[]; error?: string }

// A TraitResolver, seen as the expression language's scope: a pool names
// traits, so a path is just a name (`background:generation` reaches the
// resolver as the whole string, and the character scope splits it there).
export function resolverScope(resolve: TraitResolver): ExprScope {
  return { lookup: (path) => ({ value: resolve(path.join(":")) }) };
}

// "strength+brawl" / "3+2" / "7" / "willpower" / "strength + brawl - 1" ->
// summed dice (>= 0), through the one expression language (core/expr.ts). The
// pool source is USUALLY a single token, because a bare `[[roll ...]]` argument
// cannot contain spaces without quoting - but a saved roll or a card may write
// it out in full.
export function parsePoolExpression(expr: string, resolve: TraitResolver): PoolBreakdown {
  const out = evaluateExpr(expr, resolverScope(resolve));
  const parts: PoolPart[] = out.terms.map(t => ({ token: t.label, value: t.value, isLiteral: t.kind === "literal" }));
  return {
    parts, total: Math.max(0, out.value), unknown: out.unknown,
    ...(out.error ? { error: out.error } : {}),
  };
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
  uncancelableSuccesses?: number; // successes 1s can never cancel (fused Willpower)
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
  // Identity tags [[cast]] stamps on every spell roll: no effect of their own,
  // but magic-keyed powers/effects gate on them (target:"magic"), and they must
  // not read as typos.
  { tag: "magic", describe: "A spell roll." },
  { tag: "cast", describe: "The casting action." },
  // Where the character IS. These tags carry no modifier of their own - the
  // afflictions that grant them scale off a Background rating instead - but
  // they must not read as typos on every roll made there.
  { tag: "in-sanctum", describe: "Standing in their own sanctum." },
  { tag: "in-umbra", describe: "Walking the spirit world." },
  { tag: "in-library", describe: "Among their books." },
  { tag: "in-rotunda", describe: "In the Hermetic rotunda." },
  { tag: "full-rested", describe: "Eight hours of sleep behind them." },
  { tag: "hermetic", describe: "A matter of Hermetic lore." },
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
  dieDifficulty: number;      // clamped to [2, cap] - what the dice actually use
  requires: number;           // successes needed (incl. any over-cap surcharge)
  automaticSuccesses: number;
  uncancelableSuccesses: number;
  nAgain: number;
  rawDifficulty: number;      // pre-clamp difficulty (may exceed the cap or dip below 2)
  overflow: number;           // max(0, rawDifficulty - cap)
  impossible: boolean;        // over-cap under the "impossible" policy
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
  let automaticSuccesses = spec.autoSuccesses ?? 0;
  let uncancelableSuccesses = spec.uncancelableSuccesses ?? 0;
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
    uncancelableSuccesses += mod.uncancelableSuccesses ?? 0;
    if (mod.nAgain !== undefined) nAgain = Math.min(nAgain, mod.nAgain);
  }

  // An ad-hoc modifier (e.g. a spent resource's effect) applied like a matched tag.
  if (opts.extra) {
    difficulty += opts.extra.difficultyMod ?? 0;
    dice += opts.extra.diceMod ?? 0;
    automaticSuccesses += opts.extra.autoSuccesses ?? 0;
    uncancelableSuccesses += opts.extra.uncancelableSuccesses ?? 0;
    if (opts.extra.nAgain !== undefined) nAgain = Math.min(nAgain, opts.extra.nAgain);
  }

  // The cap is the ceiling the die target clamps to (default 10); every point of
  // difficulty above it becomes a required success instead. Because reductions
  // subtract from the RAW difficulty, they strip that surcharge first and only
  // then lower the die target - the book's ordering, by arithmetic.
  const cap = Math.max(2, Math.min(10, spec.difficultyCap ?? 10));
  // The floor binds AFTER every reduction: a spell talked down to 1 still rolls
  // at the chronicle's minimum. 2 is the engine's own hard floor (a d10 target
  // of 1 would make every die a success).
  const floor = Math.max(2, Math.min(cap, spec.minDifficulty ?? 2));
  const rawDifficulty = difficulty;
  const dieDifficulty = Math.max(floor, Math.min(cap, rawDifficulty));
  const overflow = Math.max(0, rawDifficulty - cap);
  const policy = opts.overDifficulty ?? "extra-success";
  const impossible = overflow > 0 && policy === "impossible";

  let requires = Math.max(1, spec.requires);
  const notes: string[] = [];
  if (overflow > 0) {
    if (impossible) notes.push(`difficulty ${rawDifficulty} exceeds ${cap} -> impossible`);
    else { requires += overflow; notes.push(`difficulty ${rawDifficulty} > ${cap} -> +${overflow} required success${overflow === 1 ? "" : "es"}`); }
  }
  if (floor > 2 && rawDifficulty < floor) notes.push(`difficulty ${rawDifficulty} raised to the minimum ${floor}`);
  if (unknownTags.length) notes.push(`unknown tag${unknownTags.length === 1 ? "" : "s"}: ${unknownTags.join(", ")}`);

  return {
    spec, breakdown, dice: Math.max(0, dice), dieDifficulty, requires,
    automaticSuccesses, uncancelableSuccesses, nAgain, rawDifficulty, overflow, impossible, appliedTags, unknownTags, notes,
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
    uncancelableSuccesses: resolved.uncancelableSuccesses,
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
  if (overrides.difficultyCap !== undefined) merged.difficultyCap = overrides.difficultyCap;
  return merged;
}

// A short one-line summary of a spec, for save/list confirmations.
export function describeSpec(spec: RollSpec): string {
  const mod = spec.difficultyMod ? (spec.difficultyMod > 0 ? `+${spec.difficultyMod}` : `${spec.difficultyMod}`) : "";
  const parts = [spec.pool, `diff ${spec.difficultyExpr ?? spec.difficulty}${mod}`];
  if (spec.requires !== 1) parts.push(`requires ${spec.requires}`);
  if (spec.diceMod) parts.push(`dice ${spec.diceMod > 0 ? "+" : ""}${spec.diceMod}`);
  if (spec.autoSuccesses) parts.push(`+${spec.autoSuccesses} auto`);
  if (spec.uncancelableSuccesses) parts.push(`+${spec.uncancelableSuccesses} sure`);
  if (spec.tags.length) parts.push(`tags ${spec.tags.join(",")}`);
  if (spec.difficultyCap !== undefined && spec.difficultyCap !== 10) parts.push(`cap ${spec.difficultyCap}`);
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
  table?: string;          // success-table key read against each interval's net
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

// The [[define-table]] rows mini-grammar: comma-separated `<at>:<label>[=<value>]`
// items (e.g. "1:Cowed, 3:Terrified, 5:Broken=2"). Input arrives VERBATIM when
// backtick-quoted (labels are display text), so items are trimmed here; the
// normalized form (lowercased, hyphenated labels) parses identically.
// Missing/empty input is a valid empty ladder; a bad item is an error citing
// the grammar (a misconfigured table is refused, never half-stored).
export function parseTableRows(raw: string | undefined): SuccessTableRow[] | { error: string } {
  if (!raw || !raw.trim()) return [];
  const rows: SuccessTableRow[] = [];
  // Rows separate on ";" when the text has one, else ",". Labels are prose and
  // often contain commas ("age, family, and whether the subject resisted"), so
  // a semicolon is the way to say "that comma is punctuation".
  const items = raw.includes(";") ? raw.split(";") : raw.split(",");
  for (const item of items) {
    const m = item.trim().match(/^(\d+)\s*:\s*([^=]+?)\s*(?:=\s*(-?\d+))?$/);
    if (!m || !m[2].trim()) {
      return { error: `Can't read row "${item.trim()}" - rows are "<successes>:<label>[=<value>]", comma-separated (e.g. 1:Cowed, 3:Terrified=2).` };
    }
    const row: SuccessTableRow = { at: parseInt(m[1], 10), label: m[2].trim() };
    if (m[3] !== undefined) row.value = parseInt(m[3], 10);
    rows.push(row);
  }
  return rows;
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
  { name: "climbing", description: "~10 ft climbed per success (Storyteller may vary the distance)", valuePerSuccess: 10, botch: "Botch - you may become stuck, panic, or fall", failure: "No progress this interval - reposition or find a new route" },
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

// =============================================================================
// N SIDES, NOT TWO - a contest is a field, and two is just the small case
// -----------------------------------------------------------------------------
// Everything here used to be `a` and `b`: `aNet`/`bNet`, `winner: "a"|"b"`. Two
// men wrestling is one shape a contest takes, and three thieves reaching for the
// same purse is another - the rules are identical and only the arithmetic was
// hard-coded. So the primitive is a FIELD of entrants and the two-sided call is
// the case where the field has two.
//
// CONTESTED: the highest net takes it; several at the top is a draw between
// them (and everyone else still has a rank, which is what a race needs).
// RESISTED: the FIRST entrant is the actor and the rest resist him - he must
// beat the BEST of them, because "resisted" means somebody stopped you and it
// only takes one. A botch counts as zero and is said out loud.
// =============================================================================
export interface ContestEntrant { name: string; exec: RollExecution }
export interface ContestStanding { name: string; net: number; botch: boolean; rank: number }
export interface FieldOutcome {
  mode: ContestMode;
  standings: ContestStanding[];       // best first; equal nets share a rank
  winners: string[];                  // empty = nobody; several = a tie at the top
  margin: number;                     // the winner's lead over the next rank (0 if tied)
  note: string;
}

// The net a side actually scored: a botch is zero, never negative.
function netOf(exec: RollExecution): { net: number; botch: boolean } {
  const botch = exec.outcome === "botch";
  return { net: botch ? 0 : Math.max(0, exec.result?.net ?? 0), botch };
}

export function compareField(mode: ContestMode, entrants: ContestEntrant[]): FieldOutcome {
  const scored = entrants.map(e => ({ name: e.name, ...netOf(e.exec) }));
  const label = (n: string): string => StringUtil.toTitleCase(n);

  if (mode === "resisted") {
    // The actor against the best of everyone stopping him.
    const [actor, ...resisters] = scored;
    const standings: ContestStanding[] = [{ ...actor, rank: 1 }, ...resisters.map(r => ({ ...r, rank: 2 }))];
    const base = { mode, standings, winners: [] as string[], margin: 0 };
    if (!actor) return { ...base, note: "nobody acted" };
    if (actor.botch) return { ...base, note: "the actor botches" };
    const best = resisters.reduce((m, r) => Math.max(m, r.net), 0);
    const margin = actor.net - best;
    if (margin > 0) {
      const botched = resisters.filter(r => r.botch).map(r => label(r.name));
      return { ...base, winners: [actor.name], margin,
        note: `prevails by ${margin}${resisters.length > 1 ? ` over ${resisters.length} resisting` : ""}`
          + `${botched.length ? ` (${botched.join(", ")} botched)` : ""}` };
    }
    return { ...base, note: `the action is resisted${resisters.length > 1 ? ` (best of ${resisters.length})` : ""}` };
  }

  // Contested: rank the field. Equal nets share a rank, so a three-way tie at
  // the top is three winners and the next man is fourth.
  const order = [...scored].sort((x, y) => y.net - x.net);
  const standings: ContestStanding[] = [];
  let rank = 0, seen = 0, lastNet = Number.NaN;
  for (const one of order) {
    seen += 1;
    if (one.net !== lastNet) { rank = seen; lastNet = one.net; }
    standings.push({ ...one, rank });
  }
  if (!standings.length) return { mode, standings, winners: [], margin: 0, note: "nobody rolled" };
  if (standings.every(s => s.botch)) {
    return { mode, standings, winners: [], margin: 0, note: "everyone botches - mutual disaster" };
  }
  const top = standings.filter(s => s.rank === 1);
  const runnerUp = standings.find(s => s.rank !== 1);
  const botched = standings.filter(s => s.botch).map(s => label(s.name));
  const botchNote = botched.length ? ` (${botched.join(", ")} botched)` : "";
  if (top.length > 1) {
    return { mode, standings, winners: top.map(t => t.name), margin: 0,
      note: `tie at ${top[0].net} between ${top.map(t => label(t.name)).join(" and ")}${botchNote}` };
  }
  const margin = top[0].net - (runnerUp?.net ?? 0);
  return { mode, standings, winners: [top[0].name], margin,
    note: `${label(top[0].name)} wins by ${margin}${standings.length > 2 ? ` over ${standings.length - 1} others` : ""}${botchNote}` };
}

// How a field's standings read in a reply: "Erik 4, Rok 2, Sigrid 0 (botch)".
export function describeStandings(o: FieldOutcome): string {
  return o.standings
    .map(s => `${StringUtil.toTitleCase(s.name)} ${s.net}${s.botch ? " (botch)" : ""}`)
    .join(", ");
}

// --- THE TWO-SIDED CASE ------------------------------------------------------
// Kept because most contests ARE two-sided and every caller reads a/b. It is
// compareField with a field of two, so there is one adjudication and not two.
export interface ContestOutcome {
  mode: ContestMode;
  aNet: number; bNet: number;       // successes counted for each side (botch -> 0)
  aBotch: boolean; bBotch: boolean;
  winner: "a" | "b" | "none";
  margin: number;                   // the winner's lead (0 when none)
  note: string;
  field: FieldOutcome;              // the general answer, for a caller that wants it
}

export function compareRolls(mode: ContestMode, a: RollExecution, b: RollExecution): ContestOutcome {
  const field = compareField(mode, [{ name: "a", exec: a }, { name: "b", exec: b }]);
  const A = netOf(a), B = netOf(b);
  const base = { mode, aNet: A.net, bNet: B.net, aBotch: A.botch, bBotch: B.botch, field };
  // The two-sided wording is older than the field and several tests read it, so
  // the special cases keep their exact phrasing.
  if (A.botch && B.botch) return { ...base, winner: "none", margin: 0, note: "both sides botch - mutual disaster" };
  if (mode === "resisted") {
    if (A.botch) return { ...base, winner: "none", margin: 0, note: "the actor botches" };
    const margin = A.net - B.net;
    if (margin > 0) return { ...base, winner: "a", margin, note: `prevails by ${margin}${B.botch ? " (resister botched)" : ""}` };
    return { ...base, winner: "none", margin: 0, note: "the action is resisted" };
  }
  if (A.net > B.net) return { ...base, winner: "a", margin: A.net - B.net, note: `wins by ${A.net - B.net}${B.botch ? " (opponent botched)" : ""}` };
  if (B.net > A.net) return { ...base, winner: "b", margin: B.net - A.net, note: `loses by ${B.net - A.net}${A.botch ? " (own botch)" : ""}` };
  return { ...base, winner: "none", margin: 0, note: "tie" };
}

// =============================================================================
// EXTENDED CONTESTS - both sides accumulate; first to the goal wins
// =============================================================================
// `char` is an opaque game-layer key (a character name, or undefined for an
// ad-hoc side); rolls.ts never reads it - the interpreter uses it to re-resolve
// this side's pool each round.
export interface ContestSide { name: string; base: RollSpec; accumulated: number; char?: string; }
// "open" while it runs, "draw" when nobody got there first or the rounds ran
// out, otherwise the NAME of the winner. A name rather than "a"/"b" because
// there may be five of them.
export type ContestStatus = string;
export const CONTEST_OPEN = "open";
export const CONTEST_DRAW = "draw";

export interface ExtendedContest {
  id: string;
  label: string;
  sides: ContestSide[];             // TWO OR MORE. Index 0 is the actor.
  target: number;
  maxRounds: number;
  interval: string;                 // advisory spacing, like extended rolls
  onBotch: BotchPolicy;             // per side: fail -> that side loses outright
  rounds: number;
  status: ContestStatus;
  log: { round: number; nets: Record<string, number>; note: string }[];
}

// A contest saved before contests could have more than two sides kept `a` and
// `b`. Read it as a field of two; after one round it is stored the new way.
export function migrateContest(raw: ExtendedContest & { a?: ContestSide; b?: ContestSide }): ExtendedContest {
  if (raw.sides?.length) return raw;
  const sides = [raw.a, raw.b].filter((x): x is ContestSide => x !== undefined);
  const status = raw.status === "a" ? sides[0]?.name : raw.status === "b" ? sides[1]?.name : raw.status;
  return { ...raw, sides, status: status ?? CONTEST_OPEN, log: raw.log ?? [] };
}

// One round: every side has rolled; accumulate and settle. Pure. `execs` is
// parallel to `contest.sides`.
export function applyContestRound(c: ExtendedContest, execs: RollExecution[]): { contest: ExtendedContest; note: string } {
  const next: ExtendedContest = { ...c, sides: c.sides.map(s => ({ ...s })), log: [...c.log] };
  next.rounds += 1;
  const label = (n: string): string => StringUtil.toTitleCase(n);
  const scored = c.sides.map((side, i) => {
    const exec = execs[i];
    const botch = exec?.outcome === "botch";
    return { side, botch, net: botch ? 0 : Math.max(0, exec?.result?.net ?? 0) };
  });
  const nets: Record<string, number> = {};
  for (const s of scored) nets[s.side.name] = s.net;
  const botchers = scored.filter(s => s.botch);
  let note: string;

  if (botchers.length) {
    if (c.onBotch === "fail") {
      // A botch puts you out. Whoever is left takes it - unless nobody is.
      const standing = scored.filter(s => !s.botch);
      if (standing.length === 0) { next.status = CONTEST_DRAW; note = "everyone botches - the contest collapses"; }
      else if (standing.length === 1) {
        next.status = standing[0].side.name;
        note = `${botchers.map(b => label(b.side.name)).join(", ")} botch${botchers.length === 1 ? "es" : ""} - ${label(standing[0].side.name)} wins outright`;
      } else {
        // More than one left: the botchers are out, the rest carry on. This is
        // the case two sides could never reach.
        next.sides = next.sides.filter(s => !botchers.some(b => b.side.name === s.name));
        note = `${botchers.map(b => label(b.side.name)).join(", ")} botch out - ${next.sides.length} still in`;
      }
      if (next.status !== CONTEST_OPEN) {
        next.log.push({ round: next.rounds, nets, note });
        return { contest: next, note };
      }
    } else if (c.onBotch === "lose-successes") {
      for (const b of botchers) {
        const side = next.sides.find(s => s.name === b.side.name);
        if (side) side.accumulated = 0;
      }
      note = "botch - progress lost";
    } else note = "botch - a wasted round";
  } else note = "";

  for (const s of scored) {
    const side = next.sides.find(x => x.name === s.side.name);
    if (side) side.accumulated += s.net;
  }
  // Whoever crossed the line this round; if several did, the highest total took
  // it, and a dead heat stays OPEN because nobody got there first.
  const done = next.sides.filter(s => s.accumulated >= c.target);
  if (done.length) {
    const best = Math.max(...done.map(s => s.accumulated));
    const leaders = done.filter(s => s.accumulated === best);
    if (leaders.length === 1) next.status = leaders[0].name;
  }
  if (next.status === CONTEST_OPEN && next.rounds >= c.maxRounds) next.status = CONTEST_DRAW;
  const progress = next.sides.map(s => `${label(s.name)} ${s.accumulated}/${c.target}`).join(" vs ");
  note = note ? `${note}; ${progress}` : progress;
  next.log.push({ round: next.rounds, nets, note });
  return { contest: next, note };
}

export function describeContest(c: ExtendedContest): string {
  const head = c.label ? `"${c.label}" ` : "";
  const state = c.status === CONTEST_OPEN ? "open"
    : c.status === CONTEST_DRAW ? "draw"
      : `${StringUtil.toTitleCase(c.status)} WINS`;
  const bits = [
    c.sides.map(s => `${StringUtil.toTitleCase(s.name)} ${s.accumulated}/${c.target}`).join(" vs "),
    `round ${c.rounds}/${c.maxRounds}`,
  ];
  if (c.interval) bits.push(`interval ${c.interval}`);
  bits.push(state);
  return `${head}${bits.join(", ")}`;
}
