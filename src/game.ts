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
  RulesetConfig, MORTAL_SOAK, TemplateConfig, TEMPLATES, ROAD_OF_HUMANITY, RoadDefinition, ResourceDef,
  bloodForGeneration, MeritFlawDef, MeritFlawRequirements, SRD_HEADER_MARKER, ALL_ATTRIBUTES,
  resourcesForTemplates, resourceEffect, healthLevelsForTemplates, ATTRIBUTES,
  EffectSpec, EffectOp, describeEffect,
  ConstraintGroup, ConstraintRelation, ConstraintDomain, makeConstraintGroup, describeConstraint, checkConstraints, OwnedTraits,
} from "./rules";
import { ScopedStorage, LorebookManager, MeritFlawRegistry } from "./services";
import {
  RollSpec, RollModifier, makeRollSpec, executeRoll, formatExecution, overrideSpec, describeSpec,
  ExtendedRoll, applyInterval, describeExtended, parseBotchPolicy, parsePoolExpression,
  SuccessTable, SuccessTableRegistry, readSuccessTable, describeTableReading, describeTable, RollOutcomeKind,
  ContestMode, ContestOutcome, compareRolls, ExtendedContest, applyContestRound, describeContest, RollExecution,
} from "./rolls";
import {
  WizardDefinition, WizardPrompt, WizardStateData, WizardResult, resolveReply, renderPromptText,
} from "./wizard";

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
// NAMED ROLLS - a global, player-editable library of saved RollSpecs
// -----------------------------------------------------------------------------
// One lorebook entry IS the library: a JSON map { name: RollSpec } below the
// header marker in wod:named-rolls. Read fresh on every call (no storage mirror)
// so a player's hand edits are always live. Names normalize to single tokens.
// =============================================================================
export const NAMED_ROLLS_CATEGORY = "wod:named-rolls";
const NAMED_ROLLS_ENTRY = "wod:named-rolls:library";

// A saved roll is a RollSpec plus an optional `spend` sidecar (the resource/role
// token to pay when the roll is invoked). `spend` stays OUT of the pure RollSpec -
// it's a game-layer concern the roll pipeline never sees.
export type SavedRoll = RollSpec & { spend?: string };

