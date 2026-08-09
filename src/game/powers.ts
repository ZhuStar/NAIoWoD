// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { ParsedCommand, flagOf, sys } from "../command";
import { BusHandler, SYSTEM } from "../core/bus";
import { CardMap, asNamedList, parseCardText } from "../core/cardtext";
import { ExprScope, evaluateExpr } from "../core/expr";
import { addDuration, formatStoryDate, parseDuration } from "../core/time";
import { StringUtil } from "../core/traits";
import { AFFLICTION_ROLES, AFFLICTION_ROLE_KEYS, ALL_TRAIT_CATEGORIES, ARCANA_CAPABILITY, ARCANUM_KINDS, AfflictionDef, AfflictionExpiry, AfflictionLift, ArcanumDef, ConstraintDomain, ConstraintRelation, EffectOp, InstanceLimit, LIFT_POLICIES, MERIT_FLAW_KINDS, MeritFlawDef, MeritFlawRequirements, OrphanPolicy, OwnedPowerDef, OwnedPowerKind, OwnedTraits, PassiveGrant, SRD_HEADER_MARKER, TemplateVariant, afflictionRole, arcanumFromCard, budgetOfKind, capabilitiesOpenArcana, checkConstraints, clanFamilyOf, describeAfflictionDef, describeConstraint, describeDuration, describeExpiry, describeLift, describeOrphanPolicy, describePassiveOp, disciplineDef, expiryElapsed, expiryIsAdvisoryOnly, foldAfflictionTiers, grantBindings, grantIsAutomatic, grantLevel, instanceLimitsOf, isArcanumKind, isAwakened, isTraitCategory, kindSpends, makeAfflictionDef, makeAfflictionExpiry, makeConstraintGroup, makeOrphanPolicy, meritCostFor, meritFlawFromCard, parseAfflictionDuration, parsePassiveOps, passiveOpsOf, resolvePowerInstance, singularCategory, withAfflictionRole } from "../rules";
import { ArcanumRegistry, Bus, LorebookManager, MeritFlawRegistry, PostOffice, configEntryText, namedDefsToCard } from "../services";
import { ActiveAffliction, AfflictionRegistry, CharacterAfflictions, CharacterCooldowns, CharacterResources, CharacterStore, ConstraintRegistry, OwnedPowerInstance, PlayableCharacter, StoryClock, effectiveTraitOf, enhancementsFor, ownedArcanumInstances, ownedMeritInstances, ownedPowerInstances, permanentRatingOf, resolveAffliction, resolveTraitFromRecord, traitCategoryOf, traitInCategory, traitKindsOf, traitsInCategory } from "../state";
import { resolveCharacterRef } from "./afflictions";
import { disp, intOrUndef, isRollOp, noCharacter } from "./common";
import { NO_CLOCK, afflictionEnded, expiryCondition, timedScope } from "./time";

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
    const def = resolvePowerInstance(name, n => MeritFlawRegistry.get(n))?.def ?? MeritFlawRegistry.get(name);
    (def && def.kind === "flaw" ? flaws : merits).push(StringUtil.normalize(name));
  }
  return {
    backgrounds: Object.keys(char.backgrounds).map(n => StringUtil.normalize(n)),
    merits,
    flaws,
    // Their own list, so a constraint over an arcanum matches an arcanum and a
    // constraint over merits never accidentally catches one.
    arcana: Object.keys(char.arcana ?? {}).map(n => StringUtil.normalize(n)),
    templates: (char.templates ?? []).map(t => StringUtil.normalize(t)),
  };
}

export async function cmdDefineConstraint(cmd: ParsedCommand): Promise<string> {
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

export async function cmdConstraints(): Promise<string> {
  const all = ConstraintRegistry.all();
  if (!all.length) return sys(`No constraint groups defined. Add one with [[define-constraint ...]] or [[win-constraint]].`);
  const items = all.map(g => `${g.name} (${g.relation}/${g.domain}, ${g.members.length} member${g.members.length === 1 ? "" : "s"})`).join("; ");
  return sys(`Constraint groups: ${items}. [[show-constraint <name>]] for detail.`);
}

export async function cmdConstraint(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`constraint needs a name, e.g. [[show-constraint clan-only-backgrounds]]. [[show-constraint]] lists them.`);
  const g = ConstraintRegistry.get(name);
  if (!g) return sys(`No constraint group "${StringUtil.normalize(name)}". See [[show-constraint]].`);
  return sys(`${describeConstraint(g)}.`);
}

export async function cmdForgetConstraint(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`forget-constraint needs a name, e.g. [[forget-constraint clan-only-backgrounds]].`);
  const key = StringUtil.normalize(name);
  return (await ConstraintRegistry.remove(key))
    ? sys(`Forgot constraint group "${key}".`)
    : sys(`No constraint group "${key}".`);
}

