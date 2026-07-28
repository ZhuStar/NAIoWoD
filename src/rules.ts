// =============================================================================
// RULES - the Dark Ages data: rulesets, soak tables, templates, disciplines,
// merits & flaws defaults, and the SRD lorebook seed. Data over logic.
// =============================================================================
import { StringUtil, MoralityPolarity } from "./core/traits";
import {
  CardValue, CardMap, asMap, asList, asText, asNumber, asBool, asStringList,
} from "./core/cardtext";
import { Numeric } from "./core/expr";
import {
  SoakSpec, DamageReaction, UndeadPhysiology, SilverVulnerability,
  HealthLevelDef, STANDARD_HEALTH_LEVELS,
} from "./core/damage";

// The nine oWoD Attributes, by group. Fixed across every template, so they live
// in code (unlike the chronicle-variable ability/background lists in the
// lorebook). A fresh potential character seeds all nine at 1 (the free dot).
export const ATTRIBUTES = {
  physical: ["Strength", "Dexterity", "Stamina"],
  social: ["Charisma", "Manipulation", "Appearance"],
  mental: ["Perception", "Intelligence", "Wits"],
} as const;
export const ALL_ATTRIBUTES: readonly string[] = [
  ...ATTRIBUTES.physical, ...ATTRIBUTES.social, ...ATTRIBUTES.mental,
];

// --- CONFIGURATION ---
export class RulesetConfig {
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
export const MORTAL_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: false, pool: [] },
  aggravated: { soakable: false, pool: [] },
  difficulty: 6,
};
// Vampires soak bashing & lethal with Stamina (+Fortitude); aggravated needs
// Fortitude alone (no Fortitude trait -> empty pool -> nothing soaked).
export const VAMPIRE_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina", "fortitude"] },
  lethal: { soakable: true, pool: ["stamina", "fortitude"] },
  aggravated: { soakable: true, pool: ["fortitude"] },
  difficulty: 6,
};
// Ghouls and revenants, though alive, soak like the half-vampires they are -
// the vitae in their veins does the knitting. A COPY, not an alias: a chronicle
// that changes what a vampire soaks must not silently change ghouls too.
export const GHOUL_SOAK: SoakSpec = { ...VAMPIRE_SOAK };
// Mages innately soak like mortals (their real defence is magic, not modelled).
export const MAGE_SOAK: SoakSpec = { ...MORTAL_SOAK };
// Demons (manifested) soak all three with Stamina.
export const DEMON_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: true, pool: ["stamina"] },
  aggravated: { soakable: true, pool: ["stamina"] },
  difficulty: 6,
};
// Werewolves regenerate: like a demon they soak every severity with Stamina,
// and shrug off most punishment outright. Silver and fire are the exception -
// the SilverVulnerability reaction marks those packets Unsoakable, so this
// generous spec never even gets consulted for them.
export const WEREWOLF_SOAK: SoakSpec = { ...DEMON_SOAK };

export interface BloodStats { max: number; perTurn: number; }
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
export function bloodForGeneration(generation: number): BloodStats {
  const g = Math.max(3, Math.min(15, Math.round(generation)));
  return { ...BLOOD_BY_GENERATION[g] };
}

// =============================================================================
// MORALITY - Roads / Humanity (optional; Mages have none)
// =============================================================================
export interface RoadDefinition {
  name: string;                       // e.g. "Road of Humanity"
  virtues: [string, string, string];  // the three Virtues this Road uses
  ratingVirtues: [string, string];    // which two sum to the starting rating
}

export const ROAD_OF_HUMANITY: RoadDefinition = {
  name: "Road of Humanity",
  virtues: ["conscience", "self-control", "courage"],
  ratingVirtues: ["conscience", "self-control"],
};
export const ROAD_OF_KINGS: RoadDefinition = {
  name: "Road of Kings",
  virtues: ["conviction", "self-control", "courage"],
  ratingVirtues: ["conviction", "self-control"],
};
export const ROAD_OF_THE_BEAST: RoadDefinition = {
  name: "Road of the Beast",
  virtues: ["conviction", "instinct", "courage"],
  ratingVirtues: ["conviction", "instinct"],
};

// The Roads a character may WALK, by the name `[[choose road …]]` records.
// Without this the two beside Humanity were data nothing could ever reach.
export const ROADS: Record<string, RoadDefinition> = {
  "road-of-humanity": ROAD_OF_HUMANITY,
  "road-of-kings": ROAD_OF_KINGS,
  "road-of-the-beast": ROAD_OF_THE_BEAST,
};
export function roadByName(name: string): RoadDefinition | undefined {
  const key = StringUtil.normalize(name);
  for (const [id, road] of Object.entries(ROADS)) {
    if (id === key || StringUtil.normalize(road.name) === key || `road-of-${key}` === id) return road;
  }
  return undefined;
}

// How a template's morality is configured: which trait it is, its polarity,
// and how its starting value is derived.
export interface MoralityConfig {
  name: string;
  polarity: MoralityPolarity;
  road?: RoadDefinition;        // virtue-based moralities (Roads / Humanity)
  deriveFromVirtues?: boolean;  // start = sum of the Road's two rating Virtues
  start?: number;               // default start when not derived from Virtues
}

export const HUMANITY_MORALITY: MoralityConfig = {
  name: "Road of Humanity",
  polarity: "descending",
  road: ROAD_OF_HUMANITY,
  deriveFromVirtues: true,
};

// =============================================================================
// TEMPLATES - per-splat configuration including starting values
// =============================================================================
// THE CREATION BUDGET - what a fresh character is allowed to be
// -----------------------------------------------------------------------------
// Every Dark Ages template buys the same three priority ladders (Attributes
// 7/5/3 over a free dot each, Abilities 13/9/5 from nothing, five Background
// dots) and then its own splat pools on top: a vampire's four clan Discipline
// dots and seven Virtue dots, a mage's starting Quintessence. Freebies are the
// last purse, priced by the table in DEFAULT_ADVANCEMENT_COSTS.
//
// Nothing here ENFORCES: [[creation]] reports each pool against what the sheet
// actually holds, and the Storyteller decides. The point is that the numbers
// live in ONE place instead of in a book on someone's desk.
// =============================================================================
// Every one of these numbers may instead be an EXPRESSION over the character
// (core/expr.ts): a 7th-generation vampire's Attribute ceiling is
// `trait-max(generation)`, not 5. See §"DERIVED VALUES" below.
export interface PriorityPools { primary: Numeric; secondary: Numeric; tertiary: Numeric }
// A trait whose start or ceiling differs from everyone else's - a Nosferatu has
// no Appearance at all, and never will.
export interface TraitLimit { start?: Numeric; max?: Numeric; note?: string }

export interface CreationBudget {
  attributes: PriorityPools;          // over one free dot in each
  attributeStart: Numeric;            // the free dot (1)
  attributeMax: Numeric;              // the usual ceiling (5)
  abilities: PriorityPools;
  abilityStart: Numeric;              // nothing free (0)
  abilityMax: Numeric;
  backgrounds: Numeric;
  freebies: Numeric;
  disciplines?: Numeric;              // vampires: four dots of CLAN Disciplines
  disciplineMax?: Numeric;            // and their ceiling, which generation raises
  virtues?: Numeric;                  // vampires: seven, over a free dot each
  virtueStart?: Numeric;              // the free dot in each Virtue (1)
  // Per-trait exceptions, by trait name.
  limits?: Record<string, TraitLimit>;
  notes?: string[];                   // the derived values a splat records
}

// What every Dark Ages character gets, whatever they are.
export const BASE_CREATION: CreationBudget = {
  attributes: { primary: 7, secondary: 5, tertiary: 3 }, attributeStart: 1, attributeMax: 5,
  abilities: { primary: 13, secondary: 9, tertiary: 5 }, abilityStart: 0, abilityMax: 5,
  backgrounds: 5,
  freebies: 15,
};

export function creationBudget(over: Partial<CreationBudget> = {}): CreationBudget {
  return { ...BASE_CREATION, ...over };
}

// =============================================================================
// DERIVED VALUES - the parts of a sheet that are consequences of other parts
// -----------------------------------------------------------------------------
// A vampire's Road is the sum of its two Road Virtues; its Willpower equals its
// Courage; its generation is 12 minus the Generation Background, and THAT sets
// how high its Attributes, Abilities and Disciplines may go. None of this is a
// number the player types - it is a number the sheet already implies - so it
// lives here as an EXPRESSION and is computed on demand, never written down.
//
// `when` is the whole distinction:
//   "start"  - a seed. The derivation answers while the sheet's own entry is
//              absent or 0; the moment the player rates it, the sheet wins.
//              (Willpower starts AT Courage, then freebies buy it up.)
//   "always" - an identity. It recomputes whatever the sheet says, because it
//              is not a rating at all. (Generation IS 12 minus the Background.)
// =============================================================================
export interface Derivation {
  trait: string;                      // the name it answers to
  expr: string;                       // over the character (core/expr.ts)
  when?: "start" | "always";          // default "start"
  note?: string;                      // why, for the reports
}

// A vampire's trait ceiling by generation: the potent blood of an elder can
// hold more than five dots. 8th and thinner are the ordinary five.
const TRAIT_MAX_BY_GENERATION: Record<number, number> = {
  3: 10, 4: 9, 5: 8, 6: 7, 7: 6,
};
export function traitMaxForGeneration(generation: number): number {
  return TRAIT_MAX_BY_GENERATION[Math.round(generation)] ?? 5;
}

// The Virtues a Road's rating sums, spelled the way an expression would -
// "conscience + self-control" for the Road of Humanity. What `road-virtues()`
// computes, and what a report prints to say WHICH two.
export function roadRatingExpr(road: RoadDefinition): string {
  return road.ratingVirtues.map(v => StringUtil.normalize(v)).join(" + ");
}

// =============================================================================
export type PoolKind = "tracker" | "pool";
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
// Ops with interpreters today: "difficulty" | "dice" | "successes" | "nagain" |
// "uncancelable" (roll modifiers; an optional `target` names an action tag the
// roll must carry; "uncancelable" grants successes rolled 1s can never cancel),
// "increase" (raise a trait via the boost layer; `target` is a constraint - an
// attribute group, a record bucket, or a specific trait), "heal" (`target` =
// comma-separated severities or "all").
export interface EffectOp {
  op: string;
  target?: string;
  amount?: number;          // magnitude per effect unit (default 1)
  fillToCap?: boolean;      // one application raises/heals to the cap
  cap?: number | string;    // literal, or a pool expression ("stamina+3") on the character
  // Gate: the op applies only when the roll's POOL actually used this trait
  // (the twin of the actionTag gate roll ops carry in `target`). A trait that
  // appears only in the difficulty expression does NOT count.
  trait?: string;
  // The op fires ONCE per spend, however many points ride it - "spending Living
  // Resolve for anything grants ONE un-cancelable success" without a 3-point
  // spend granting three.
  once?: boolean;
  // Gate: the op applies only while the character still HOLDS this much of a
  // resource (by name or role) - "while he has at least one Living Resolve, he
  // is immune to fear". Checked live, so it lapses the moment the pool empties.
  requiresResource?: { resource: string; atLeast: number };
}
export interface EffectCost {
  units?: number;           // resource units per application (default 1)
  buys?: number;            // effect units per application (default 1)
  // A roll that reduces the units paid (possibly to zero) - e.g. Iron Will.
  reducedBy?: { pool: string; difficulty?: number; perSuccess?: number };
}
export interface EffectDuration {
  kind: "instant" | "real" | "st" | "until";
  n?: number;               // count of `unit` ("real": minutes/hours; "st": turns/scenes)
  unit?: string;
  until?: string;           // kind "until": free-form affliction
}
export interface EffectLimits {
  maxPerUse?: number;                  // applications per command (enforced)
  uses?: { n: number; per: string };   // tracked in the ledger; ST-enforced for now
  cooldown?: { n: number; unit: string }; // stored; ST-enforced for now
}
export interface EffectSpec {
  label: string;
  apply: EffectOp[];        // [] = a pure cost (static spell fuel)
  cost?: EffectCost;
  duration?: EffectDuration;
  limits?: EffectLimits;
  targetMustBe?: string[];  // for effects on others; stored until targeting lands
}

// A scheduled way a resource refills itself as story time passes. [[advance-time]]
// counts the day boundaries and full moons it crossed and credits every rule
// whose gate (if any) is open. `requires` names active afflictions (def name
// or tag) that must be on the character - a single string, or an ARRAY that
// must ALL be active at once (full-rested AND in-sanctum, simultaneously).
export interface RecoveryRule {
  amount: number;
  per: "day" | "full-moon";
  requires?: string | string[];
  // A Background/trait threshold the character must ALSO meet - the sanctum's
  // sleep point is Sanctum 4's benefit, not every sanctum's.
  requiresTrait?: { trait: string; atLeast: number };
  note?: string;            // shown beside the credit ("Umbral communion")
}