export class NamedRollStore {
  private static _text(map: Record<string, SavedRoll>): string {
    return [
      "Saved rolls for this chronicle: a JSON object { name: rollspec } below the",
      "marker. Invoke one with [[roll @name]]; edit this map freely by hand.",
      "Each spec: pool, difficulty (or difficultyExpr), difficultyMod, requires,",
      "diceMod, tags[], and an optional spend (paid automatically on [[roll @name]]).",
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
// RESOURCE OVERRIDES - the story's house-rule layer for resources
// -----------------------------------------------------------------------------
// One lorebook entry (wod:config / wod:config:resources) holds a JSON map
// { resourceName: partial-def } below the header marker. The configuration
// wizard WRITES this entry and creator mode can hand-edit it - both are just
// UIs over the same data. Cached here for synchronous reads (the same pattern
// as MeritFlawRegistry); reloaded at init, when a wizard finishes, and on the
// creator-mode sync path.
// =============================================================================
export const RESOURCE_CONFIG_CATEGORY = "wod:config";
export const RESOURCE_CONFIG_ENTRY = "wod:config:resources";

export class ResourceOverrides {
  private static _cache: Record<string, Partial<ResourceDef>> = {};

  static current(): Record<string, Partial<ResourceDef>> { return ResourceOverrides._cache; }
  static reset(): void { ResourceOverrides._cache = {}; }

  private static _entryText(map: Record<string, Partial<ResourceDef>>): string {
    return [
      "Story overrides for resources (the house-rule layer). The JSON below the",
      "marker maps a resource name to the fields you want to change (start, max,",
      "roles, effect, effects, ...). A name that matches no template resource and",
      "carries kind/start/max adds a custom resource. [[configure-resources]]",
      "edits this for you; you may also edit it by hand in creator mode.",
      SRD_HEADER_MARKER,
      JSON.stringify(map, null, 2),
    ].join("\n");
  }

  // Read the entry into the cache ({} when missing or unparseable).
  static async loadFromLorebook(): Promise<number> {
    const text = await LorebookManager.entryText(RESOURCE_CONFIG_CATEGORY, RESOURCE_CONFIG_ENTRY);
    ResourceOverrides._cache = {};
    if (text) {
      const body = LorebookManager.contentBelowHeader(text).trim();
      if (body.startsWith("{")) {
        try {
          const o = JSON.parse(body);
          if (o && typeof o === "object" && !Array.isArray(o)) ResourceOverrides._cache = o as Record<string, Partial<ResourceDef>>;
        } catch { /* unparseable: keep {} - the entry stays for the player to fix */ }
      }
    }
    return Object.keys(ResourceOverrides._cache).length;
  }

  // Write the whole map (create the category/entry on first use) + cache it.
  static async save(map: Record<string, Partial<ResourceDef>>): Promise<void> {
    const { id } = await LorebookManager.ensureCategory(RESOURCE_CONFIG_CATEGORY);
    const text = ResourceOverrides._entryText(map);
    const created = await LorebookManager.ensureEntry(id, RESOURCE_CONFIG_ENTRY, text);
    if (!created) await LorebookManager.updateEntryText(RESOURCE_CONFIG_CATEGORY, RESOURCE_CONFIG_ENTRY, text);
    ResourceOverrides._cache = map;
  }
}

// Success tables live in the same config family: an optional lorebook entry
// (JSON array of tables, or a map name -> table, below the marker) overlaid on
// the built-in defaults (degrees/damage/soak). Reloaded with the overrides.
export const SUCCESS_TABLES_ENTRY = "wod:config:success-tables";

export async function loadSuccessTablesFromLorebook(): Promise<number> {
  SuccessTableRegistry.reset();
  const text = await LorebookManager.entryText(RESOURCE_CONFIG_CATEGORY, SUCCESS_TABLES_ENTRY);
  if (!text) return 0;
  const body = LorebookManager.contentBelowHeader(text).trim();
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return 0; }
  const list: SuccessTable[] = Array.isArray(parsed)
    ? parsed as SuccessTable[]
    : (parsed && typeof parsed === "object")
      ? Object.entries(parsed as Record<string, Omit<SuccessTable, "name">>).map(([name, t]) => ({ ...t, name }))
      : [];
  let count = 0;
  for (const t of list) {
    if (t && typeof t.name === "string") { SuccessTableRegistry.register(t); count++; }
  }
  return count;
}

// =============================================================================
// CONSTRAINT GROUPS - the story's allow/deny rules over trait options
// -----------------------------------------------------------------------------
// Same config family as resources/tables: one lorebook entry (wod:config /
// wod:config:constraints) holds a JSON array of ConstraintGroups (or a
// name -> group map) below the marker. Entirely ST-defined (no built-in
// defaults); cached for sync reads (the ResourceOverrides pattern); reloaded at
// init and on both creator-mode sync points. [[define-constraint]] writes it and
// creator mode can hand-edit it. Enforced at creation later; surfaced now via
// [[check-constraints]].
// =============================================================================
export const CONSTRAINTS_ENTRY = "wod:config:constraints";

export class ConstraintRegistry {
  private static _cache: ConstraintGroup[] = [];

  static all(): ConstraintGroup[] { return ConstraintRegistry._cache; }
  static get(name: string): ConstraintGroup | undefined {
    const n = StringUtil.normalize(name);
    return ConstraintRegistry._cache.find(g => g.name === n);
  }
  static reset(): void { ConstraintRegistry._cache = []; }

  private static _entryText(groups: ConstraintGroup[]): string {
    return [
      "Constraint groups: the story's allow/deny rules over Backgrounds and",
      "Merits/Flaws. The JSON array below the marker lists groups; each has a name,",
      "relation (exclusive|restricted|forbidden), domain",
      "(background|merit|flaw|meritflaw|any), members, optional max (exclusive),",
      "scope (templates/choices it applies to), and note. [[define-constraint]]",
      "edits this for you; you may also edit it by hand in creator mode.",
      SRD_HEADER_MARKER,
      JSON.stringify(groups, null, 2),
    ].join("\n");
  }

  // Read the entry into the cache ([] when missing or unparseable). Accepts a
  // JSON array of groups OR a name -> group map; each is normalized.
  static async loadFromLorebook(): Promise<number> {
    ConstraintRegistry._cache = [];
    const text = await LorebookManager.entryText(RESOURCE_CONFIG_CATEGORY, CONSTRAINTS_ENTRY);
    if (!text) return 0;
    const body = LorebookManager.contentBelowHeader(text).trim();
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { return 0; }
    const list: Array<Partial<ConstraintGroup> & { name: string }> = Array.isArray(parsed)
      ? parsed as Array<Partial<ConstraintGroup> & { name: string }>
      : (parsed && typeof parsed === "object")
        ? Object.entries(parsed as Record<string, Partial<ConstraintGroup>>).map(([name, g]) => ({ ...g, name }))
        : [];
    ConstraintRegistry._cache = list.filter(g => g && typeof g.name === "string" && g.name.trim().length > 0).map(makeConstraintGroup);
    return ConstraintRegistry._cache.length;
  }

  // Replace the whole set (create the category/entry on first use) + cache it.
  static async save(groups: ConstraintGroup[]): Promise<void> {
    const { id } = await LorebookManager.ensureCategory(RESOURCE_CONFIG_CATEGORY);
    const text = ConstraintRegistry._entryText(groups);
    const created = await LorebookManager.ensureEntry(id, CONSTRAINTS_ENTRY, text);
    if (!created) await LorebookManager.updateEntryText(RESOURCE_CONFIG_CATEGORY, CONSTRAINTS_ENTRY, text);
    ConstraintRegistry._cache = groups;
  }

  // Add or replace one group (by normalized name) and persist.
  static async put(group: ConstraintGroup): Promise<void> {
    const rest = ConstraintRegistry._cache.filter(g => g.name !== group.name);
    await ConstraintRegistry.save([...rest, group]);
  }

  // Remove one group by name; returns whether it existed.
  static async remove(name: string): Promise<boolean> {
    const n = StringUtil.normalize(name);
    const rest = ConstraintRegistry._cache.filter(g => g.name !== n);
    if (rest.length === ConstraintRegistry._cache.length) return false;
    await ConstraintRegistry.save(rest);
    return true;
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
// conditions stay a LiveCharacter concern for now.
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

export const RESOURCES_WIZARD: WizardDefinition = {
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
    return `((OOC-Storyteller: Wizard cancelled - nothing saved.))`;
  }
  const def = WIZARD_DEFS[active.def];
  if (!def) {
    await WizardSession.clear();
    return `((OOC-Storyteller: The active wizard "${active.def}" no longer exists - session cleared.))`;
  }
  const resolved = resolveReply(active.prompt, raw);
  if ("error" in resolved) {
    return `((OOC-Storyteller: ${resolved.error}. ${renderPromptText(active.prompt)}))`;
  }
  const r = await def.answer(active.state, resolved.value);
  if (r.error) return `((OOC-Storyteller: ${r.error}. ${renderPromptText(active.prompt)}))`;
  if (r.done) {
    await WizardSession.clear();
    return `((OOC-Storyteller: ${def.title} finished. ${r.summary ?? ""}))`;
  }
  await WizardSession.set({ def: active.def, state: r.state!, prompt: r.prompt! });
  return `((OOC-Storyteller: ${renderPromptText(r.prompt!)}))`;
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
  // Registered verb -> its one-line help string (drives [[help]]).
  static helpFor(verb: string): string | undefined { return CommandRouter._registry.get(verb.toLowerCase())?.help; }
  static help(): { verb: string; help: string }[] {
    return [...CommandRouter._registry.entries()].map(([verb, def]) => ({ verb, help: def.help }));
  }

  static async creatorModeEnabled(): Promise<boolean> {
    return (await CommandRouter._storage.getOrDefault("creator-mode", false)) as boolean;
  }
  static async setCreatorMode(on: boolean): Promise<void> { await CommandRouter._storage.set("creator-mode", on); }

  // Routes one command body to its handler; returns the OOC replacement text
  // (always a single line - the host strips newlines from inputText).
  static async route(body: string, ctx: CommandContext = {}): Promise<string> {
    const cmd = CommandParser.parse(body);
    // While creator mode is on, the player may have edited character entries or
    // the resource-override entry: pick those edits up before any command runs.
    if (await CommandRouter.creatorModeEnabled()) {
      await CharacterStore.syncFromLorebook();
      await ResourceOverrides.loadFromLorebook();
      await loadSuccessTablesFromLorebook();
      await ConstraintRegistry.loadFromLorebook();
    }
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
  await ResourceOverrides.loadFromLorebook();
  await loadSuccessTablesFromLorebook();
  await ConstraintRegistry.loadFromLorebook();
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
  return `((OOC-Storyteller: Created playable character "${name}" [${rawTemplates.join("+")}] - Attributes at 1, Abilities at 0, everything else unassigned.${note} Its sheet is the "pc:${StringUtil.normalize(name)}" entry in "${PLAYER_CHARACTERS_CATEGORY}"; use creator mode to edit it. Tip: [[configure-resources]] walks you through tuning how resources work.))`;
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
  opts: { targetArg?: string; applications?: number; rng?: Rng; rollTags?: string[] } = {}
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
async function applySpend(char: PlayableCharacter, cmd: ParsedCommand, ctx: CommandContext, rollTags: string[], spendOverride?: string): Promise<{ extra?: Partial<RollModifier>; note: string; refuse?: string }> {
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
    return { note: "", refuse: `${def.name}:${effectName} is a ${kind} effect - use [[spend ${def.name}:${effectName} ...]] outside a roll` };
  }

  const r = await applyEffectSpec(char, def, effectName ?? "", e, { applications, rng: ctx.rng, rollTags });
  if (r.insufficient) return mandatory ? { note: "", refuse: r.insufficient } : { note: `${r.insufficient} - spent nothing` };
  if (r.refuse) return { note: "", refuse: r.refuse };
  return { extra: r.extra, note: `${r.notes.join("; ")}: ${e.label}` };
}

// A character's live roll environment: traits + active boosts, and the wound
// penalty to fold into the dice pool. Shared by rolls and contests.
async function characterRollEnv(char: PlayableCharacter): Promise<{ resolver: (n: string) => number; penalty: number }> {
  const boosts = await CharacterBoosts.all(char);
  const penalty = (await CharacterHealth.summary(char)).penalty;
  return {
    resolver: (n: string): number => resolveTraitFromRecord(char, n) + (boosts[StringUtil.normalize(n)] ?? 0),
    penalty,
  };
}

// Read a table=<name> arg against an outcome. The roll itself never interprets
// its successes - the table does (or the reading is an unknown-table note).
function tableNote(cmd: ParsedCommand, outcome: RollOutcomeKind, successes: number): string {
  const name = cmd.named["table"];
  if (!name) return "";
  const table = SuccessTableRegistry.get(name);
  if (!table) return `unknown table "${name}" (see [[tables]])`;
  return `${table.name}: ${describeTableReading(readSuccessTable(table, outcome, successes))}`;
}

async function rollAndReport(char: PlayableCharacter, cmd: ParsedCommand, ctx: CommandContext, offset: number): Promise<string> {
  const args = extractRollArgs(cmd, offset);
  if (!args.pool) return `((OOC-Storyteller: roll needs a pool, e.g. [[roll strength+brawl]] or a saved [[roll @name]].))`;
  let spec: RollSpec;
  let savedSpend: string | undefined;
  if (args.pool.startsWith("@")) {
    // Saved roll: load the base spec, then apply the supplied overrides (pool is
    // never overridden, so passing `args` straight through to overrideSpec is safe).
    const name = StringUtil.normalize(args.pool.slice(1));
    const base = await NamedRollStore.get(name);
    if (!base) return `((OOC-Storyteller: No saved roll named "${name}". Try [[list-rolls]] or [[name-roll ${name} <pool> ...]].))`;
    savedSpend = base.spend;   // auto-paid unless the command overrides spend=
    spec = overrideSpec(base, args);
  } else {
    spec = makeRollSpec({ ...args, pool: args.pool });
  }
  const spend = await applySpend(char, cmd, ctx, spec.tags, savedSpend);
  if (spend.refuse) return `((OOC-Storyteller: ${char.name} can't: ${spend.refuse}.))`;
  // Rolls see live state: boosted Attributes add to the record's dots, and the
  // wound penalty (negative) comes off the dice pool.
  const env = await characterRollEnv(char);
  const extra: Partial<RollModifier> = { ...(spend.extra ?? {}) };
  if (env.penalty !== 0) extra.diceMod = (extra.diceMod ?? 0) + env.penalty;
  const exec = executeRoll(spec, env.resolver, { rng: ctx.rng, extra });
  const notes = [
    spend.note,
    env.penalty !== 0 ? `wound penalty ${env.penalty}` : "",
    tableNote(cmd, exec.outcome, exec.result?.net ?? 0),
  ].filter(Boolean).join("; ");
  return `((OOC-Storyteller: ${char.name} - ${formatExecution(exec)}${notes ? ` - ${notes}` : ""}))`;
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

// Save a reusable roll: name is positional[0], then the roll grammar at offset 1.
async function cmdNameRoll(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return `((OOC-Storyteller: name-roll needs a name, e.g. [[name-roll dodge dexterity+dodge 6]].))`;
  const args = extractRollArgs(cmd, 1);
  if (!args.pool) return `((OOC-Storyteller: name-roll needs a pool, e.g. [[name-roll dodge dexterity+dodge 6]].))`;
  const spec = makeRollSpec({ ...args, pool: args.pool });
  const spend = cmd.named["spend"]?.trim();
  await NamedRollStore.save(name, spend ? { ...spec, spend } : spec);
  const key = StringUtil.normalize(name);
  return `((OOC-Storyteller: Saved roll "${key}" = ${describeSpec(spec)}${spend ? `, spend=${spend}` : ""}. Use it with [[roll @${key}]].))`;
}

async function cmdListRolls(): Promise<string> {
  const map = await NamedRollStore.all();
  const names = Object.keys(map);
  if (!names.length) return `((OOC-Storyteller: No saved rolls yet. Save one with [[name-roll <name> <pool> ...]].))`;
  const items = names.map(n => `${n} (${describeSpec(map[n])}${map[n].spend ? `, spend=${map[n].spend}` : ""})`).join("; ");
  return `((OOC-Storyteller: Saved rolls: ${items}.))`;
}

async function cmdForgetRoll(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return `((OOC-Storyteller: forget-roll needs a name, e.g. [[forget-roll dodge]].))`;
  const key = StringUtil.normalize(name);
  return (await NamedRollStore.remove(key))
    ? `((OOC-Storyteller: Forgot saved roll "${key}".))`
    : `((OOC-Storyteller: No saved roll named "${key}".))`;
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
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  const args = extractRollArgs(cmd, 0);
  if (!args.pool) return `((OOC-Storyteller: extended-roll needs a pool, e.g. [[extended-roll strength+stamina requires=8 intervals=4]].))`;
  if (args.pool.startsWith("@")) return `((OOC-Storyteller: extended-roll takes a pool expression (e.g. strength+stamina), not a saved @name.))`;
  const intOf = (s: string | undefined): number | undefined => { if (s === undefined) return undefined; const v = parseInt(s, 10); return Number.isNaN(v) ? undefined : v; };
  const maxRolls = intOf(cmd.named["intervals"]) ?? 0;
  if (maxRolls < 1) return `((OOC-Storyteller: extended-roll needs intervals=<max rolls> (at least 1).))`;
  const target = args.requires ?? 1;   // `requires=` is the accumulated target
  const base = makeRollSpec({ ...args, pool: args.pool, requires: 1 });
  const action: ExtendedRoll = {
    id: api.v1.uuid(),
    label: cmd.named["label"] ?? "",
    base, target, maxRolls,
    interval: cmd.named["interval"] ?? "",
    onBotch: parseBotchPolicy(cmd.named["on-botch"]),
    accumulated: 0, rollsUsed: 0, status: "open", log: [],
  };
  const exec = executeRoll(base, n => resolveTraitFromRecord(char, n), { rng: ctx.rng });
  const { action: after, note } = applyInterval(action, exec, char.name);
  await ExtendedRollStore.save(after);
  if (after.status === "open") await ExtendedRollStore.setCurrent(after.id);
  const tail = after.status === "open" ? ` Continue with [[continue-roll]] (id ${after.id}).` : "";
  return `((OOC-Storyteller: ${char.name} starts extended ${describeExtended(after)}. Interval 1: ${note}.${tail}))`;
}

async function cmdContinueRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  const action = await ExtendedRollStore.resolve(cmd.positional[0]);
  if (!action) return `((OOC-Storyteller: No open extended action. Start one with [[extended-roll ...]] or name its id.))`;
  if (action.status !== "open") return `((OOC-Storyteller: That extended action is already ${action.status}.))`;
  const spec = overrideSpec(action.base, rollOverridesFromNamed(cmd));
  const exec = executeRoll(spec, n => resolveTraitFromRecord(char, n), { rng: ctx.rng });
  const { action: after, note } = applyInterval(action, exec, char.name);
  await ExtendedRollStore.save(after);
  if (after.status !== "open" && (await ExtendedRollStore.currentId()) === after.id) await ExtendedRollStore.clearCurrent();
  return `((OOC-Storyteller: ${char.name} continues ${describeExtended(after)}. This interval: ${note}.))`;
}

async function cmdRollStatus(cmd: ParsedCommand): Promise<string> {
  const action = await ExtendedRollStore.resolve(cmd.positional[0]);
  if (!action) return `((OOC-Storyteller: No extended action found. Start one with [[extended-roll ...]].))`;
  const recent = action.log.slice(-3).map(l => `${l.by}: ${l.outcome === "botch" ? "botch" : `+${l.net}`}`).join(", ");
  return `((OOC-Storyteller: ${describeExtended(action)}${recent ? ` | recent: ${recent}` : ""}.))`;
}

async function cmdCancelRoll(cmd: ParsedCommand): Promise<string> {
  const action = await ExtendedRollStore.resolve(cmd.positional[0]);
  if (!action) return `((OOC-Storyteller: No extended action to cancel.))`;
  await ExtendedRollStore.remove(action.id);
  if ((await ExtendedRollStore.currentId()) === action.id) await ExtendedRollStore.clearCurrent();
  return `((OOC-Storyteller: Cancelled extended action${action.label ? ` "${action.label}"` : ""} (was ${action.accumulated}/${action.target}).))`;
}

async function cmdResources(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  const views = await CharacterResources.all(char);
  if (!views.length) return `((OOC-Storyteller: ${char.name} has no resources.))`;
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
  return `((OOC-Storyteller: ${char.name} resources - ${items}.))`;
}

// One line of health state for OOC replies.
function healthLine(s: HealthSummary): string {
  const state = s.isDead ? " - DEAD" : s.isIncapacitated ? " - INCAPACITATED" : "";
  const overkill = s.overkill ? ` +${s.overkill} overkill` : "";
  return `${s.level} (penalty ${s.penalty}): ${s.bashing}B/${s.lethal}L/${s.aggravated}A, ${s.filled}/${s.capacity}${overkill}${state}`;
}

// spend <resource[:effect]> [target] [applications] - a plain deduction, or any
// configured effect run through the interpreter (heal, increase, pure cost,
// advisory ops...). The target argument is only consumed when an "increase" op
// has a group/bucket constraint to pick within.
async function cmdSpend(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  const raw = cmd.positional[0]?.trim();
  if (!raw) return `((OOC-Storyteller: spend needs a resource, e.g. [[spend willpower]], [[spend blood:heal 2]] or [[spend blood:boost strength 2]].))`;
  const [which, effectName] = raw.split(":").map(s => s.trim());
  const def = CharacterResources.resolveDef(char, which);
  if (!def) return `((OOC-Storyteller: ${char.name} has no resource "${which}".))`;
  const e = resourceEffect(def, effectName || undefined);
  if (effectName && !e) return `((OOC-Storyteller: ${def.name} has no "${effectName}" effect.))`;

  if (!e) {
    // No effect configured: plain deduction (with optional reason).
    const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
    const { spent } = await CharacterResources.spend(char, which, amount);
    if (spent === 0) return `((OOC-Storyteller: ${char.name} has no ${def.name} to spend.))`;
    const now = await CharacterResources.current(char, def);
    const reason = cmd.named["reason"] ? ` (${cmd.named["reason"]})` : "";
    return `((OOC-Storyteller: ${char.name} spends ${spent} ${def.name}${reason}. Now ${now}/${def.max}.))`;
  }

  // Does any increase op need the player to pick a trait within a constraint?
  const needsTarget = e.apply.some(o =>
    o.op.toLowerCase() === "increase" && "need" in CharacterBoosts.resolveIncreaseTarget(char, o.target, undefined));
  const targetArg = needsTarget ? cmd.positional[1]?.trim() : undefined;
  if (needsTarget && !targetArg) {
    return `((OOC-Storyteller: ${def.name}${effectName ? `:${effectName}` : ""} needs a trait, e.g. [[spend ${raw} strength 2]].))`;
  }
  const applications = Math.max(1, parseInt(cmd.positional[needsTarget ? 2 : 1] ?? "1", 10) || 1);

  const r = await applyEffectSpec(char, def, effectName ?? "", e, { targetArg, applications, rng: ctx.rng });
  if (r.insufficient) return `((OOC-Storyteller: ${char.name} has no ${def.name} to spend - ${r.insufficient}.))`;
  if (r.refuse) return `((OOC-Storyteller: ${r.refuse}.))`;
  const now = await CharacterResources.current(char, def);
  const rollOnly = r.extra !== undefined && e.apply.every(isRollOp) && e.apply.length > 0;
  const tail = rollOnly ? " (roll modifiers apply only inside a roll - use [[roll ... spend=...]])" : "";
  return `((OOC-Storyteller: ${char.name} - ${r.notes.join("; ")}. ${def.name} now ${now}/${def.max}.${tail}))`;
}

async function cmdResetUses(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  await EffectUses.resetAll(char);
  return `((OOC-Storyteller: ${char.name}'s effect-use counters reset (new scene/turn).))`;
}

async function cmdDamage(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  const severity = (cmd.positional[0] ?? "").trim().toLowerCase();
  if (severity !== "bashing" && severity !== "lethal" && severity !== "aggravated") {
    return `((OOC-Storyteller: damage needs a severity (bashing, lethal or aggravated), e.g. [[damage lethal 2]].))`;
  }
  const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
  const summary = await CharacterHealth.damage(char, severity, amount);
  return `((OOC-Storyteller: ${char.name} takes ${amount} ${severity}. Health: ${healthLine(summary)}.))`;
}

async function cmdHealth(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  const summary = await CharacterHealth.summary(char);
  const boosts = await CharacterBoosts.all(char);
  const boostBits = Object.entries(boosts).map(([k, v]) => `${StringUtil.toTitleCase(k)} +${v}`).join(", ");
  return `((OOC-Storyteller: ${char.name} - ${healthLine(summary)}${boostBits ? `. Boosts: ${boostBits}` : ""}.))`;
}

async function cmdClearBoosts(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  await CharacterBoosts.clear(char);
  return `((OOC-Storyteller: ${char.name}'s attribute boosts fade.))`;
}

async function cmdConfigureResources(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]] first - the wizard configures the resources your templates grant.))`;
  if (await WizardSession.get()) return `((OOC-Storyteller: A wizard is already running - answer it, or [[cancel-wizard]].))`;
  const defs = CharacterResources.defsFor(char);
  const r = await RESOURCES_WIZARD.start({ charName: char.name, defs });
  if (r.done || !r.prompt || !r.state) return `((OOC-Storyteller: ${r.summary ?? "Nothing to configure."}))`;
  await WizardSession.set({ def: RESOURCES_WIZARD.id, state: r.state, prompt: r.prompt });
  return `((OOC-Storyteller: ${RESOURCES_WIZARD.title} - your next plain messages answer the wizard. ${renderPromptText(r.prompt)}))`;
}

async function cmdCancelWizard(): Promise<string> {
  if (!(await WizardSession.get())) return `((OOC-Storyteller: No wizard is running.))`;
  await WizardSession.clear();
  return `((OOC-Storyteller: Wizard cancelled - nothing saved.))`;
}

async function cmdGain(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  const which = cmd.positional[0]?.trim();
  if (!which) return `((OOC-Storyteller: gain needs a resource, e.g. [[gain willpower]].))`;
  const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
  const def = CharacterResources.resolveDef(char, which);
  if (!def) return `((OOC-Storyteller: ${char.name} has no resource "${which}".))`;
  const { value } = await CharacterResources.gain(char, which, amount);
  return `((OOC-Storyteller: ${char.name} regains ${def.name}. Now ${value}/${def.max}.))`;
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
      const merged: Partial<RollModifier> = { ...(extra ?? {}) };
      if (env.penalty !== 0) merged.diceMod = (merged.diceMod ?? 0) + env.penalty;
      return executeRoll(base, env.resolver, { rng, extra: merged });
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

async function cmdVersus(mode: ContestMode, cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const me = await CharacterStore.getCurrent();
  if (!me) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  const myPool = cmd.positional[0]?.trim();
  const theirPool = cmd.positional[1]?.trim();
  const verb = mode === "resisted" ? "resist" : "contest";
  if (!myPool || !theirPool) {
    return `((OOC-Storyteller: ${verb} needs your pool and the opposition's, e.g. [[${verb} dexterity+stealth perception+alertness vs="Erik"]].))`;
  }
  const oppArg = cmd.named["vs"]?.trim();
  const oppChar = oppArg ? await CharacterStore.load(oppArg) : undefined;
  const oppName = oppChar ? oppChar.name : (oppArg || (mode === "resisted" ? "the resistance" : "the opposition"));

  const myTags = cmd.named["tags"] ? cmd.named["tags"].split(",").map(t => t.trim()).filter(Boolean) : undefined;
  const mySpec = makeRollSpec({ pool: myPool, difficulty: intOrUndef(cmd.named["difficulty"] ?? cmd.named["diff"]), tags: myTags });
  const theirSpec = makeRollSpec({ pool: theirPool, difficulty: intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]) });

  // The actor may spend on their own roll (fuel / roll-op effects only), exactly
  // like [[roll spend=...]]; standalone effects refuse with the [[spend]] pointer.
  const spend = await applySpend(me, cmd, ctx, mySpec.tags);
  if (spend.refuse) return `((OOC-Storyteller: ${me.name} can't: ${spend.refuse}.))`;

  const myExtra: Partial<RollModifier> = { ...(spend.extra ?? {}) };
  const myEnv = await characterRollEnv(me);
  if (myEnv.penalty !== 0) myExtra.diceMod = (myExtra.diceMod ?? 0) + myEnv.penalty;
  const myExec = executeRoll(mySpec, myEnv.resolver, { rng: ctx.rng, extra: myExtra });
  const theirExec = await execContestSide(theirSpec, oppChar?.name, ctx.rng);

  const outcome = compareRolls(mode, myExec, theirExec);
  const t = contestTableInput(outcome);
  const notes = [outcome.note, tableNote(cmd, t.outcome, t.successes), spend.note].filter(Boolean).join("; ");
  return `((OOC-Storyteller: ${mode} - ${me.name}: ${formatExecution(myExec)} vs ${oppName}: ${formatExecution(theirExec)} - ${notes}))`;
}