export async function cmdCheckConstraints(forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
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

// A def whose rating ceiling is a TRAIT ("no more purchases than his Resolve"),
// resolved against this character - undefined when the def has no such cap.
// The name resolves through resources too, so the Ouroboros is capped by his
// Living Resolve without the def having to know that.
function meritTraitCeiling(char: PlayableCharacter, def: OwnedPowerDef): { trait: string; cap: number } | undefined {
  if (!def.maxFromTrait) return undefined;
  const trait = StringUtil.normalize(def.maxFromTrait);
  return { trait, cap: permanentRatingOf(char, trait) };
}

// Which instances of `def` would sit at or above a limit's rating, if `pending`
// were also taken. Returns one complaint per limit that would be broken - by
// total slots, or by how many of a KIND fill them.
function instanceLimitBreaches(
  char: PlayableCharacter, def: OwnedPowerDef, pending?: { key: string; points: number },
): string[] {
  const limits = instanceLimitsOf(def);
  if (!limits.length) return [];
  // Same name AND same category: two registries may legitimately hold a def of
  // the same name, and one category's instances never fill the other's slots.
  const held = ownedPowerInstances(char)
    .filter(i => StringUtil.normalize(i.def.name) === StringUtil.normalize(def.name)
      && isArcanumKind(i.def.kind) === isArcanumKind(def.kind)
      && i.key !== pending?.key)
    .map(i => ({ label: i.param ?? i.key, points: i.points }));
  if (pending) held.push({ label: pending.key.includes(":") ? pending.key.slice(pending.key.lastIndexOf(":") + 1) : pending.key, points: pending.points });

  const out: string[] = [];
  const name = StringUtil.normalize(def.name);
  for (const limit of limits) {
    const at = held.filter(h => h.points >= limit.atRating);
    if (at.length > limit.slots) {
      out.push(`${name} allows ${limit.slots} trait${limit.slots === 1 ? "" : "s"} at ${limit.atRating} `
        + `(have ${at.length}: ${at.map(h => h.label).join(", ")})`);
    }
    for (const [rawKind, allowed] of Object.entries(limit.perKind ?? {})) {
      // "at most one of them an Attribute" counts by KIND; "at most one a
      // Knowledge" counts by CATEGORY. A limit may be written either way.
      const kind = singularCategory(rawKind);
      const ofKind = at.filter(h => traitKindsOf(char, h.label).includes(kind));
      if (ofKind.length > allowed) {
        out.push(`${name} allows ${allowed} ${kind}${allowed === 1 ? "" : "s"} at ${limit.atRating} `
          + `(have ${ofKind.length}: ${ofKind.map(h => h.label).join(", ")})`);
      }
    }
  }
  return out;
}

// Advisory owned-power findings: unknown/malformed keys and instance-limit
// violations ("one favoured trait" caps). Reported, never enforced - the
// creation engine will enforce. Walks BOTH buckets, and names the bucket a
// stray key sits in, because "unknown merit/flaw" is a bad thing to say about
// an arcanum somebody typed into the wrong list.
function meritInstanceFindings(char: PlayableCharacter): string[] {
  const findings: string[] = [];
  const known = new Set<string>();
  const checkedDefs = new Set<string>();
  for (const inst of ownedPowerInstances(char)) {
    known.add(inst.key);
    // The ceiling is a trait, so it can MOVE: a Resolve that drops leaves the
    // purchases stranded above it. Reported, never silently trimmed.
    const ceiling = meritTraitCeiling(char, inst.def);
    if (ceiling && inst.points > ceiling.cap) {
      findings.push(`${StringUtil.normalize(inst.def.name)} is at ${inst.points} but ${ceiling.trait} is only ${ceiling.cap}`);
    }
    // Cross-instance limits are about the DEF, so ask each one once.
    const defKey = StringUtil.normalize(inst.def.name);
    if (!checkedDefs.has(defKey)) {
      checkedDefs.add(defKey);
      findings.push(...instanceLimitBreaches(char, inst.def));
    }
  }
  for (const key of Object.keys(char.meritsFlaws)) {
    const k = StringUtil.normalize(key);
    if (known.has(k)) continue;
    // It may be an arcanum somebody filed as a merit - the registry knows, and
    // saying so is more use than "unknown".
    const asArcanum = resolvePowerInstance(k, n => ArcanumRegistry.get(n));
    findings.push(asArcanum
      ? `"${k}" is an ${asArcanum.def.kind}, not a merit or flaw - [[take-arcanum ${k}]] files it right`
      : `unknown merit/flaw "${k}"`);
  }
  for (const key of Object.keys(char.arcana ?? {})) {
    const k = StringUtil.normalize(key);
    if (known.has(k)) continue;
    const asMerit = resolvePowerInstance(k, n => MeritFlawRegistry.get(n));
    findings.push(asMerit
      ? `"${k}" is a ${asMerit.def.kind}, not an arcanum or taint - [[take-merit ${k}]] files it right`
      : `unknown arcanum/taint "${k}"`);
  }
  // A pool start naming a resource the templates don't grant: a hand-edited
  // card can give a mage a "Resolve" he cannot have, and every trait lookup
  // would then find it. The same phantom the Willpower seeding guards against,
  // caught on the way in from the lorebook.
  for (const name of Object.keys(char.poolStarts ?? {})) {
    if (!CharacterResources.resolveDef(char, name)) {
      findings.push(`pool "${StringUtil.normalize(name)}" is not granted by ${char.templates.join("+")} - `
        + `trait lookups will still find it`);
    }
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
  // A choice, not a template: what only a Nosferatu or only a Valdaermen may
  // have. A clan matches by CLAN, so all three Assamite castes pass an
  // Assamite-exclusive gate.
  for (const [what, want] of Object.entries(req.choices ?? {})) {
    const key = StringUtil.normalize(what);
    const has = StringUtil.normalize(char.choices?.[key] ?? "");
    const asked = StringUtil.normalize(want);
    const met = key === "clan" ? has !== "" && clanFamilyOf(has) === clanFamilyOf(asked) : has === asked;
    if (!met) missing.push(`${key}:${asked}`);
  }
  return missing;
}

// =============================================================================
// TWO FAMILIES OF OWNED POWER - one mechanism, two categories that never mix
// -----------------------------------------------------------------------------
// Merits & Flaws and Arcana & Taints are handled by the SAME code and are NOT
// THE SAME THING. The difference is a `PowerFamily`: which registry answers a
// name, which lorebook category holds the custom ones, which bucket on the
// sheet owns the instances, which verbs to name in a reply - and, for arcana,
// which capability a character must have before the list is open to him at all.
//
// This is why [[define-merit]] CANNOT define an arcanum: it is not a check it
// forgets to make, it is a different family object with different kinds, a
// different registry and a different card. And it is why a regular vampire's
// [[show-merit]] shows no Arcana: they were never in that list.
// =============================================================================
export interface PowerFamily<T extends OwnedPowerDef> {
  kinds: readonly OwnedPowerKind[];
  defaultKind: OwnedPowerKind;
  registry: {
    get(name: string): T | undefined;
    all(): T[];
    register(def: T): void;
    reset(): void;
    loadFromLorebook(): Promise<number>;
  };
  category: string;
  entry: string;
  read(name: string, body: CardMap): T | undefined;
  // Where this family's instances live on the sheet. `ensure` creates the
  // bucket (arcana is absent on the sheets that have none).
  bucket(char: PlayableCharacter): Record<string, number>;
  ensureBucket(char: PlayableCharacter): Record<string, number>;
  instances(char: PlayableCharacter): Array<OwnedPowerInstance<T>>;
  one: string;              // "merit/flaw" - what one of them is, in a message
  aOne: string;             // ...with its article ("a merit/flaw", "an arcanum/taint")
  many: string;             // "Merits & Flaws" - the list's name
  verbs: { define: string; forget: string; take: string; drop: string; list: string; info: string };
  // The capability that opens this list, if any. Merits are open to everyone.
  requires?: string;
  requiresNote?: string;
  cardHeader: string[];
  // The other family, so every "wrong drawer" message can point somewhere.
  other(): PowerFamily<OwnedPowerDef>;
}

const MERITS_CATEGORY = "srd:merits-flaws";
const MERITS_CUSTOM_ENTRY = "srd:merits-flaws:custom";
const ARCANA_CATEGORY = "srd:arcana";
const ARCANA_CUSTOM_ENTRY = "srd:arcana:custom";

export const MERIT_FAMILY: PowerFamily<MeritFlawDef> = {
  kinds: MERIT_FLAW_KINDS,
  defaultKind: "merit",
  registry: MeritFlawRegistry,
  category: MERITS_CATEGORY,
  entry: MERITS_CUSTOM_ENTRY,
  read: meritFlawFromCard,
  bucket: char => char.meritsFlaws ?? {},
  ensureBucket: char => (char.meritsFlaws ??= {}),
  instances: ownedMeritInstances,
  one: "merit/flaw",
  aOne: "a merit/flaw",
  many: "Merits & Flaws",
  verbs: { define: "define-merit", forget: "forget-merit", take: "take-merit", drop: "drop-merit", list: "show-merit", info: "show-merit" },
  cardHeader: [
    `Custom Merits & Flaws. Below the ${SRD_HEADER_MARKER} line each one is its NAME,`,
    "with its fields indented under it; the list is merged over the built-ins.",
    "[[define-merit]] writes this for you; hand-editing is equally fine. The fields:",
    "kind (merit|flaw), points (a number, or `1, 2, 3`), param, passive (always-on",
    "ops), requires, limit-at/limit-slots, description.",
    "Arcana and Taints are NOT merits - they live in srd:arcana ([[define-arcanum]]).",
  ],
  other: () => ARCANUM_FAMILY as unknown as PowerFamily<OwnedPowerDef>,
};

export const ARCANUM_FAMILY: PowerFamily<ArcanumDef> = {
  kinds: ARCANUM_KINDS,
  defaultKind: "arcanum",
  registry: ArcanumRegistry,
  category: ARCANA_CATEGORY,
  entry: ARCANA_CUSTOM_ENTRY,
  read: arcanumFromCard,
  bucket: char => char.arcana ?? {},
  ensureBucket: char => (char.arcana ??= {}),
  instances: ownedArcanumInstances,
  one: "arcanum/taint",
  aOne: "an arcanum/taint",
  many: "Arcana & Taints",
  verbs: { define: "define-arcanum", forget: "forget-arcanum", take: "take-arcanum", drop: "drop-arcanum", list: "show-arcanum", info: "show-arcanum" },
  requires: ARCANA_CAPABILITY,
  requiresNote: "Arcana belong to the infernal: a demon has them, and so does anyone at all "
    + "who has become a demon's thrall. Nobody else has this list open.",
  cardHeader: [
    `Custom Arcana & Taints (Dark Ages: Devil's Due). Below the ${SRD_HEADER_MARKER} line each one`,
    "is its NAME, with its fields indented under it; merged over the built-ins.",
    "AN ARCANUM IS NOT A MERIT: its own category, its own purse, and open only to",
    "characters bound to the infernal. [[define-arcanum]] writes this for you. Fields:",
    "kind (arcanum|taint), points (a number, or `1, 2, 3`), per-template, param,",
    "passive, requires, limit-at/limit-slots, description.",
  ],
  other: () => MERIT_FAMILY as unknown as PowerFamily<OwnedPowerDef>,
};

// The family a name belongs to, whichever registry knows it - for the "you
// asked the wrong verb" replies, and for nothing else.
function familyOwning(key: string): PowerFamily<OwnedPowerDef> | undefined {
  const k = StringUtil.normalize(key);
  if (resolvePowerInstance(k, n => MeritFlawRegistry.get(n))) return MERIT_FAMILY as unknown as PowerFamily<OwnedPowerDef>;
  if (resolvePowerInstance(k, n => ArcanumRegistry.get(n))) return ARCANUM_FAMILY as unknown as PowerFamily<OwnedPowerDef>;
  return undefined;
}

// Is this list open to this character at all? A family with no `requires` is
// open to everyone (Merits and Flaws are). Returns the refusal, or undefined.
function familyClosedTo(char: PlayableCharacter, family: PowerFamily<OwnedPowerDef>): string | undefined {
  if (!family.requires) return undefined;
  if (capabilitiesOpenArcana(CharacterResources.capabilities(char))) return undefined;
  return `${disp(char.name)} (${char.templates.join("+")}) has no ${family.many} at all. `
    + `${family.requiresNote ?? ""} `
    + `Add the template, [[attune ${family.requires}]] if this chronicle says otherwise, or waive=true for one purchase.`;
}

// --- THE CUSTOM-DEFINITION OVERLAY -------------------------------------------
// Each family's custom definitions live in its own lorebook category
// (name-keyed blocks merged over the built-ins). These commands write it for
// you; hand-editing the card stays equally valid.
async function customDefs<T extends OwnedPowerDef>(family: PowerFamily<T>): Promise<T[]> {
  const text = await LorebookManager.entryText(family.category, family.entry);
  const parsed = parseCardText(LorebookManager.contentBelowHeader(text ?? "").trim());
  return asNamedList(parsed)
    .map(({ name, body }) => family.read(name, body))
    .filter((d): d is T => d !== undefined);
}

async function writeCustomDefs<T extends OwnedPowerDef>(family: PowerFamily<T>, defs: T[]): Promise<void> {
  const text = configEntryText(family.cardHeader, namedDefsToCard(defs));
  const { id } = await LorebookManager.ensureCategory(family.category);
  const created = await LorebookManager.ensureEntry(id, family.entry, text);
  if (!created) await LorebookManager.updateEntryText(family.category, family.entry, text);
  await family.registry.loadFromLorebook();
}

// define-merit name="Inviolate Soul" points=0 description=`…`
//   passive="immune:possession,soul-control; immune:fear,mind-control while=living-resolve"
// ...and define-arcanum, which is the same code over the other family.
async function defineOwnedPower<T extends OwnedPowerDef>(cmd: ParsedCommand, family: PowerFamily<T>): Promise<string> {
  const rawName = cmd.named["name"] ?? cmd.positional[0];
  if (!rawName?.trim()) {
    return sys(`${family.verbs.define} needs a name, e.g. [[${family.verbs.define} name=\`Inviolate Soul\` points=0 `
      + "passive=`immune:possession; immune:fear while=living-resolve` description=`…`]]. "
      + 'Passives read "<op>[:<target>] [+N|-N] [if=<trait>] [while=<resource>[>=N]] [once]", ";"-separated '
      + "(or a raw ops array in JSON). Use BACKTICKS for name/passive/description - a quoted value is normalized (spaces become hyphens).");
  }
  const name = rawName.trim();
  const kindRaw = (cmd.named["kind"] ?? family.defaultKind).toLowerCase() as OwnedPowerKind;
  // THE STRUCTURAL REFUSAL. define-merit cannot make an arcanum and
  // define-arcanum cannot make a merit - not because either forgets to check,
  // but because a family holds the kinds it holds and no others.
  if (!family.kinds.includes(kindRaw)) {
    const elsewhere = family.other();
    return elsewhere.kinds.includes(kindRaw)
      ? sys(`"${kindRaw}" is not ${family.aOne}. ${elsewhere.many} are a different category - `
        + `a different list, a different purse, and not open to every character. `
        + `Use [[${elsewhere.verbs.define} name=\`${name}\` kind=${kindRaw}]].`)
      : sys(`kind must be one of ${family.kinds.join(", ")} (got "${kindRaw}").`);
  }

  // points: a single number or a "1,2,3" ladder of allowed ratings.
  const pointsRaw = (cmd.named["points"] ?? "0").trim();
  const ladder = pointsRaw.split(",").map(p => parseInt(p.trim(), 10));
  if (ladder.some(n => Number.isNaN(n))) return sys(`points must be a number or a list like "1,2,3" (got "${pointsRaw}").`);
  const points: number | number[] = ladder.length === 1 ? ladder[0] : ladder;

  const def = { name, kind: kindRaw, points } as T;
  if (cmd.named["description"]?.trim()) def.description = cmd.named["description"].trim();
  if (cmd.named["param"]?.trim()) def.param = StringUtil.normalize(cmd.named["param"]);
  const budget = (cmd.named["budget"] ?? "").trim();
  if (budget) def.budget = StringUtil.normalize(budget);
  // per-template="demon:7,thrall:5,mortal:no" - a price each, or `no` for a
  // template the definition is closed to.
  const perTemplateRaw = (cmd.named["per-template"] ?? "").trim();
  if (perTemplateRaw) {
    const variants: Record<string, TemplateVariant> = {};
    for (const pair of perTemplateRaw.split(",").map(x => x.trim()).filter(Boolean)) {
      const [rawT, rawV] = pair.split(":");
      if (!rawT) continue;
      const t = StringUtil.normalize(rawT);
      const v = (rawV ?? "").trim().toLowerCase();
      if (v === "no" || v === "none" || v === "false") variants[t] = { available: false };
      else { const n = intOrUndef(v); if (n !== undefined) variants[t] = { cost: n }; }
    }
    if (Object.keys(variants).length) def.perTemplate = variants;
  }
  const limitAt = intOrUndef(cmd.named["limit-at"] ?? "");
  if (limitAt !== undefined) {
    const limit: InstanceLimit = { atRating: limitAt, slots: intOrUndef(cmd.named["limit-slots"] ?? "") ?? 1 };
    const perKind: Record<string, number> = {};
    for (const pair of (cmd.named["limit-per-kind"] ?? "").split(",").map(x => x.trim()).filter(Boolean)) {
      const [kind, n] = pair.split(":");
      const v = intOrUndef(n ?? "");
      if (kind && v !== undefined) perKind[StringUtil.normalize(kind)] = v;
    }
    if (Object.keys(perKind).length) limit.perKind = perKind;
    def.limits = [limit];
  }
  const maxFromTrait = (cmd.named["max-from-trait"] ?? "").trim();
  if (maxFromTrait) def.maxFromTrait = StringUtil.normalize(maxFromTrait);
  const paramFrom = (cmd.named["param-from"] ?? "").trim();
  if (paramFrom) {
    if (!isTraitCategory(paramFrom)) {
      return sys(`param-from names a trait category - one of ${ALL_TRAIT_CATEGORIES.join(", ")} (got "${paramFrom}").`);
    }
    def.paramFrom = singularCategory(paramFrom);
  }
  if (cmd.named["passive"]?.trim()) {
    const raw = cmd.named["passive"];
    // A quoted (not backticked) value came through the boundary normalizer, so
    // its spaces are now hyphens - say so rather than parsing nonsense.
    if (/-(?:if|while|on|target|amount|once)\b/.test(raw)) {
      return sys("passive= lost its spaces to normalization - wrap it in BACKTICKS: "
        + "passive=`immune:fear while=living-resolve`.");
    }
    const ops = parsePassiveOps(raw);
    if ("error" in ops) return sys(ops.error);
    def.passive = ops;
  }
  const templates = (cmd.named["templates"] ?? "").split(",").map(t => StringUtil.normalize(t)).filter(Boolean);
  if (templates.length) def.requires = { templates };

  // WHAT TAKING IT TURNS ON. A built-in merit could declare a PassiveGrant and
  // a chronicle's could not, which made "simple merits should be able to define
  // the passive affliction they grant" impossible to say in a command.
  //   grants=<affliction> [grants-mode=automatic|offered] [grants-togglable]
  //   [grants-orphan=<policy>]
  // If the affliction does not exist yet, it is CREATED from this definition -
  // a simple merit is one command, not two - and the reply says so.
  let seeded = "";
  const grantsRaw = (cmd.named["grants"] ?? "").trim();
  if (grantsRaw) {
    // An OLDER name is filed under the current one, so a definition written
    // against last week's name does not preserve it forever.
    const asked = StringUtil.normalize(grantsRaw);
    const afflicts = resolveAffliction(asked)?.name ?? asked;
    const grant: PassiveGrant = { afflicts };
    const mode = StringUtil.normalize(cmd.named["grants-mode"] ?? "");
    if (mode === "offered" || mode === "automatic") grant.mode = mode;
    if (flagOf(cmd, "grants-togglable") === true) grant.togglable = true;
    const orphan = (cmd.named["grants-orphan"] ?? "").trim();
    if (orphan) grant.orphan = orphan;
    def.grants = grant;
    if (!resolveAffliction(afflicts)) {
      // No `tags`: a tag is a thing a ROLL carries, and one nobody has written
      // a modifier for is reported as unknown on every roll the character makes.
      // A merit's passive is a STATE. [[define-affliction]] adds tags if the
      // chronicle wants them to bite.
      await AfflictionRegistry.put(makeAfflictionDef({
        name: afflicts,
        description: def.description ?? `Applied while ${name} is held.`,
      }));
      seeded = ` Affliction "${afflicts}" did not exist, so it was defined too ([[define-affliction]] to flesh it out).`;
    }
  }

  const key = StringUtil.normalize(name);
  const defs = await customDefs(family);
  const existing = defs.findIndex(d => StringUtil.normalize(d.name) === key);
  const shadows = existing < 0 && family.registry.get(key) ? ` (shadowing the built-in "${key}")` : "";
  if (existing >= 0) defs[existing] = def; else defs.push(def);
  await writeCustomDefs(family, defs);

  const bits = [`${def.kind} "${name}"`, `${Array.isArray(points) ? `[${points.join(", ")}]` : points} point${points === 1 ? "" : "s"}`];
  if (def.param) bits.push(`parameterized by ${def.param}${def.paramFrom ? ` (must be a ${def.paramFrom})` : ""}`);
  if (def.passive?.length) bits.push(`passive: ${def.passive.map(describePassiveOp).join("; ")}`);
  if (def.grants) bits.push(`applies "${def.grants.afflicts}"${grantIsAutomatic(def.grants) ? "" : " when invoked"}${def.grants.togglable ? ", togglable" : ""}`);
  return sys(`${existing >= 0 ? "Redefined" : "Defined"} ${bits.join(", ")}${shadows}.${seeded} `
    + `Take it with [[${family.verbs.take} ${key}${def.param ? `::<${def.param}>` : ""}${Array.isArray(points) ? ` ${points[0]}` : ""}]].`);
}

async function forgetOwnedPower<T extends OwnedPowerDef>(cmd: ParsedCommand, family: PowerFamily<T>): Promise<string> {
  const raw = cmd.positional[0]?.trim() ?? cmd.named["name"]?.trim();
  if (!raw) return sys(`${family.verbs.forget} needs a name, e.g. [[${family.verbs.forget} inviolate-soul]].`);
  const key = StringUtil.normalize(raw);
  const defs = await customDefs(family);
  const rest = defs.filter(d => StringUtil.normalize(d.name) !== key);
  if (rest.length === defs.length) {
    if (family.registry.get(key)) return sys(`"${key}" is a built-in - it can be shadowed with [[${family.verbs.define}]] but not deleted.`);
    const elsewhere = familyOwning(key);
    return elsewhere
      ? sys(`"${key}" is ${elsewhere.aOne}, not ${family.aOne}. Use [[${elsewhere.verbs.forget} ${key}]].`)
      : sys(`No custom ${family.one} "${key}".`);
  }
  await writeCustomDefs(family, rest);
  family.registry.reset();
  await family.registry.loadFromLorebook();
  const shipped = family.registry.get(key) ? ` The built-in "${key}" resurfaces.` : "";
  return sys(`Forgot custom ${key}.${shipped}`);
}

// merit [name] / arcanum [name] - list the definitions, or inspect one in full.
async function ownedPowerInfo<T extends OwnedPowerDef>(cmd: ParsedCommand, family: PowerFamily<T>): Promise<string> {
  const raw = cmd.positional[0]?.trim();
  if (!raw) {
    const defs = family.registry.all();
    if (!defs.length) return sys(`No ${family.many} defined. [[${family.verbs.define}]] adds one.`);
    const items = defs.map(d => `${StringUtil.normalize(d.name)}${d.kind === family.defaultKind ? "" : ` (${d.kind})`}`).join(", ");
    return sys(`Defined ${family.many}: ${items}. [[${family.verbs.info} <name>]] for detail; [[${family.verbs.define}]] adds one.`);
  }
  const key = StringUtil.normalize(raw);
  const def = family.registry.get(key);
  if (!def) {
    // It may be perfectly well defined - in the other list. Say so; "no such
    // merit" about an arcanum is the confusion this split exists to end.
    const elsewhere = familyOwning(key);
    return elsewhere
      ? sys(`"${key}" is ${elsewhere.aOne}, not ${family.aOne} - a different category entirely. Use [[${elsewhere.verbs.info} ${key}]].`)
      : sys(`No ${family.one} "${key}". [[${family.verbs.info}]] lists them.`);
  }
  const bits = [`${def.kind} "${def.name}"`];
  const perTemplate = Object.entries(def.perTemplate ?? {});
  if (perTemplate.length) {
    bits.push(`${budgetOfKind(def)} cost - ${perTemplate.map(([t, v]) =>
      v.available === false ? `${t}: not available` : `${t}: ${Array.isArray(v.cost) ? `[${v.cost.join(", ")}]` : v.cost ?? def.points}`).join(", ")}`);
    for (const [t, v] of perTemplate) if (v.note) bits.push(`${t}: ${v.note}`);
  } else {
    bits.push(`${Array.isArray(def.points) ? `[${def.points.join(", ")}]` : def.points} ${budgetOfKind(def)} point${def.points === 1 ? "" : "s"}`);
  }
  if (!kindSpends(def.kind)) bits.push(`GRANTS points rather than costing them`);
  if (def.param) bits.push(`parameterized by ${def.param}${def.paramFrom ? ` (must be a ${def.paramFrom})` : ""}`);
  for (const l of instanceLimitsOf(def)) {
    const kinds = Object.entries(l.perKind ?? {}).map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`);
    bits.push(`at most ${l.slots} at ${l.atRating}${kinds.length ? ` (of those, ${kinds.join(", ")})` : ""} - advisory`);
  }
  if (def.maxFromTrait) bits.push(`never more purchases than ${disp(def.maxFromTrait)}`);
  if (def.requires?.templates?.length) bits.push(`templates: ${def.requires.templates.join("/")}`);
  if (family.requires) bits.push(`needs the "${family.requires}" capability ([[attune]])`);
  if (def.passive?.length) bits.push(`passive - ${def.passive.map(describePassiveOp).join("; ")}`);
  if (def.grants) {
    // Its effect may live in the affliction it applies rather than in a passive
    // of its own - say what that affliction DOES, or the definition reads empty.
    const applied = resolveAffliction(def.grants.afflicts);
    const does = (applied?.apply ?? []).map(describePassiveOp).join("; ");
    bits.push(`applies "${def.grants.afflicts}"${does ? ` - ${does}` : ""}`
      + `${grantIsAutomatic(def.grants) ? "" : " when invoked"}${def.grants.togglable ? ", togglable" : ""}`);
  }
  const note = def.passive?.some(o => !isRollOp(o))
    ? " Ops the engine has no interpreter for are recorded and surfaced for the Storyteller (immunities have no system to enforce them yet)."
    : "";
  return sys(`${bits.join("; ")}.${def.description ? ` ${def.description}` : ""}${note}`);
}

async function takeOwnedPower<T extends OwnedPowerDef>(cmd: ParsedCommand, family: PowerFamily<T>): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const raw = cmd.positional[0]?.trim();
  if (!raw) return sys(`${family.verbs.take} needs a name, e.g. [[${family.verbs.take} trait-affinity::melee 2]].`);
  const key = StringUtil.normalize(raw);
  const waived = flagOf(cmd, "waive") === true;
  const hit = resolvePowerInstance(key, n => family.registry.get(n));
  if (!hit) {
    const elsewhere = familyOwning(key);
    if (elsewhere) {
      return sys(`${key} is ${elsewhere.aOne}, not ${family.aOne}. Use [[${elsewhere.verbs.take} ${key}]].`);
    }
    const bare = family.registry.get(key);
    return bare?.param
      ? sys(`"${key}" is parameterized - name its ${bare.param}: [[${family.verbs.take} ${key}::<${bare.param}>]].`)
      : sys(`Unknown ${family.one} "${key}". Custom definitions go in the ${family.category} lorebook category.`);
  }
  // "PICK A KNOWLEDGE" - the param's category, checked where the pick is made.
  if (hit.param && hit.def.paramFrom && !waived && !traitInCategory(hit.param, hit.def.paramFrom)) {
    const want = singularCategory(hit.def.paramFrom);
    const options = traitsInCategory(want);
    return sys(`${hit.def.name} is taken on a ${want}, and "${hit.param}" is not one`
      + `${traitCategoryOf(hit.param) ? ` (it is a ${traitCategoryOf(hit.param)})` : ""}. `
      + `${options.length ? `Choose from: ${options.join(", ")}. ` : ""}Add waive=true to override.`);
  }
  // IS THIS LIST OPEN TO HIM AT ALL? Asked before price, because "a vampire has
  // no Arcana" is a truer answer than "that costs 5 arcana points".
  const closed = waived ? undefined : familyClosedTo(char, family as unknown as PowerFamily<OwnedPowerDef>);
  if (closed) return sys(closed);
  // The price - and whether it may be taken at all - can differ per template.
  const priced = meritCostFor(hit.def, char.templates);
  if (!priced.available && !waived) {
    const who = char.templates.join("+");
    return sys(`${hit.def.name} is not open to ${who}${priced.note ? ` - ${priced.note}` : ""}. `
      + `[[${family.verbs.info} ${key}]] lists who may take it. Add waive=true to override.`);
  }
  const listed = typeof priced.points === "string" ? intOrUndef(priced.points) ?? 0 : priced.points;
  const allowed = Array.isArray(listed) ? listed : [listed];
  const points = intOrUndef(cmd.positional[1] ?? "") ?? allowed[0];
  if (!allowed.includes(points)) {
    return sys(`${hit.def.name} must be taken at one of [${allowed.join(", ")}] points (got ${points})`
      + `${priced.from ? ` for a ${priced.from}` : ""}.`);
  }
  const missing = unmetRequirements(char, hit.def.requires);
  if (missing.length && !waived) {
    return sys(`${hit.def.name} prerequisites not met: ${missing.join(", ")}. Add waive=true to override.`);
  }
  const breaches = instanceLimitBreaches(char, hit.def, { key, points });
  if (breaches.length && !waived) {
    return sys(`${breaches.join("; ")}. Lower another instance first, or add waive=true to override.`);
  }
  const ceiling = meritTraitCeiling(char, hit.def);
  if (ceiling && points > ceiling.cap && !waived) {
    // A ceiling of 0 is not a low cap, it is the WRONG KIND OF BEING: a mage
    // has Quintessence and Willpower, never Resolve, so an arcanum measured
    // against Resolve is not open to him at all. Say that, not "0".
    return ceiling.cap === 0
      ? sys(`${disp(char.name)} has no ${disp(ceiling.trait)}, and ${hit.def.name} is measured against it - `
        + `none of ${disp(char.name)}'s templates (${char.templates.join("+")}) grant one. Add waive=true if the chronicle says otherwise.`)
      : sys(`${hit.def.name} may not be taken more times than ${disp(ceiling.trait)} (${ceiling.cap}) - `
        + `asked for ${points}. Raise ${disp(ceiling.trait)} first, or add waive=true to override.`);
  }
  family.ensureBucket(char)[key] = points;
  // The Storyteller may set what it REALLY cost, right here.
  const paidExpr = cmd.named["paid"]?.trim();
  if (paidExpr !== undefined) char.paid = { ...(char.paid ?? {}), [key]: paidExpr };
  await CharacterStore.save(char);
  // Taking it turns it ON: the passive affliction is applied here, not by the
  // player remembering to. The reply says so.
  const granted = hit.def.grants
    ? await applyPassiveGrant(StringUtil.normalize(char.name), hit.def.kind, key, hit.def.grants,
        { param: hit.param, rating: points })
    : "";
  const passiveBits = passiveOpsOf(hit.def, hit.param, points).map(describePassiveOp);
  const purse = budgetOfKind(hit.def);
  const paidBit = paidExpr !== undefined ? `, paid ${paidExpr}` : "";
  return sys(`${disp(char.name)} takes ${hit.def.name}${hit.param ? `::${hit.param}` : ""} `
    + `(${points} ${purse} point${points === 1 ? "" : "s"}${priced.from ? ` - a ${priced.from}'s price` : ""}${paidBit})`
    + `${granted ? `. ${granted}` : ""}`
    + `${priced.note ? ` - ${priced.note}` : ""}`
    + `${passiveBits.length ? ` - passive: ${passiveBits.join(", ")}` : ""}. [[show-budget]] tracks the purse.`);
}

async function dropOwnedPower<T extends OwnedPowerDef>(cmd: ParsedCommand, family: PowerFamily<T>): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const key = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!key) return sys(`${family.verbs.drop} needs a name.`);
  const bucket = family.bucket(char);
  if (!(key in bucket)) {
    const elsewhere = family.other();
    if (key in elsewhere.bucket(char)) {
      return sys(`${key} is ${elsewhere.aOne}, not ${family.aOne}. Use [[${elsewhere.verbs.drop} ${key}]].`);
    }
    return sys(`${disp(char.name)} does not have "${key}". [[${family.verbs.list}]] lists them.`);
  }
  delete bucket[key];
  if (char.arcana && !Object.keys(char.arcana).length) delete char.arcana;
  await CharacterStore.save(char);
  // Losing a power loses what it granted. Every affliction that named this as
  // its source is re-measured through its own orphan policy - immediately,
  // after a while, unchanged, or by an expression over what was left. The
  // source is written `<kind>:<key>`, and a bare key is matched too because a
  // chronicle may have afflicted by name.
  const subject = StringUtil.normalize(char.name);
  const notes: string[] = [];
  for (const kind of family.kinds) notes.push(...await orphanAfflictions(subject, `${kind}:${key}`));
  notes.push(...await orphanAfflictions(subject, key));
  return sys(`${disp(char.name)} drops ${key}.${notes.length ? ` ${notes.join("; ")}.` : ""}`);
}