// A resource is a tracker/pool PLUS abstract `roles` it can fill and an optional
// spend `effect`. Roles are how templates compose/share resources: Quintessence
// carrying the "resolve" role IS "use Quintessence as Resolve" - pure data.
export interface ResourceDef {
  name: string;
  kind: PoolKind;
  // start / max / perTurnLimit are NUMERIC: a number, or an expression over the
  // character (core/expr.ts). A mage's Quintessence capacity is not 20 - it is
  // "10 + 2 * background:fount", the Fount ladder said once. A fused pool is
  // "resource:quintessence:max + resource:blood:max", which is what Living
  // Resolve actually IS.
  start: Numeric;           // default starting value
  startMin?: number;        // inclusive lower bound for a chosen start
  startMax?: number;        // inclusive upper bound for a chosen start
  startOptions?: number[];  // discrete allowed starts (overrides min/max if set)
  max: Numeric;             // permanent cap (tracker) / capacity (pool)
  perTurnLimit?: Numeric;   // pools only (e.g. blood expenditure per turn)
  fromGeneration?: boolean; // blood pool: max & perTurn derived from Generation
  roles?: string[];         // abstract capabilities this resource fills
  // "Specifically replace any other resource": this resource takes over the
  // named ones - they are hidden from the character and their names resolve
  // here. Resource-level identity, not a spend effect.
  replaces?: string[];
  effect?: EffectSpec;      // the default (unnamed) spend effect
  effects?: Record<string, EffectSpec>; // named context effects (cast, heal, fuel, …)
  description?: string;     // free-text rules note, shown by [[resources]]
  recovery?: RecoveryRule[]; // clock-driven refills (see RecoveryRule)
  // When a roll's POOL names this resource (or one it replaces), the trait
  // resolves to min(cap, current) - a Willpower roll rolls CURRENT Willpower -
  // and each point above `negatesPenaltiesAbove` shields 1 die of pool
  // reductions (wound penalties, negative dice mods) on that roll.
  rollAs?: { cap?: number; negatesPenaltiesAbove?: number };
}
// A resource's spend effect: a named context effect if `name` is given, else the
// default. Named effects let one resource behave differently by situation (a
// Mage's Resolve "cast" bundle vs. its plain difficulty drop).
export function resourceEffect(def: ResourceDef, name?: string): EffectSpec | undefined {
  return name ? def.effects?.[StringUtil.normalize(name)] : def.effect;
}

// Compact one-liner for [[resources]] listings and spend notes: the label plus
// any non-default cost/duration/limit dimensions.
export function describeEffect(spec: EffectSpec): string {
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
export function willpowerResource(start: number): ResourceDef {
  return {
    name: "willpower", kind: "tracker", start, startMin: 1, startMax: 10, max: 10,
    roles: ["willpower"],
    // Spent Willpower buys CERTAINTY: successes rolled 1s can never cancel, one
    // per point - but a mind can only hold so much of it at once, so the total
    // is capped by Foundation (uncancelableCap; 1 for the unawakened).
    effect: { label: "Willpower: +1 un-cancelable success (one per action; a SPELL may stack them up to the Foundation)", apply: [{ op: "uncancelable", amount: 1 }] },
    // Willpower is also static spell fuel (Sorcerers, some Thaumaturgy): a
    // mandatory pure cost with no dice bonus - `spend=willpower:fuel!`.
    effects: { fuel: { label: "Willpower spent as static spell fuel", apply: [], cost: { units: 1 } } },
  };
}
export function resolveResource(over: Partial<ResourceDef> = {}): ResourceDef {
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
export function bloodResource(over: Partial<ResourceDef> = {}): ResourceDef {
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

export class TemplateConfig {
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
    public readonly Reactions: DamageReaction[] = [],
    // Has the character Awakened? Mages have; so does the Ouroboros. Sanctum,
    // Library and Cray benefits are all predicated on it (the sleeping world
    // gets nothing from a place of power).
    public readonly Awakened: boolean = false,
    // What this template may SPEND, per purse, as EXPRESSIONS - "15" is fifteen,
    // and the expression form is what lets a later chronicle write one budget in
    // terms of another. A sheet may override any of them (PlayableCharacter
    // .budgets). A purse with no budget anywhere is the Storyteller's call, and
    // [[budget]] says so rather than inventing a number.
    public readonly Budgets: Record<string, string> = {},
    // What a fresh character of this template may be (see CreationBudget).
    // Reported by [[creation]], enforced by nobody yet.
    public readonly Creation: CreationBudget = BASE_CREATION,
    // The values this splat's sheet IMPLIES rather than states (see Derivation).
    public readonly Derived: Derivation[] = []
  ) {}

  // Resources is the modern name for Pools (trackers + pools with roles/effects).
  get Resources(): ResourceDef[] { return this.Pools; }

  GetPool(name: string): ResourceDef | undefined {
    const n = StringUtil.normalize(name);
    return this.Pools.find(p => StringUtil.normalize(p.name) === n);
  }
}

export const TEMPLATE_MORTAL = new TemplateConfig(
  "Mortal",
  new RulesetConfig(5, 2, 4, 2, false),
  [willpowerResource(3)],
  MORTAL_SOAK,
  HUMANITY_MORALITY, true
);

export const TEMPLATE_THRALL = new TemplateConfig(
  "Thrall",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    willpowerResource(3),
    // A thrall's bond grants only a flicker of Resolve: it must start at 1.
    resolveResource({ start: 1, startMin: 1, startMax: 1 }),
  ],
  MORTAL_SOAK,
  HUMANITY_MORALITY, true,
  STANDARD_HEALTH_LEVELS, [], false,
  { arcana: "10" }   // placeholder, like the demon's
);

export const TEMPLATE_VAMPIRE = new TemplateConfig(
  "Vampire (Dark Ages)",
  RulesetConfig.VAMPIRE,
  [
    willpowerResource(5),
    bloodResource({ fromGeneration: true }),
  ],
  VAMPIRE_SOAK,
  HUMANITY_MORALITY, true,
  STANDARD_HEALTH_LEVELS,
  [new UndeadPhysiology()],   // bullets & blades to bashing; fire/sunlight stay aggravated
  false, {},
  creationBudget({
    disciplines: 4,   // among CLAN Disciplines
    virtues: 7,       // over a free dot in each Road Virtue and in Courage
    virtueStart: 1,
    // The potent blood of an elder holds more than five dots, so these three
    // ceilings are not numbers - they are a consequence of generation, which is
    // itself a consequence of the Generation Background.
    attributeMax: "trait-max(generation)",
    abilityMax: "trait-max(generation)",
    disciplineMax: "trait-max(generation)",
    notes: [
      "Four Discipline dots, among the CLAN's three ([[clan]] names them).",
      "Seven Virtue dots, over one free dot in each Road Virtue and in Courage.",
      "Starting blood = one die + one per dot of Domain and Herd.",
    ],
  }),
  [
    // 12th by default; each dot of the Generation Background buys one step
    // closer to Caine, and every ceiling above follows.
    { trait: "generation", expr: "12 - background:generation", when: "always",
      note: "12th generation, one step lower per dot of the Generation Background" },
    { trait: "road", expr: "road-virtues()",
      note: "the sum of the Road's two rating Virtues" },
    { trait: "willpower", expr: "courage",
      note: "Willpower starts at Courage" },
    // Named for the CEILING, not the pool: `blood` is a live resource with a
    // current value, and a derived trait must never shadow one.
    { trait: "blood-pool-max", expr: "blood-max(generation)", when: "always",
      note: "the blood pool generation allows" },
  ]
);

// Dark Ages: Mage works magic through Foundation & Pillars (its answer to the
// Spheres), which live with the not-yet-modelled powers, not as a pool. The
// only pool is Quintessence; this line has no Paradox.
export const TEMPLATE_MAGE = new TemplateConfig(
  "Mage (Dark Ages)",
  RulesetConfig.MAGE,
  [
    willpowerResource(5),
    // The Fount Background IS the capacity: no Fount holds 10 and spends 2 a
    // turn; each dot adds two to the store and (from the second) one per turn.
    { name: "quintessence", kind: "pool", start: 0,
      max: "10 + 2 * background:fount", perTurnLimit: "max(2, background:fount + 1)",
      roles: ["magic-fuel"],
      effect: {
        label: "Quintessence: -1 casting difficulty per point (min diff 4; >2/turn needs the Fount Background)",
        apply: [{ op: "difficulty", amount: -1 }],
        limits: { maxPerUse: 3 },
      },
      // Quintessence doesn't brew itself, but communion refills it: an extra
      // point per day in the Umbra, and one for a full night's sleep taken in
      // the mage's own sanctum (both afflictions at once).
      recovery: [
        { amount: 1, per: "day", requires: "in-umbra", note: "Umbral communion" },
        { amount: 1, per: "day", requires: ["full-rested", "in-sanctum"], requiresTrait: { trait: "sanctum", atLeast: 4 }, note: "rested in the sanctum" },
      ] },
  ],
  MAGE_SOAK,
  null, false,   // Mages have no Road/Humanity and no Virtues
  STANDARD_HEALTH_LEVELS, [], true,   // Awakened
  {},
  creationBudget({
    notes: [
      "Starting Willpower 5; note the Aura modifier, if any.",
      "Starting Quintessence = Cray + Fount Backgrounds, or 5, whichever is higher.",
      "The Fellowship sets the Foundation and the four Pillars ([[fellowships]]).",
    ],
  })
);

// Dark Ages: Devil's Due.
export const TEMPLATE_DEMON = new TemplateConfig(
  "Demon (Dark Ages: Devil's Due)",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    willpowerResource(5),
    // Resolve (the demon's spiritual power, 1-10): a fledgling starts in the 3-5 band.
    resolveResource({ start: 3, startMin: 3, startMax: 5 }),
  ],
  DEMON_SOAK,
  // Torment is an ASCENDING morality: sins push it up toward an unplayable 10.
  { name: "Torment", polarity: "ascending", start: 3 }, false,
  STANDARD_HEALTH_LEVELS, [], false,
  // A PLACEHOLDER arcana budget: the owner's number goes here (or on the sheet,
  // which overrides). Arcana never touch the freebie purse.
  { arcana: "25" }
);

// A modern-WoD illustration (not Dark Ages canon) kept here so the kind/severity
// system has a regenerator to show off: everything is soaked with Stamina, but
// the SilverVulnerability reaction makes silver and fire aggravated *and*
// unsoakable - the "good luck" case.
export const TEMPLATE_WEREWOLF = new TemplateConfig(
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
// (still alive: Road/Humanity, Virtues) with ghoul soak (bashing & lethal on
// Stamina+Fortitude) plus a Blood pool they do NOT generate - it must be fed by
// their domitor, starting near-empty and holding up to 10, spendable one point
// per turn.
//
// At creation a ghoul also gets 2 dots of Disciplines, one of which must be
// Potence: seed them via `disciplines: { potence: 1, ... }`. Potence and
// Fortitude have real mechanics now; 🚧 the template still can't *enforce* the
// 2-dots-incl-Potence rule until character creation is modelled.
export const TEMPLATE_GHOUL = new TemplateConfig(
  "Ghoul",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    willpowerResource(3),
    bloodResource({ start: 0 }),
  ],
  GHOUL_SOAK,
  HUMANITY_MORALITY, true   // still human: Road/Humanity + Virtues
);

// A revenant is BORN ghouled: one of the strange bloodlines whose bodies brew
// their own vitae. Ghoul soak and disciplines, but the pool refills itself -
// one point a day, on the story clock.
export const TEMPLATE_REVENANT = new TemplateConfig(
  "Revenant",
  new RulesetConfig(5, 2, 4, 2, false),
  [
    willpowerResource(3),
    bloodResource({ start: 10, recovery: [{ amount: 1, per: "day", note: "revenant vitae" }] }),
  ],
  GHOUL_SOAK,
  HUMANITY_MORALITY, true   // still (technically) human: Road/Humanity + Virtues
);

// Sorcerers work static / linear (hedge) magic through Paths - rated traits that
// arrive with a later slice. Mechanically a mortal for now (mortal soak, Road/
// Humanity + Virtues, Willpower); kept here so [[create-playable templates=sorcerer]]
// works today.
export const TEMPLATE_SORCERER = new TemplateConfig(
  "Sorcerer",
  new RulesetConfig(5, 2, 4, 2, false),
  [willpowerResource(3)],
  MORTAL_SOAK,
  HUMANITY_MORALITY, true
);