const cmdResist: CommandHandler = (cmd, ctx) => cmdVersus("resisted", cmd, ctx);
const cmdContest: CommandHandler = (cmd, ctx) => cmdVersus("contested", cmd, ctx);

// =============================================================================
// EXTENDED CONTESTS - both sides accumulate across rounds; first to the goal wins
// =============================================================================
async function cmdExtendedContest(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const me = await CharacterStore.getCurrent();
  if (!me) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  const myPool = cmd.positional[0]?.trim();
  const theirPool = cmd.positional[1]?.trim();
  if (!myPool || !theirPool) {
    return `((OOC-Storyteller: extended-contest needs both pools, e.g. [[extended-contest wits+melee wits+melee vs="Erik" target=5 rounds=5]].))`;
  }
  const oppArg = cmd.named["vs"]?.trim();
  const oppChar = oppArg ? await CharacterStore.load(oppArg) : undefined;
  const oppName = oppChar ? oppChar.name : (oppArg || "the opposition");

  const target = intOrUndef(cmd.named["target"] ?? cmd.named["requires"]) ?? 0;
  if (target < 1) return `((OOC-Storyteller: extended-contest needs target=<successes> (the goal both race to).))`;
  const maxRounds = intOrUndef(cmd.named["rounds"] ?? cmd.named["intervals"]) ?? 0;
  if (maxRounds < 1) return `((OOC-Storyteller: extended-contest needs rounds=<max> (at least 1).))`;

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
  return `((OOC-Storyteller: ${me.name} opens ${describeContest(after)}. Round 1: ${note}.${tail}))`;
}

