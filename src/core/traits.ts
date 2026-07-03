// =============================================================================
// CORE / TRAITS - names, categories, rated stats, trackers, pools, morality
// -----------------------------------------------------------------------------
// Pure mechanics: no imports from the host layer.
// =============================================================================

export class StringUtil {
  static normalize(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, '-');
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

export type CategoryType =
  | "physical" | "social" | "mental"
  | "talent" | "skill" | "knowledge"
  | "background" | "tracker" | "virtue" | "morality" | "vital" | "discipline";
export class Category {
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

export type PointSourceType = "base" | "freebie" | "experience" | "downtime";
export class PointSource {
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
export class LedgerEntry {
  constructor(
    public readonly Source: PointSource,
    public readonly AmountAdded: number,
    public readonly CostIncurred: number
  ) { Object.freeze(this); }
}

export class StatModifier {
  constructor(
    public readonly Amount: number,
    public readonly IsPermanent: boolean,
    public readonly IgnoresCap: boolean,
    public readonly Description: string
  ) { Object.freeze(this); }
}

export class Stat {
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
export class Tracker extends Stat {
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
export class Pool {
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

export type MoralityPolarity = "descending" | "ascending";

// A morality rating (a Road/Humanity, or Torment). "descending" traits worsen
// toward 0 (Humanity 0 = lost to the Beast); "ascending" traits worsen toward
// the max (Torment 10 = unplayable). Degenerate() always moves toward the bad
// extreme; Improve() toward the good one.
export class MoralityTrait {
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
