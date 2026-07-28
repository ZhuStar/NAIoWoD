// =============================================================================
// RULES - the Dark Ages data: rulesets, soak tables, templates, disciplines,
// merits & flaws defaults, and the SRD lorebook seed. Data over logic.
// =============================================================================
import { StringUtil, MoralityPolarity } from "./core/traits";
import {
  CardValue, CardMap, asMap, asList, asText, asNumber, asBool, asStringList,
} from "./core/cardtext";
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
// Ghouls and revenants, though alive, soak like the half-vampires they are:
// bashing & lethal with Stamina (+Fortitude), aggravated with Fortitude alone.
// The rules just say so - the vitae in their veins does the knitting.
export const GHOUL_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina", "fortitude"] },
  lethal: { soakable: true, pool: ["stamina", "fortitude"] },
  aggravated: { soakable: true, pool: ["fortitude"] },
  difficulty: 6,
};
// Mages innately soak like mortals (their real defence is magic, not modelled).
export const MAGE_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: false, pool: [] },
  aggravated: { soakable: false, pool: [] },
  difficulty: 6,
};
// Demons (manifested) soak all three with Stamina.
export const DEMON_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: true, pool: ["stamina"] },
  aggravated: { soakable: true, pool: ["stamina"] },
  difficulty: 6,
};
// Werewolves regenerate: they soak every severity with Stamina and shrug off
// most punishment outright. Silver and fire are the exception - the
// SilverVulnerability reaction marks those packets Unsoakable, so this generous
// spec never even gets consulted for them.
export const WEREWOLF_SOAK: SoakSpec = {
  bashing: { soakable: true, pool: ["stamina"] },
  lethal: { soakable: true, pool: ["stamina"] },
  aggravated: { soakable: true, pool: ["stamina"] },
  difficulty: 6,
};

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
    public readonly Awakened: boolean = false
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
  HUMANITY_MORALITY, true
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
  [new UndeadPhysiology()]   // bullets & blades to bashing; fire/sunlight stay aggravated
);

// Dark Ages: Mage works magic through Foundation & Pillars (its answer to the
// Spheres), which live with the not-yet-modelled powers, not as a pool. The
// only pool is Quintessence; this line has no Paradox.
export const TEMPLATE_MAGE = new TemplateConfig(
  "Mage (Dark Ages)",
  RulesetConfig.MAGE,
  [
    willpowerResource(5),
    { name: "quintessence", kind: "pool", start: 0, max: 20, roles: ["magic-fuel"],
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
  STANDARD_HEALTH_LEVELS, [], true   // Awakened
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
  { name: "Torment", polarity: "ascending", start: 3 }, false
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
  name: "living-resolve", kind: "pool", start: 30, max: 30, perTurnLimit: 6,
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
    // @deprecated The plain spend already carries the casting reduction (and
    // everything else). Kept so older saved rolls carrying spend=…:focus still
    // resolve; it is simply the default effect by another name.
    focus: {
      label: "Living Resolve focuses the casting (an alias of the plain spend - deprecated)",
      apply: [
        { op: "uncancelable", amount: 1 },
        { op: "successes", amount: 1 },
        { op: "nagain", amount: 8 },
        { op: "difficulty", amount: -2 },
        { op: "difficulty", amount: -1, target: "magic" },
      ],
    },
  },
};

// THE OUROBOROS - a UNIQUE template: the one creature in the world carrying
// Living Resolve. Revenant + laham (Devil's Due demon-blooded, whence the
// Resolve) + Awakened mage (Order of Hermes), created by a powerful witch in a
// ritual involving Belial, the Great Beast. Still alive and human-souled
// (Road/Humanity + Virtues), ghoul soak, and ONE pool - the fusion itself,
// which answers to blood/willpower/resolve/quintessence by name and role.
// His Foundation is Modus (see FELLOWSHIPS); Pillars: Anima/Corona/Primus/Vires.
export const TEMPLATE_OUROBOROS = new TemplateConfig(
  "Ouroboros (unique: revenant + laham + Awakened)",
  RulesetConfig.MAGE,
  [LIVING_RESOLVE],
  GHOUL_SOAK,
  // Like a mage: the ritual burned the Road away. No morality, no Virtues.
  null, false,
  STANDARD_HEALTH_LEVELS, [], true   // Awakened
);

export const TEMPLATES: Record<string, TemplateConfig> = {
  mortal: TEMPLATE_MORTAL,
  thrall: TEMPLATE_THRALL,
  vampire: TEMPLATE_VAMPIRE,
  mage: TEMPLATE_MAGE,
  demon: TEMPLATE_DEMON,
  werewolf: TEMPLATE_WEREWOLF,
  ghoul: TEMPLATE_GHOUL,
  revenant: TEMPLATE_REVENANT,
  ouroboros: TEMPLATE_OUROBOROS,
  sorcerer: TEMPLATE_SORCERER,
};

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
  foundation: string;                 // the Foundation TRAIT name
  foundationGloss?: string;
  pillars: Record<string, string>;    // pillar trait name -> gloss
}

export const FELLOWSHIPS: Record<string, Fellowship> = {
  "order-of-hermes": {
    name: "Order of Hermes",
    foundation: "modus",
    foundationGloss: "the Ouroboros - knowledge begets discipline and focus, which begets more knowledge",
    pillars: { anima: "life", corona: "mind", primus: "magic itself", vires: "forces" },
  },
};

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
  pillar: { experience: "current x 7", freebie: "7", maturation: "current x 7" },
  foundation: { experience: "current x 8", freebie: "10", maturation: "current x 8" },
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
export const ROLL_KNOB_NAMES = ["min-difficulty"];
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
export type MeritFlawKind = "merit" | "flaw";
export interface MeritFlawRequirements {
  templates?: string[];   // met if the character's template matches ANY listed
  tags?: string[];        // ALL listed tags must be present on the character
  meritsFlaws?: string[]; // ALL listed merits/flaws must already be taken
}
export interface MeritFlawDef {
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
  // The rating ceiling is a TRAIT, not a constant: "may not be purchased more
  // times than his Resolve". The name is resolved the way every trait name is
  // (a rated trait first, else the resource that fills or replaced that name -
  // so a character whose Resolve IS Living Resolve is capped by that), and the
  // reading is the PERMANENT rating, never the spent-down current.
  maxFromTrait?: string;
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
  const kind = (asText(body["kind"]) ?? "").toLowerCase();
  if (kind !== "merit" && kind !== "flaw") return undefined;
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
  const atMostOneAt = asNumber(body["atMostOneAt"]);
  if (atMostOneAt !== undefined) def.atMostOneAt = atMostOneAt;
  const maxFromTrait = asText(body["maxFromTrait"]);
  if (maxFromTrait) def.maxFromTrait = StringUtil.normalize(maxFromTrait);
  return def;
}

export const DEFAULT_MERITS_FLAWS: MeritFlawDef[] = [
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
  {
    name: "Sharpened Senses", kind: "merit", points: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    maxFromTrait: "resolve",
    passive: [{ op: "difficulty", amount: -1, trait: "perception" }],
    description: "Devil's Due: attunes preternatural awareness to unravel the hidden details and secrets of the world. Each purchase is a CUMULATIVE -1 to Perception difficulties (the points taken ARE the purchases). May not be purchased more times than the character's Resolve.",
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