async function cmdContinueContest(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return `((OOC-Storyteller: No open contest. Start one with [[extended-contest ...]] or name its id.))`;
  if (contest.status !== "open") {
    const who = contest.status === "draw" ? "a draw" : `won by ${contest.status === "a" ? contest.a.name : contest.b.name}`;
    return `((OOC-Storyteller: That contest is already ${who}.))`;
  }
  const aSpec = overrideSpec(contest.a.base, rollOverridesFromNamed(cmd));
  const vDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
  const bSpec = vDiff !== undefined ? overrideSpec(contest.b.base, { difficulty: vDiff }) : contest.b.base;
  const aExec = await execContestSide(aSpec, contest.a.char, ctx.rng);
  const bExec = await execContestSide(bSpec, contest.b.char, ctx.rng);
  const { contest: after, note } = applyContestRound(contest, aExec, bExec);
  await ExtendedContestStore.save(after);
  if (after.status !== "open" && (await ExtendedContestStore.currentId()) === after.id) await ExtendedContestStore.clearCurrent();
  return `((OOC-Storyteller: ${describeContest(after)}. This round: ${note}.))`;
}

async function cmdContestStatus(cmd: ParsedCommand): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return `((OOC-Storyteller: No extended contest found. Start one with [[extended-contest ...]].))`;
  const recent = contest.log.slice(-3).map(l => `r${l.round}: ${contest.a.name} +${l.aNet}/${contest.b.name} +${l.bNet}`).join(", ");
  return `((OOC-Storyteller: ${describeContest(contest)}${recent ? ` | recent: ${recent}` : ""}.))`;
}

