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
  difficulty: number;     // base target number (default 6)
  difficultyMod: number;  // +/- applied to difficulty (default 0)
  requires: number;       // successes needed to count as a success (default 1)
  diceMod: number;        // +/- dice added to the resolved pool (default 0)
  tags: string[];         // contextual mechanic keys (normalized)
}

// Fill defaults and normalize tags. `requires` is at least 1.
export function makeRollSpec(parts: Partial<RollSpec> & { pool: string }): RollSpec {
  return {
    pool: parts.pool,
    difficulty: parts.difficulty ?? DEFAULT_DIFFICULTY,
    difficultyMod: parts.difficultyMod ?? 0,
    requires: Math.max(1, parts.requires ?? 1),
    diceMod: parts.diceMod ?? 0,
    tags: (parts.tags ?? []).map(t => StringUtil.normalize(t)).filter(t => t.length > 0),
  };
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
  let difficulty = spec.difficulty + spec.difficultyMod;
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
  if (overrides.difficulty !== undefined) merged.difficulty = overrides.difficulty;
  if (overrides.difficultyMod !== undefined) merged.difficultyMod = overrides.difficultyMod;
  if (overrides.requires !== undefined) merged.requires = Math.max(1, overrides.requires);
  if (overrides.diceMod !== undefined) merged.diceMod = overrides.diceMod;
  if (overrides.tags !== undefined) merged.tags = overrides.tags.map(t => StringUtil.normalize(t)).filter(t => t.length > 0);
  return merged;
}

// A short one-line summary of a spec, for save/list confirmations.
export function describeSpec(spec: RollSpec): string {
  const mod = spec.difficultyMod ? (spec.difficultyMod > 0 ? `+${spec.difficultyMod}` : `${spec.difficultyMod}`) : "";
  const parts = [spec.pool, `diff ${spec.difficulty}${mod}`];
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
