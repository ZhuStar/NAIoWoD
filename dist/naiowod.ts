// NAIoWoD - World of Darkness (Dark Ages) engine for NovelAI scripting.
// GENERATED - do not edit by hand. This is src/* concatenated in dependency
// order with inter-module import/export wiring removed; every declaration
// keeps its original source. Edit the modules under src/, then `bun run build`.
// test/build.test.ts fails if this file drifts from src/.
//
// This is the RELEASE artifact. It defines NO NovelAI types and no `api`:
// the host injects the global `api` and all its types at runtime. The type
// declarations are NovelAI's own, vendored at types/novelai/script-types.d.ts
// (the off-host mock in src/host-mock.ts is NOT included here).
//
// Paste this TypeScript into NovelAI's script editor as-is - no header needed.
//
// Order: host -> core/traits -> core/dice -> core/damage -> core/time ->
//        wizard -> rolls -> rules -> command -> services -> state ->
//        game -> window -> init (index.ts) -> bootstrap (main.ts)

//#region src/host.ts
// =============================================================================
// HOST - release-safe glue over the NovelAI scripting API.
// -----------------------------------------------------------------------------
// The API's TYPES are NOT declared here. They are ambient, vendored from
// NovelAI at `types/novelai/script-types.d.ts` (the single source of truth):
// `api` (the global namespace), `UIPart`, `WindowOptions`, `ModalOptions`,
// `LorebookEntry`, `LorebookCondition`, `OnTextAdventureInput`, etc. are all
// global there, so no file in src/ redefines them - and the single-file
// release (dist/naiowod.ts) carries zero NovelAI type definitions. At runtime
// inside NovelAI the host injects the global `api`; off-host (tests, local
// e2e) `src/host-mock.ts` installs an in-memory `globalThis.api` - but that
// mock is NOT part of the release build.
//
// This module holds only what the RELEASE needs: the project logger and two
// aliases over ambient types (our own names, not NovelAI redefinitions).
// =============================================================================

// The part-builder bundle (`api.v1.ui.part`), named for window.ts params.
type UiPartHelpers = typeof api.v1.ui.part;

// The handle returned by opening a window/modal, named where an annotation helps.
type UIHandle = Awaited<ReturnType<typeof api.v1.ui.window.open>>;

// Project-wide logger: routes through the host's logger (console.log off-host).
function log(...args: unknown[]): void { api.v1.log(...args); }
//#endregion src/host.ts

//#region src/core/traits.ts
// =============================================================================
// CORE / TRAITS - names, categories, rated stats, trackers, pools, morality
// -----------------------------------------------------------------------------
// Pure mechanics: no imports from the host layer.
// =============================================================================