// merits / arcana - what this character OWNS from one list.
async function ownedPowerList<T extends OwnedPowerDef>(family: PowerFamily<T>, forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const insts = family.instances(char);
  const bucket = family.bucket(char);
  if (!insts.length && !Object.keys(bucket).length) {
    const closed = familyClosedTo(char, family as unknown as PowerFamily<OwnedPowerDef>);
    if (closed) return sys(closed);
    return sys(`${disp(char.name)} has no ${family.many}. [[${family.verbs.take} <name[::param]> [points]]] takes one.`);
  }
  const items = insts.map(i => `${i.key} (${i.points}${i.def.kind === family.defaultKind ? "" : `, ${i.def.kind}`})`);
  // Enhancements and findings are about the WHOLE sheet, so they are reported
  // by the list a player is most likely to be looking at when they matter.
  const enhBits = Object.entries(enhancementsFor(char)).map(([t, n]) => {
    const base = resolveTraitFromRecord(char, t);
    return `${t}: base ${base} -> effective ${base + n} (ceiling +${n}, advisory)`;
  });
  const issues = meritInstanceFindings(char);
  const parts = [`${family.many}: ${items.join("; ")}`];
  if (enhBits.length) parts.push(`Enhancements - ${enhBits.join("; ")}`);
  if (issues.length) parts.push(`Issues (ST-enforced): ${issues.join("; ")}`);
  return sys(`${parts.join(". ")}.`);
}