async function cmdCancelContest(cmd: ParsedCommand): Promise<string> {
  const contest = await ExtendedContestStore.resolve(cmd.positional[0]);
  if (!contest) return `((OOC-Storyteller: No extended contest to cancel.))`;
  await ExtendedContestStore.remove(contest.id);
  if ((await ExtendedContestStore.currentId()) === contest.id) await ExtendedContestStore.clearCurrent();
  const progress = `${contest.a.name} ${contest.a.accumulated}/${contest.target} vs ${contest.b.name} ${contest.b.accumulated}/${contest.target}`;
  return `((OOC-Storyteller: Cancelled contest${contest.label ? ` "${contest.label}"` : ""} (was ${progress}).))`;
}

// List the success tables, or lay one out in full. A table interprets a number
// of successes; attach table=<name> to a roll/resist/contest to read it.
async function cmdTables(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (name) {
    const t = SuccessTableRegistry.get(name);
    if (!t) return `((OOC-Storyteller: No success table "${StringUtil.normalize(name)}". See [[tables]].))`;
    return `((OOC-Storyteller: ${describeTable(t)}.))`;
  }
  const all = SuccessTableRegistry.all();
  const items = all.map(t => t.description ? `${t.name} (${t.description})` : t.name).join("; ");
  return `((OOC-Storyteller: Success tables: ${items}. [[tables <name>]] for detail; add table=<name> to a roll/resist/contest.))`;
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
    const def = MeritFlawRegistry.get(name);
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
  if (!name) return `((OOC-Storyteller: define-constraint needs name="...", e.g. [[define-constraint name="clan-only-backgrounds" relation=restricted domain=background members="cappadocian-lore" scope="cappadocian"]].))`;
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
  return `((OOC-Storyteller: Defined constraint ${describeConstraint(group)}.))`;
}