class StringUtil {
  static normalize(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, '-');
  }

  // The BOUNDARY normalizer: every string entering the engine (command tokens,
  // lorebook list items) passes through this once, so "Alice and Bob",
  // "alice and bob" and "ALIcE and BoB" are all the same internal string:
  // "alice-and-bob". Rules, in order:
  //   1. lowercase + trim;
  //   2. spaces immediately after `@` are removed ("@ sire" -> "@sire");
  //   3. spaces around `::` are removed and `::` collapses to `:` - the path
  //      separator you can type with spaces ("blood :: heal" -> "blood:heal");
  //      a single `:` passes through untouched;
  //   4. spaces adjacent to `,` and `+` are removed (list/pool separators -
  //      "a, b" -> "a,b", "str + brawl" -> "str+brawl");
  //   5. any remaining whitespace run becomes a single `-`.
  // Idempotent: normalizing a normalized string is a no-op. Backtick literals
  // are the escape hatch - the parser skips this for them.
  static normalizeInput(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/@\s+/g, '@')
      .replace(/\s*::\s*/g, ':')
      .replace(/\s*([,+])\s*/g, '$1')
      .replace(/\s+/g, '-');
  }

  // "blood-potency" / "self_control" -> "Blood Potency" / "Self Control"
  static toTitleCase(str: string): string {
    return str
      .replace(/[-_]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}

type CategoryType =
  | "physical" | "social" | "mental"
  | "talent" | "skill" | "knowledge"
  | "background" | "tracker" | "virtue" | "morality" | "vital" | "discipline";
class Category {
  static readonly PHYSICAL = new Category("physical");
  static readonly SOCIAL = new Category("social");
  static readonly MENTAL = new Category("mental");
  static readonly TALENT = new Category("talent");
  static readonly SKILL = new Category("skill");
  static readonly KNOWLEDGE = new Category("knowledge");
  static readonly BACKGROUND = new Category("background");
  static readonly TRACKER = new Category("tracker");
  static readonly VIRTUE = new Category("virtue");
  static readonly MORALITY = new Category("morality");
  static readonly VITAL = new Category("vital");
  static readonly DISCIPLINE = new Category("discipline");

  public readonly Name: string;
  private constructor(name: CategoryType) {
    this.Name = name;
    Object.freeze(this);
  }
}

type PointSourceType = "base" | "freebie" | "experience" | "downtime";
class PointSource {
  static readonly BASE = new PointSource("base");
  static readonly FREEBIE = new PointSource("freebie");
  static readonly EXPERIENCE = new PointSource("experience");
  static readonly DOWNTIME = new PointSource("downtime");

  public readonly Name: string;
  private constructor(name: PointSourceType) {
    this.Name = name;
    Object.freeze(this);
  }
}

// --- STATS, MODIFIERS & TRACKERS ---
class LedgerEntry {
  constructor(
    public readonly Source: PointSource,
    public readonly AmountAdded: number,
    public readonly CostIncurred: number
  ) { Object.freeze(this); }
}

class StatModifier {
  constructor(
    public readonly Amount: number,
    public readonly IsPermanent: boolean,
    public readonly IgnoresCap: boolean,
    public readonly Description: string
  ) { Object.freeze(this); }
}

class Stat {
  protected readonly _name: string;
  protected readonly _category: Category;
  protected readonly _isImmutable: boolean;
  protected _creationCap: number;
  protected _absoluteCap: number;
  protected readonly _ledger: LedgerEntry[] = [];
  protected _modifiers: StatModifier[] = [];

  constructor(name: string, category: Category, baseValue: number, creationCap: number = 5, absoluteCap: number = 5, isImmutable: boolean = false) {
    this._name = StringUtil.normalize(name);
    this._category = category;
    this._creationCap = creationCap;
    this._absoluteCap = absoluteCap;
    this._isImmutable = isImmutable;

    if (baseValue > 0) this._ledger.push(new LedgerEntry(PointSource.BASE, baseValue, 0));
  }

  get Name(): string { return this._name; }
  get Category(): Category { return this._category; }

  // The actual dots bought on the sheet
  get Value(): number { return this._ledger.reduce((sum, entry) => sum + entry.AmountAdded, 0); }

  // The pool used for rolling (Value + Buffs - Debuffs)
  get EffectiveValue(): number {
    let eff = this.Value;
    let bypassesCap = false;

    for (const mod of this._modifiers) {
      eff += mod.Amount;
      if (mod.IgnoresCap) bypassesCap = true;
    }

    if (!bypassesCap && eff > this._absoluteCap) return this._absoluteCap;
    if (eff < 0) return 0;
    return eff;
  }

  get AuditLog(): LedgerEntry[] { return [...this._ledger]; }

  Allocate(source: PointSource, amount: number, cost: number = 0, bypassCaps: boolean = false): void {
    if (this._isImmutable) throw new Error(`Cannot modify immutable stat: ${this._name}`);

    const isCreationPhase = (source === PointSource.BASE || source === PointSource.FREEBIE);
    const activeCap = isCreationPhase ? this._creationCap : this._absoluteCap;

    if (!bypassCaps && this.Value + amount > activeCap) {
      throw new Error(`Stat ${this._name} cannot exceed cap of ${activeCap} via ${source.Name}.`);
    }
    this._ledger.push(new LedgerEntry(source, amount, cost));
  }

  AddModifier(mod: StatModifier) { this._modifiers.push(mod); }
  RemoveModifierByDesc(desc: string) {
    this._modifiers = this._modifiers.filter(m => m.Description !== desc);
  }
}

// Extends Stat to handle temporary spendable points (Willpower, Resolve, ...)
class Tracker extends Stat {
  private _tempValue: number;

  constructor(name: string, category: Category, baseValue: number, creationCap: number = 10, absoluteCap: number = 10) {
    super(name, category, baseValue, creationCap, absoluteCap);
    this._tempValue = baseValue;
  }

  get Temporary(): number { return this._tempValue; }

  // Sync temporary points when permanent rating increases
  override Allocate(source: PointSource, amount: number, cost: number = 0, bypassCaps: boolean = false): void {
    super.Allocate(source, amount, cost, bypassCaps);
    this._tempValue += amount;
  }

  Spend(amount: number) {
    if (amount < 0) throw new Error("Cannot spend a negative amount.");
    if (this._tempValue < amount) throw new Error(`Not enough temporary ${this._name} to spend.`);
    this._tempValue -= amount;
  }

  Regain(amount: number, canExceedPermanent: boolean = false) {
    if (amount < 0) throw new Error("Cannot regain a negative amount.");
    this._tempValue += amount;
    if (!canExceedPermanent && this._tempValue > this.Value) {
      this._tempValue = this.Value;
    }
  }
}

// =============================================================================
// RESOURCE POOLS - Blood, Quintessence, Paradox, ... (free-floating counters)
// =============================================================================
class Pool {
  private _current: number;
  private _max: number;
  private readonly _name: string;
  private readonly _perTurn: number;
  private readonly _log: Array<{ delta: number; reason: string }> = [];

  constructor(name: string, max: number, start?: number, perTurnLimit: number = Infinity) {
    this._name = StringUtil.normalize(name);
    this._max = max;
    this._perTurn = perTurnLimit;
    this._current = Math.max(0, Math.min(start ?? max, max));
  }

  get Name(): string { return this._name; }
  get Current(): number { return this._current; }
  get Max(): number { return this._max; }
  get PerTurnLimit(): number { return this._perTurn; }
  get AuditLog(): Array<{ delta: number; reason: string }> { return [...this._log]; }

  // Resize the pool (e.g. a vampire lowering generation via diablerie).
  SetMax(max: number, keepRatio: boolean = false): void {
    if (max < 0) throw new Error("Pool max cannot be negative.");
    if (keepRatio && this._max > 0) this._current = Math.round((this._current / this._max) * max);
    this._max = max;
    if (this._current > max) this._current = max;
  }

  Spend(amount: number, reason: string = ""): void {
    if (amount < 0) throw new Error("Cannot spend a negative amount.");
    if (amount > this._perTurn) throw new Error(`Cannot spend more than ${this._perTurn} ${this._name} per turn.`);
    if (amount > this._current) throw new Error(`Not enough ${this._name}: have ${this._current}, need ${amount}.`);
    this._current -= amount;
    this._log.push({ delta: -amount, reason });
  }

  Gain(amount: number, reason: string = ""): number {
    if (amount < 0) throw new Error("Cannot gain a negative amount.");
    const before = this._current;
    this._current = Math.min(this._max, this._current + amount);
    const gained = this._current - before;
    this._log.push({ delta: gained, reason });
    return gained;
  }

  Refill(): void { this._current = this._max; }
}

type MoralityPolarity = "descending" | "ascending";

// A morality rating (a Road/Humanity, or Torment). "descending" traits worsen
// toward 0 (Humanity 0 = lost to the Beast); "ascending" traits worsen toward
// the max (Torment 10 = unplayable). Degenerate() always moves toward the bad
// extreme; Improve() toward the good one.
class MoralityTrait {
  private _value: number;
  private readonly _max: number;
  private readonly _min: number;
  private readonly _unplayableAt: number;
  public readonly Polarity: MoralityPolarity;
  private readonly _log: Array<{ delta: number; reason: string; value: number }> = [];

  constructor(
    public readonly RoadName: string,
    value: number,
    opts: { max?: number; min?: number; polarity?: MoralityPolarity; unplayableAt?: number } = {}
  ) {
    this._max = opts.max ?? 10;
    this._min = opts.min ?? 0;
    this.Polarity = opts.polarity ?? "descending";
    this._unplayableAt = opts.unplayableAt ?? (this.Polarity === "descending" ? this._min : this._max);
    this._value = Math.max(this._min, Math.min(value, this._max));
  }

  get Value(): number { return this._value; }
  get Max(): number { return this._max; }
  get Min(): number { return this._min; }
  get Category(): Category { return Category.MORALITY; }
  get AuditLog(): Array<{ delta: number; reason: string; value: number }> { return [...this._log]; }

  // True once the rating has reached its unplayable extreme.
  get IsUnplayable(): boolean {
    return this.Polarity === "descending" ? this._value <= this._unplayableAt : this._value >= this._unplayableAt;
  }

  // Worsen: a sin / failed Virtue roll moves the rating toward its bad extreme.
  Degenerate(amount: number = 1, reason: string = "degeneration"): void {
    this._change((this.Polarity === "descending" ? -1 : 1) * Math.abs(amount), reason);
  }
  // Improve: penance / redemption moves the rating toward its good extreme.
  Improve(amount: number = 1, reason: string = "penance"): void {
    this._change((this.Polarity === "descending" ? 1 : -1) * Math.abs(amount), reason);
  }

  private _change(delta: number, reason: string): void {
    const next = Math.max(this._min, Math.min(this._value + delta, this._max));
    const applied = next - this._value;
    this._value = next;
    this._log.push({ delta: applied, reason, value: this._value });
  }
}
//#endregion src/core/traits.ts

//#region src/core/dice.ts
// =============================================================================
// DICE - auditable Storyteller (World of Darkness) dice roller
// =============================================================================

// Random integer in [min, max]. Uses Math.random by default; an injectable Rng
// (returning a float in [0,1)) keeps rolls deterministic under test.
type Rng = () => number;
const __defaultRng: Rng = () => Math.random();
function Random(min: number, max: number, rng: Rng = __defaultRng): number {
  if (max < min) { const t = min; min = max; max = t; }
  return min + Math.floor(rng() * (max - min + 1));
}

interface RollTrait { name: string; value: number; }
interface RollOptions {
  difficulty?: number;        // default 6
  nAgain?: number;            // default 10 (10-again). 11 disables, 9 explodes 9s & 10s.
  automaticSuccesses?: number; // free successes (e.g. Potence, a spent Willpower)
  rng?: Rng;
  label?: string;             // header label when rolling a raw pool
}
interface RollDie {
  face: number;
  symbol: string;        // bomb / explode / hit / miss
  isSuccess: boolean;
  isOne: boolean;
  explodes: boolean;
  fromExplosion: boolean;
}
type RollOutcome = "botch" | "failure" | "success";
interface RollResult {
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

class Dice {
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
//#endregion src/core/dice.ts

//#region src/core/damage.ts
// =============================================================================
// DAMAGE - severity, kind, intensity, source, and self-describing packets
// -----------------------------------------------------------------------------
// A hit is a DamagePacket. Four *independent* facts describe it:
//
//   * Severity  - bashing / lethal / aggravated: how hard it is to soak & heal.
//   * Intensity - the plain *number* of health levels the hit threatens.
//   * Kind(s)   - open-ended descriptors, in the spirit of D&D's energy/damage
//                 types: "piercing", "slashing", "silver", "fire", "sunlight"...
//                 A packet may carry several (a silver bullet is piercing+silver).
//   * Source    - where it came from ("gunshot", "claw", "fangs", "fall"); kept
//                 for flavour and future rules that key off the attack itself.
//
// Crucially, SEVERITY IS NOT INTRINSIC TO THE ATTACK. One gunshot (piercing,
// lethal) is lethal to a mortal, only *bashing* to a vampire (no organs to
// destroy, no blood to lose) and shrugged off entirely by a werewolf - unless
// the round is *silver*, which no amount of regeneration will soak. The target,
// not the weapon, has the final say: every character runs an incoming packet
// through its own DamageReactions - rewriting or ignoring parts of it - *before*
// it soaks and marks its health track.
// =============================================================================

// --- SEVERITY (the bashing / lethal / aggravated axis) ---
type SeverityName = "harmless" | "bashing" | "lethal" | "aggravated" | "fatal";
class Severity {
  static readonly HARMLESS = new Severity("harmless", 0)
  static readonly BASHING = new Severity("bashing", 1);
  static readonly LETHAL = new Severity("lethal", 2);
  static readonly AGGRAVATED = new Severity("aggravated", 3);
  static readonly FATAL = new Severity("fatal", 4);
  
  // Rank orders the three so the health track's wrap-around upgrade rule works
  // and reactions can ask for "at least this bad".
  private constructor(public readonly Name: SeverityName, public readonly Rank: number) { Object.freeze(this); }

  static fromName(name: SeverityName): Severity {
    switch (name) {
      case "bashing": return Severity.BASHING;
      case "lethal": return Severity.LETHAL;
      case "aggravated": return Severity.AGGRAVATED;
      case "harmless": return Severity.HARMLESS;
      case "fatal": return Severity.FATAL;
      default: throw new Error(`Unknown severity: ${name}`);
    }
  }
  static coerce(s: Severity | SeverityName): Severity {
    return typeof s === "string" ? Severity.fromName(s) : s;
  }

  // Ascending order; index === Rank.
  static readonly ORDER: readonly Severity[] = [
    Severity.HARMLESS, Severity.BASHING, Severity.LETHAL, Severity.AGGRAVATED, Severity.FATAL,
  ];
  // The singleton at a rank, clamped to [HARMLESS, FATAL].
  static atRank(rank: number): Severity {
    return Severity.ORDER[Math.max(0, Math.min(Severity.ORDER.length - 1, Math.round(rank)))];
  }

  IsAtLeast(other: Severity): boolean { return this.Rank >= other.Rank; }
  // The worse (higher-ranked) of two severities.
  Max(other: Severity): Severity { return this.Rank >= other.Rank ? this : other; }
  // Assume the value of the neighbouring singleton, clamped.
  Promote(steps: number = 1): Severity { return Severity.atRank(this.Rank + steps); }
  Demote(steps: number = 1): Severity { return Severity.atRank(this.Rank - steps); }
}

// --- KIND & SOURCE (open descriptor sets; any normalized string is valid) ---
type DamageKind = string;
type DamageSource = string;

// Common descriptors, surfaced as constants purely for discoverability and to
// dodge typos. The type is still `string`, so homebrew kinds need no ceremony.
const Kind = {
  BLUDGEONING: "bludgeoning", PIERCING: "piercing", SLASHING: "slashing",
  SILVER: "silver", COLD_IRON: "cold-iron", FIRE: "fire", SUNLIGHT: "sunlight",
  COLD: "cold", ELECTRICITY: "electricity", POISON: "poison", ACID: "acid",
} as const;
const Source = {
  GUNSHOT: "gunshot", BLADE: "blade", FIST: "fist", CLAW: "claw", FANGS: "fangs",
  FALL: "fall", FIRE: "fire", SUNLIGHT: "sunlight",
} as const;

interface DamagePacketInit {
  intensity: number;
  severity: Severity | SeverityName;
  kinds?: Iterable<DamageKind>;
  source?: DamageSource | null;
  // Whether this packet may be soaked at all. Reactions can force `false`
  // (e.g. silver against a werewolf) to punch straight through a soak that
  // would otherwise apply.
  soakable?: boolean;
}

// An immutable description of one incoming hit. Every mutator returns a *copy*,
// so a reaction pipeline can rewrite a packet without disturbing the original.
class DamagePacket {
  public readonly Intensity: number;
  public readonly Severity: Severity;
  public readonly Kinds: ReadonlySet<DamageKind>;
  public readonly Source: DamageSource | null;
  public readonly Soakable: boolean;

  constructor(init: DamagePacketInit) {
    this.Intensity = Math.max(0, Math.floor(init.intensity));
    this.Severity = Severity.coerce(init.severity);
    const kinds = new Set<DamageKind>();
    for (const k of init.kinds ?? []) {
      const n = StringUtil.normalize(k);
      if (n) kinds.add(n);
    }
    this.Kinds = kinds;
    this.Source = init.source ? StringUtil.normalize(init.source) : null;
    this.Soakable = init.soakable ?? true;
    Object.freeze(this);
  }

  static of(init: DamagePacketInit): DamagePacket { return new DamagePacket(init); }

  HasKind(kind: DamageKind): boolean { return this.Kinds.has(StringUtil.normalize(kind)); }
  HasAnyKind(...kinds: DamageKind[]): boolean { return kinds.some(k => this.HasKind(k)); }

  private _init(): DamagePacketInit {
    return {
      intensity: this.Intensity, severity: this.Severity,
      kinds: this.Kinds, source: this.Source, soakable: this.Soakable,
    };
  }
  With(patch: Partial<DamagePacketInit>): DamagePacket { return new DamagePacket({ ...this._init(), ...patch }); }
  WithSeverity(sev: Severity | SeverityName): DamagePacket { return this.With({ severity: sev }); }
  WithIntensity(n: number): DamagePacket { return this.With({ intensity: n }); }
  AddKind(kind: DamageKind): DamagePacket { return this.With({ kinds: [...this.Kinds, kind] }); }
  RemoveKind(kind: DamageKind): DamagePacket {
    const n = StringUtil.normalize(kind);
    return this.With({ kinds: [...this.Kinds].filter(k => k !== n) });
  }
  Unsoakable(): DamagePacket { return this.Soakable ? this.With({ soakable: false }) : this; }

  describe(): string {
    const kinds = this.Kinds.size ? ` {${[...this.Kinds].join(", ")}}` : "";
    const src = this.Source ? ` from ${this.Source}` : "";
    const soak = this.Soakable ? "" : " (unsoakable)";
    return `${this.Intensity} ${this.Severity.Name}${kinds}${src}${soak}`;
  }
}

// --- DAMAGE REACTIONS - a target's veto/rewrite of an incoming packet ---
// Folded left-to-right over the packet before soak; return the packet unchanged
// to pass. Ordering matters: put severity/kind rewrites before mitigation.
// The reaction's view of its owner: just enough to read traits (Fortitude,
// Stamina, ...) without depending on the game layer's LiveCharacter.
interface ReactionTarget { TraitValue(name: string): number; }

interface DamageReaction {
  readonly Label: string;
  Apply(packet: DamagePacket, character?: ReactionTarget): DamagePacket;
}

// Undead (vampires): no organs to rupture, no blood to bleed out. Piercing and
// ballistic wounds that would kill the living do only bashing; fire and sunlight
// are the classic aggravated exceptions and are never talked down.
class UndeadPhysiology implements DamageReaction {
  readonly Label = "Undead physiology";
  Apply(packet: DamagePacket): DamagePacket {
    if (packet.HasAnyKind(Kind.FIRE, Kind.SUNLIGHT)) {
      return packet.WithSeverity(packet.Severity.Max(Severity.AGGRAVATED));
    }
    const piercing = packet.HasAnyKind(Kind.PIERCING) || packet.Source === Source.GUNSHOT;
    if (piercing && packet.Severity === Severity.LETHAL) {
      return packet.WithSeverity(Severity.BASHING);
    }
    return packet;
  }
}

// Regenerators (werewolves & kin): silver (and fire) slip past the healing
// factor - that damage is aggravated and cannot be soaked away. Everything else
// is left for their all-round Stamina soak to simply absorb.
class SilverVulnerability implements DamageReaction {
  readonly Label = "Silver/fire vulnerability";
  constructor(private readonly kinds: DamageKind[] = [Kind.SILVER, Kind.FIRE]) {}
  Apply(packet: DamagePacket): DamagePacket {
    if (packet.HasAnyKind(...this.kinds)) {
      return packet.WithSeverity(packet.Severity.Max(Severity.AGGRAVATED)).Unsoakable();
    }
    return packet;
  }
}

// Worn protection: flat damage reduction against the kinds (or source) it
// actually stops - a ballistic vest turns a lethal gunshot survivable. A
// deliberate simplification of the tabletop "extra soak dice", chosen so that
// `intensity` alone tells the story of how much got through.
class ArmorReaction implements DamageReaction {
  readonly Label: string;
  private readonly _covers: Set<DamageKind>;
  constructor(name: string, private readonly rating: number, covers: DamageKind[]) {
    this.Label = `Armor (${name})`;
    this._covers = new Set(covers.map(k => StringUtil.normalize(k)));
  }
  Apply(packet: DamagePacket): DamagePacket {
    if (this.rating <= 0) return packet;
    const stops = [...packet.Kinds].some(k => this._covers.has(k))
      || (packet.Source !== null && this._covers.has(packet.Source));
    return stops ? packet.WithIntensity(Math.max(0, packet.Intensity - this.rating)) : packet;
  }
}

// =============================================================================
// HEALTH - damage tracks & wound penalties
// =============================================================================

interface HealthLevelDef { name: string; penalty: number; }

// Standard 7-level Storyteller health track.
const STANDARD_HEALTH_LEVELS: HealthLevelDef[] = [
  { name: "Bruised", penalty: 0 },
  { name: "Hurt", penalty: -1 },
  { name: "Injured", penalty: -1 },
  { name: "Wounded", penalty: -2 },
  { name: "Mauled", penalty: -2 },
  { name: "Crippled", penalty: -5 },
  { name: "Incapacitated", penalty: -5 },
];

// How a square may be healed.
type HealPolicy = "normal" | "never" | "special";

// A single health box. `penalty` is the wound penalty it imposes when it is the
// deepest damaged box. Everything else is optional, so a plain
// `{ name, penalty }` (a HealthLevelDef) is a valid square.
interface HealthSquareDef {
  penalty: number;
  name?: string;
  state?: string;      // key linking this box to a HealthStateDef
  heal?: HealPolicy;    // default "normal"
  healCost?: number;    // healing points to clear this box (default 1)
}

// A named health state wired to one or more boxes; its state depends on how many of its
// linked boxes are currently damaged.
interface HealthStateDef {
  key: string;
  name?: string;
  // Given how many linked boxes are damaged (and how many exist), return the
  // current state label, or null for "inactive". Default: active if any hurt.
  state?: (damaged: number, total: number) => string | null;
}

interface HealthTrackConfig {
  squares: HealthSquareDef[];
  states?: HealthStateDef[];
}

interface HealthStateSlot { key: string; name: string; state: string; damaged: number; total: number; }

interface HealthSummary {
  bashing: number; lethal: number; aggravated: number;
  filled: number; capacity: number; overkill: number;
  penalty: number; level: string;
  isIncapacitated: boolean; isDead: boolean;
  states: HealthStateSlot[];
}

// Damage is stored PER BOX, so boxes can carry named states, heal costs, or be
// unhealable. Simple use (ApplyDamage / Heal / Penalty / Level / counts) needs
// none of that and behaves exactly like a plain Storyteller track.
class HealthTrack {
  private readonly _defs: HealthSquareDef[];
  private readonly _damage: (Severity | null)[];
  private readonly _states: HealthStateDef[];
  private _overkill = 0; // damage that spills past a fully-aggravated track
  private readonly _log: Array<{ severity: SeverityName; intensity: number }> = [];

  constructor(config: HealthSquareDef[] | HealthTrackConfig = STANDARD_HEALTH_LEVELS) {
    const cfg: HealthTrackConfig = Array.isArray(config) ? { squares: config } : config;
    if (cfg.squares.length === 0) throw new Error("Health track needs at least one square.");
    this._defs = cfg.squares.map(s => ({ heal: "normal", healCost: 1, ...s }));
    this._damage = this._defs.map(() => null);
    this._states = (cfg.states ?? []).map(c => ({ ...c }));
  }

  get Capacity(): number { return this._defs.length; }
  get Overkill(): number { return this._overkill; }
  get Filled(): number { return this._damage.reduce((n, d) => n + (d ? 1 : 0), 0); }
  get Bashing(): number { return this._count(Severity.BASHING); }
  get Lethal(): number { return this._count(Severity.LETHAL); }
  get Aggravated(): number { return this._count(Severity.AGGRAVATED); }
  get Fatal(): number { return this._count(Severity.FATAL); }
  CountBySeverity(sev: Severity | SeverityName): number { return this._count(Severity.coerce(sev)); }
  private _count(sev: Severity): number { return this._damage.reduce((n, d) => n + (d === sev ? 1 : 0), 0); }

  // Index of the deepest (highest-index) damaged box, or -1 if unhurt.
  private _deepest(): number {
    for (let i = this._damage.length - 1; i >= 0; i--) if (this._damage[i]) return i;
    return -1;
  }

  // Wound penalty = penalty of the deepest damaged box.
  get Penalty(): number { const i = this._deepest(); return i < 0 ? 0 : this._defs[i].penalty; }
  get Level(): string { const i = this._deepest(); return i < 0 ? "Healthy" : (this._defs[i].name ?? `Level ${i + 1}`); }
  get IsIncapacitated(): boolean { return this.Filled >= this.Capacity; }
  get IsDead(): boolean {
    return this._overkill > 0 || this.Aggravated >= this.Capacity || this._damage.some(d => d === Severity.FATAL);
  }

  ApplyDamage(severity: Severity | SeverityName, intensity: number): void {
    const sev = Severity.coerce(severity);
    if (intensity < 0) throw new Error("Damage intensity cannot be negative.");
    if (intensity === 0 || sev === Severity.HARMLESS) return; // harmless deals nothing
    this._log.push({ severity: sev.Name, intensity });
    for (let i = 0; i < intensity; i++) this._applyOne(sev);
  }

  // One level of damage: fill the first empty box; on a full track apply the
  // wrap-around rule (a more-severe hit replaces the least-severe wound,
  // otherwise the least-severe wound is upgraded one step).
  private _applyOne(sev: Severity): void {
    const empty = this._damage.indexOf(null);
    if (empty !== -1) { this._damage[empty] = sev; return; }

    // Full: least-severe filled box (deepest index among ties).
    let idx = -1, leastRank = Infinity;
    for (let i = this._damage.length - 1; i >= 0; i--) {
      const r = this._damage[i]!.Rank;
      if (r < leastRank) { leastRank = r; idx = i; }
    }
    const least = this._damage[idx]!;
    if (sev.Rank > least.Rank) this._damage[idx] = sev;                              // more severe replaces it
    else if (least.Rank < Severity.AGGRAVATED.Rank) this._damage[idx] = Severity.atRank(least.Rank + 1); // wrap up a step
    else this._overkill++;                                                           // aggravated+ full -> overkill
  }

  // Heals up to `amount` boxes of `severity`, shallowest (highest index) first.
  // "never" boxes are skipped; "special" ones only with `allowSpecial`. Returns
  // the number of boxes cleared.
  Heal(severity: Severity | SeverityName, amount: number, opts: { allowSpecial?: boolean } = {}): number {
    return this._heal(severity, amount, Infinity, opts.allowSpecial ?? false).healed;
  }

  // Cost-aware heal: each box costs its `healCost` from `healingPoints`; stops
  // when the budget or `amount` runs out. Returns boxes cleared and points spent.
  HealWithPoints(severity: Severity | SeverityName, amount: number, healingPoints: number, opts: { allowSpecial?: boolean } = {}): { healed: number; pointsSpent: number } {
    return this._heal(severity, amount, healingPoints, opts.allowSpecial ?? false);
  }

  private _heal(severity: Severity | SeverityName, amount: number, budget: number, allowSpecial: boolean): { healed: number; pointsSpent: number } {
    const sev = Severity.coerce(severity);
    if (amount < 0) throw new Error("Heal amount cannot be negative.");
    let healed = 0, pointsSpent = 0;
    for (let i = this._damage.length - 1; i >= 0 && healed < amount; i--) {
      if (this._damage[i] !== sev) continue;
      const policy = this._defs[i].heal ?? "normal";
      if (policy === "never") continue;
      if (policy === "special" && !allowSpecial) continue;
      const cost = this._defs[i].healCost ?? 1;
      if (cost > budget) continue;
      this._damage[i] = null;
      budget -= cost; pointsSpent += cost; healed++;
    }
    return { healed, pointsSpent };
  }

  Reset(): void { for (let i = 0; i < this._damage.length; i++) this._damage[i] = null; this._overkill = 0; }

  // Current state of every active named state wired to the track.
  States(): HealthStateSlot[] {
    const out: HealthStateSlot[] = [];
    for (const c of this._states) {
      let damaged = 0, total = 0;
      for (let i = 0; i < this._defs.length; i++) {
        if (this._defs[i].state === c.key) { total++; if (this._damage[i]) damaged++; }
      }
      const state = c.state ? c.state(damaged, total) : (damaged > 0 ? "active" : null);
      if (state != null) out.push({ key: c.key, name: c.name ?? c.key, state, damaged, total });
    }
    return out;
  }

  Summary(): HealthSummary {
    return {
      bashing: this.Bashing, lethal: this.Lethal, aggravated: this.Aggravated,
      filled: this.Filled, capacity: this.Capacity, overkill: this._overkill,
      penalty: this.Penalty, level: this.Level,
      isIncapacitated: this.IsIncapacitated, isDead: this.IsDead,
      states: this.States(),
    };
  }
}

// =============================================================================
// SOAK - per-template rules for resisting damage
// =============================================================================
interface SoakTypeRule { soakable: boolean; pool: string[]; }
interface SoakSpec {
  bashing: SoakTypeRule;
  lethal: SoakTypeRule;
  aggravated: SoakTypeRule;
  difficulty: number;
}
//#endregion src/core/damage.ts

//#region src/core/time.ts
// =============================================================================
// TIME - pure calendar/clock math (no host)
// -----------------------------------------------------------------------------
// The story runs on a real (proleptic Gregorian) clock: historical Dark Ages
// dates work, durations roll over months/years correctly, and the cursor is
// second-granular so combat's future 3-second turns fit. Everything here is
// PURE - epoch SECONDS (UTC) in and out. The surface syntax is "yyyy-mm-dd-hh"
// (hour optional); durations are "s/m/h/d/w/mo/y" tokens ("2w 4h", "1mo").
// Adding a duration is calendar-aware (Jan 31 + 1mo = Feb 28); the span between
// two instants is reported as a natural breakdown, computed from the real
// endpoints so it is never the ambiguous "how many days IS a month" guess.
// =============================================================================

const padNum = (n: number, w = 2): string => String(Math.trunc(Math.abs(n))).padStart(w, "0");

// Days in a 1-based month of a (possibly historical) year - leap-aware, and safe
// for years < 100 (which Date.UTC would otherwise remap to 1900-1999).
function daysInMonth(year: number, month1to12: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month1to12, 0);   // month index `month1to12` = the NEXT month; day 0 = its last previous day
  return d.getUTCDate();
}

function secondsOfDay(d: Date): number {
  return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}

// --- Instants: "yyyy-mm-dd[-hh[:mm[:ss]]]" <-> epoch seconds ------------------

// Parse a story date. Accepts yyyy-mm-dd, yyyy-mm-dd-hh, yyyy-mm-dd-hh:mm, and
// yyyy-mm-dd-hh:mm:ss (the hour may also be space-separated). Returns epoch
// SECONDS (UTC) or a citing error.
function parseStoryDate(raw: string | undefined): number | { error: string } {
  const s = (raw ?? "").trim();
  const m = s.match(/^(\d{1,6})-(\d{1,2})-(\d{1,2})(?:[-\s]+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (!m) return { error: `Can't read date "${s}" - use yyyy-mm-dd-hh (e.g. 1197-03-15-08).` };
  const [year, month, day, hour, minute, second] = m.slice(1).map(x => (x === undefined ? 0 : parseInt(x, 10)));
  if (month < 1 || month > 12) return { error: `Month must be 1-12 in "${s}".` };
  const dim = daysInMonth(year, month);
  if (day < 1 || day > dim) return { error: `Day must be 1-${dim} for ${year}-${padNum(month)} in "${s}".` };
  if (hour > 23 || minute > 59 || second > 59) return { error: `Time out of range in "${s}" (hh:mm:ss up to 23:59:59).` };
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, second, 0);
  return Math.floor(d.getTime() / 1000);
}

// Format epoch seconds as "yyyy-mm-dd hh:mm" (with ":ss" only when nonzero).
function formatStoryDate(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const base = `${d.getUTCFullYear()}-${padNum(d.getUTCMonth() + 1)}-${padNum(d.getUTCDate())} ${padNum(d.getUTCHours())}:${padNum(d.getUTCMinutes())}`;
  return d.getUTCSeconds() ? `${base}:${padNum(d.getUTCSeconds())}` : base;
}

// --- Durations: fixed part (seconds) + calendar part (months) ----------------

// Months and years are calendar-relative (variable length) so they are kept
// apart from the fixed units and applied by walking the calendar.
interface Duration { months: number; seconds: number }

const UNIT_SECONDS: Record<string, number> = {
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1,
  m: 60, min: 60, mins: 60, minute: 60, minutes: 60,
  h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
  d: 86400, day: 86400, days: 86400,
  w: 604800, wk: 604800, wks: 604800, week: 604800, weeks: 604800,
};
const UNIT_MONTHS: Record<string, number> = {
  mo: 1, mon: 1, mons: 1, month: 1, months: 1,
  y: 12, yr: 12, yrs: 12, year: 12, years: 12,
};

// Parse "2w 4h", "1mo", "90s", "3 days" (tokens may be space-separated or not;
// negatives rewind). Returns a Duration or a citing error.
function parseDuration(raw: string | undefined): Duration | { error: string } {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return { error: `Needs a duration, e.g. "3d", "2w 4h", "1mo", "90s".` };
  let months = 0, seconds = 0, matched = false;
  const re = /(-?\d+)\s*([a-z]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = parseInt(m[1], 10);
    const unit = m[2];
    if (unit in UNIT_MONTHS) months += n * UNIT_MONTHS[unit];
    else if (unit in UNIT_SECONDS) seconds += n * UNIT_SECONDS[unit];
    else return { error: `Unknown time unit "${unit}" in "${s}" - use s/m/h/d/w/mo/y.` };
    matched = true;
  }
  if (!matched) return { error: `Can't read duration "${s}" - use e.g. "3d", "2w 4h", "1mo", "90s".` };
  return { months, seconds };
}

// Add a duration to an instant. The month/year part is applied first, clamping
// the day to the target month's length (Jan 31 + 1mo -> Feb 28), then the fixed
// seconds are added.
function addDuration(epochSeconds: number, dur: Duration): number {
  const d = new Date(epochSeconds * 1000);
  if (dur.months) {
    const targetIndex = d.getUTCMonth() + dur.months;
    const targetYear = d.getUTCFullYear() + Math.floor(targetIndex / 12);
    const targetMonth = ((targetIndex % 12) + 12) % 12;   // 0-11
    const day = Math.min(d.getUTCDate(), daysInMonth(targetYear, targetMonth + 1));
    d.setUTCFullYear(targetYear, targetMonth, day);
  }
  return Math.floor(d.getTime() / 1000) + dur.seconds;
}

// --- Spans between two instants ----------------------------------------------

interface CalendarSpan {
  negative: boolean;                 // b is before a
  years: number; months: number; days: number;
  hours: number; minutes: number; seconds: number;
  totalSeconds: number;              // absolute magnitude
}

// The exact span from a to b, as a natural years/months/days/h:m:s breakdown.
// Whole calendar months are counted from the earlier endpoint (backing off if
// they would overshoot); the remainder is a plain fixed-time difference - so the
// answer is unambiguous and reversible with addDuration.
function diffCalendar(aEpoch: number, bEpoch: number): CalendarSpan {
  const negative = bEpoch < aEpoch;
  const lo = negative ? bEpoch : aEpoch;
  const hi = negative ? aEpoch : bEpoch;
  const totalSeconds = hi - lo;
  const loD = new Date(lo * 1000), hiD = new Date(hi * 1000);

  let months = (hiD.getUTCFullYear() - loD.getUTCFullYear()) * 12 + (hiD.getUTCMonth() - loD.getUTCMonth());
  if (loD.getUTCDate() > hiD.getUTCDate() ||
     (loD.getUTCDate() === hiD.getUTCDate() && secondsOfDay(loD) > secondsOfDay(hiD))) {
    months -= 1;   // the final month has not fully elapsed
  }
  if (months < 0) months = 0;

  let rem = hi - addDuration(lo, { months, seconds: 0 });   // leftover seconds, >= 0
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const days = Math.floor(rem / 86400); rem -= days * 86400;
  const hours = Math.floor(rem / 3600); rem -= hours * 3600;
  const minutes = Math.floor(rem / 60); rem -= minutes * 60;
  return { negative, years, months: remMonths, days, hours, minutes, seconds: rem, totalSeconds };
}

// A span as prose: "1 year, 2 months, 14 days, 12 hours" (empty units dropped).
function formatCalendarSpan(span: CalendarSpan): string {
  const parts: string[] = [];
  const push = (n: number, unit: string): void => { if (n) parts.push(`${n} ${unit}${n === 1 ? "" : "s"}`); };
  push(span.years, "year"); push(span.months, "month"); push(span.days, "day");
  push(span.hours, "hour"); push(span.minutes, "minute"); push(span.seconds, "second");
  return parts.length ? parts.join(", ") : "no time";
}
//#endregion src/core/time.ts

//#region src/wizard.ts
// =============================================================================
// WIZARD - a medium-agnostic engine for guided, multi-step configuration
// -----------------------------------------------------------------------------
// A wizard definition is a small state machine over PLAIN-JSON state: start()
// yields the first prompt, answer(state, reply) consumes a normalized reply and
// yields the next prompt (or done). Prompts are STRUCTURED (kind, options with
// value+label, default, progress) so any medium can render them: the text
// "prompt -> reply" renderer below is one medium; a future api.v1.ui renderer
// can map the same prompts to windows with buttons and feed replies to the same
// answer(). The engine knows nothing about storage or the host - sessions are
// persisted by the caller (game layer).
// =============================================================================

interface WizardOption { value: string; label: string; description?: string }

interface WizardPrompt {
  step: string;                                   // step id (stable per prompt)
  title: string;
  body: string;
  kind: "choice" | "number" | "text" | "confirm";
  options?: WizardOption[];                       // for kind "choice"
  default?: string;                               // "keep" / empty accepts this
  progress?: { at: number; of: number };
}

type WizardStateData = Record<string, unknown>;

interface WizardResult {
  state?: WizardStateData;   // updated state (present while the wizard runs)
  prompt?: WizardPrompt;     // next prompt (absent when done)
  error?: string;            // reply rejected; re-ask the same prompt
  done?: boolean;
  summary?: string;          // closing message when done
}

interface WizardDefinition {
  id: string;
  title: string;
  start(ctx: unknown): WizardResult | Promise<WizardResult>;
  answer(state: WizardStateData, reply: string): WizardResult | Promise<WizardResult>;
}

// Normalize a raw reply against a prompt: option number/value/label for a
// choice, integer for a number, yes/no for a confirm, verbatim for text.
// "keep" (or an empty reply) accepts the prompt's default when one exists.
// "cancel" is NOT handled here - the session layer owns exiting.
function resolveReply(prompt: WizardPrompt, raw: string): { value: string } | { error: string } {
  const t = raw.trim();
  if ((t === "" || /^keep$/i.test(t)) && prompt.default !== undefined) return { value: prompt.default };
  switch (prompt.kind) {
    case "choice": {
      const opts = prompt.options ?? [];
      const i = parseInt(t, 10);
      if (!Number.isNaN(i) && i >= 1 && i <= opts.length) return { value: opts[i - 1].value };
      const hit = opts.find(o => o.value.toLowerCase() === t.toLowerCase() || o.label.toLowerCase() === t.toLowerCase());
      return hit ? { value: hit.value } : { error: `reply with an option (1-${opts.length})` };
    }
    case "number": {
      const v = parseInt(t, 10);
      return Number.isNaN(v) ? { error: "reply with a number" } : { value: String(v) };
    }
    case "confirm": {
      if (/^(y|yes|true)$/i.test(t)) return { value: "yes" };
      if (/^(n|no|false)$/i.test(t)) return { value: "no" };
      return { error: 'reply "yes" or "no"' };
    }
    default:
      return { value: t };
  }
}

// The text medium: one prompt -> one single-line message (the host forbids
// newlines in inputText anyway).
function renderPromptText(p: WizardPrompt): string {
  const prog = p.progress ? `[${p.progress.at}/${p.progress.of}] ` : "";
  const opts = (p.options ?? []).map((o, i) => `${i + 1}) ${o.label}${o.description ? ` - ${o.description}` : ""}`).join("  ");
  const hint = p.kind === "number" ? "reply with a number"
    : p.kind === "confirm" ? 'reply "yes" or "no"'
    : p.kind === "choice" ? "reply with an option number"
    : "reply with text";
  const keep = p.default !== undefined ? `; "keep" = ${p.default === "" ? "skip" : p.default}` : "";
  return `${prog}${p.title} - ${p.body}${opts ? ` ${opts}.` : ""} (${hint}${keep}; "cancel" exits)`;
}
//#endregion src/wizard.ts

//#region src/rolls.ts
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

// Resolves a trait name to its dice value (0 when the character lacks it).
type TraitResolver = (name: string) => number;

const DEFAULT_DIFFICULTY = 6;

// A declarative, serializable roll. `pool` is an expression ("strength+brawl",
// "7", "3+2", "willpower"); the rest are the Storyteller's knobs.
interface RollSpec {
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
function makeRollSpec(parts: Partial<RollSpec> & { pool: string }): RollSpec {
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
interface PoolPart { token: string; value: number; isLiteral: boolean; }
interface PoolBreakdown { parts: PoolPart[]; total: number; }

// "strength+brawl" / "3+2" / "7" / "willpower" -> summed dice (>= 0). Each
// '+'-separated part is an integer literal or a trait name resolved via
// `resolve`. The pool source is a single token (no spaces) so it never collides
// with the positional difficulty / difficulty-modifier that follow it.
function parsePoolExpression(expr: string, resolve: TraitResolver): PoolBreakdown {
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
interface RollModifier {
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
const DEFAULT_ROLL_MODIFIERS: RollModifier[] = [
  { tag: "Acute Senses", describe: "Acute Senses: -2 difficulty on the sharpened sense.", difficultyMod: -2 },
  { tag: "off-hand", describe: "Off-hand action: +1 difficulty (cancelled by Ambidextrous).", difficultyMod: 1 },
  { tag: "Ambidextrous", describe: "Ambidextrous: cancels the off-hand penalty.", difficultyMod: -1 },
  { tag: "Willpower", describe: "Spent Willpower: +1 automatic success.", autoSuccesses: 1 },
  { tag: "specialty", describe: "Relevant specialty: 9s count again (9-again).", nAgain: 9 },
];

class RollModifierRegistry {
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
type OverDifficultyPolicy = "extra-success" | "impossible";

interface ResolvedRoll {
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

function resolveSpec(spec: RollSpec, resolve: TraitResolver, opts: { overDifficulty?: OverDifficultyPolicy; extra?: Partial<RollModifier> } = {}): ResolvedRoll {
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

type RollOutcomeKind = "success" | "failure" | "botch" | "impossible";
interface RollExecution {
  resolved: ResolvedRoll;
  result: RollResult | null;   // null when impossible (never rolled)
  met: boolean;                // requirement met
  outcome: RollOutcomeKind;
}

function executeRoll(
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
function formatExecution(exec: RollExecution): string {
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
function overrideSpec(base: RollSpec, overrides: Partial<RollSpec>): RollSpec {
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
function describeSpec(spec: RollSpec): string {
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
type BotchPolicy = "fail" | "lose-successes" | "ignore";
type ExtendedStatus = "open" | "succeeded" | "failed";

interface ExtendedInterval {
  by: string;              // character who rolled this interval
  net: number;             // successes credited (0 on a botch)
  outcome: RollOutcomeKind;
  total: number;           // accumulated successes after this interval
}

interface ExtendedRoll {
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

function parseBotchPolicy(s: string | undefined): BotchPolicy {
  const n = (s ?? "").trim().toLowerCase();
  if (n === "lose-successes" || n === "lose" || n === "reset") return "lose-successes";
  if (n === "ignore" || n === "continue") return "ignore";
  return "fail";
}

// Apply one interval's result to an OPEN action. Pure: returns a NEW action plus
// a short human note. Caller must ensure `action.status === "open"`.
function applyInterval(action: ExtendedRoll, exec: RollExecution, by: string): { action: ExtendedRoll; note: string } {
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
function describeExtended(a: ExtendedRoll): string {
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
interface SuccessTableRow { at: number; label: string; value?: number }
interface SuccessTable {
  name: string;
  description?: string;
  rows?: SuccessTableRow[];      // sorted ascending; the highest `at` <= n applies
  valuePerSuccess?: number;      // direct numeric output: value = counted * this
  cap?: number;                  // successes beyond this are useless
  overflow?: { per: number; label?: string; value?: number }; // per batch beyond the last row
  botch?: string;                // what a botch means here
  failure?: string;              // what failure means here
}
interface SuccessReading {
  table: string;
  outcome: RollOutcomeKind;
  successes: number;             // counted (after cap)
  wasted: number;                // beyond the cap
  label: string;
  value?: number;                // numeric output when the table defines one
  extra?: string;                // overflow annotation
}

function readSuccessTable(table: SuccessTable, outcome: RollOutcomeKind, successes: number): SuccessReading {
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

function describeTableReading(r: SuccessReading): string {
  const bits = [r.label];
  if (r.value !== undefined) bits.push(`= ${r.value}`);
  if (r.extra) bits.push(r.extra);
  if (r.wasted > 0) bits.push(`(${r.wasted} wasted)`);
  return bits.join(" ");
}

// A whole table laid out (for [[tables <name>]]): its ladder and every dimension
// that shapes a reading, so a Storyteller can see exactly what it does.
function describeTable(t: SuccessTable): string {
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
function parseTableRows(raw: string | undefined): SuccessTableRow[] | { error: string } {
  if (!raw || !raw.trim()) return [];
  const rows: SuccessTableRow[] = [];
  for (const item of raw.split(",")) {
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
const DEFAULT_SUCCESS_TABLES: SuccessTable[] = [
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

class SuccessTableRegistry {
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
type ContestMode = "resisted" | "contested";
interface ContestOutcome {
  mode: ContestMode;
  aNet: number; bNet: number;       // successes counted for each side (botch -> 0)
  aBotch: boolean; bBotch: boolean;
  winner: "a" | "b" | "none";
  margin: number;                   // the winner's lead (0 when none)
  note: string;
}

function compareRolls(mode: ContestMode, a: RollExecution, b: RollExecution): ContestOutcome {
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
interface ContestSide { name: string; base: RollSpec; accumulated: number; char?: string; }
type ContestStatus = "open" | "a" | "b" | "draw";
interface ExtendedContest {
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
function applyContestRound(c: ExtendedContest, aExec: RollExecution, bExec: RollExecution): { contest: ExtendedContest; note: string } {
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

function describeContest(c: ExtendedContest): string {
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
//#endregion src/rolls.ts

//#region src/rules.ts
// =============================================================================
// RULES - the Dark Ages data: rulesets, soak tables, templates, disciplines,
// merits & flaws defaults, and the SRD lorebook seed. Data over logic.
// =============================================================================

// The nine oWoD Attributes, by group. Fixed across every template, so they live
// in code (unlike the chronicle-variable ability/background lists in the
// lorebook). A fresh potential character seeds all nine at 1 (the free dot).
const ATTRIBUTES = {
  physical: ["Strength", "Dexterity", "Stamina"],
  social: ["Charisma", "Manipulation", "Appearance"],
  mental: ["Perception", "Intelligence", "Wits"],
} as const;
const ALL_ATTRIBUTES: readonly string[] = [
  ...ATTRIBUTES.physical, ...ATTRIBUTES.social, ...ATTRIBUTES.mental,
];

// --- CONFIGURATION ---
class RulesetConfig {
  constructor(
    public readonly AttrFreebieCost: number,
    public readonly AbilityFreebieCost: number,
    public readonly AttrXPMultiplier: number,
    public readonly AbilityXPMultiplier: number,
    public readonly UsesDowntime: boolean,
    public readonly AttrDowntimeCost: number = 0,
    public readonly AbilityDowntimeCost: number = 0
  ) {
    Object.freeze(this);
  }

  // Example rulesets
  static readonly VAMPIRE = new RulesetConfig(5, 2, 4, 2, true, 5, 2);
  static readonly MAGE = new RulesetConfig(5, 2, 4, 2, false);
}

// Mortals soak bashing with Stamina only; lethal/aggravated bypass them.
const MORTAL_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: false, pool: [] },
  aggravated: { soakable: false, pool: [] },
  difficulty: 6,
};
// Vampires soak bashing & lethal with Stamina (+Fortitude); aggravated needs
// Fortitude alone (no Fortitude trait -> empty pool -> nothing soaked).
const VAMPIRE_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina", "fortitude"] },
  lethal: { soakable: true, pool: ["stamina", "fortitude"] },
  aggravated: { soakable: true, pool: ["fortitude"] },
  difficulty: 6,
};
// Mages innately soak like mortals (their real defence is magic, not modelled).
const MAGE_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: false, pool: [] },
  aggravated: { soakable: false, pool: [] },
  difficulty: 6,
};
// Demons (manifested) soak all three with Stamina.
const DEMON_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: true, pool: ["stamina"] },
  aggravated: { soakable: true, pool: ["stamina"] },
  difficulty: 6,
};
// Werewolves regenerate: they soak every severity with Stamina and shrug off
// most punishment outright. Silver and fire are the exception - the
// SilverVulnerability reaction marks those packets Unsoakable, so this generous
// spec never even gets consulted for them.
const WEREWOLF_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: true, pool: ["stamina"] },
  aggravated: { soakable: true, pool: ["stamina"] },
  difficulty: 6,
};

interface BloodStats { max: number; perTurn: number; }
// Vampire blood pool by generation (standard table; clamped to 3rd-15th).
const BLOOD_BY_GENERATION: Record<number, BloodStats> = {
  3: { max: 100, perTurn: 20 },
  4: { max: 50, perTurn: 10 },
  5: { max: 40, perTurn: 8 },
  6: { max: 30, perTurn: 6 },
  7: { max: 20, perTurn: 5 },
  8: { max: 15, perTurn: 3 },
  9: { max: 14, perTurn: 2 },
  10: { max: 13, perTurn: 1 },
  11: { max: 12, perTurn: 1 },
  12: { max: 11, perTurn: 1 },
  13: { max: 10, perTurn: 1 },
  14: { max: 10, perTurn: 1 },
  15: { max: 10, perTurn: 1 },
};
function bloodForGeneration(generation: number): BloodStats {
  const g = Math.max(3, Math.min(15, Math.round(generation)));
  return { ...BLOOD_BY_GENERATION[g] };
}

// =============================================================================
// MORALITY - Roads / Humanity (optional; Mages have none)
// =============================================================================
interface RoadDefinition {
  name: string;                       // e.g. "Road of Humanity"
  virtues: [string, string, string];  // the three Virtues this Road uses
  ratingVirtues: [string, string];    // which two sum to the starting rating
}

const ROAD_OF_HUMANITY: RoadDefinition = {
  name: "Road of Humanity",
  virtues: ["conscience", "self-control", "courage"],
  ratingVirtues: ["conscience", "self-control"],
};
const ROAD_OF_KINGS: RoadDefinition = {
  name: "Road of Kings",
  virtues: ["conviction", "self-control", "courage"],
  ratingVirtues: ["conviction", "self-control"],
};
const ROAD_OF_THE_BEAST: RoadDefinition = {
  name: "Road of the Beast",
  virtues: ["conviction", "instinct", "courage"],
  ratingVirtues: ["conviction", "instinct"],
};

// How a template's morality is configured: which trait it is, its polarity,
// and how its starting value is derived.
interface MoralityConfig {
  name: string;
  polarity: MoralityPolarity;
  road?: RoadDefinition;        // virtue-based moralities (Roads / Humanity)
  deriveFromVirtues?: boolean;  // start = sum of the Road's two rating Virtues
  start?: number;               // default start when not derived from Virtues
}

const HUMANITY_MORALITY: MoralityConfig = {
  name: "Road of Humanity",
  polarity: "descending",
  road: ROAD_OF_HUMANITY,
  deriveFromVirtues: true,
};

// =============================================================================
// TEMPLATES - per-splat configuration including starting values
// =============================================================================
type PoolKind = "tracker" | "pool";
// What spending `cost` points of a resource grants to a roll. Maps onto the
// RollModifier fields in rolls.ts (difficulty/dice/auto-successes), so a resource
// effect and a tag modifier flow through the same pipeline.
// --- THE EFFECT GRAMMAR ---
// One declarative sentence: spend [cost] -> apply [op] to [target] at [amount]
// per unit, lasting [duration], at most [limits]. `op` and `target` are OPEN
// vocabularies: a word the engine doesn't know yet ("arcana", "seduction",
// "majesty") is stored, shown, and adjudicated by the Storyteller until its
// interpreter lands - nothing is hardcoded to today's mechanics.
//
// Ops with interpreters today: "difficulty" | "dice" | "successes" | "nagain"
// (roll modifiers; an optional `target` names an action tag the roll must
// carry), "increase" (raise a trait via the boost layer; `target` is a
// constraint - an attribute group, a record bucket, or a specific trait),
// "heal" (`target` = comma-separated severities or "all").
interface EffectOp {
  op: string;
  target?: string;
  amount?: number;          // magnitude per effect unit (default 1)
  fillToCap?: boolean;      // one application raises/heals to the cap
  cap?: number | string;    // literal, or a pool expression ("stamina+3") on the character
  // Gate: the op applies only when the roll's POOL actually used this trait
  // (the twin of the actionTag gate roll ops carry in `target`). A trait that
  // appears only in the difficulty expression does NOT count.
  trait?: string;
}
interface EffectCost {
  units?: number;           // resource units per application (default 1)
  buys?: number;            // effect units per application (default 1)
  // A roll that reduces the units paid (possibly to zero) - e.g. Iron Will.
  reducedBy?: { pool: string; difficulty?: number; perSuccess?: number };
}
interface EffectDuration {
  kind: "instant" | "real" | "st" | "until";
  n?: number;               // count of `unit` ("real": minutes/hours; "st": turns/scenes)
  unit?: string;
  until?: string;           // kind "until": free-form affliction
}
interface EffectLimits {
  maxPerUse?: number;                  // applications per command (enforced)
  uses?: { n: number; per: string };   // tracked in the ledger; ST-enforced for now
  cooldown?: { n: number; unit: string }; // stored; ST-enforced for now
}
interface EffectSpec {
  label: string;
  apply: EffectOp[];        // [] = a pure cost (static spell fuel)
  cost?: EffectCost;
  duration?: EffectDuration;
  limits?: EffectLimits;
  targetMustBe?: string[];  // for effects on others; stored until targeting lands
}

// A resource is a tracker/pool PLUS abstract `roles` it can fill and an optional
// spend `effect`. Roles are how templates compose/share resources: Quintessence
// carrying the "resolve" role IS "use Quintessence as Resolve" - pure data.
interface ResourceDef {
  name: string;
  kind: PoolKind;
  start: number;            // default starting value
  startMin?: number;        // inclusive lower bound for a chosen start
  startMax?: number;        // inclusive upper bound for a chosen start
  startOptions?: number[];  // discrete allowed starts (overrides min/max if set)
  max: number;              // permanent cap (tracker) / capacity (pool)
  perTurnLimit?: number;    // pools only (e.g. blood expenditure per turn)
  fromGeneration?: boolean; // blood pool: max & perTurn derived from Generation
  roles?: string[];         // abstract capabilities this resource fills
  // "Specifically replace any other resource": this resource takes over the
  // named ones - they are hidden from the character and their names resolve
  // here. Resource-level identity, not a spend effect.
  replaces?: string[];
  effect?: EffectSpec;      // the default (unnamed) spend effect
  effects?: Record<string, EffectSpec>; // named context effects (cast, heal, fuel, …)
}
// A resource's spend effect: a named context effect if `name` is given, else the
// default. Named effects let one resource behave differently by situation (a
// Mage's Resolve "cast" bundle vs. its plain difficulty drop).
function resourceEffect(def: ResourceDef, name?: string): EffectSpec | undefined {
  return name ? def.effects?.[StringUtil.normalize(name)] : def.effect;
}

// Compact one-liner for [[resources]] listings and spend notes: the label plus
// any non-default cost/duration/limit dimensions.
function describeEffect(spec: EffectSpec): string {
  const bits: string[] = [spec.label];
  const c = spec.cost;
  if (c && ((c.units ?? 1) !== 1 || (c.buys ?? 1) !== 1 || c.reducedBy)) {
    bits.push(`cost ${c.units ?? 1} for ${c.buys ?? 1}${c.reducedBy ? `, roll ${c.reducedBy.pool} to reduce` : ""}`);
  }
  if (spec.duration && spec.duration.kind !== "instant") {
    const d = spec.duration;
    bits.push(`lasts ${d.kind === "until" ? `until ${d.until}` : `${d.n ?? 1} ${d.unit ?? d.kind}`}`);
  }
  if (spec.limits?.uses) bits.push(`${spec.limits.uses.n}/${spec.limits.uses.per}`);
  if (spec.limits?.cooldown) bits.push(`cooldown ${spec.limits.cooldown.n} ${spec.limits.cooldown.unit}`);
  return bits.join("; ");
}

// Reusable builders so shared roles/effects are configured once.
function willpowerResource(start: number): ResourceDef {
  return {
    name: "willpower", kind: "tracker", start, startMin: 1, startMax: 10, max: 10,
    roles: ["willpower"],
    effect: { label: "Willpower: +1 automatic success", apply: [{ op: "successes", amount: 1 }] },
    // Willpower is also static spell fuel (Sorcerers, some Thaumaturgy): a
    // mandatory pure cost with no dice bonus - `spend=willpower:fuel!`.
    effects: { fuel: { label: "Willpower spent as static spell fuel", apply: [], cost: { units: 1 } } },
  };
}
function resolveResource(over: Partial<ResourceDef> = {}): ResourceDef {
  return {
    name: "resolve", kind: "tracker", start: 3, startMin: 1, startMax: 10, max: 10,
    roles: ["resolve", "magic-fuel"],
    effect: { label: "Resolve: -2 difficulty", apply: [{ op: "difficulty", amount: -2 }] },
    // The whole deal when a mage channels Resolve into a spell (limited per
    // scene as a usage-ledger demo; the Storyteller enforces the reset).
    effects: {
      cast: {
        label: "Resolve fuels the spell: +1 success, 8-again, -2 difficulty",
        apply: [{ op: "successes", amount: 1 }, { op: "nagain", amount: 8 }, { op: "difficulty", amount: -2 }],
        limits: { uses: { n: 3, per: "scene" } },
      },
    },
    ...over,
  };
}
function bloodResource(over: Partial<ResourceDef> = {}): ResourceDef {
  return {
    name: "blood", kind: "pool", start: 10, max: 10, perTurnLimit: 1,
    roles: ["blood"],
    effects: {
      heal: {
        label: "Blood knits the body: heal 1 bashing/lethal per point",
        apply: [{ op: "heal", target: "bashing,lethal", amount: 1 }],
      },
      boost: {
        label: "Blood surges a Physical Attribute: +1 per point",
        apply: [{ op: "increase", target: "physical", amount: 1 }],
        duration: { kind: "st", n: 1, unit: "scene" },
      },
    },
    ...over,
  };
}

class TemplateConfig {
  constructor(
    public readonly Name: string,
    public readonly Rules: RulesetConfig,
    public readonly Pools: ResourceDef[],
    public readonly Soak: SoakSpec,
    // The template's morality (a Road/Humanity, or an ascending Torment), or
    // null for splats without one (Mage, Werewolf).
    public readonly Morality: MoralityConfig | null,
    public readonly HasVirtues: boolean,
    public readonly HealthLevels: HealthLevelDef[] = STANDARD_HEALTH_LEVELS,
    // Innate damage reactions granted to every character of this template
    // (e.g. a vampire's undead physiology). Copied onto the character at build
    // time so per-character armour can be appended without touching the template.
    public readonly Reactions: DamageReaction[] = []
  ) {}

  // Resources is the modern name for Pools (trackers + pools with roles/effects).
  get Resources(): ResourceDef[] { return this.Pools; }

  GetPool(name: string): ResourceDef | undefined {
    const n = StringUtil.normalize(name);
    return this.Pools.find(p => StringUtil.normalize(p.name) === n);
  }
}

const TEMPLATE_MORTAL = new TemplateConfig(
  "Mortal",
  new RulesetConfig(5, 2, 4, 2, false),
  [willpowerResource(3)],
  MORTAL_SOAK,
  HUMANITY_MORALITY, true
);

const TEMPLATE_THRALL = new TemplateConfig(
  "Thrall",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    willpowerResource(3),
    // A thrall's bond grants only a flicker of Resolve: it must start at 1.
    resolveResource({ start: 1, startMin: 1, startMax: 1 }),
  ],
  MORTAL_SOAK,
  HUMANITY_MORALITY, true
);

const TEMPLATE_VAMPIRE = new TemplateConfig(
  "Vampire (Dark Ages)",
  RulesetConfig.VAMPIRE,
  [
    willpowerResource(5),
    bloodResource({ fromGeneration: true }),
  ],
  VAMPIRE_SOAK,
  HUMANITY_MORALITY, true,
  STANDARD_HEALTH_LEVELS,
  [new UndeadPhysiology()]   // bullets & blades to bashing; fire/sunlight stay aggravated
);

// Dark Ages: Mage works magic through Foundation & Pillars (its answer to the
// Spheres), which live with the not-yet-modelled powers, not as a pool. The
// only pool is Quintessence; this line has no Paradox.
const TEMPLATE_MAGE = new TemplateConfig(
  "Mage (Dark Ages)",
  RulesetConfig.MAGE,
  [
    willpowerResource(5),
    { name: "quintessence", kind: "pool", start: 0, max: 20, roles: ["magic-fuel"],
      effect: { label: "Quintessence: -1 casting difficulty per point", apply: [{ op: "difficulty", amount: -1 }] } },
  ],
  MAGE_SOAK,
  null, false   // Mages have no Road/Humanity and no Virtues
);

// Dark Ages: Devil's Due.
const TEMPLATE_DEMON = new TemplateConfig(
  "Demon (Dark Ages: Devil's Due)",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    willpowerResource(5),
    // Resolve (the demon's spiritual power, 1-10): a fledgling starts in the 3-5 band.
    resolveResource({ start: 3, startMin: 3, startMax: 5 }),
  ],
  DEMON_SOAK,
  // Torment is an ASCENDING morality: sins push it up toward an unplayable 10.
  { name: "Torment", polarity: "ascending", start: 3 }, false
);

// A modern-WoD illustration (not Dark Ages canon) kept here so the kind/severity
// system has a regenerator to show off: everything is soaked with Stamina, but
// the SilverVulnerability reaction makes silver and fire aggravated *and*
// unsoakable - the "good luck" case.
const TEMPLATE_WEREWOLF = new TemplateConfig(
  "Werewolf",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    willpowerResource(3),
    { name: "rage", kind: "pool", start: 1, max: 10 },
    { name: "gnosis", kind: "pool", start: 1, max: 10 },
  ],
  WEREWOLF_SOAK,
  null, false,   // Renown/Rage/Gnosis, not a Road or Virtues
  STANDARD_HEALTH_LEVELS,
  [new SilverVulnerability()]
);

// A ghoul is a mortal sustained by vampire vitae. Mechanically they are a mortal
// (still alive: Road/Humanity, Virtues, mortal soak) plus a Blood pool they do
// NOT generate - it must be fed by their domitor, starting near-empty and
// holding up to 10, spendable one point per turn.
//
// At creation a ghoul also gets 2 dots of Disciplines, one of which must be
// Potence: seed them via `disciplines: { potence: 1, ... }`. Potence and
// Fortitude have real mechanics now; 🚧 the template still can't *enforce* the
// 2-dots-incl-Potence rule until character creation is modelled.
const TEMPLATE_GHOUL = new TemplateConfig(
  "Ghoul",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    willpowerResource(3),
    bloodResource({ start: 0 }),
  ],
  MORTAL_SOAK,
  HUMANITY_MORALITY, true   // still human: Road/Humanity + Virtues
);

// Sorcerers work static / linear (hedge) magic through Paths - rated traits that
// arrive with a later slice. Mechanically a mortal for now (mortal soak, Road/
// Humanity + Virtues, Willpower); kept here so [[create-playable templates=sorcerer]]
// works today.
const TEMPLATE_SORCERER = new TemplateConfig(
  "Sorcerer",
  new RulesetConfig(5, 2, 4, 2, false),
  [willpowerResource(3)],
  MORTAL_SOAK,
  HUMANITY_MORALITY, true
);

const TEMPLATES: Record<string, TemplateConfig> = {
  mortal: TEMPLATE_MORTAL,
  thrall: TEMPLATE_THRALL,
  vampire: TEMPLATE_VAMPIRE,
  mage: TEMPLATE_MAGE,
  demon: TEMPLATE_DEMON,
  werewolf: TEMPLATE_WEREWOLF,
  ghoul: TEMPLATE_GHOUL,
  sorcerer: TEMPLATE_SORCERER,
};

// The resources a character has = the union of its templates' resources, deduped
// by name (first template wins for numbers; roles are merged). Unknown or zero
// templates yield the mortal baseline (just Willpower). Story-level `overrides`
// (the house-rule layer, e.g. from the configuration wizard or a hand-edited
// lorebook entry) are applied last: a patch merges onto its resource by
// normalized name, and a patch naming a NEW resource (with kind/start/max) adds
// a custom one.
function resourcesForTemplates(keys: string[], overrides?: Record<string, Partial<ResourceDef>>): ResourceDef[] {
  const byName = new Map<string, ResourceDef>();
  const out: ResourceDef[] = [];
  const add = (def: ResourceDef): void => {
    const key = StringUtil.normalize(def.name);
    const existing = byName.get(key);
    if (existing) {
      const roles = [...new Set([...(existing.roles ?? []), ...(def.roles ?? [])])];
      if (roles.length) existing.roles = roles;
      return;
    }
    const copy: ResourceDef = { ...def, roles: def.roles ? [...def.roles] : undefined };
    byName.set(key, copy);
    out.push(copy);
  };
  const templates = keys.map(k => TEMPLATES[StringUtil.normalize(k)]).filter((t): t is TemplateConfig => !!t);
  for (const t of (templates.length ? templates : [TEMPLATE_MORTAL])) for (const def of t.Pools) add(def);

  for (const [name, patch] of Object.entries(overrides ?? {})) {
    const key = StringUtil.normalize(name);
    const existing = byName.get(key);
    if (existing) {
      Object.assign(existing, patch, { name: existing.name }); // a patch never renames
    } else if (patch.kind && patch.start !== undefined && patch.max !== undefined) {
      const custom: ResourceDef = { ...(patch as ResourceDef), name: key };
      byName.set(key, custom);
      out.push(custom);
    }
  }
  return out;
}

// The health track a character uses: the FIRST of its templates decides (same
// first-wins rule as resource numbers). No/unknown templates -> mortal.
function healthLevelsForTemplates(keys: string[]): HealthLevelDef[] {
  const t = keys.map(k => TEMPLATES[StringUtil.normalize(k)]).find((x): x is TemplateConfig => !!x);
  return (t ?? TEMPLATE_MORTAL).HealthLevels;
}

// =============================================================================
// DISCIPLINES - vampiric (and ghoul/revenant) supernatural powers
// -----------------------------------------------------------------------------
// Rated traits (0-5). The registry is metadata: an "arena" and which Dark Ages
// clans hold it in-clan (for the future advancement-cost engine). A couple have
// wired mechanics today - Potence (automatic successes on Strength) and
// Fortitude (soak) - while the rest are rated dots plus the generic bonus-dice
// hook on `character.Roll`, until per-power effects and a turn system exist.
// =============================================================================
type DisciplineArena = "physical" | "mental" | "social";
interface DisciplineDef {
  name: string;
  arena: DisciplineArena;
  clans: string[];          // Dark Ages clans for whom it is in-clan
  description?: string;
}

const DISCIPLINES: Record<string, DisciplineDef> = {
  potence:       { name: "Potence",       arena: "physical", clans: ["brujah", "lasombra", "nosferatu"], description: "Rating in automatic successes on feats of Strength." },
  fortitude:     { name: "Fortitude",     arena: "physical", clans: ["gangrel", "ventrue"], description: "Rating in soak dice; lets you soak what you otherwise couldn't." },
  celerity:      { name: "Celerity",      arena: "physical", clans: ["assamite", "brujah", "toreador"], description: "Extra speed (rating in bonus dice here, pending a turn system)." },
  animalism:     { name: "Animalism",     arena: "mental",   clans: ["gangrel", "nosferatu", "tzimisce"] },
  auspex:        { name: "Auspex",        arena: "mental",   clans: ["cappadocian", "malkavian", "toreador", "tzimisce"] },
  dominate:      { name: "Dominate",      arena: "mental",   clans: ["cappadocian", "lasombra", "tzimisce", "ventrue"] },
  obfuscate:     { name: "Obfuscate",     arena: "mental",   clans: ["assamite", "cappadocian", "nosferatu", "ravnos"] },
  presence:      { name: "Presence",      arena: "social",   clans: ["brujah", "followers-of-set", "toreador"] },
  obtenebration: { name: "Obtenebration", arena: "mental",   clans: ["lasombra"] },
  protean:       { name: "Protean",       arena: "physical", clans: ["gangrel"] },
  quietus:       { name: "Quietus",       arena: "physical", clans: ["assamite"] },
  serpentis:     { name: "Serpentis",     arena: "physical", clans: ["followers-of-set"] },
  vicissitude:   { name: "Vicissitude",   arena: "physical", clans: ["tzimisce"] },
  chimerstry:    { name: "Chimerstry",    arena: "mental",   clans: ["ravnos"] },
  mortis:        { name: "Mortis",        arena: "mental",   clans: ["cappadocian"] },
  thaumaturgy:   { name: "Thaumaturgy",   arena: "mental",   clans: ["tremere"] },
};

function disciplineDef(name: string): DisciplineDef | undefined {
  return DISCIPLINES[StringUtil.normalize(name)];
}

// =============================================================================
// MERITS & FLAWS - optional quirks with (waivable) prerequisites
// -----------------------------------------------------------------------------
// Defaults live in an in-code list; the lorebook is the editable database on
// top: any entry in the "srd:merits-flaws" category whose text is a JSON array
// of definitions is merged over the defaults by MeritFlawRegistry
// .loadFromLorebook(). Prerequisites may name templates, free-form character
// tags ("toreador", "revenant", "inconnu", ...) and other Merits/Flaws; every
// check can be waived case-by-case.
// =============================================================================
type MeritFlawKind = "merit" | "flaw";
interface MeritFlawRequirements {
  templates?: string[];   // met if the character's template matches ANY listed
  tags?: string[];        // ALL listed tags must be present on the character
  meritsFlaws?: string[]; // ALL listed merits/flaws must already be taken
}
interface MeritFlawDef {
  name: string;
  kind: MeritFlawKind;
  points: number | number[]; // freebie cost (merit) / bonus granted (flaw); array = variable rating
  requires?: MeritFlawRequirements;
  description?: string;
  // --- Parameterized instances + passive effects (the owned-power pattern) ---
  // `param` names an instance-parameter slot (e.g. "trait"): the def is then
  // owned as `name::<value>` instances ("trait-affinity::melee"), and any
  // passive-op field equal to "$<param>" substitutes the instance's value.
  param?: string;
  // Always-on ops while the merit is owned - no cost, no spend. Amounts SCALE
  // by the points the instance was taken at (trait-affinity at 2 points =
  // -2 difficulty). Roll ops honor the actionTag (`target`) and `trait` gates.
  passive?: EffectOp[];
  // Cross-instance cap: at most ONE instance of this def may sit at this
  // points value (trait-affinity: 3 - one favoured trait). ADVISORY - the
  // constraint check reports violations; the creation engine will enforce.
  atMostOneAt?: number;
}

// "trait-affinity:melee" -> its base def name + instance param. The suffix is
// split off ONLY when the base def declares `param` (plain names with colons
// stay whole otherwise; lookup tries the full key first).
function resolveMeritInstance(key: string, lookup: (name: string) => MeritFlawDef | undefined):
  { def: MeritFlawDef; param?: string } | undefined {
  const full = StringUtil.normalize(key);
  const whole = lookup(full);
  if (whole) return whole.param ? undefined : { def: whole };   // a param def owned bare is malformed
  const i = full.lastIndexOf(":");
  if (i <= 0) return undefined;
  const base = lookup(full.slice(0, i));
  if (!base?.param) return undefined;
  const param = full.slice(i + 1);
  return param ? { def: base, param } : undefined;
}

// An instance's passive ops, with "$<param>" substituted and amounts scaled
// by the points taken. Pure - ownership walks live in state.ts.
function passiveOpsOf(def: MeritFlawDef, param: string | undefined, points: number): EffectOp[] {
  const sub = (v: string | undefined): string | undefined =>
    def.param && v === `$${def.param}` ? param : v;
  return (def.passive ?? []).map(op => {
    const out: EffectOp = { ...op, op: op.op };
    out.target = sub(op.target);
    out.trait = sub(op.trait);
    if (out.target === undefined) delete out.target;
    if (out.trait === undefined) delete out.trait;
    out.amount = (op.amount ?? 1) * Math.max(1, points);
    return out;
  });
}

const DEFAULT_MERITS_FLAWS: MeritFlawDef[] = [
  // Devil's Due arcana, modeled as parameterized merits with passive effects.
  {
    name: "Trait Affinity", kind: "merit", points: [1, 2, 3], param: "trait", atMostOneAt: 3,
    passive: [{ op: "difficulty", amount: -1, trait: "$trait" }],
    description: "Devil's Due: -1 difficulty per point on rolls whose pool uses the trait. One favoured trait may reach 3; every other caps at 2.",
  },
  {
    name: "Trait Enhancement", kind: "merit", points: [1, 2, 3], param: "trait",
    passive: [{ op: "enhance", amount: 1, target: "$trait" }],
    description: "Devil's Due: permanently raises the trait's effective value AND its advancement ceiling by the points taken; XP still prices from the un-enhanced base.",
  },
  { name: "Acute Senses", kind: "merit", points: 1, description: "One sense is unusually sharp; -2 difficulty on related Perception rolls." },
  { name: "Ambidextrous", kind: "merit", points: 1, description: "No off-hand penalty." },
  { name: "Iron Will", kind: "merit", points: 3, description: "Resistant to Dominate and mental control." },
  { name: "Eat Food", kind: "merit", points: 1, requires: { templates: ["vampire"] }, description: "Can consume (and later expel) mortal food." },
  { name: "Efficient Digestion", kind: "merit", points: 3, requires: { templates: ["vampire"] }, description: "Gain an extra blood point for every two drawn." },
  { name: "Unbondable", kind: "merit", points: 4, requires: { templates: ["mortal", "thrall", "ghoul"] }, description: "Immune to the blood bond." },
  { name: "True Faith", kind: "merit", points: 7, requires: { templates: ["mortal"] }, description: "A wellspring of genuine faith (rating 1)." },
  { name: "Dark Secret", kind: "flaw", points: 1, description: "Exposure would be disastrous." },
  { name: "Nightmares", kind: "flaw", points: 1, description: "Nightly horrors that bleed into the day." },
  { name: "Prey Exclusion", kind: "flaw", points: 1, requires: { templates: ["vampire"] }, description: "You refuse to feed from a certain class of prey." },
  { name: "Vengeful", kind: "flaw", points: 2, description: "An old score you cannot let rest." },
  { name: "Haunted", kind: "flaw", points: 3, description: "A spiteful ghost follows you." },
  { name: "Hunted", kind: "flaw", points: 4, description: "Someone dangerous wants you destroyed." },
];

// =============================================================================
// CONSTRAINT GROUPS - reusable allow/deny rules over trait options
// -----------------------------------------------------------------------------
// A named list of backgrounds and/or merits/flaws with a relation the creation
// engine (when it lands) will enforce, and which [[check-constraints]] surfaces
// now: EXCLUSIVE = take at most `max` of the members (mutual exclusion);
// RESTRICTED = members available ONLY to characters in `scope`; FORBIDDEN =
// members disallowed for characters in `scope`. Pure data - stored, surfaced,
// and checked on demand; ST-enforced until creation consumes it. `scope` holds
// template/choice tags (empty = applies to everyone). Both senses of "exclusive"
// are covered: mutually-exclusive members (exclusive) vs reserved access
// (restricted).
// =============================================================================
type ConstraintDomain = "background" | "merit" | "flaw" | "meritflaw" | "any";
type ConstraintRelation = "exclusive" | "restricted" | "forbidden";
interface ConstraintGroup {
  name: string;                  // normalized group id
  relation: ConstraintRelation;
  domain: ConstraintDomain;      // which trait bucket the members live in
  members: string[];             // normalized trait names
  max?: number;                  // exclusive: at most N (default 1)
  scope?: string[];              // templates/choices it applies to (empty = everyone)
  note?: string;
}
interface ConstraintViolation {
  group: string;
  relation: ConstraintRelation;
  detail: string;
}

// Exported so consumers (command specs, windows) reference THE vocabulary
// instead of retyping it - a new relation/domain reaches every surface.
const CONSTRAINT_RELATIONS: ConstraintRelation[] = ["exclusive", "restricted", "forbidden"];
const CONSTRAINT_DOMAINS: ConstraintDomain[] = ["background", "merit", "flaw", "meritflaw", "any"];

// Fill defaults and normalize. An unknown relation falls back to "exclusive",
// an unknown domain to "any" - a misconfigured group is still stored, never lost.
function makeConstraintGroup(parts: Partial<ConstraintGroup> & { name: string }): ConstraintGroup {
  const relation = CONSTRAINT_RELATIONS.includes(parts.relation as ConstraintRelation) ? (parts.relation as ConstraintRelation) : "exclusive";
  const domain = CONSTRAINT_DOMAINS.includes(parts.domain as ConstraintDomain) ? (parts.domain as ConstraintDomain) : "any";
  const g: ConstraintGroup = {
    name: StringUtil.normalize(parts.name),
    relation,
    domain,
    members: (parts.members ?? []).map(m => StringUtil.normalize(m)).filter(m => m.length > 0),
    scope: (parts.scope ?? []).map(s => StringUtil.normalize(s)).filter(s => s.length > 0),
  };
  if (relation === "exclusive") g.max = Math.max(1, parts.max ?? 1);
  else if (parts.max !== undefined) g.max = parts.max;
  if (parts.note && parts.note.trim()) g.note = parts.note.trim();
  return g;
}

function describeConstraint(g: ConstraintGroup): string {
  const bits = [`${g.name} [${g.relation}/${g.domain}${g.relation === "exclusive" ? ` max ${g.max ?? 1}` : ""}]`];
  bits.push(`{${g.members.map(m => StringUtil.toTitleCase(m)).join(", ")}}`);
  if (g.scope && g.scope.length) bits.push(`scope: ${g.scope.join(", ")}`);
  if (g.note) bits.push(`- ${g.note}`);
  return bits.join(" ");
}

// What a character owns, for checkConstraints. All names normalized.
interface OwnedTraits {
  backgrounds: string[];
  merits: string[];
  flaws: string[];
  templates: string[];
}

function ownedForDomain(owned: OwnedTraits, domain: ConstraintDomain): string[] {
  switch (domain) {
    case "background": return owned.backgrounds;
    case "merit": return owned.merits;
    case "flaw": return owned.flaws;
    case "meritflaw": return [...owned.merits, ...owned.flaws];
    default: return [...owned.backgrounds, ...owned.merits, ...owned.flaws];
  }
}

// Empty scope = applies to everyone; else the character must share a scope tag
// (its templates, for now - choices join this later).
function inScope(g: ConstraintGroup, owned: OwnedTraits): boolean {
  if (!g.scope || g.scope.length === 0) return true;
  return g.scope.some(s => owned.templates.includes(s));
}

// Report every group the character violates. All three relations respect scope
// (empty scope = universal); restricted is the inverted case (violated when the
// member is held OUTSIDE its reserved scope).
function checkConstraints(groups: ConstraintGroup[], owned: OwnedTraits): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const title = (names: string[]): string => names.map(m => StringUtil.toTitleCase(m)).join(", ");
  for (const g of groups) {
    const held = g.members.filter(m => ownedForDomain(owned, g.domain).includes(m));
    if (held.length === 0) continue;
    const scoped = inScope(g, owned);
    if (g.relation === "exclusive") {
      const max = g.max ?? 1;
      if (scoped && held.length > max) violations.push({ group: g.name, relation: g.relation, detail: `holds ${held.length} of "${g.name}" (max ${max}): ${title(held)}` });
    } else if (g.relation === "forbidden") {
      if (scoped) violations.push({ group: g.name, relation: g.relation, detail: `holds forbidden ${title(held)}` });
    } else { // restricted
      if (!scoped) violations.push({ group: g.name, relation: g.relation, detail: `holds ${title(held)} restricted to ${(g.scope ?? []).join(", ")}` });
    }
  }
  return violations;
}

// =============================================================================
// AFFLICTIONS - parameterized character states (bindings, chains, mirrors, tags)
// -----------------------------------------------------------------------------
// An affliction is not a flat video-game flag: it may need BINDINGS (Feral
// Speech's "concentrating-on" needs the animal: target=wolf), may CHAIN into a
// successor when it ends (`then` - concentrating-on lasts a turn, then
// feral-whispers begins, carrying the bindings forward), may MIRROR onto the
// bound target (the animal is in the conversation too - even an NPC with no
// sheet), and may grant TAGS that join the afflicted character's rolls (firing
// registered RollModifiers - afflictions bite mechanically today). Durations
// reuse the effect grammar's EffectDuration and stay advisory (ST-enforced)
// until the turn system; [[advance]] is the manual chain trigger.
// (Health-box states - Crippled etc. - are the separate HealthStateDef in
// core/damage.ts.)
//
// NAMING: an *affliction* is ANY parameterized state attached to someone -
// good, bad, neutral, or outside such categorization (Feral Whispers is a
// gift, not a curse). The word does NOT imply harm. We deliberately reserve
// the word *condition* for future conditional things - predicates the engine
// will someday evaluate.
// =============================================================================
interface AfflictionDef {
  name: string;                 // normalized id
  description?: string;
  bindings?: string[];          // required slot names, e.g. ["target"]
  duration?: EffectDuration;    // advisory until the turn system
  then?: string;                // successor affliction ([[advance]] applies it)
  mirror?: string;              // affliction auto-afflicted on bindings.target, bound back
  tags?: string[];              // tags granted while active
  note?: string;
}

// Normalize a definition: name/bindings/then/mirror/tags through normalize;
// empty optionals dropped.
function makeAfflictionDef(parts: Partial<AfflictionDef> & { name: string }): AfflictionDef {
  const def: AfflictionDef = { name: StringUtil.normalize(parts.name) };
  if (parts.description && parts.description.trim()) def.description = parts.description.trim();
  const bindings = (parts.bindings ?? []).map(b => StringUtil.normalize(b)).filter(b => b.length > 0);
  if (bindings.length) def.bindings = bindings;
  if (parts.duration) def.duration = parts.duration;
  if (parts.then && parts.then.trim()) def.then = StringUtil.normalize(parts.then);
  if (parts.mirror && parts.mirror.trim()) def.mirror = StringUtil.normalize(parts.mirror);
  const tags = (parts.tags ?? []).map(t => StringUtil.normalize(t)).filter(t => t.length > 0);
  if (tags.length) def.tags = tags;
  if (parts.note && parts.note.trim()) def.note = parts.note.trim();
  return def;
}

// "1 turn" / "2 scenes" / "until eye-contact-breaks" / "instant" -> the effect
// grammar's duration. Unparseable -> undefined (the def simply has no duration).
function parseAfflictionDuration(raw: string | undefined): EffectDuration | undefined {
  if (!raw) return undefined;
  const t = StringUtil.normalize(raw);
  if (t === "instant") return { kind: "instant" };
  const until = t.match(/^until-(.+)$/);
  if (until) return { kind: "until", until: until[1] };
  const timed = t.match(/^(\d+)-(.+?)s?$/);
  if (timed) return { kind: "st", n: parseInt(timed[1], 10), unit: timed[2] };
  return undefined;
}

function describeDuration(d: EffectDuration | undefined): string {
  if (!d) return "";
  if (d.kind === "instant") return "instant";
  if (d.kind === "until") return `until ${d.until}`;
  return `${d.n ?? 1} ${d.unit ?? d.kind}${(d.n ?? 1) === 1 ? "" : "s"}`;
}

function describeAfflictionDef(d: AfflictionDef): string {
  const bits = [d.name];
  if (d.bindings?.length) bits.push(`needs ${d.bindings.join(", ")}`);
  const dur = describeDuration(d.duration);
  if (dur) bits.push(dur);
  if (d.then) bits.push(`then ${d.then}`);
  if (d.mirror) bits.push(`mirrors ${d.mirror}`);
  if (d.tags?.length) bits.push(`tags ${d.tags.join(",")}`);
  const head = bits.join(" - ");
  return d.description ? `${head}: ${d.description}` : head;
}

// The Feral Speech exemplar (Animalism), faithful to the book: look the animal
// in the eyes for a moment (concentrating-on, one turn), then converse in its
// tongue (feral-whispers, mirrored - the animal is in the conversation too).
const DEFAULT_AFFLICTIONS: AfflictionDef[] = [
  makeAfflictionDef({
    name: "concentrating-on",
    description: "Locked eyes with the target; nothing else exists this turn",
    bindings: ["target"],
    duration: { kind: "st", n: 1, unit: "turn" },
    then: "feral-whispers",
  }),
  makeAfflictionDef({
    name: "feral-whispers",
    description: "Conversing in the target animal's tongue (Feral Speech)",
    bindings: ["target"],
    duration: { kind: "st", n: 1, unit: "scene" },
    mirror: "feral-whispers",
  }),
];

// A lorebook data entry is a human-readable header, then a marker line of '='
// (>= 3), then the data. On read, everything above the marker is ignored - so
// the instructions live right in the entry card the player edits, no separate
// readme needed. Below the marker, '#' or '//' start a note on list entries.
const SRD_HEADER_MARKER = "=====";
function srdEntryText(header: string[], body: string[]): string {
  return [...header, SRD_HEADER_MARKER, ...body].join("\n");
}
const __srdEditNote = "You may delete, rename or add lines below before you start playing.";

interface SrdSeedEntry { displayName: string; text: string; }
interface SrdCategorySpec { name: string; blurb: string; entries: SrdSeedEntry[]; }

const SRD_CATEGORIES: SrdCategorySpec[] = [
  {
    name: "srd:abilities",
    blurb: "the Talents, Skills and Knowledges available at creation (one per line)",
    entries: [
      { displayName: "srd:abilities:talents", text: srdEntryText(
        [`Talents your chronicle uses - one per line below the ${SRD_HEADER_MARKER} line.`, __srdEditNote, "Everything above the marker is ignored; '#' starts a note."],
        ["Alertness", "Athletics", "Awareness", "Brawl", "Empathy", "Expression", "Intimidation", "Leadership", "Legerdemain", "Subterfuge"]) },
      { displayName: "srd:abilities:skills", text: srdEntryText(
        [`Skills your chronicle uses - one per line below the ${SRD_HEADER_MARKER} line.`, __srdEditNote],
        ["Animal Ken", "Archery", "Commerce", "Crafts", "Etiquette", "Melee", "Performance", "Ride", "Stealth", "Survival"]) },
      { displayName: "srd:abilities:knowledges", text: srdEntryText(
        [`Knowledges your chronicle uses - one per line below the ${SRD_HEADER_MARKER} line.`, __srdEditNote],
        ["Academics", "Enigmas", "Hearth Wisdom", "Investigation", "Law", "Medicine", "Occult", "Politics", "Seneschal", "Theology"]) },
    ],
  },
  {
    name: "srd:backgrounds",
    blurb: "the Backgrounds available at creation (one per line)",
    entries: [
      { displayName: "srd:backgrounds:all", text: srdEntryText(
        [`Backgrounds characters may buy at creation - one per line below the ${SRD_HEADER_MARKER} line.`, __srdEditNote],
        ["Allies", "Contacts", "Domain", "Generation", "Herd", "Influence", "Mentor", "Resources", "Retainers", "Status"]) },
    ],
  },
  {
    name: "srd:merits-flaws",
    blurb: "custom Merits & Flaws (JSON), layered over the built-in list",
    entries: [
      { displayName: "srd:merits-flaws:custom", text: srdEntryText(
        [
          `Custom Merits & Flaws. Put a JSON array below the ${SRD_HEADER_MARKER} line; it is merged over the built-in list. Each definition:`,
          '  name        - display name',
          '  kind        - "merit" or "flaw"',
          '  points      - freebie cost (merit) / bonus (flaw); a number, or [1,2,3] for variable ratings',
          '  requires    - optional { "templates": [any-of], "tags": [all-of], "meritsFlaws": [all-of] }',
          '  description - optional text',
          "The two below are examples - edit or replace them.",
        ],
        [JSON.stringify([
          { name: "Sturdy Stock", kind: "merit", points: 2, requires: { tags: ["revenant"] }, description: "Hardy revenant lineage." },
          { name: "Illiterate", kind: "flaw", points: 1, description: "You cannot read or write." },
        ], null, 2)]) },
    ],
  },
];
//#endregion src/rules.ts

//#region src/command.ts
// =============================================================================
// COMMAND LAYER - the engine's one bus: parse, describe, compose, dispatch
// -----------------------------------------------------------------------------
// Everything that acts on the game speaks [[commands]]: typed input, windows,
// and (later) the AI Storyteller itself. This module is that bus and knows
// NOTHING about stores or rules: registration carries a declarative
// CommandSpec, so a verb's grammar lives in exactly one place - [[help]] text
// is DERIVED from it and windows COMPOSE from it (composeCommand is the only
// place that quotes/sanitizes). Anything the game layer must do before a
// command runs (creator-mode lorebook sync) registers a beforeRoute hook -
// the router dispatches, the game decides.
// =============================================================================

// --- OUTPUT VOICE ------------------------------------------------------------
// The engine's ONE reply formatter. Every command reply is the SYSTEM speaker
// in the player's wider scheme (Player / OOC-Player / ST / OOC-ST /
// <character-name>). Centralized here so re-tagging or re-wrapping the engine's
// output is a one-line change - never a find-and-replace across the handlers.
// If a general `speak(speaker, body)` lands later, `sys` becomes its SYSTEM
// specialization. Callers pass the already-composed body (interpolated string).
// The format (bracket style, label) lives HERE and nowhere else.
function sys(body: string): string {
  return `[SYSTEM: ${body}]`;
}

// --- PARSER ------------------------------------------------------------------
// A command body -> { name, positional[], named{}, raw }. Pure and
// dispatch-agnostic: it only tokenizes (respecting quotes). A token
// `key=value` (or key="quoted") is a named argument; any other bare or quoted
// token is positional, in order.
interface ParsedCommand {
  name: string;
  positional: string[];
  named: Record<string, string>;
  raw: string;
}

class CommandParser {
  static parse(body: string): ParsedCommand {
    const raw = body.trim();
    const name = (raw.match(/^[A-Za-z][\w-]*/)?.[0] ?? "").toLowerCase();
    // BODY-LEVEL gluing, before tokenization (backtick literals excluded):
    // spaces after `@` and around `::` vanish, so "@char :: default :: sire"
    // is ONE token. Tokenization would otherwise split them apart.
    const rest = raw.slice(name.length)
      .split(/(`[^`]*`)/g)
      .map((seg, i) => i % 2 === 1 ? seg : seg.replace(/@\s+/g, "@").replace(/\s*::\s*/g, "::"))
      .join("");
    const positional: string[] = [];
    const named: Record<string, string> = {};
    // key=value | key="v" | key='v' | key=`literal` | "quoted" | 'quoted' |
    // `literal` | bareword. Every value passes through the BOUNDARY normalizer
    // (lowercase, @-space stripping, ::->:, list/pool space stripping,
    // whitespace->hyphen) EXCEPT backtick literals, which stay verbatim -
    // that's the escape hatch for display text (labels, notes, echoes).
    const tokenRe = /([A-Za-z][\w-]*)\s*=\s*("([^"]*)"|'([^']*)'|`([^`]*)`|\S+)|"([^"]*)"|'([^']*)'|`([^`]*)`|(\S+)/g;
    for (const m of rest.matchAll(tokenRe)) {
      if (m[1] !== undefined) {
        const key = m[1].toLowerCase();
        named[key] = m[5] !== undefined ? m[5] : StringUtil.normalizeInput(m[3] ?? m[4] ?? m[2]);
      } else if (m[8] !== undefined) {
        positional.push(m[8]);   // backtick literal: verbatim
      } else {
        positional.push(StringUtil.normalizeInput(m[6] ?? m[7] ?? m[9]));
      }
    }
    return { name, positional, named, raw };
  }
}

// --- COMMAND SPECS -----------------------------------------------------------
// The declarative description of a verb's arguments. Handlers remain the
// validators (a spec never rejects input); the spec is the SHARED knowledge:
// derived help, window forms, and command composition all read it.
type ParamType = "string" | "int" | "enum" | "literal";

interface ParamSpec {
  key: string;                       // named key, or the positional's label
  kind: "positional" | "named";
  type?: ParamType;                  // default "string"; "literal" composes with backticks
  required?: boolean;
  options?: string[];                // enum vocabulary (reference exported arrays)
  default?: string;                  // window pre-seed AND compose fallback
  hint?: string;                     // help display, e.g. res[::effect][!] or "1 turn|until x|instant"
  desc?: string;                     // window field label / long description
  example?: string;                  // window placeholder, e.g. "e.g. status, anonymity"
}

interface CommandSpec {
  summary: string;                   // the parenthetical in help
  params?: ParamSpec[];
  openNamed?: boolean;               // accepts arbitrary extra named args (afflict's slots)
  note?: string;                     // extra help remark, appended to the summary
}

// Derive the one-line usage string [[help]] shows for a verb.
function describeCommandSpec(verb: string, spec: CommandSpec): string {
  const parts: string[] = [verb];
  for (const p of spec.params ?? []) {
    let core: string;
    if (p.kind === "positional") core = p.hint ?? `<${p.key}>`;
    else if (p.type === "enum" && p.options?.length) core = `${p.key}=${p.options.join("|")}`;
    else if (p.type === "int") core = `${p.key}=${p.hint ?? "N"}`;
    else core = `${p.key}=${p.hint ?? '".."'}`;
    parts.push(p.required ? core : `[${core}]`);
  }
  if (spec.openNamed) parts.push("[<key>=<value> ...]");
  const tail = spec.note ? `${spec.summary}; ${spec.note}` : spec.summary;
  return `${parts.join(" ")}  (${tail})`;
}

// Compose a routable command body from per-param values. THE one place that
// quotes: the grammar has no escape syntax (players type these), so characters
// that would break tokenization are stripped - double quotes from quoted
// values, backticks from literals. Empty values are omitted (the handler's
// own validation speaks); declared params compose in order, then openNamed
// extras. `literal` params compose in backticks and stay verbatim at parse.
function composeCommand(verb: string, values: Record<string, string | undefined>, spec: CommandSpec): string {
  const parts: string[] = [verb];
  const emit = (p: ParamSpec, raw: string): string | undefined => {
    let v = raw.trim();
    if (!v) return undefined;
    if (p.type === "literal") {
      v = v.replace(/`/g, "");
      return p.kind === "named" ? `${p.key}=\`${v}\`` : `\`${v}\``;
    }
    v = v.replace(/"/g, "");
    const quoted = /\s/.test(v) ? `"${v}"` : v;
    return p.kind === "named" ? `${p.key}=${quoted}` : quoted;
  };
  const declared = new Set<string>();
  for (const p of spec.params ?? []) {
    declared.add(p.key);
    const out = emit(p, values[p.key] ?? p.default ?? "");
    if (out) parts.push(out);
  }
  if (spec.openNamed) {
    for (const [k, v] of Object.entries(values)) {
      if (declared.has(k) || v === undefined) continue;
      const clean = v.trim().replace(/"/g, "");
      if (clean) parts.push(`${k}="${clean}"`);
    }
  }
  return parts.join(" ");
}

// --- ROUTER ------------------------------------------------------------------
// A registry maps a verb to its handler + spec, so a new command is just a
// register() call (and could one day be defined from a lorebook entry).
// beforeRoute hooks run before every dispatch - the game layer's seam for
// creator-mode syncing, and later the turn system's.
interface CommandContext { rng?: Rng; }
type CommandHandler = (cmd: ParsedCommand, ctx: CommandContext) => Promise<string>;

class CommandRouter {
  private static _registry = new Map<string, { handler: CommandHandler; spec: CommandSpec }>();
  private static _beforeRoute: Array<() => Promise<void>> = [];

  static register(verb: string, handler: CommandHandler, spec: CommandSpec): void {
    CommandRouter._registry.set(verb.toLowerCase(), { handler, spec });
  }
  static beforeRoute(hook: () => Promise<void>): void { CommandRouter._beforeRoute.push(hook); }
  static verbs(): string[] { return [...CommandRouter._registry.keys()]; }
  static specFor(verb: string): CommandSpec | undefined { return CommandRouter._registry.get(verb.toLowerCase())?.spec; }
  // Registered verb -> its one-line usage, derived from the spec (drives [[help]]).
  static helpFor(verb: string): string | undefined {
    const def = CommandRouter._registry.get(verb.toLowerCase());
    return def && describeCommandSpec(verb.toLowerCase(), def.spec);
  }
  static help(): { verb: string; help: string }[] {
    return [...CommandRouter._registry.entries()].map(([verb, def]) => ({ verb, help: describeCommandSpec(verb, def.spec) }));
  }

  // Routes one command body to its handler; returns the OOC replacement text
  // (always a single line - the host strips newlines from inputText).
  static async route(body: string, ctx: CommandContext = {}): Promise<string> {
    const cmd = CommandParser.parse(body);
    for (const hook of CommandRouter._beforeRoute) await hook();
    const def = CommandRouter._registry.get(cmd.name);
    if (!def) return sys(`Unknown command "${cmd.name}". Available: ${CommandRouter.verbs().join(", ")}.`);
    return def.handler(cmd, ctx);
  }
}
//#endregion src/command.ts

//#region src/services.ts
// =============================================================================
// STORAGE & LOREBOOK MANAGERS - the script's editable database layer
// -----------------------------------------------------------------------------
// ScopedStorage namespaces storage under a uuid prefix (the script id by
// default) and pairs every persistent method with a temp* variant on
// api.v1.tempStorage - volatile scratch state the host clears when the script
// unloads. LorebookManager reads lorebook entries as data: rule lists live in
// entries whose text is a newline list (or JSON) beneath a human-readable
// header, so the user edits game data like a database table in the lorebook UI.
// =============================================================================
class ScopedStorage {
  constructor(public readonly StoragePrefix: string = api.v1.script.id) {}

  private _key(key: string): string { return `${this.StoragePrefix}_${key}`; }

  async get(key: string): Promise<unknown> {
    return api.v1.storyStorage.get(this._key(key));
  }
  async getOrDefault<T>(key: string, fallback: T): Promise<T> {
    const v = await this.get(key);
    return v === undefined ? fallback : v as T;
  }
  async set(key: string, value: unknown): Promise<void> {
    await api.v1.storyStorage.set(this._key(key), value);
  }
  // Writes only when the key is missing; returns whether it wrote.
  async setIfAbsent(key: string, value: unknown): Promise<boolean> {
    if (await this.has(key)) return false;
    await this.set(key, value);
    return true;
  }
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }
  // Returns whether the key existed before removal.
  async delete(key: string): Promise<boolean> {
    const existed = await this.has(key);
    await api.v1.storyStorage.remove(this._key(key));
    return existed;
  }
  // Keys this manager has set, with the storage prefix stripped back off.
  async list(): Promise<string[]> {
    const prefix = `${this.StoragePrefix}_`;
    return (await api.v1.storyStorage.list())
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
  }

  // temp*: same API against api.v1.tempStorage - scratch state the host clears
  // whenever the script unloads (refresh, session end, toggling it off/on).
  async tempGet(key: string): Promise<unknown> {
    return api.v1.tempStorage.get(this._key(key));
  }
  async tempGetOrDefault<T>(key: string, fallback: T): Promise<T> {
    const v = await this.tempGet(key);
    return v === undefined ? fallback : v as T;
  }
  async tempSet(key: string, value: unknown): Promise<void> {
    await api.v1.tempStorage.set(this._key(key), value);
  }
  async tempSetIfAbsent(key: string, value: unknown): Promise<boolean> {
    if (await this.tempHas(key)) return false;
    await this.tempSet(key, value);
    return true;
  }
  async tempHas(key: string): Promise<boolean> {
    return (await this.tempGet(key)) !== undefined;
  }
  async tempDelete(key: string): Promise<boolean> {
    const existed = await this.tempHas(key);
    await api.v1.tempStorage.remove(this._key(key));
    return existed;
  }
}

class LorebookManager {
  // The host API filters entries by category *id*; users think in category
  // *names* ("srd:abilities"), so resolve the name first.
  static async categoryIdByName(name: string): Promise<string | undefined> {
    const want = name.trim().toLowerCase();
    const categories = await api.v1.lorebook.categories();
    return categories.find(c => (c.name ?? "").trim().toLowerCase() === want)?.id;
  }

  static async entriesInCategory(categoryName: string): Promise<LorebookEntry[]> {
    const id = await LorebookManager.categoryIdByName(categoryName);
    if (id === undefined) return [];
    return api.v1.lorebook.entries(id);
  }

  // Text of the entry with the given displayName inside a category, or undefined.
  static async entryText(categoryName: string, displayName: string): Promise<string | undefined> {
    const want = displayName.trim().toLowerCase();
    for (const entry of await LorebookManager.entriesInCategory(categoryName)) {
      const label = (entry.displayName ?? (entry as { displayText?: string }).displayText ?? "").trim().toLowerCase();
      if (label === want) return entry.text;
    }
    return undefined;
  }

  // Everything above a marker line (>= 3 '=') is a human-readable header and is
  // ignored; the data is whatever follows. No marker -> the whole text is data.
  static contentBelowHeader(text: string): string {
    const m = text.match(/^[ \t]*={3,}[ \t]*$/m);
    return m && m.index !== undefined ? text.slice(m.index + m[0].length) : text;
  }

  // An entry's data as a list: one item per non-empty line, with '#'/'//' line
  // comments and /* */ block comments stripped. Items pass through the boundary
  // normalizer ("  Animal   Ken" -> "animal-ken") - lorebook data enters the
  // engine normalized, exactly like command arguments.
  static parseList(text: string): string[] {
    return LorebookManager.contentBelowHeader(text)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map(l => StringUtil.normalizeInput(l.replace(/(^|\s)(#|\/\/).*$/, "$1")))
      .filter(l => l.length > 0);
  }

  static async listFrom(categoryName: string, displayName: string): Promise<string[]> {
    const text = await LorebookManager.entryText(categoryName, displayName);
    return text === undefined ? [] : LorebookManager.parseList(text);
  }

  // Overwrite an entry's text (found by category + displayName). Returns
  // whether the entry existed. This is also what a player's manual lorebook
  // edit amounts to, so tests use it to simulate one.
  static async updateEntryText(categoryName: string, displayName: string, text: string): Promise<boolean> {
    const want = displayName.trim().toLowerCase();
    for (const entry of await LorebookManager.entriesInCategory(categoryName)) {
      if ((entry.displayName ?? "").trim().toLowerCase() === want) {
        await api.v1.lorebook.updateEntry(entry.id, { text });
        return true;
      }
    }
    return false;
  }

  static async allTalents(): Promise<string[]> { return LorebookManager.listFrom("srd:abilities", "srd:abilities:talents"); }
  static async allSkills(): Promise<string[]> { return LorebookManager.listFrom("srd:abilities", "srd:abilities:skills"); }
  static async allKnowledges(): Promise<string[]> { return LorebookManager.listFrom("srd:abilities", "srd:abilities:knowledges"); }
  static async allBackgrounds(): Promise<string[]> { return LorebookManager.listFrom("srd:backgrounds", "srd:backgrounds:all"); }

  // --- Bootstrap: create-if-missing + seed a tutorial -----------------------
  // Create a category if it doesn't exist; report whether we made it.
  static async ensureCategory(name: string): Promise<{ id: string; created: boolean }> {
    const existing = await LorebookManager.categoryIdByName(name);
    if (existing !== undefined) return { id: existing, created: false };
    // We keep the uuid (via api.v1.uuid()) so the category can be re-fetched or
    // recreated with the same id later. createCategory resolves to the new id.
    const id = await api.v1.lorebook.createCategory({ id: api.v1.uuid(), name, enabled: true });
    return { id, created: true };
  }

  // Create an entry unless one with that displayName already exists in the
  // category; returns whether it created it.
  static async ensureEntry(categoryId: string, displayName: string, text: string): Promise<boolean> {
    const want = displayName.trim().toLowerCase();
    const entries = await api.v1.lorebook.entries(categoryId);
    if (entries.some(e => (e.displayName ?? "").trim().toLowerCase() === want)) return false;
    await api.v1.lorebook.createEntry({ id: api.v1.uuid(), displayName, text, category: categoryId });
    return true;
  }

  // Ensure every SRD category exists, seeding tutorial/starter entries into any
  // we had to create. Categories the player already has are left untouched.
  // Returns what was created and a player-facing note asking them to review it
  // (null when nothing was created).
  static async bootstrap(specs: SrdCategorySpec[] = SRD_CATEGORIES): Promise<{ createdCategories: string[]; seededEntries: number; message: string | null }> {
    const created: string[] = [];
    let seeded = 0;
    for (const spec of specs) {
      const { id, created: madeCategory } = await LorebookManager.ensureCategory(spec.name);
      if (!madeCategory) continue; // respect existing player data
      created.push(spec.name);
      for (const entry of spec.entries) {
        if (await LorebookManager.ensureEntry(id, entry.displayName, entry.text)) seeded++;
      }
    }
    return { createdCategories: created, seededEntries: seeded, message: created.length ? LorebookManager._setupMessage(specs, created) : null };
  }

  private static _setupMessage(specs: SrdCategorySpec[], created: string[]): string {
    const lines = created.map(name => `• ${name} — ${specs.find(s => s.name === name)?.blurb ?? "game data"}`);
    return [
      sys("Storyteller setup"),
      "I've added the lorebook categories this game needs and filled them with starter data and examples. Open your Lorebook and review / edit:",
      ...lines,
      `Each entry starts with instructions; the data is below its "${SRD_HEADER_MARKER}" line. Tune these to your chronicle, then we’re ready to play.`,
    ].join("\n");
  }
}

// =============================================================================
// TRACKED CARDS - virtual subcategories, id map, backups, reconciliation
// -----------------------------------------------------------------------------
// NovelAI lorebook categories cannot nest, so nesting is CONCEPTUAL and this
// module owns the illusion (the subcategory policy, memory.md 7.21):
// a virtual path "a::b" (user input, folds to "a:b") maps to the REAL category
// named "wod:a:b"; every engine-owned category has a default entry "general" -
// the default write target. Every card the engine writes is TRACKED: its
// category/entry uuids live in the storyStorage id map (lb:ids) and its full
// text is backed up (lb:backup:<category>/<entry>) on every write and every
// healthy sighting. reconcileTracked() detects uuid drift: a card deleted and
// recreated with identical structure is re-adopted silently (we point our map
// at the NEW uuid - ids only have meaning through the map, so nothing is ever
// destroyed to preserve one); a structural conflict or a plain deletion is
// returned as a finding for the UI (game.ts opens the modal).
// =============================================================================
const GENERAL_ENTRY = "general";

// Default tutorial headers for engine-seeded `general` cards.
const CONFIG_GENERAL_HEADER = [
  "Global configuration for this chronicle. The JSON below the marker holds",
  "story-wide settings (none are read yet - this card is the documented home",
  "for future global options). Edit in creator mode.",
];
const TABLE_GENERAL_HEADER = [
  "Success tables for this category. The JSON below the marker is an array of",
  "tables (or a map name -> table). [[define-table]] writes here; you may add",
  "MORE cards to this category to split a large set - every card is read, and",
  "a later card's table shadows an earlier one with the same name.",
];

// Content-only structural hash: the tutorial header above the marker never
// participates, so editing instructions can't trip a conflict. JSON bodies are
// canonicalized (recursively sorted keys); anything unparseable falls back to
// whitespace-collapsed text. djb2, hex.
function structuralHash(text: string): string {
  const body = LorebookManager.contentBelowHeader(text).trim();
  const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon)
    : (v && typeof v === "object")
      ? Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map(k => [k, canon((v as Record<string, unknown>)[k])]))
      : v;
  let s: string;
  try { s = JSON.stringify(canon(JSON.parse(body))); } catch { s = body.replace(/\s+/g, " "); }
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

interface ReconcileFinding {
  category: string;
  entry: string;
  kind: "adopted" | "conflict" | "missing";
  backupText?: string;
  foundId?: string;
  foundText?: string;
}

class TrackedLorebook {
  private static _storage = new ScopedStorage();
  private static readonly IDS_KEY = "lb:ids";
  private static _backupKey(category: string, entry: string): string { return `lb:backup:${category}/${entry}`; }

  private static async _ids(): Promise<Record<string, string>> {
    return ((await TrackedLorebook._storage.get(TrackedLorebook.IDS_KEY)) as Record<string, string> | undefined) ?? {};
  }
  private static async _saveIds(map: Record<string, string>): Promise<void> {
    await TrackedLorebook._storage.set(TrackedLorebook.IDS_KEY, map);
  }

  static async remember(category: string, entry: string | undefined, id: string): Promise<void> {
    const map = await TrackedLorebook._ids();
    map[entry === undefined ? `cat:${category}` : `ent:${category}/${entry}`] = id;
    await TrackedLorebook._saveIds(map);
  }
  static async idFor(category: string, entry?: string): Promise<string | undefined> {
    return (await TrackedLorebook._ids())[entry === undefined ? `cat:${category}` : `ent:${category}/${entry}`];
  }
  static async backupOf(category: string, entry: string): Promise<string | undefined> {
    return (await TrackedLorebook._storage.get(TrackedLorebook._backupKey(category, entry))) as string | undefined;
  }
  static async refreshBackup(category: string, entry: string, text: string): Promise<void> {
    await TrackedLorebook._storage.set(TrackedLorebook._backupKey(category, entry), text);
  }

  // Stop tracking a card (the player chose to let it go): map records + backup.
  static async forget(category: string, entry: string): Promise<void> {
    const map = await TrackedLorebook._ids();
    delete map[`ent:${category}/${entry}`];
    await TrackedLorebook._saveIds(map);
    await TrackedLorebook._storage.delete(TrackedLorebook._backupKey(category, entry));
  }

  // Every tracked card, as {category, entry} pairs (from the ent: map keys).
  static async trackedEntries(): Promise<{ category: string; entry: string }[]> {
    return Object.keys(await TrackedLorebook._ids())
      .filter(k => k.startsWith("ent:"))
      .map(k => {
        const [category, entry] = k.slice(4).split("/");
        return { category, entry };
      });
  }

  // Compare every tracked card against reality. Identical recreations are
  // adopted HERE (map re-pointed, backup refreshed); conflicts and deletions
  // are returned for the UI to resolve.
  static async reconcile(): Promise<ReconcileFinding[]> {
    const findings: ReconcileFinding[] = [];
    for (const { category, entry } of await TrackedLorebook.trackedEntries()) {
      const knownId = await TrackedLorebook.idFor(category, entry);
      const entries = await LorebookManager.entriesInCategory(category);
      const byId = knownId ? entries.find(e => e.id === knownId) : undefined;
      if (byId) { await TrackedLorebook.refreshBackup(category, entry, byId.text ?? ""); continue; }
      const want = entry.trim().toLowerCase();
      const byName = entries.find(e => (e.displayName ?? "").trim().toLowerCase() === want);
      const backupText = await TrackedLorebook.backupOf(category, entry);
      if (byName) {
        if (backupText !== undefined && structuralHash(byName.text ?? "") === structuralHash(backupText)) {
          await TrackedLorebook.remember(category, entry, byName.id);
          await TrackedLorebook.refreshBackup(category, entry, byName.text ?? "");
          findings.push({ category, entry, kind: "adopted", foundId: byName.id });
        } else {
          findings.push({ category, entry, kind: "conflict", backupText, foundId: byName.id, foundText: byName.text ?? "" });
        }
      } else {
        findings.push({ category, entry, kind: "missing", backupText });
      }
    }
    return findings;
  }

  // Accept the player's replacement card as the tracked one.
  static async adopt(category: string, entry: string, id: string, text: string): Promise<void> {
    await TrackedLorebook.remember(category, entry, id);
    await TrackedLorebook.refreshBackup(category, entry, text);
  }
}

// Union of two config card texts (both must parse). Shapes are preserved from
// the FOUND (player's newer) card: map -> spread union; array-of-named-defs ->
// name-keyed union. The player's defs win collisions; backup-only defs are
// kept. The found card's header text stays. Undefined = not combinable.
function combineConfigTexts(backupText: string, foundText: string): string | undefined {
  const parse = (t: string): unknown => {
    try { return JSON.parse(LorebookManager.contentBelowHeader(t).trim()); } catch { return undefined; }
  };
  const backup = parse(backupText);
  const found = parse(foundText);
  if (backup === undefined || found === undefined) return undefined;
  // Everything up to (and including) the found card's marker line; the JSON
  // goes back on its own line below it.
  const header = foundText.slice(0, foundText.length - LorebookManager.contentBelowHeader(foundText).length);
  let combined: unknown;
  if (Array.isArray(backup) && Array.isArray(found)) {
    const byName = new Map<string, unknown>();
    const keyOf = (d: unknown): string | undefined => {
      const n = (d as { name?: unknown })?.name;
      return typeof n === "string" ? StringUtil.normalize(n) : undefined;
    };
    const extras: unknown[] = [];
    for (const list of [backup, found]) {
      for (const d of list) {
        const k = keyOf(d);
        if (k !== undefined) byName.set(k, d); else if (list === found) extras.push(d);
      }
    }
    combined = [...byName.values(), ...extras];
  } else if (backup && found && typeof backup === "object" && typeof found === "object" && !Array.isArray(backup) && !Array.isArray(found)) {
    combined = { ...(backup as Record<string, unknown>), ...(found as Record<string, unknown>) };
  } else {
    return undefined;
  }
  return `${header}\n${JSON.stringify(combined, null, 2)}`;
}

// =============================================================================
// CONFIG STORES - the generic shape of "wod:config" registries
// -----------------------------------------------------------------------------
// Every story-config registry works the same way: ONE lorebook entry under the
// wod:config category (tutorial header above the marker, JSON below), parsed as
// an array OR a name -> def map, cached module-level for synchronous reads,
// reloaded at init and on the creator-mode sync points. These two classes ARE
// that pattern; a concrete registry is an instance, not a re-implementation.
// Instances self-register into ALL_CONFIG_STORES so reload/reset sweep every
// registry - adding a registry never touches a sync point again.
// =============================================================================
const CONFIG_CATEGORY = "wod:config";

interface ConfigStoreLike {
  readonly entry: string;
  loadFromLorebook(): Promise<number>;
  reset(): void;
}

const ALL_CONFIG_STORES: ConfigStoreLike[] = [];

// Reload every config store from the lorebook; returns per-entry counts
// (init logs them; the creator-mode hook ignores them).
async function reloadAllConfigStores(): Promise<{ entry: string; count: number }[]> {
  const out: { entry: string; count: number }[] = [];
  for (const store of ALL_CONFIG_STORES) {
    out.push({ entry: store.entry, count: await store.loadFromLorebook() });
  }
  return out;
}

// Clear every config store back to its shipped defaults (tests).
function resetAllConfigStores(): void {
  for (const store of ALL_CONFIG_STORES) store.reset();
}

// The tutorial-above-the-marker entry text every store writes.
function configEntryText(header: string[], data: unknown): string {
  return [...header, SRD_HEADER_MARKER, JSON.stringify(data, null, 2)].join("\n");
}

// Parse an entry body as JSON; undefined when missing/unparseable (the entry
// stays for the player to fix - never destroyed by a bad edit).
function parseConfigBody(text: string | undefined): unknown {
  if (!text) return undefined;
  const body = LorebookManager.contentBelowHeader(text).trim();
  if (!body) return undefined;
  try { return JSON.parse(body); } catch { return undefined; }
}

// Normalize a parsed config body (array of named defs OR name -> def map) to
// a list of partials that carry their name. Shared by ListConfigStore and the
// TableLibrary's multi-card loader.
function parseNamedConfigList<T extends { name: string }>(parsed: unknown): Array<Partial<T> & { name: string }> {
  const list: Array<Partial<T> & { name: string }> = Array.isArray(parsed)
    ? parsed as Array<Partial<T> & { name: string }>
    : (parsed && typeof parsed === "object")
      ? Object.entries(parsed as Record<string, Partial<T>>).map(([name, d]) => ({ ...d, name } as Partial<T> & { name: string }))
      : [];
  return list.filter(d => d && typeof d.name === "string" && d.name.trim().length > 0);
}

// Write-through for a TRACKED card in any category: create the category/entry
// on first use, else update in place; record ids in the map and refresh the
// backup (deletion insurance + the reconciliation baseline).
async function writeTrackedEntry(categoryName: string, entryName: string, text: string): Promise<void> {
  const { id: categoryId } = await LorebookManager.ensureCategory(categoryName);
  await TrackedLorebook.remember(categoryName, undefined, categoryId);
  const created = await LorebookManager.ensureEntry(categoryId, entryName, text);
  if (!created) await LorebookManager.updateEntryText(categoryName, entryName, text);
  const want = entryName.trim().toLowerCase();
  const entry = (await api.v1.lorebook.entries(categoryId)).find(e => (e.displayName ?? "").trim().toLowerCase() === want);
  if (entry) await TrackedLorebook.remember(categoryName, entryName, entry.id);
  await TrackedLorebook.refreshBackup(categoryName, entryName, text);
}

// The wod:config family writes through the tracked path.
async function writeConfigEntry(entry: string, text: string): Promise<void> {
  await writeTrackedEntry(CONFIG_CATEGORY, entry, text);
}

// Ensure a VIRTUAL PATH exists: the real category `wod:<path>` plus its
// tracked `general` card (seeded with the given tutorial header + empty JSON
// when created; an existing card's text is never touched). The subcategory
// policy's one constructor.
async function ensurePath(virtualPath: string, generalHeader: string[] = ["Data for this category. JSON below the marker."]): Promise<{ category: string; createdEntry: boolean }> {
  const category = `wod:${StringUtil.normalize(virtualPath)}`;
  const { id: categoryId } = await LorebookManager.ensureCategory(category);
  await TrackedLorebook.remember(category, undefined, categoryId);
  const seeded = [...generalHeader, SRD_HEADER_MARKER, "[]"].join("\n");
  const createdEntry = await LorebookManager.ensureEntry(categoryId, GENERAL_ENTRY, seeded);
  const want = GENERAL_ENTRY;
  const entry = (await api.v1.lorebook.entries(categoryId)).find(e => (e.displayName ?? "").trim().toLowerCase() === want);
  if (entry) {
    await TrackedLorebook.remember(category, GENERAL_ENTRY, entry.id);
    await TrackedLorebook.refreshBackup(category, GENERAL_ENTRY, entry.text ?? seeded);
  }
  return { category, createdEntry };
}

// A list of named defs, JSON array (or name -> def map) in the entry, overlaid
// on optional shipped defaults: the overlay SHADOWS a same-named default;
// remove() only deletes overlay entries (a shadowed default resurfaces).
class ListConfigStore<T extends { name: string }> {
  readonly entry: string;
  private readonly _header: string[];
  private readonly _make: (raw: Partial<T> & { name: string }) => T;
  private readonly _defaults: T[];
  private readonly _onChanged?: (overlay: T[]) => void;
  private _overlay: T[] = [];

  constructor(opts: {
    entry: string;
    header: string[];
    make: (raw: Partial<T> & { name: string }) => T;
    defaults?: T[];
    // Fires on EVERY cache change (load/save/reset) - the seam for stores
    // whose consumers read a separate registry (success tables).
    onChanged?: (overlay: T[]) => void;
  }) {
    this.entry = opts.entry;
    this._header = opts.header;
    this._make = opts.make;
    this._defaults = opts.defaults ?? [];
    this._onChanged = opts.onChanged;
    ALL_CONFIG_STORES.push(this);
  }

  private _apply(overlay: T[]): void {
    this._overlay = overlay;
    this._onChanged?.(overlay);
  }

  get(name: string): T | undefined {
    const n = StringUtil.normalize(name);
    return this._overlay.find(d => d.name === n) ?? this._defaults.find(d => d.name === n);
  }
  all(): T[] {
    const names = new Set(this._overlay.map(d => d.name));
    return [...this._overlay, ...this._defaults.filter(d => !names.has(d.name))];
  }
  reset(): void { this._apply([]); }

  async loadFromLorebook(): Promise<number> {
    const parsed = parseConfigBody(await LorebookManager.entryText(CONFIG_CATEGORY, this.entry));
    this._apply(parseNamedConfigList<T>(parsed).map(d => this._make(d)));
    return this._overlay.length;
  }

  async save(defs: T[]): Promise<void> {
    await writeConfigEntry(this.entry, configEntryText(this._header, defs));
    this._apply(defs);
  }

  // Add or replace one def (by normalized name) and persist.
  async put(def: T): Promise<void> {
    await this.save([...this._overlay.filter(d => d.name !== def.name), def]);
  }

  // Remove an OVERLAY def; returns whether one existed (shipped defaults can
  // only be shadowed, never deleted).
  async remove(name: string): Promise<boolean> {
    const n = StringUtil.normalize(name);
    const rest = this._overlay.filter(d => d.name !== n);
    if (rest.length === this._overlay.length) return false;
    await this.save(rest);
    return true;
  }
}

// A name -> value map in the entry (the resource-overrides shape).
class MapConfigStore<V> {
  readonly entry: string;
  private readonly _header: string[];
  private _cache: Record<string, V> = {};

  constructor(opts: { entry: string; header: string[] }) {
    this.entry = opts.entry;
    this._header = opts.header;
    ALL_CONFIG_STORES.push(this);
  }

  current(): Record<string, V> { return this._cache; }
  reset(): void { this._cache = {}; }

  async loadFromLorebook(): Promise<number> {
    const parsed = parseConfigBody(await LorebookManager.entryText(CONFIG_CATEGORY, this.entry));
    this._cache = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ? parsed as Record<string, V>
      : {};
    return Object.keys(this._cache).length;
  }

  async save(map: Record<string, V>): Promise<void> {
    await writeConfigEntry(this.entry, configEntryText(this._header, map));
    this._cache = map;
  }
}

class MeritFlawRegistry {
  private static _defs: Map<string, MeritFlawDef> =
    new Map(DEFAULT_MERITS_FLAWS.map(d => [StringUtil.normalize(d.name), d]));

  static get(name: string): MeritFlawDef | undefined {
    return MeritFlawRegistry._defs.get(StringUtil.normalize(name));
  }
  static all(): MeritFlawDef[] { return [...MeritFlawRegistry._defs.values()]; }
  static register(def: MeritFlawDef): void {
    MeritFlawRegistry._defs.set(StringUtil.normalize(def.name), def);
  }
  static reset(): void {
    MeritFlawRegistry._defs = new Map(DEFAULT_MERITS_FLAWS.map(d => [StringUtil.normalize(d.name), d]));
  }

  // Merge lorebook definitions over the defaults: every entry in the
  // srd:merits-flaws category whose text parses as a JSON array of defs.
  // Returns how many definitions were registered.
  static async loadFromLorebook(): Promise<number> {
    let count = 0;
    for (const entry of await LorebookManager.entriesInCategory("srd:merits-flaws")) {
      // Data is the JSON array below the header marker; anything else is skipped.
      const body = LorebookManager.contentBelowHeader(entry.text ?? "").trim();
      if (!body.startsWith("[")) continue;
      try {
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed)) continue;
        for (const def of parsed) {
          if (def && typeof def.name === "string" && (def.kind === "merit" || def.kind === "flaw")) {
            MeritFlawRegistry.register(def as MeritFlawDef);
            count++;
          }
        }
      } catch {
        log(`[MERITS] Skipping unparseable lorebook entry: ${entry.displayName}`);
      }
    }
    return count;
  }
}

// --- LOREBOOK PARSER ---
// Builds zero-dot Stat maps from the lorebook ability/background lists (see
// LorebookManager): talents/skills/knowledges from srd:abilities, backgrounds
// from srd:backgrounds.
class LorebookParser {
  static async ParseFromApi(): Promise<{ abilities: Map<string, Stat>, backgrounds: Map<string, Stat> }> {
    const abilities = new Map<string, Stat>();
    const backgrounds = new Map<string, Stat>();

    const groups: Array<[string[], Category]> = [
      [await LorebookManager.allTalents(), Category.TALENT],
      [await LorebookManager.allSkills(), Category.SKILL],
      [await LorebookManager.allKnowledges(), Category.KNOWLEDGE],
    ];
    for (const [names, cat] of groups) {
      for (const name of names) abilities.set(StringUtil.normalize(name), new Stat(name, cat, 0));
    }
    for (const name of await LorebookManager.allBackgrounds()) {
      backgrounds.set(StringUtil.normalize(name), new Stat(name, Category.BACKGROUND, 0));
    }
    return { abilities, backgrounds };
  }
}
//#endregion src/services.ts

//#region src/state.ts
// =============================================================================
// STATE - the character model and every persistent store
// -----------------------------------------------------------------------------
// Everything durable lives here: the legacy LiveCharacter sheet objects, the
// PlayableCharacter records (lorebook = source of truth, storyStorage = the
// recoverable copy), the named/extended-roll and contest stores, players and
// aliases, the wod:config registries (instances of the generic config stores -
// see services.ts), and the live per-character state (resources, health,
// boosts, effect uses, afflictions). Handlers in game.ts act on this layer;
// nothing here parses or routes commands.
// =============================================================================
// `api` is the ambient host global (types in types/novelai/script-types.d.ts).

// --- LIVE CHARACTER SHEET ---
// One line of "what a reaction did to the packet", for auditability.
interface ReactionTrace { reaction: string; from: string; to: string; }
interface DamageReport {
  severity: SeverityName;  // the severity finally marked on the track
  incoming: number;        // packet intensity as it arrived (pre-reaction)
  intensity: number;       // packet intensity after reactions (what soak faced)
  soaked: number;
  applied: number;
  soakRoll: RollResult | null;
  original: string;        // packet.describe() before reactions
  resolved: string;        // packet.describe() after reactions
  trace: ReactionTrace[];  // every reaction that changed the packet, in order
  health: HealthSummary;
}
interface SoakReport {
  soakable: boolean;
  pool: number;
  soaked: number;
  roll: RollResult | null;
}

class LiveCharacter {
  private _xpRemaining: number = 0;
  private _downtimeRemaining: number = 0;

  // Extended state (populated by CharacterFactory; safe defaults keep the
  // original 7-argument constructor backwards compatible).
  public Health: HealthTrack = new HealthTrack();
  public Pools: Map<string, Pool> = new Map();
  public Virtues: Map<string, Stat> = new Map();
  public Traits: Map<string, Stat> = new Map(); // misc rated traits
  public Disciplines: Map<string, Stat> = new Map(); // rated supernatural powers (0-5)
  // Free-form prerequisite tags ("toreador", "revenant", "inconnu", ...) and
  // the Merits/Flaws taken against them.
  public Tags: Set<string> = new Set();
  public MeritsFlaws: Map<string, { def: MeritFlawDef; points: number }> = new Map();
  public Morality?: MoralityTrait;
  public Soak: SoakSpec = MORTAL_SOAK;
  // The character's say over incoming damage: reactions are folded over each
  // packet (in order) before soak, letting it rewrite or ignore parts of the
  // hit - a vampire turning bullets to bashing, a werewolf who cannot soak
  // silver, a vest eating the first few levels of a gunshot.
  public Reactions: DamageReaction[] = [];

  constructor(
    public readonly Name: string,
    public readonly Template: string,
    public readonly Rules: RulesetConfig,
    public readonly Attributes: Map<string, Stat>,
    public readonly Abilities: Map<string, Stat>,
    public readonly Backgrounds: Map<string, Stat>,
    public readonly Trackers: Map<string, Tracker>
  ) { }

  AwardXP(amount: number) { this._xpRemaining += amount; }
  AwardDowntime(amount: number) { this._downtimeRemaining += amount; }
  get XPRemaining(): number { return this._xpRemaining; }
  get DowntimeRemaining(): number { return this._downtimeRemaining; }

  SpendXPOnAttribute(statName: string) {
    const stat = this.Attributes.get(StringUtil.normalize(statName));
    if (!stat) throw new Error(`Attribute ${statName} not found.`);
    const cost = stat.Value * this.Rules.AttrXPMultiplier;
    if (this._xpRemaining < cost) throw new Error("Not enough XP.");
    stat.Allocate(PointSource.EXPERIENCE, 1, cost);
    this._xpRemaining -= cost;
  }

  SpendDowntimeOnAttribute(statName: string) {
    if (!this.Rules.UsesDowntime) throw new Error(`${this.Template} does not use Downtime points.`);
    const stat = this.Attributes.get(StringUtil.normalize(statName));
    if (!stat) throw new Error(`Attribute ${statName} not found.`);
    const cost = this.Rules.AttrDowntimeCost;
    if (this._downtimeRemaining < cost) throw new Error("Not enough Downtime.");
    stat.Allocate(PointSource.DOWNTIME, 1, cost);
    this._downtimeRemaining -= cost;
  }

  // --- Trait lookup (used by soak and ad-hoc rolls) -----------------------
  TraitValue(name: string): number {
    const n = StringUtil.normalize(name);
    const s = this.Attributes.get(n) ?? this.Abilities.get(n) ?? this.Backgrounds.get(n)
      ?? this.Virtues.get(n) ?? this.Disciplines.get(n) ?? this.Traits.get(n);
    return s ? s.EffectiveValue : 0;
  }

  // --- Tags & Merits/Flaws --------------------------------------------------
  AddTag(tag: string): void { this.Tags.add(StringUtil.normalize(tag)); }
  RemoveTag(tag: string): void { this.Tags.delete(StringUtil.normalize(tag)); }
  HasTag(tag: string): boolean { return this.Tags.has(StringUtil.normalize(tag)); }
  HasMeritFlaw(name: string): boolean { return this.MeritsFlaws.has(StringUtil.normalize(name)); }

  // Prerequisite check: a template requirement is met if the character's
  // template name contains it (or it is present as a tag); listed tags and
  // merits/flaws must ALL be present. Returns every unmet requirement so the
  // Storyteller can decide whether to waive.
  MeetsRequirements(req: MeritFlawRequirements | undefined): { ok: boolean; missing: string[] } {
    if (!req) return { ok: true, missing: [] };
    const missing: string[] = [];
    if (req.templates && req.templates.length > 0) {
      const template = StringUtil.normalize(this.Template);
      const hit = req.templates.some(t => template.includes(StringUtil.normalize(t)) || this.HasTag(t));
      if (!hit) missing.push(`template:${req.templates.join("|")}`);
    }
    for (const t of req.tags ?? []) if (!this.HasTag(t)) missing.push(`tag:${StringUtil.normalize(t)}`);
    for (const m of req.meritsFlaws ?? []) if (!this.HasMeritFlaw(m)) missing.push(`merit-flaw:${StringUtil.normalize(m)}`);
    return { ok: missing.length === 0, missing };
  }

  // Take a merit/flaw by registry name or inline definition. The chosen point
  // value must be one the definition allows; prerequisites throw unless waived.
  AddMeritFlaw(nameOrDef: string | MeritFlawDef, opts: { points?: number; waivePrerequisites?: boolean } = {}): void {
    const def = typeof nameOrDef === "string" ? MeritFlawRegistry.get(nameOrDef) : nameOrDef;
    if (!def) throw new Error(`Unknown merit/flaw: ${nameOrDef}`);
    const key = StringUtil.normalize(def.name);
    if (this.MeritsFlaws.has(key)) throw new Error(`${def.name} is already taken.`);
    if (!opts.waivePrerequisites) {
      const check = this.MeetsRequirements(def.requires);
      if (!check.ok) throw new Error(`${def.name} prerequisites not met: ${check.missing.join(", ")}`);
    }
    const allowed = Array.isArray(def.points) ? def.points : [def.points];
    const points = opts.points ?? allowed[0];
    if (!allowed.includes(points)) {
      throw new Error(`${def.name} must be taken at one of [${allowed.join(", ")}] points, got ${points}.`);
    }
    this.MeritsFlaws.set(key, { def, points });
  }

  // Bookkeeping for the future freebie engine (merits cost, flaws grant).
  get MeritPointsSpent(): number {
    let n = 0;
    for (const { def, points } of this.MeritsFlaws.values()) if (def.kind === "merit") n += points;
    return n;
  }
  get FlawPointsGained(): number {
    let n = 0;
    for (const { def, points } of this.MeritsFlaws.values()) if (def.kind === "flaw") n += points;
    return n;
  }

  // --- Disciplines & rolls ------------------------------------------------
  DisciplineRating(name: string): number {
    const d = this.Disciplines.get(StringUtil.normalize(name));
    return d ? d.EffectiveValue : 0;
  }

  // Roll a pool as this character, folding in Discipline effects: `potence` adds
  // the character's Potence rating as automatic successes; `bonusDiceFrom` adds
  // each named trait/Discipline's rating as bonus dice (e.g. Celerity, Auspex).
  Roll(input: number | RollTrait[], opts: {
    difficulty?: number; nAgain?: number; rng?: Rng; label?: string;
    automaticSuccesses?: number; potence?: boolean; bonusDiceFrom?: string[];
  } = {}): RollResult {
    let automaticSuccesses = opts.automaticSuccesses ?? 0;
    if (opts.potence) automaticSuccesses += this.DisciplineRating("potence");
    let bonusDice = 0;
    for (const name of opts.bonusDiceFrom ?? []) bonusDice += this.TraitValue(name);
    let pool: number | RollTrait[];
    if (typeof input === "number") pool = Math.max(0, input + bonusDice);
    else pool = bonusDice > 0 ? [...input, { name: "bonus", value: bonusDice }] : input;
    return Dice.roll(pool, {
      difficulty: opts.difficulty, nAgain: opts.nAgain, rng: opts.rng,
      label: opts.label, automaticSuccesses,
    });
  }

  // --- Health & soak -------------------------------------------------------
  get WoundPenalty(): number { return this.Health.Penalty; }

  // Soak rule for a severity; harmless/fatal are not in the SoakSpec and are
  // treated as not soakable. Fortitude (a Discipline) lets a character soak a
  // severity their template normally can't - e.g. a ghoul soaking lethal - with
  // Fortitude dice. (Templates that already soak it, like a vampire, are
  // unaffected, so Fortitude is never double-counted.)
  private _soakRule(sev: Severity): SoakTypeRule {
    const base = sev === Severity.BASHING ? this.Soak.bashing
      : sev === Severity.LETHAL ? this.Soak.lethal
      : sev === Severity.AGGRAVATED ? this.Soak.aggravated
      : { soakable: false, pool: [] };
    if (!base.soakable && this.TraitValue("fortitude") > 0) {
      return { soakable: true, pool: ["fortitude"] };
    }
    return base;
  }

  SoakPoolFor(severity: Severity | SeverityName): number {
    const rule = this._soakRule(Severity.coerce(severity));
    if (!rule.soakable) return 0;
    return rule.pool.reduce((sum, t) => sum + this.TraitValue(t), 0);
  }

  RollSoak(severity: Severity | SeverityName, rng?: Rng): SoakReport {
    const sev = Severity.coerce(severity);
    const rule = this._soakRule(sev);
    if (!rule.soakable) return { soakable: false, pool: 0, soaked: 0, roll: null };
    const pool = this.SoakPoolFor(sev);
    if (pool <= 0) return { soakable: true, pool: 0, soaked: 0, roll: null };
    const roll = Dice.roll(pool, { difficulty: this.Soak.difficulty, rng, label: `${sev.Name} soak` });
    return { soakable: true, pool, soaked: Math.max(0, roll.net), roll };
  }

  // Fold this character's reactions over an incoming packet, recording each
  // change. The returned packet is what actually gets soaked and applied.
  ResolveIncoming(packet: DamagePacket): { final: DamagePacket; trace: ReactionTrace[] } {
    let current = packet;
    const trace: ReactionTrace[] = [];
    for (const reaction of this.Reactions) {
      const next = reaction.Apply(current, this);
      if (next !== current) trace.push({ reaction: reaction.Label, from: current.describe(), to: next.describe() });
      current = next;
    }
    return { final: current, trace };
  }

  // The full pipeline: let the character reshape the packet, then soak (if the
  // resolved packet still permits it) and mark the remainder on the track.
  TakePacket(packet: DamagePacket, opts: { soak?: boolean; rng?: Rng } = {}): DamageReport {
    const { final, trace } = this.ResolveIncoming(packet);
    const doSoak = (opts.soak ?? true) && final.Soakable;
    let soaked = 0;
    let soakRoll: RollResult | null = null;
    if (doSoak) {
      const r = this.RollSoak(final.Severity, opts.rng);
      soaked = r.soaked;
      soakRoll = r.roll;
    }
    const applied = Math.max(0, final.Intensity - soaked);
    this.Health.ApplyDamage(final.Severity, applied);
    return {
      severity: final.Severity.Name,
      incoming: packet.Intensity,
      intensity: final.Intensity,
      soaked, applied, soakRoll,
      original: packet.describe(),
      resolved: final.describe(),
      trace,
      health: this.Health.Summary(),
    };
  }

  // Convenience wrapper: build a bare packet (optionally tagged with kinds and a
  // source) and run it through TakePacket.
  TakeDamage(
    severity: Severity | SeverityName,
    intensity: number,
    opts: { soak?: boolean; rng?: Rng; kinds?: DamageKind[]; source?: DamageSource } = {}
  ): DamageReport {
    const packet = new DamagePacket({ intensity, severity, kinds: opts.kinds, source: opts.source });
    return this.TakePacket(packet, opts);
  }

  Heal(severity: Severity | SeverityName, amount: number): number { return this.Health.Heal(severity, amount); }

  // --- Resource pools ------------------------------------------------------
  private _tracker(name: string): Tracker {
    const t = this.Trackers.get(StringUtil.normalize(name));
    if (!t) throw new Error(`Tracker ${name} not found.`);
    return t;
  }

  GetPool(name: string): Pool {
    const p = this.Pools.get(StringUtil.normalize(name));
    if (!p) throw new Error(`Pool ${name} not found.`);
    return p;
  }

  SpendWillpower(amount: number = 1): void { this._tracker("willpower").Spend(amount); }
  RegainWillpower(amount: number = 1): void { this._tracker("willpower").Regain(amount); }
  SpendPool(name: string, amount: number, reason: string = ""): void { this.GetPool(name).Spend(amount, reason); }
  GainPool(name: string, amount: number, reason: string = ""): number { return this.GetPool(name).Gain(amount, reason); }

  // --- Storage serialization ----------------------------------------------
  // Writes the sheet under `char_<name>` via a ScopedStorage (prefixed with
  // the script id, preserving the historical `<scriptId>_char_<name>` key).
  async SaveToStory() {
    const storage = new ScopedStorage();

    // Extracting just the data needed for persistence to avoid circular JSON issues
    const serializedData = {
      name: this.Name,
      template: this.Template,
      xp: this._xpRemaining,
      downtime: this._downtimeRemaining,
      attributes: Array.from(this.Attributes.entries()).map(([k, v]) => ({ name: k, value: v.Value, effective: v.EffectiveValue })),
      abilities: Array.from(this.Abilities.entries()).map(([k, v]) => ({ name: k, value: v.Value })),
      backgrounds: Array.from(this.Backgrounds.entries()).map(([k, v]) => ({ name: k, value: v.Value })),
      trackers: Array.from(this.Trackers.entries()).map(([k, v]) => ({ name: k, perm: v.Value, temp: v.Temporary })),
      pools: Array.from(this.Pools.entries()).map(([k, v]) => ({ name: k, current: v.Current, max: v.Max })),
      virtues: Array.from(this.Virtues.entries()).map(([k, v]) => ({ name: k, value: v.Value })),
      traits: Array.from(this.Traits.entries()).map(([k, v]) => ({ name: k, value: v.Value })),
      disciplines: Array.from(this.Disciplines.entries()).map(([k, v]) => ({ name: k, value: v.Value })),
      tags: [...this.Tags],
      meritsFlaws: Array.from(this.MeritsFlaws.values()).map(({ def, points }) => ({ name: StringUtil.normalize(def.name), kind: def.kind, points })),
      morality: this.Morality ? { road: this.Morality.RoadName, value: this.Morality.Value, polarity: this.Morality.Polarity, unplayable: this.Morality.IsUnplayable } : null,
      health: this.Health.Summary(),
    };

    await storage.set(`char_${StringUtil.normalize(this.Name)}`, serializedData);
    return serializedData;
  }
}

// =============================================================================
// CHARACTER FACTORY - build a LiveCharacter from a TemplateConfig
// =============================================================================
interface CharacterCreationOptions {
  generation?: number;                   // Vampire blood-pool sizing
  road?: RoadDefinition;                 // override the template's default Road
  attributes?: Record<string, number>;   // optional seed (name -> dots)
  abilities?: Record<string, number>;
  backgrounds?: Record<string, number>;
  virtues?: Record<string, number>;       // Virtue dots (default 1 each)
  poolStarts?: Record<string, number>;    // chosen starting values for pools/trackers
  traits?: Record<string, number>;        // misc rated traits
  disciplines?: Record<string, number>;   // Discipline dots (e.g. { potence: 1, fortitude: 2 })
  tags?: string[];                        // prerequisite tags ("toreador", "revenant", ...)
  meritsFlaws?: Array<string | { name: string; points?: number; waive?: boolean }>;
  reactions?: DamageReaction[];           // extra damage reactions (e.g. worn armour), appended after the template's
}

class CharacterFactory {
  static create(template: TemplateConfig, name: string, opts: CharacterCreationOptions = {}): LiveCharacter {
    const attributes = CharacterFactory._statMap(opts.attributes, Category.PHYSICAL);
    const abilities = CharacterFactory._statMap(opts.abilities, Category.SKILL);
    const backgrounds = CharacterFactory._statMap(opts.backgrounds, Category.BACKGROUND);
    const traits = CharacterFactory._statMap(opts.traits, Category.VITAL);
    const disciplines = CharacterFactory._statMap(opts.disciplines, Category.DISCIPLINE);
    const virtuesProvided = opts.virtues !== undefined;
    const road = opts.road ?? template.Morality?.road ?? ROAD_OF_HUMANITY;

    // Virtues (1-5) - only for templates that use them.
    const virtues = new Map<string, Stat>();
    if (template.HasVirtues) {
      for (const v of road.virtues) {
        const key = StringUtil.normalize(v);
        const dots = opts.virtues?.[v] ?? opts.virtues?.[key] ?? 1;
        virtues.set(key, new Stat(v, Category.VIRTUE, dots, 5, 5));
      }
    }

    // Trackers & pools, honouring per-template starting-value constraints.
    const trackers = new Map<string, Tracker>();
    const pools = new Map<string, Pool>();
    for (const def of template.Pools) {
      const key = StringUtil.normalize(def.name);
      const explicit = opts.poolStarts?.[def.name] ?? opts.poolStarts?.[key];
      const chosen = CharacterFactory._resolveStart(def, explicit);
      if (def.kind === "tracker") {
        trackers.set(key, new Tracker(def.name, Category.TRACKER, chosen, def.max, def.max));
      } else {
        let max = def.max;
        let perTurn = def.perTurnLimit ?? Infinity;
        let start = chosen;
        if (def.fromGeneration && opts.generation !== undefined) {
          const bs = bloodForGeneration(opts.generation);
          max = bs.max;
          perTurn = bs.perTurn;
          start = explicit !== undefined ? chosen : max; // default to a full pool
        }
        pools.set(key, new Pool(def.name, max, start, perTurn));
      }
    }

    // Derived start (Dark Ages): Willpower = Courage when the player set Virtues.
    if (template.HasVirtues && virtuesProvided && trackers.has("willpower")
        && opts.poolStarts?.["willpower"] === undefined) {
      const courage = virtues.get("courage");
      if (courage) trackers.set("willpower", new Tracker("willpower", Category.TRACKER, courage.Value, 10, 10));
    }

    const character = new LiveCharacter(
      name, template.Name, template.Rules, attributes, abilities, backgrounds, trackers
    );
    character.Pools = pools;
    character.Virtues = virtues;
    character.Traits = traits;
    character.Disciplines = disciplines;
    character.Soak = template.Soak;
    character.Health = new HealthTrack(template.HealthLevels);
    // Template reactions first (innate physiology), then per-character extras
    // like armour - so severity/kind rewrites happen before mitigation.
    character.Reactions = [...template.Reactions, ...(opts.reactions ?? [])];

    // Morality (a Road/Humanity, or an ascending Torment). Derive the start
    // from the two rating Virtues when the player engaged with Virtues.
    if (template.Morality) {
      const mc = template.Morality;
      let start = mc.start ?? (mc.polarity === "ascending" ? 0 : 5);
      if (mc.deriveFromVirtues && template.HasVirtues && virtuesProvided) {
        const r = mc.road ?? road;
        const [a, b] = r.ratingVirtues;
        start = (virtues.get(StringUtil.normalize(a))?.Value ?? 0) + (virtues.get(StringUtil.normalize(b))?.Value ?? 0);
      }
      character.Morality = new MoralityTrait(mc.name, start, { polarity: mc.polarity });
    }

    // Tags before merits/flaws, so tag-based prerequisites can be satisfied.
    for (const tag of opts.tags ?? []) character.AddTag(tag);
    for (const mf of opts.meritsFlaws ?? []) {
      if (typeof mf === "string") character.AddMeritFlaw(mf);
      else character.AddMeritFlaw(mf.name, { points: mf.points, waivePrerequisites: mf.waive });
    }

    return character;
  }

  private static _statMap(src: Record<string, number> | undefined, cat: Category): Map<string, Stat> {
    const m = new Map<string, Stat>();
    if (src) {
      for (const [k, v] of Object.entries(src)) {
        m.set(StringUtil.normalize(k), new Stat(k, cat, v, Math.max(5, v), Math.max(5, v)));
      }
    }
    return m;
  }

  // Validates a chosen starting value against the ResourceDef constraints.
  private static _resolveStart(def: ResourceDef, chosen: number | undefined): number {
    if (chosen === undefined) return def.start;
    if (def.startOptions && !def.startOptions.includes(chosen)) {
      throw new Error(`${def.name} must start at one of [${def.startOptions.join(", ")}], got ${chosen}.`);
    }
    const min = def.startMin ?? 0;
    const max = def.startMax ?? def.max;
    if (chosen < min || chosen > max) {
      throw new Error(`${def.name} must start between ${min} and ${max}, got ${chosen}.`);
    }
    return chosen;
  }
}

// =============================================================================
// PLAYABLE CHARACTERS - potential characters created via [[create-playable]]
// -----------------------------------------------------------------------------
// A PlayableCharacter is the persisted record of a (possibly in-progress)
// player character: a name, one or MORE templates (hybrids are legal; how
// multiple templates merge is resolved later, at build time), and allocation
// buckets that start empty ("everything unassigned").
//
// Source of truth is the LOREBOOK entry (category wod:player-characters), which
// the player may edit directly while creator mode is on; storyStorage carries a
// synced copy for fast access. Sync always flows lorebook -> storage, never the
// other way, except when the script itself changes a character (save() writes
// both, lorebook first).
// =============================================================================
const PLAYER_CHARACTERS_CATEGORY = "wod:player-characters";

interface PlayableCharacter {
  id: string;
  name: string;
  templates: string[];                    // normalized TEMPLATES keys, 1+
  stage: "potential" | "ready";           // potential = not yet buildable
  // Seeded at creation: Attributes at 1, Abilities at 0, Willpower at 0; the
  // remaining buckets are allocation space the player fills in.
  attributes: Record<string, number>;
  abilities: Record<string, number>;
  backgrounds: Record<string, number>;
  virtues: Record<string, number>;
  disciplines: Record<string, number>;
  traits: Record<string, number>;
  poolStarts: Record<string, number>;
  // name -> points; kind via the registry. Parameterized defs are owned as
  // "name:<param>" instances ("trait-affinity:melee" - typed with :: ).
  meritsFlaws: Record<string, number>;
  tags: string[];                         // free-form (clan, ghoul, ...)
  // trait -> specialty labels (VERBATIM case - display text). At most one
  // specialty applies per roll, chosen by the specialty= argument.
  specialties?: Record<string, string[]>;
}

class CharacterStore {
  private static _storage = new ScopedStorage();
  private static readonly CURRENT_KEY = "current-character";
  private static readonly DEFAULT_KEY = "default-character";
  private static _key(name: string): string { return `pc:${StringUtil.normalize(name)}`; }
  private static _entryName(name: string): string { return `pc:${StringUtil.normalize(name)}`; }

  // A fresh potential character: all nine Attributes at 1 (the free dot), every
  // ability at 0 (so the sheet lists them all), Willpower at 0 (no oWoD template
  // lacks it), and empty Merits/Flaws & Backgrounds. Other buckets fill in later.
  static async newPotential(name: string, templates: string[]): Promise<PlayableCharacter> {
    const attributes: Record<string, number> = {};
    for (const attr of ALL_ATTRIBUTES) attributes[StringUtil.normalize(attr)] = 1;
    const abilities: Record<string, number> = {};
    const abilityNames = [
      ...await LorebookManager.allTalents(),
      ...await LorebookManager.allSkills(),
      ...await LorebookManager.allKnowledges(),
    ];
    for (const ab of abilityNames) abilities[StringUtil.normalize(ab)] = 0;
    return {
      id: api.v1.uuid(),
      name,
      templates: templates.map(t => StringUtil.normalize(t)),
      stage: "potential",
      attributes, abilities,
      backgrounds: {}, virtues: {}, disciplines: {}, traits: {},
      poolStarts: { willpower: 0 },
      meritsFlaws: {},
      tags: [],
      specialties: {},
    };
  }

  // --- Active / default character selection ---------------------------------
  static async setCurrent(name: string): Promise<void> { await CharacterStore._storage.set(CharacterStore.CURRENT_KEY, StringUtil.normalize(name)); }
  static async setDefault(name: string): Promise<void> { await CharacterStore._storage.set(CharacterStore.DEFAULT_KEY, StringUtil.normalize(name)); }
  static async getDefaultName(): Promise<string | undefined> { return (await CharacterStore._storage.get(CharacterStore.DEFAULT_KEY)) as string | undefined; }

  // Names of every saved character (from the `pc:`-prefixed storage keys).
  static async listNames(): Promise<string[]> {
    return (await CharacterStore._storage.list()).filter(k => k.startsWith("pc:")).map(k => k.slice(3));
  }

  // The character to act as: the explicit current, else the default, else - when
  // exactly one character exists - that one. Undefined if nothing resolves.
  static async getCurrent(): Promise<PlayableCharacter | undefined> {
    const cur = (await CharacterStore._storage.get(CharacterStore.CURRENT_KEY)) as string | undefined;
    if (cur) { const c = await CharacterStore.load(cur); if (c) return c; }
    const def = await CharacterStore.getDefaultName();
    if (def) { const c = await CharacterStore.load(def); if (c) return c; }
    const names = await CharacterStore.listNames();
    if (names.length === 1) return CharacterStore.load(names[0]);
    return undefined;
  }

  private static _entryText(char: PlayableCharacter): string {
    return [
      `Player character sheet for ${StringUtil.toTitleCase(char.name)}. The JSON below the ${SRD_HEADER_MARKER} line is the`,
      "character's data. Edit it only while creator mode is on ([[creator-mode set=true]]);",
      "your edits are synced into the game when you issue any command or turn creator mode off.",
      SRD_HEADER_MARKER,
      JSON.stringify(char, null, 2),
    ].join("\n");
  }

  // Write-through save: lorebook entry (create or update) first, then storage.
  static async save(char: PlayableCharacter): Promise<void> {
    const { id: categoryId } = await LorebookManager.ensureCategory(PLAYER_CHARACTERS_CATEGORY);
    const want = CharacterStore._entryName(char.name);
    const entries = await api.v1.lorebook.entries(categoryId);
    const existing = entries.find(e => (e.displayName ?? "").trim().toLowerCase() === want);
    if (existing) {
      await api.v1.lorebook.updateEntry(existing.id, { text: CharacterStore._entryText(char) });
    } else {
      await api.v1.lorebook.createEntry({
        id: api.v1.uuid(), displayName: want, category: categoryId,
        text: CharacterStore._entryText(char),
      });
    }
    await CharacterStore._storage.set(CharacterStore._key(char.name), char);
  }

  static async load(name: string): Promise<PlayableCharacter | undefined> {
    return await CharacterStore._storage.get(CharacterStore._key(name)) as PlayableCharacter | undefined;
  }

  // Lorebook -> storage. The player's lorebook edits win; unparseable entries
  // are reported, not synced. Returns what happened for the OOC reply.
  static async syncFromLorebook(): Promise<{ synced: string[]; failed: string[] }> {
    const synced: string[] = [];
    const failed: string[] = [];
    for (const entry of await LorebookManager.entriesInCategory(PLAYER_CHARACTERS_CATEGORY)) {
      const label = (entry.displayName ?? "").trim();
      const body = LorebookManager.contentBelowHeader(entry.text ?? "").trim();
      if (!body.startsWith("{")) { if (label) failed.push(label); continue; }
      try {
        const char = JSON.parse(body) as PlayableCharacter;
        if (!char || typeof char.name !== "string" || !Array.isArray(char.templates)) { failed.push(label); continue; }
        await CharacterStore._storage.set(CharacterStore._key(char.name), char);
        synced.push(char.name);
      } catch {
        failed.push(label);
      }
    }
    return { synced, failed };
  }
}

// Resolve a trait name to its value from a character record's numeric buckets.
// Shared by the roll plumbing (game.ts) and CharacterBoosts' cap math.
// NOTE: returns the UN-ENHANCED base - Trait Enhancement folds in at the roll
// env (game.ts characterRollEnv), and XP pricing reads this base by design.
function resolveTraitFromRecord(char: PlayableCharacter, name: string): number {
  const n = StringUtil.normalize(name);
  const buckets = [char.attributes, char.abilities, char.backgrounds, char.virtues, char.disciplines, char.traits, char.poolStarts];
  for (const b of buckets) if (n in b) return b[n];
  return 0;
}

// --- OWNED MERIT INSTANCES + PASSIVE EFFECTS (the owned-power pattern) -------
// A character's meritsFlaws bucket maps instance keys ("iron-will",
// "trait-affinity:melee") to points. Resolution goes through the registry;
// unknown or malformed keys are skipped here and SURFACED by
// [[check-constraints]], never silently enforced.
interface OwnedMeritInstance {
  key: string;
  def: MeritFlawDef;
  param?: string;
  points: number;
}

function ownedMeritInstances(char: PlayableCharacter): OwnedMeritInstance[] {
  const out: OwnedMeritInstance[] = [];
  for (const [key, points] of Object.entries(char.meritsFlaws ?? {})) {
    const hit = resolveMeritInstance(key, n => MeritFlawRegistry.get(n));
    if (hit) out.push({ key: StringUtil.normalize(key), def: hit.def, param: hit.param, points });
  }
  return out;
}

// Every always-on op the character's merits grant ($param substituted,
// amounts scaled by points). Roll-op gates (actionTag/trait) are judged at
// the roll site.
function passiveOpsFor(char: PlayableCharacter): EffectOp[] {
  return ownedMeritInstances(char).flatMap(inst => passiveOpsOf(inst.def, inst.param, inst.points));
}

// Permanent per-trait enhancement totals (the "enhance" passive op): raises
// the EFFECTIVE trait everywhere and, advisorily, the advancement ceiling by
// the same amount. XP pricing keeps reading the un-enhanced base.
function enhancementsFor(char: PlayableCharacter): Record<string, number> {
  const out: Record<string, number> = {};
  for (const op of passiveOpsFor(char)) {
    if (op.op.toLowerCase() !== "enhance" || !op.target) continue;
    const t = StringUtil.normalize(op.target);
    out[t] = (out[t] ?? 0) + (op.amount ?? 1);
  }
  return out;
}

// =============================================================================
// NAMED ROLLS - a global, player-editable library of saved RollSpecs
// -----------------------------------------------------------------------------
// One lorebook entry IS the library: a JSON map { name: RollSpec } below the
// header marker in wod:named-rolls. Read fresh on every call (no storage mirror)
// so a player's hand edits are always live. Names normalize to single tokens.
// =============================================================================
const NAMED_ROLLS_CATEGORY = "wod:named-rolls";
const NAMED_ROLLS_ENTRY = "wod:named-rolls:library";

// The extended nature of a saved roll (a "named procedure"): its PRESENCE means
// invoking the roll launches an extended action instead of a single roll. These
// are DEFAULTS for that action; the `target` (successes to reach) is NOT here -
// it's the Storyteller's play-time call (e.g. a wall's height / ft-per-success),
// supplied at invoke.
interface ExtendedSavedConfig {
  intervals?: number;   // default max rolls (overridable at invoke)
  interval?: string;    // advisory spacing label ("1 turn")
  onBotch?: BotchPolicy; // default botch policy
}

// An OPPOSED saved roll: invoking it launches a resisted/contested action - or an
// extended contest (a race like Pursuit) - instead of a single roll, reusing the
// contest machinery. Like an extended roll's target, the OPPONENT is play-time
// input (vs=); the save only holds the shape. `pool` omitted => the opposition
// rolls the SAME pool (a symmetric contest, e.g. Str+Intimidation both sides).
interface OpposedSavedConfig {
  mode: ContestMode;               // "resisted" (your margin over theirs) | "contested" (higher wins)
  pool?: string;                   // the opposition's pool (default: the actor's own pool)
  vsDifficulty?: number;           // default difficulty for the opposition's roll
  extended?: ExtendedSavedConfig;  // present => an extended contest (both race to a target)
}

// A multi-stage procedure: the saved roll's OWN spec is step 1 (the entry); each
// step here is a FOLLOW-UP that applies when the entry's outcome matches `when`.
// Advisory (the "everything is data" pattern): invoking runs the entry and
// surfaces the matching next command(s); the Storyteller/player picks the branch.
// Auto-running the branches is a later pass, gated on the turn/flow system.
type ProcedureCondition = "always" | "on-success" | "on-fail" | "on-botch";
interface ProcedureStep {
  when: ProcedureCondition;
  roll: string;                    // "@savedname" - the follow-up roll to run
  note?: string;                   // what this step is, in fiction / ST guidance
}

// A saved roll is a RollSpec plus optional game-layer sidecars: `spend` (the
// resource/role token to pay), `specialty` (applied to the roll), `table` (read
// against the outcome), plus - for a "named procedure" - `extended` (invoking it
// launches an extended action), `opposed` (launches a contest), `steps` (a
// multi-stage sequence) and a `description` (rules prose). Sidecars stay OUT of
// the pure RollSpec - the roll pipeline never sees them - and are stored raw
// (resolved at invoke time, like every command argument).
type SavedRoll = RollSpec & {
  spend?: string; specialty?: string; table?: string;
  extended?: ExtendedSavedConfig; description?: string;
  opposed?: OpposedSavedConfig; steps?: ProcedureStep[];
};

// Pre-saved rolls seeded into a fresh chronicle's library (create-if-missing;
// never clobbers an existing library, so player edits/deletes stick). The set
// grows as DATA - these are the Dark Ages "Drama" named systems. Editable like
// any saved roll (they live in the lorebook after seeding).
const DEFAULT_NAMED_ROLLS: Record<string, SavedRoll> = {
  climbing: {
    pool: "dexterity+athletics", difficulty: 6, difficultyMod: 0, diceMod: 0, requires: 1, tags: ["climb"],
    table: "climbing", extended: { intervals: 10 },
    description: "Scaling vertical surfaces - cliff faces or walls. Roll Dexterity + Athletics (difficulty 6; grip-improving Disciplines such as Protean's Talons of the Beast or Vicissitude bone spurs reduce this to 4). Extended: each success moves the climber up ~10 feet (the Storyteller may vary the distance for easy slopes or tightly-bounded walls). Failure means no progress this interval; a botch can leave the climber stuck, panicked by the height, or falling.",
  },
};

class NamedRollStore {
  private static _text(map: Record<string, SavedRoll>): string {
    return [
      "Saved rolls for this chronicle: a JSON object { name: rollspec } below the",
      "marker. Invoke one with [[roll @name]]; edit this map freely by hand.",
      "Each spec: pool, difficulty (or difficultyExpr), difficultyMod, requires,",
      "diceMod, tags[], and optional sidecars applied on [[roll @name]]: spend",
      "(paid automatically), specialty (its die), table (reads the outcome).",
      SRD_HEADER_MARKER,
      JSON.stringify(map, null, 2),
    ].join("\n");
  }

  // The whole library ({} when the entry is missing or unparseable).
  static async all(): Promise<Record<string, SavedRoll>> {
    const text = await LorebookManager.entryText(NAMED_ROLLS_CATEGORY, NAMED_ROLLS_ENTRY);
    if (!text) return {};
    const body = LorebookManager.contentBelowHeader(text).trim();
    if (!body.startsWith("{")) return {};
    try {
      const o = JSON.parse(body);
      return (o && typeof o === "object" && !Array.isArray(o)) ? o as Record<string, SavedRoll> : {};
    } catch { return {}; }
  }

  static async get(name: string): Promise<SavedRoll | undefined> {
    return (await NamedRollStore.all())[StringUtil.normalize(name)];
  }
  static async names(): Promise<string[]> { return Object.keys(await NamedRollStore.all()); }

  // Write the library back (create the category/entry on first use).
  private static async _write(map: Record<string, SavedRoll>): Promise<void> {
    const { id } = await LorebookManager.ensureCategory(NAMED_ROLLS_CATEGORY);
    const text = NamedRollStore._text(map);
    const created = await LorebookManager.ensureEntry(id, NAMED_ROLLS_ENTRY, text);
    if (!created) await LorebookManager.updateEntryText(NAMED_ROLLS_CATEGORY, NAMED_ROLLS_ENTRY, text);
  }

  static async save(name: string, entry: SavedRoll): Promise<void> {
    const map = await NamedRollStore.all();
    map[StringUtil.normalize(name)] = entry;
    await NamedRollStore._write(map);
  }

  static async remove(name: string): Promise<boolean> {
    const map = await NamedRollStore.all();
    const key = StringUtil.normalize(name);
    if (!(key in map)) return false;
    delete map[key];
    await NamedRollStore._write(map);
    return true;
  }

  // Seed the starter library on a FRESH chronicle: if the library entry is
  // missing, create it with DEFAULT_NAMED_ROLLS. Never clobbers an existing
  // library (even an emptied one), so player edits and deletes persist across
  // loads. Returns how many were seeded (0 when the library already exists).
  static async seedDefaults(): Promise<number> {
    const existing = await LorebookManager.entryText(NAMED_ROLLS_CATEGORY, NAMED_ROLLS_ENTRY);
    if (existing) return 0;
    await NamedRollStore._write({ ...DEFAULT_NAMED_ROLLS });
    return Object.keys(DEFAULT_NAMED_ROLLS).length;
  }
}

// =============================================================================
// EXTENDED ROLLS - persistence for accumulating, interval-aware actions
// -----------------------------------------------------------------------------
// Story-scoped state (survives across turns and characters), keyed xroll:<id>,
// with a current-extended pointer so continue/status/cancel default to the
// action in progress. history-aware historyStorage is the eventual home.
// =============================================================================
class ExtendedRollStore {
  private static _storage = new ScopedStorage();
  private static readonly CURRENT_KEY = "current-extended";
  private static _key(id: string): string { return `xroll:${id}`; }

  static async save(a: ExtendedRoll): Promise<void> { await ExtendedRollStore._storage.set(ExtendedRollStore._key(a.id), a); }
  static async load(id: string): Promise<ExtendedRoll | undefined> {
    return (await ExtendedRollStore._storage.get(ExtendedRollStore._key(id))) as ExtendedRoll | undefined;
  }
  static async remove(id: string): Promise<void> { await ExtendedRollStore._storage.delete(ExtendedRollStore._key(id)); }
  static async setCurrent(id: string): Promise<void> { await ExtendedRollStore._storage.set(ExtendedRollStore.CURRENT_KEY, id); }
  static async currentId(): Promise<string | undefined> { return (await ExtendedRollStore._storage.get(ExtendedRollStore.CURRENT_KEY)) as string | undefined; }
  static async clearCurrent(): Promise<void> { await ExtendedRollStore._storage.delete(ExtendedRollStore.CURRENT_KEY); }

  static async ids(): Promise<string[]> {
    return (await ExtendedRollStore._storage.list()).filter(k => k.startsWith("xroll:")).map(k => k.slice(6));
  }

  // The action to act on: explicit id, else the current pointer (if still open),
  // else the single open action. Undefined if nothing resolves.
  static async resolve(id?: string): Promise<ExtendedRoll | undefined> {
    if (id) return ExtendedRollStore.load(id);
    const cur = await ExtendedRollStore.currentId();
    if (cur) { const a = await ExtendedRollStore.load(cur); if (a && a.status === "open") return a; }
    const open: ExtendedRoll[] = [];
    for (const xid of await ExtendedRollStore.ids()) {
      const a = await ExtendedRollStore.load(xid);
      if (a && a.status === "open") open.push(a);
    }
    return open.length === 1 ? open[0] : undefined;
  }
}

// =============================================================================
// EXTENDED CONTESTS - persistence (mirrors ExtendedRollStore)
// =============================================================================
class ExtendedContestStore {
  private static _storage = new ScopedStorage();
  private static readonly CURRENT_KEY = "current-contest";
  private static _key(id: string): string { return `xcontest:${id}`; }

  static async save(c: ExtendedContest): Promise<void> { await ExtendedContestStore._storage.set(ExtendedContestStore._key(c.id), c); }
  static async load(id: string): Promise<ExtendedContest | undefined> {
    return (await ExtendedContestStore._storage.get(ExtendedContestStore._key(id))) as ExtendedContest | undefined;
  }
  static async remove(id: string): Promise<void> { await ExtendedContestStore._storage.delete(ExtendedContestStore._key(id)); }
  static async setCurrent(id: string): Promise<void> { await ExtendedContestStore._storage.set(ExtendedContestStore.CURRENT_KEY, id); }
  static async currentId(): Promise<string | undefined> { return (await ExtendedContestStore._storage.get(ExtendedContestStore.CURRENT_KEY)) as string | undefined; }
  static async clearCurrent(): Promise<void> { await ExtendedContestStore._storage.delete(ExtendedContestStore.CURRENT_KEY); }
  static async ids(): Promise<string[]> {
    return (await ExtendedContestStore._storage.list()).filter(k => k.startsWith("xcontest:")).map(k => k.slice(9));
  }
  static async resolve(id?: string): Promise<ExtendedContest | undefined> {
    if (id) return ExtendedContestStore.load(id);
    const cur = await ExtendedContestStore.currentId();
    if (cur) { const c = await ExtendedContestStore.load(cur); if (c && c.status === "open") return c; }
    const open: ExtendedContest[] = [];
    for (const cid of await ExtendedContestStore.ids()) {
      const c = await ExtendedContestStore.load(cid);
      if (c && c.status === "open") open.push(c);
    }
    return open.length === 1 ? open[0] : undefined;
  }
}

// =============================================================================
// STORY CLOCK - when the story is, on a real (Gregorian) calendar
// -----------------------------------------------------------------------------
// One instant pair in storyStorage: `start` (when the chronicle begins, set by
// [[story-start]]) and `now` (the current story moment, moved by [[advance]]).
// Both are epoch SECONDS (UTC); the pure math lives in core/time.ts. In story
// storage so a future historyStorage migration (roadmap #11) makes UNDO rewind
// time too. Seeded create-if-missing with a Dark Ages default so the clock
// always exists; the player re-sets it once.
// =============================================================================
const DEFAULT_STORY_START = "1197-01-01-00";   // a canonical Dark Ages year; override with [[story-start]]

interface StoryClockState { start: number; now: number }

class StoryClock {
  private static _storage = new ScopedStorage();
  private static readonly KEY = "time:clock";

  static async get(): Promise<StoryClockState | undefined> {
    return (await StoryClock._storage.get(StoryClock.KEY)) as StoryClockState | undefined;
  }
  // Set (or reset) when the story begins; `now` snaps to the new start.
  static async setStart(epoch: number): Promise<StoryClockState> {
    const s: StoryClockState = { start: epoch, now: epoch };
    await StoryClock._storage.set(StoryClock.KEY, s);
    return s;
  }
  // Move the current moment by a duration (calendar-aware). Undefined if no clock.
  static async advance(dur: Duration): Promise<StoryClockState | undefined> {
    const c = await StoryClock.get();
    if (!c) return undefined;
    const s: StoryClockState = { start: c.start, now: addDuration(c.now, dur) };
    await StoryClock._storage.set(StoryClock.KEY, s);
    return s;
  }
  // Create the clock with the built-in default only if it is missing. Returns
  // whether it wrote (for the init log).
  static async seedDefault(): Promise<boolean> {
    const epoch = parseStoryDate(DEFAULT_STORY_START) as number;   // the constant is always valid
    return StoryClock._storage.setIfAbsent(StoryClock.KEY, { start: epoch, now: epoch });
  }
}

// =============================================================================
// DATE BOOK - named bookmarks in story time (storyStorage JSON map)
// -----------------------------------------------------------------------------
// A hand-namable set of instants ("siege-began", "yuletide"): save the current
// moment or an explicit date, forget one, list them, and measure between any two
// (see [[time-between]]). Keyed by normalized name; values are epoch seconds.
// =============================================================================
class DateBook {
  private static _storage = new ScopedStorage();
  private static readonly KEY = "time:dates";

  static async all(): Promise<Record<string, number>> {
    return await DateBook._storage.getOrDefault<Record<string, number>>(DateBook.KEY, {});
  }
  static async get(name: string): Promise<number | undefined> {
    return (await DateBook.all())[StringUtil.normalize(name)];
  }
  static async save(name: string, epoch: number): Promise<void> {
    const map = await DateBook.all();
    map[StringUtil.normalize(name)] = epoch;
    await DateBook._storage.set(DateBook.KEY, map);
  }
  static async remove(name: string): Promise<boolean> {
    const map = await DateBook.all();
    const key = StringUtil.normalize(name);
    if (!(key in map)) return false;
    delete map[key];
    await DateBook._storage.set(DateBook.KEY, map);
    return true;
  }
  static async names(): Promise<string[]> { return Object.keys(await DateBook.all()); }
}

// =============================================================================
// SCENES - the named unit of play, anchored to the story clock (§7.31)
// -----------------------------------------------------------------------------
// A scene (the book's basic unit: one location, as many turns as it needs) is
// NAMED, opens at the current story instant, and may declare a `turnLength`
// ("how long is a Turn here?" - 3s in combat, absent for a freeform dialogue
// scene that doesn't move the clock). `[[turn]]` advances by that length;
// downtime glosses the clock forward between scenes. `plan` is the ST's private
// outline (Pass B routes the AI's <hide> directives here + into Author's Note).
// Records are keyed by normalized name in storyStorage; `current-scene` points
// at the open one (mirrors ExtendedRollStore's id + current pattern).
// =============================================================================
type SceneStatus = "open" | "closed";

interface Scene {
  name: string;              // normalized key; rendered via disp()
  location?: string;         // the single location of the scene (verbatim display)
  chapter?: string;          // optional grouping label (Chapter/Story stay light for now)
  startedAt: number;         // story-clock instant when it opened (epoch seconds)
  endedAt?: number;          // when it closed
  turnLength?: Duration;     // a Turn's length here; absent = freeform (no clock move)
  turnsElapsed: number;
  status: SceneStatus;
  plan?: string;             // the ST's private outline (Pass B: <hide> -> here + Author's Note)
}

class SceneStore {
  private static _storage = new ScopedStorage();
  private static readonly CURRENT_KEY = "current-scene";
  private static _key(name: string): string { return `scene:${StringUtil.normalize(name)}`; }

  static async save(s: Scene): Promise<void> { await SceneStore._storage.set(SceneStore._key(s.name), s); }
  static async get(name: string): Promise<Scene | undefined> {
    return (await SceneStore._storage.get(SceneStore._key(name))) as Scene | undefined;
  }
  static async remove(name: string): Promise<boolean> { return SceneStore._storage.delete(SceneStore._key(name)); }
  static async names(): Promise<string[]> {
    return (await SceneStore._storage.list()).filter(k => k.startsWith("scene:")).map(k => k.slice(6));
  }
  static async currentName(): Promise<string | undefined> {
    return (await SceneStore._storage.get(SceneStore.CURRENT_KEY)) as string | undefined;
  }
  static async current(): Promise<Scene | undefined> {
    const n = await SceneStore.currentName();
    return n ? SceneStore.get(n) : undefined;
  }
  static async setCurrent(name: string): Promise<void> { await SceneStore._storage.set(SceneStore.CURRENT_KEY, StringUtil.normalize(name)); }
  static async clearCurrent(): Promise<void> { await SceneStore._storage.delete(SceneStore.CURRENT_KEY); }
}

// =============================================================================
// PLAYERS - the engine's first identity concept
// -----------------------------------------------------------------------------
// A player is just a normalized id string (no record): "storyteller" always
// exists; a single-player story has one more. `current-player` is whoever is
// issuing commands right now; `default-player` is what the "default" owner in
// alias scopes resolves to (the human, in a single-player story). Both default
// to "storyteller" until set.
// =============================================================================
class PlayerStore {
  static readonly STORYTELLER = "storyteller";
  private static _storage = new ScopedStorage();
  private static readonly CURRENT_KEY = "current-player";
  private static readonly DEFAULT_KEY = "default-player";

  static async current(): Promise<string> {
    return (await PlayerStore._storage.getOrDefault(PlayerStore.CURRENT_KEY, PlayerStore.STORYTELLER)) as string;
  }
  static async setCurrent(name: string): Promise<void> { await PlayerStore._storage.set(PlayerStore.CURRENT_KEY, StringUtil.normalize(name)); }
  static async getDefault(): Promise<string> {
    return (await PlayerStore._storage.getOrDefault(PlayerStore.DEFAULT_KEY, PlayerStore.STORYTELLER)) as string;
  }
  static async setDefault(name: string): Promise<void> { await PlayerStore._storage.set(PlayerStore.DEFAULT_KEY, StringUtil.normalize(name)); }
}

// =============================================================================
// ALIASES - names for characters, in three scopes (storyStorage)
// -----------------------------------------------------------------------------
// An alias is an @-prefixed name for a character ("@kat" -> katarina); real
// character names never start with @, so there is no shadowing. Scopes, most
// specific first: per-character (in-character knowledge - "@sire" means someone
// different to each childe; keys may be NPCs with no record), per-player, and
// global. A bare "@alias" walks the chain for the CURRENT character and player;
// explicit-scope tokens pin one level (post-normalization forms - users may
// type `::` for each `:`):
//   @global:alias
//   @player:<id|storyteller|default>:alias   ("default" -> the default player)
//   @char:<name|default>:alias                (also @character:...)
// Targets are normalized names and may name NPCs; resolving to an actual
// PlayableCharacter happens wherever the target is used.
// =============================================================================
type AliasScope = "global" | "player" | "character";
interface AliasMap {
  global: Record<string, string>;
  players: Record<string, Record<string, string>>;
  characters: Record<string, Record<string, string>>;
}
interface AliasRef { scope?: AliasScope; owner?: string; alias: string }

// "@..." token -> its parts, or undefined when malformed. Assumes the token is
// already normalized (the parser guarantees it).
function parseAliasToken(token: string): AliasRef | undefined {
  if (!token.startsWith("@") || token.length < 2) return undefined;
  const parts = token.slice(1).split(":").map(p => p.trim()).filter(p => p.length > 0);
  const RESERVED = ["global", "player", "char", "character"];
  // A scope keyword with the wrong number of parts is malformed, not an alias.
  if (parts.length === 1) return RESERVED.includes(parts[0]) ? undefined : { alias: parts[0] };
  if (parts.length === 2 && parts[0] === "global") return { scope: "global", alias: parts[1] };
  if (parts.length === 3 && parts[0] === "player") return { scope: "player", owner: parts[1], alias: parts[2] };
  if (parts.length === 3 && (parts[0] === "char" || parts[0] === "character")) return { scope: "character", owner: parts[1], alias: parts[2] };
  return undefined;
}

class AliasRegistry {
  private static _storage = new ScopedStorage();
  private static readonly KEY = "aliases";

  private static _empty(): AliasMap { return { global: {}, players: {}, characters: {} }; }
  static async all(): Promise<AliasMap> {
    const m = (await AliasRegistry._storage.get(AliasRegistry.KEY)) as AliasMap | undefined;
    return m ? { global: m.global ?? {}, players: m.players ?? {}, characters: m.characters ?? {} } : AliasRegistry._empty();
  }
  private static async _save(m: AliasMap): Promise<void> { await AliasRegistry._storage.set(AliasRegistry.KEY, m); }

  // Define (or overwrite) one alias. `owner` is required for player/character
  // scope and ignored for global. Everything is normalized on the way in.
  static async set(scope: AliasScope, owner: string | undefined, alias: string, target: string): Promise<void> {
    const a = StringUtil.normalize(alias);
    const t = StringUtil.normalize(target);
    const m = await AliasRegistry.all();
    if (scope === "global") m.global[a] = t;
    else if (scope === "player") { const o = StringUtil.normalize(owner ?? ""); (m.players[o] ??= {})[a] = t; }
    else { const o = StringUtil.normalize(owner ?? ""); (m.characters[o] ??= {})[a] = t; }
    await AliasRegistry._save(m);
  }

  // Remove one alias; returns whether it existed.
  static async remove(scope: AliasScope, owner: string | undefined, alias: string): Promise<boolean> {
    const a = StringUtil.normalize(alias);
    const m = await AliasRegistry.all();
    let existed = false;
    if (scope === "global") { existed = a in m.global; delete m.global[a]; }
    else if (scope === "player") { const o = m.players[StringUtil.normalize(owner ?? "")]; if (o) { existed = a in o; delete o[a]; } }
    else { const o = m.characters[StringUtil.normalize(owner ?? "")]; if (o) { existed = a in o; delete o[a]; } }
    if (existed) await AliasRegistry._save(m);
    return existed;
  }

  // Exact lookup in one scope (no chain).
  static async lookup(scope: AliasScope, owner: string | undefined, alias: string): Promise<string | undefined> {
    const a = StringUtil.normalize(alias);
    const m = await AliasRegistry.all();
    if (scope === "global") return m.global[a];
    if (scope === "player") return m.players[StringUtil.normalize(owner ?? "")]?.[a];
    return m.characters[StringUtil.normalize(owner ?? "")]?.[a];
  }

  // The chain: acting character -> current player -> global.
  static async resolve(alias: string, ctx: { charKey?: string; playerKey?: string }): Promise<string | undefined> {
    const a = StringUtil.normalize(alias);
    const m = await AliasRegistry.all();
    if (ctx.charKey) { const hit = m.characters[ctx.charKey]?.[a]; if (hit) return hit; }
    if (ctx.playerKey) { const hit = m.players[ctx.playerKey]?.[a]; if (hit) return hit; }
    return m.global[a];
  }
}

// =============================================================================
// CONFIG REGISTRIES - the story's wod:config entries, as generic store instances
// -----------------------------------------------------------------------------
// Each is ONE lorebook entry (tutorial header above the marker, JSON below),
// cached for synchronous reads and reloaded at init + the creator-mode sync
// points via reloadAllConfigStores() - instances self-register, so a new
// registry here never touches a sync point. Wizards and [[define-*]] commands
// WRITE these entries; creator mode hand-edits them - all UIs over the same
// data.
// =============================================================================
const RESOURCE_CONFIG_ENTRY = "wod:config:resources";
const CONSTRAINTS_ENTRY = "wod:config:constraints";
const AFFLICTIONS_ENTRY = "wod:config:afflictions";
// Success tables are NOT an entry: this names their category TREE (the
// virtual-subcategory policy) - wod:config:success-tables and
// wod:config:success-tables:<sub>.
const TABLES_CATEGORY = "wod:config:success-tables";

// The house-rule layer for resources: a map resourceName -> partial def.
const ResourceOverrides = new MapConfigStore<Partial<ResourceDef>>({
  entry: RESOURCE_CONFIG_ENTRY,
  header: [
    "Story overrides for resources (the house-rule layer). The JSON below the",
    "marker maps a resource name to the fields you want to change (start, max,",
    "roles, effect, effects, ...). A name that matches no template resource and",
    "carries kind/start/max adds a custom resource. [[configure-resources]]",
    "edits this for you; you may also edit it by hand in creator mode.",
  ],
});

// Success tables live in their OWN category tree (the virtual-subcategory
// policy): category wod:config:success-tables holds bare-named tables, and
// each virtual subcategory <sub> is the real category
// wod:config:success-tables:<sub> whose tables are addressed "<sub>::name".
// EVERY card in a table category is read (general first, then the others by
// name - a later card shadows an earlier one), so a large set can spill
// across cards; [[define-table]] always writes the general card. The registry
// projection lives in rolls.ts' pure SuccessTableRegistry, reseeded with the
// built-ins on every load/reset.
class TableLibraryStore {
  readonly entry = TABLES_CATEGORY;   // the reload/reset label (ConfigStoreLike)

  constructor() { ALL_CONFIG_STORES.push(this); }

  reset(): void { SuccessTableRegistry.reset(); }

  // The virtual subcategories that exist right now (real categories named
  // wod:config:success-tables:<sub>; deeper nesting is out of policy).
  async subcategories(): Promise<string[]> {
    const prefix = `${TABLES_CATEGORY}:`;
    return (await api.v1.lorebook.categories())
      .map(c => (c.name ?? "").trim().toLowerCase())
      .filter(n => n.startsWith(prefix))
      .map(n => n.slice(prefix.length))
      .filter(sub => sub.length > 0 && !sub.includes(":"))
      .sort();
  }

  async loadFromLorebook(): Promise<number> {
    SuccessTableRegistry.reset();
    let count = 0;
    const prefix = `${TABLES_CATEGORY}:`;
    for (const cat of await api.v1.lorebook.categories()) {
      const name = (cat.name ?? "").trim().toLowerCase();
      if (name !== TABLES_CATEGORY && !name.startsWith(prefix)) continue;
      const sub = name === TABLES_CATEGORY ? "" : name.slice(prefix.length);
      if (sub.includes(":")) continue;   // one level below success-tables only
      const entries = [...await api.v1.lorebook.entries(cat.id)].sort((a, b) => {
        const an = (a.displayName ?? "").trim().toLowerCase();
        const bn = (b.displayName ?? "").trim().toLowerCase();
        return (an === GENERAL_ENTRY ? 0 : 1) - (bn === GENERAL_ENTRY ? 0 : 1) || an.localeCompare(bn);
      });
      for (const e of entries) {
        for (const raw of parseNamedConfigList<SuccessTable>(parseConfigBody(e.text))) {
          const key = sub ? `${sub}:${StringUtil.normalize(raw.name)}` : StringUtil.normalize(raw.name);
          SuccessTableRegistry.register({ ...(raw as SuccessTable), name: key });
          count++;
        }
      }
    }
    return count;
  }

  // Add or replace one table in the addressed category's GENERAL card (the
  // engine's write target; player cards elsewhere in the category may shadow
  // it - reported so the reply can say so).
  async put(def: SuccessTable, sub?: string): Promise<{ shadowed: boolean }> {
    const path = sub ? `config:success-tables:${sub}` : "config:success-tables";
    const { category } = await ensurePath(path, TABLE_GENERAL_HEADER);
    const existing = parseNamedConfigList<SuccessTable>(
      parseConfigBody(await LorebookManager.entryText(category, GENERAL_ENTRY)));
    const list = [...existing.filter(d => StringUtil.normalize(d.name) !== def.name), def];
    await writeTrackedEntry(category, GENERAL_ENTRY, [...TABLE_GENERAL_HEADER, SRD_HEADER_MARKER, JSON.stringify(list, null, 2)].join("\n"));
    await this.loadFromLorebook();
    const key = sub ? `${sub}:${def.name}` : def.name;
    const now = SuccessTableRegistry.get(key);
    return { shadowed: JSON.stringify(now) !== JSON.stringify({ ...def, name: key }) };
  }

  // Remove one table from the addressed category's GENERAL card. Reports what
  // remains under that key afterwards (a player card or a built-in may still
  // define it).
  async remove(key: string): Promise<{ removed: boolean; still?: "built-in" | "another-card" }> {
    const n = StringUtil.normalize(key);
    const [sub, base] = n.includes(":") ? [n.slice(0, n.indexOf(":")), n.slice(n.indexOf(":") + 1)] : [undefined, n];
    const category = sub ? `${TABLES_CATEGORY}:${sub}` : TABLES_CATEGORY;
    const existing = parseNamedConfigList<SuccessTable>(
      parseConfigBody(await LorebookManager.entryText(category, GENERAL_ENTRY)));
    const rest = existing.filter(d => StringUtil.normalize(d.name) !== base);
    const removed = rest.length !== existing.length;
    if (removed) {
      await writeTrackedEntry(category, GENERAL_ENTRY, [...TABLE_GENERAL_HEADER, SRD_HEADER_MARKER, JSON.stringify(rest, null, 2)].join("\n"));
    }
    await this.loadFromLorebook();
    const now = SuccessTableRegistry.get(n);
    const still = now === undefined ? undefined
      : DEFAULT_SUCCESS_TABLES.some(d => StringUtil.normalize(d.name) === n) && JSON.stringify(now) === JSON.stringify({ ...DEFAULT_SUCCESS_TABLES.find(d => StringUtil.normalize(d.name) === n), name: n })
        ? "built-in" as const : "another-card" as const;
    return { removed, still };
  }
}

const TableLibrary = new TableLibraryStore();

// =============================================================================
// TABLE ALIASES - @shorthands for table keys (incl. "sub::name" paths)
// -----------------------------------------------------------------------------
// A flat storyStorage map, distinct from character aliases: position
// disambiguates the @ sigil (table= slot -> table alias), exactly like pool
// position means saved rolls. Targets are stored as normalized table KEYS and
// validated advisorily (an alias may point at a table defined later).
// =============================================================================
class TableAliases {
  private static _storage = new ScopedStorage();
  private static readonly KEY = "table-aliases";

  static async all(): Promise<Record<string, string>> {
    return ((await TableAliases._storage.get(TableAliases.KEY)) as Record<string, string> | undefined) ?? {};
  }
  static async set(alias: string, targetKey: string): Promise<void> {
    const map = await TableAliases.all();
    map[StringUtil.normalize(alias).replace(/^@/, "")] = StringUtil.normalize(targetKey);
    await TableAliases._storage.set(TableAliases.KEY, map);
  }
  static async remove(alias: string): Promise<boolean> {
    const map = await TableAliases.all();
    const key = StringUtil.normalize(alias).replace(/^@/, "");
    if (!(key in map)) return false;
    delete map[key];
    await TableAliases._storage.set(TableAliases.KEY, map);
    return true;
  }
  static async resolve(alias: string): Promise<string | undefined> {
    return (await TableAliases.all())[StringUtil.normalize(alias).replace(/^@/, "")];
  }
}

// Constraint groups: allow/deny rules over trait options. Entirely ST-defined
// (no built-in defaults); enforced at creation later, surfaced now via
// [[check-constraints]].
const ConstraintRegistry = new ListConfigStore<ConstraintGroup>({
  entry: CONSTRAINTS_ENTRY,
  header: [
    "Constraint groups: the story's allow/deny rules over Backgrounds and",
    "Merits/Flaws. The JSON array below the marker lists groups; each has a name,",
    "relation (exclusive|restricted|forbidden), domain",
    "(background|merit|flaw|meritflaw|any), members, optional max (exclusive),",
    "scope (templates/choices it applies to), and note. [[define-constraint]]",
    "edits this for you; you may also edit it by hand in creator mode.",
  ],
  make: makeConstraintGroup,
});

// Affliction definitions: shipped DEFAULT_AFFLICTIONS (the Feral Speech pair)
// overlaid by the entry; the overlay may SHADOW a built-in, and
// [[forget-affliction]] removes overlay entries only (the built-in resurfaces).
const AfflictionRegistry = new ListConfigStore<AfflictionDef>({
  entry: AFFLICTIONS_ENTRY,
  header: [
    "Affliction definitions for this chronicle (overlaid on the built-ins).",
    "The JSON array below the marker lists definitions; each has a name and",
    "optional bindings (required slots like \"target\"), duration, then",
    "(successor), mirror (affliction the target gains, bound back), tags",
    "(join the afflicted character's rolls) and note. [[define-affliction]]",
    "edits this for you; you may also edit it by hand in creator mode.",
  ],
  make: makeAfflictionDef,
  defaults: DEFAULT_AFFLICTIONS,
});

// =============================================================================
// CREATOR MODE - the "player is hand-editing the lorebook" flag
// -----------------------------------------------------------------------------
// While on, game.ts' beforeRoute hook re-syncs characters and every config
// store before each command, so lorebook edits are picked up live.
// =============================================================================
class CreatorMode {
  private static _storage = new ScopedStorage();
  static async enabled(): Promise<boolean> {
    return (await CreatorMode._storage.getOrDefault("creator-mode", false)) as boolean;
  }
  static async set(on: boolean): Promise<void> { await CreatorMode._storage.set("creator-mode", on); }
}

// One live affliction on someone: which definition, and what its slots are bound
// to (normalized names - possibly NPCs).
interface ActiveAffliction { def: string; bindings: Record<string, string>; note?: string }

class CharacterAfflictions {
  private static _storage = new ScopedStorage();
  private static _key(name: string): string { return `affl:${StringUtil.normalize(name)}`; }

  static async list(name: string): Promise<ActiveAffliction[]> {
    return ((await CharacterAfflictions._storage.get(CharacterAfflictions._key(name))) as ActiveAffliction[] | undefined) ?? [];
  }
  // Add or replace (same def) one affliction.
  static async afflict(name: string, affl: ActiveAffliction): Promise<void> {
    const rest = (await CharacterAfflictions.list(name)).filter(c => c.def !== affl.def);
    await CharacterAfflictions._storage.set(CharacterAfflictions._key(name), [...rest, affl]);
  }
  // Remove one affliction; returns the removed instance (bindings drive mirror-lifting).
  static async lift(name: string, defName: string): Promise<ActiveAffliction | undefined> {
    const n = StringUtil.normalize(defName);
    const all = await CharacterAfflictions.list(name);
    const hit = all.find(c => c.def === n);
    if (!hit) return undefined;
    await CharacterAfflictions._storage.set(CharacterAfflictions._key(name), all.filter(c => c.def !== n));
    return hit;
  }
  static async clear(name: string): Promise<void> { await CharacterAfflictions._storage.delete(CharacterAfflictions._key(name)); }

  // The tags every active affliction grants - merged into the character's rolls.
  static async tags(name: string): Promise<string[]> {
    const out: string[] = [];
    for (const c of await CharacterAfflictions.list(name)) {
      const def = AfflictionRegistry.get(c.def);
      if (def?.tags) out.push(...def.tags);
    }
    return out;
  }
}

// =============================================================================
// CHARACTER RESOURCES - live current values for a character's resources
// -----------------------------------------------------------------------------
// A character's resources are the union of its templates' ResourceDefs; current
// values live in story storage (res:<char>), defaulting to the record's chosen
// start (poolStarts), else the template default. Resolving by name OR role is how
// one resource fills another's job (Quintessence carrying role "resolve").
// history-aware historyStorage is the eventual home.
// =============================================================================
interface ResourceView { def: ResourceDef; current: number; max: number; }

class CharacterResources {
  private static _storage = new ScopedStorage();
  private static _key(name: string): string { return `res:${StringUtil.normalize(name)}`; }

  // The character's resources, with replacement applied: a resource whose
  // `replaces` names others HIDES them (their names then resolve to it).
  static defsFor(char: PlayableCharacter): ResourceDef[] {
    const defs = resourcesForTemplates(char.templates, ResourceOverrides.current());
    const replaced = new Set(defs.flatMap(d => (d.replaces ?? []).map(r => StringUtil.normalize(r))));
    return defs.filter(d => !replaced.has(StringUtil.normalize(d.name)));
  }

  // A resource by exact name, else by a role it fills ("use X as Y"), else as
  // the replacement for the requested resource.
  static resolveDef(char: PlayableCharacter, nameOrRole: string): ResourceDef | undefined {
    const key = StringUtil.normalize(nameOrRole);
    const defs = CharacterResources.defsFor(char);
    return defs.find(d => StringUtil.normalize(d.name) === key)
      ?? defs.find(d => (d.roles ?? []).some(r => StringUtil.normalize(r) === key))
      ?? defs.find(d => (d.replaces ?? []).some(r => StringUtil.normalize(r) === key));
  }

  private static _startOf(char: PlayableCharacter, def: ResourceDef): number {
    const chosen = char.poolStarts?.[StringUtil.normalize(def.name)];
    return Math.max(0, Math.min(chosen ?? def.start, def.max));
  }

  private static async _values(char: PlayableCharacter): Promise<Record<string, number>> {
    return ((await CharacterResources._storage.get(CharacterResources._key(char.name))) as Record<string, number> | undefined) ?? {};
  }

  static async current(char: PlayableCharacter, def: ResourceDef): Promise<number> {
    const values = await CharacterResources._values(char);
    const k = StringUtil.normalize(def.name);
    return k in values ? values[k] : CharacterResources._startOf(char, def);
  }

  static async all(char: PlayableCharacter): Promise<ResourceView[]> {
    const values = await CharacterResources._values(char);
    return CharacterResources.defsFor(char).map(def => {
      const k = StringUtil.normalize(def.name);
      return { def, current: k in values ? values[k] : CharacterResources._startOf(char, def), max: def.max };
    });
  }

  // Spend up to `amount` (never below 0); returns how much actually left the pool.
  static async spend(char: PlayableCharacter, nameOrRole: string, amount = 1): Promise<{ spent: number; def?: ResourceDef }> {
    const def = CharacterResources.resolveDef(char, nameOrRole);
    if (!def) return { spent: 0 };
    const values = await CharacterResources._values(char);
    const k = StringUtil.normalize(def.name);
    const have = k in values ? values[k] : CharacterResources._startOf(char, def);
    const spent = Math.max(0, Math.min(amount, have));
    values[k] = have - spent;
    await CharacterResources._storage.set(CharacterResources._key(char.name), values);
    return { spent, def };
  }

  // Restore up to max; returns the new value.
  static async gain(char: PlayableCharacter, nameOrRole: string, amount = 1): Promise<{ value: number; def?: ResourceDef }> {
    const def = CharacterResources.resolveDef(char, nameOrRole);
    if (!def) return { value: 0 };
    const values = await CharacterResources._values(char);
    const k = StringUtil.normalize(def.name);
    const have = k in values ? values[k] : CharacterResources._startOf(char, def);
    const value = Math.max(0, Math.min(have + amount, def.max));
    values[k] = value;
    await CharacterResources._storage.set(CharacterResources._key(char.name), values);
    return { value, def };
  }
}

// =============================================================================
// CHARACTER HEALTH - live damage for playable characters
// -----------------------------------------------------------------------------
// Stored as severity counts (hp:<char>) and rebuilt into a HealthTrack on
// demand (aggravated marks first, then lethal, then bashing) - so penalties,
// wrap-around and incapacitation all come from the real track. Custom squares/
// afflictions stay a LiveCharacter concern for now.
// =============================================================================
interface HealthCounts { bashing: number; lethal: number; aggravated: number; }
const HEAL_ORDER: (keyof HealthCounts)[] = ["aggravated", "lethal", "bashing"];

class CharacterHealth {
  private static _storage = new ScopedStorage();
  private static _key(name: string): string { return `hp:${StringUtil.normalize(name)}`; }

  static async counts(char: PlayableCharacter): Promise<HealthCounts> {
    return ((await CharacterHealth._storage.get(CharacterHealth._key(char.name))) as HealthCounts | undefined)
      ?? { bashing: 0, lethal: 0, aggravated: 0 };
  }

  static async track(char: PlayableCharacter): Promise<HealthTrack> {
    const c = await CharacterHealth.counts(char);
    const t = new HealthTrack(healthLevelsForTemplates(char.templates));
    if (c.aggravated > 0) t.ApplyDamage("aggravated", c.aggravated);
    if (c.lethal > 0) t.ApplyDamage("lethal", c.lethal);
    if (c.bashing > 0) t.ApplyDamage("bashing", c.bashing);
    return t;
  }

  static async summary(char: PlayableCharacter): Promise<HealthSummary> {
    return (await CharacterHealth.track(char)).Summary();
  }

  static async damage(char: PlayableCharacter, severity: keyof HealthCounts, amount: number): Promise<HealthSummary> {
    const c = await CharacterHealth.counts(char);
    c[severity] += Math.max(0, amount);
    await CharacterHealth._storage.set(CharacterHealth._key(char.name), c);
    return CharacterHealth.summary(char);
  }

  // Heal `amount` boxes among the allowed severities, worst first. Returns how
  // many were actually healed (you can't heal what isn't there).
  static async heal(char: PlayableCharacter, severities: string[], amount: number): Promise<{ healed: number; summary: HealthSummary }> {
    const allowed = new Set(severities.map(s => StringUtil.normalize(s)));
    const c = await CharacterHealth.counts(char);
    let left = Math.max(0, amount);
    let healed = 0;
    for (const sev of HEAL_ORDER) {
      if (left <= 0 || !allowed.has(sev)) continue;
      const take = Math.min(c[sev], left);
      c[sev] -= take; left -= take; healed += take;
    }
    await CharacterHealth._storage.set(CharacterHealth._key(char.name), c);
    return { healed, summary: await CharacterHealth.summary(char) };
  }
}

// =============================================================================
// CHARACTER BOOSTS - temporary attribute increases (e.g. blood-surged Strength)
// -----------------------------------------------------------------------------
// boost:<char> -> { attribute: bonus }. Rolls read these on top of the record's
// dots. Duration is Storyteller-adjudicated until a turn system exists;
// [[clear-boosts]] ends them.
// =============================================================================
class CharacterBoosts {
  private static _storage = new ScopedStorage();
  private static _key(name: string): string { return `boost:${StringUtil.normalize(name)}`; }

  static async all(char: PlayableCharacter): Promise<Record<string, number>> {
    return ((await CharacterBoosts._storage.get(CharacterBoosts._key(char.name))) as Record<string, number> | undefined) ?? {};
  }

  // Resolve which trait an "increase" op raises. The op's `target` is a
  // CONSTRAINT: an attribute group ("physical"), a whole record bucket
  // ("attributes", "abilities", "disciplines", ...), or a specific trait. A
  // group/bucket constraint needs the command's target argument to pick within
  // it; a specific trait needs none.
  static resolveIncreaseTarget(char: PlayableCharacter, constraint: string | undefined, targetArg: string | undefined):
    { trait: string } | { need: string } | { error: string } {
    const c = StringUtil.normalize(constraint ?? "attributes");
    const groups: Record<string, readonly string[]> = {
      physical: ATTRIBUTES.physical, social: ATTRIBUTES.social, mental: ATTRIBUTES.mental,
      attributes: ALL_ATTRIBUTES,
    };
    let allowed: string[] | undefined;
    if (c in groups) allowed = groups[c].map(a => StringUtil.normalize(a));
    else {
      const bucket = c === "abilities" ? char.abilities : c === "backgrounds" ? char.backgrounds
        : c === "disciplines" ? char.disciplines : c === "traits" ? char.traits : undefined;
      if (bucket) allowed = Object.keys(bucket);
    }
    if (!allowed) return { trait: c };   // the constraint IS the trait
    if (!targetArg) return { need: `pick one (${c})` };
    const t = StringUtil.normalize(targetArg);
    return allowed.includes(t) ? { trait: t } : { error: `${targetArg} is not a boostable trait here (allowed: ${c})` };
  }

  // Raise a trait's boost so the character's TOTAL (record dots + boost) never
  // exceeds `cap`; returns how much was actually added.
  static async add(char: PlayableCharacter, trait: string, amount: number, cap = Infinity): Promise<{ added: number; total: number }> {
    const key = StringUtil.normalize(trait);
    const map = await CharacterBoosts.all(char);
    const cur = map[key] ?? 0;
    const base = resolveTraitFromRecord(char, key);
    const added = Math.max(0, Math.min(amount, cap - (base + cur)));
    if (added > 0) {
      map[key] = cur + added;
      await CharacterBoosts._storage.set(CharacterBoosts._key(char.name), map);
    }
    return { added, total: cur + added };
  }

  static async clear(char: PlayableCharacter): Promise<void> {
    await CharacterBoosts._storage.delete(CharacterBoosts._key(char.name));
  }
}

// =============================================================================
// EFFECT USES - the usage ledger for limited effects
// -----------------------------------------------------------------------------
// Counts every application of a limited effect (uses:<char> -> count per
// resource:effect). Limits like "3/scene" are Storyteller-enforced until the
// turn system lands, but the counting is real - [[reset-uses]] clears it at a
// scene/turn change, and the future turn system inherits this data.
// =============================================================================
class EffectUses {
  private static _storage = new ScopedStorage();
  private static _key(name: string): string { return `uses:${StringUtil.normalize(name)}`; }
  private static _slot(resource: string, effectName: string): string {
    return effectName ? `${StringUtil.normalize(resource)}:${StringUtil.normalize(effectName)}` : StringUtil.normalize(resource);
  }

  static async counts(char: PlayableCharacter): Promise<Record<string, number>> {
    return ((await EffectUses._storage.get(EffectUses._key(char.name))) as Record<string, number> | undefined) ?? {};
  }
  static async record(char: PlayableCharacter, resource: string, effectName: string, n = 1): Promise<number> {
    const map = await EffectUses.counts(char);
    const slot = EffectUses._slot(resource, effectName);
    map[slot] = (map[slot] ?? 0) + n;
    await EffectUses._storage.set(EffectUses._key(char.name), map);
    return map[slot];
  }
  static async count(char: PlayableCharacter, resource: string, effectName: string): Promise<number> {
    return (await EffectUses.counts(char))[EffectUses._slot(resource, effectName)] ?? 0;
  }
  static async resetAll(char: PlayableCharacter): Promise<void> {
    await EffectUses._storage.delete(EffectUses._key(char.name));
  }
}

// =============================================================================
// WIZARD SESSION - persistence + the text medium for wizard.ts definitions
// -----------------------------------------------------------------------------
// One wizard may run at a time; its {definition, state, prompt} live in story
// storage so a session survives across turns. While active, plain (command-less)
// player input is treated as the reply - see processAdventureInput.
// =============================================================================
interface ActiveWizard { def: string; state: WizardStateData; prompt: WizardPrompt; }

class WizardSession {
  private static _storage = new ScopedStorage();
  private static readonly KEY = "wizard:active";
  static async get(): Promise<ActiveWizard | undefined> {
    return (await WizardSession._storage.get(WizardSession.KEY)) as ActiveWizard | undefined;
  }
  static async set(a: ActiveWizard): Promise<void> { await WizardSession._storage.set(WizardSession.KEY, a); }
  static async clear(): Promise<void> { await WizardSession._storage.delete(WizardSession.KEY); }
}
//#endregion src/state.ts

//#region src/game.ts
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

const RESOURCES_WIZARD: WizardDefinition = {
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

// Table reading for an EXTENDED interval. A value-per-success table (climbing:
// 10 ft/success) reports the ACCUMULATED total - "how far the whole action has
// gone", the distance climbed so far - because that is the point of an extended
// action: the climb ends when you have climbed the entire distance. Qualitative
// tables (degrees) still read this interval's own net, since each interval has
// its own quality. When the pool is empty (nothing banked, or a botch reset it)
// the value branch falls back to this interval's outcome flavour.
async function extendedTableNote(raw: string | undefined, outcome: RollOutcomeKind, net: number, accumulated: number): Promise<string> {
  if (!raw) return "";
  const ref = await resolveTableRef(raw);
  if (ref.error) return ref.error;
  const table = SuccessTableRegistry.get(ref.key!);
  if (!table) return `unknown table "${ref.key}" (see [[tables]])`;
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
async function execCharacterRoll(char: PlayableCharacter, spec: RollSpec, ctx: CommandContext): Promise<{ exec: RollExecution; notes: string[] }> {
  const tagged = await withAfflictionTags(char.name, spec);
  const poolTraits = poolTraitsOf(char, tagged.pool);
  const env = await characterRollEnv(char);
  const passive = passiveRollExtra(char, poolTraits, tagged.tags);
  const extra: Partial<RollModifier> = {};
  const p = passive.extra;
  if (p.difficultyMod) extra.difficultyMod = (extra.difficultyMod ?? 0) + p.difficultyMod;
  if (p.diceMod) extra.diceMod = (extra.diceMod ?? 0) + p.diceMod;
  if (p.autoSuccesses) extra.autoSuccesses = (extra.autoSuccesses ?? 0) + p.autoSuccesses;
  if (p.nAgain !== undefined) extra.nAgain = Math.min(extra.nAgain ?? 10, p.nAgain);
  if (env.penalty !== 0) extra.diceMod = (extra.diceMod ?? 0) + env.penalty;
  const exec = executeRoll(tagged, env.resolver, { rng: ctx.rng, extra });
  const notes = [...passive.notes, env.penalty !== 0 ? `wound penalty ${env.penalty}` : ""].filter(Boolean);
  return { exec, notes };
}

// Start an extended action and roll its first interval as `char`. THE one
// launcher - used by [[extended-roll]] and by invoking a saved extended roll.
// `base.requires` is forced to 1 by callers (each interval is a plain roll; the
// accumulated `target` is the extended goal). Reads `table` against the
// interval's net so each report shows what the successes MEAN (10 ft/success).
async function launchExtended(char: PlayableCharacter, base: RollSpec, opts: { target: number; maxRolls: number; interval: string; onBotch: BotchPolicy; label: string; table?: string; stepsTail?: string }, ctx: CommandContext): Promise<string> {
  const action: ExtendedRoll = {
    id: api.v1.uuid(), label: opts.label,
    base, target: opts.target, maxRolls: opts.maxRolls,
    interval: opts.interval, onBotch: opts.onBotch, table: opts.table,
    accumulated: 0, rollsUsed: 0, status: "open", log: [],
  };
  const { exec, notes } = await execCharacterRoll(char, base, ctx);
  const { action: after, note } = applyInterval(action, exec, char.name);
  await ExtendedRollStore.save(after);
  if (after.status === "open") await ExtendedRollStore.setCurrent(after.id);
  const extras = [...notes, await extendedTableNote(after.table, exec.outcome, exec.result?.net ?? 0, after.accumulated)].filter(Boolean).join("; ");
  const tail = after.status === "open" ? ` Continue with [[continue-roll]] (id ${after.id}).` : "";
  return sys(`${disp(char.name)} starts extended ${describeExtended(after)}. Interval 1: ${note}${extras ? ` (${extras})` : ""}.${tail}${opts.stepsTail ?? ""}`);
}

// Invoke a saved EXTENDED roll: the save holds the shape (pool, difficulty,
// tags, table, botch/interval defaults); the TARGET and any overrides come at
// play time. `requires=`/`target=` is the accumulated goal (the full climb).
async function launchExtendedFromSaved(char: PlayableCharacter, name: string, saved: SavedRoll, cmd: ParsedCommand, args: Partial<RollSpec>, ctx: CommandContext): Promise<string> {
  const intOf = (s: string | undefined): number | undefined => { if (s === undefined) return undefined; const v = parseInt(s, 10); return Number.isNaN(v) ? undefined : v; };
  const target = args.requires ?? intOf(cmd.named["target"]);
  if (target === undefined || target < 1) {
    return sys(`"${name}" is an extended roll - give it a target, e.g. [[roll @${name} requires=4]] (the successes = the whole action; for climbing, wall height / ft-per-success).`);
  }
  const cfg = saved.extended ?? {};
  const maxRolls = intOf(cmd.named["intervals"]) ?? cfg.intervals;
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
  let savedSpecialty: string | undefined;
  let savedTable: string | undefined;
  let savedSteps: ProcedureStep[] | undefined;
  if (args.pool.startsWith("@")) {
    // Saved roll: load the base spec, then apply the supplied overrides (pool is
    // never overridden, so passing `args` straight through to overrideSpec is safe).
    const name = StringUtil.normalize(args.pool.slice(1));
    const base = await NamedRollStore.get(name);
    if (!base) return sys(`No saved roll named "${name}". Try [[list-rolls]] or [[name-roll ${name} <pool> ...]].`);
    // A saved EXTENDED roll (a "named procedure") launches an extended action
    // instead of a single roll - the target is play-time input, not baked in.
    // An OPPOSED saved roll launches a contest; an EXTENDED one an extended
    // action. Both take play-time input (vs= / requires=) the save never bakes.
    if (base.opposed) return launchOpposedFromSaved(char, name, base, cmd, args, ctx);
    if (base.extended) return launchExtendedFromSaved(char, name, base, cmd, args, ctx);
    savedSpend = base.spend;         // auto-paid unless the command overrides spend=
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
  return sys(`${disp(char.name)} - ${formatExecution(exec)}${notes ? ` - ${notes}` : ""}${surfaceSteps(savedSteps, exec.outcome)}`);
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
    saved.opposed ? describeOpposedSaved(saved.opposed) : "",
    saved.extended ? describeExtendedSaved(saved.extended) : "",
    saved.steps && saved.steps.length ? `[${saved.steps.length}-step procedure]` : "",
    saved.spend ? `spend=${saved.spend}` : "",
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

// A procedure's full step list (for [[roll-info]]) - every step, condition first.
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
  if (specialty) saved.specialty = specialty;
  if (table) saved.table = table;
  if (description) saved.description = description;
  // A "named procedure": extended=true (or any extended knob) makes invoking it
  // launch an extended action; the target stays play-time input.
  const intOf = (s: string | undefined): number | undefined => { if (s === undefined) return undefined; const v = parseInt(s, 10); return Number.isNaN(v) ? undefined : v; };
  const intervals = intOf(cmd.named["intervals"]);
  const interval = cmd.named["interval"]?.trim();
  const onBotchRaw = cmd.named["on-botch"]?.trim();
  const extendedFlag = ["true", "yes", "1"].includes((cmd.named["extended"] ?? "").toLowerCase());
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
    const vsDiff = intOf(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
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
  return sys(`Saved rolls: ${items}. [[roll-info <name>]] for detail.`);
}

// Full detail of one saved roll: spec, sidecars, and the rules description.
async function cmdRollInfo(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`roll-info needs a name, e.g. [[roll-info climbing]]. [[list-rolls]] lists them.`);
  const key = StringUtil.normalize(name);
  const saved = await NamedRollStore.get(key);
  if (!saved) return sys(`No saved roll named "${key}". See [[list-rolls]].`);
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
  return sys(`Added step ${saved.steps.length} to "${key}": ${when} -> [[roll ${roll}]]${note ? ` (${note})` : ""}. Now a ${saved.steps.length}-step procedure - [[roll-info ${key}]] for the whole sequence.`);
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
  if (args.pool.startsWith("@")) return sys(`extended-roll takes a pool expression (e.g. strength+stamina), not a saved @name - invoke a saved extended roll with [[roll @name requires=<target>]].`);
  const intOf = (s: string | undefined): number | undefined => { if (s === undefined) return undefined; const v = parseInt(s, 10); return Number.isNaN(v) ? undefined : v; };
  const maxRolls = intOf(cmd.named["intervals"]) ?? 0;
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
  if (!char) return sys(`No active character. Select one with [[play name="..."]].`);
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

// Resolve the opposition named by vs= (a character, an @alias, or a bare label).
// No vs= => an ad-hoc "the-resistance"/"the-opposition" that rolls only literals.
async function resolveOpponent(cmd: ParsedCommand, mode: ContestMode): Promise<{ error?: string; oppChar?: PlayableCharacter; oppName: string }> {
  let oppArg = cmd.named["vs"]?.trim();
  if (oppArg?.startsWith("@")) {
    const ref = await resolveCharacterRef(oppArg);
    if (ref.error) return { error: ref.error, oppName: "" };
    oppArg = ref.name!;
  }
  const oppChar = oppArg ? await CharacterStore.load(oppArg) : undefined;
  const oppName = oppChar ? oppChar.name : (oppArg || (mode === "resisted" ? "the-resistance" : "the-opposition"));
  return { oppChar, oppName };
}

// Run ONE resisted/contested round: the actor rolls mySpec through the live env
// (spend + wound penalty, exactly like [[roll spend=...]]), the opposition rolls
// theirSpec, compareRolls adjudicates, and a table (override or a saved sidecar)
// reads the actor's winning margin. Returns a BODY string (the caller wraps it in
// sys - so a procedure can append its next-steps inside the same reply).
async function runSingleContest(mode: ContestMode, me: PlayableCharacter, mySpec: RollSpec, theirSpec: RollSpec, oppName: string, oppChar: PlayableCharacter | undefined, cmd: ParsedCommand, ctx: CommandContext, tableOverride?: string): Promise<string> {
  const spend = await applySpend(me, cmd, ctx, mySpec.tags, poolTraitsOf(me, mySpec.pool));
  if (spend.refuse) return `${disp(me.name)} can't: ${spend.refuse}.`;
  const myExtra: Partial<RollModifier> = { ...(spend.extra ?? {}) };
  const myEnv = await characterRollEnv(me);
  if (myEnv.penalty !== 0) myExtra.diceMod = (myExtra.diceMod ?? 0) + myEnv.penalty;
  const myExec = executeRoll(mySpec, myEnv.resolver, { rng: ctx.rng, extra: myExtra });
  const theirExec = await execContestSide(theirSpec, oppChar?.name, ctx.rng);
  const outcome = compareRolls(mode, myExec, theirExec);
  const t = contestTableInput(outcome);
  const notes = [outcome.note, await tableNote(tableOverride ?? cmd.named["table"], t.outcome, t.successes), spend.note].filter(Boolean).join("; ");
  return `${mode} - ${disp(me.name)}: ${formatExecution(myExec)} vs ${disp(oppName)}: ${formatExecution(theirExec)} - ${notes}`;
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
  const opp = await resolveOpponent(cmd, mode);
  if (opp.error) return sys(`${opp.error}`);
  const myTags = cmd.named["tags"] ? cmd.named["tags"].split(",").map(t => t.trim()).filter(Boolean) : undefined;
  const mySpec = await withAfflictionTags(me.name, makeRollSpec({ pool: myPool, difficulty: intOrUndef(cmd.named["difficulty"] ?? cmd.named["diff"]), tags: myTags }));
  const theirSpec = makeRollSpec({ pool: theirPool, difficulty: intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]) });
  return sys(await runSingleContest(mode, me, mySpec, theirSpec, opp.oppName, opp.oppChar, cmd, ctx));
}

// Invoke a saved OPPOSED roll: the save holds the actor's shape + the opposition
// descriptor (mode, opposing pool, default vs-difficulty); the OPPONENT is play-
// time input (vs=). opposed+extended launches an extended contest instead. Any
// `steps` are surfaced after the round (procedure composition).
async function launchOpposedFromSaved(char: PlayableCharacter, name: string, saved: SavedRoll, cmd: ParsedCommand, args: Partial<RollSpec>, ctx: CommandContext): Promise<string> {
  const opp = saved.opposed!;
  const mySpec = await withAfflictionTags(char.name, overrideSpec(saved, args));
  const oppRes = await resolveOpponent(cmd, opp.mode);
  if (oppRes.error) return sys(`${oppRes.error}`);
  const theirPool = cmd.named["vs-pool"]?.trim() || opp.pool || mySpec.pool;
  const theirDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]) ?? opp.vsDifficulty;
  if (opp.extended) return launchOpposedExtended(char, name, saved, opp, mySpec, theirPool, theirDiff, oppRes, cmd, args, ctx);
  const theirSpec = makeRollSpec({ pool: theirPool, difficulty: theirDiff });
  const body = await runSingleContest(opp.mode, char, mySpec, theirSpec, oppRes.oppName, oppRes.oppChar, cmd, ctx, saved.table);
  return sys(`${body}${surfaceSteps(saved.steps, undefined)}`);
}

// opposed + extended = an extended contest (a race like Pursuit). Both race to a
// play-time `target`; `rounds`/`intervals` cap it (falling back to the save).
async function launchOpposedExtended(char: PlayableCharacter, name: string, saved: SavedRoll, opp: OpposedSavedConfig, mySpec: RollSpec, theirPool: string, theirDiff: number | undefined, oppRes: { oppChar?: PlayableCharacter; oppName: string }, cmd: ParsedCommand, args: Partial<RollSpec>, ctx: CommandContext): Promise<string> {
  const cfg = opp.extended!;
  const target = args.requires ?? intOrUndef(cmd.named["target"]);
  if (target === undefined || target < 1) {
    return sys(`"${name}" is an extended contest - give it a target, e.g. [[roll @${name} requires=5 vs="Erik"]] (the successes = winning the race).`);
  }
  const maxRounds = intOrUndef(cmd.named["rounds"] ?? cmd.named["intervals"]) ?? cfg.intervals;
  if (maxRounds === undefined || maxRounds < 1) return sys(`"${name}" needs rounds=<max> (its save defines none), e.g. [[roll @${name} requires=${target} rounds=5 vs="Erik"]].`);
  const aSpec = makeRollSpec({ ...mySpec, requires: 1 });
  const bSpec = makeRollSpec({ pool: theirPool, difficulty: theirDiff, requires: 1 });
  const contest: ExtendedContest = {
    id: api.v1.uuid(), label: cmd.named["label"] ?? name,
    a: { name: char.name, base: aSpec, accumulated: 0, char: char.name },
    b: { name: oppRes.oppName, base: bSpec, accumulated: 0, char: oppRes.oppChar?.name },
    target, maxRounds,
    interval: cmd.named["interval"] ?? cfg.interval ?? "",
    onBotch: cmd.named["on-botch"] ? parseBotchPolicy(cmd.named["on-botch"]) : (cfg.onBotch ?? "fail"),
    rounds: 0, status: "open", log: [],
  };
  const aExec = await execContestSide(aSpec, char.name, ctx.rng);
  const bExec = await execContestSide(bSpec, oppRes.oppChar?.name, ctx.rng);
  const { contest: after, note } = applyContestRound(contest, aExec, bExec);
  await ExtendedContestStore.save(after);
  if (after.status === "open") await ExtendedContestStore.setCurrent(after.id);
  const tail = after.status === "open" ? ` Continue with [[continue-contest]] (id ${after.id}).` : "";
  return sys(`${disp(char.name)} opens ${describeContest(after)}. Round 1: ${note}.${tail}${surfaceSteps(saved.steps, undefined)}`);
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

// =============================================================================
// TIME - the story clock: set when it begins, advance it, read it, bookmark &
// measure. Real Gregorian dates (core/time.ts); the clock lives in storyStorage.
// =============================================================================
const NO_CLOCK = `No story clock yet - set when the story begins with [[story-start 1197-03-15-08]] (yyyy-mm-dd-hh).`;

// Resolve a date token for [[time-between]]: a saved bookmark, "now", "start",
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
  return sys(`The story begins ${formatStoryDate(s.start)}. Move time with [[advance-time 1d]]; read it with [[story-date]].`);
}

async function cmdAdvanceTime(cmd: ParsedCommand): Promise<string> {
  const before = await StoryClock.get();
  if (!before) return sys(NO_CLOCK);
  const dur = parseDuration(cmd.positional.join(" ").trim());
  if ("error" in dur) return sys(dur.error);
  const after = (await StoryClock.advance(dur))!;
  const span = diffCalendar(after.start, after.now);
  const since = after.now === after.start ? "back to the very beginning" : `${formatCalendarSpan(span)} since it began`;
  return sys(`Time advances: ${formatStoryDate(before.now)} -> ${formatStoryDate(after.now)} (${since}).`);
}

async function cmdStoryDate(): Promise<string> {
  const c = await StoryClock.get();
  if (!c) return sys(NO_CLOCK);
  if (c.now === c.start) return sys(`Story date: ${formatStoryDate(c.now)} - the story has just begun.`);
  const span = diffCalendar(c.start, c.now);
  return sys(`Story date: ${formatStoryDate(c.now)} - ${formatCalendarSpan(span)} since it began (${formatStoryDate(c.start)}).`);
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
  return sys(`Saved dates: ${items}. [[time-between <a> <b>]] measures any two.`);
}

async function cmdTimeBetween(cmd: ParsedCommand): Promise<string> {
  const a = cmd.positional[0]?.trim(), b = cmd.positional[1]?.trim();
  if (!a || !b) return sys(`time-between needs two dates, e.g. [[time-between start now]] or [[time-between siege-began 1197-12-25-00]] (each: a saved name, "now", "start", or yyyy-mm-dd-hh).`);
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
  return sys(`${disp(scene.name)}: turn ${scene.turnsElapsed}${n > 1 ? ` (+${n})` : ""} (${tag}).`);
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
  return sys(`Scene "${scene.name}" ends after ${scene.turnsElapsed} turn${scene.turnsElapsed === 1 ? "" : "s"}${spanBit}.`);
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
  return sys(`Scenes: ${items.join("; ")}. [[scene-info <name>]] for detail.`);
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
interface HideDirective { op: "append" | "overwrite"; content: string }

// Pull every <hide [op=...]>...</hide> block out of text. Returns the text with
// them removed and the directives in order (default op = append). PURE.
function extractHideBlocks(text: string): { cleaned: string; directives: HideDirective[] } {
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
async function processGeneratedText(text: string[]): Promise<string[] | undefined> {
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
async function reconcileLorebook(): Promise<string[]> {
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
  summary: "save a roll under a name; @name invokes it with its spend/specialty/table baked in (extended=true makes a procedure, opposed= makes a contest)",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>" },
    { key: "pool", kind: "positional", required: true, hint: "<pool>" }, ...ROLL_KNOBS,
    { key: "table", kind: "named", desc: "Success table read when the roll is invoked" },
    { key: "extended", kind: "named", type: "enum", options: ["true"], desc: "Make it an extended procedure (target supplied at invoke)" },
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
CommandRouter.register("story-start", cmdStoryStart, {
  summary: "set when the story begins (yyyy-mm-dd-hh)",
  params: [{ key: "date", kind: "positional", required: true, hint: "yyyy-mm-dd-hh", example: "1197-03-15-08" }],
});
CommandRouter.register("advance-time", cmdAdvanceTime, {
  summary: "move the story clock forward (s/m/h/d/w/mo/y)",
  params: [{ key: "duration", kind: "positional", required: true, hint: "<duration>", example: "2d 6h" }],
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

// "Quiet" verbs: read-only commands that only REPORT (list / show / query).
// Issuing one suppresses AI generation for the turn even amid prose - the
// player is querying the system, not narrating an action the Storyteller should
// continue. (Generation belongs to in-fiction ACTIONS - rolls, spends, damage,
// afflicting - not to operating the machine.) This is the game-layer "quiet the
// turn" policy; it stays OUT of the pure CommandSpec (which describes grammar).
// To silence another command's turn, add its verb here.
const QUIET_VERBS = new Set<string>([
  "help", "characters", "sheet", "list-rolls", "roll-info", "roll-status", "contest-status",
  "resources", "health", "tables", "constraints", "constraint",
  "check-constraints", "merits", "specialties", "affliction", "afflictions",
  "story-date", "dates", "time-between", "scenes", "scene-info",
]);

// Replace every [[command]] in the player's adventure-mode input with its
// [SYSTEM: ...] note, running commands in order. Generation is suppressed when
// the input was ONLY commands (no prose) OR any command was a QUIET (query) one
// - either way the player is operating the system, not advancing the story.
async function processAdventureInput(rawInputText: string): Promise<OnTextAdventureInputReturnValue | undefined> {
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
    if (QUIET_VERBS.has(CommandParser.parse(m[1]).name)) anyQuiet = true;
    out += await CommandRouter.route(m[1]);
    cursor = (m.index ?? 0) + m[0].length;
  }
  out += rawInputText.slice(cursor);

  const prose = rawInputText.replace(COMMAND_PATTERN, "").trim();
  // The host forbids newlines in inputText (it would replace them with spaces).
  return { inputText: out.replace(/\n/g, " "), stopGeneration: prose.length === 0 || anyQuiet };
}
//#endregion src/game.ts

//#region src/window.ts
// =============================================================================
// WINDOWS - api.v1.ui forms that EMIT commands (no separate execution path)
// -----------------------------------------------------------------------------
// A wizard-window is a UI over the command layer: it renders a form with UI
// Parts, binds fields to tempStorage via storageKey, and on submit composes a
// [[command]] string and routes it through the SAME CommandRouter every other
// command uses. The form itself is DERIVED from the verb's CommandSpec - the
// window duplicates no grammar: enum params render as button rows (from the
// spec's options, which reference the rules vocabularies), ints as number
// inputs, everything else as text inputs; composeCommand does the one
// sanitizing composition. Windows that need DOMAIN-driven fields (an affliction
// def's binding slots) will build their part tree by hand and still submit
// through composeCommand - the spec covers the static shape (next pass).
//
// A real NovelAI window can't render off-host, so the host mock records the
// part tree and lets tests fire button callbacks (see host.ts __ui* helpers) -
// which exercises the whole window -> command -> store path without a screen.
// =============================================================================

const WKEY = (verb: string, key: string): string => `win:${verb}:${key}`;

// A row of buttons behaving as a single-select: the current value is marked
// with a bullet; clicking one writes it to tempStorage and re-renders.
function selectorRow(part: UiPartHelpers, verb: string, p: ParamSpec, current: string, rerender: () => Promise<void>): UIPart {
  const buttons = (p.options ?? []).map(o => part.button({
    text: o === current ? `• ${o}` : o,
    callback: async () => { await api.v1.tempStorage.set(WKEY(verb, p.key), o); await rerender(); },
  }));
  return part.row({ content: [part.text({ text: `${p.desc ?? p.key}:` }), ...buttons] });
}

// --- THE PICKER (selection-widgets mode 2, docs/ui-parts.md) -----------------
// A dropdown substitute for lists too long to inline: a text input (typing
// stays live - mode 3) next to a "Choose <key>…" button that opens a MODAL
// with one button per option; the current value's button is marked ✅;
// picking writes the field's tempStorage key, closes the modal, and
// re-renders the window. `options` is a thunk so dynamic lists (affliction
// registry, tables) are read at open time.
interface PickerOption { value: string; label?: string }

async function openPickerModal(key: string, storageKey: string, options: () => Promise<PickerOption[]>, rerender: () => Promise<void>): Promise<void> {
  const part = api.v1.ui.part;
  const temp = api.v1.tempStorage;
  const current = String((await temp.get(storageKey)) ?? "").trim();
  const opts = await options();
  const handle = await api.v1.ui.modal.open({ title: `Choose ${key}`, size: "small", content: [] });
  const pick = (value: string) => async (): Promise<void> => {
    await temp.set(storageKey, value);
    await handle.close();
    await rerender();
  };
  await handle.update({ content: [part.column({ content: [
    ...opts.map(o => part.button({ text: `${o.value === current ? "✅ " : ""}${o.label ?? o.value}`, callback: pick(o.value) })),
    part.button({ text: "(clear)", callback: pick("") }),
    part.button({ text: "Cancel", callback: () => handle.close() }),
  ] })] });
}

function pickerField(part: UiPartHelpers, opts: {
  key: string;                                  // short name: labels the Choose button
  label: string;                                // field label above the input
  storageKey: string;
  options: () => Promise<PickerOption[]>;
  rerender: () => Promise<void>;
  placeholder?: string;
}): UIPart {
  return part.column({ content: [
    part.text({ text: opts.label }),
    part.row({ content: [
      part.textInput({ storageKey: opts.storageKey, placeholder: opts.placeholder }),
      part.button({ text: `Choose ${opts.key}…`, callback: () => openPickerModal(opts.key, opts.storageKey, opts.options, opts.rerender) }),
    ] }),
  ] });
}

// Read the form's tempStorage fields, compose the command, route it, and show
// the OOC reply in-window.
async function submitCommand(verb: string, spec: CommandSpec, rerender: (result?: string) => Promise<void>): Promise<void> {
  const values: Record<string, string> = {};
  for (const p of spec.params ?? []) {
    values[p.key] = String((await api.v1.tempStorage.get(WKEY(verb, p.key))) ?? "").trim();
  }
  const required = (spec.params ?? []).find(p => p.required && !values[p.key] && !p.default);
  if (required) { await rerender(`Needs ${required.desc ?? required.key}.`); return; }
  const reply = await CommandRouter.route(composeCommand(verb, values, spec));
  await rerender(reply);
}

// Open a window whose form is the verb's CommandSpec. Returns whether a spec
// existed to render.
async function openCommandWindow(verb: string, opts?: {
  title?: string; blurb?: string; submitLabel?: string;
  // Per-param option pickers: a param key listed here renders a pickerField
  // (typing + Choose-modal) instead of a bare text input - same temp key, so
  // composeCommand is untouched.
  pickers?: Record<string, () => Promise<PickerOption[]>>;
}): Promise<boolean> {
  const spec = CommandRouter.specFor(verb);
  if (!spec) return false;
  const part = api.v1.ui.part;
  const temp = api.v1.tempStorage;

  // Pre-seed enum defaults so the selector rows show a selection immediately.
  for (const p of spec.params ?? []) {
    if (p.default !== undefined && (await temp.get(WKEY(verb, p.key))) == null) {
      await temp.set(WKEY(verb, p.key), p.default);
    }
  }

  const handle = await api.v1.ui.window.open({ title: opts?.title ?? `[[${verb}]]`, content: [], defaultWidth: 480, defaultHeight: 600 });

  const render = async (result?: string): Promise<void> => {
    const content: UIPart[] = [];
    if (opts?.blurb) content.push(part.text({ text: opts.blurb, markdown: true }));
    for (const p of spec.params ?? []) {
      if (p.type === "enum" && p.options?.length) {
        const current = String((await temp.get(WKEY(verb, p.key))) ?? p.default ?? "");
        content.push(selectorRow(part, verb, p, current, () => render()));
      } else if (p.type === "int") {
        content.push(part.text({ text: p.desc ?? p.key }));
        content.push(part.numberInput({ storageKey: WKEY(verb, p.key) }));
      } else if (opts?.pickers?.[p.key]) {
        content.push(pickerField(part, {
          key: p.key, label: p.desc ?? p.key, storageKey: WKEY(verb, p.key),
          options: opts.pickers[p.key], rerender: () => render(), placeholder: p.example,
        }));
      } else {
        content.push(part.text({ text: p.desc ?? p.key }));
        content.push(part.textInput({ storageKey: WKEY(verb, p.key), placeholder: p.example }));
      }
    }
    content.push(part.row({ content: [
      part.button({ text: opts?.submitLabel ?? "Create", callback: () => submitCommand(verb, spec, render) }),
      part.button({ text: "Close", callback: () => handle.close() }),
    ] }));
    if (result) content.push(part.box({ content: [part.text({ text: result })] }));
    await handle.update({ content });
  };

  await render();
  return true;
}

// The constraint-group window: [[define-constraint]]'s spec rendered as a form.
async function openConstraintWindow(): Promise<void> {
  await openCommandWindow("define-constraint", {
    title: "Define constraint group",
    blurb: "**Define a constraint group** (exclusive / restricted / forbidden)",
  });
}

// [[win-constraint]] - a UI over [[define-constraint]], derived from its spec.
async function cmdWinConstraint(): Promise<string> {
  await openConstraintWindow();
  return sys(`Opened the constraint-group window. Fill it in and press Create (it runs [[define-constraint]]).`);
}

CommandRouter.register("win-constraint", cmdWinConstraint, {
  summary: "open a window to define a constraint group",
});

// [[win-table]] - a UI over [[define-table]], derived from its spec.
async function cmdWinTable(): Promise<string> {
  await openCommandWindow("define-table", {
    title: "Define success table",
    blurb: "**Define a success table** (ladder rows, numeric output, or both)",
  });
  return sys(`Opened the success-table window. Fill it in and press Create (it runs [[define-table]]).`);
}

CommandRouter.register("win-table", cmdWinTable, {
  summary: "open a window to define a success table",
});

// --- AFFLICTION WINDOWS --------------------------------------------------------
// The defined afflictions, as picker options (description shown when present).
const afflictionOptions = async (): Promise<PickerOption[]> =>
  AfflictionRegistry.all().map(d => ({ value: d.name, label: d.description ? `${d.name} - ${d.description}` : d.name }));

// [[win-affliction]] - define-affliction's spec as a form; the `then` and
// `mirror` fields get pickers over the existing afflictions (typing still works).
async function cmdWinAffliction(): Promise<string> {
  await openCommandWindow("define-affliction", {
    title: "Define affliction",
    blurb: "**Define an affliction** (bindings, chains, mirrors, tags)",
    pickers: { then: afflictionOptions, mirror: afflictionOptions },
  });
  return sys(`Opened the affliction window. Fill it in and press Create (it runs [[define-affliction]]).`);
}

// [[win-afflict]] - the first DOMAIN-driven window: pick an affliction and its
// def's binding slots appear as fields; Afflict composes and routes the real
// [[afflict]] command (openNamed carries the slots). The window duplicates no
// grammar - the def drives the form.
const AKEY = (k: string): string => `win:afflict:${k}`;

async function openAfflictWindow(): Promise<void> {
  const part = api.v1.ui.part;
  const temp = api.v1.tempStorage;
  const spec = CommandRouter.specFor("afflict")!;
  const handle = await api.v1.ui.window.open({ title: "Afflict an affliction", content: [], defaultWidth: 480, defaultHeight: 480 });

  const render = async (result?: string): Promise<void> => {
    const chosen = String((await temp.get(AKEY("affliction"))) ?? "").trim();
    const def = chosen ? AfflictionRegistry.get(chosen) : undefined;
    const content: UIPart[] = [
      part.text({ text: "**Afflict an affliction** - pick one; its binding slots appear below.", markdown: true }),
      pickerField(part, {
        key: "affliction", label: "Affliction", storageKey: AKEY("affliction"),
        options: afflictionOptions, rerender: () => render(), placeholder: "e.g. feral-whispers",
      }),
      part.text({ text: "On (blank = the current character)" }),
      part.textInput({ storageKey: AKEY("on"), placeholder: "name or @alias" }),
    ];
    for (const slot of def?.bindings ?? []) {
      content.push(part.text({ text: `Binding: ${slot}` }));
      content.push(part.textInput({ storageKey: AKEY(`bind:${slot}`), placeholder: "name or @alias" }));
    }
    content.push(part.row({ content: [
      part.button({ text: "Afflict", callback: async () => {
        const affliction = String((await temp.get(AKEY("affliction"))) ?? "").trim();
        if (!affliction) { await render("Pick an affliction first."); return; }
        const values: Record<string, string> = {
          affliction,
          on: String((await temp.get(AKEY("on"))) ?? "").trim(),
        };
        // A slot named like a declared param would be skipped by compose; the
        // def vocabulary is the ST's, so just read what the def declares.
        for (const slot of AfflictionRegistry.get(affliction)?.bindings ?? []) {
          values[slot] = String((await temp.get(AKEY(`bind:${slot}`))) ?? "").trim();
        }
        const reply = await CommandRouter.route(composeCommand("afflict", values, spec));
        await render(reply);
      } }),
      part.button({ text: "Close", callback: () => handle.close() }),
    ] }));
    if (result) content.push(part.box({ content: [part.text({ text: result })] }));
    await handle.update({ content });
  };
  await render();
}

async function cmdWinAfflict(): Promise<string> {
  await openAfflictWindow();
  return sys(`Opened the afflict window. Pick an affliction, fill its bindings, and press Afflict (it runs [[afflict]]).`);
}

CommandRouter.register("win-affliction", cmdWinAffliction, {
  summary: "open a window to define an affliction (then/mirror have pickers)",
});
CommandRouter.register("win-afflict", cmdWinAfflict, {
  summary: "open a window to apply an affliction (its binding slots appear on pick)",
});

// --- THE ROLL WINDOW ---------------------------------------------------------
// [[win-roll]] - build a roll from every knob the engine has, fire it (for the
// current character or any named one), and optionally save it as a named roll.
// One window multiplexes THREE verbs: Roll composes [[roll]] (For blank) or
// [[roll-for]] (For filled); Save composes [[name-roll]] (For ignored - saved
// rolls are chronicle-global). The knob fields are WALKED from [[roll]]'s own
// CommandSpec so the window duplicates no grammar; `diff-mod` is skipped (with
// difficulty blank, a lone modifier would slide into the difficulty positional
// slot - and a form user types the final difficulty anyway).
const RKEY = (k: string): string => `win:roll:${k}`;

// The character the option lists describe: the For field's name when filled,
// else the current character. An unknown name just yields empty picker lists -
// the options are a convenience, never a gate (typing stays live).
async function rollWindowChar(): Promise<PlayableCharacter | undefined> {
  const forName = String((await api.v1.tempStorage.get(RKEY("for"))) ?? "").trim();
  return forName ? CharacterStore.load(forName) : CharacterStore.getCurrent();
}

const characterOptions = async (): Promise<PickerOption[]> =>
  (await CharacterStore.listNames()).map(n => ({ value: n }));
const savedRollOptions = async (): Promise<PickerOption[]> =>
  (await NamedRollStore.names()).map(n => ({ value: `@${n}` }));
const spendOptions = async (): Promise<PickerOption[]> => {
  const char = await rollWindowChar();
  return char ? CharacterResources.defsFor(char).map(d => ({ value: d.name })) : [];
};
const specialtyOptions = async (): Promise<PickerOption[]> => {
  const char = await rollWindowChar();
  return Object.entries(char?.specialties ?? {}).flatMap(([trait, labels]) =>
    labels.map(l => ({ value: l, label: `${l} (${trait})` })));
};
const tableOptions = async (): Promise<PickerOption[]> => [
  ...SuccessTableRegistry.all().map(t => ({ value: t.name })),
  ...Object.keys(await TableAliases.all()).map(a => ({ value: `@${a}` })),
];

async function openRollWindow(): Promise<void> {
  const part = api.v1.ui.part;
  const temp = api.v1.tempStorage;
  const field = async (k: string): Promise<string> => String((await temp.get(RKEY(k))) ?? "").trim();
  const pickers: Record<string, () => Promise<PickerOption[]>> = {
    spend: spendOptions, specialty: specialtyOptions, table: tableOptions,
  };
  const handle = await api.v1.ui.window.open({ title: "Build a roll", content: [], defaultWidth: 480, defaultHeight: 640 });

  // Compose+route `verb`, reading each of ITS spec params from the form (the
  // field keys ARE the param keys); `extra` pre-binds cross-verb params.
  const submit = async (verb: string, extra: Record<string, string>): Promise<void> => {
    const spec = CommandRouter.specFor(verb)!;
    const values: Record<string, string> = {};
    for (const p of spec.params ?? []) values[p.key] = extra[p.key] ?? (await field(p.key));
    const reply = await CommandRouter.route(composeCommand(verb, values, spec));
    await render(reply);
  };

  const render = async (result?: string): Promise<void> => {
    const knobs = (CommandRouter.specFor("roll")?.params ?? []).filter(p => p.key !== "pool" && p.key !== "diff-mod");
    const content: UIPart[] = [
      part.text({ text: "**Build a roll** - Roll fires it; Save stores it as a named roll.", markdown: true }),
      pickerField(part, {
        key: "for", label: "For (blank = the current character)", storageKey: RKEY("for"),
        options: characterOptions, rerender: () => render(), placeholder: "name",
      }),
      pickerField(part, {
        key: "pool", label: "Pool", storageKey: RKEY("pool"),
        options: savedRollOptions, rerender: () => render(), placeholder: "e.g. dexterity+melee, or @saved",
      }),
    ];
    for (const p of knobs) {
      if (p.type === "int") {
        content.push(part.text({ text: p.desc ?? p.key }));
        content.push(part.numberInput({ storageKey: RKEY(p.key) }));
      } else if (pickers[p.key]) {
        content.push(pickerField(part, {
          key: p.key, label: p.desc ?? p.key, storageKey: RKEY(p.key),
          options: pickers[p.key], rerender: () => render(), placeholder: p.example ?? p.hint,
        }));
      } else {
        content.push(part.text({ text: p.desc ?? p.key }));
        content.push(part.textInput({ storageKey: RKEY(p.key), placeholder: p.example ?? p.hint }));
      }
    }
    // Contest knobs - Save bakes these into [[name-roll]] as an OPPOSED saved roll
    // (the opponent is play-time vs=); Roll ignores them. These are name-roll's own
    // params, so submit("name-roll") reads them straight from these fields by key.
    // vs-pool / vs-difficulty only show once a mode is chosen (collapse when off).
    const opposedNow = await field("opposed");
    content.push(part.text({ text: "Opposed (Save bakes a contest; opponent supplied at play via vs=)" }));
    content.push(part.row({ content: (["", "resisted", "contested"] as const).map(o => part.button({
      text: `${o === opposedNow ? "• " : ""}${o === "" ? "none" : o}`,
      callback: async () => {
        await temp.set(RKEY("opposed"), o);
        if (o === "") { await temp.set(RKEY("vs-pool"), ""); await temp.set(RKEY("vs-difficulty"), ""); }
        await render();
      },
    })) }));
    if (opposedNow === "resisted" || opposedNow === "contested") {
      content.push(part.text({ text: "vs-pool (opposition's pool; blank = your own pool)" }));
      content.push(part.textInput({ storageKey: RKEY("vs-pool"), placeholder: "e.g. perception+alertness" }));
      content.push(part.text({ text: "vs-difficulty (opposition's difficulty; optional)" }));
      content.push(part.numberInput({ storageKey: RKEY("vs-difficulty") }));
    }
    content.push(part.text({ text: "Save as (optional - Save stores the roll under this name)" }));
    content.push(part.textInput({ storageKey: RKEY("save-as"), placeholder: "e.g. strike" }));
    content.push(part.row({ content: [
      part.button({ text: "Roll", callback: async () => {
        const pool = await field("pool");
        if (!pool) { await render("Needs a pool."); return; }
        const forName = await field("for");
        await submit(forName ? "roll-for" : "roll", forName ? { character: forName } : {});
      } }),
      part.button({ text: "Save", callback: async () => {
        const name = await field("save-as");
        if (!name) { await render("Needs a Save-as name to save."); return; }
        if (!(await field("pool"))) { await render("Needs a pool."); return; }
        await submit("name-roll", { name });
      } }),
      part.button({ text: "Close", callback: () => handle.close() }),
    ] }));
    if (result) content.push(part.box({ content: [part.text({ text: result })] }));
    await handle.update({ content });
  };
  await render();
}

async function cmdWinRoll(): Promise<string> {
  await openRollWindow();
  return sys(`Opened the roll window. Build the pool and knobs, then Roll (runs [[roll]] / [[roll-for]]) or Save (runs [[name-roll]]).`);
}

CommandRouter.register("win-roll", cmdWinRoll, {
  summary: "open a window to build, roll, and save rolls",
});
//#endregion src/window.ts

//#region src/index.ts
// =============================================================================
// NAIoWoD - World of Darkness (Dark Ages) engine for NovelAI scripting
// -----------------------------------------------------------------------------
// Public surface: re-exports every layer, plus init() - the one entry point
// that touches the host (registers hooks, seeds the lorebook). Importing this
// module has NO side effects; the built .naiscript artifact calls init().
// =============================================================================

// `export * from "./window"` above also runs its top-level [[win-constraint]] registration.

// Wire the engine to the host: input hook, lorebook seed, the base virtual
// paths (config/general + success-tables/general), tracked-card reconciliation
// (drift modals may open), custom merits/flaws, and every config store.
// Returns the bootstrap result so the caller can surface the setup note.
async function init(): Promise<{ setupMessage: string | null }> {
  api.v1.hooks.register("onTextAdventureInput", async (params: Parameters<OnTextAdventureInput>[0]) => {
    return processAdventureInput(params.rawInputText);
  });
  // The Storyteller's private plans: strip the AI's <hide> blocks from the
  // narration before it's inserted, routing them to the scene plan + Author's Note.
  api.v1.hooks.register("onResponse", async (params: Parameters<OnResponse>[0]) => {
    const text = await processGeneratedText(params.text);
    return text ? { text } : undefined;
  });
  const boot = await LorebookManager.bootstrap();
  await ensurePath("config", CONFIG_GENERAL_HEADER);
  await ensurePath("config:success-tables", TABLE_GENERAL_HEADER);
  const recon = await reconcileLorebook();
  const merits = await MeritFlawRegistry.loadFromLorebook();
  const configs = await reloadAllConfigStores();
  const seededRolls = await NamedRollStore.seedDefaults();   // starter Drama rolls (create-if-missing)
  const seededClock = await StoryClock.seedDefault();        // the story clock (create-if-missing)
  const reconBit = recon.length ? `; lorebook: ${recon.join("; ")}` : "";
  log(`[INIT] lorebook categories created: ${boot.createdCategories.length}; custom merits/flaws: ${merits}; config: ${configs.map(c => `${c.entry.replace("wod:config:", "") || "config"}=${c.count}`).join(", ")}; seeded rolls: ${seededRolls}; clock seeded: ${seededClock}${reconBit}`);
  return { setupMessage: boot.message };
}
//#endregion src/index.ts

//#region src/main.ts
// Runtime entry point: boot the engine on the host. In the single-file build
// (dist/naiowod.ts) this is the last code to run, after every module.
// Errors route through the host's own `api.v1.error` (ambient), so the release
// depends only on the documented API - no `console`/DOM assumption.

init().catch((e) => api.v1.error("[NAIoWoD] init failed:", e));
//#endregion src/main.ts
