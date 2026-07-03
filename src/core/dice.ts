import { StringUtil } from "./traits";

// =============================================================================
// DICE - auditable Storyteller (World of Darkness) dice roller
// =============================================================================

// Random integer in [min, max]. Uses Math.random by default; an injectable Rng
// (returning a float in [0,1)) keeps rolls deterministic under test.
export type Rng = () => number;
const __defaultRng: Rng = () => Math.random();
export function Random(min: number, max: number, rng: Rng = __defaultRng): number {
  if (max < min) { const t = min; min = max; max = t; }
  return min + Math.floor(rng() * (max - min + 1));
}

export interface RollTrait { name: string; value: number; }
export interface RollOptions {
  difficulty?: number;        // default 6
  nAgain?: number;            // default 10 (10-again). 11 disables, 9 explodes 9s & 10s.
  automaticSuccesses?: number; // free successes (e.g. Potence, a spent Willpower)
  rng?: Rng;
  label?: string;             // header label when rolling a raw pool
}
export interface RollDie {
  face: number;
  symbol: string;        // bomb / explode / hit / miss
  isSuccess: boolean;
  isOne: boolean;
  explodes: boolean;
  fromExplosion: boolean;
}
export type RollOutcome = "botch" | "failure" | "success";
export interface RollResult {
  traits: RollTrait[];
  pool: number;
  difficulty: number;
  nAgain: number;
  dice: RollDie[];
  successes: number;          // dice meeting difficulty (incl. explosions)
  automaticSuccesses: number; // free successes added to the tally
  ones: number;               // dice showing a 1 (incl. explosions)
  net: number;                // successes + automaticSuccesses - ones
  isBotch: boolean;
  outcome: RollOutcome;
  message: string;
}

const DIE_BOMB = "\u{1F4A3}";    // bomb -> a rolled 1
const DIE_EXPLODE = "\u{1F4A5}"; // collision -> a die that explodes (n-again)
const DIE_HIT = "✅";        // check -> a success
const DIE_MISS = "❌";       // cross -> a failure
const MAX_DICE = 200;            // safety valve against pathological explosion chains

export class Dice {
  // Accepts either a raw pool size or a list of named traits (one or two are
  // typical, but any number is summed). Returns a fully auditable result.
  static roll(input: number | RollTrait[], options: RollOptions = {}): RollResult {
    const difficulty = options.difficulty ?? 6;
    const nAgain = Math.max(2, options.nAgain ?? 10); // never explode on faces < 2
    const automaticSuccesses = Math.max(0, options.automaticSuccesses ?? 0);
    const rng = options.rng ?? __defaultRng;

    const traits: RollTrait[] = typeof input === "number"
      ? [{ name: options.label ?? "Pool", value: input }]
      : input;
    const pool = Math.max(0, traits.reduce((s, t) => s + Math.max(0, t.value), 0));

    const dice: RollDie[] = [];
    let pending = pool;   // remaining dice from the initial pool
    let extra = 0;        // dice queued by explosions
    let rolled = 0;

    const rollOne = (fromExplosion: boolean): void => {
      const face = Random(1, 10, rng);
      const isOne = face === 1;
      const isSuccess = face >= difficulty;
      const explodes = face >= nAgain;
      let symbol = DIE_MISS;
      if (isOne) symbol = DIE_BOMB;
      else if (explodes) symbol = DIE_EXPLODE;
      else if (isSuccess) symbol = DIE_HIT;
      dice.push({ face, symbol, isSuccess, isOne, explodes, fromExplosion });
      if (explodes) extra++;
    };

    while ((pending > 0 || extra > 0) && rolled < MAX_DICE) {
      if (pending > 0) { pending--; rollOne(false); }
      else { extra--; rollOne(true); }
      rolled++;
    }

    const successes = dice.filter(d => d.isSuccess).length;
    const ones = dice.filter(d => d.isOne).length;
    const net = successes + automaticSuccesses - ones;

    // A botch is judged on the INITIAL roll only: zero successes and >= 1 one.
    // (A cancelled success is a failure, not a botch; a free success also averts it.)
    const initial = dice.filter(d => !d.fromExplosion);
    const initialSuccesses = initial.filter(d => d.isSuccess).length;
    const initialOnes = initial.filter(d => d.isOne).length;
    const isBotch = initialSuccesses === 0 && automaticSuccesses === 0 && initialOnes >= 1;

    const outcome: RollOutcome = isBotch ? "botch" : (net > 0 ? "success" : "failure");

    const autoText = automaticSuccesses > 0 ? ` +${automaticSuccesses} auto` : "";
    const header = traits.map(t => `${StringUtil.toTitleCase(t.name)} (${t.value})`).join(" + ") + autoText;
    const faces = dice.map(d => `${d.symbol}${d.face}`).join(" ");
    let resultLine: string;
    if (isBotch) resultLine = `${DIE_BOMB} BOTCH!`;
    else if (net > 0) resultLine = `${DIE_HIT} ${net} success${net === 1 ? "" : "es"}`;
    else resultLine = `${DIE_MISS} Failure`;
    const message = `${header} vs diff ${difficulty} [${faces}] -> ${resultLine}`;

    return { traits, pool, difficulty, nAgain, dice, successes, automaticSuccesses, ones, net, isBotch, outcome, message };
  }
}