async function cmdConstraints(): Promise<string> {
  const all = ConstraintRegistry.all();
  if (!all.length) return `((OOC-Storyteller: No constraint groups defined. Add one with [[define-constraint ...]] or [[win-constraint]].))`;
  const items = all.map(g => `${g.name} (${g.relation}/${g.domain}, ${g.members.length} member${g.members.length === 1 ? "" : "s"})`).join("; ");
  return `((OOC-Storyteller: Constraint groups: ${items}. [[constraint <name>]] for detail.))`;
}

async function cmdConstraint(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return `((OOC-Storyteller: constraint needs a name, e.g. [[constraint clan-only-backgrounds]]. [[constraints]] lists them.))`;
  const g = ConstraintRegistry.get(name);
  if (!g) return `((OOC-Storyteller: No constraint group "${StringUtil.normalize(name)}". See [[constraints]].))`;
  return `((OOC-Storyteller: ${describeConstraint(g)}.))`;
}

async function cmdForgetConstraint(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return `((OOC-Storyteller: forget-constraint needs a name, e.g. [[forget-constraint clan-only-backgrounds]].))`;
  const key = StringUtil.normalize(name);
  return (await ConstraintRegistry.remove(key))
    ? `((OOC-Storyteller: Forgot constraint group "${key}".))`
    : `((OOC-Storyteller: No constraint group "${key}".))`;
}