// --- THE VERBS, one line each per family --------------------------------------
export const cmdDefineMerit = (cmd: ParsedCommand): Promise<string> => defineOwnedPower(cmd, MERIT_FAMILY);
export const cmdForgetMerit = (cmd: ParsedCommand): Promise<string> => forgetOwnedPower(cmd, MERIT_FAMILY);
export const cmdMeritInfo = (cmd: ParsedCommand): Promise<string> => ownedPowerInfo(cmd, MERIT_FAMILY);
export const cmdTakeMerit = (cmd: ParsedCommand): Promise<string> => takeOwnedPower(cmd, MERIT_FAMILY);
export const cmdDropMerit = (cmd: ParsedCommand): Promise<string> => dropOwnedPower(cmd, MERIT_FAMILY);
export const cmdMerits = (forChar?: PlayableCharacter): Promise<string> => ownedPowerList(MERIT_FAMILY, forChar);

export const cmdDefineArcanum = (cmd: ParsedCommand): Promise<string> => defineOwnedPower(cmd, ARCANUM_FAMILY);
export const cmdForgetArcanum = (cmd: ParsedCommand): Promise<string> => forgetOwnedPower(cmd, ARCANUM_FAMILY);
export const cmdArcanumInfo = (cmd: ParsedCommand): Promise<string> => ownedPowerInfo(cmd, ARCANUM_FAMILY);
export const cmdTakeArcanum = (cmd: ParsedCommand): Promise<string> => takeOwnedPower(cmd, ARCANUM_FAMILY);
export const cmdDropArcanum = (cmd: ParsedCommand): Promise<string> => dropOwnedPower(cmd, ARCANUM_FAMILY);
// [[show-arcanum]] with a name inspects it, the way [[show-arcanum]] always has.
export const cmdArcana = (cmd: ParsedCommand, forChar?: PlayableCharacter): Promise<string> =>
  cmd.positional[0]?.trim() ? ownedPowerInfo(cmd, ARCANUM_FAMILY) : ownedPowerList(ARCANUM_FAMILY, forChar);

