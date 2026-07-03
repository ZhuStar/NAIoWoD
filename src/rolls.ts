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

export function resolveSpec(spec: RollSpec, resolve: TraitResolver, opts: { overDifficulty?: OverDifficultyPolicy } = {}): ResolvedRoll {
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
  opts: { rng?: Rng; overDifficulty?: OverDifficultyPolicy } = {}
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