async function cmdCheckConstraints(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return `((OOC-Storyteller: No active character. Select one with [[play name="..."]].))`;
  const groups = ConstraintRegistry.all();
  if (!groups.length) return `((OOC-Storyteller: No constraint groups defined - nothing to check.))`;
  const violations = checkConstraints(groups, ownedTraitsOf(char));
  if (!violations.length) return `((OOC-Storyteller: ${char.name} satisfies all ${groups.length} constraint group${groups.length === 1 ? "" : "s"}.))`;
  const lines = violations.map(v => v.detail).join("; ");
  return `((OOC-Storyteller: ${char.name} - ${violations.length} constraint issue${violations.length === 1 ? "" : "s"} (ST-enforced): ${lines}.))`;
}

// --- DISCOVERABILITY -------------------------------------------------------
// [[help]] surfaces the command registry; [[characters]] and [[set-default]]
// round out character selection (creation sets the first default; this changes it).
async function cmdHelp(cmd: ParsedCommand): Promise<string> {
  const verb = cmd.positional[0]?.trim().toLowerCase();
  if (verb) {
    const help = CommandRouter.helpFor(verb);
    return help
      ? `((OOC-Storyteller: ${verb} - ${help}))`
      : `((OOC-Storyteller: No command "${verb}". [[help]] lists them all.))`;
  }
  const verbs = CommandRouter.verbs();
  return `((OOC-Storyteller: ${verbs.length} commands: ${verbs.join(", ")}. [[help <verb>]] for one's usage.))`;
}