// LIVING RESOLVE - the unique fusion carried by ONE creature in the world (the
// Ouroboros template below): revenant vitae, laham Resolve, Awakened
// Quintessence and Willpower as ONE metaphysical substance. Spending 1 point
// spends 1 of each; the Willpower component grants ONE un-cancelable success
// per roll when it isn't consumed by an activation cost (`fuel` when it is;
// `fuel-surge` pays 1 extra to have it anyway). Rolls that POOL it (Willpower/
// Resolve rolls) use min(10, current), and every point above 10 shields a die
// of penalties. Recovers 1/day (the revenant vitae brewing), +1 in the Umbra,
// +1 rested in the sanctum (full-rested AND in-sanctum, simultaneously), 20
// each full moon; drinking vampiric vitae (immune to the bond) and consuming
// Tass are [[gain living-resolve N]] moments.
export const LIVING_RESOLVE: ResourceDef = {
  name: "living-resolve", kind: "pool",
  // It IS the two it fuses: a mage's Quintessence capacity (the Fount ladder)
  // plus a revenant's ten points of vitae - and it spends at the Quintessence
  // rate, because that is the one with a ladder. Written this way, raising the
  // Fount raises the fused pool without anyone editing a number.
  start: "resource:quintessence:max + resource:blood:max",
  max: "resource:quintessence:max + resource:blood:max",
  perTurnLimit: "resource:quintessence:per-turn",
  roles: ["blood", "willpower", "resolve", "magic-fuel", "quintessence"],
  replaces: ["blood", "willpower", "resolve", "quintessence"],
  rollAs: { cap: 10, negatesPenaltiesAbove: 10 },
  recovery: [
    { amount: 1, per: "day", note: "revenant vitae" },
    { amount: 1, per: "day", requires: "in-umbra", note: "Umbral communion" },
    { amount: 1, per: "day", requires: ["full-rested", "in-sanctum"], requiresTrait: { trait: "sanctum", atLeast: 4 }, note: "rested in the sanctum" },
    { amount: 20, per: "full-moon" },
  ],
  description: "Vitae, Quintessence, Resolve and Willpower fused by ritual; 1 point spends as 1 of each. "
    + "Also regained by drinking vampiric vitae (immune to the bond) and consuming Tass - [[gain living-resolve N]]. "
    + "Spend up to 6/turn (ST-enforced)",
  // ONE point is one of each, ALL AT ONCE - it is never spent "as" one
  // component (the owner's ruling; this resource is meant to be overwhelming).
  // So the ordinary spend pays every roll-side component together: the
  // Willpower's certainty and the Resolve's whole payout. The vitae is the same
  // point aimed at flesh (`heal`/`boost`) - not a different way of spending,
  // just a different target.
  //
  // INVARIANT for a fused resource: ONE `difficulty` op, holding the DEEPEST
  // break any of its natures gives. A point lowers a spell's difficulty once,
  // and Resolve's -2 IS that break - the Quintessence -1 is the same break seen
  // from another side, not a second one to add on top (the owner's ruling). If
  // a chronicle retunes Resolve to give no break, put the Quintessence -1 here
  // instead and casting reduces like it does for any mage.
  effect: {
    label: "Living Resolve: per point, +1 un-cancelable success (spellcasting may stack these up to the "
      + "Foundation; one per action otherwise) + Resolve's whole payout (+1 automatic success, 8-again, "
      + "-2 difficulty, which IS the Quintessence break rather than an extra one)",
    apply: [
      { op: "uncancelable", amount: 1 },   // the Willpower
      { op: "successes", amount: 1 },      // the Resolve, in full - not just its difficulty break
      { op: "nagain", amount: 8 },
      { op: "difficulty", amount: -2 },    // Resolve's break; the Quintessence -1 is this same break
    ],
  },
  effects: {
    heal: {
      label: "Living Resolve knits the body: heal 1 bashing/lethal per point",
      apply: [{ op: "heal", target: "bashing,lethal", amount: 1 }],
    },
    boost: {
      label: "Living Resolve surges a Physical Attribute: +1 per point",
      apply: [{ op: "increase", target: "physical", amount: 1 }],
      duration: { kind: "st", n: 1, unit: "scene" },
    },
    fuel: {
      label: "Living Resolve pays a power's required Willpower/Resolve - consumed, no free success",
      apply: [], cost: { units: 1 },
    },
    "fuel-surge": {
      label: "Required cost + 1 extra point: the un-cancelable success rides along",
      apply: [{ op: "uncancelable", amount: 1 }],
      cost: { units: 2 },
    },
  },
};

// =============================================================================
// TEMPLATES AS DATA - extending one, from a card or a command
// -----------------------------------------------------------------------------
// A TemplateConfig is the RESOLVED thing the engine reads. A TemplateDef is how
// a chronicle WRITES one: a name, the template it `extends`, and only the parts
// it changes. Everything else falls through to the parent, so the Ouroboros is
// "a mage, with a ghoul's soak and one fused pool" rather than a re-declaration
// of every field a mage already has.
//
// The pieces a def refers to BY NAME (a card cannot hold a TypeScript object):
// its soak table, its morality, its damage reactions. Each is an open registry,
// so a chronicle that invents a soak gets to name it too.
// =============================================================================
export const SOAK_TABLES: Record<string, SoakSpec> = {
  mortal: MORTAL_SOAK, vampire: VAMPIRE_SOAK, ghoul: GHOUL_SOAK,
  mage: MAGE_SOAK, demon: DEMON_SOAK, werewolf: WEREWOLF_SOAK,
};
export const MORALITIES: Record<string, MoralityConfig> = {
  humanity: HUMANITY_MORALITY,
  torment: { name: "Torment", polarity: "ascending", start: 0 },
};
export const RULESETS: Record<string, RulesetConfig> = {
  vampire: RulesetConfig.VAMPIRE, mage: RulesetConfig.MAGE,
};
export const REACTIONS: Record<string, () => DamageReaction> = {
  "undead-physiology": () => new UndeadPhysiology(),
  "silver-vulnerability": () => new SilverVulnerability(),
};

// A template written as data. Only `name` is required; `extends` names the
// parent that fills in everything this one leaves unsaid.
export interface TemplateDef {
  name: string;
  extends?: string;
  description?: string;          // the display Name; defaults to the parent's
  ruleset?: string;              // RULESETS key
  soak?: string;                 // SOAK_TABLES key
  morality?: string;             // MORALITIES key, or "none" for a splat without one
  hasVirtues?: boolean;
  awakened?: boolean;
  // ADDED to the parent's resources, not replacing them - and a resource whose
  // `replaces` names the parent's hides it (Living Resolve over Quintessence).
  resources?: ResourceDef[];
  reactions?: string[];          // REACTIONS keys, added to the parent's
  budgets?: Record<string, string>;
  creation?: Partial<CreationBudget>;
  derived?: Derivation[];
}

// Resolve a def against its parent into the thing the engine reads.
export function templateFromDef(def: TemplateDef, parent?: TemplateConfig): TemplateConfig {
  const base = parent ?? TEMPLATE_MORTAL;
  const morality = def.morality === undefined ? base.Morality
    : StringUtil.normalize(def.morality) === "none" ? null
    : MORALITIES[StringUtil.normalize(def.morality)] ?? base.Morality;
  return new TemplateConfig(
    def.description ?? (parent ? `${base.Name} (${def.name})` : def.name),
    def.ruleset ? RULESETS[StringUtil.normalize(def.ruleset)] ?? base.Rules : base.Rules,
    [...base.Pools, ...(def.resources ?? [])],
    def.soak ? SOAK_TABLES[StringUtil.normalize(def.soak)] ?? base.Soak : base.Soak,
    morality,
    def.hasVirtues ?? base.HasVirtues,
    base.HealthLevels,
    [...base.Reactions, ...(def.reactions ?? []).map(r => REACTIONS[StringUtil.normalize(r)]?.()).filter((r): r is DamageReaction => !!r)],
    def.awakened ?? base.Awakened,
    { ...base.Budgets, ...(def.budgets ?? {}) },
    { ...base.Creation, ...(def.creation ?? {}) },
    [...base.Derived, ...(def.derived ?? [])],
  );
}

// THE OUROBOROS, as data rather than as a constructor call: a mage who soaks
// like a ghoul and carries one fused pool in place of four. This is the worked
// example of `extends` - and the proof that a unique creature needs no code.
export const DEFAULT_TEMPLATE_DEFS: TemplateDef[] = [
  {
    name: "ouroboros",
    extends: "mage",
    description: "Ouroboros (unique: revenant + laham + Awakened)",
    soak: "ghoul",
    // The revenant's vitae joins the mage's Quintessence, and Living Resolve is
    // their sum - which is why all three are listed. `replaces` then hides the
    // two (and Willpower, and Resolve) behind the one that stands for them.
    resources: [bloodResource({ start: 10, max: 10 }), LIVING_RESOLVE],
    creation: {
      notes: [
        "Starting Willpower 5; note the Aura modifier, if any.",
        "One pool, not four: Living Resolve starts at Cray + Fount, or 5, whichever is higher.",
        "The Fellowship sets the Foundation and the four Pillars ([[fellowships]]) - his is the Order of Hermes.",
        "Arcana and Taints come out of the arcana purse, not out of freebies ([[budget]]).",
      ],
    },
  },
];

// A template def as a CARD writes it: everything is text or a number, and the
// resources block reuses the same shape ResourceOverrides already accepts.
export function makeTemplateDef(parts: Partial<TemplateDef> & { name: string }): TemplateDef {
  const def: TemplateDef = { name: StringUtil.normalize(parts.name) };
  for (const key of ["extends", "ruleset", "soak", "morality"] as const) {
    const v = (parts[key] as string | undefined)?.trim();
    if (v) def[key] = StringUtil.normalize(v);
  }
  if (parts.description?.trim()) def.description = parts.description.trim();
  if (parts.hasVirtues !== undefined) def.hasVirtues = parts.hasVirtues;
  if (parts.awakened !== undefined) def.awakened = parts.awakened;
  const reactions = asStringList(parts.reactions as unknown as CardValue).map(r => StringUtil.normalize(r));
  if (reactions.length) def.reactions = reactions;
  // Two shapes reach here: a card writes a resource BLOCK (the name is the key,
  // the fields indented under it), while code and commands hand over ready-made
  // ResourceDefs. Accept both - the card's shape is the one that needs decoding.
  const resources: ResourceDef[] = Array.isArray(parts.resources) ? [...parts.resources] : [];
  for (const [name, raw] of Object.entries(Array.isArray(parts.resources) ? {} : asMap(parts.resources as unknown as CardValue))) {
    const m = asMap(raw);
    const kind = StringUtil.normalize(asText(m["kind"]) ?? "pool");
    resources.push({
      ...(m as unknown as Partial<ResourceDef>),
      name: StringUtil.normalize(name),
      kind: kind === "tracker" ? "tracker" : "pool",
      start: asNumber(m["start"]) ?? 0,
      max: asNumber(m["max"]) ?? 10,
      ...(asStringList(m["roles"]).length ? { roles: asStringList(m["roles"]).map(r => StringUtil.normalize(r)) } : {}),
      ...(asStringList(m["replaces"]).length ? { replaces: asStringList(m["replaces"]).map(r => StringUtil.normalize(r)) } : {}),
    });
  }
  if (resources.length) def.resources = resources;
  const budgets: Record<string, string> = {};
  for (const [purse, expr] of Object.entries(asMap(parts.budgets as unknown as CardValue))) {
    const v = asText(expr);
    if (v) budgets[StringUtil.normalize(purse)] = v;
  }
  if (Object.keys(budgets).length) def.budgets = budgets;
  if (parts.creation && Object.keys(parts.creation).length) def.creation = parts.creation;
  if (parts.derived?.length) def.derived = parts.derived;
  return def;
}

// The templates written in code. A def (built-in or from the chronicle's card)
// is resolved ON TOP of these.
const BUILTIN_TEMPLATES: Record<string, TemplateConfig> = {
  mortal: TEMPLATE_MORTAL,
  thrall: TEMPLATE_THRALL,
  vampire: TEMPLATE_VAMPIRE,
  mage: TEMPLATE_MAGE,
  demon: TEMPLATE_DEMON,
  werewolf: TEMPLATE_WEREWOLF,
  ghoul: TEMPLATE_GHOUL,
  revenant: TEMPLATE_REVENANT,
  sorcerer: TEMPLATE_SORCERER,
};

// What every reader looks at. Rebuilt whenever the chronicle's template card
// changes (applyTemplateDefs) - state.ts owns the card, rules.ts owns the fold,
// and nothing below state.ts has to know a lorebook exists.
export const TEMPLATES: Record<string, TemplateConfig> = {};