export async function cmdSpecialty(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
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

export async function cmdForgetSpecialty(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const trait = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  const label = cmd.positional[1]?.trim();
  const list = char.specialties?.[trait];
  if (!trait || !list?.length) return sys(`No specialties under "${trait}". [[show-specialty]] lists them.`);
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

export async function cmdSpecialties(forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
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
export async function resolveBindingValue(raw: string): Promise<{ value?: string; error?: string }> {
  if (raw.startsWith("@")) {
    const ref = await resolveCharacterRef(raw);
    return ref.error ? { error: ref.error } : { value: ref.name };
  }
  return { value: StringUtil.normalize(raw) };
}

// Who an affliction command operates on: on=<name|@alias> if given (record NOT
// required - NPCs carry afflictions too), else the current character.
export async function afflictionSubject(cmd: ParsedCommand): Promise<{ name?: string; error?: string }> {
  const on = cmd.named["on"]?.trim();
  if (on) {
    const ref = await resolveBindingValue(on);
    return ref.error ? { error: ref.error } : { name: ref.value };
  }
  const cur = await CharacterStore.getCurrent();
  if (!cur) return { error: `No active character. Select one with [[play name="..."]] or name a subject with on="...".` };
  return { name: StringUtil.normalize(cur.name) };
}

// One line of active affliction. Given the CHARACTER, a rating-scaled def also
// reports what it is granting right now ("what is my sanctum doing for me?").
export function afflictionLine(c: ActiveAffliction, char?: PlayableCharacter): string {
  const def = resolveAffliction(c.def);
  const bits = [c.def];
  const bound = Object.entries(c.bindings).map(([k, v]) => `${k}: ${disp(v)}`).join(", ");
  if (bound) bits.push(`(${bound})`);
  if (c.level !== undefined && c.level !== 1) bits.push(`level ${c.level}`);
  // HELD DOWN is not GONE, and a report that did not say so would be lying by
  // omission: it is listed, it is counted, and it is not biting.
  if (c.suspended) {
    const relief = describeExpiry(c.suspended.until, formatStoryDate);
    bits.push(`⏸ HELD DOWN by ${c.suspended.by === "self" ? "an act of will" : c.suspended.by}`
      + `${relief ? ` - ${relief}` : ""} (still on him; [[restore ${c.def}]] ends the relief)`);
  }
  // What the ENGINE is counting comes first; the def's prose duration is the
  // fallback for an affliction nobody gave an expiry to.
  const left = describeExpiry(c.expiry, formatStoryDate);
  if (left) bits.push(`- ${left}${expiryIsAdvisoryOnly(c.expiry) ? " ⚠ advisory: nothing ends this but [[lift]]" : ""}`);
  // The source is an IDENTIFIER ("arcanum:sharpened-senses"), not a display
  // name: title-casing it would mangle the very thing that makes it matchable.
  if (c.from) bits.push(`- from ${c.from}${c.orphan ? ` (${describeOrphanPolicy(c.orphan)})` : ""}`);
  const dur = describeDuration(def?.duration);
  if (!left && dur && dur !== "instant") bits.push(`- ${dur} (ST-enforced)`);
  if (def?.then) bits.push(`- then ${def.then}`);
  if (char && def?.tiers?.length) {
    if (def.requiresAwakened && !isAwakened(char.templates)) {
      bits.push(`- ${def.scalesWith ?? "its"} benefits need the Awakened`);
    } else {
      const rating = def.scalesWith ? effectiveTraitOf(char, def.scalesWith) : 0;
      const folded = foldAfflictionTiers(rating, def.tiers);
      const ops = folded.ops.map(o => {
        const amount = o.amount ?? 1;
        const where = o.target ? ` on ${o.target}` : o.trait ? ` when the pool uses ${o.trait}` : "";
        return `${o.op} ${amount > 0 ? "+" : ""}${amount}${where}`;
      });
      const at = def.scalesWith ? `${def.scalesWith} ${rating}` : "grants";
      const all = [...ops, ...folded.notes];
      bits.push(all.length ? `- ${at}: ${all.join("; ")}` : `- ${at}: nothing yet`);
    }
  }
  if (c.note) bits.push(c.note);
  return bits.join(" ");
}

// Apply one definition to a subject: validate + resolve bindings, write the
// instance, then fire the def's mirror onto the bound target. Shared by
// afflict and advance. Returns the reply fragments or an error.
export async function applyAffliction(subject: string, def: AfflictionDef, rawBindings: Record<string, string>, note?: string, expiry?: AfflictionExpiry, from?: string, cooldown?: AfflictionExpiry, orphan?: OrphanPolicy, level?: number): Promise<{ lines?: string[]; error?: string }> {
  const bindings: Record<string, string> = {};
  for (const slot of def.bindings ?? []) {
    const raw = rawBindings[slot];
    if (!raw) return { error: `${def.name} needs ${slot}=<name|@alias>.` };
    const r = await resolveBindingValue(raw);
    if (r.error) return { error: r.error };
    bindings[slot] = r.value!;
  }
  // A `$binding` an op reads but the def does not REQUIRE is optional: the tag
  // gate on difficulty-modifier is exactly this - give `tags=` and the op only
  // fires on rolls carrying it, leave it off and it fires on every roll using
  // the trait. Taken verbatim: these are tags and traits, not character names.
  for (const op of def.apply ?? []) {
    for (const raw of [op.trait, op.target]) {
      if (!raw?.startsWith("$")) continue;
      const slot = StringUtil.normalize(raw.slice(1));
      if (bindings[slot] !== undefined) continue;
      const given = rawBindings[slot];
      if (given?.trim()) bindings[slot] = StringUtil.normalize(given);
    }
  }
  const inst: ActiveAffliction = { def: def.name, bindings };
  // The MAGNITUDE rides on the instance, so one definition serves the 1/2/3
  // ladder every rated Merit is written on.
  if (level !== undefined && level !== 1) inst.level = level;
  if (note) inst.note = note;
  // The expiry rides on the INSTANCE, not the def: the same affliction may be
  // three rolls long on one man and an hour long on another.
  if (expiry) inst.expiry = expiry;
  // Where it came from (an arcanum, a spell, a Discipline, a botch) and when it
  // began - the second is what an "until X" condition measures against.
  // `::` is the path separator and folds to `:` - StringUtil.normalize does not
  // do that (only the command boundary does), and a source arriving inside
  // backticks skips the boundary entirely. Fold it here or an orphan sweep
  // would look for a name one colon different from the one it stored.
  if (from) inst.from = StringUtil.normalize(from).replace(/::+/g, ":");
  if (cooldown) inst.cooldown = cooldown;
  if (orphan) inst.orphan = orphan;
  inst.at = (await StoryClock.get())?.now ?? 0;
  await CharacterAfflictions.afflict(subject, inst);
  // Applying one may HOLD ANOTHER DOWN (the glove over the claws) - or be held
  // down itself, if a suppressor is already on him. Recomputed here so nobody
  // has to remember either direction.
  const suppression = await CharacterAfflictions.refreshSuppression(subject);
  const fresh = (await CharacterAfflictions.list(subject))
    .find(a => CharacterAfflictions.instanceKey(a) === CharacterAfflictions.instanceKey(inst)) ?? inst;
  const lines = [`${disp(subject)} is now ${afflictionLine(fresh)}`];
  if (suppression.length) lines.push(suppression.join("; "));
  if (def.mirror && bindings["target"]) {
    const mirrorDef = resolveAffliction(def.mirror);
    if (!mirrorDef) lines.push(`mirror "${def.mirror}" is not defined - skipped`);
    else {
      // A mirror ends when its original does: same expiry, copied.
      const mirrorInst: ActiveAffliction = { def: mirrorDef.name, bindings: { target: subject }, note: "(mirror)" };
      if (expiry) mirrorInst.expiry = { ...expiry };
      await CharacterAfflictions.afflict(bindings["target"], mirrorInst);
      lines.push(`${disp(bindings["target"])} is now ${afflictionLine(mirrorInst)}`);
    }
  }
  return { lines };
}

// Remove one affliction from a subject AND its mirror from the bound target.
// THE SOURCE IS NO MORE. Every affliction whose `from` names the thing that
// just went is re-measured through its orphan policy - which is one expression
// over what remains, so the owner's four behaviours are one code path:
//
//   ends at once      the policy evaluates to 0 and the affliction is lifted
//   ends in T         the policy is T, and what remains becomes T
//   carries on        no policy, nothing recomputed
//   an expression     `remaining-seconds / 2` and the like, with the remainder
//                     in scope
//
// `from` matches by PREFIX, so dropping `arcanum:trait-aptitude` takes the
// afflictions of `arcanum:trait-aptitude:melee` with it - the instance is a
// path, and losing the arcanum loses every trait it was applied to.
async function orphanAfflictions(subject: string, sourceKey: string): Promise<string[]> {
  const key = StringUtil.normalize(sourceKey).replace(/::+/g, ":");
  const active = await CharacterAfflictions.list(subject);
  const touched = active.filter(c => c.from && (c.from === key || c.from.startsWith(`${key}:`)));
  if (!touched.length) return [];
  const notes: string[] = [];
  const clock = await StoryClock.get();
  const now = clock?.now ?? 0;
  const char = await CharacterStore.load(subject);
  const next: ActiveAffliction[] = [];
  for (const c of active) {
    if (!touched.includes(c)) { next.push(c); continue; }
    // No policy is the owner's third case: the duration continues as normal.
    if (!c.orphan || (!c.orphan.rolls && !c.orphan.seconds)) {
      notes.push(`${disp(c.def)} outlives ${c.from}`);
      next.push(c);
      continue;
    }
    // What is LEFT, put in scope so a policy can speak about it.
    const remainingSeconds = c.expiry?.until !== undefined ? Math.max(0, c.expiry.until - now) : 0;
    const remainingRolls = c.expiry?.rolls ?? 0;
    const scope = await timedScope(char ?? undefined, c.at ?? now, now);
    const withRemainder: ExprScope = {
      lookup: (path) => (path.length === 1 && path[0] === "remaining-seconds" ? { value: remainingSeconds }
        : path.length === 1 && path[0] === "remaining-rolls" ? { value: remainingRolls }
        : scope.lookup(path)),
      call: scope.call,
    };
    const expiry: AfflictionExpiry = { ...(c.expiry ?? {}) };
    if (c.orphan.seconds !== undefined) {
      const secs = Math.max(0, Math.round(evaluateExpr(c.orphan.seconds, withRemainder).value));
      expiry.until = now + secs;
    }
    if (c.orphan.rolls !== undefined) {
      expiry.rolls = Math.max(0, Math.round(evaluateExpr(c.orphan.rolls, withRemainder).value));
    }
    next.push({ ...c, expiry });
  }
  await CharacterAfflictions.replace(subject, next);
  // Anything the policy reduced to nothing goes now, mirrors and all.
  for (const c of next) {
    if (!(await afflictionEnded(char ?? undefined, c, now))) continue;
    const r = await removeAffliction(subject, c.def);
    if (r.removed) notes.push(`${disp(c.def)} ends with ${c.from}`);
  }
  for (const c of next) {
    if (!touched.some(t => t.def === c.def) || !c.expiry?.until) continue;
    if (await afflictionEnded(char ?? undefined, c, now)) continue;
    notes.push(`${disp(c.def)} lingers - ${describeExpiry(c.expiry, formatStoryDate)}`);
  }
  return notes;
}

// TAKING A POWER APPLIES ITS PASSIVE. One function for all three kinds, because
// a Discipline, an Arcanum and a Merit differ in what they ARE and not in this:
// Potence is simply on, and so is an always-on arcanum, and so is Iron Will.
//
// The source is written `<kind>:<key>`, which is what makes losing it work:
// orphanAfflictions matches by prefix, so dropping the arcanum takes every
// trait it was applied to with it. The orphan policy defaults to `immediately`,
// because a power you no longer have is not working.
//
// Every application is ANNOUNCED on the bus (channel `affliction:applied`), so
// a distributed engine's other scripts learn about it without being asked.
export async function applyPassiveGrant(subject: string, kind: string, key: string, grant: PassiveGrant, ctx: { param?: string; rating?: number } = {}): Promise<string> {
  // The command does NOT apply the affliction. It says a power was taken, and
  // the handler registered below decides what that means - which is the whole
  // difference between an event that announces and an event that causes.
  // `ctx` is what the instance knows and the affliction needs: its parameter
  // and the rating it was taken at.
  const event = await PostOffice.publish(SYSTEM.powerTaken, {
    character: subject, kind, key: StringUtil.normalize(key), grant, ctx,
  });
  const said = (event.data as { said?: string }).said;
  return event.errors.length ? `⚠ ${event.errors.join("; ")}` : (said ?? "");
}

// --- THE SYSTEM HANDLERS ------------------------------------------------------
// These are the "someone" the owner asked for: the parts that DO the work when
// a system event says something happened. They live on `local:` channels, so
// they never touch the wire, and they are registered once at module load beside
// every other registration in this file.
//
// A handler is synchronous (the bus wants a verdict on the next line) but its
// WORK is not, so it pushes its promise onto `event.pending` and the publisher
// awaits it. See core/bus.ts.
// Registration is a FUNCTION, not a bare side effect, and it is idempotent:
// calling it twice keeps one of each. A distributed engine will want to say
// explicitly which handlers a given script owns, and a test that silences one
// needs a way to put it back.
export function registerSystemHandlers(): void {
  for (const channel of [SYSTEM.powerTaken, SYSTEM.powerLost]) {
    for (const l of Bus.listeners(channel)) Bus.off(l.id);
  }
  Bus.on(SYSTEM.powerTaken, onPowerTaken);
  Bus.on(SYSTEM.powerLost, onPowerLost);
}

const onPowerTaken: BusHandler = (event) => {
  const d = event.data as { character: string; kind: string; key: string; grant: PassiveGrant; said?: string; ctx?: { param?: string; rating?: number } };
  event.pending.push((async () => {
    const def = resolveAffliction(d.grant.afflicts);
    if (!def) { event.errors.push(`"${d.grant.afflicts}" is not a defined affliction`); return; }
    const from = `${d.kind}:${d.key}`;
    // OFFERED means the power gives you the ABILITY, not the state: nothing is
    // applied now, and [[invoke]] is how it happens later.
    if (!grantIsAutomatic(d.grant)) {
      d.said = `${disp(def.name)} is now available - [[invoke ${def.name}]] to use it`;
      return;
    }
    const bindings = grantBindings(d.grant, d.ctx ?? {});
    const level = grantLevel(d.grant, d.ctx ?? {});
    const r = await applyAffliction(d.character, def, bindings, d.grant.note, undefined, from,
      undefined, makeOrphanPolicy(d.grant.orphan ?? "immediately"), level);
    if (r.error) { event.errors.push(r.error); return; }
    const about = Object.values(bindings).filter(Boolean);
    d.said = `${disp(def.name)} is now applied${about.length ? ` (${about.join(", ")})` : ""} (from ${from}${d.grant.note ? ` - ${d.grant.note}` : ""})`
      + `${d.grant.togglable ? ` - [[toggle ${def.name}]] switches it off` : ""}`;
    // ...and the OUTSIDE world hears about it on a channel that does leave.
    await PostOffice.publish("affliction:applied", {
      character: d.character, affliction: def.name, from, automatic: true,
    });
  })());
};

const onPowerLost: BusHandler = (event) => {
  const d = event.data as { character: string; kind: string; key: string; said?: string };
  event.pending.push((async () => {
    const notes = await orphanAfflictions(d.character, `${d.kind}:${d.key}`);
    if (notes.length) d.said = notes.join("; ");
  })());
};

registerSystemHandlers();

// When an affliction ends, arm whatever cooldown it carried. One place, so it
// happens whether it was lifted by hand, ran out of charges, or timed out.
async function armCooldown(subject: string, c: ActiveAffliction | undefined): Promise<void> {
  if (!c?.cooldown) return;
  await CharacterCooldowns.arm(subject, c.def, { expiry: { ...c.cooldown }, at: (await StoryClock.get())?.now ?? 0 });
}

// Is this def still cooling for this character? Returns how long is left, or
// undefined when it is ready. Also SWEEPS: a cooldown whose expiry has elapsed
// is deleted on the way past, so "ready" needs no separate tick.
export async function cooldownLeft(char: PlayableCharacter | undefined, subject: string, def: string): Promise<string | undefined> {
  const armed = (await CharacterCooldowns.all(subject))[StringUtil.normalize(def)];
  if (!armed) return undefined;
  const now = (await StoryClock.get())?.now ?? 0;
  const condition = await expiryCondition(char, { expiry: armed.expiry, at: armed.at }, now);
  if (expiryElapsed(armed.expiry, now, condition)) {
    await CharacterCooldowns.clear(subject, def);
    return undefined;
  }
  return describeExpiry(armed.expiry, formatStoryDate);
}

// The counted sides of a cooldown tick exactly as an affliction's do.
export async function countDownCooldowns(field: "rolls" | "turns" | "scenes", n: number, only?: string): Promise<void> {
  for (const name of only ? [only] : await CharacterStore.listNames()) {
    const map = await CharacterCooldowns.all(name);
    let touched = false;
    for (const [def, armed] of Object.entries(map)) {
      if (armed.expiry[field] === undefined) continue;
      map[def] = { ...armed, expiry: { ...armed.expiry, [field]: armed.expiry[field]! - n } };
      touched = true;
    }
    if (touched) await CharacterCooldowns.replace(name, map);
  }
}

export async function removeAffliction(subject: string, defName: string, from?: string): Promise<{ removed?: ActiveAffliction; alsoLifted?: string; error?: string }> {
  const removed = await CharacterAfflictions.lift(subject, defName, from);
  if (!removed) return { error: `${disp(subject)} does not have "${StringUtil.normalize(defName)}". [[afflictions${subject ? ` ${subject}` : ""}]] lists them.` };
  await armCooldown(subject, removed);
  const def = resolveAffliction(removed.def);
  if (def?.mirror && removed.bindings["target"]) {
    const gone = await CharacterAfflictions.lift(removed.bindings["target"], def.mirror);
    if (gone) return { removed, alsoLifted: `${def.mirror} lifted from ${disp(removed.bindings["target"])}` };
  }
  return { removed };
}

export async function cmdDefineAffliction(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) return sys(`define-affliction needs name="...", e.g. [[define-affliction name="dazed" tags="off-hand" duration="1 scene"]].`);
  const durationRaw = cmd.named["duration"];
  const duration = parseAfflictionDuration(durationRaw);
  if (durationRaw && !duration) return sys(`Can't read duration "${durationRaw}" - use "1 turn", "2 scenes", "until <x>" or "instant".`);
  // WHAT IT DOES WHILE IT IS ON - the same shorthand a merit's passive uses, so
  // there is one grammar for "-2 difficulty when the pool uses drive".
  let apply: EffectOp[] | undefined;
  if (cmd.named["apply"]?.trim()) {
    const ops = parsePassiveOps(cmd.named["apply"]);
    if ("error" in ops) return sys(ops.error);
    apply = ops;
  }
  // WHO MAY HOLD IT DOWN, and at what price. Sub-args rather than a packed
  // string, so each one is a declared knob a window can render.
  const liftHow = StringUtil.normalize(cmd.named["lift"] ?? "");
  if (liftHow && !LIFT_POLICIES.includes(liftHow as never)) {
    return sys(`lift= must be one of ${LIFT_POLICIES.join(", ")} (got "${liftHow}"). `
      + `at-will = on and off as he pleases; cost = pay for relief; never = only something else can hold it down.`);
  }
  const lift: AfflictionLift = {};
  if (liftHow) lift.how = liftHow as never;
  for (const [key, field] of [["lift-cost", "cost"], ["lift-roll", "roll"], ["lift-for", "for"], ["lift-note", "note"]] as const) {
    const v = cmd.named[key]?.trim();
    if (v) lift[field] = v;
  }
  const def = makeAfflictionDef({
    name,
    description: cmd.named["description"],
    bindings: (cmd.named["bindings"] ?? "").split(",").map(s => s.trim()).filter(Boolean),
    duration,
    then: cmd.named["then"],
    mirror: cmd.named["mirror"],
    tags: (cmd.named["tags"] ?? "").split(",").map(s => s.trim()).filter(Boolean),
    note: cmd.named["note"],
    apply,
    ...(Object.keys(lift).length ? { lift } : {}),
    suppresses: (cmd.named["suppresses"] ?? "").split(",").map(s => s.trim()).filter(Boolean),
  });
  await AfflictionRegistry.put(def);
  // ADVISORY, like everything else here: a name outside the vocabulary is
  // reported with what it might have been, never refused.
  const role = afflictionRole(def.name);
  const nudge = role ? "" :
    ` ⚠ Its name declares no ROLE. Afflictions are named role-first so an alphabetical list groups by kind`
    + ` - ${AFFLICTION_ROLE_KEYS.map(r => `${r}-`).join(", ")}. Perhaps ${withAfflictionRole("state", def.name)}?`;
  const extras = [
    role ? `role: ${role} (${AFFLICTION_ROLES[role]})` : "",
    def.apply?.length ? `does: ${def.apply.map(describePassiveOp).join("; ")}` : "",
    def.lift ? describeLift(def.lift) : "",
    def.suppresses?.length ? `holds down: ${def.suppresses.join(", ")}` : "",
  ].filter(Boolean);
  return sys(`Defined affliction ${describeAfflictionDef(def)}${extras.length ? ` - ${extras.join("; ")}` : ""}.${nudge}`);
}

export async function cmdAfflictionInfo(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) {
    // BY ROLE, which is the point of naming them role-first: a player scanning
    // the list reads down a column of KINDS, not of unrelated subjects.
    const all = AfflictionRegistry.all();
    const groups: string[] = [];
    const filed = new Set<string>();
    for (const role of AFFLICTION_ROLE_KEYS) {
      const mine = all.filter(d => afflictionRole(d.name) === role).map(d => d.name).sort();
      mine.forEach(n => filed.add(n));
      if (mine.length) groups.push(`${role}- (${AFFLICTION_ROLES[role]}): ${mine.join(", ")}`);
    }
    const rest = all.filter(d => !filed.has(d.name)).map(d => d.name).sort();
    if (rest.length) groups.push(`no role yet: ${rest.join(", ")}`);
    return sys(`Defined afflictions, by role - ${groups.join(" | ")}. `
      + `[[show-affliction <name>]] for detail; [[show-affliction]] shows who has what.`);
  }
  const def = resolveAffliction(name);
  if (!def) return sys(`No affliction "${StringUtil.normalize(name)}". [[show-affliction]] lists them.`);
  return sys(`${describeAfflictionDef(def)}.`);
}

export async function cmdForgetAffliction(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`forget-affliction needs a name.`);
  const key = StringUtil.normalize(name);
  const removed = await AfflictionRegistry.remove(key);
  if (!removed) {
    return resolveAffliction(key)
      ? sys(`"${key}" is a built-in affliction - it can be shadowed with [[define-affliction]] but not deleted.`)
      : sys(`No affliction "${key}".`);
  }
  const shipped = resolveAffliction(key) ? ` The built-in "${key}" resurfaces.` : "";
  return sys(`Forgot affliction "${key}".${shipped}`);
}