async function cmdCharacters(): Promise<string> {
  const names = await CharacterStore.listNames();
  if (!names.length) return `((OOC-Storyteller: No characters yet. Make one with [[create-playable name="..." templates="..."]].))`;
  const currentName = (await CharacterStore.getCurrent())?.name;
  const currentKey = currentName ? StringUtil.normalize(currentName) : undefined;
  const defKey = await CharacterStore.getDefaultName();
  const items: string[] = [];
  for (const key of names) {
    const c = await CharacterStore.load(key);
    const marks: string[] = [];
    if (key === currentKey) marks.push("current");
    if (key === defKey) marks.push("default");
    items.push(marks.length ? `${c?.name ?? key} (${marks.join(", ")})` : (c?.name ?? key));
  }
  return `((OOC-Storyteller: Characters: ${items.join("; ")}. [[play name="..."]] to switch.))`;
}

async function cmdSetDefault(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) return `((OOC-Storyteller: set-default needs a name, e.g. [[set-default name="Rok"]].))`;
  const c = await CharacterStore.load(name);
  if (!c) return `((OOC-Storyteller: No character named "${name}". [[characters]] lists them.))`;
  await CharacterStore.setDefault(c.name);
  return `((OOC-Storyteller: ${c.name} is now the default character ([[play]] with no name selects it).))`;
}

CommandRouter.register("help", cmdHelp, "help [verb]  (list commands, or show one's usage)");
CommandRouter.register("creator-mode", cmdCreatorMode, "creator-mode set=true|false");
CommandRouter.register("create-playable", cmdCreatePlayable, 'create-playable name="..." templates="a,b"');
CommandRouter.register("play", cmdPlay, 'play [name="..."]  (no name -> default character)');
CommandRouter.register("characters", cmdCharacters, "characters  (list playable characters; marks current/default)");
CommandRouter.register("set-default", cmdSetDefault, 'set-default name="..."  (change the default character)');
CommandRouter.register("roll", cmdRoll, "roll <pool|@name> [difficulty] [diff-mod] requires= dice-modifier= tags= spend=res[:effect][!]");
CommandRouter.register("roll-for", cmdRollFor, 'roll-for "Name" <pool|@name> [difficulty] [diff-mod] requires= dice-modifier= tags= spend=res[:effect][!]');
CommandRouter.register("name-roll", cmdNameRoll, 'name-roll <name> <pool> [difficulty|expr] [diff-mod] requires= dice-modifier= tags= spend=res[:effect][!]');
CommandRouter.register("list-rolls", cmdListRolls, "list-rolls");
CommandRouter.register("forget-roll", cmdForgetRoll, "forget-roll <name>");
CommandRouter.register("extended-roll", cmdExtendedRoll, "extended-roll <pool> requires=<target> intervals=<max> [interval=] [label=] [on-botch=fail|lose-successes|ignore] + roll knobs");
CommandRouter.register("continue-roll", cmdContinueRoll, "continue-roll [id] [difficulty=] [diff-mod=] [dice-modifier=] [tags=]");
CommandRouter.register("roll-status", cmdRollStatus, "roll-status [id]");
CommandRouter.register("cancel-roll", cmdCancelRoll, "cancel-roll [id]");
CommandRouter.register("resources", cmdResources, "resources");
CommandRouter.register("spend", cmdSpend, 'spend <resource[:effect]> [target] [amount] [reason="..."]');
CommandRouter.register("gain", cmdGain, "gain <resource> [amount]");
CommandRouter.register("damage", cmdDamage, "damage <bashing|lethal|aggravated> [n]");
CommandRouter.register("health", cmdHealth, "health");
CommandRouter.register("clear-boosts", cmdClearBoosts, "clear-boosts");
CommandRouter.register("reset-uses", cmdResetUses, "reset-uses (scene/turn change: clears effect-use counters)");
CommandRouter.register("configure-resources", cmdConfigureResources, "configure-resources (guided setup; plain replies answer it)");
CommandRouter.register("cancel-wizard", cmdCancelWizard, "cancel-wizard");
CommandRouter.register("resist", cmdResist, 'resist <your-pool> <their-pool> [vs="Name"] [difficulty=] [vs-difficulty=] [table=] [spend=res[:effect][!]]');
CommandRouter.register("contest", cmdContest, 'contest <your-pool> <their-pool> [vs="Name"] [difficulty=] [vs-difficulty=] [table=] [spend=res[:effect][!]]');
CommandRouter.register("extended-contest", cmdExtendedContest, 'extended-contest <your-pool> <their-pool> target=<n> rounds=<max> [vs="Name"] [label=] [interval=] [on-botch=fail|lose-successes|ignore] [difficulty=] [vs-difficulty=]');
CommandRouter.register("continue-contest", cmdContinueContest, "continue-contest [id] [difficulty=] [vs-difficulty=] [diff-mod=] [dice-modifier=] [tags=]");
CommandRouter.register("contest-status", cmdContestStatus, "contest-status [id]");
CommandRouter.register("cancel-contest", cmdCancelContest, "cancel-contest [id]");
CommandRouter.register("tables", cmdTables, "tables [name]  (list success tables, or lay one out in full)");
CommandRouter.register("define-constraint", cmdDefineConstraint, 'define-constraint name="..." relation=exclusive|restricted|forbidden domain=background|merit|flaw|meritflaw|any members="a,b" [max=N] [scope="..."] [note="..."]');
CommandRouter.register("constraints", cmdConstraints, "constraints (list the story's constraint groups)");
CommandRouter.register("constraint", cmdConstraint, "constraint <name> (show one group in full)");
CommandRouter.register("forget-constraint", cmdForgetConstraint, "forget-constraint <name>");
CommandRouter.register("check-constraints", cmdCheckConstraints, "check-constraints (flag the current character's constraint conflicts)");

const COMMAND_PATTERN = /\[\[([\s\S]*?)\]\]/g;

// Replace every [[command]] in the player's adventure-mode input with its OOC
// note, running commands in order. If the input was ONLY commands (no prose),
// generation is suppressed - the player is operating the system, not the story.
export async function processAdventureInput(rawInputText: string): Promise<OnTextAdventureInputReturnValue | undefined> {
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
