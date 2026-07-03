import { StringUtil } from "./traits";

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
export type SeverityName = "harmless" | "bashing" | "lethal" | "aggravated" | "fatal";
export class Severity {
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
export type DamageKind = string;
export type DamageSource = string;

// Common descriptors, surfaced as constants purely for discoverability and to
// dodge typos. The type is still `string`, so homebrew kinds need no ceremony.
export const Kind = {
  BLUDGEONING: "bludgeoning", PIERCING: "piercing", SLASHING: "slashing",
  SILVER: "silver", COLD_IRON: "cold-iron", FIRE: "fire", SUNLIGHT: "sunlight",
  COLD: "cold", ELECTRICITY: "electricity", POISON: "poison", ACID: "acid",
} as const;
export const Source = {
  GUNSHOT: "gunshot", BLADE: "blade", FIST: "fist", CLAW: "claw", FANGS: "fangs",
  FALL: "fall", FIRE: "fire", SUNLIGHT: "sunlight",
} as const;

export interface DamagePacketInit {
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
export class DamagePacket {
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
export interface ReactionTarget { TraitValue(name: string): number; }

export interface DamageReaction {
  readonly Label: string;
  Apply(packet: DamagePacket, character?: ReactionTarget): DamagePacket;
}

// Undead (vampires): no organs to rupture, no blood to bleed out. Piercing and
// ballistic wounds that would kill the living do only bashing; fire and sunlight
// are the classic aggravated exceptions and are never talked down.
export class UndeadPhysiology implements DamageReaction {
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
export class SilverVulnerability implements DamageReaction {
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
export class ArmorReaction implements DamageReaction {
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

export interface HealthLevelDef { name: string; penalty: number; }

// Standard 7-level Storyteller health track.
export const STANDARD_HEALTH_LEVELS: HealthLevelDef[] = [
  { name: "Bruised", penalty: 0 },
  { name: "Hurt", penalty: -1 },
  { name: "Injured", penalty: -1 },
  { name: "Wounded", penalty: -2 },
  { name: "Mauled", penalty: -2 },
  { name: "Crippled", penalty: -5 },
  { name: "Incapacitated", penalty: -5 },
];

// How a square may be healed.
export type HealPolicy = "normal" | "never" | "special";

// A single health box. `penalty` is the wound penalty it imposes when it is the
// deepest damaged box. Everything else is optional, so a plain
// `{ name, penalty }` (a HealthLevelDef) is a valid square.
export interface HealthSquareDef {
  penalty: number;
  name?: string;
  condition?: string;   // key linking this box to a ConditionDef
  heal?: HealPolicy;    // default "normal"
  healCost?: number;    // healing points to clear this box (default 1)
}

// A condition wired to one or more boxes; its state depends on how many of its
// linked boxes are currently damaged.
export interface ConditionDef {
  key: string;
  name?: string;
  // Given how many linked boxes are damaged (and how many exist), return the
  // current state label, or null for "inactive". Default: active if any hurt.
  state?: (damaged: number, total: number) => string | null;
}

export interface HealthTrackConfig {
  squares: HealthSquareDef[];
  conditions?: ConditionDef[];
}

export interface ConditionState { key: string; name: string; state: string; damaged: number; total: number; }

export interface HealthSummary {
  bashing: number; lethal: number; aggravated: number;
  filled: number; capacity: number; overkill: number;
  penalty: number; level: string;
  isIncapacitated: boolean; isDead: boolean;
  conditions: ConditionState[];
}

// Damage is stored PER BOX, so boxes can carry conditions, heal costs, or be
// unhealable. Simple use (ApplyDamage / Heal / Penalty / Level / counts) needs
// none of that and behaves exactly like a plain Storyteller track.
export class HealthTrack {
  private readonly _defs: HealthSquareDef[];
  private readonly _damage: (Severity | null)[];
  private readonly _conditions: ConditionDef[];
  private _overkill = 0; // damage that spills past a fully-aggravated track
  private readonly _log: Array<{ severity: SeverityName; intensity: number }> = [];

  constructor(config: HealthSquareDef[] | HealthTrackConfig = STANDARD_HEALTH_LEVELS) {
    const cfg: HealthTrackConfig = Array.isArray(config) ? { squares: config } : config;
    if (cfg.squares.length === 0) throw new Error("Health track needs at least one square.");
    this._defs = cfg.squares.map(s => ({ heal: "normal", healCost: 1, ...s }));
    this._damage = this._defs.map(() => null);
    this._conditions = (cfg.conditions ?? []).map(c => ({ ...c }));
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

  // Current state of every active condition wired to the track.
  Conditions(): ConditionState[] {
    const out: ConditionState[] = [];
    for (const c of this._conditions) {
      let damaged = 0, total = 0;
      for (let i = 0; i < this._defs.length; i++) {
        if (this._defs[i].condition === c.key) { total++; if (this._damage[i]) damaged++; }
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
      conditions: this.Conditions(),
    };
  }
}

// =============================================================================
// SOAK - per-template rules for resisting damage
// =============================================================================
export interface SoakTypeRule { soakable: boolean; pool: string[]; }
export interface SoakSpec {
  bashing: SoakTypeRule;
  lethal: SoakTypeRule;
  aggravated: SoakTypeRule;
  difficulty: number;
}