export async function cmdAfflict(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`afflict needs an affliction, e.g. [[afflict concentrating-on target="Wolf"]]. [[show-affliction]] lists them.`);
  const def = resolveAffliction(name);
  if (!def) return sys(`No affliction "${StringUtil.normalize(name)}". Define it with [[define-affliction]].`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  const expiry = await expiryFromArgs(cmd);
  if (expiry.error) return sys(expiry.error);
  // A cooldown is checked HERE and nowhere else: the one moment somebody tries
  // to apply the thing again.
  const cooling = await cooldownLeft(await CharacterStore.load(subject.name!) ?? undefined, subject.name!, def.name);
  if (cooling && flagOf(cmd, "waive") !== true) {
    return sys(`${disp(subject.name!)} cannot take ${def.name} again yet - ${cooling}. Add waive=true to override.`);
  }
  const cooldown = await expiryFromArgs(cmd, "cooldown-");
  if (cooldown.error) return sys(cooldown.error);
  // A bare duration ("1 hour") is the only orphan form that needs the clock;
  // everything else is already an expression in seconds.
  let orphan = makeOrphanPolicy(cmd.named["orphan"]);
  if (orphan?.seconds && !/^[\d\s+\-*/().]*$/.test(orphan.seconds)) {
    const dur = parseDuration(orphan.seconds);
    if (!("error" in dur)) orphan = { ...orphan, seconds: String(dur.seconds + dur.months * 2_592_000) };
  }
  const level = intOrUndef(cmd.named["level"] ?? "");
  const r = await applyAffliction(subject.name!, def, cmd.named, undefined, expiry.value, cmd.named["from"], cooldown.value, orphan, level);
  if (r.error) return sys(`${r.error}`);
  return sys(`${r.lines!.join("; ")}.`);
}