// Fold defs over the built-ins, resolving `extends` depth-first. A def naming a
// parent that does not exist, or a cycle, is SKIPPED and reported rather than
// crashing the story - a half-written card must never cost you the engine.
export function applyTemplateDefs(defs: TemplateDef[]): string[] {
  for (const key of Object.keys(TEMPLATES)) delete TEMPLATES[key];
  Object.assign(TEMPLATES, BUILTIN_TEMPLATES);
  const byName = new Map(defs.map(d => [StringUtil.normalize(d.name), d]));
  const problems: string[] = [];
  const building = new Set<string>();
  const failed = new Set<string>();
  const build = (key: string): TemplateConfig | undefined => {
    if (TEMPLATES[key] && !byName.has(key)) return TEMPLATES[key];
    const def = byName.get(key);
    if (!def) return TEMPLATES[key];
    if (building.has(key)) { failed.add(key); problems.push(`${key} extends itself in a circle`); return undefined; }
    building.add(key);
    const parentKey = def.extends ? StringUtil.normalize(def.extends) : "";
    const parent = parentKey ? (BUILTIN_TEMPLATES[parentKey] ?? build(parentKey)) : undefined;
    building.delete(key);
    // A parent that failed for its OWN reason has already been complained
    // about; saying it twice tells the player nothing new.
    if (parentKey && !parent) {
      if (!failed.has(parentKey)) problems.push(`${key} extends "${parentKey}", which no template defines`);
      failed.add(key);
      return undefined;
    }
    const built = templateFromDef(def, parent);
    TEMPLATES[key] = built;
    return built;
  };
  for (const key of byName.keys()) build(key);
  return problems;
}
applyTemplateDefs(DEFAULT_TEMPLATE_DEFS);

// The resources a character has = the union of its templates' resources, deduped
// by name (first template wins for numbers; roles are merged). Unknown or zero
// templates yield the mortal baseline (just Willpower). Story-level `overrides`
// (the house-rule layer, e.g. from the configuration wizard or a hand-edited
// lorebook entry) are applied last: a patch merges onto its resource by
// normalized name, and a patch naming a NEW resource (with kind/start/max) adds
// a custom one. (A short-lived `preset` patch mechanism was removed - a unique
// resource belongs to a unique TEMPLATE, not to the story-wide overrides layer;
// stale `{"preset": true}` entries are simply ignored here.)
export function resourcesForTemplates(keys: string[], overrides?: Record<string, Partial<ResourceDef>>): ResourceDef[] {
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

// Has any of these templates Awakened? Places of power (Sanctum, Library, Cray)
// answer only to the Awakened.
export function isAwakened(keys: string[]): boolean {
  return keys.some(k => TEMPLATES[StringUtil.normalize(k)]?.Awakened === true);
}

// The health track a character uses: the FIRST of its templates decides (same
// first-wins rule as resource numbers). No/unknown templates -> mortal.
export function healthLevelsForTemplates(keys: string[]): HealthLevelDef[] {
  const t = keys.map(k => TEMPLATES[StringUtil.normalize(k)]).find((x): x is TemplateConfig => !!x);
  return (t ?? TEMPLATE_MORTAL).HealthLevels;
}

// The budget a character of these templates is built against. Templates STACK
// here rather than shadowing one another (a vampire-and-mage owes both sets of
// dots), so each one's numbers override in turn and its notes are appended.
export function creationBudgetFor(keys: string[]): CreationBudget {
  let budget = BASE_CREATION;
  const notes: string[] = [];
  const limits: Record<string, TraitLimit> = {};
  for (const key of keys) {
    const tpl = TEMPLATES[StringUtil.normalize(key)];
    if (!tpl) continue;
    budget = { ...budget, ...tpl.Creation };
    Object.assign(limits, tpl.Creation.limits ?? {});
    for (const note of tpl.Creation.notes ?? []) if (!notes.includes(note)) notes.push(note);
  }
  return {
    ...budget,
    ...(Object.keys(limits).length ? { limits } : {}),
    ...(notes.length ? { notes } : {}),
  };
}

// =============================================================================
// FELLOWSHIPS - a mystic society's Foundation & Pillars, as data
// -----------------------------------------------------------------------------
// Ratings are ordinary `traits`-bucket entries on the character; a fellowship
// record just names them (and glosses them for the Storyteller). [[cast]] uses
// this to AUTO-DETECT the Foundation: with no foundation= argument and no
// literal "foundation" trait, the first fellowship whose Foundation trait the
// caster actually has (> 0) supplies it.
// =============================================================================
export interface Fellowship {
  name: string;
  aliases?: string[];                 // the other names it goes by
  theme?: string;                     // what its Pillars ARE ("The Runes", "Archangels")
  foundation: string;                 // the Foundation TRAIT name
  foundationGloss?: string;
  pillars: Record<string, string>;    // pillar trait name -> gloss
}

export const FELLOWSHIPS: Record<string, Fellowship> = {
  "ahl-i-batin": {
    name: "Ahl-i-Batin", aliases: ["batin", "batini", "batine"], theme: "Ubbadan (Faith)",
    foundation: "al-ikhlas",
    pillars: {
      "al-anbiya": "perception and time", "al-fatiha": "mental contact and communication",
      "al-hajj": "scrying and travel", "al-layl": "illusion and stealth",
    },
  },
  "messianic-voices": {
    name: "Messianic Voices", aliases: ["messianic", "messianics"], theme: "Archangels",
    foundation: "divinity",
    pillars: {
      "gavri-el": "the messenger Angel of Fire", "mikha-el": "the Angel of War",
      "repha-el": "the Angel of the Creative Spirit", "uri-el": "the Angel of Death",
    },
  },
  "old-faith": {
    name: "Old Faith", aliases: ["aedun", "aeduna", "living-faith"], theme: "The Seasons",
    foundation: "spontaneity",
    pillars: {
      autumn: "Earth and the Harvest", spring: "Air and Rebirth",
      summer: "Fire and Vitality", winter: "Death and Water",
    },
  },
  "order-of-hermes": {
    name: "Order of Hermes", aliases: ["hermetic-order", "hermetic", "hermetics"], theme: 'Forma ("Forms")',
    foundation: "modus",
    foundationGloss: "the Ouroboros - knowledge begets discipline and focus, which begets more knowledge",
    pillars: { anima: "life", corona: "mind", primus: "magic itself", vires: "forces" },
  },
  "spirit-talkers": {
    name: "Spirit-Talkers", aliases: ["spirit-talker"], theme: "Totems",
    foundation: "sensitivity",
    pillars: {
      chieftain: "the voices of leaders", trickster: "the thief, the lover and the fool",
      warrior: "the brave fighter", "wise-one": "the venerable lessons of the ages",
    },
  },
  valdaermen: {
    name: "Valdaermen", aliases: ["valdaerman", "runecrafter", "runecrafters", "spae-crafter", "spa-crafter"],
    theme: "The Runes", foundation: "blot",
    pillars: {
      fara: "wanderlust and conveyance", forlog: "wealth and good fortune",
      galdrar: "all that is hidden or forbidden", hjaldar: "those who make war",
    },
  },
};

// A fellowship by name OR by any of the names it also goes by; the id rides
// along, for the same reason it does on a clan.
export function fellowshipByName(name: string): (Fellowship & { id: string }) | undefined {
  const key = StringUtil.normalize(name);
  for (const [id, f] of Object.entries(FELLOWSHIPS)) {
    if (id === key || StringUtil.normalize(f.name) === key) return { ...f, id };
    if ((f.aliases ?? []).some(a => StringUtil.normalize(a) === key)) return { ...f, id };
  }
  return undefined;
}

// =============================================================================
// CLANS - the thirteen (and the Assamite castes), by their Disciplines
// =============================================================================
export interface Clan {
  name: string;
  disciplines: string[];
  aliases?: string[];
  // The clan a CASTE belongs to: the three Assamite castes pick different
  // Disciplines but are one clan, so anything "clan-exclusive" is theirs alike.
  // Absent means the entry is its own clan.
  family?: string;
  // Traits the clan itself bounds - a Nosferatu's Appearance is 0 and stays 0.
  limits?: Record<string, TraitLimit>;
  note?: string;
}
export const CLANS: Record<string, Clan> = {
  brujah: { name: "Brujah", disciplines: ["celerity", "potence", "presence"] },
  cappadocian: { name: "Cappadocians", aliases: ["cappadocians"], disciplines: ["auspex", "fortitude", "mortis"] },
  lasombra: { name: "Lasombra", disciplines: ["dominate", "obtenebration", "potence"] },
  toreador: { name: "Toreador", disciplines: ["auspex", "celerity", "presence"] },
  tzimisce: { name: "Tzimisce", disciplines: ["animalism", "auspex", "vicissitude"] },
  ventrue: { name: "Ventrue", disciplines: ["dominate", "fortitude", "presence"] },
  "assamite-warrior": { name: "Assamite (Warrior)", aliases: ["assamite"], family: "assamite", disciplines: ["celerity", "obfuscate", "quietus"] },
  "assamite-sorcerer": { name: "Assamite (Sorcerer)", family: "assamite", disciplines: ["assamite-sorcery", "auspex", "quietus"] },
  "assamite-vizier": { name: "Assamite (Vizier)", family: "assamite", disciplines: ["auspex", "celerity", "quietus"] },
  "followers-of-set": { name: "Followers of Set", aliases: ["setite", "setites"], disciplines: ["obfuscate", "presence", "serpentis"] },
  gangrel: { name: "Gangrel", disciplines: ["animalism", "fortitude", "protean"] },
  malkavian: { name: "Malkavians", aliases: ["malkavians"], disciplines: ["auspex", "dementation", "obfuscate"] },
  nosferatu: {
    name: "Nosferatu", disciplines: ["animalism", "obfuscate", "potence"],
    limits: { appearance: { start: 0, max: 0, note: "A Nosferatu has no Appearance and never will." } },
  },
  ravnos: { name: "Ravnos", disciplines: ["animalism", "chimerstry", "fortitude"] },
  tremere: { name: "Tremere", disciplines: ["auspex", "dominate", "thaumaturgy"] },
};
// A clan by its id, its name, or any name it also goes by. The id rides along
// because THAT is what a sheet records ([[choose clan …]]) - "Assamite
// (Warrior)" is a title, `assamite-warrior` is the name of the thing.
export function clanByName(name: string): (Clan & { id: string }) | undefined {
  const key = StringUtil.normalize(name);
  for (const [id, c] of Object.entries(CLANS)) {
    if (id === key || StringUtil.normalize(c.name) === key) return { ...c, id };
    if ((c.aliases ?? []).some(a => StringUtil.normalize(a) === key)) return { ...c, id };
  }
  return undefined;
}

// The thirteen: one entry per CLAN, castes folded into theirs. The label drops
// the parenthetical, so the three Assamite castes answer to "Assamite".
export function clanFamilies(): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const [id, c] of Object.entries(CLANS)) {
    const family = c.family ?? id;
    if (!seen.has(family)) seen.set(family, c.name.replace(/\s*\([^)]*\)\s*$/, "").trim());
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}

// Which clan a pick belongs to - the answer a clan-exclusive gate compares.
// An unknown name is its own family, so a chronicle's homebrew clan still works.
export function clanFamilyOf(name: string): string {
  const clan = clanByName(name);
  return clan ? (clan.family ?? clan.id) : StringUtil.normalize(name);
}

// =============================================================================
// MAGIC RULES - the Dark Ages: Mage "How Magic Works" numbers, as data
// -----------------------------------------------------------------------------
// Every constant of the spellcasting procedure lives here and can be overridden
// knob-by-knob from the wod:config:magic lorebook entry (kebab-case names,
// numeric values). difficultyCap defaults to 10 (this chronicle's ruling); the
// book's rule is 9 - flip the one knob to play it straight.
// =============================================================================
export interface MagicRules {
  simpleBase: number;            // simple spell: difficulty = base + required level
  complexBase: number;           // complex spell: difficulty = base + highest + extras
  difficultyCap: number;         // above this, difficulty becomes +1 required success/pt
  minDifficulty: number;         // Quintessence can't push the difficulty below this
  quintPerTurn: number;          // max Quintessence spendable on a casting per turn
  quintFreeLimit: number;        // spending above this needs the Fount Background
  retryPenalty: number;          // +diff per prior same-scene failure
  botchRetryPenalty: number;     // +diff per prior same-scene attempt once one botched
  ongoingMultiplier: number;     // ongoing spells need x this many successes
  ongoingFuelPerSuccess: number; // Quintessence per success while casting ongoing
  sealPerPillarDot: number;      // seal: Quintessence per dot of the highest Pillar
  sealWillpowerPer: number;      // seal: 1 Willpower per this many Quintessence (ceil)
  // How many Foundation dots buy one more un-cancelable success per roll:
  // cap = max(1, floor(Foundation / this)). Foundation 5 / 2 = 2 successes.
  uncancelablePerFoundation: number;
}
export const DEFAULT_MAGIC_RULES: MagicRules = {
  simpleBase: 4, complexBase: 5, difficultyCap: 10, minDifficulty: 4,
  quintPerTurn: 3, quintFreeLimit: 2, retryPenalty: 1, botchRetryPenalty: 2,
  ongoingMultiplier: 10, ongoingFuelPerSuccess: 1, sealPerPillarDot: 5, sealWillpowerPer: 10,
  uncancelablePerFoundation: 2,
};

