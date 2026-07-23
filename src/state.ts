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
import {
  StringUtil, Category, PointSource, Stat, Tracker, Pool, MoralityTrait,
} from "./core/traits";
import { Dice, Rng, RollTrait, RollResult } from "./core/dice";
import {
  Severity, SeverityName, DamagePacket, DamageKind, DamageSource, DamageReaction,
  HealthTrack, HealthSummary, SoakSpec, SoakTypeRule,
} from "./core/damage";
import {
  RulesetConfig, MORTAL_SOAK, TemplateConfig, TEMPLATES, ROAD_OF_HUMANITY, RoadDefinition, ResourceDef,
  bloodForGeneration, MeritFlawDef, MeritFlawRequirements, SRD_HEADER_MARKER, ALL_ATTRIBUTES,
  resourcesForTemplates, healthLevelsForTemplates, ATTRIBUTES,
  ConstraintGroup, makeConstraintGroup,
  AfflictionDef, makeAfflictionDef, DEFAULT_AFFLICTIONS,
  EffectOp, resolveMeritInstance, passiveOpsOf,
} from "./rules";
import {
  ScopedStorage, LorebookManager, MeritFlawRegistry,
  ListConfigStore, MapConfigStore, CONFIG_CATEGORY,
  ALL_CONFIG_STORES, parseConfigBody, parseNamedConfigList,
  writeTrackedEntry, ensurePath, GENERAL_ENTRY, TABLE_GENERAL_HEADER,
} from "./services";
import { RollSpec, SuccessTable, SuccessTableRegistry, DEFAULT_SUCCESS_TABLES, ExtendedRoll, ExtendedContest, BotchPolicy, ContestMode } from "./rolls";
import { WizardPrompt, WizardStateData } from "./wizard";

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
  // name -> points; kind via the registry. Parameterized defs are owned as
  // "name:<param>" instances ("trait-affinity:melee" - typed with :: ).
  meritsFlaws: Record<string, number>;
  tags: string[];                         // free-form (clan, ghoul, ...)
  // trait -> specialty labels (VERBATIM case - display text). At most one
  // specialty applies per roll, chosen by the specialty= argument.
  specialties?: Record<string, string[]>;
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
export function resolveTraitFromRecord(char: PlayableCharacter, name: string): number {
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
export interface OwnedMeritInstance {
  key: string;
  def: MeritFlawDef;
  param?: string;
  points: number;
}

export function ownedMeritInstances(char: PlayableCharacter): OwnedMeritInstance[] {
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
export function passiveOpsFor(char: PlayableCharacter): EffectOp[] {
  return ownedMeritInstances(char).flatMap(inst => passiveOpsOf(inst.def, inst.param, inst.points));
}

// Permanent per-trait enhancement totals (the "enhance" passive op): raises
// the EFFECTIVE trait everywhere and, advisorily, the advancement ceiling by
// the same amount. XP pricing keeps reading the un-enhanced base.
export function enhancementsFor(char: PlayableCharacter): Record<string, number> {
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
export const NAMED_ROLLS_CATEGORY = "wod:named-rolls";
const NAMED_ROLLS_ENTRY = "wod:named-rolls:library";

// The extended nature of a saved roll (a "named procedure"): its PRESENCE means
// invoking the roll launches an extended action instead of a single roll. These
// are DEFAULTS for that action; the `target` (successes to reach) is NOT here -
// it's the Storyteller's play-time call (e.g. a wall's height / ft-per-success),
// supplied at invoke.
export interface ExtendedSavedConfig {
  intervals?: number;   // default max rolls (overridable at invoke)
  interval?: string;    // advisory spacing label ("1 turn")
  onBotch?: BotchPolicy; // default botch policy
}

// An OPPOSED saved roll: invoking it launches a resisted/contested action - or an
// extended contest (a race like Pursuit) - instead of a single roll, reusing the
// contest machinery. Like an extended roll's target, the OPPONENT is play-time
// input (vs=); the save only holds the shape. `pool` omitted => the opposition
// rolls the SAME pool (a symmetric contest, e.g. Str+Intimidation both sides).
export interface OpposedSavedConfig {
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
export type ProcedureCondition = "always" | "on-success" | "on-fail" | "on-botch";
export interface ProcedureStep {
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
export type SavedRoll = RollSpec & {
  spend?: string; specialty?: string; table?: string;
  extended?: ExtendedSavedConfig; description?: string;
  opposed?: OpposedSavedConfig; steps?: ProcedureStep[];
};

// Pre-saved rolls seeded into a fresh chronicle's library (create-if-missing;
// never clobbers an existing library, so player edits/deletes stick). The set
// grows as DATA - these are the Dark Ages "Drama" named systems. Editable like
// any saved roll (they live in the lorebook after seeding).
export const DEFAULT_NAMED_ROLLS: Record<string, SavedRoll> = {
  climbing: {
    pool: "dexterity+athletics", difficulty: 6, difficultyMod: 0, diceMod: 0, requires: 1, tags: ["climb"],
    table: "climbing", extended: { intervals: 10 },
    description: "Scaling vertical surfaces - cliff faces or walls. Roll Dexterity + Athletics (difficulty 6; grip-improving Disciplines such as Protean's Talons of the Beast or Vicissitude bone spurs reduce this to 4). Extended: each success moves the climber up ~10 feet (the Storyteller may vary the distance for easy slopes or tightly-bounded walls). Failure means no progress this interval; a botch can leave the climber stuck, panicked by the height, or falling.",
  },
};

export class NamedRollStore {
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
export class ExtendedRollStore {
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
export class ExtendedContestStore {
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
// PLAYERS - the engine's first identity concept
// -----------------------------------------------------------------------------
// A player is just a normalized id string (no record): "storyteller" always
// exists; a single-player story has one more. `current-player` is whoever is
// issuing commands right now; `default-player` is what the "default" owner in
// alias scopes resolves to (the human, in a single-player story). Both default
// to "storyteller" until set.
// =============================================================================
export class PlayerStore {
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
export type AliasScope = "global" | "player" | "character";
export interface AliasMap {
  global: Record<string, string>;
  players: Record<string, Record<string, string>>;
  characters: Record<string, Record<string, string>>;
}
export interface AliasRef { scope?: AliasScope; owner?: string; alias: string }

// "@..." token -> its parts, or undefined when malformed. Assumes the token is
// already normalized (the parser guarantees it).
export function parseAliasToken(token: string): AliasRef | undefined {
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

export class AliasRegistry {
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
export const RESOURCE_CONFIG_ENTRY = "wod:config:resources";
export const CONSTRAINTS_ENTRY = "wod:config:constraints";
export const AFFLICTIONS_ENTRY = "wod:config:afflictions";
// Success tables are NOT an entry: this names their category TREE (the
// virtual-subcategory policy) - wod:config:success-tables and
// wod:config:success-tables:<sub>.
export const TABLES_CATEGORY = "wod:config:success-tables";

// The house-rule layer for resources: a map resourceName -> partial def.
export const ResourceOverrides = new MapConfigStore<Partial<ResourceDef>>({
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
export class TableLibraryStore {
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

export const TableLibrary = new TableLibraryStore();

// =============================================================================
// TABLE ALIASES - @shorthands for table keys (incl. "sub::name" paths)
// -----------------------------------------------------------------------------
// A flat storyStorage map, distinct from character aliases: position
// disambiguates the @ sigil (table= slot -> table alias), exactly like pool
// position means saved rolls. Targets are stored as normalized table KEYS and
// validated advisorily (an alias may point at a table defined later).
// =============================================================================
export class TableAliases {
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
export const ConstraintRegistry = new ListConfigStore<ConstraintGroup>({
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
export const AfflictionRegistry = new ListConfigStore<AfflictionDef>({
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
export class CreatorMode {
  private static _storage = new ScopedStorage();
  static async enabled(): Promise<boolean> {
    return (await CreatorMode._storage.getOrDefault("creator-mode", false)) as boolean;
  }
  static async set(on: boolean): Promise<void> { await CreatorMode._storage.set("creator-mode", on); }
}

// One live affliction on someone: which definition, and what its slots are bound
// to (normalized names - possibly NPCs).
export interface ActiveAffliction { def: string; bindings: Record<string, string>; note?: string }

export class CharacterAfflictions {
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
export interface ResourceView { def: ResourceDef; current: number; max: number; }

export class CharacterResources {
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
export interface HealthCounts { bashing: number; lethal: number; aggravated: number; }
const HEAL_ORDER: (keyof HealthCounts)[] = ["aggravated", "lethal", "bashing"];

export class CharacterHealth {
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
export class CharacterBoosts {
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
export class EffectUses {
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
export interface ActiveWizard { def: string; state: WizardStateData; prompt: WizardPrompt; }

export class WizardSession {
  private static _storage = new ScopedStorage();
  private static readonly KEY = "wizard:active";
  static async get(): Promise<ActiveWizard | undefined> {
    return (await WizardSession._storage.get(WizardSession.KEY)) as ActiveWizard | undefined;
  }
  static async set(a: ActiveWizard): Promise<void> { await WizardSession._storage.set(WizardSession.KEY, a); }
  static async clear(): Promise<void> { await WizardSession._storage.delete(WizardSession.KEY); }
}

