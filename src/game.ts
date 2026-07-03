import { api, OnTextAdventureInputReturnValue } from "./host";
import {
  StringUtil, Category, PointSource, Stat, Tracker, Pool, MoralityTrait,
} from "./core/traits";
import { Dice, Rng, RollTrait, RollResult } from "./core/dice";
import {
  Severity, SeverityName, DamagePacket, DamageKind, DamageSource, DamageReaction,
  HealthTrack, HealthSummary, SoakSpec, SoakTypeRule,
} from "./core/damage";
import {
  RulesetConfig, MORTAL_SOAK, TemplateConfig, TEMPLATES, ROAD_OF_HUMANITY, RoadDefinition, PoolDef,
  bloodForGeneration, MeritFlawDef, MeritFlawRequirements, SRD_HEADER_MARKER, ALL_ATTRIBUTES,
} from "./rules";
import { ScopedStorage, LorebookManager, MeritFlawRegistry } from "./services";
import {
  RollSpec, makeRollSpec, executeRoll, formatExecution, DEFAULT_DIFFICULTY,
} from "./rolls";

// --- LIVE CHARACTER SHEET ---
// One line of "what a reaction did to the packet", for auditability.
export interface ReactionTrace { reaction: string; from: string; to: string; }
export interface DamageReport {
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
export interface SoakReport {
  soakable: boolean;
  pool: number;
  soaked: number;
  roll: RollResult | null;
}

export class LiveCharacter {
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
export interface CharacterCreationOptions {
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

export class CharacterFactory {
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