// The most un-cancelable successes one roll can carry, for this character's
// Foundation: the Willpower being spent is only worth so much certainty. The
// first dot is the price of entry, then each `uncancelablePerFoundation` dots
// buys another - floor((Foundation - 1) / 2) by default, so Foundation 5 grants
// 2. A character with no Foundation (the unawakened) can still buy exactly one.
// Tags that mark a roll as a CASTING (both are set by [[cast]]).
export const CASTING_TAGS = ["magic", "cast"];
export function isCastingRoll(tags: readonly string[] | undefined): boolean {
  return (tags ?? []).some(t => CASTING_TAGS.includes(StringUtil.normalize(t)));
}

// How much certainty a single spend may buy. The multi-Willpower rule is a
// SPELLCASTING rule - a mage may pour extra Willpower into a spell, up to what
// his Foundation can hold. Everywhere else the old law stands: one Willpower
// per action. So two points of a fused substance spent on a Discipline are two
// points of that Discipline's fuel and exactly ONE un-cancelable success; the
// same two spent on a spell buy two (at Foundation 5).
export function uncancelableAllowance(casting: boolean, foundationRating: number, rules: MagicRules): number {
  return casting ? uncancelableCap(foundationRating, rules) : 1;
}

export function uncancelableCap(foundationRating: number, rules: MagicRules): number {
  return Math.max(1, Math.floor((Math.max(0, foundationRating) - 1) / Math.max(1, rules.uncancelablePerFoundation)));
}

const MAGIC_KNOBS: Record<string, keyof MagicRules> = {
  "simple-base": "simpleBase", "complex-base": "complexBase",
  "difficulty-cap": "difficultyCap", "min-difficulty": "minDifficulty",
  "quintessence-per-turn": "quintPerTurn", "quintessence-free-limit": "quintFreeLimit",
  "retry-penalty": "retryPenalty", "botch-retry-penalty": "botchRetryPenalty",
  "ongoing-multiplier": "ongoingMultiplier", "ongoing-fuel-per-success": "ongoingFuelPerSuccess",
  "seal-per-pillar-dot": "sealPerPillarDot", "seal-willpower-per": "sealWillpowerPer",
  "uncancelable-per-foundation": "uncancelablePerFoundation",
};
export const MAGIC_KNOB_NAMES: string[] = Object.keys(MAGIC_KNOBS);

// A knob NAME is data, and a card may spell it either way - the card format
// rewrites a few hyphenated keys to their camelCase field names on the way in
// (core/cardtext.ts FIELD_ALIASES), which silently orphaned `difficulty-cap`
// until this. Knob lookups therefore compare on letters alone, so
// "difficulty-cap", "difficultyCap" and "difficulty cap" are one knob.
export const knobKey = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, "");
const MAGIC_KNOBS_BY_KEY: Record<string, keyof MagicRules> =
  Object.fromEntries(Object.entries(MAGIC_KNOBS).map(([name, field]) => [knobKey(name), field]));

// Defaults overlaid with the story's knob overrides (unknown names and
// non-numbers are ignored - a typo can't corrupt the rules).
export function magicRulesFrom(overrides: Record<string, number>): MagicRules {
  const rules: MagicRules = { ...DEFAULT_MAGIC_RULES };
  for (const [k, v] of Object.entries(overrides ?? {})) {
    const field = MAGIC_KNOBS_BY_KEY[knobKey(k)];
    if (field && typeof v === "number" && Number.isFinite(v)) rules[field] = v;
  }
  return rules;
}

// =============================================================================
// BACKGROUNDS - a bag of their own, with dots that need not equal cost
// -----------------------------------------------------------------------------
// Backgrounds used to be only a list of NAMES in the lorebook, which is why
// they were the one thing with no definitions, no ceiling and no way to say
// what one DOES. They are their own currency (Background dots), and two things
// make them irregular:
//   - DOTS ARE NOT COST. Usually a thing costs what it rates, but a chronicle
//     hands some out: a Talisman you were given rates 5 and cost nothing. The
//     rating lives on the sheet, what it cost lives in `paid` (§7.50).
//   - ONE MAY CONFER OTHERS. A Talisman that IS a place - Cosmos Within the
//     Measure, which opens the Library of the Unseen - grants Cray, Library and
//     Sanctum ratings without those being bought at all.
// =============================================================================
export interface TraitGrant {
  trait: string;
  rating: number;
  atLeast?: number;   // the granting rating this starts at (default 1)
  note?: string;
}
// A rung of a Background's own ladder, for the ones that read as a table.
export interface BackgroundTier {
  atLeast: number;
  note?: string;
  max?: number;       // a resource capacity this rung sets (Fount: 12/14/16/18/20)
  perTurn?: number;   // and what may be spent per turn (Fount: 2/3/4/5/6)
}
export interface BackgroundDef {
  name: string;
  description?: string;
  max?: number;               // the usual 5, but a Sanctum can run deeper
  templates?: string[];       // who may take it (empty = anyone)
  resource?: string;          // the resource its tiers size (Fount -> quintessence)
  tiers?: BackgroundTier[];
  grants?: TraitGrant[];
  note?: string;
}

export const DEFAULT_BACKGROUNDS: BackgroundDef[] = [
  {
    name: "fount", max: 5, templates: ["mage", "ouroboros"], resource: "quintessence",
    description: "Affinity for holding and channelling Quintessence. Without it a mage holds ten points and spends two per turn.",
    tiers: [
      { atLeast: 1, max: 12, perTurn: 2 }, { atLeast: 2, max: 14, perTurn: 3 },
      { atLeast: 3, max: 16, perTurn: 4 }, { atLeast: 4, max: 18, perTurn: 5 },
      { atLeast: 5, max: 20, perTurn: 6 },
    ],
    note: "The Ouroboros' Living Resolve already bakes this in: Fount 5 (20, six per turn) plus ten dots of vitae is the 30/6 pool.",
  },
  { name: "sanctum", max: 10, templates: ["mage", "ouroboros"],
    description: "A warded place of working. Rating-scaled: see the in-sanctum affliction." },
  { name: "library", max: 10, templates: ["mage", "ouroboros"],
    description: "Books, scrolls and the finding of things in them. See the in-library affliction." },
  { name: "cray", max: 5, templates: ["mage", "ouroboros"],
    description: "A site of gathered Quintessence, drainable and exhaustible ([[cray]], [[harvest]], [[absorb]])." },
  { name: "talisman", max: 5, templates: ["mage", "ouroboros"],
    description: "An object of power. A Talisman that IS a place grants the ratings of that place - see `grants`.",
    note: "Cosmos Within the Measure is the worked example: at 5 it opens the Library of the Unseen, which IS a Cray 5, a Library 5 and a Sanctum 5. Redefine it for your own chronicle with [[define-background]]." },
  { name: "mentor", max: 5, description: "Someone older and wiser who owes you time. More than one may be held." },
  { name: "resources", max: 5, description: "Money, goods and the credit of a household." },
  // The one Background that is not a possession but a FACT about the blood:
  // each dot is a generation closer to Caine, and the sheet's ceilings follow.
  // Nothing here says so - the vampire template's `generation` derivation does.
  { name: "generation", max: 5, templates: ["vampire", "ghoul", "revenant"],
    description: "How close to Caine the blood runs. A vampire starts at the 12th generation; each dot buys one step nearer.",
    tiers: [
      { atLeast: 1, note: "11th generation" }, { atLeast: 2, note: "10th generation" },
      { atLeast: 3, note: "9th generation" }, { atLeast: 4, note: "8th generation" },
      { atLeast: 5, note: "7th generation - and Attributes, Abilities and Disciplines may reach 6" },
    ],
    note: "The engine derives `generation`, the trait ceilings and the blood pool from this dot count; see [[derived]]." },
];

// Every trait a character's Backgrounds CONFER, by name -> {rating, from}.
// Highest wins when two backgrounds grant the same thing.
export function grantsFromBackgrounds(
  backgrounds: Record<string, number>, defs: BackgroundDef[],
): Record<string, { rating: number; from: string }> {
  const out: Record<string, { rating: number; from: string }> = {};
  for (const [rawName, rating] of Object.entries(backgrounds ?? {})) {
    const name = StringUtil.normalize(rawName);
    const def = defs.find(d => StringUtil.normalize(d.name) === name);
    for (const g of def?.grants ?? []) {
      if (rating < (g.atLeast ?? 1)) continue;
      const key = StringUtil.normalize(g.trait);
      if ((out[key]?.rating ?? 0) >= g.rating) continue;
      out[key] = { rating: g.rating, from: def!.name };
    }
  }
  return out;
}

// The tier a rating sits on (the deepest rung it reaches).
export function backgroundTierAt(def: BackgroundDef, rating: number): BackgroundTier | undefined {
  return [...(def.tiers ?? [])].filter(t => rating >= t.atLeast).sort((a, b) => b.atLeast - a.atLeast)[0];
}

export function makeBackgroundDef(parts: Partial<BackgroundDef> & { name: string }): BackgroundDef {
  const def: BackgroundDef = { name: StringUtil.normalize(parts.name) };
  if (parts.description?.trim()) def.description = parts.description.trim();
  if (parts.max !== undefined) def.max = parts.max;
  const templates = asStringList(parts.templates as unknown as CardValue).map(t => StringUtil.normalize(t));
  if (templates.length) def.templates = templates;
  if (parts.resource?.trim()) def.resource = StringUtil.normalize(parts.resource);
  if (parts.tiers?.length) def.tiers = [...parts.tiers].sort((a, b) => a.atLeast - b.atLeast);
  const grants = asList(parts.grants as unknown as CardValue).map(raw => {
    const m = asMap(raw);
    const trait = asText(m["trait"]);
    if (!trait) return undefined;
    const g: TraitGrant = { trait: StringUtil.normalize(trait), rating: asNumber(m["rating"]) ?? 1 };
    const atLeast = asNumber(m["atLeast"]);
    if (atLeast !== undefined) g.atLeast = atLeast;
    const note = asText(m["note"]);
    if (note) g.note = note;
    return g;
  }).filter((g): g is TraitGrant => g !== undefined);
  if (grants.length) def.grants = grants;
  if (parts.note?.trim()) def.note = parts.note.trim();
  return def;
}

// =============================================================================
// SUPERNATURAL TRAIT CATEGORIES - what KIND of power a rated trait is
// -----------------------------------------------------------------------------
// A rated supernatural trait is not just a number in a bucket: Disciplines,
// Awakened magic, static Sorcery and Blood Sorcery are different families, open
// to different templates and bought from different budgets. And some of them
// NEST: a Thaumaturgy path is only reachable through Thaumaturgy, a Mortis path
// through Mortis - while Koldunic sorcery answers to no Discipline at all.
// `parent` says which Discipline (if any) a member hangs from; the members
// themselves are ratings on the sheet, so nothing here duplicates the character.
// Enforced nowhere yet: [[supernatural]] reports, the Storyteller decides.
// =============================================================================
export interface SupernaturalCategory {
  name: string;
  label?: string;
  templates?: string[];   // who may have it at all (empty = anyone)
  bucket?: string;        // which sheet group its ratings live in (default: traits)
  budget?: string;        // which purse buys it, when it is bought
  // A member needs this trait to exist first ("thaumaturgy"). Set per MEMBER,
  // not per category, because Koldunic sorcery needs no Discipline while the
  // Thaumaturgical paths need theirs.
  note?: string;
}

// A named power inside a category - a Thaumaturgical path, a Sphere, a Pillar.
export interface SupernaturalTraitDef {
  name: string;
  category: string;
  parent?: string;        // the Discipline it hangs from, when it hangs from one
  note?: string;
}

export const DEFAULT_SUPERNATURAL_CATEGORIES: SupernaturalCategory[] = [
  { name: "disciplines", label: "Disciplines", templates: ["vampire", "ghoul", "revenant", "ouroboros"], bucket: "disciplines",
    note: "The Cainite powers proper - rated 1-5 on the sheet." },
  { name: "magic", label: "Awakened magic", templates: ["mage", "ouroboros"], bucket: "traits", budget: "freebie",
    note: "Foundation + Pillars (see [[fellowships]]); the Awakened arts." },
  { name: "sorcery", label: "Sorcery", bucket: "traits",
    note: "Static, ritual magic - paths and rituals learned rather than Awakened. Open to anyone the chronicle allows." },
  { name: "blood-sorcery", label: "Blood Sorcery", templates: ["vampire", "ghoul", "revenant", "ouroboros"], bucket: "traits",
    note: "Paths worked through vitae. MOST hang from a Discipline - a Thaumaturgical path needs Thaumaturgy, a Mortis path needs Mortis - but not all: Koldunic sorcery answers to none." },
];

