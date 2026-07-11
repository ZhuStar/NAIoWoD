// =============================================================================
// RULES - the Dark Ages data: rulesets, soak tables, templates, disciplines,
// merits & flaws defaults, and the SRD lorebook seed. Data over logic.
// =============================================================================
import { StringUtil, MoralityPolarity } from "./core/traits";
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
// Ops with interpreters today: "difficulty" | "dice" | "successes" | "nagain"
// (roll modifiers; an optional `target` names an action tag the roll must
// carry), "increase" (raise a trait via the boost layer; `target` is a
// constraint - an attribute group, a record bucket, or a specific trait),
// "heal" (`target` = comma-separated severities or "all").
export interface EffectOp {
  op: string;
  target?: string;
  amount?: number;          // magnitude per effect unit (default 1)
  fillToCap?: boolean;      // one application raises/heals to the cap
  cap?: number | string;    // literal, or a pool expression ("stamina+3") on the character
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
  until?: string;           // kind "until": free-form condition
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
    effect: { label: "Willpower: +1 automatic success", apply: [{ op: "successes", amount: 1 }] },
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
    public readonly Reactions: DamageReaction[] = []
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
      effect: { label: "Quintessence: -1 casting difficulty per point", apply: [{ op: "difficulty", amount: -1 }] } },
  ],
  MAGE_SOAK,
  null, false   // Mages have no Road/Humanity and no Virtues
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
// (still alive: Road/Humanity, Virtues, mortal soak) plus a Blood pool they do
// NOT generate - it must be fed by their domitor, starting near-empty and
// holding up to 10, spendable one point per turn.
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
  MORTAL_SOAK,
  HUMANITY_MORALITY, true   // still human: Road/Humanity + Virtues
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

export const TEMPLATES: Record<string, TemplateConfig> = {
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

// The health track a character uses: the FIRST of its templates decides (same
// first-wins rule as resource numbers). No/unknown templates -> mortal.
export function healthLevelsForTemplates(keys: string[]): HealthLevelDef[] {
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
// top: any entry in the "srd:merits-flaws" category whose text is a JSON array
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
}

export const DEFAULT_MERITS_FLAWS: MeritFlawDef[] = [
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

const CONSTRAINT_RELATIONS: ConstraintRelation[] = ["exclusive", "restricted", "forbidden"];
const CONSTRAINT_DOMAINS: ConstraintDomain[] = ["background", "merit", "flaw", "meritflaw", "any"];

// Fill defaults and normalize. An unknown relation falls back to "exclusive",
// an unknown domain to "any" - a misconfigured group is still stored, never lost.
export function makeConstraintGroup(parts: Partial<ConstraintGroup> & { name: string }): ConstraintGroup {
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