// How long, read off a command. `rolls=` is the counted side and its four
// filters narrow WHICH rolls count; `for=` is the timed side, taken as a
// duration off the story clock. Both may be given - whichever ends first wins.
//
// A COOLDOWN is read by the same function with a `cooldown-` prefix, because it
// is the same six measures asking the opposite question. `cooldown-for=1 day`,
// `cooldown-scenes=1`, `` cooldown-until=`full-moons >= 1` `` - all of it, free.
export async function expiryFromArgs(cmd: ParsedCommand, prefix = ""): Promise<{ value?: AfflictionExpiry; error?: string }> {
  const arg = (key: string): string | undefined => cmd.named[`${prefix}${key}`];
  const list = (key: string): string[] => (arg(key) ?? "").split(",").map(t => t.trim()).filter(Boolean);
  let until: number | undefined;
  const forRaw = arg("for")?.trim();
  if (forRaw) {
    const clock = await StoryClock.get();
    if (!clock) return { error: NO_CLOCK };
    const dur = parseDuration(forRaw);
    if ("error" in dur) return { error: dur.error };
    until = addDuration(clock.now, dur);
  }
  return {
    value: makeAfflictionExpiry({
      rolls: intOrUndef(arg("rolls") ?? ""),
      withTags: list("with-tags"), withoutTags: list("without-tags"),
      usingTraits: list("using"), notUsingTraits: list("not-using"),
      turns: intOrUndef(arg("turns") ?? ""),
      scenes: intOrUndef(arg("scenes") ?? ""),
      untilExpr: arg("until"),
      untilEvent: arg("until-event"),
      until,
    }),
  };
}