// The Dark Ages paths this engine ships knowing about. The list is data and the
// chronicle extends it; the POINT of the entries is the `parent` gate.
export const DEFAULT_SUPERNATURAL_TRAITS: SupernaturalTraitDef[] = [
  { name: "Rego Vitae", category: "blood-sorcery", parent: "thaumaturgy",
    note: "The Path of Blood, as the Dark Ages name it - Thaumaturgy's first path." },
  { name: "Rego Motus", category: "blood-sorcery", parent: "thaumaturgy", note: "The Lure of Flames' Dark Ages sibling." },
  { name: "Mortis", category: "blood-sorcery", note: "The Cappadocian art; its paths hang from Mortis itself." },
  { name: "Koldunic Sorcery", category: "blood-sorcery",
    note: "The Tzimisce way of the land - it answers to no Discipline." },
];

// Which category a supernatural trait belongs to, and what it needs first.
export function supernaturalTraitOf(name: string, defs: SupernaturalTraitDef[] = DEFAULT_SUPERNATURAL_TRAITS): SupernaturalTraitDef | undefined {
  const key = StringUtil.normalize(name);
  return defs.find(d => StringUtil.normalize(d.name) === key);
}

// Is this category open to these templates?
export function categoryOpenTo(cat: SupernaturalCategory, templates: string[]): boolean {
  if (!cat.templates?.length) return true;
  const mine = templates.map(t => StringUtil.normalize(t));
  return cat.templates.some(t => mine.includes(StringUtil.normalize(t)));
}

// =============================================================================
// ADVANCEMENT COSTS - what a dot costs, from each purse
// -----------------------------------------------------------------------------
// Prices are CHRONICLE RULES, not character data: they are the same for every
// sheet, so they live here and in one config card - never on the sheet itself.
// Each entry is one trait kind priced from the three purses a Dark Ages game
// draws on: `experience` (play), `freebie` (creation), `maturation` (downtime).
// Values are TEXT, deliberately: nothing evaluates them yet (there is no
// advancement engine), so they are stored, surfaced by [[costs]], and applied
// by the Storyteller - the standing rule for a subsystem that doesn't exist.
// "current" means the rating you are raising FROM.
// =============================================================================
export type CostPurse = "experience" | "freebie" | "maturation";
export const COST_PURSES: CostPurse[] = ["experience", "freebie", "maturation"];
export type CostTable = Record<string, Record<string, string>>;

export const DEFAULT_ADVANCEMENT_COSTS: CostTable = {
  attribute: { experience: "current x 4", freebie: "5", maturation: "current x 3" },
  ability: { experience: "current x 2 (a new one: 3)", freebie: "2", maturation: "current x 2" },
  background: { experience: "current x 2", freebie: "1", maturation: "current x 2" },
  discipline: { experience: "current x 5 (out of clan: current x 7)", freebie: "7", maturation: "current x 5" },
  pillar: { experience: "current x 7", freebie: "3", maturation: "current x 7" },
  foundation: { experience: "current x 8", freebie: "5", maturation: "current x 8" },
  specialty: { experience: "-", freebie: "1", maturation: "-" },
  virtue: { experience: "current x 2", freebie: "2", maturation: "current x 2" },
  willpower: { experience: "current", freebie: "1", maturation: "current" },
  road: { experience: "current x 2", freebie: "1", maturation: "current x 2" },
  "merit-flaw": { experience: "-", freebie: "the merit's own points", maturation: "-" },
};

// The shipped table with the story's overrides laid over it, kind by kind (an
// override may replace one purse's price without restating the others).
export function advancementCostsFrom(overrides: CostTable): CostTable {
  const out: CostTable = {};
  for (const [kind, purses] of Object.entries(DEFAULT_ADVANCEMENT_COSTS)) out[kind] = { ...purses };
  for (const [rawKind, purses] of Object.entries(overrides ?? {})) {
    const kind = StringUtil.normalize(rawKind);
    out[kind] = { ...(out[kind] ?? {}) };
    for (const [rawPurse, price] of Object.entries(purses ?? {})) {
      if (price === undefined || price === null) continue;
      out[kind][StringUtil.normalize(rawPurse)] = String(price);
    }
  }
  return out;
}

// =============================================================================
// ROLL RULES - chronicle-wide knobs for ordinary rolls
// -----------------------------------------------------------------------------
// One knob so far: a global MINIMUM DIFFICULTY. Unset means what it says -
// no roll has a floor except the ones that name their own (`min-difficulty=` on
// the roll, saved with a named roll). Distinct from the magic knob of the same
// name, which bounds how far QUINTESSENCE may talk a spell's difficulty down;
// this one is the floor the die target itself never drops below.
// =============================================================================
export function rollFloorFrom(overrides: Record<string, number>): number | undefined {
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (knobKey(k) !== "mindifficulty") continue;
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(2, Math.min(10, v));
  }
  return undefined;
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
export type DisciplineArena = "physical" | "mental" | "social";
export interface DisciplineDef {
  name: string;
  arena: DisciplineArena;
  clans: string[];          // Dark Ages clans for whom it is in-clan
  description?: string;
}

export const DISCIPLINES: Record<string, DisciplineDef> = {
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

export function disciplineDef(name: string): DisciplineDef | undefined {
  return DISCIPLINES[StringUtil.normalize(name)];
}

// =============================================================================
// MERITS & FLAWS - optional quirks with (waivable) prerequisites
// -----------------------------------------------------------------------------
// Defaults live in an in-code list; the lorebook is the editable database on
// top: any entry in the "srd:merits-flaws" category whose text names definitions
// of definitions is merged over the defaults by MeritFlawRegistry
// .loadFromLorebook(). Prerequisites may name templates, free-form character
// tags ("toreador", "revenant", "inconnu", ...) and other Merits/Flaws; every
// check can be waived case-by-case.
// =============================================================================
// What a definition IS, which decides two things at once: which purse it draws
// on, and which way the money flows. Merits and Flaws trade freebie points;
// ARCANA and TAINTS trade an arcana budget of their own, which is why an
// arcanum must never be counted as a merit - it would make a legal character
// look overspent.
export type MeritFlawKind = "merit" | "flaw" | "arcanum" | "taint";
export const MERIT_FLAW_KINDS: MeritFlawKind[] = ["merit", "flaw", "arcanum", "taint"];

// The purse each kind draws on, and the sign of the trade: a merit and an
// arcanum COST, a flaw and a taint GRANT. `budget` on the def overrides the
// purse when a chronicle invents another one.
const KIND_BUDGET: Record<MeritFlawKind, string> = {
  merit: "freebie", flaw: "freebie", arcanum: "arcana", taint: "arcana",
};
const KIND_SPENDS: Record<MeritFlawKind, boolean> = {
  merit: true, flaw: false, arcanum: true, taint: false,
};
export function budgetOfKind(def: { kind: MeritFlawKind; budget?: string }): string {
  return StringUtil.normalize(def.budget ?? KIND_BUDGET[def.kind] ?? "freebie");
}
export function kindSpends(kind: MeritFlawKind): boolean { return KIND_SPENDS[kind] ?? true; }

// How one template differs on a definition. Dark Ages arcana are printed with
// a price per splat - "Celestial Radiance (7/5)" is 7 to a demon and 5 to a
// thrall - and the difference can run deeper than money: a template may be
// barred from it outright, or get a lesser version of the effect.
export interface TemplateVariant {
  cost?: number | number[] | string;  // this template's price (an expression is allowed)
  available?: boolean;                // false = this template may not take it at all
  note?: string;                      // how the effect differs for them
}
export interface MeritFlawRequirements {
  templates?: string[];   // met if the character's template matches ANY listed
  tags?: string[];        // ALL listed tags must be present on the character
  meritsFlaws?: string[]; // ALL listed merits/flaws must already be taken
  // A CHOICE the character made - {clan: "nosferatu"}, {fellowship:
  // "valdaermen"}. Clans and Fellowships are not templates, so the things
  // exclusive to them gate on the pick rather than on the splat.
  choices?: Record<string, string>;
}
// One cross-instance ceiling on a parameterized def.
export interface InstanceLimit {
  atRating: number;                  // the rating being rationed
  slots: number;                     // how many instances may hold it (or more)
  perKind?: Record<string, number>;  // and at most this many of a trait KIND
}

export interface MeritFlawDef {
  name: string;
  kind: MeritFlawKind;
  points: number | number[]; // cost (merit/arcanum) / bonus granted (flaw/taint); array = variable rating
  // Which purse this trades in, when the kind's default is not right.
  budget?: string;
  // Per-template price / availability / effect. The list is EXHAUSTIVE: naming
  // any template means only those templates may take it - which is what a
  // printed "(7/5)" says. Leave it off for something anyone may take; say
  // `cost: 0` for a template it is free to, and `available: false` to bar one
  // that would otherwise qualify.
  perTemplate?: Record<string, TemplateVariant>;
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
  // How many instances of this def may sit at a TOP rating, and - because the
  // book cares which KIND of trait they are - how many of those may be an
  // Attribute, an Ability, and so on. "Two favoured traits may reach 3, at most
  // one of them an Attribute" is one entry: {atRating: 3, slots: 2,
  // perKind: {attribute: 1}}. ADVISORY, like everything creation-side: the
  // check reports violations and take-merit refuses (waivable).
  limits?: InstanceLimit[];
  // The rating ceiling is a TRAIT, not a constant: "may not be purchased more
  // times than his Resolve". The name is resolved the way every trait name is
  // (a rated trait first, else the resource that fills or replaced that name -
  // so a character whose Resolve IS Living Resolve is capped by that), and the
  // reading is the PERMANENT rating, never the spent-down current.
  maxFromTrait?: string;
}

// What this definition costs THIS character, and whether they may take it at
// all. The first of the character's templates with an entry wins; a def with
// per-template prices and no entry for any of them is not open to them.
export function meritCostFor(def: MeritFlawDef, templates: string[]): {
  points: number | number[] | string; available: boolean; note?: string; from?: string;
} {
  const mine = templates.map(t => StringUtil.normalize(t));
  const variants = def.perTemplate ?? {};
  for (const t of mine) {
    const v = variants[t] ?? variants[StringUtil.normalize(t)];
    if (!v) continue;
    if (v.available === false) return { points: v.cost ?? def.points, available: false, note: v.note, from: t };
    return { points: v.cost ?? def.points, available: true, note: v.note, from: t };
  }
  // Priced per template, and none of them is ours. The list is EXHAUSTIVE by
  // design - "(7/5)" names everyone who may have it - so this is not ours to
  // take. A definition anyone may take simply carries no perTemplate at all,
  // and one that is free to a template says so with `cost: 0`.
  if (Object.keys(variants).length) return { points: 0, available: false };
  return { points: def.points, available: true };
}

// A def's cross-instance limits.
export function instanceLimitsOf(def: MeritFlawDef): InstanceLimit[] {
  return [...(def.limits ?? [])];
}

// "trait-affinity:melee" -> its base def name + instance param. The suffix is
// split off ONLY when the base def declares `param` (plain names with colons
// stay whole otherwise; lookup tries the full key first).
export function resolveMeritInstance(key: string, lookup: (name: string) => MeritFlawDef | undefined):
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
export function passiveOpsOf(def: MeritFlawDef, param: string | undefined, points: number): EffectOp[] {
  const sub = (v: string | undefined): string | undefined =>
    def.param && v === `$${def.param}` ? param : v;
  return (def.passive ?? []).map(op => {
    const out: EffectOp = { ...op, op: op.op };
    out.target = sub(op.target);
    out.trait = sub(op.trait);
    // A pure gate/flag op (an immunity, a recorded state) carries no magnitude
    // to scale - only numeric ops multiply by the points taken.
    if (op.amount === undefined) {
      out.amount = undefined;
      delete out.amount;
      if (out.target === undefined) delete out.target;
      if (out.trait === undefined) delete out.trait;
      return out;
    }
    if (out.target === undefined) delete out.target;
    if (out.trait === undefined) delete out.trait;
    out.amount = (op.amount ?? 1) * Math.max(1, points);
    return out;
  });
}

// --- AUTHORING PASSIVES FROM A COMMAND LINE ---
// A compact sentence per op, separated by ";":
//   "<op>[:<target>] [+N|-N] [if=<trait>] [while=<resource>[>=N]] [once]"
// e.g. "difficulty -1 if=$trait" or
//      "immune:fear,mind-control while=living-resolve".
// A value starting with "[" is read as raw JSON instead - the escape hatch for
// anything this shorthand can't say.
export function parsePassiveOps(raw: string): EffectOp[] | { error: string } {
  const text = raw.trim();
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return { error: `passive JSON must be an array of ops` };
      return parsed as EffectOp[];
    } catch (e) { return { error: `passive JSON didn't parse: ${(e as Error).message}` }; }
  }
  const ops: EffectOp[] = [];
  for (const sentence of text.split(";").map(s => s.trim()).filter(s => s.length > 0)) {
    const words = sentence.split(/\s+/);
    const [head, target] = words[0].split(":");
    if (!head) return { error: `each passive needs an op, e.g. "difficulty -1" (got "${sentence}")` };
    const op: EffectOp = { op: StringUtil.normalize(head) };
    if (target) op.target = target.split(",").map(t => StringUtil.normalize(t)).join(",");
    for (const word of words.slice(1)) {
      if (/^[+-]?\d+$/.test(word)) { op.amount = parseInt(word, 10); continue; }
      if (word === "once") { op.once = true; continue; }
      // Split on the FIRST "=" only - a value may carry its own (while=blood>=3).
      const eq = word.indexOf("=");
      const k = eq < 0 ? word : word.slice(0, eq);
      const v = eq < 0 ? "" : word.slice(eq + 1);
      const key = k.toLowerCase();
      if (!v) return { error: `can't read "${word}" in "${sentence}" - use if=, while=, once, or a number` };
      if (key === "if" || key === "trait") op.trait = v.startsWith("$") ? v : StringUtil.normalize(v);
      else if (key === "on" || key === "target") op.target = v.split(",").map(t => StringUtil.normalize(t)).join(",");
      else if (key === "amount") op.amount = parseInt(v, 10) || 0;
      else if (key === "while") {
        const m = v.match(/^([^>]+)(?:>=(\d+))?$/);
        if (!m) return { error: `can't read while=${v} - use while=<resource>[>=N]` };
        op.requiresResource = { resource: StringUtil.normalize(m[1]), atLeast: m[2] ? parseInt(m[2], 10) : 1 };
      } else return { error: `unknown passive modifier "${k}" in "${sentence}"` };
    }
    ops.push(op);
  }
  if (!ops.length) return { error: `no passive ops read from "${raw}"` };
  return ops;
}