  // Validates a chosen starting value against the PoolDef constraints.
  private static _resolveStart(def: PoolDef, chosen: number | undefined): number {
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
export const PLAYER_CHARACTERS_CATEGORY = "wod:player-characters";

export interface PlayableCharacter {
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
  meritsFlaws: Record<string, number>;    // name -> points; kind via the registry
  tags: string[];                         // free-form (clan, ghoul, ...)
}

export class CharacterStore {
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
      `Player character sheet for ${char.name}. The JSON below the ${SRD_HEADER_MARKER} line is the`,
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

// =============================================================================
// COMMAND PARSER - a command body -> { name, positional[], named{}, raw }
// -----------------------------------------------------------------------------
// Pure and dispatch-agnostic: it only tokenizes (respecting quotes). A token
// `key=value` (or key="quoted") is a named argument; any other bare or quoted
// token is positional, in order. Keeping this separate from CommandRouter lets
// us add commands - and later, lorebook-defined commands - without touching how
// arguments are parsed.
// =============================================================================
export interface ParsedCommand {
  name: string;
  positional: string[];
  named: Record<string, string>;
  raw: string;
}

export class CommandParser {
  static parse(body: string): ParsedCommand {
    const raw = body.trim();
    const name = (raw.match(/^[A-Za-z][\w-]*/)?.[0] ?? "").toLowerCase();
    const rest = raw.slice(name.length);
    const positional: string[] = [];
    const named: Record<string, string> = {};
    // key=value | key="v" | key='v' | "quoted" | 'quoted' | bareword
    const tokenRe = /([A-Za-z][\w-]*)\s*=\s*("([^"]*)"|'([^']*)'|\S+)|"([^"]*)"|'([^']*)'|(\S+)/g;
    for (const m of rest.matchAll(tokenRe)) {
      if (m[1] !== undefined) named[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[2];
      else positional.push(m[5] ?? m[6] ?? m[7]);
    }
    return { name, positional, named, raw };
  }
}

// =============================================================================
// COMMAND ROUTER - dispatch inline [[...]] player commands to their handlers
// -----------------------------------------------------------------------------
// A registry maps a verb to the function that runs it, so a new command is just
// a register() call (and could one day be defined from a lorebook entry).
// onTextAdventureInput pulls every [[bracketed]] command out of the input,
// routes it here, and replaces it with a single-line ((OOC-Storyteller: ...))
// note (the host forbids newlines in inputText).
// =============================================================================
export interface CommandContext { rng?: Rng; }
export type CommandHandler = (cmd: ParsedCommand, ctx: CommandContext) => Promise<string>;

export class CommandRouter {
  private static _storage = new ScopedStorage();
  private static _registry = new Map<string, { handler: CommandHandler; help: string }>();

  static register(verb: string, handler: CommandHandler, help: string): void {
    CommandRouter._registry.set(verb.toLowerCase(), { handler, help });
  }
  static verbs(): string[] { return [...CommandRouter._registry.keys()]; }

  static async creatorModeEnabled(): Promise<boolean> {
    return (await CommandRouter._storage.getOrDefault("creator-mode", false)) as boolean;
  }
  static async setCreatorMode(on: boolean): Promise<void> { await CommandRouter._storage.set("creator-mode", on); }

  /**
   * @deprecated Use CommandParser.parse. Thin delegate kept during the
   * parser/router split; remove once callers migrate.
   */
  static parse(body: string): ParsedCommand { return CommandParser.parse(body); }

  // Routes one command body to its handler; returns the OOC replacement text
  // (always a single line - the host strips newlines from inputText).
  static async route(body: string, ctx: CommandContext = {}): Promise<string> {
    const cmd = CommandParser.parse(body);
    // While creator mode is on, the player may have edited character entries:
    // pick those edits up before any command runs.
    if (await CommandRouter.creatorModeEnabled()) await CharacterStore.syncFromLorebook();
    const def = CommandRouter._registry.get(cmd.name);
    if (!def) return `((OOC-Storyteller: Unknown command "${cmd.name}". Available: ${CommandRouter.verbs().join(", ")}.))`;
    return def.handler(cmd, ctx);
  }
}

// --- COMMAND HANDLERS -------------------------------------------------------
// Each returns a single OOC line. Registered into CommandRouter at the bottom.

async function cmdCreatorMode(cmd: ParsedCommand): Promise<string> {
  const set = (cmd.named["set"] ?? cmd.positional[0] ?? "").toLowerCase();
  if (set !== "true" && set !== "false") {
    return `((OOC-Storyteller: creator-mode needs set=true or set=false.))`;
  }
  if (set === "true") {
    await CommandRouter.setCreatorMode(true);
    return `((OOC-Storyteller: Creator mode ON. You may now edit entries in "${PLAYER_CHARACTERS_CATEGORY}" directly; edits are synced in when you issue a command or turn creator mode off.))`;
  }
  // Leaving creator mode: capture any final lorebook edits, then switch off.
  const { synced, failed } = await CharacterStore.syncFromLorebook();
  await CommandRouter.setCreatorMode(false);
  const parts = [`Creator mode OFF.`];
  if (synced.length) parts.push(`Synced from lorebook: ${synced.join(", ")}.`);
  if (failed.length) parts.push(`Could not parse: ${failed.join(", ")} - fix the JSON and sync again.`);
  return `((OOC-Storyteller: ${parts.join(" ")}))`;
}

async function cmdCreatePlayable(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) return `((OOC-Storyteller: create-playable needs name="...".))`;
  const rawTemplates = (cmd.named["templates"] ?? cmd.named["template"] ?? "").split(",").map(t => StringUtil.normalize(t)).filter(t => t.length > 0);
  if (rawTemplates.length === 0) return `((OOC-Storyteller: create-playable needs templates="a,b,..." (at least one).))`;
  const unknown = rawTemplates.filter(t => !(t in TEMPLATES));
  if (unknown.length) {
    return `((OOC-Storyteller: Unknown template(s): ${unknown.join(", ")}. Valid: ${Object.keys(TEMPLATES).join(", ")}.))`;
  }
  if (await CharacterStore.load(name)) {
    return `((OOC-Storyteller: A character named "${name}" already exists. Edit it in creator mode, or pick another name.))`;
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
  return `((OOC-Storyteller: Created playable character "${name}" [${rawTemplates.join("+")}] - Attributes at 1, Abilities at 0, everything else unassigned.${note} Its sheet is the "pc:${StringUtil.normalize(name)}" entry in "${PLAYER_CHARACTERS_CATEGORY}"; use creator mode to edit it.))`;
}

async function cmdPlay(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) {
    // No argument: hand control back to the default character.
    const def = await CharacterStore.getDefaultName();
    const dc = def ? await CharacterStore.load(def) : undefined;
    if (!dc) return `((OOC-Storyteller: No default character to return to. Name one with [[play name="..."]].))`;
    await CharacterStore.setCurrent(dc.name);
    return `((OOC-Storyteller: Playing your default character, "${dc.name}".))`;
  }
  const char = await CharacterStore.load(name);
  if (!char) return `((OOC-Storyteller: No character named "${name}". Create it with [[create-playable ...]].))`;
  await CharacterStore.setCurrent(char.name);
  return `((OOC-Storyteller: Now playing "${char.name}".))`;
}

// Resolve a trait name to its value from a character record's numeric buckets.
function resolveTraitFromRecord(char: PlayableCharacter, name: string): number {
  const n = StringUtil.normalize(name);
  const buckets = [char.attributes, char.abilities, char.backgrounds, char.virtues, char.disciplines, char.traits, char.poolStarts];
  for (const b of buckets) if (n in b) return b[n];
  return 0;
}

// Build a RollSpec from a parsed command. `offset` is where the pool sits among
// the positionals (0 for [[roll]], 1 for [[roll-for "Name" ...]]). Difficulty
// and its modifier may be positional OR named (named wins); requires,
// dice-modifier and tags are named-only.
function rollSpecFromCommand(cmd: ParsedCommand, offset: number): RollSpec {
  const num = (s: string | undefined, fallback: number): number => {
    if (s === undefined) return fallback;
    const v = parseInt(s, 10);
    return Number.isNaN(v) ? fallback : v;
  };
  const pool = cmd.positional[offset] ?? "";
  const difficulty = num(cmd.named["difficulty"] ?? cmd.positional[offset + 1], DEFAULT_DIFFICULTY);
  const difficultyMod = num(cmd.named["difficulty-modifier"] ?? cmd.named["diff-mod"] ?? cmd.positional[offset + 2], 0);
  const requires = num(cmd.named["requires"], 1);
  const diceMod = num(cmd.named["dice-modifier"], 0);
  const tags = (cmd.named["tags"] ?? "").split(",").map(t => t.trim()).filter(t => t.length > 0);
  return makeRollSpec({ pool, difficulty, difficultyMod, requires, diceMod, tags });
}

async function rollAndReport(char: PlayableCharacter, cmd: ParsedCommand, ctx: CommandContext, offset: number): Promise<string> {
  const spec = rollSpecFromCommand(cmd, offset);
  if (!spec.pool) return `((OOC-Storyteller: roll needs a pool, e.g. [[roll strength+brawl]].))`;
  const exec = executeRoll(spec, n => resolveTraitFromRecord(char, n), { rng: ctx.rng });
  return `((OOC-Storyteller: ${char.name} - ${formatExecution(exec)}))`;
}

async function cmdRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  return rollAndReport(char, cmd, ctx, 0);
}

async function cmdRollFor(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const target = cmd.positional[0]?.trim();
  if (!target) return `((OOC-Storyteller: roll-for needs a character name, e.g. [[roll-for "Erik" strength+brawl]].))`;
  const char = await CharacterStore.load(target);
  if (!char) return `((OOC-Storyteller: No character named "${target}".))`;
  return rollAndReport(char, cmd, ctx, 1);
}

CommandRouter.register("creator-mode", cmdCreatorMode, "creator-mode set=true|false");
CommandRouter.register("create-playable", cmdCreatePlayable, 'create-playable name="..." templates="a,b"');
CommandRouter.register("play", cmdPlay, 'play [name="..."]  (no name -> default character)');
CommandRouter.register("roll", cmdRoll, "roll <pool> [difficulty] [diff-mod] requires= dice-modifier= tags=");
CommandRouter.register("roll-for", cmdRollFor, 'roll-for "Name" <pool> [difficulty] [diff-mod] requires= dice-modifier= tags=');

const COMMAND_PATTERN = /\[\[([\s\S]*?)\]\]/g;

// Replace every [[command]] in the player's adventure-mode input with its OOC
// note, running commands in order. If the input was ONLY commands (no prose),
// generation is suppressed - the player is operating the system, not the story.
export async function processAdventureInput(rawInputText: string): Promise<OnTextAdventureInputReturnValue | undefined> {
  const matches = [...rawInputText.matchAll(COMMAND_PATTERN)];
  if (matches.length === 0) return undefined; // not ours; leave input untouched

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