// toggle <affliction> - switch a TOGGLABLE passive off, or back on. The power
// is not lost either way; the character is choosing whether it is working.
// Like everything else here it goes through a system event, so the deciding and
// the doing stay separate.
export async function cmdToggle(cmd: ParsedCommand): Promise<string> {
  const name = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!name) return sys(`toggle needs an affliction, e.g. [[toggle potent]]. [[show-affliction]] lists what is on.`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  const char = await CharacterStore.load(subject.name!);
  if (!char) return sys(`No character named "${subject.name}".`);
  const on = (await CharacterAfflictions.list(subject.name!)).find(c => c.def === name);
  // WHICH power offers this, so toggling back on can restore the same source.
  const source = passiveSourceFor(char, name);
  if (!on && !source) {
    return sys(`Nothing ${disp(char.name)} has offers "${name}", and it is not active. `
      + `[[afflict ${name}]] applies it outright.`);
  }
  if (on) {
    // Switching a passive off HOLDS IT DOWN; it does not take it away. The
    // bindings and level survive, so switching back on restores exactly what
    // was there rather than reconstructing it.
    if (on.suspended) {
      await CharacterAfflictions.update(subject.name!, a => a.def === name && a.suspended?.by === "self",
        a => { delete a.suspended; });
      await CharacterAfflictions.refreshSuppression(subject.name!);
      return sys(`${disp(char.name)} switches ${disp(name)} back ON.`);
    }
    await CharacterAfflictions.update(subject.name!, a => a.def === name && !a.suspended,
      a => { a.suspended = { by: "self", note: "switched off" }; });
    const knock = await CharacterAfflictions.refreshSuppression(subject.name!);
    return sys(`${disp(char.name)} switches ${disp(name)} OFF - it is held down, not lost. `
      + `[[toggle ${name}]] switches it back on.${knock.length ? ` ${knock.join("; ")}.` : ""}`);
  }
  const said = await applyPassiveGrant(subject.name!, source!.kind, source!.key, source!.grant, source!.ctx);
  return sys(`${disp(char.name)} switches ${disp(name)} ON. ${said}`);
}

// invoke <affliction> - use a power that was OFFERED rather than automatic.
// Same door, and the cooldown check in [[afflict]] is what rations it.
export async function cmdInvoke(cmd: ParsedCommand): Promise<string> {
  const name = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!name) return sys(`invoke needs an affliction, e.g. [[invoke veil]].`);
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const source = passiveSourceFor(char, name);
  if (!source) {
    return sys(`Nothing ${disp(char.name)} has offers "${name}". [[show-merit]], [[show-arcanum]] and [[show-sheet]] show what he holds.`);
  }
  const said = await applyPassiveGrant(StringUtil.normalize(char.name), source.kind, source.key,
    { ...source.grant, mode: "automatic" }, source.ctx);
  return sys(`${disp(char.name)} invokes ${disp(name)}. ${said}`);
}

// Which power a character holds that deals in this affliction - the arcanum,
// the merit or the Discipline. One walk, used by both verbs above; the KIND it
// reports is the def's own, which is what makes the source key (`<kind>:<key>`)
// match again when the power is dropped.
function passiveSourceFor(char: PlayableCharacter, affliction: string):
    { kind: string; key: string; grant: PassiveGrant; ctx: { param?: string; rating?: number } } | undefined {
  for (const inst of ownedPowerInstances(char)) {
    if (inst.def.grants?.afflicts === affliction) {
      // The instance's own parameter and rating go with it, so switching a
      // passive back on restores THE SAME one - the right trait, at the right
      // level - and not a bare copy of the definition.
      return { kind: inst.def.kind, key: inst.key, grant: inst.def.grants,
        ctx: { param: inst.param, rating: inst.points } };
    }
  }
  for (const [trait, rating] of Object.entries(char.disciplines ?? {})) {
    const d = rating > 0 ? disciplineDef(trait) : undefined;
    if (d?.grants?.afflicts === affliction) return { kind: "discipline", key: trait, grant: d.grants, ctx: { rating } };
  }
  return undefined;
}

// The manual chain trigger (the turn system will automate it): end the
// affliction now and apply its `then` successor, carrying the bindings forward.
export async function cmdAdvance(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`advance needs an affliction, e.g. [[advance concentrating-on]].`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  const current = (await CharacterAfflictions.list(subject.name!)).find(c => c.def === StringUtil.normalize(name));
  if (!current) return sys(`${disp(subject.name!)} does not have "${StringUtil.normalize(name)}".`);
  const def = resolveAffliction(current.def);
  if (!def?.then) return sys(`"${current.def}" has no successor to advance into - [[lift ${current.def}]] to end it.`);
  const next = resolveAffliction(def.then);
  if (!next) return sys(`Successor "${def.then}" is not defined.`);
  await removeAffliction(subject.name!, current.def);
  const r = await applyAffliction(subject.name!, next, current.bindings);
  if (r.error) return sys(`${current.def} ended, but ${def.then} could not begin: ${r.error}`);
  return sys(`${current.def} ends; ${r.lines!.join("; ")}.`);
}