// One passive op as prose, gates included - what [[merit]] and [[merits]] show.
export function describePassiveOp(op: EffectOp): string {
  const amount = op.amount === undefined ? "" : ` ${op.amount > 0 ? "+" : ""}${op.amount}`;
  const on = op.target ? ` (${op.target})` : "";
  const gates: string[] = [];
  if (op.trait) gates.push(`when the pool uses ${op.trait}`);
  if (op.requiresResource) {
    const r = op.requiresResource;
    gates.push(`while ${r.resource} >= ${r.atLeast}`);
  }
  if (op.once) gates.push("once per spend");
  return `${op.op}${amount}${on}${gates.length ? ` - ${gates.join(", ")}` : ""}`;
}

// --- READING DEFINITIONS OUT OF A CARD --------------------------------------
// Card text is untyped on purpose (core/cardtext.ts): the reader reports what
// was written, and the consumer says what it wants. These are the two shapes
// the rules layer owns - every other store reads its own.

// One always-on / spend op. `op` is required; everything else is optional, and
// an op the engine doesn't know is kept anyway (the open-vocabulary rule: it is
// recorded, surfaced, and the Storyteller adjudicates).
export function effectOpFromCard(raw: CardValue): EffectOp | undefined {
  const body = asMap(raw);
  const name = asText(body["op"]);
  if (!name) return undefined;
  const op: EffectOp = { op: StringUtil.normalize(name) };
  const target = asText(body["target"], ",");
  if (target) op.target = target;
  const amount = asNumber(body["amount"]);
  if (amount !== undefined) op.amount = amount;
  if (asBool(body["fillToCap"])) op.fillToCap = true;
  const cap = asNumber(body["cap"]) ?? asText(body["cap"]);
  if (cap !== undefined) op.cap = cap;
  const trait = asText(body["trait"]);
  if (trait) op.trait = trait;
  if (asBool(body["once"])) op.once = true;
  const gate = asMap(body["requiresResource"]);
  const resource = asText(gate["resource"]);
  if (resource) {
    op.requiresResource = { resource: StringUtil.normalize(resource), atLeast: asNumber(gate["atLeast"]) ?? 1 };
  }
  return op;
}
export function effectOpsFromCard(raw: CardValue | undefined): EffectOp[] {
  return asList(raw).map(effectOpFromCard).filter((op): op is EffectOp => op !== undefined);
}

// One Merit / Flaw / arcanum. Undefined when the block never says which it is -
// the card keeps the text, the registry just doesn't take it.
export function meritFlawFromCard(name: string, body: CardMap): MeritFlawDef | undefined {
  const kind = (asText(body["kind"]) ?? "").toLowerCase() as MeritFlawKind;
  if (!MERIT_FLAW_KINDS.includes(kind)) return undefined;
  const rawPoints = body["points"];
  const def: MeritFlawDef = {
    name: name.trim(),
    kind,
    points: Array.isArray(rawPoints)
      ? rawPoints.map(p => asNumber(p) ?? 0)
      : asNumber(rawPoints) ?? 0,
  };
  const requires = asMap(body["requires"]);
  const templates = asStringList(requires["templates"]).map(t => StringUtil.normalize(t));
  const tags = asStringList(requires["tags"]).map(t => StringUtil.normalize(t));
  const meritsFlaws = asStringList(requires["meritsFlaws"]).map(t => StringUtil.normalize(t));
  if (templates.length || tags.length || meritsFlaws.length) {
    def.requires = {};
    if (templates.length) def.requires.templates = templates;
    if (tags.length) def.requires.tags = tags;
    if (meritsFlaws.length) def.requires.meritsFlaws = meritsFlaws;
  }
  const description = asText(body["description"]);
  if (description) def.description = description;
  const param = asText(body["param"]);
  if (param) def.param = StringUtil.normalize(param);
  const passive = effectOpsFromCard(body["passive"]);
  if (passive.length) def.passive = passive;
  const limits: InstanceLimit[] = [];
  for (const raw of asList(body["limits"])) {
    const m = asMap(raw);
    const atRating = asNumber(m["atRating"]);
    if (atRating === undefined) continue;
    const limit: InstanceLimit = { atRating, slots: Math.max(0, asNumber(m["slots"]) ?? 1) };
    const perKind: Record<string, number> = {};
    for (const [kind, n] of Object.entries(asMap(m["perKind"]))) {
      const v = asNumber(n);
      if (v !== undefined) perKind[StringUtil.normalize(kind)] = v;
    }
    if (Object.keys(perKind).length) limit.perKind = perKind;
    limits.push(limit);
  }
  if (limits.length) def.limits = limits;
  const maxFromTrait = asText(body["maxFromTrait"]);
  if (maxFromTrait) def.maxFromTrait = StringUtil.normalize(maxFromTrait);
  const budget = asText(body["budget"]);
  if (budget) def.budget = StringUtil.normalize(budget);
  const perTemplate: Record<string, TemplateVariant> = {};
  for (const [rawName, raw] of Object.entries(asMap(body["perTemplate"]))) {
    const m = asMap(raw);
    const variant: TemplateVariant = {};
    const cost = Array.isArray(m["cost"]) ? m["cost"].map(c => asNumber(c) ?? 0) : (asNumber(m["cost"]) ?? asText(m["cost"]));
    if (cost !== undefined) variant.cost = cost;
    const available = asBool(m["available"]);
    if (available !== undefined) variant.available = available;
    const note = asText(m["note"]);
    if (note) variant.note = note;
    // A bare `demon: 7` is the price and nothing else.
    const bare = asNumber(raw);
    if (bare !== undefined && variant.cost === undefined) variant.cost = bare;
    perTemplate[StringUtil.normalize(rawName)] = variant;
  }
  if (Object.keys(perTemplate).length) def.perTemplate = perTemplate;
  return def;
}

// One exclusive Merit and Flaw per clan and per fellowship, so the SHAPE exists
// and the chronicle can fill in what they actually do. They gate on the CHOICE
// (see MeritFlawRequirements.choices), which is what makes them exclusive.
function exclusiveDefs(kindOfChoice: "clan" | "fellowship", id: string, label: string): MeritFlawDef[] {
  return [
    {
      name: `${label} Exclusive Merit`, kind: "merit", points: 1,
      requires: { choices: { [kindOfChoice]: id } },
      description: `A placeholder for whatever ${label} alone may buy. Redefine it with [[define-merit]].`,
    },
    {
      name: `${label} Exclusive Flaw`, kind: "flaw", points: 1,
      requires: { choices: { [kindOfChoice]: id } },
      description: `A placeholder for whatever ${label} alone must carry. Redefine it with [[define-merit]].`,
    },
  ];
}
export const EXCLUSIVE_MERITS_FLAWS: MeritFlawDef[] = [
  // Thirteen, not fifteen: an Assamite Vizier may buy what Assamites may buy.
  ...clanFamilies().flatMap(c => exclusiveDefs("clan", c.id, c.name)),
  ...Object.entries(FELLOWSHIPS).flatMap(([id, f]) => exclusiveDefs("fellowship", id, f.name)),
];

