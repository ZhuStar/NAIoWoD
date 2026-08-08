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
import {
  CardValue, CardMap, parseCardText, formatCardText,
  asMap, asText, asNumber, asBool, asList, asStringList, asNamedList, CARD_VALUE_KEY, canonicalCardText,
} from "./core/cardtext";
import { Dice, Rng, RollTrait, RollResult } from "./core/dice";
import {
  Severity, SeverityName, DamagePacket, DamageKind, DamageSource, DamageReaction,
  HealthTrack, HealthSummary, SoakSpec, SoakTypeRule,
} from "./core/damage";
import {
  RulesetConfig, MORTAL_SOAK, TemplateConfig, TEMPLATES, ROAD_OF_HUMANITY, RoadDefinition, roadByName, ResourceDef,
  bloodForGeneration, MeritFlawDef, ArcanumDef, OwnedPowerDef, MeritFlawRequirements,
  SRD_HEADER_MARKER, ALL_ATTRIBUTES,
  resourcesForTemplates, healthLevelsForTemplates, ATTRIBUTES,
  ConstraintGroup, makeConstraintGroup,
  BackgroundDef, makeBackgroundDef, DEFAULT_BACKGROUNDS, grantsFromBackgrounds,
  AfflictionDef, makeAfflictionDef, DEFAULT_AFFLICTIONS,
  EffectOp, resolvePowerInstance, passiveOpsOf,
  Derivation, traitMaxForGeneration, DISCIPLINES, TraitLimit,
  AfflictionExpiry, rollSpendsCharge, expiryElapsed, OrphanPolicy,
  TemplateDef, makeTemplateDef, DEFAULT_TEMPLATE_DEFS, applyTemplateDefs,
  BudgetEntry, BudgetDef,
} from "./rules";
import { ExprScope, ExprResult, Numeric, evaluateExpr, evalNumeric } from "./core/expr";
import {
  ScopedStorage, LorebookManager, MeritFlawRegistry, ArcanumRegistry,
  ListConfigStore, MapConfigStore, CONFIG_CATEGORY,
  ALL_CONFIG_STORES, parseConfigBody, parseNamedConfigList, configEntryText, namedDefsToCard,
  writeTrackedEntry, ensurePath, GENERAL_ENTRY, TABLE_GENERAL_HEADER,
} from "./services";
import {
  RollSpec, SuccessTable, SuccessTableRegistry, DEFAULT_SUCCESS_TABLES, DEFAULT_DIFFICULTY,
  ExtendedRoll, ExtendedContest, BotchPolicy, ContestMode, migrateContest, CONTEST_OPEN,
} from "./rolls";
import { Duration, addDuration, parseStoryDate } from "./core/time";
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
        const cap = typeof def.max === "number" ? def.max : 10;
        trackers.set(key, new Tracker(def.name, Category.TRACKER, chosen, cap, cap));
      } else {
        let max = typeof def.max === "number" ? def.max : 10;
        let perTurn = typeof def.perTurnLimit === "number" ? def.perTurnLimit : Infinity;
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
  // NOTE: the legacy LiveCharacter path has no PlayableCharacter to evaluate an
  // expression against, so a numeric field is used as-is and an expression
  // reads as 0 here. The modern path (CharacterResources) resolves properly.
  private static _resolveStart(def: ResourceDef, chosen: number | undefined): number {
    const flat = (v: Numeric | undefined, fallback = 0): number => (typeof v === "number" ? v : fallback);
    if (chosen === undefined) return flat(def.start);
    if (def.startOptions && !def.startOptions.includes(chosen)) {
      throw new Error(`${def.name} must start at one of [${def.startOptions.join(", ")}], got ${chosen}.`);
    }
    const min = def.startMin ?? 0;
    const max = def.startMax ?? flat(def.max, 10);
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
  // name -> points; kind via MeritFlawRegistry. Parameterized defs are owned as
  // "name:<param>" instances (typed with :: ). MERITS AND FLAWS ONLY.
  meritsFlaws: Record<string, number>;
  // Arcana and Taints, in a bucket of their own because they are a category of
  // their own (rules.ts "OWNED POWERS"): a different registry, a different
  // purse, and a list most characters do not have at all. Same key shape.
  // Absent on every sheet that has none, which is most of them.
  arcana?: Record<string, number>;
  tags: string[];                         // free-form (clan, ghoul, ...)
  // trait -> specialty labels (VERBATIM case - display text). At most one
  // specialty applies per roll, chosen by the specialty= argument.
  specialties?: Record<string, string[]>;
  // A trait the character holds MORE THAN ONE of - two Mentors, three Allies.
  // The bucket above rates it at the HIGHEST (one slot, one number), and every
  // instance is kept here with the note that tells them apart. Multi-instance
  // backgrounds are ST-enforced: nothing yet says WHICH mentor a roll is about
  // (that needs targeting), so the engine stores them and surfaces them.
  instances?: Record<string, TraitInstance[]>;
  // What this character may SPEND, per purse, overriding the template's
  // (rules.ts TemplateConfig.Budgets): an allowance expression, or an
  // allowance with the prices a dot costs from freebies and experience.
  budgets?: Record<string, BudgetEntry>;
  // What this character can USE, on top of what the template can (rules.ts
  // CAPABILITIES). A talisman that teaches a mortal to spend the Quintessence
  // it holds is an `awakened` attunement written here; without it he holds the
  // pool and nothing else. Removing a template's own capability is not a thing
  // a sheet does - a mage who forgets he Awakened is a different template.
  capabilities?: string[];
  // What a purchase ACTUALLY cost, keyed by trait or merit-instance key, as an
  // expression - price paid is not price listed. "0" is the Storyteller
  // granting it outright (a Background you simply have, an arcanum you were
  // made with). Anything not listed here paid the listed price.
  paid?: Record<string, string>;
  // WHERE each of those came from, keyed the same way (rules.ts GRANT_SOURCES).
  // `paid` says what it cost; this says why it cost that - and only the
  // creation sources actually draw on a purse, so a legality proof can tell a
  // ghoul's free Potence dot from a Storyteller's favour from an XP purchase.
  source?: Record<string, string>;
  // Points the chronicle ADDED to a purse, with its reason. The Storyteller's
  // "everyone here is Suspect, so take the Flaw past your cap and keep the
  // freebies" is exactly this: a bonus, recorded as one, rather than a silent
  // edit to the budget.
  purseGrants?: Array<{ purse: string; points: number; source: string; note?: string }>;
  // The choices a template asks for: a vampire's clan, a mage's fellowship.
  // They are not traits - they STEER traits (a clan names its Disciplines, a
  // fellowship its Foundation and Pillars) - so they live in their own map.
  choices?: Record<string, string>;
  // Which Attribute / Ability categories the player made primary, secondary and
  // tertiary. The creation pools are per category, so the report cannot check
  // anything until it knows which is which.
  priorities?: Record<string, string>;
}
// One of several things of the same name (two Mentors), with what THIS one cost.
export interface TraitInstance { rating: number; note?: string; paid?: string }

export class CharacterStore {
  private static _storage = new ScopedStorage();
  private static readonly CURRENT_KEY = "current-character";
  private static readonly DEFAULT_KEY = "default-character";
  private static _key(name: string): string { return `pc:${StringUtil.normalize(name)}`; }
  private static _entryName(name: string): string { return `pc:${StringUtil.normalize(name)}`; }

  // Do these templates actually grant a Willpower tracker of its own? Almost
  // every splat does - but a resource that REPLACES Willpower (Living Resolve)
  // takes over its name, and then a seeded `poolStarts.willpower` would be a
  // phantom trait lookups could still find.
  private static _grantsWillpower(templates: string[]): boolean {
    const defs = resourcesForTemplates(templates, ResourceOverrides.current());
    const replaced = new Set(defs.flatMap(d => (d.replaces ?? []).map(r => StringUtil.normalize(r))));
    return defs.some(d => StringUtil.normalize(d.name) === "willpower" && !replaced.has("willpower"));
  }

  // A fresh potential character: all nine Attributes at 1 (the free dot), every
  // ability at 0 (so the sheet lists them all), Willpower at 0 when the
  // templates grant one, and empty Merits/Flaws & Backgrounds. Other buckets
  // fill in later.
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
    // A splat with Virtues seeds its Road's three at the free dot, the same way
    // Attributes seed at 1. Without them a vampire's derived Road and Willpower
    // would read 0 - the numbers are real from the moment the sheet exists.
    const virtues: Record<string, number> = {};
    for (const key of templates) {
      const tpl = TEMPLATES[StringUtil.normalize(key)];
      if (!tpl?.HasVirtues) continue;
      const free = typeof tpl.Creation.virtueStart === "number" ? tpl.Creation.virtueStart : 1;
      for (const v of (tpl.Morality?.road ?? ROAD_OF_HUMANITY).virtues) virtues[StringUtil.normalize(v)] = free;
    }
    return {
      id: api.v1.uuid(),
      name,
      templates: templates.map(t => StringUtil.normalize(t)),
      stage: "potential",
      attributes, abilities,
      backgrounds: {}, virtues, disciplines: {}, traits: {},
      // Seed a Willpower start ONLY if these templates actually grant one: a
      // character whose Willpower is replaced (the Ouroboros' Living Resolve)
      // must not carry a phantom willpower entry that trait lookups can find.
      poolStarts: CharacterStore._grantsWillpower(templates) ? { willpower: 0 } : {},
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
      `Player character sheet for ${StringUtil.toTitleCase(char.name)}. Below the ${SRD_HEADER_MARKER} line is the`,
      "character's data: one `trait: rating` per line, indented under its group. Write",
      "names the way you say them (\"Animal Ken\"); indent `specialty: ...` under a trait",
      "to give it one. Edit only while creator mode is on ([[creator-mode set=true]]);",
      "your edits are synced into the game when you issue any command or turn creator mode off.",
      SRD_HEADER_MARKER,
      formatCardText(characterToCard(char)),
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
    const char = await CharacterStore._storage.get(CharacterStore._key(name)) as PlayableCharacter | undefined;
    // A sheet stored before Arcana became their own category keeps them in
    // meritsFlaws. Move them on the way out, so nothing downstream ever sees
    // the old shape and no player has to re-enter a character.
    return char ? migratePowerBuckets(char) : undefined;
  }

  // Lorebook -> storage. The player's lorebook edits win; unreadable entries
  // are reported, not synced. Returns what happened for the OOC reply.
  static async syncFromLorebook(): Promise<{ synced: string[]; failed: string[]; emptied: string[] }> {
    const synced: string[] = [];
    const failed: string[] = [];
    const emptied: string[] = [];
    for (const entry of await LorebookManager.entriesInCategory(PLAYER_CHARACTERS_CATEGORY)) {
      const label = (entry.displayName ?? "").trim();
      const body = LorebookManager.contentBelowHeader(entry.text ?? "").trim();
      const char = characterFromCard(parseCardText(body));
      if (!char) { if (label) failed.push(label); continue; }
      // The card is the source of truth, so a group left off it is a group
      // emptied. That is correct and it is also how a sheet loses its
      // Backgrounds without anyone noticing - so SAY it.
      const before = await CharacterStore.load(char.name);
      if (before) {
        for (const [field] of CHARACTER_BUCKETS) {
          const was = Object.keys((before[field] ?? {}) as Record<string, number>).length;
          const now = Object.keys((char[field] ?? {}) as Record<string, number>).length;
          if (was > 0 && now === 0) emptied.push(`${char.name}: ${field} (${was} gone)`);
        }
      }
      await CharacterStore._storage.set(CharacterStore._key(char.name), char);
      synced.push(char.name);
    }
    return { synced, failed, emptied };
  }
}

// --- THE SHEET AS A CARD -----------------------------------------------------
// A character is written the way a player says it: groups of `Trait: rating`,
// names in their display spelling, specialties indented under the trait they
// belong to (the annotation block - core/cardtext.ts). The engine normalizes on
// the way in, so nothing on the card has to be typed in engine spelling.
const CHARACTER_BUCKETS: Array<[keyof PlayableCharacter, string]> = [
  ["attributes", "attributes"],
  ["abilities", "abilities"],
  ["backgrounds", "backgrounds"],
  ["virtues", "virtues"],
  ["disciplines", "disciplines"],
  ["traits", "traits"],
  ["poolStarts", "poolStarts"],
  ["meritsFlaws", "meritsFlaws"],
  ["arcana", "arcana"],
];
// `pools` / `merits` read as the longer engine names, so a player may write
// either spelling on the card. `taints` files with the arcana, because a Taint
// IS an arcanum-category thing (it grants rather than costs).
const BUCKET_SYNONYMS: Record<string, string> = {
  pools: "poolStarts", merits: "meritsFlaws", "merits-flaws": "meritsFlaws",
  taints: "arcana",
};

// Is this key an arcanum or a taint? The ARCANA registry is the only authority:
// a key it doesn't know is not an arcanum. Used to migrate sheets written
// before the two categories were separated - see migratePowerBuckets.
function isArcanumKey(key: string): boolean {
  return resolvePowerInstance(StringUtil.normalize(key), n => ArcanumRegistry.get(n)) !== undefined;
}

// SHEETS WRITTEN BEFORE THE SPLIT kept arcana inside `meritsFlaws`, because
// there was one bucket. Move anything the arcana registry claims into its own
// bucket on the way through - reading a sheet, and reading a card. Nobody has
// to re-enter a character, and after one save the stored shape is the new one.
export function migratePowerBuckets(char: PlayableCharacter): PlayableCharacter {
  const strays = Object.keys(char.meritsFlaws ?? {}).filter(isArcanumKey);
  if (!strays.length) return char;
  const arcana = { ...(char.arcana ?? {}) };
  for (const key of strays) {
    arcana[key] ??= char.meritsFlaws[key];
    delete char.meritsFlaws[key];
  }
  char.arcana = arcana;
  return char;
}

// A merit instance key ("trait-affinity:melee") keeps its parameter; only the
// def's own name is title-cased for display.
function displayTraitName(key: string): string {
  const i = key.indexOf(":");
  return i < 0 ? StringUtil.toTitleCase(key) : `${StringUtil.toTitleCase(key.slice(0, i))}:${key.slice(i + 1)}`;
}

export function characterToCard(char: PlayableCharacter): CardMap {
  const card: CardMap = { name: StringUtil.toTitleCase(char.name), id: char.id, stage: char.stage };
  card["templates"] = char.templates.map(t => StringUtil.normalize(t));
  if (char.tags.length) card["tags"] = char.tags.map(t => StringUtil.normalize(t));
  const specialties = char.specialties ?? {};
  for (const [field, key] of CHARACTER_BUCKETS) {
    const bucket = (char[field] ?? {}) as Record<string, number>;
    const names = Object.keys(bucket);
    if (!names.length) continue;
    const block: CardMap = {};
    for (const name of names) {
      const label = displayTraitName(name);
      const labels = specialties[StringUtil.normalize(name)] ?? [];
      const held = char.instances?.[StringUtil.normalize(name)];
      // More than one of the same Background: write the key once per instance -
      // exactly how it was written - each with its own note.
      const paid = char.paid?.[StringUtil.normalize(name)];
      if (held?.length) {
        block[label] = held.map(inst => {
          const one: CardMap = { [CARD_VALUE_KEY]: inst.rating };
          if (inst.note) one["note"] = inst.note;
          if (inst.paid !== undefined) one["paid"] = inst.paid;
          return one;
        });
        continue;
      }
      if (labels.length || paid !== undefined) {
        const one: CardMap = { [CARD_VALUE_KEY]: bucket[name] };
        if (labels.length) one["specialty"] = labels.length === 1 ? labels[0] : labels;
        if (paid !== undefined) one["paid"] = paid;
        block[label] = one;
      } else {
        block[label] = bucket[name];
      }
    }
    card[key] = block;
  }
  // A specialty on a trait the sheet doesn't rate would be lost; keep it in its
  // own block rather than dropping the player's text.
  const orphans: CardMap = {};
  const rated = new Set(CHARACTER_BUCKETS.flatMap(([field]) => Object.keys((char[field] ?? {}) as Record<string, number>)));
  for (const [trait, labels] of Object.entries(specialties)) {
    if (rated.has(trait) || !labels.length) continue;
    orphans[displayTraitName(trait)] = labels.length === 1 ? labels[0] : labels;
  }
  if (Object.keys(orphans).length) card["specialties"] = orphans;
  if (char.capabilities?.length) card["capabilities"] = [...char.capabilities];
  if (Object.keys(char.source ?? {}).length) card["source"] = { ...char.source } as CardMap;
  if (char.purseGrants?.length) {
    const bonuses: CardMap = {};
    for (const g of char.purseGrants) {
      bonuses[`${g.purse}:${g.source}`] = g.note ? { [CARD_VALUE_KEY]: g.points, note: g.note } : g.points;
    }
    card["purse-grants"] = bonuses;
  }
  // A purse is one line when it is only an allowance, a block when it is
  // priced - the card says whichever the sheet actually holds.
  if (Object.keys(char.budgets ?? {}).length) {
    const purses: CardMap = {};
    for (const [purse, entry] of Object.entries(char.budgets!)) {
      purses[purse] = typeof entry === "string" ? entry : ({ ...entry } as CardMap);
    }
    card["budgets"] = purses;
  }
  if (Object.keys(char.choices ?? {}).length) card["choices"] = { ...char.choices } as CardMap;
  if (Object.keys(char.priorities ?? {}).length) card["priorities"] = { ...char.priorities } as CardMap;
  return card;
}

export function characterFromCard(raw: CardValue | undefined): PlayableCharacter | undefined {
  const card = asMap(raw);
  const name = asText(card["name"]);
  const templates = asStringList(card["templates"]).map(t => StringUtil.normalize(t));
  if (!name || !templates.length) return undefined;
  const stage = asText(card["stage"]) === "ready" ? "ready" : "potential";
  const char: PlayableCharacter = {
    id: asText(card["id"]) ?? api.v1.uuid(),
    name,
    templates,
    stage,
    attributes: {}, abilities: {}, backgrounds: {}, virtues: {}, disciplines: {},
    traits: {}, poolStarts: {}, meritsFlaws: {},
    // Seeded so the bucket loop can fill it; dropped again below if the card
    // named none, because most sheets have no arcana at all.
    arcana: {},
    tags: asStringList(card["tags"]).map(t => StringUtil.normalize(t)),
    specialties: {},
  };
  const specialties: Record<string, string[]> = {};
  const instances: Record<string, TraitInstance[]> = {};
  const paid: Record<string, string> = {};
  const addSpecialties = (trait: string, value: CardValue | undefined): void => {
    const labels = asStringList(value);
    if (labels.length) specialties[trait] = [...(specialties[trait] ?? []), ...labels];
  };
  for (const [rawKey, block] of Object.entries(card)) {
    const field = (BUCKET_SYNONYMS[rawKey.toLowerCase()] ?? rawKey) as keyof PlayableCharacter;
    if (!CHARACTER_BUCKETS.some(([f]) => f === field)) continue;
    const bucket = char[field] as Record<string, number>;
    for (const [rawName, value] of Object.entries(asMap(block))) {
      const trait = StringUtil.normalize(rawName);
      // The key written more than once = more than one of that Background. The
      // slot takes the highest; every instance is kept with its note.
      const written = Array.isArray(value) ? value : [value];
      if (written.length > 1) {
        instances[trait] = written.map(one => {
          const inst: TraitInstance = { rating: asNumber(one) ?? 0 };
          const note = asText(asMap(one)["note"]);
          if (note) inst.note = note;
          const cost = asText(asMap(one)["paid"]);
          if (cost !== undefined) inst.paid = cost;
          return inst;
        });
        bucket[trait] = Math.max(...instances[trait].map(i => i.rating));
      } else {
        bucket[trait] = asNumber(value) ?? 0;
        const cost = asText(asMap(value)["paid"]);
        if (cost !== undefined) paid[trait] = cost;
      }
      for (const one of written) {
        if (asMap(one)["specialty"] !== undefined) addSpecialties(trait, asMap(one)["specialty"]);
      }
    }
  }
  if (Object.keys(instances).length) char.instances = instances;
  if (Object.keys(paid).length) char.paid = paid;
  // A card written before the split lists its arcana under merits-flaws; the
  // registry, not the card, decides which is which.
  migratePowerBuckets(char);
  if (!Object.keys(char.arcana ?? {}).length) delete char.arcana;
  const capabilities = asStringList(card["capabilities"]).map(c => StringUtil.normalize(c));
  if (capabilities.length) char.capabilities = capabilities;
  const source: Record<string, string> = {};
  for (const [k, v] of Object.entries(asMap(card["source"]))) {
    const t = asText(v);
    if (t) source[StringUtil.normalize(k)] = StringUtil.normalize(t);
  }
  if (Object.keys(source).length) char.source = source;
  const purseGrants: PlayableCharacter["purseGrants"] = [];
  for (const [k, v] of Object.entries(asMap(card["purse-grants"]))) {
    const [purse, src] = StringUtil.normalize(k).split(":");
    const points = asNumber(v) ?? 0;
    if (!purse || !points) continue;
    const note = asText(asMap(v)["note"]);
    purseGrants.push({ purse, points, source: src || "storyteller", ...(note ? { note } : {}) });
  }
  if (purseGrants.length) char.purseGrants = purseGrants;
  const budgets: Record<string, BudgetEntry> = {};
  for (const [purse, raw] of Object.entries(asMap(card["budgets"]))) {
    const key = StringUtil.normalize(purse);
    const expr = asText(raw);
    if (expr) { budgets[key] = expr; continue; }
    const m = asMap(raw);
    const entry: BudgetDef = {};
    for (const field of ["allows", "freebie", "experience", "note"] as const) {
      const v = asText(m[field]);
      if (v) entry[field] = v;
    }
    if (Object.keys(entry).length) budgets[key] = entry;
  }
  if (Object.keys(budgets).length) char.budgets = budgets;
  for (const key of ["choices", "priorities"] as const) {
    const map: Record<string, string> = {};
    for (const [k, raw] of Object.entries(asMap(card[key]))) {
      const v = asText(raw);
      if (v) map[StringUtil.normalize(k)] = StringUtil.normalize(v);
    }
    if (Object.keys(map).length) char[key] = map;
  }
  for (const [rawName, value] of Object.entries(asMap(card["specialties"]))) {
    addSpecialties(StringUtil.normalize(rawName), value);
  }
  char.specialties = specialties;
  return char;
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

// =============================================================================
// THE CHARACTER SCOPE - what an expression may refer to
// -----------------------------------------------------------------------------
// One place answers "what is this name worth on this sheet", so every expression
// in the engine - a pool, a difficulty, a purse budget, a trait ceiling, a
// derived value - reads the character the same way.
//
// A bare name searches the buckets in the usual order and falls back to what a
// Background CONFERS and then to what the template DERIVES. A prefixed path
// asks one place and only that place, which is how a Background named
// Generation and the derived `generation` stay different numbers:
//
//     generation              7   (derived: 12 minus the Background)
//     background:generation   5   (the dots on the sheet)
//     derived:willpower       1   (what it WOULD be, ignoring the sheet)
//
// The `extend` hook is how a layer above adds namespaces it owns without this
// module reaching upwards: game.ts hands in `budget:` / `spent:` / `left:` from
// the purse ledger, which is what a legality proof will be built on.
// =============================================================================
const TRAIT_NAMESPACES: Record<string, keyof PlayableCharacter> = {
  attribute: "attributes", ability: "abilities", background: "backgrounds",
  virtue: "virtues", discipline: "disciplines", trait: "traits", pool: "poolStarts",
};

export type ScopeExtension = (path: string[]) => { value: number; from?: string } | undefined;

// The names a namespace RECOGNISES, whether or not this sheet rates them. Only
// the closed vocabularies answer: Abilities and Virtues are already seeded into
// their buckets, and `trait:` is deliberately open, so an unrated name there is
// genuinely unknown.
function knownTraitNames(namespace: string): string[] {
  if (namespace === "attribute") return ALL_ATTRIBUTES.map(a => StringUtil.normalize(a));
  if (namespace === "background") return BackgroundRegistry.all().map(b => StringUtil.normalize(b.name));
  if (namespace === "discipline") return Object.keys(DISCIPLINES).map(d => StringUtil.normalize(d));
  return [];
}

// Every derivation these templates declare, LAST template winning a name.
export function derivationsOf(char: PlayableCharacter): Derivation[] {
  const byTrait = new Map<string, Derivation>();
  for (const key of char.templates) {
    for (const d of TEMPLATES[StringUtil.normalize(key)]?.Derived ?? []) {
      byTrait.set(StringUtil.normalize(d.trait), { ...d, trait: StringUtil.normalize(d.trait) });
    }
  }
  return [...byTrait.values()];
}

// One computed derivation, with everything a report needs to explain it.
export interface DerivedValue {
  trait: string;
  value: number;
  expr: string;
  when: "start" | "always";
  note?: string;
  terms: ExprResult["terms"];
  unknown: string[];
  error?: string;
  overridden?: number;   // the sheet's own rating, when it wins over a "start"
}

// The functions an expression may call beyond the arithmetic built-ins. Domain
// knowledge, so it lives with the rules it comes from.
function scopeFunctions(char: PlayableCharacter, value: (name: string) => number) {
  return (name: string, args: number[]): number | undefined => {
    switch (name) {
      case "trait-max": return traitMaxForGeneration(args[0] ?? 13);
      case "blood-max": return bloodForGeneration(args[0] ?? 13).max;
      case "blood-per-turn": return bloodForGeneration(args[0] ?? 13).perTurn;
      // The sum of the CURRENT Road's rating Virtues - a chronicle that invents
      // a Road gets its derivation without touching this code. `roadRatingExpr`
      // spells the same thing, so a report can say WHICH Virtues.
      case "road-virtues": return roadOf(char).ratingVirtues.reduce((sum, v) => sum + value(v), 0);
      default: return undefined;
    }
  };
}

// The Road this character walks: the explicit choice first (a Ventrue on the
// Road of Kings sums different Virtues), else the template's own.
export function roadOf(char: PlayableCharacter): RoadDefinition {
  const chosen = char.choices?.["road"];
  if (chosen) {
    const road = roadByName(chosen);
    if (road) return road;
  }
  for (const key of char.templates) {
    const road = TEMPLATES[StringUtil.normalize(key)]?.Morality?.road;
    if (road) return road;
  }
  return ROAD_OF_HUMANITY;
}

// Everything this character's template derives, computed. Lazy and memoized
// with a cycle guard, because a derivation may reference another one
// (`trait-max(generation)` needs `generation` first) and a chronicle may
// eventually write one that references itself.
export function derivedValuesOf(char: PlayableCharacter, extend?: ScopeExtension): DerivedValue[] {
  return buildScope(char, extend).derived;
}

interface CharacterScope { scope: ExprScope; derived: DerivedValue[]; valueOf: (name: string) => number }

function buildScope(char: PlayableCharacter, extend?: ScopeExtension): CharacterScope {
  const defs = derivationsOf(char);
  const byTrait = new Map(defs.map(d => [d.trait, d]));
  const done = new Map<string, DerivedValue>();
  const running = new Set<string>();
  const resourceDepth = new Set<string>();
  const granted = grantedTraitsOf(char);

  // The value a bare name is worth: the sheet, then a Background's grant, then
  // the derivation - each only when the one before it had nothing to say.
  const valueOf = (name: string): number => {
    const key = StringUtil.normalize(name);
    const own = resolveTraitFromRecord(char, key);
    const def = byTrait.get(key);
    if (def && (def.when ?? "start") === "always") return derive(key).value;
    if (own) return own;
    const grant = granted[key]?.rating ?? 0;
    if (grant) return grant;
    return def ? derive(key).value : 0;
  };

  const derive = (key: string): DerivedValue => {
    const cached = done.get(key);
    if (cached) return cached;
    const def = byTrait.get(key)!;
    const when = def.when ?? "start";
    const own = resolveTraitFromRecord(char, key);
    if (running.has(key)) {
      // A cycle is a chronicle's mistake, not a crash: the name is worth
      // whatever the sheet says and the report names the loop.
      const stuck: DerivedValue = { trait: key, value: own, expr: def.expr, when, note: def.note, terms: [], unknown: [], error: `${key} defines itself in a circle` };
      done.set(key, stuck);
      return stuck;
    }
    running.add(key);
    const out = evaluateExpr(def.expr, scope);
    running.delete(key);
    const computed: DerivedValue = {
      trait: key, value: out.error ? own : out.value, expr: def.expr, when, note: def.note,
      terms: out.terms, unknown: out.unknown,
      ...(out.error ? { error: out.error } : {}),
      ...(when === "start" && own ? { overridden: own } : {}),
    };
    done.set(key, computed);
    return computed;
  };

  const scope: ExprScope = {
    lookup: (path) => {
      if (path.length === 1) {
        const key = path[0];
        if (byTrait.has(key) || resolveTraitFromRecord(char, key) || granted[key]) {
          return { value: valueOf(key), from: granted[key] && !resolveTraitFromRecord(char, key) ? `from ${granted[key].from}` : undefined };
        }
        // A BARE name the sheet cannot answer still gets offered to the
        // extension. Without this an extension could only ever supply PREFIXED
        // paths, and `full-moons >= 1` on an affliction's until-condition read
        // as an unknown trait worth 0 - which is to say, never true.
        return extend?.(path);
      }
      const [head, ...rest] = path;
      const name = rest.join(":");
      const bucket = TRAIT_NAMESPACES[head];
      if (bucket) {
        const values = (char[bucket] ?? {}) as Record<string, number>;
        if (name in values) return { value: values[name] };
        // UNRATED is not UNKNOWN. A Background this chronicle defines but the
        // character has no dots in is worth 0 - that is a real answer, and
        // `12 - background:generation` must not read as a typo on every sheet
        // without the Background. A name the chronicle does not define at all
        // still comes back unknown, which is the whole point.
        return knownTraitNames(head).includes(name) ? { value: 0 } : undefined;
      }
      // `resource:quintessence:max` - what a POOL is worth, so one resource can
      // be defined from others. The def is read BEFORE replacement filtering, so
      // Living Resolve can still name the Quintessence it hides.
      // `role:willpower` - "Willpower, OR WHATEVER REPLACES IT". Replacement is
      // applied first, so for the one character whose Willpower, Blood, Resolve
      // and Quintessence are one substance, all four names land on Living
      // Resolve. The default field is `start`, because a pool's start is its
      // RATING (a mage's Willpower 5 in a tracker that tops out at 10) and a
      // rating is what a rule means when it says "equal to your Willpower".
      if (head === "resource" || head === "role") {
        const [resName, ...fieldParts] = rest;
        const key = StringUtil.normalize(resName);
        const field = StringUtil.normalize(fieldParts.join(":") || (head === "role" ? "start" : "max"));
        const def = head === "role"
          ? CharacterResources.resolveDef(char, key)
          // `resource:` reads the def BEFORE replacement filtering, so Living
          // Resolve can still name the Quintessence and Blood it hides.
          : resourcesForTemplates(char.templates, ResourceOverrides.current()).find(d => StringUtil.normalize(d.name) === key);
        if (!def) return undefined;
        const owner = StringUtil.normalize(def.name);
        // A resource that names ITSELF would spin; the guard makes it 0 and the
        // caller's `unknown`/error path reports the nonsense.
        if (resourceDepth.has(owner)) return { value: 0, from: "circular" };
        resourceDepth.add(owner);
        try {
          // The player's own chosen start IS the rating when there is one.
          const chosen = field === "start" ? char.poolStarts?.[owner] : undefined;
          if (chosen !== undefined) return { value: chosen, from: owner === key ? undefined : def.name };
          const raw = field === "start" ? def.start : field === "per-turn" ? def.perTurnLimit : def.max;
          return { value: raw === undefined ? 0 : evalNumeric(raw, scope, 0), from: owner === key ? undefined : def.name };
        } finally { resourceDepth.delete(owner); }
      }
      if (head === "derived") return byTrait.has(name) ? { value: derive(name).value } : undefined;
      if (head === "granted") return granted[name] ? { value: granted[name].rating, from: `from ${granted[name].from}` } : undefined;
      return extend?.(path);
    },
    call: scopeFunctions(char, (n) => valueOf(n)),
  };

  // Compute every derivation, so a caller that wants the whole picture
  // ([[derived]], [[sheet]]) gets it without re-walking.
  for (const d of defs) derive(d.trait);
  return { scope, derived: defs.map(d => done.get(d.trait)!), valueOf };
}

// A resource's numbers FOR THIS CHARACTER. start/max/perTurnLimit may be
// expressions over the sheet, so they are not knowable from the def alone: a
// mage's Quintessence capacity is a Fount rating away, and a fused pool is the
// sum of the two it stands in for.
export function resourceNumbers(char: PlayableCharacter, def: ResourceDef, extend?: ScopeExtension): { start: number; max: number; perTurn?: number } {
  const scope = characterScope(char, extend);
  const max = Math.max(0, evalNumeric(def.max, scope, 0));
  return {
    start: Math.max(0, Math.min(max, evalNumeric(def.start, scope, 0))),
    max,
    ...(def.perTurnLimit !== undefined ? { perTurn: Math.max(0, evalNumeric(def.perTurnLimit, scope, 0)) } : {}),
  };
}

// THE seam: an expression scope over this character.
export function characterScope(char: PlayableCharacter, extend?: ScopeExtension): ExprScope {
  return buildScope(char, extend).scope;
}

// A trait as every reader should see it: the sheet, a Background's grant, or
// the template's derivation - whichever actually has something to say.
export function traitValueOf(char: PlayableCharacter, name: string, extend?: ScopeExtension): number {
  return buildScope(char, extend).valueOf(name);
}

// Evaluate one expression against a character, keeping the whole result so the
// caller can show its work (and name what it did not recognise).
export function evalOn(char: PlayableCharacter, expr: string, extend?: ScopeExtension): ExprResult {
  return evaluateExpr(expr, characterScope(char, extend));
}

// A rules field that is a number OR an expression, resolved for this character.
export function numericOn(char: PlayableCharacter, value: Numeric | undefined, fallback: number, extend?: ScopeExtension): number {
  return evalNumeric(value, characterScope(char, extend), fallback);
}


// Which KIND of trait a name is, for the rules that ration by kind ("at most
// one Attribute may reach 3"). The character's own buckets answer first, so a
// chronicle that invents an Ability is believed; ALL_ATTRIBUTES catches an
// Attribute the sheet has not rated yet. Undefined = the engine cannot say,
// and the caller reports rather than guesses.
export function traitKindOf(char: PlayableCharacter, name: string): string | undefined {
  const key = StringUtil.normalize(name);
  const buckets: Array<[string, Record<string, number>]> = [
    ["attribute", char.attributes], ["ability", char.abilities],
    ["background", char.backgrounds], ["virtue", char.virtues],
    ["discipline", char.disciplines], ["trait", char.traits], ["pool", char.poolStarts],
  ];
  for (const [kind, bucket] of buckets) if (key in (bucket ?? {})) return kind;
  if (ALL_ATTRIBUTES.some(a => StringUtil.normalize(a) === key)) return "attribute";
  return undefined;
}

// Everything this character's Backgrounds CONFER - the Talisman that is a place
// granting that place's ratings. Highest wins; the source is kept so the sheet
// can say where a rating came from.
export function grantedTraitsOf(char: PlayableCharacter): Record<string, { rating: number; from: string }> {
  return grantsFromBackgrounds(char.backgrounds ?? {}, BackgroundRegistry.all());
}

// A trait as the engine should READ it: the sheet's own rating, or a granted
// one when that is higher. Nothing on the sheet has to duplicate a grant.
export function effectiveTraitOf(char: PlayableCharacter, name: string): number {
  const key = StringUtil.normalize(name);
  return Math.max(resolveTraitFromRecord(char, key), grantedTraitsOf(char)[key]?.rating ?? 0);
}

// A character's PERMANENT rating in a name that may not be a rated trait at
// all. Rated buckets first; failing that, the RESOURCE that owns the name (its
// own name, a role it fills, or a name it replaced) read at the value the
// player set for it - so "his Resolve" finds Living Resolve for the one
// character whose Resolve is that. Always the permanent rating, never the
// spent-down current: this is what a creation-time ceiling is measured against.
export function permanentRatingOf(char: PlayableCharacter, name: string): number {
  const direct = resolveTraitFromRecord(char, name);
  if (direct) return direct;
  const owner = CharacterResources.resolveDef(char, name);
  if (!owner) return 0;
  return resolveTraitFromRecord(char, owner.name) || resourceNumbers(char, owner).start;
}

// --- OWNED POWER INSTANCES + PASSIVE EFFECTS (the owned-power pattern) -------
// Each bucket maps instance keys ("iron-will", "trait-affinity:melee") to
// points, resolved through ITS OWN registry: merits through MeritFlawRegistry,
// arcana through ArcanumRegistry. Unknown or malformed keys are skipped here
// and SURFACED by [[check-constraints]], never silently enforced.
//
// THREE walks, and picking the right one is not a style choice:
//   ownedMeritInstances   - the Merits & Flaws report. NEVER arcana.
//   ownedArcanumInstances - the Arcana & Taints report. NEVER merits.
//   ownedPowerInstances   - both, for MECHANISM: passive ops, purse ledgers,
//                           which power grants an affliction. A machine that
//                           has to look at everything the character owns.
export interface OwnedPowerInstance<T extends OwnedPowerDef = OwnedPowerDef> {
  key: string;
  def: T;
  param?: string;
  points: number;
}
/** @deprecated Named for merits, used for both. Prefer OwnedPowerInstance. */
export type OwnedMeritInstance = OwnedPowerInstance;

function instancesOf<T extends OwnedPowerDef>(
  bucket: Record<string, number> | undefined, lookup: (name: string) => T | undefined,
): Array<OwnedPowerInstance<T>> {
  const out: Array<OwnedPowerInstance<T>> = [];
  for (const [key, points] of Object.entries(bucket ?? {})) {
    const hit = resolvePowerInstance(key, lookup);
    if (hit) out.push({ key: StringUtil.normalize(key), def: hit.def, param: hit.param, points });
  }
  return out;
}

export function ownedMeritInstances(char: PlayableCharacter): Array<OwnedPowerInstance<MeritFlawDef>> {
  return instancesOf(char.meritsFlaws, n => MeritFlawRegistry.get(n));
}
export function ownedArcanumInstances(char: PlayableCharacter): Array<OwnedPowerInstance<ArcanumDef>> {
  return instancesOf(char.arcana, n => ArcanumRegistry.get(n));
}
export function ownedPowerInstances(char: PlayableCharacter): OwnedPowerInstance[] {
  return [...ownedMeritInstances(char), ...ownedArcanumInstances(char)];
}

// Every always-on op the character's owned powers grant ($param substituted,
// amounts scaled by points). Roll-op gates (actionTag/trait) are judged at
// the roll site. BOTH categories: Trait Enhancement is an arcanum and its
// enhance op is as real as Iron Will's.
export function passiveOpsFor(char: PlayableCharacter): EffectOp[] {
  return ownedPowerInstances(char).flatMap(inst => passiveOpsOf(inst.def, inst.param, inst.points));
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
// One lorebook entry IS the library: each roll's name with its spec below the
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
  // `spend` is the resource token ("resolve", "blood::heal", "willpower!");
  // `spendAmount` is how many points of it, so a saved roll can bake in
  // "always burn two Resolve" instead of making you retype spend-amount=2.
  spend?: string; spendAmount?: number; specialty?: string; table?: string;
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

// A saved roll, as a card writes it: the roll's NAME, its spec and sidecars
// indented below. Defaults are omitted so a hand-written spec stays short.
export function savedRollToCard(roll: SavedRoll): CardMap {
  const out: CardMap = { pool: roll.pool };
  if (roll.difficultyExpr) out["difficultyExpr"] = roll.difficultyExpr;
  else if (roll.difficulty !== DEFAULT_DIFFICULTY) out["difficulty"] = roll.difficulty;
  if (roll.difficultyMod) out["difficultyMod"] = roll.difficultyMod;
  if (roll.diceMod) out["diceMod"] = roll.diceMod;
  if (roll.autoSuccesses) out["autoSuccesses"] = roll.autoSuccesses;
  if (roll.uncancelableSuccesses) out["uncancelableSuccesses"] = roll.uncancelableSuccesses;
  if (roll.requires > 1) out["requires"] = roll.requires;
  if (roll.difficultyCap !== undefined) out["difficultyCap"] = roll.difficultyCap;
  if (roll.minDifficulty !== undefined) out["minDifficulty"] = roll.minDifficulty;
  if (roll.tags.length) out["tags"] = [...roll.tags];
  for (const key of ["spend", "specialty", "table", "description"] as const) {
    const v = roll[key];
    if (v) out[key] = v;
  }
  if (roll.spendAmount !== undefined && roll.spendAmount !== 1) out["spendAmount"] = roll.spendAmount;
  if (roll.extended) out["extended"] = { ...roll.extended } as CardMap;
  if (roll.opposed) out["opposed"] = { ...roll.opposed, extended: roll.opposed.extended ? { ...roll.opposed.extended } : undefined } as CardMap;
  if (roll.steps?.length) out["steps"] = roll.steps.map(s => ({ ...s }) as CardMap);
  return out;
}

export function savedRollFromCard(body: CardMap): SavedRoll | undefined {
  const pool = asText(body["pool"]);
  if (!pool) return undefined;
  const roll: SavedRoll = {
    pool,
    difficulty: asNumber(body["difficulty"]) ?? DEFAULT_DIFFICULTY,
    difficultyMod: asNumber(body["difficultyMod"]) ?? 0,
    requires: Math.max(1, asNumber(body["requires"]) ?? 1),
    diceMod: asNumber(body["diceMod"]) ?? 0,
    tags: asStringList(body["tags"]).map(t => StringUtil.normalize(t)),
  };
  const expr = asText(body["difficultyExpr"]);
  if (expr) roll.difficultyExpr = expr;
  const cap = asNumber(body["difficultyCap"]);
  if (cap !== undefined) roll.difficultyCap = cap;
  const floor = asNumber(body["minDifficulty"]);
  if (floor !== undefined) roll.minDifficulty = floor;
  const auto = asNumber(body["autoSuccesses"]);
  if (auto) roll.autoSuccesses = auto;
  const sure = asNumber(body["uncancelableSuccesses"]);
  if (sure) roll.uncancelableSuccesses = sure;
  for (const key of ["spend", "specialty", "table", "description"] as const) {
    const v = asText(body[key]);
    if (v) roll[key] = v;
  }
  const spendAmount = asNumber(body["spendAmount"]);
  if (spendAmount && spendAmount > 1) roll.spendAmount = spendAmount;
  const extendedOf = (v: CardValue | undefined): ExtendedSavedConfig | undefined => {
    const m = asMap(v);
    if (!Object.keys(m).length) return undefined;
    const cfg: ExtendedSavedConfig = {};
    const intervals = asNumber(m["intervals"]);
    if (intervals !== undefined) cfg.intervals = intervals;
    const interval = asText(m["interval"]);
    if (interval) cfg.interval = interval;
    const onBotch = asText(m["onBotch"]);
    if (onBotch === "fail" || onBotch === "lose-successes" || onBotch === "ignore") cfg.onBotch = onBotch;
    return cfg;
  };
  const extended = extendedOf(body["extended"]);
  if (extended) roll.extended = extended;
  const opposed = asMap(body["opposed"]);
  const mode = asText(opposed["mode"]);
  if (mode === "resisted" || mode === "contested") {
    roll.opposed = { mode };
    const oppPool = asText(opposed["pool"]);
    if (oppPool) roll.opposed.pool = oppPool;
    const vs = asNumber(opposed["vsDifficulty"]);
    if (vs !== undefined) roll.opposed.vsDifficulty = vs;
    const oppExtended = extendedOf(opposed["extended"]);
    if (oppExtended) roll.opposed.extended = oppExtended;
  }
  const steps: ProcedureStep[] = [];
  for (const raw of asList(body["steps"])) {
    const m = asMap(raw);
    const target = asText(m["roll"]);
    if (!target) continue;
    const when = asText(m["when"]) ?? "always";
    const step: ProcedureStep = {
      when: (["always", "on-success", "on-fail", "on-botch"] as string[]).includes(when) ? when as ProcedureCondition : "always",
      roll: target,
    };
    const note = asText(m["note"]);
    if (note) step.note = note;
    steps.push(step);
  }
  if (steps.length) roll.steps = steps;
  return roll;
}

export class NamedRollStore {
  private static _text(map: Record<string, SavedRoll>): string {
    const card: CardMap = {};
    for (const [name, roll] of Object.entries(map)) card[StringUtil.toTitleCase(name)] = savedRollToCard(roll);
    return [
      "Saved rolls for this chronicle: each roll's NAME, with its spec indented",
      "below it. Invoke one with [[roll @name]]; edit freely by hand.",
      "Each spec: pool, difficulty (or difficulty-expr), difficulty-mod, requires,",
      "dice-mod, tags, and optional sidecars applied on [[roll @name]]: spend",
      "(paid automatically), specialty (its die), table (reads the outcome).",
      "Anything left out keeps its default (difficulty 6, one success needed).",
      SRD_HEADER_MARKER,
      formatCardText(card),
    ].join("\n");
  }

  // The whole library ({} when the entry is missing or unreadable).
  static async all(): Promise<Record<string, SavedRoll>> {
    const text = await LorebookManager.entryText(NAMED_ROLLS_CATEGORY, NAMED_ROLLS_ENTRY);
    if (!text) return {};
    const parsed = parseCardText(LorebookManager.contentBelowHeader(text).trim());
    const out: Record<string, SavedRoll> = {};
    for (const { name, body } of asNamedList(parsed)) {
      const roll = savedRollFromCard(body);
      if (roll) out[StringUtil.normalize(name)] = roll;
    }
    return out;
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
    const raw = (await ExtendedContestStore._storage.get(ExtendedContestStore._key(id))) as ExtendedContest | undefined;
    // A contest saved when a contest could only have two sides kept `a`/`b`.
    // Read it as a field of two, so a race started last week still continues.
    return raw ? migrateContest(raw) : undefined;
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
    if (cur) { const c = await ExtendedContestStore.load(cur); if (c && c.status === CONTEST_OPEN) return c; }
    const open: ExtendedContest[] = [];
    for (const cid of await ExtendedContestStore.ids()) {
      const c = await ExtendedContestStore.load(cid);
      if (c && c.status === CONTEST_OPEN) open.push(c);
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
export const DEFAULT_STORY_START = "1197-01-01-00";   // a canonical Dark Ages year; override with [[story-start]]

export interface StoryClockState { start: number; now: number }

export class StoryClock {
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
export class DateBook {
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
export type SceneStatus = "open" | "closed";

export interface Scene {
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

export class SceneStore {
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
// GENERATION COUNTER - how many real AI generations have happened (§7.32)
// -----------------------------------------------------------------------------
// Incremented once per REAL generation (onContextBuilt with dryRun=false; a
// dry run is the player inspecting context, not generating). Story storage so
// it survives turns. Drives the age-out of context-skip noise blocks (Pass 2).
// =============================================================================
export class GenCounter {
  private static _storage = new ScopedStorage();
  private static readonly KEY = "gen:count";
  static async get(): Promise<number> { return GenCounter._storage.getOrDefault<number>(GenCounter.KEY, 0); }
  static async increment(): Promise<number> {
    const n = (await GenCounter.get()) + 1;
    await GenCounter._storage.set(GenCounter.KEY, n);
    return n;
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

  // Every player id this story has heard of: the Storyteller (always), whoever
  // is current or default, and anyone with aliases of their own. There is no
  // player ROSTER - a player exists by being named - so this gathers the places
  // a name can have been left, which is what `in=<player>` needs to check.
  static async known(): Promise<string[]> {
    const out = new Set<string>([PlayerStore.STORYTELLER]);
    out.add(await PlayerStore.current());
    out.add(await PlayerStore.getDefault());
    for (const id of Object.keys((await AliasRegistry.all()).players)) out.add(id);
    return [...out].filter(Boolean);
  }
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

// `@all` means EVERY one of them to the show-* verbs, and `@` is the alias
// sigil, so the two would collide: an alias called "all" would shadow the
// wildcard on every listing in the engine. Reserved here, in the one function
// that decides what an @token is, so [[alias @all …]] refuses at the door
// rather than defining something unreachable.
export const SHOW_ALL_TOKEN = "@all";

// "@..." token -> its parts, or undefined when malformed. Assumes the token is
// already normalized (the parser guarantees it).
export function parseAliasToken(token: string): AliasRef | undefined {
  if (!token.startsWith("@") || token.length < 2) return undefined;
  const parts = token.slice(1).split(":").map(p => p.trim()).filter(p => p.length > 0);
  const RESERVED = ["global", "player", "char", "character", "all"];
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
// Each is ONE lorebook entry (tutorial header above the marker, card text below),
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
    "Story overrides for resources (the house-rule layer). Below the marker,",
    "write a resource NAME and indent the fields you want to change (start, max,",
    "roles, effect, effects, ...). A name that matches no template resource and",
    "carries kind/start/max adds a custom resource. [[configure-resources]]",
    "edits this for you; you may also edit it by hand in creator mode.",
  ],
});

// The magic-rules knob layer: kebab-case knob name -> number, overlaid on
// DEFAULT_MAGIC_RULES by rules.ts' magicRulesFrom (see MAGIC_KNOB_NAMES).
export const MAGIC_CONFIG_ENTRY = "wod:config:magic";
export const MagicRulesConfig = new MapConfigStore<number>({
  entry: MAGIC_CONFIG_ENTRY,
  header: [
    "Spellcasting knob overrides (Dark Ages: Mage). Below the marker, one",
    "`knob: number` per line; unset knobs keep their defaults. Knobs:",
    "simple-base (4), complex-base (5), difficulty-cap (10; the book plays 9),",
    "min-difficulty (4), quintessence-per-turn (3), quintessence-free-limit (2),",
    "retry-penalty (1), botch-retry-penalty (2), ongoing-multiplier (10),",
    "ongoing-fuel-per-success (1), seal-per-pillar-dot (5), seal-willpower-per (10).",
  ],
});

// Chronicle-wide roll knobs. Only `min-difficulty` so far: the floor every
// roll's die target respects. Absent = no floor at all, except on rolls that
// name their own with `min-difficulty=`.
export const ROLLS_CONFIG_ENTRY = "wod:config:rolls";
export const RollRulesConfig = new MapConfigStore<number>({
  entry: ROLLS_CONFIG_ENTRY,
  header: [
    "Chronicle-wide roll knobs: one `knob: number` per line below the marker.",
    "  min-difficulty - no roll's die target drops below this, however deep the",
    "                   reductions run. Leave it out and rolls have NO floor",
    "                   except the ones that set their own (min-difficulty= on",
    "                   the roll, or saved with [[name-roll]]).",
    "Not to be confused with the min-difficulty in wod:config:magic, which is",
    "how far Quintessence may talk a SPELL's difficulty down.",
  ],
});

// Background definitions: the bag Backgrounds never had. Shipped defaults
// (Fount's ladder, the Awakened places, Mentor, Resources) overlaid by the
// entry, exactly like afflictions.
// --- TEMPLATES (the chronicle's own splats, and the ones it EXTENDS) --------
// The registry lives here because the CARD lives here; the fold lives in
// rules.ts (applyTemplateDefs), which nothing below state.ts needs to know
// about. `onChanged` is the seam: every load/save/reset rebuilds TEMPLATES.
export const TEMPLATES_ENTRY = "wod:config:templates";
export let lastTemplateProblems: string[] = [];
export const TemplateRegistry = new ListConfigStore<TemplateDef>({
  entry: TEMPLATES_ENTRY,
  header: [
    "Character templates for this chronicle, overlaid on the built-ins.",
    "Below the marker each one is its NAME, then indented:",
    "  extends     - the template it inherits from (mage, vampire, ...). Every",
    "                field you leave out comes from there.",
    "  description - the display name",
    "  soak        - mortal | vampire | ghoul | mage | demon | werewolf",
    "  morality    - humanity | torment | none",
    "  awakened    - true for a template that works Awakened magic",
    "  capabilities- what it can USE (awakened, vitae, resolve): a pool whose",
    "                `requires` names one of these is inert without it",
    "  resources   - ADDED to the parent's; each is a NAME with kind/start/max",
    "                indented under it (a `replaces` list hides the parent's)",
    "  disciplines - the Disciplines that are this creature's own; add `mode:",
    "                replace` for a creature no clan or family speaks for",
    "  budgets     - a purse per line (`arcana: role:willpower`), or a block",
    "                with allows / freebie / experience / note under it. A price",
    "                of \"-\" means that purse cannot be bought from at all",
    "  creation, derived - as the template's own",
    "A def that extends a template nobody defines is skipped and reported.",
  ],
  make: makeTemplateDef,
  defaults: DEFAULT_TEMPLATE_DEFS,
  // The overlay REPLACES the defaults for a name it repeats, and the built-ins
  // underneath are rebuilt from scratch every time - so removing a card entry
  // puts the shipped Ouroboros back.
  onChanged: (overlay) => {
    const byName = new Map(DEFAULT_TEMPLATE_DEFS.map(d => [StringUtil.normalize(d.name), d]));
    for (const d of overlay) byName.set(StringUtil.normalize(d.name), d);
    lastTemplateProblems = applyTemplateDefs([...byName.values()]);
  },
});

export const BACKGROUNDS_ENTRY = "wod:config:backgrounds";
export const BackgroundRegistry = new ListConfigStore<BackgroundDef>({
  entry: BACKGROUNDS_ENTRY,
  header: [
    "Background definitions for this chronicle (overlaid on the built-ins).",
    "Below the marker each one is its NAME, then indented: max (the ceiling,",
    "usually 5), templates (who may take it), description, and either",
    "  tiers   - a ladder, for Backgrounds that read as a table (Fount), each",
    "            rung `at-least` plus what it sets (max, per-turn)",
    "  grants  - other traits this one CONFERS, each `trait` + `rating`:",
    "            a Talisman that IS a place grants that place's ratings.",
    "Dots are not cost: what a Background actually cost lives on the sheet",
    "([[paid]]), so a Background you were GIVEN rates 5 and costs nothing.",
  ],
  make: makeBackgroundDef,
  defaults: DEFAULT_BACKGROUNDS,
});

// Advancement prices: the CHRONICLE's cost table, never the character's. One
// card, `kind:` with a price per purse indented under it (see
// DEFAULT_ADVANCEMENT_COSTS). Values are text - nothing evaluates them yet.
export const COSTS_CONFIG_ENTRY = "wod:config:costs";
export const AdvancementCosts = new MapConfigStore<Record<string, string>>({
  entry: COSTS_CONFIG_ENTRY,
  header: [
    "What a dot COSTS, from each purse - chronicle rules, so they live here and",
    "not on any sheet. Below the marker, write the trait kind, then indent the",
    "price for `experience` (play), `freebie` (creation) and `maturation`",
    "(downtime); \"current\" means the rating you are raising FROM. Only the",
    "prices you write are overridden - the rest keep the shipped values, which",
    "[[costs]] lists. Nothing evaluates these yet: they are recorded and shown,",
    "and the Storyteller applies them.",
    "  attribute:",
    "    experience: current x 4",
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
    await writeTrackedEntry(category, GENERAL_ENTRY, configEntryText(TABLE_GENERAL_HEADER, namedDefsToCard(list as SuccessTable[])));
    await this.loadFromLorebook();
    const key = sub ? `${sub}:${def.name}` : def.name;
    const now = SuccessTableRegistry.get(key);
    // Compare the DATA, not the key order: a round trip through the card
    // reorders fields, and JSON.stringify would call that a shadowing card.
    return { shadowed: canonicalCardText(now as unknown as CardValue) !== canonicalCardText({ ...def, name: key } as unknown as CardValue) };
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
      await writeTrackedEntry(category, GENERAL_ENTRY, configEntryText(TABLE_GENERAL_HEADER, namedDefsToCard(rest as SuccessTable[])));
    }
    await this.loadFromLorebook();
    const now = SuccessTableRegistry.get(n);
    const still = now === undefined ? undefined
      : DEFAULT_SUCCESS_TABLES.some(d => StringUtil.normalize(d.name) === n) && canonicalCardText(now as unknown as CardValue) === canonicalCardText({ ...DEFAULT_SUCCESS_TABLES.find(d => StringUtil.normalize(d.name) === n), name: n } as unknown as CardValue)
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
    "Merits/Flaws. Below the marker each group is its NAME, then indented:",
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
    "Below the marker each definition is its NAME, then indented: optional",
    "bindings (required slots like \"target\"), duration, then",
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
// `expiry` is what makes an affliction a thing IN TIME rather than a flag
// somebody has to remember to clear: charges counted in matching rolls, a story
// date, or both with whichever runs out first ending it (rules.ts).
export interface ActiveAffliction {
  def: string;
  bindings: Record<string, string>;
  note?: string;
  expiry?: AfflictionExpiry;
  // What to ARM when this ends - the cooldown before it may be applied again.
  cooldown?: AfflictionExpiry;
  // What happens if `from` (the arcanum, the spell) is no longer there. Absent
  // means the owner's third case: the duration continues as normal.
  orphan?: OrphanPolicy;
  // WHERE it came from - an arcanum, a spell, a Discipline, a botched roll.
  // Afflictions are the one currency all of those pay in, so the source is the
  // only thing that tells them apart afterwards. Free-form on purpose.
  from?: string;
  // The story epoch it began, which is what an "until X" condition measures
  // against (`full-moons`, `elapsed-days` are counted from here).
  at?: number;
}

// A COOLDOWN is an expiry pointed the other way: not "when does this end" but
// "when may it be applied again". Same six measures, same four ticks, same
// arithmetic - which is the whole reason it is worth having the expiry model
// first. An entry exists only while the thing is NOT ready; when its expiry
// elapses the entry is deleted, and absence means ready.
export interface ArmedCooldown { expiry: AfflictionExpiry; at: number }

export class CharacterCooldowns {
  private static _storage = new ScopedStorage();
  private static _key(name: string): string { return `cool:${StringUtil.normalize(name)}`; }

  static async all(name: string): Promise<Record<string, ArmedCooldown>> {
    return ((await CharacterCooldowns._storage.get(CharacterCooldowns._key(name))) as Record<string, ArmedCooldown> | undefined) ?? {};
  }
  static async arm(name: string, def: string, cooldown: ArmedCooldown): Promise<void> {
    const map = await CharacterCooldowns.all(name);
    map[StringUtil.normalize(def)] = cooldown;
    await CharacterCooldowns._storage.set(CharacterCooldowns._key(name), map);
  }
  static async clear(name: string, def: string): Promise<boolean> {
    const map = await CharacterCooldowns.all(name);
    const key = StringUtil.normalize(def);
    if (!(key in map)) return false;
    delete map[key];
    await CharacterCooldowns._storage.set(CharacterCooldowns._key(name), map);
    return true;
  }
  static async replace(name: string, map: Record<string, ArmedCooldown>): Promise<void> {
    await CharacterCooldowns._storage.set(CharacterCooldowns._key(name), map);
  }
}

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
  // Replace the whole list (the tick writes once rather than per affliction).
  static async replace(name: string, list: ActiveAffliction[]): Promise<void> {
    await CharacterAfflictions._storage.set(CharacterAfflictions._key(name), list);
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
// `blocked` is what the character lacks to USE this pool - empty for almost
// everyone, and the whole story for a man carrying a talisman he cannot work.
export interface ResourceView { def: ResourceDef; current: number; max: number; blocked: string[] }

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

  // What this character can USE: every template's capabilities, plus whatever
  // the sheet is attuned to. Holding a pool is a separate question entirely -
  // see cannotUse.
  static capabilities(char: PlayableCharacter): string[] {
    const out = new Set((char.capabilities ?? []).map(c => StringUtil.normalize(c)));
    for (const t of char.templates) {
      for (const c of TEMPLATES[StringUtil.normalize(t)]?.Capabilities ?? []) out.add(StringUtil.normalize(c));
    }
    return [...out];
  }

  // What this character LACKS for that pool - empty means he can spend it. A
  // mage handed ten points of vitae holds every one and can do nothing with
  // them; this is the list that says why, and it is a list rather than a
  // boolean because "you cannot" is worth nothing without "you never Awakened".
  static cannotUse(char: PlayableCharacter, def: ResourceDef): string[] {
    if (!def.requires?.length) return [];
    const have = CharacterResources.capabilities(char);
    return def.requires.map(r => StringUtil.normalize(r)).filter(r => !have.includes(r));
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
    const n = resourceNumbers(char, def);
    return Math.max(0, Math.min(chosen ?? n.start, n.max));
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
      return {
        def, current: k in values ? values[k] : CharacterResources._startOf(char, def),
        max: resourceNumbers(char, def).max, blocked: CharacterResources.cannotUse(char, def),
      };
    });
  }

  // Spend up to `amount` (never below 0); returns how much actually left the
  // pool. A pool this character cannot USE spends nothing and says what is
  // missing - the points are there, the ability to burn them is not.
  static async spend(char: PlayableCharacter, nameOrRole: string, amount = 1): Promise<{ spent: number; def?: ResourceDef; blocked?: string[] }> {
    const def = CharacterResources.resolveDef(char, nameOrRole);
    if (!def) return { spent: 0 };
    const blocked = CharacterResources.cannotUse(char, def);
    if (blocked.length) return { spent: 0, def, blocked };
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
    const value = Math.max(0, Math.min(have + amount, resourceNumbers(char, def).max));
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
// THE CRAY - a real, drainable site of Quintessence (the Cray Background)
// -----------------------------------------------------------------------------
// A cray holds rating x 5 points and refills 1/day, but ONLY on days it went
// untapped. Overdrawing past empty (by up to its rating) costs the site a dot
// and risks dormancy (1/year) or death. The RATING lives on the character's
// sheet (backgrounds.cray - it is a Background); the live points/status live
// here, keyed by owner, since the Background assumes exclusive access.
// =============================================================================
export type CrayStatus = "active" | "dormant" | "dead";
export interface CrayState { points: number; status: CrayStatus; lastTapDay: number }
const DORMANT_DAYS_PER_POINT = 365;

export class CrayStore {
  private static _storage = new ScopedStorage();
  private static _key(name: string): string { return `cray:${StringUtil.normalize(name)}`; }

  // A cray CONFERRED by a Talisman is as real a site as a bought one.
  static rating(char: PlayableCharacter): number { return effectiveTraitOf(char, "cray"); }
  static capacity(char: PlayableCharacter): number { return CrayStore.rating(char) * 5; }

  // A cray starts full (it has been bubbling away untended).
  static async get(char: PlayableCharacter): Promise<CrayState> {
    const raw = (await CrayStore._storage.get(CrayStore._key(char.name))) as CrayState | undefined;
    return raw ?? { points: CrayStore.capacity(char), status: "active", lastTapDay: -1 };
  }
  static async set(char: PlayableCharacter, state: CrayState): Promise<void> {
    await CrayStore._storage.set(CrayStore._key(char.name), state);
  }

  // Draw `n` points, marking the day so it doesn't also regenerate today.
  // Returns what actually came out (never more than it holds - the caller
  // handles the overdraw rules).
  static async tap(char: PlayableCharacter, n: number, day: number): Promise<number> {
    const state = await CrayStore.get(char);
    const drawn = Math.max(0, Math.min(n, state.points));
    await CrayStore.set(char, { ...state, points: state.points - drawn, lastTapDay: day });
    return drawn;
  }

  // Refill for the day boundaries in (fromDay, toDay]: 1/day while active (a
  // dormant cray manages one point a YEAR; a dead one never recovers), skipping
  // any day it was tapped. Returns the points actually added.
  static async replenish(char: PlayableCharacter, fromDay: number, toDay: number): Promise<number> {
    const state = await CrayStore.get(char);
    if (state.status === "dead") return 0;
    const days = Math.max(0, toDay - fromDay);
    if (days <= 0) return 0;
    // Each boundary credits the day that just ENDED, so the window covers days
    // [fromDay, toDay-1] - and the day it was tapped earns nothing.
    const tapped = state.lastTapDay >= fromDay && state.lastTapDay <= toDay - 1 ? 1 : 0;
    const earned = state.status === "dormant"
      ? Math.floor(days / DORMANT_DAYS_PER_POINT)
      : Math.max(0, days - tapped);
    const cap = CrayStore.capacity(char);
    const gained = Math.max(0, Math.min(earned, cap - state.points));
    if (gained > 0) await CrayStore.set(char, { ...state, points: state.points + gained });
    return gained;
  }
}

// =============================================================================
// CAST ATTEMPTS - the same-scene spell-retry ledger (Dark Ages: Mage)
// -----------------------------------------------------------------------------
// Retrying a failed spell in the same scene costs +1 difficulty per prior
// unsuccessful attempt - or +2 per prior attempt once any of them BOTCHED. The
// ledger (cast:<char>) keys spells by label (else the pillar signature) and is
// scoped to ONE scene: reads from a different scene than the one stored see an
// empty ledger (lazy reset - no scene-change hook needed). A successful casting
// clears its spell's entry.
// =============================================================================
export interface CastRecord { unsuccessful: number; botched: boolean; }
interface CastLedger { scene: string; spells: Record<string, CastRecord>; }

export class CastAttempts {
  private static _storage = new ScopedStorage();
  private static _key(name: string): string { return `cast:${StringUtil.normalize(name)}`; }

  private static async _ledger(char: PlayableCharacter, scene: string): Promise<CastLedger> {
    const raw = (await CastAttempts._storage.get(CastAttempts._key(char.name))) as CastLedger | undefined;
    return raw && raw.scene === scene ? raw : { scene, spells: {} };
  }

  static async get(char: PlayableCharacter, scene: string, spell: string): Promise<CastRecord> {
    const ledger = await CastAttempts._ledger(char, scene);
    return ledger.spells[StringUtil.normalize(spell)] ?? { unsuccessful: 0, botched: false };
  }
  // Record one attempt's outcome. Success clears the spell's entry; a failure
  // increments it (marking `botched` when it was one).
  static async record(char: PlayableCharacter, scene: string, spell: string, outcome: "success" | "failure" | "botch"): Promise<void> {
    const ledger = await CastAttempts._ledger(char, scene);
    const key = StringUtil.normalize(spell);
    if (outcome === "success") delete ledger.spells[key];
    else {
      const rec = ledger.spells[key] ?? { unsuccessful: 0, botched: false };
      rec.unsuccessful += 1;
      if (outcome === "botch") rec.botched = true;
      ledger.spells[key] = rec;
    }
    await CastAttempts._storage.set(CastAttempts._key(char.name), ledger);
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