export const DEFAULT_MERITS_FLAWS: MeritFlawDef[] = [
  ...EXCLUSIVE_MERITS_FLAWS,
  // Devil's Due arcana, modeled as parameterized merits with passive effects.
  {
    name: "Trait Affinity", kind: "arcanum", points: [1, 2, 3], param: "trait",
    limits: [{ atRating: 3, slots: 2, perKind: { attribute: 1 } }],
    passive: [{ op: "difficulty", amount: -1, trait: "$trait" }],
    description: "Devil's Due: -1 difficulty per point on rolls whose pool uses the trait, chosen when you take it "
      + "([[take-merit trait-affinity::melee 2]]). TWO traits may reach 3 - one Attribute and one Ability, or two "
      + "Abilities; every other trait caps at 2.",
  },
  {
    name: "Trait Enhancement", kind: "arcanum", points: [1, 2, 3], param: "trait",
    passive: [{ op: "enhance", amount: 1, target: "$trait" }],
    description: "Devil's Due: permanently raises the trait's effective value AND its advancement ceiling by the points taken; XP still prices from the un-enhanced base.",
  },
  {
    name: "Sharpened Senses", kind: "arcanum", points: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    maxFromTrait: "resolve",
    passive: [{ op: "difficulty", amount: -1, trait: "perception" }],
    description: "Devil's Due: attunes preternatural awareness to unravel the hidden details and secrets of the world. Each purchase is a CUMULATIVE -1 to Perception difficulties (the points taken ARE the purchases). May not be purchased more times than the character's Resolve.",
  },
  {
    // The shape a printed "(7/5)" arcanum takes: one price per template, and a
    // template that gets a LESSER version says so in its own note.
    name: "Celestial Radiance", kind: "arcanum", points: 0,
    perTemplate: {
      demon: { cost: 7 },
      thrall: { cost: 5, note: "A thrall cannot generate effects greater than three successes." },
    },
    description: "Devil's Due: emit and control light by unveiling the burning power of the soul. Roll Resolve "
      + "(difficulty 8), +1 success per Resolve point spent; the successes buy parlor tricks, illusions and auras, "
      + "up to a battlefield-blinding flare at five (which needs Resolve 7+). Four successes need Resolve 5+.",
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
export type ConstraintDomain = "background" | "merit" | "flaw" | "meritflaw" | "any";
export type ConstraintRelation = "exclusive" | "restricted" | "forbidden";
export interface ConstraintGroup {
  name: string;                  // normalized group id
  relation: ConstraintRelation;
  domain: ConstraintDomain;      // which trait bucket the members live in
  members: string[];             // normalized trait names
  max?: number;                  // exclusive: at most N (default 1)
  scope?: string[];              // templates/choices it applies to (empty = everyone)
  note?: string;
}
export interface ConstraintViolation {
  group: string;
  relation: ConstraintRelation;
  detail: string;
}

// Exported so consumers (command specs, windows) reference THE vocabulary
// instead of retyping it - a new relation/domain reaches every surface.
export const CONSTRAINT_RELATIONS: ConstraintRelation[] = ["exclusive", "restricted", "forbidden"];
export const CONSTRAINT_DOMAINS: ConstraintDomain[] = ["background", "merit", "flaw", "meritflaw", "any"];

// Fill defaults and normalize. An unknown relation falls back to "exclusive",
// an unknown domain to "any" - a misconfigured group is still stored, never lost.
export function makeConstraintGroup(parts: Partial<ConstraintGroup> & { name: string }): ConstraintGroup {
  const relation = CONSTRAINT_RELATIONS.includes(parts.relation as ConstraintRelation) ? (parts.relation as ConstraintRelation) : "exclusive";
  const domain = CONSTRAINT_DOMAINS.includes(parts.domain as ConstraintDomain) ? (parts.domain as ConstraintDomain) : "any";
  const g: ConstraintGroup = {
    name: StringUtil.normalize(parts.name),
    relation,
    domain,
    members: asStringList(parts.members as CardValue).map(m => StringUtil.normalize(m)).filter(m => m.length > 0),
    scope: asStringList(parts.scope as CardValue).map(s => StringUtil.normalize(s)).filter(s => s.length > 0),
  };
  if (relation === "exclusive") g.max = Math.max(1, parts.max ?? 1);
  else if (parts.max !== undefined) g.max = parts.max;
  if (parts.note && parts.note.trim()) g.note = parts.note.trim();
  return g;
}

export function describeConstraint(g: ConstraintGroup): string {
  const bits = [`${g.name} [${g.relation}/${g.domain}${g.relation === "exclusive" ? ` max ${g.max ?? 1}` : ""}]`];
  bits.push(`{${g.members.map(m => StringUtil.toTitleCase(m)).join(", ")}}`);
  if (g.scope && g.scope.length) bits.push(`scope: ${g.scope.join(", ")}`);
  if (g.note) bits.push(`- ${g.note}`);
  return bits.join(" ");
}

// What a character owns, for checkConstraints. All names normalized.
export interface OwnedTraits {
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
export function checkConstraints(groups: ConstraintGroup[], owned: OwnedTraits): ConstraintViolation[] {
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
// --- RATING-SCALED AFFLICTIONS ---
// Some states are not flat flags: what "in my sanctum" GRANTS depends on the
// character's Sanctum Background rating, and the same holds for a Library. A
// scaled affliction names the trait it `scalesWith` and lists `tiers`; every
// tier at or below the rating contributes (the book: "these benefits are
// cumulative"). See foldAfflictionTiers for the one subtlety - how a wider
// tier absorbs a narrower one.
export interface AfflictionTier {
  atLeast: number;              // rating threshold this tier turns on at
  apply?: EffectOp[];           // roll ops (target = an action tag the roll must carry)
  note?: string;                // what it grants in prose (shown by [[afflictions]])
}

export interface AfflictionDef {
  name: string;                 // normalized id
  description?: string;
  bindings?: string[];          // required slot names, e.g. ["target"]
  duration?: EffectDuration;    // advisory until the turn system
  then?: string;                // successor affliction ([[advance]] applies it)
  mirror?: string;              // affliction auto-afflicted on bindings.target, bound back
  tags?: string[];              // tags granted while active
  note?: string;
  scalesWith?: string;          // the trait/Background whose rating selects tiers
  tiers?: AfflictionTier[];     // cumulative benefits by rating
  requiresAwakened?: boolean;   // tiers apply only to Awakened characters
}

// What a scaled affliction grants at `rating`: every tier at or below it, with
// ONE resolution rule - within an op kind, an UNTARGETED op supersedes targeted
// ops of the same kind. That is how a wider tier widens rather than stacks: a
// Sanctum 8's "-2 difficulty on ALL rolls" absorbs the "-1 on magic" of tiers 2
// and 3 instead of adding to them (the caster ends at -2, not -4).
export function foldAfflictionTiers(rating: number, tiers: AfflictionTier[] | undefined): { ops: EffectOp[]; notes: string[] } {
  const reached = (tiers ?? []).filter(t => rating >= t.atLeast);
  const all = reached.flatMap(t => t.apply ?? []);
  const widened = new Set(all.filter(o => !o.target).map(o => o.op.toLowerCase()));
  return {
    ops: all.filter(o => !(o.target && widened.has(o.op.toLowerCase()))),
    notes: reached.map(t => t.note).filter((n): n is string => !!n),
  };
}

// Normalize a definition: name/bindings/then/mirror/tags through normalize;
// empty optionals dropped.
export function makeAfflictionDef(parts: Partial<AfflictionDef> & { name: string }): AfflictionDef {
  const def: AfflictionDef = { name: StringUtil.normalize(parts.name) };
  if (parts.description && parts.description.trim()) def.description = parts.description.trim();
  const bindings = asStringList(parts.bindings as CardValue).map(b => StringUtil.normalize(b)).filter(b => b.length > 0);
  if (bindings.length) def.bindings = bindings;
  if (parts.duration) def.duration = parts.duration;
  if (parts.then && parts.then.trim()) def.then = StringUtil.normalize(parts.then);
  if (parts.mirror && parts.mirror.trim()) def.mirror = StringUtil.normalize(parts.mirror);
  const tags = asStringList(parts.tags as CardValue).map(t => StringUtil.normalize(t)).filter(t => t.length > 0);
  if (tags.length) def.tags = tags;
  if (parts.note && parts.note.trim()) def.note = parts.note.trim();
  if (parts.scalesWith && parts.scalesWith.trim()) def.scalesWith = StringUtil.normalize(parts.scalesWith);
  if (parts.tiers?.length) def.tiers = [...parts.tiers].sort((a, b) => a.atLeast - b.atLeast);
  if (parts.requiresAwakened) def.requiresAwakened = true;
  return def;
}

// "1 turn" / "2 scenes" / "until eye-contact-breaks" / "instant" -> the effect
// grammar's duration. Unparseable -> undefined (the def simply has no duration).
export function parseAfflictionDuration(raw: string | undefined): EffectDuration | undefined {
  if (!raw) return undefined;
  const t = StringUtil.normalize(raw);
  if (t === "instant") return { kind: "instant" };
  const until = t.match(/^until-(.+)$/);
  if (until) return { kind: "until", until: until[1] };
  const timed = t.match(/^(\d+)-(.+?)s?$/);
  if (timed) return { kind: "st", n: parseInt(timed[1], 10), unit: timed[2] };
  return undefined;
}

export function describeDuration(d: EffectDuration | undefined): string {
  if (!d) return "";
  if (d.kind === "instant") return "instant";
  if (d.kind === "until") return `until ${d.until}`;
  return `${d.n ?? 1} ${d.unit ?? d.kind}${(d.n ?? 1) === 1 ? "" : "s"}`;
}

export function describeAfflictionDef(d: AfflictionDef): string {
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
export const DEFAULT_AFFLICTIONS: AfflictionDef[] = [
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
  // The spirit-world flag: nothing grants passage yet, but the gate exists -
  // recovery rules with `requires: "in-umbra"` (an extra Living Resolve /
  // Quintessence point per day) check for this affliction. [[afflict in-umbra]]
  // when the character crosses; [[lift]] when they return.
  makeAfflictionDef({
    name: "in-umbra",
    description: "Walking the spirit world, flesh and all",
    tags: ["in-umbra"],
  }),
  // The rest gates: recovery rules requiring BOTH at once ("full-rested" AND
  // "in-sanctum") grant the extra daily point of Living Resolve / Quintessence.
  makeAfflictionDef({
    name: "full-rested",
    description: "Eight full hours of sleep behind them",
    tags: ["full-rested"],
  }),
  // THE SANCTUM - the exemplar rating-scaled affliction. What being here grants
  // depends on the character's Sanctum Background; the benefits are cumulative,
  // and a wider tier absorbs the narrower one it supersedes (see
  // foldAfflictionTiers). Ratings 6-8 continue the book's table past 5.
  makeAfflictionDef({
    name: "in-sanctum",
    description: "Within their own sanctum, where their Aura and the place's power mesh. "
      + "At ANY rating the mage is immune to Backlash here.",
    tags: ["in-sanctum"],
    scalesWith: "sanctum",
    requiresAwakened: true,
    tiers: [
      { atLeast: 1, note: "immune to Backlash" },
      { atLeast: 2, apply: [{ op: "difficulty", amount: -1, target: "magic" }] },
      { atLeast: 3, apply: [{ op: "difficulty", amount: -1, target: "magic" }] },
      { atLeast: 4, note: "regain 1 Quintessence by sleeping eight hours here" },
      // "@foundation" is the caster's Foundation trait, whatever their
      // fellowship calls it - resolved at roll time.
      { atLeast: 5, apply: [{ op: "dice", amount: 1, trait: "@foundation" }], note: "you know of any incursion onto your lands" },
      { atLeast: 6, apply: [{ op: "difficulty", amount: -2 }], note: "the -2 widens to every roll, not just magic" },
      { atLeast: 7, apply: [{ op: "successes", amount: 1, target: "magic" }] },
      { atLeast: 8, apply: [{ op: "successes", amount: 1 }], note: "the automatic success widens to every roll" },
    ],
  }),
  // THE LIBRARY - physical sources of knowledge. Its benefits are rolls you
  // make ([[research]]), not passive dice, so the tiers are prose; the rating
  // is the pool.
  makeAfflictionDef({
    name: "in-library",
    description: "Among their books and scrolls - [[research]] rolls Intelligence + Library here. "
      + "(Spending experience on a Pillar may also be reduced 1 per success on a Library roll vs 8 - "
      + "awaiting the experience system.)",
    tags: ["in-library"],
    scalesWith: "library",
    requiresAwakened: true,
    tiers: [
      { atLeast: 1, note: "an incomplete book or a partly burned scroll" },
      { atLeast: 2, note: "a book handwritten by a knowledgeable source... you hope" },
      { atLeast: 3, note: "an inscribed cave wall, undisturbed for centuries" },
      { atLeast: 4, note: "a collection of illuminated manuscripts in fair condition" },
      { atLeast: 5, note: "truly impressive: any topic you research is probably at least mentioned" },
      { atLeast: 8, note: "the Library of the Unseen: no topic limits at all" },
    ],
  }),
  // A specialized corner of a library: a small sanctum devoted to one tradition,
  // sharpening every roll on its subject. Tag the roll `hermetic` to claim it.
  makeAfflictionDef({
    name: "in-rotunda",
    description: "In the rotunda of the Library of the Unseen - a Sanctum 5 of all things Hermetic",
    tags: ["in-rotunda"],
    tiers: [
      { atLeast: 0, apply: [
        { op: "difficulty", amount: -2, target: "hermetic" },
        { op: "successes", amount: 1, target: "hermetic" },
      ], note: "-2 difficulty and +1 automatic success on Hermetic matters (tag the roll `hermetic`)" },
    ],
  }),
];

// A lorebook data entry is a human-readable header, then a marker line of '='
// (>= 3), then the data. On read, everything above the marker is ignored - so
// the instructions live right in the entry card the player edits, no separate
// readme needed. Below the marker, '#' or '//' start a note on list entries.
export const SRD_HEADER_MARKER = "=====";
function srdEntryText(header: string[], body: string[]): string {
  return [...header, SRD_HEADER_MARKER, ...body].join("\n");
}
const __srdEditNote = "You may delete, rename or add lines below before you start playing.";

export interface SrdSeedEntry { displayName: string; text: string; }
export interface SrdCategorySpec { name: string; blurb: string; entries: SrdSeedEntry[]; }

export const SRD_CATEGORIES: SrdCategorySpec[] = [
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
        [`Backgrounds characters may buy at creation - one per line below the ${SRD_HEADER_MARKER} line.`,
         "Cray, Fount, Library, Sanctum and Talisman are the Awakened ones - a mage's places",
         "of power. Sanctum and Library have live mechanics (see the in-sanctum / in-library",
         "afflictions); a Cray is a real, drainable site ([[cray]], [[harvest]], [[absorb]]).",
         __srdEditNote],
        ["Allies", "Contacts", "Cray", "Domain", "Fount", "Generation", "Herd", "Influence",
         "Library", "Mentor", "Resources", "Retainers", "Sanctum", "Status", "Talisman"]) },
    ],
  },
  {
    name: "srd:merits-flaws",
    blurb: "custom Merits & Flaws, layered over the built-in list",
    entries: [
      { displayName: "srd:merits-flaws:custom", text: srdEntryText(
        [
          `Custom Merits, Flaws & arcana. Below the ${SRD_HEADER_MARKER} line, write each one as its`,
          "NAME followed by a colon, with its fields indented underneath. They are merged",
          "over the built-in list. The fields:",
          '  kind        - "merit" or "flaw" (required - a block without it is skipped)',
          "  points      - freebie cost (merit) / bonus (flaw); one number, or `1, 2, 3`",
          "                for a variable rating",
          "  requires    - optional, with any of: templates (any-of), tags (all-of),",
          "                merits-flaws (all-of)",
          "  description - optional text (commas in it are just punctuation)",
          "  passive     - optional always-on effects; see [[define-merit]]",
          "The two below are examples - edit or replace them.",
        ],
        [
          "Sturdy Stock:",
          "  kind: merit",
          "  points: 2",
          "  requires:",
          "    tags: revenant",
          "  description: Hardy revenant lineage.",
          "",
          "Illiterate:",
          "  kind: flaw",
          "  points: 1",
          "  description: You cannot read or write.",
        ]) },
    ],
  },
];
