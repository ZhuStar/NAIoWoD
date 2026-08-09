// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { CommandContext, ParsedCommand, flagOf, sys } from "../command";
import { Rng } from "../core/dice";
import { StringUtil } from "../core/traits";
import { BotchPolicy, ExtendedRoll, RollExecution, RollModifier, RollOutcomeKind, RollSpec, SuccessTable, SuccessTableRegistry, applyInterval, describeExtended, describeSpec, describeTableReading, executeRoll, formatExecution, makeRollSpec, overrideSpec, parseBotchPolicy, parsePoolExpression, readSuccessTable } from "../rolls";
import { CAPABILITIES, CASTING_TAGS, EffectOp, EffectSpec, FELLOWSHIPS, ResourceDef, TEMPLATES, capabilityNote, describeEffect, fellowshipByName, foldAfflictionTiers, isAwakened, isCastingRoll, isTraitCategory, magicRulesFrom, passiveOpsOf, resourceEffect, uncancelableAllowance, uncancelableCap } from "../rules";
import { ActiveAffliction, CastAttempts, CharacterAfflictions, CharacterBoosts, CharacterHealth, CharacterResources, CharacterStore, CreatorMode, EffectUses, ExtendedRollStore, ExtendedSavedConfig, MagicRulesConfig, NamedRollStore, OpposedSavedConfig, PlayableCharacter, ProcedureCondition, ProcedureStep, SavedRoll, SceneStore, TableAliases, effectiveTraitOf, enhancementsFor, ownedPowerInstances, resolveAffliction, resolveTraitFromRecord, resourceNumbers, traitInCategory, traitValueOf } from "../state";
import { resolveCharacterRef } from "./afflictions";
import { disp, extractRollArgs, intOrUndef, isRollOp, mergeRollExtra, noCharacter, rollOpPatch, runRoll } from "./common";
import { launchOpposedFromSaved } from "./contests";
import { healthLine } from "./places";
import { spendAfflictionCharges } from "./time";

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

export async function applyEffectSpec(
  char: PlayableCharacter, def: ResourceDef, effectName: string, spec: EffectSpec,
  opts: { targetArg?: string; applications?: number; rng?: Rng; rollTags?: string[]; rollTraits?: string[] } = {}
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
      // A trait gate: the op applies only when the roll's POOL used the trait
      // (a trait appearing only in the difficulty expression doesn't count).
      if (op.trait) {
        const wanted = StringUtil.normalize(op.trait);
        if (!(opts.rollTraits ?? []).includes(wanted)) { notes.push(`${kind} needs a roll using "${wanted}" - skipped`); continue; }
      }
      anyRollOp = true;
      // An op marked `once` fires once per spend, however many units rode it
      // (Living Resolve's "ONE un-cancelable success per roll, whatever else
      // the points bought").
      const mult = op.once ? 1 : effectUnits;
      if (kind === "difficulty") extra.difficultyMod = (extra.difficultyMod ?? 0) + (op.amount ?? 1) * mult;
      else if (kind === "dice") extra.diceMod = (extra.diceMod ?? 0) + (op.amount ?? 1) * mult;
      else if (kind === "successes") extra.autoSuccesses = (extra.autoSuccesses ?? 0) + (op.amount ?? 1) * mult;
      else if (kind === "uncancelable") extra.uncancelableSuccesses = (extra.uncancelableSuccesses ?? 0) + (op.amount ?? 1) * mult;
      else if (kind === "nagain") extra.nAgain = Math.min(extra.nAgain ?? 10, op.amount ?? 10);
      if (kind === "uncancelable") {
        // Pouring EXTRA Willpower into one action for extra certainty is a
        // spellcasting rule; everywhere else the old law holds - one Willpower
        // per action, so however many points rode the spend, one of them counts
        // as the Willpower. On a spell it stacks up to what the Foundation holds.
        const casting = isCastingRoll(opts.rollTags);
        const cap = uncancelableAllowance(casting, resolveFoundation(undefined, resolver).rating, magicRulesFrom(MagicRulesConfig.current()));
        if ((extra.uncancelableSuccesses ?? 0) > cap) {
          extra.uncancelableSuccesses = cap;
          notes.push(casting
            ? `capped at ${cap} sure (Foundation)`
            : `1 sure only (stacking Willpower is a casting rule)`);
        }
      }
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
export async function applySpend(char: PlayableCharacter, cmd: ParsedCommand, ctx: CommandContext, rollTags: string[], rollTraits: string[], spendOverride?: string, amountOverride?: number): Promise<{ extra?: Partial<RollModifier>; note: string; refuse?: string }> {
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

  // How many points ride this spend. The command wins over the saved roll's
  // own amount; a resource's `limits.maxPerUse` clamps it and says so.
  const applications = Math.max(1, intOrUndef(cmd.named["spend-amount"]) ?? amountOverride ?? 1);

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
    return { note: "", refuse: `${def.name}::${effectName} is a ${kind} effect - use [[spend ${def.name}::${effectName} ...]] outside a roll` };
  }

  const r = await applyEffectSpec(char, def, effectName ?? "", e, { applications, rng: ctx.rng, rollTags, rollTraits });
  if (r.insufficient) return mandatory ? { note: "", refuse: r.insufficient } : { note: `${r.insufficient} - spent nothing` };
  if (r.refuse) return { note: "", refuse: r.refuse };
  // What the spend DID, not what the resource IS. The effect's label is a
  // paragraph of rules prose - it belongs to [[show-resource]], not to the tail of
  // every punch. What the dice actually got is already on the roll line
  // ("+2 auto +1 sure vs diff 2"); these notes carry what that line cannot say:
  // how many points left the pool, and anything that capped or skipped an op.
  return { extra: r.extra, note: r.notes.join("; ") };
}

// A resource the character ROLLS as a trait (def.rollAs): pooling its name (or
// a name it replaces) resolves to min(cap, current). Living Resolve's Willpower/
// Resolve rolls work this way - and its points above the shield threshold
// negate dice of penalties (applyPenaltyShield).
interface RollAsBinding { def: ResourceDef; current: number; names: string[] }

// A character's live roll environment: traits + active boosts, the wound
// penalty to fold into the dice pool, and any rollAs resource bindings.
// Shared by rolls and contests.
export async function characterRollEnv(char: PlayableCharacter): Promise<{ resolver: (n: string) => number; penalty: number; rollAs: RollAsBinding[]; resourceAt: (nameOrRole: string) => number }> {
  const boosts = await CharacterBoosts.all(char);
  const enh = enhancementsFor(char);   // Trait Enhancement: permanent, beside the temporary boosts
  const penalty = (await CharacterHealth.summary(char)).penalty;
  const rollAs: RollAsBinding[] = [];
  const views = await CharacterResources.all(char);
  for (const view of views) {
    if (!view.def.rollAs) continue;
    rollAs.push({
      def: view.def, current: view.current,
      names: [view.def.name, ...(view.def.replaces ?? [])].map(n => StringUtil.normalize(n)),
    });
  }
  // How much of a resource the character holds RIGHT NOW, by name, by a role it
  // fills, or by a name it replaced - the live side of a `requiresResource` gate.
  const resourceAt = (nameOrRole: string): number => {
    const key = StringUtil.normalize(nameOrRole);
    const hit = views.find(v => StringUtil.normalize(v.def.name) === key)
      ?? views.find(v => (v.def.roles ?? []).some(r => StringUtil.normalize(r) === key))
      ?? views.find(v => (v.def.replaces ?? []).some(r => StringUtil.normalize(r) === key));
    return hit?.current ?? 0;
  };
  return {
    resolver: (n: string): number => {
      const key = StringUtil.normalize(n);
      const bound = rollAs.find(b => b.names.includes(key));
      if (bound) return Math.max(0, Math.min(bound.def.rollAs?.cap ?? Infinity, bound.current));
      // traitValueOf, not the raw bucket: a rating a Background CONFERS and a
      // value the template DERIVES are as real as one the player typed, so
      // `[[roll willpower+courage]]` works on a sheet that states neither.
      return traitValueOf(char, key) + (enh[key] ?? 0) + (boosts[key] ?? 0);
    },
    penalty,
    rollAs,
    resourceAt,
  };
}

// The penalty shield: when the roll's POOL used a rollAs resource with
// `negatesPenaltiesAbove`, each point above that threshold negates 1 die of the
// roll's reductions (the wound penalty + explicit negative dice mods already in
// `extra`/the spec). Mutates `extra`; returns the note ("" when nothing
// shielded). Tag-driven dice reductions inside resolveSpec are NOT seen here
// (recorded limitation).
function applyPenaltyShield(rollAs: RollAsBinding[], poolTraits: string[], specDiceMod: number, extra: Partial<RollModifier>): string {
  const bound = rollAs.find(b => b.def.rollAs?.negatesPenaltiesAbove !== undefined && b.names.some(n => poolTraits.includes(n)));
  if (!bound) return "";
  const shield = Math.max(0, bound.current - (bound.def.rollAs?.negatesPenaltiesAbove ?? Infinity));
  const reductions = Math.max(0, -(extra.diceMod ?? 0)) + Math.max(0, -specDiceMod);
  const offset = Math.min(shield, reductions);
  if (offset <= 0) return "";
  extra.diceMod = (extra.diceMod ?? 0) + offset;
  return `${bound.def.name} shields ${offset} ${offset === 1 ? "die" : "dice"} of penalties`;
}

// Which traits a POOL expression actually resolves (normalized). This is the
// gate for Trait Affinity, trait-gated ops and specialties - deliberately a
// pre-parse of the pool ONLY: a trait that appears just in the difficulty
// expression must not count as "using" it.
export function poolTraitsOf(char: PlayableCharacter, pool: string): string[] {
  const used = new Set<string>();
  parsePoolExpression(pool, (n: string): number => {
    const key = StringUtil.normalize(n);
    used.add(key);
    return resolveTraitFromRecord(char, key);
  });
  return [...used];
}

// Did this pool use the trait an op is gated on? A plain name matches itself; a
// CATEGORY matches any trait the chronicle files under it, which is what lets a
// merit say "every Talent" or an arcanum say "pick a Knowledge".
function poolUsesTrait(poolTraits: string[], gate: string): boolean {
  const want = StringUtil.normalize(gate);
  if (poolTraits.includes(want)) return true;
  return isTraitCategory(want) && poolTraits.some(t => traitInCategory(t, want));
}

// Fold the character's PASSIVE roll ops (owned merits/arcana - Trait Affinity
// et al.) into a roll: trait-gated ops fire iff the pool used the trait,
// actionTag-gated ops iff the roll carries the tag; unmet gates skip SILENTLY
// (passives must not spam every unrelated roll). "enhance" is env-level and
// ignored here.
export function passiveRollExtra(char: PlayableCharacter, poolTraits: string[], tags: string[], resourceAt?: (n: string) => number, afflicted: Array<{ from: string; ops: EffectOp[] }> = []): { extra: Partial<RollModifier>; notes: string[]; usedTags: string[] } {
  const extra: Partial<RollModifier> = {};
  const notes: string[] = [];
  // Tags these ops gated on: they DID something, so the roll must not go on to
  // call them unknown.
  const usedTags: string[] = [];
  // Both categories - a die is a die, and Trait Affinity is an arcanum - plus
  // whatever is currently ON him: a merit's passive and an affliction's ops are
  // the same currency, judged by the same two gates.
  const sources: Array<{ label: string; ops: EffectOp[] }> = [
    ...ownedPowerInstances(char).map(inst => ({
      label: `${StringUtil.normalize(inst.def.name)}${inst.param ? ` (${inst.param})` : ""}`,
      ops: passiveOpsOf(inst.def, inst.param, inst.points),
    })),
    ...afflicted.map(a => ({ label: a.from, ops: a.ops })),
  ];
  for (const inst of sources) {
    for (const op of inst.ops) {
      const kind = op.op.toLowerCase();
      const patch = (n: number): Partial<RollModifier> => rollOpPatch(kind, n) ?? {};
      if (!rollOpPatch(kind, 0)) continue;
      if (op.target && !tags.includes(StringUtil.normalize(op.target))) continue;
      // The trait gate names a TRAIT ("melee") or a CATEGORY ("knowledge",
      // "talents"): "-1 difficulty on every Knowledge" is one op, not ten.
      if (op.trait && !poolUsesTrait(poolTraits, op.trait)) continue;
      // A "while I still hold N of this" gate - checked live, so it lapses the
      // moment the pool runs dry.
      if (op.requiresResource && (resourceAt?.(op.requiresResource.resource) ?? 0) < op.requiresResource.atLeast) continue;
      const amount = op.amount ?? 1;
      mergeRollExtra(extra, patch(amount));
      // Difficulty runs backwards - a MINUS is easier - so the note says which,
      // and nobody has to hold the convention in their head.
      const sense = kind === "difficulty" ? ` (${amount < 0 ? "easier" : "harder"})` : "";
      notes.push(`${inst.label}: ${kind} ${amount > 0 ? "+" : ""}${amount}${sense}`);
      if (op.target) usedTags.push(StringUtil.normalize(op.target));
    }
  }
  return { extra, notes, usedTags };
}

// Fold the character's ACTIVE afflictions' rating-scaled tiers into a roll -
// the twin of passiveRollExtra, but the magnitude comes from a Background
// (Sanctum 8 grants more than Sanctum 2). Gates: `requiresAwakened` defs skip
// the unawakened entirely; an op's `target` still names an action tag the roll
// must carry, and its `trait` the trait the pool must have used - with
// "@foundation" standing for the caster's own Foundation trait, whatever their
// fellowship calls it. Unmet gates skip SILENTLY, as passives do.
function afflictionRollExtra(char: PlayableCharacter, active: ActiveAffliction[], poolTraits: string[], tags: string[]): { extra: Partial<RollModifier>; notes: string[] } {
  const extra: Partial<RollModifier> = {};
  const notes: string[] = [];
  const awakened = isAwakened(char.templates);
  const foundation = resolveFoundation(undefined, (n: string) => resolveTraitFromRecord(char, n)).trait;
  for (const inst of active) {
    const def = resolveAffliction(inst.def);
    if (!def?.tiers?.length) continue;
    if (def.requiresAwakened && !awakened) continue;
    const rating = def.scalesWith ? effectiveTraitOf(char, def.scalesWith) : 0;
    if (def.scalesWith && rating <= 0) continue;
    for (const op of foldAfflictionTiers(rating, def.tiers).ops) {
      const kind = op.op.toLowerCase();
      const amount = op.amount ?? 1;
      const patch = rollOpPatch(kind, amount);
      if (!patch) continue;
      if (op.target && !tags.includes(StringUtil.normalize(op.target))) continue;
      if (op.trait) {
        const wanted = StringUtil.normalize(op.trait) === "@foundation" ? foundation : StringUtil.normalize(op.trait);
        if (!poolTraits.includes(wanted)) continue;
      }
      mergeRollExtra(extra, patch);
      notes.push(`${inst.def}${def.scalesWith ? ` ${rating}` : ""}: ${kind} ${amount > 0 ? "+" : ""}${amount}`);
    }
  }
  return { extra, notes };
}

// Resolve a specialty= reference (a trait name, or a specialty label) against
// the character's specialties. AT MOST ONE specialty applies per roll - the
// argument names it. Applying requires the pool to have used the trait
// (advisory note otherwise, no die).
function resolveSpecialty(char: PlayableCharacter, ref: string, poolTraits: string[]): { note: string; extra?: Partial<RollModifier> } {
  const want = StringUtil.normalize(ref);
  const specs = char.specialties ?? {};
  let trait: string | undefined;
  let label: string | undefined;
  const traitLabels = specs[want];
  if (traitLabels && traitLabels.length > 0) {
    if (traitLabels.length > 1) return { note: `specialty: "${want}" has several (${traitLabels.join(", ")}) - name one` };
    trait = want;
    label = traitLabels[0];
  } else {
    const hits: Array<{ trait: string; label: string }> = [];
    for (const [t, labels] of Object.entries(specs)) {
      for (const l of labels) if (StringUtil.normalize(l) === want) hits.push({ trait: t, label: l });
    }
    if (hits.length === 0) return { note: `no specialty "${ref}" (see [[show-specialty]])` };
    if (hits.length > 1) return { note: `specialty "${ref}" is ambiguous (${hits.map(h => h.trait).join(", ")}) - use the trait` };
    trait = hits[0].trait;
    label = hits[0].label;
  }
  if (!poolTraits.includes(trait)) return { note: `specialty ${label} (${trait}): pool didn't use ${trait} - no die` };
  return { note: `specialty: ${label} (+1 die)`, extra: { diceMod: 1 } };
}

// Merge the tags granted by someone's active afflictions into a roll spec
// (deduped). This is how afflictions bite mechanically today: a def's tags fire
// registered RollModifiers on every roll the afflicted character makes.
export async function withAfflictionTags(name: string, spec: RollSpec): Promise<RollSpec> {
  const condTags = await CharacterAfflictions.tags(name);
  if (!condTags.length) return spec;
  return { ...spec, tags: [...new Set([...spec.tags, ...condTags])] };
}

// A table argument may be a key ("degrees", "combat::quick-kill" -> the
// boundary folds :: to :) or a @table-alias; this is the ONE seam turning
// either into a registry key. Paths go one level deep for now (policy).
export async function resolveTableRef(raw: string): Promise<{ key?: string; error?: string }> {
  const t = StringUtil.normalize(raw);
  if (t.startsWith("@")) {
    const hit = await TableAliases.resolve(t.slice(1));
    return hit ? { key: hit } : { error: `Unknown table alias "${t}". [[table-alias]] lists them.` };
  }
  if (t.split(":").filter(Boolean).length > 2) {
    return { error: `Table paths go one level deep for now ("sub::name").` };
  }
  return { key: t };
}

// Read a table ref (table=<key|@alias>, or a saved roll's table sidecar)
// against an outcome. The roll itself never interprets its successes - the
// table does (or the reading is an unknown-table note).
// A table REF -> the table, or the note explaining why not. Both readers below
// need exactly this, and a reading that quietly used the wrong table would be
// worse than one that says it cannot find it.
async function lookupTable(raw: string): Promise<{ table?: SuccessTable; note?: string }> {
  const ref = await resolveTableRef(raw);
  if (ref.error) return { note: ref.error };
  const table = SuccessTableRegistry.get(ref.key!);
  return table ? { table } : { note: `unknown table "${ref.key}" (see [[show-table]])` };
}

export async function tableNote(raw: string | undefined, outcome: RollOutcomeKind, successes: number): Promise<string> {
  if (!raw) return "";
  const { table, note } = await lookupTable(raw);
  if (!table) return note!;
  return `${table.name}: ${describeTableReading(readSuccessTable(table, outcome, successes))}`;
}

// Table reading for an EXTENDED interval. A value-per-success table (climbing:
// 10 ft/success) reports the ACCUMULATED total - "how far the whole action has
// gone", the distance climbed so far - because that is the point of an extended
// action: the climb ends when you have climbed the entire distance. Qualitative
// tables (degrees) still read this interval's own net, since each interval has
// its own quality. When the pool is empty (nothing banked, or a botch reset it)
// the value branch falls back to this interval's outcome flavour.
async function extendedTableNote(raw: string | undefined, outcome: RollOutcomeKind, net: number, accumulated: number): Promise<string> {
  if (!raw) return "";
  const { table, note } = await lookupTable(raw);
  if (!table) return note!;
  if (table.valuePerSuccess !== undefined && accumulated > 0) {
    return `${table.name}: ${describeTableReading(readSuccessTable(table, "success", accumulated))} so far`;
  }
  return `${table.name}: ${describeTableReading(readSuccessTable(table, outcome, net))}`;
}

// Execute ONE roll for a character with the full live env - the shared path for
// extended intervals so they respect the SAME modifiers a single roll does:
// active affliction tags bite, enhancements/boosts fold into the resolver, the
// wound penalty comes off the pool, and owned passive roll-ops apply (gated by
// the pool's traits AND the roll's tags - this is how a `climb` tag lets a
// grip power's `-2 difficulty` reach an extended climb). No spend/specialty
// here - those are single-roll concerns.
export async function execCharacterRoll(char: PlayableCharacter, spec: RollSpec, ctx: CommandContext, seed?: Partial<RollModifier>): Promise<{ exec: RollExecution; notes: string[] }> {
  const tagged = await withAfflictionTags(char.name, spec);
  const poolTraits = poolTraitsOf(char, tagged.pool);
  const env = await characterRollEnv(char);
  const passive = passiveRollExtra(char, poolTraits, tagged.tags, env.resourceAt, await CharacterAfflictions.ops(char.name));
  const place = afflictionRollExtra(char, await CharacterAfflictions.list(char.name), poolTraits, tagged.tags);
  const extra = mergeRollExtra({ ...(seed ?? {}) }, passive.extra, place.extra);
  if (env.penalty !== 0) extra.diceMod = (extra.diceMod ?? 0) + env.penalty;
  const shieldNote = applyPenaltyShield(env.rollAs, poolTraits, tagged.diceMod, extra);
  const exec = runRoll(tagged, env.resolver, { rng: ctx.rng, extra, usedTags: passive.usedTags });
  const notes = [...passive.notes, ...place.notes, env.penalty !== 0 ? `wound penalty ${env.penalty}` : "", shieldNote].filter(Boolean);
  return { exec, notes };
}

// Start an extended action and roll its first interval as `char`. THE one
// launcher - used by [[extended-roll]] and by invoking a saved extended roll.
// `base.requires` is forced to 1 by callers (each interval is a plain roll; the
// accumulated `target` is the extended goal). Reads `table` against the
// interval's net so each report shows what the successes MEAN (10 ft/success).
async function launchExtended(char: PlayableCharacter, base: RollSpec, opts: { target: number; maxRolls: number; interval: string; onBotch: BotchPolicy; label: string; table?: string; stepsTail?: string; firstExtra?: Partial<RollModifier>; preNotes?: string[] }, ctx: CommandContext): Promise<string> {
  const action: ExtendedRoll = {
    id: api.v1.uuid(), label: opts.label,
    base, target: opts.target, maxRolls: opts.maxRolls,
    interval: opts.interval, onBotch: opts.onBotch, table: opts.table,
    accumulated: 0, rollsUsed: 0, status: "open", log: [],
  };
  const { exec, notes } = await execCharacterRoll(char, base, ctx, opts.firstExtra);
  const { action: after, note } = applyInterval(action, exec, char.name);
  await ExtendedRollStore.save(after);
  if (after.status === "open") await ExtendedRollStore.setCurrent(after.id);
  const extras = [...(opts.preNotes ?? []), ...notes, await extendedTableNote(after.table, exec.outcome, exec.result?.net ?? 0, after.accumulated)].filter(Boolean).join("; ");
  const tail = after.status === "open" ? ` Continue with [[continue-roll]] (id ${after.id}).` : "";
  return sys(`${disp(char.name)} starts extended ${describeExtended(after)}. Interval 1: ${note}${extras ? ` (${extras})` : ""}.${tail}${opts.stepsTail ?? ""}`);
}

// Invoke a saved EXTENDED roll: the save holds the shape (pool, difficulty,
// tags, table, botch/interval defaults); the TARGET and any overrides come at
// play time. `requires=`/`target=` is the accumulated goal (the full climb).
async function launchExtendedFromSaved(char: PlayableCharacter, name: string, saved: SavedRoll, cmd: ParsedCommand, args: Partial<RollSpec>, ctx: CommandContext): Promise<string> {
  const target = args.requires ?? intOrUndef(cmd.named["target"]);
  if (target === undefined || target < 1) {
    return sys(`"${name}" is an extended roll - give it a target, e.g. [[roll @${name} requires=4]] (the successes = the whole action; for climbing, wall height / ft-per-success).`);
  }
  const cfg = saved.extended ?? {};
  const maxRolls = intOrUndef(cmd.named["intervals"]) ?? cfg.intervals;
  if (maxRolls === undefined || maxRolls < 1) return sys(`"${name}" needs intervals=<max rolls> (its save defines none), e.g. [[roll @${name} requires=${target} intervals=6]].`);
  const onBotch = cmd.named["on-botch"] ? parseBotchPolicy(cmd.named["on-botch"]) : (cfg.onBotch ?? "fail");
  const base = overrideSpec(saved, { ...args, requires: 1 });   // each interval is a plain roll
  return launchExtended(char, base, {
    target, maxRolls, interval: cmd.named["interval"] ?? cfg.interval ?? "",
    onBotch, label: cmd.named["label"] ?? name, table: saved.table,
    stepsTail: surfaceSteps(saved.steps, undefined),
  }, ctx);
}

async function rollAndReport(char: PlayableCharacter, cmd: ParsedCommand, ctx: CommandContext, offset: number): Promise<string> {
  const args = extractRollArgs(cmd, offset);
  if (!args.pool) return sys(`roll needs a pool, e.g. [[roll strength+brawl]] or a saved [[roll @name]].`);
  let spec: RollSpec;
  let savedSpend: string | undefined;
  let savedSpendAmount: number | undefined;
  let savedSpecialty: string | undefined;
  let savedTable: string | undefined;
  let savedSteps: ProcedureStep[] | undefined;
  if (args.pool.startsWith("@")) {
    // Saved roll: load the base spec, then apply the supplied overrides (pool is
    // never overridden, so passing `args` straight through to overrideSpec is safe).
    const name = StringUtil.normalize(args.pool.slice(1));
    const base = await NamedRollStore.get(name);
    if (!base) return sys(`No saved roll named "${name}". Try [[show-roll]] or [[name-roll ${name} <pool> ...]].`);
    // A saved EXTENDED roll (a "named procedure") launches an extended action
    // instead of a single roll - the target is play-time input, not baked in.
    // An OPPOSED saved roll launches a contest; an EXTENDED one an extended
    // action. Both take play-time input (vs= / requires=) the save never bakes.
    if (base.opposed) return launchOpposedFromSaved(char, name, base, cmd, args, ctx);
    if (base.extended) return launchExtendedFromSaved(char, name, base, cmd, args, ctx);
    savedSpend = base.spend;         // auto-paid unless the command overrides spend=
    savedSpendAmount = base.spendAmount;
    savedSpecialty = base.specialty; // auto-applied unless the command overrides specialty=
    savedTable = base.table;         // read against the outcome unless table= overrides
    savedSteps = base.steps;         // a procedure's follow-ups, surfaced after the entry roll
    spec = overrideSpec(base, args);
  } else {
    spec = makeRollSpec({ ...args, pool: args.pool });
  }
  // Active afflictions bite: their tags join the roll, firing any registered
  // RollModifiers (unregistered ones surface as the usual unknown-tag note).
  spec = await withAfflictionTags(char.name, spec);
  const poolTraits = poolTraitsOf(char, spec.pool);
  const spend = await applySpend(char, cmd, ctx, spec.tags, poolTraits, savedSpend, savedSpendAmount);
  if (spend.refuse) return sys(`${disp(char.name)} can't: ${spend.refuse}.`);
  // Rolls see live state: enhancements + boosts add to the record's dots, the
  // wound penalty (negative) comes off the dice pool, owned passives (Trait
  // Affinity et al.) fold in, and at most one specialty grants its die.
  const env = await characterRollEnv(char);
  const passive = passiveRollExtra(char, poolTraits, spec.tags, env.resourceAt, await CharacterAfflictions.ops(char.name));
  const place = afflictionRollExtra(char, await CharacterAfflictions.list(char.name), poolTraits, spec.tags);
  const specialtyRef = cmd.named["specialty"] ?? savedSpecialty;
  const specialty = specialtyRef ? resolveSpecialty(char, specialtyRef, poolTraits) : { note: "" };
  const extra = mergeRollExtra({ ...(spend.extra ?? {}) }, passive.extra, place.extra, specialty.extra ?? {});
  if (env.penalty !== 0) extra.diceMod = (extra.diceMod ?? 0) + env.penalty;
  const shieldNote = applyPenaltyShield(env.rollAs, poolTraits, spec.diceMod, extra);
  const exec = runRoll(spec, env.resolver, { rng: ctx.rng, extra, usedTags: passive.usedTags });
  // The roll HAPPENED, so anything counting rolls counts this one - after the
  // dice, because a charge buys the roll it was spent on.
  const charges = await spendAfflictionCharges(char.name, spec.tags, poolTraits);
  const notes = [
    spend.note,
    ...passive.notes,
    ...place.notes,
    specialty.note,
    env.penalty !== 0 ? `wound penalty ${env.penalty}` : "",
    shieldNote,
    ...charges,
    await tableNote(cmd.named["table"] ?? savedTable, exec.outcome, exec.result?.net ?? 0),
  ].filter(Boolean).join("; ");
  return sys(`${disp(char.name)} - ${formatExecution(exec)}${notes ? ` - ${notes}` : ""}${surfaceSteps(savedSteps, exec.outcome)}`);
}

export async function cmdRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  return rollAndReport(char, cmd, ctx, 0);
}

export async function cmdRollFor(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const target = cmd.positional[0]?.trim();
  if (!target) return sys(`roll-for needs a character name, e.g. [[roll-for "Erik" strength+brawl]].`);
  const ref = await resolveCharacterRef(target);
  if (ref.error) return sys(`${ref.error}`);
  const char = await CharacterStore.load(ref.name!);
  if (!char) return sys(`No character named "${ref.name}".`);
  return rollAndReport(char, cmd, ctx, 1);
}

// The sidecars a saved roll carries beyond its spec, as "k=v" display pairs.
function describeSidecars(saved: SavedRoll): string {
  return [
    saved.opposed ? describeOpposedSaved(saved.opposed) : "",
    saved.extended ? describeExtendedSaved(saved.extended) : "",
    saved.steps && saved.steps.length ? `[${saved.steps.length}-step procedure]` : "",
    saved.spend ? `spend=${saved.spend}${saved.spendAmount && saved.spendAmount > 1 ? ` x${saved.spendAmount}` : ""}` : "",
    saved.specialty ? `specialty=${saved.specialty}` : "",
    saved.table ? `table=${saved.table}` : "",
  ].filter(Boolean).join(", ");
}

// The extended shape of a saved procedure (its defaults; the target is play-time).
function describeExtendedSaved(cfg: ExtendedSavedConfig): string {
  const bits = ["extended"];
  if (cfg.intervals !== undefined) bits.push(`≤${cfg.intervals} rolls`);
  if (cfg.interval) bits.push(`every ${cfg.interval}`);
  if (cfg.onBotch) bits.push(`botch ${cfg.onBotch}`);
  return `[${bits.join(", ")}]`;
}

// The opposed shape of a saved roll (the opponent is play-time input via vs=).
function describeOpposedSaved(cfg: OpposedSavedConfig): string {
  const bits = [cfg.extended ? `extended-${cfg.mode}` : cfg.mode];
  bits.push(`vs ${cfg.pool ?? "same pool"}`);
  if (cfg.vsDifficulty !== undefined) bits.push(`their diff ${cfg.vsDifficulty}`);
  if (cfg.extended?.intervals !== undefined) bits.push(`≤${cfg.extended.intervals} rounds`);
  return `[opposed: ${bits.join(", ")}]`;
}

// A procedure's follow-up steps, surfaced after the entry roll as runnable next
// command(s). Advisory: only the steps whose `when` matches the entry's outcome
// are shown (all of them when the outcome is unknown, e.g. an extended entry);
// the Storyteller/player picks and runs the branch.
export function surfaceSteps(steps: ProcedureStep[] | undefined, outcome: RollOutcomeKind | undefined): string {
  if (!steps || !steps.length) return "";
  const matches = (w: ProcedureCondition): boolean =>
    w === "always" || outcome === undefined ||
    (w === "on-success" && outcome === "success") ||
    (w === "on-fail" && outcome === "failure") ||
    (w === "on-botch" && outcome === "botch");
  const shown = steps.filter(s => matches(s.when));
  if (!shown.length) return "";
  const items = shown.map(s => `${s.when} -> [[roll ${s.roll}]]${s.note ? ` (${s.note})` : ""}`).join("; ");
  return ` Next: ${items}.`;
}

// A procedure's full step list (for [[show-roll]]) - every step, condition first.
function describeSteps(steps: ProcedureStep[]): string {
  return steps.map((s, i) => `${i + 1}. ${s.when}: [[roll ${s.roll}]]${s.note ? ` - ${s.note}` : ""}`).join("; ");
}

// Save a reusable roll: name is positional[0], then the roll grammar at offset 1.
export async function cmdNameRoll(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`name-roll needs a name, e.g. [[name-roll dodge dexterity+dodge 6]].`);
  const args = extractRollArgs(cmd, 1);
  if (!args.pool) return sys(`name-roll needs a pool, e.g. [[name-roll dodge dexterity+dodge 6]].`);
  // A @reference can't be saved: invocation doesn't chain saved rolls, so the
  // stored pool must be a real expression (same guard as extended-roll).
  if (args.pool.startsWith("@")) return sys(`name-roll takes a pool expression (e.g. dexterity+dodge), not a saved @name.`);
  const spec = makeRollSpec({ ...args, pool: args.pool });
  const spend = cmd.named["spend"]?.trim();
  const specialty = cmd.named["specialty"]?.trim();
  const table = cmd.named["table"]?.trim();
  const description = cmd.named["description"]?.trim();   // literal channel: verbatim prose
  const saved: SavedRoll = { ...spec };
  if (spend) saved.spend = spend;
  const spendAmount = intOrUndef(cmd.named["spend-amount"]);
  if (spend && spendAmount !== undefined && spendAmount > 1) saved.spendAmount = spendAmount;
  if (specialty) saved.specialty = specialty;
  if (table) saved.table = table;
  if (description) saved.description = description;
  // A "named procedure": extended=true (or any extended knob) makes invoking it
  // launch an extended action; the target stays play-time input.
  const intervals = intOrUndef(cmd.named["intervals"]);
  const interval = cmd.named["interval"]?.trim();
  const onBotchRaw = cmd.named["on-botch"]?.trim();
  const extendedFlag = flagOf(cmd, "extended") === true;
  if (extendedFlag || intervals !== undefined || interval || onBotchRaw) {
    const cfg: ExtendedSavedConfig = {};
    if (intervals !== undefined) cfg.intervals = intervals;
    if (interval) cfg.interval = interval;
    if (onBotchRaw) cfg.onBotch = parseBotchPolicy(onBotchRaw);
    saved.extended = cfg;
  }
  // An OPPOSED saved roll: invoking launches a contest (the opponent is play-time
  // vs=). opposed + the extended knobs above = an extended contest (a race, e.g.
  // Pursuit) - the extended cfg rides on opposed so the top-level branch is clean.
  const opposedRaw = cmd.named["opposed"]?.trim().toLowerCase();
  if (opposedRaw === "resisted" || opposedRaw === "contested") {
    const opp: OpposedSavedConfig = { mode: opposedRaw };
    const vsPool = cmd.named["vs-pool"]?.trim();
    const vsDiff = intOrUndef(cmd.named["vs-difficulty"] ?? cmd.named["vs-diff"]);
    if (vsPool) opp.pool = vsPool;
    if (vsDiff !== undefined) opp.vsDifficulty = vsDiff;
    if (saved.extended) { opp.extended = saved.extended; delete saved.extended; }
    saved.opposed = opp;
  }
  await NamedRollStore.save(name, saved);
  const key = StringUtil.normalize(name);
  const sidecars = describeSidecars(saved);
  const descBit = saved.description ? " (+description)" : "";
  return sys(`Saved roll "${key}" = ${describeSpec(spec)}${sidecars ? `, ${sidecars}` : ""}${descBit}. Use it with ${invokeHint(key, saved)}.`);
}

// The invocation hint for a saved roll: opposed rolls need vs=<opponent>; extended
// rolls (and extended contests) need requires=<target>; a plain roll needs neither.
function invokeHint(key: string, saved: SavedRoll): string {
  const bits: string[] = [];
  if (saved.opposed) bits.push(`vs="<opponent>"`);
  if (saved.extended || saved.opposed?.extended) bits.push(`requires=<target>`);
  return `[[roll @${key}${bits.length ? ` ${bits.join(" ")}` : ""}]]`;
}

export async function cmdListRolls(): Promise<string> {
  const map = await NamedRollStore.all();
  const names = Object.keys(map);
  if (!names.length) return sys(`No saved rolls yet. Save one with [[name-roll <name> <pool> ...]].`);
  const items = names.map(n => {
    const sidecars = describeSidecars(map[n]);
    return `${n} (${describeSpec(map[n])}${sidecars ? `, ${sidecars}` : ""})`;
  }).join("; ");
  return sys(`Saved rolls: ${items}. [[show-roll <name>]] for detail.`);
}

// Full detail of one saved roll: spec, sidecars, and the rules description.
export async function cmdRollInfo(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`roll-info needs a name, e.g. [[show-roll climbing]]. [[show-roll]] lists them.`);
  // "@name" is how a roll is INVOKED, so accept it here too rather than
  // refusing the spelling the player just used.
  const key = StringUtil.normalize(name.startsWith("@") ? name.slice(1) : name);
  const saved = await NamedRollStore.get(key);
  if (!saved) return sys(`No saved roll named "${key}". See [[show-roll]].`);
  const sidecars = describeSidecars(saved);
  const parts = [`${key} = ${describeSpec(saved)}${sidecars ? `, ${sidecars}` : ""}`];
  if (saved.description) parts.push(saved.description);
  if (saved.steps && saved.steps.length) parts.push(`Steps: ${describeSteps(saved.steps)}`);
  parts.push(`Invoke: ${invokeHint(key, saved)}`);
  // Join as sentences without doubling a period a part already ends with
  // (the description is verbatim prose and usually ends in one).
  return sys(parts.map(p => p.replace(/\.\s*$/, "")).join(". "));
}

// Append a follow-up step to a saved procedure (its entry must already exist as a
// saved roll). Steps compose named rolls: each is [when -> @follow-up (note)].
export async function cmdAddStep(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`add-step needs a procedure name, e.g. [[add-step bribery when=on-success roll=@bribery-convince note=\`convince the official\`]].`);
  const key = StringUtil.normalize(name);
  const saved = await NamedRollStore.get(key);
  if (!saved) return sys(`No saved roll named "${key}" to add a step to - save its entry first with [[name-roll ${key} <pool> ...]].`);
  const whenRaw = (cmd.named["when"] ?? "always").trim().toLowerCase();
  const when = (["always", "on-success", "on-fail", "on-botch"].includes(whenRaw) ? whenRaw : "always") as ProcedureCondition;
  let roll = cmd.named["roll"]?.trim();
  if (!roll) return sys(`add-step needs roll=@<saved-roll> (the follow-up to run), e.g. [[add-step ${key} when=${when} roll=@grab-ledge]].`);
  if (!roll.startsWith("@")) roll = `@${StringUtil.normalize(roll)}`;
  const note = cmd.named["note"]?.trim();
  const step: ProcedureStep = { when, roll };
  if (note) step.note = note;
  saved.steps = [...(saved.steps ?? []), step];
  await NamedRollStore.save(key, saved);
  return sys(`Added step ${saved.steps.length} to "${key}": ${when} -> [[roll ${roll}]]${note ? ` (${note})` : ""}. Now a ${saved.steps.length}-step procedure - [[show-roll ${key}]] for the whole sequence.`);
}

// Drop all follow-up steps from a saved procedure (its entry roll is untouched).
export async function cmdClearSteps(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`clear-steps needs a procedure name, e.g. [[clear-steps bribery]].`);
  const key = StringUtil.normalize(name);
  const saved = await NamedRollStore.get(key);
  if (!saved) return sys(`No saved roll named "${key}".`);
  const had = saved.steps?.length ?? 0;
  if (!had) return sys(`"${key}" has no steps to clear.`);
  delete saved.steps;
  await NamedRollStore.save(key, saved);
  return sys(`Cleared ${had} step${had === 1 ? "" : "s"} from "${key}".`);
}

export async function cmdForgetRoll(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`forget-roll needs a name, e.g. [[forget-roll dodge]].`);
  const key = StringUtil.normalize(name);
  return (await NamedRollStore.remove(key))
    ? sys(`Forgot saved roll "${key}".`)
    : sys(`No saved roll named "${key}".`);
}

// Named-only roll overrides for a continuation (no positional pool/difficulty, so
// the optional id positional is never mistaken for a pool). `requires` is not
// per-interval overridable - the target is fixed on the action.
export function rollOverridesFromNamed(cmd: ParsedCommand): Partial<RollSpec> {
  const o: Partial<RollSpec> = {};
  const diffRaw = cmd.named["difficulty"]?.trim();
  if (diffRaw) {
    if (/^-?\d+$/.test(diffRaw)) o.difficulty = parseInt(diffRaw, 10);
    else o.difficultyExpr = diffRaw;
  }
  const difficultyMod = intOrUndef(cmd.named["difficulty-modifier"] ?? cmd.named["diff-mod"]);
  if (difficultyMod !== undefined) o.difficultyMod = difficultyMod;
  const diceMod = intOrUndef(cmd.named["dice-modifier"]);
  if (diceMod !== undefined) o.diceMod = diceMod;
  const minDifficulty = intOrUndef(cmd.named["min-difficulty"]);
  if (minDifficulty !== undefined) o.minDifficulty = minDifficulty;
  const autoSuccesses = intOrUndef(cmd.named["successes"] ?? cmd.named["auto"]);
  if (autoSuccesses !== undefined) o.autoSuccesses = autoSuccesses;
  const uncancelable = intOrUndef(cmd.named["uncancelable"] ?? cmd.named["sure"]);
  if (uncancelable !== undefined) o.uncancelableSuccesses = uncancelable;
  if (cmd.named["tags"] !== undefined) o.tags = cmd.named["tags"].split(",").map(t => t.trim()).filter(t => t.length > 0);
  return o;
}

// Start an extended action and roll its first interval as the current character.
export async function cmdExtendedRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const args = extractRollArgs(cmd, 0);
  if (!args.pool) return sys(`extended-roll needs a pool, e.g. [[extended-roll strength+stamina requires=8 intervals=4]].`);
  if (args.pool.startsWith("@")) return sys(`extended-roll takes a pool expression (e.g. strength+stamina), not a saved @name - invoke a saved extended roll with [[roll @name requires=<target>]].`);
  const maxRolls = intOrUndef(cmd.named["intervals"]) ?? 0;
  if (maxRolls < 1) return sys(`extended-roll needs intervals=<max rolls> (at least 1).`);
  const base = makeRollSpec({ ...args, pool: args.pool, requires: 1 });   // each interval is a plain roll
  return launchExtended(char, base, {
    target: args.requires ?? 1,   // `requires=` is the accumulated target
    maxRolls, interval: cmd.named["interval"] ?? "",
    onBotch: parseBotchPolicy(cmd.named["on-botch"]),
    label: cmd.named["label"] ?? "", table: cmd.named["table"],
  }, ctx);
}

export async function cmdContinueRoll(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const action = await ExtendedRollStore.resolve(cmd.positional[0]);
  if (!action) return sys(`No open extended action. Start one with [[extended-roll ...]] or name its id.`);
  if (action.status !== "open") return sys(`That extended action is already ${action.status}.`);
  const spec = overrideSpec(action.base, rollOverridesFromNamed(cmd));
  const { exec, notes } = await execCharacterRoll(char, spec, ctx);
  const { action: after, note } = applyInterval(action, exec, char.name);
  await ExtendedRollStore.save(after);
  if (after.status !== "open" && (await ExtendedRollStore.currentId()) === after.id) await ExtendedRollStore.clearCurrent();
  const extras = [...notes, await extendedTableNote(after.table, exec.outcome, exec.result?.net ?? 0, after.accumulated)].filter(Boolean).join("; ");
  return sys(`${disp(char.name)} continues ${describeExtended(after)}. This interval: ${note}${extras ? ` (${extras})` : ""}.`);
}

export async function cmdRollStatus(cmd: ParsedCommand): Promise<string> {
  const action = await ExtendedRollStore.resolve(cmd.positional[0]);
  if (!action) return sys(`No extended action found. Start one with [[extended-roll ...]].`);
  const recent = action.log.slice(-3).map(l => `${disp(l.by)}: ${l.outcome === "botch" ? "botch" : `+${l.net}`}`).join(", ");
  return sys(`${describeExtended(action)}${recent ? ` | recent: ${recent}` : ""}.`);
}

export async function cmdCancelRoll(cmd: ParsedCommand): Promise<string> {
  const action = await ExtendedRollStore.resolve(cmd.positional[0]);
  if (!action) return sys(`No extended action to cancel.`);
  await ExtendedRollStore.remove(action.id);
  if ((await ExtendedRollStore.currentId()) === action.id) await ExtendedRollStore.clearCurrent();
  return sys(`Cancelled extended action${action.label ? ` "${action.label}"` : ""} (was ${action.accumulated}/${action.target}).`);
}

export async function cmdResources(forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const views = await CharacterResources.all(char);
  if (!views.length) return sys(`${disp(char.name)} has no resources.`);
  const uses = await EffectUses.counts(char);
  const items = views.map(v => {
    const roles = (v.def.roles ?? []).filter(r => StringUtil.normalize(r) !== StringUtil.normalize(v.def.name));
    // The per-turn limit may be an expression (Quintessence's is the Fount
    // ladder), so it is resolved for THIS character rather than printed raw.
    const perTurn = resourceNumbers(char, v.def).perTurn;
    const named = Object.keys(v.def.effects ?? {}).map(n => {
      const used = uses[`${StringUtil.normalize(v.def.name)}:${StringUtil.normalize(n)}`] ?? 0;
      return `${n}${used > 0 ? ` (used ${used})` : ""}`;
    });
    const meta = [
      v.def.replaces?.length ? `replaces: ${v.def.replaces.join("/")}` : "",
      roles.length ? `roles: ${roles.join("/")}` : "",
      perTurn !== undefined && Number.isFinite(perTurn) ? `${perTurn}/turn (ST)` : "",
      v.def.rollAs ? `pools as min(${v.def.rollAs.cap ?? "∞"}, current)${v.def.rollAs.negatesPenaltiesAbove !== undefined ? `; points over ${v.def.rollAs.negatesPenaltiesAbove} shield penalties` : ""}` : "",
      v.def.recovery?.length ? `recovers ${v.def.recovery.map(r => `${r.amount}/${r.per}${r.requires ? ` if ${(Array.isArray(r.requires) ? r.requires : [r.requires]).join("+")}` : ""}`).join(", ")}` : "",
      v.def.effect ? describeEffect(v.def.effect) : "",
      named.length ? `spend:${named.join("/")}` : "",
    ].filter(Boolean).join("; ");
    const blurb = v.def.description ? ` - ${v.def.description}` : "";
    // Points he holds and cannot burn. Said first, because it is the only thing
    // about that pool that matters until it changes.
    const inert = v.blocked.length ? ` ⚠ held but UNUSABLE (needs ${v.blocked.join(", ")}; [[attune]])` : "";
    return `${v.def.name} ${v.current}/${v.max}${inert}${meta ? ` (${meta})` : ""}${blurb}`;
  }).join("; ");
  return sys(`${disp(char.name)} resources - ${items}.`);
}

// attune [<capability>] [off] - what this character can actually USE. A pool is
// a thing you hold; using it is a thing you are able to do, and the two come
// apart the moment an object hands someone a Resolve pool he cannot channel.
export async function cmdAttune(cmd: ParsedCommand, forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const raw = (cmd.named["capability"] ?? cmd.positional[0])?.trim();
  const fromTemplates = char.templates.flatMap(t => TEMPLATES[StringUtil.normalize(t)]?.Capabilities ?? []);
  if (!raw) {
    const own = (char.capabilities ?? []).filter(c => !fromTemplates.includes(c));
    const held = CharacterResources.capabilities(char);
    const views = await CharacterResources.all(char);
    const inert = views.filter(v => v.blocked.length).map(v => `${v.def.name} (needs ${v.blocked.join(", ")})`);
    return sys(`${disp(char.name)} can use: ${held.length ? held.join(", ") : "nothing in particular"}`
      + `${own.length ? ` (attuned: ${own.join(", ")})` : ""}. `
      + `${inert.length ? `Held and unusable: ${inert.join(", ")}. ` : ""}`
      + `Known: ${Object.entries(CAPABILITIES).map(([k, v]) => `${k} - ${v}`).join("; ")}. `
      + `[[attune <capability>]] grants one; [[attune <capability> off]] takes it back.`);
  }
  const capability = StringUtil.normalize(raw);
  const off = ["off", "no", "remove"].includes(StringUtil.normalize(cmd.positional[1] ?? cmd.named["off"] ?? ""));
  if (off) {
    if (fromTemplates.includes(capability)) {
      return sys(`${disp(char.name)} has "${capability}" from ${char.templates.join("+")} itself - `
        + `a sheet cannot take back what the template is. Change the template instead.`);
    }
    char.capabilities = (char.capabilities ?? []).filter(c => c !== capability);
    if (!char.capabilities.length) delete char.capabilities;
    await CharacterStore.save(char);
    return sys(`${disp(char.name)} is no longer attuned to "${capability}".`);
  }
  char.capabilities = [...new Set([...(char.capabilities ?? []), capability])];
  await CharacterStore.save(char);
  const views = await CharacterResources.all(char);
  const freed = views.filter(v => (v.def.requires ?? []).map(r => StringUtil.normalize(r)).includes(capability) && !v.blocked.length);
  return sys(`${disp(char.name)} is attuned to "${capability}"`
    + `${capabilityNote(capability) ? ` - ${capabilityNote(capability)}` : " (the engine knows no rule for it; nothing requires it)"}`
    + `${freed.length ? `. He can now spend ${freed.map(v => v.def.name).join(", ")}` : ""}.`);
}

// =============================================================================
// MAGIC - the Dark Ages: Mage casting procedure ([[cast]], [[seal-spell]])
// -----------------------------------------------------------------------------
// The numbers all come from MagicRules (rules.ts defaults overlaid with the
// wod:config:magic knob entry). Foundation and Pillar RATINGS live on the
// character (the free `traits` bucket; foundation= names the trait when the
// fellowship calls it something else); the REQUIRED levels are what the desired
// effect needs - play-time input, per pillar, never baked anywhere.
// =============================================================================
interface PillarReq { name: string; required: number; own: number }

// A trait the sheet ought to have but reads as 0 is USUALLY a lorebook edit
// that never synced: the pc: cards are only read back while creator mode is on
// (§7.20 - the router won't re-read the lorebook on every command). Say so
// where the player hits it, not just in the docs.
async function staleSheetHint(): Promise<string> {
  return (await CreatorMode.enabled())
    ? ` ([[show-sheet]] shows what the engine has.)`
    : ` If you just edited the sheet in the lorebook, it has NOT synced yet - `
      + `[[creator-mode set=true]] pulls it in on the next command ([[show-sheet]] shows what the engine has).`;
}

// "warrior:4,chieftain:2" -> requirements, with the caster's own ratings.
function parsePillars(raw: string, resolve: (n: string) => number): PillarReq[] | { error: string } {
  const out: PillarReq[] = [];
  for (const item of raw.split(",").map(s => s.trim()).filter(s => s.length > 0)) {
    const m = item.match(/^(.+?)[:=]\s*(\d+)$/);
    if (!m) return { error: `Can't read pillar "${item}" - use name:required-level (e.g. incantation:3).` };
    const name = StringUtil.normalize(m[1]);
    const required = parseInt(m[2], 10);
    if (required < 1) return { error: `Pillar level must be at least 1 in "${item}".` };
    out.push({ name, required, own: resolve(name) });
  }
  return out;
}

// Does spending this resource carry the fused-Willpower rider? (Living Resolve:
// any spend grants ONE un-cancelable success when a dice pool is involved.)
function grantsUncancelableOnSpend(def: ResourceDef): boolean {
  const specs = [def.effect, ...Object.values(def.effects ?? {})].filter((e): e is EffectSpec => !!e);
  return specs.some(e => e.apply.some(o => o.op.toLowerCase() === "uncancelable"));
}

// What `points` of the fused substance pay, read straight off the resource's
// default effect - so re-tuning the def moves the casting maths with it.
// The one rule that isn't a plain sum: a point lowers the difficulty ONCE, by
// the DEEPEST break any of its natures gives. Resolve's -2 and the
// Quintessence's -1 are the same break seen from two sides, not two breaks to
// add (the owner's ruling), so they are folded by depth, never summed.
// Successes are NOT the same: the Resolve's automatic success and the
// Willpower's un-cancelable one are different things and both land.
function fusedComponentExtra(def: ResourceDef, points: number, uncancelableLimit: number, tags: string[]): { extra: Partial<RollModifier>; bits: string[] } {
  const extra: Partial<RollModifier> = {};
  const bits: string[] = [];
  let deepest = 0;
  for (const op of def.effect?.apply ?? []) {
    // An op aimed at an action tag counts only when this roll carries it.
    if (op.target && !op.target.split(",").map(t => StringUtil.normalize(t)).some(t => tags.includes(t))) continue;
    const kind = op.op.toLowerCase();
    const total = (op.amount ?? 1) * points;
    if (kind === "difficulty") { deepest = Math.min(deepest, op.amount ?? 0); }
    else if (kind === "successes") { extra.autoSuccesses = (extra.autoSuccesses ?? 0) + total; bits.push(`+${total} automatic success${total === 1 ? "" : "es"}`); }
    else if (kind === "uncancelable") {
      const capped = Math.min(total, uncancelableLimit);
      extra.uncancelableSuccesses = (extra.uncancelableSuccesses ?? 0) + capped;
      bits.push(`${capped} un-cancelable success${capped === 1 ? "" : "es"}${total > capped ? ` (capped at ${uncancelableLimit})` : ""}`);
    } else if (kind === "nagain") {
      extra.nAgain = Math.min(extra.nAgain ?? 10, op.amount ?? 10);
      bits.push(`${op.amount ?? 10}-again`);
    }
  }
  if (deepest < 0) {
    extra.difficultyMod = (extra.difficultyMod ?? 0) + deepest * points;
    bits.push(`${deepest * points} difficulty`);
  }
  return { extra, bits };
}

// Which trait is this caster's Foundation? An explicit foundation= wins; else a
// literal "foundation" trait; else the first FELLOWSHIPS entry whose Foundation
// trait the caster actually has (Order of Hermes -> Modus). Returns the trait
// name plus the fellowship it came from, when that's how it was found.
export function resolveFoundation(arg: string | undefined, resolve: (n: string) => number, chosen?: string): { trait: string; rating: number; fellowship?: string } {
  if (arg?.trim()) { const t = StringUtil.normalize(arg); return { trait: t, rating: resolve(t) }; }
  // A character who CHOSE a fellowship casts on its Foundation, whatever else
  // they happen to have a rating in.
  const picked = chosen ? fellowshipByName(chosen) : undefined;
  if (picked) {
    const t = StringUtil.normalize(picked.foundation);
    return { trait: t, rating: resolve(t), fellowship: picked.name };
  }
  if (resolve("foundation") > 0) return { trait: "foundation", rating: resolve("foundation") };
  for (const f of Object.values(FELLOWSHIPS)) {
    const t = StringUtil.normalize(f.foundation);
    if (resolve(t) > 0) return { trait: t, rating: resolve(t), fellowship: f.name };
  }
  return { trait: "foundation", rating: 0 };
}

export async function cmdCast(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const rules = magicRulesFrom(MagicRulesConfig.current());

  const pillarsRaw = (cmd.named["pillars"] ?? cmd.positional[0])?.trim();
  if (!pillarsRaw) {
    return sys(`cast needs the required pillars, e.g. [[cast pillars="incantation:3"]] (simple) or [[cast pillars="warrior:4,chieftain:2"]] (complex). `
      + `Knobs: foundation=<trait> quintessence=N label=... requires=N extended=true interval="..." ongoing=true spend=...`);
  }
  const env = await characterRollEnv(char);
  const pillars = parsePillars(pillarsRaw, env.resolver);
  if ("error" in pillars) return sys(pillars.error);

  // The caster must know each Pillar at the required level...
  for (const p of pillars) {
    if (p.own < p.required) {
      return sys(`${disp(char.name)} has ${disp(p.name)} ${p.own} - the effect needs ${p.required}. `
        + `The spell is beyond their teaching.${await staleSheetHint()}`);
    }
  }
  // ...and have a Foundation to channel it through (their fellowship's, when
  // the sheet carries it - Order of Hermes casts on Modus).
  const found = resolveFoundation(cmd.named["foundation"], env.resolver, char.choices?.["fellowship"]);
  const foundationTrait = found.trait;
  const foundationRating = env.resolver(foundationTrait);
  if (foundationRating <= 0) {
    const known = Object.values(FELLOWSHIPS).map(f => `${disp(f.foundation)} (${f.name})`).join(", ");
    return sys(`${disp(char.name)} has no ${disp(foundationTrait)} rating. Put the Foundation in the sheet's traits bucket `
      + `(e.g. "modus": 3) or name it with foundation=<trait>. Known fellowships: ${known}.${await staleSheetHint()}`);
  }

  // The primary Pillar is the highest REQUIRED one (ties: the caster adds their
  // best score, per the book). Complex spells add 1 die and +1 difficulty per
  // additional Pillar.
  const sorted = [...pillars].sort((a, b) => b.required - a.required || b.own - a.own);
  const primary = sorted[0];
  const extras = pillars.length - 1;
  const complex = extras > 0;
  const pool = complex ? `${foundationTrait}+${primary.name}+${extras}` : `${foundationTrait}+${primary.name}`;
  let difficulty = complex ? rules.complexBase + primary.required + extras : rules.simpleBase + primary.required;
  const notes: string[] = [
    complex
      ? `complex spell: diff ${rules.complexBase}+${primary.required}+${extras} = ${difficulty}`
      : `simple spell: diff ${rules.simpleBase}+${primary.required} = ${difficulty}`,
  ];

  // Same-scene retries pile difficulty on: +1 per prior unsuccessful casting,
  // or +2 per prior attempt once one of them BOTCHED.
  const sceneName = (await SceneStore.currentName()) ?? "";
  const label = cmd.named["label"]?.trim() ?? "";
  const spellKey = label || pillars.map(p => `${p.name}:${p.required}`).join(",");
  const rec = await CastAttempts.get(char, sceneName, spellKey);
  if (rec.unsuccessful > 0) {
    const per = rec.botched ? rules.botchRetryPenalty : rules.retryPenalty;
    const penalty = per * rec.unsuccessful;
    difficulty += penalty;
    notes.push(`retry this scene: +${penalty} difficulty (${rec.unsuccessful} prior attempt${rec.unsuccessful === 1 ? "" : "s"}${rec.botched ? ", one botched" : ""})`);
  }

  // Quintessence: MANDATORY point when the effect outstrips the Foundation
  // (stabilization - no difficulty break), plus optional extra points at -1
  // difficulty each, all within the per-turn cap and the difficulty floor.
  const seed: Partial<RollModifier> = {};
  const castTags = [...CASTING_TAGS];
  const mandatory = primary.required > foundationRating ? 1 : 0;
  const requested = Math.max(0, intOrUndef(cmd.named["quintessence"] ?? cmd.named["quint"]) ?? 0);
  const fuelDef = CharacterResources.resolveDef(char, "magic-fuel");
  if (mandatory > 0 && !fuelDef) {
    return sys(`${disp(char.name)} can't cast: the effect (${disp(primary.name)} ${primary.required}) outstrips ${disp(foundationTrait)} ${foundationRating}, and casting then REQUIRES a point of Quintessence - but they have no magic-fuel resource.`);
  }
  // A FUSED point is never wasted at the Quintessence floor: its Willpower and
  // Resolve still have work to do, so only the per-turn cap and the pool bind,
  // and its whole break comes from the rider below. ORDINARY Quintessence has
  // nothing else to give, so only points that actually lower the difficulty
  // leave the pool - and they are the ones that lower it.
  const fused = !!fuelDef && grantsUncancelableOnSpend(fuelDef);
  let optional = Math.max(0, Math.min(requested, rules.quintPerTurn - mandatory));
  if (!fused) optional = Math.min(optional, Math.max(0, difficulty - rules.minDifficulty));
  if (fuelDef && (mandatory > 0 || optional > 0)) {
    const have = await CharacterResources.current(char, fuelDef);
    if (have < mandatory) {
      return sys(`${disp(char.name)} can't cast: ${disp(primary.name)} ${primary.required} outstrips ${disp(foundationTrait)} ${foundationRating}, so casting REQUIRES 1 ${fuelDef.name} - they have ${have}.`);
    }
    optional = Math.min(optional, have - mandatory);
    const total = mandatory + optional;
    if (total > 0) {
      await CharacterResources.spend(char, fuelDef.name, total);
      const bits: string[] = [];
      if (mandatory) bits.push(`1 to stabilize (${disp(primary.name)} ${primary.required} > ${disp(foundationTrait)} ${foundationRating})`);
      if (optional) bits.push(fused ? `${optional} more` : `${optional} for -${optional} difficulty`);
      notes.push(`${fuelDef.name}: ${bits.join(" + ")}`);
      if (optional < requested) {
        // Name the limiter that actually bound. The difficulty floor only stops
        // an ORDINARY Quintessence point - a fused one still has three other
        // components to pay, so it is spent regardless.
        const why = [`cap ${rules.quintPerTurn}/turn`, `pool ${have}`];
        if (!fused && difficulty - rules.minDifficulty < requested) why.unshift(`min diff ${rules.minDifficulty}`);
        notes.push(`only ${optional} of ${requested} points could be spent (${why.join(", ")})`);
      }
      if (total > rules.quintFreeLimit) notes.push(`spending >${rules.quintFreeLimit}/turn needs the Fount Background (ST)`);
      if (fused) {
        // Every point spent here IS a Quintessence and a Willpower and a Resolve
        // at once, so its whole payout comes from one place - including the
        // difficulty break, which is Resolve's rather than Resolve's plus the
        // Quintessence's. The mandatory point pays it too: it is the same
        // substance, not a fee taken off the top.
        const rider = fusedComponentExtra(fuelDef, total, uncancelableCap(foundationRating, rules), castTags);
        for (const [k, v] of Object.entries(rider.extra) as Array<[keyof RollModifier, number]>) {
          if (k === "nAgain") seed.nAgain = Math.min(seed.nAgain ?? 10, v);
          else (seed as Record<string, number>)[k] = ((seed as Record<string, number>)[k] ?? 0) + v;
        }
        if (rider.bits.length) {
          notes.push(`all ${total} point${total === 1 ? "" : "s"} spend as Quintessence AND Willpower AND Resolve at once: ${rider.bits.join(", ")}`);
        }
      } else {
        difficulty -= optional;
      }
    }
  } else if (requested > 0 && !fuelDef) {
    notes.push(`no magic-fuel resource - the requested Quintessence reduction is skipped`);
  }

  // The spell's roll: over the cap, difficulty converts to extra required
  // successes (resolveSpec notes it); reductions buy those off first.
  const requires = Math.max(1, intOrUndef(cmd.named["requires"]) ?? 1);
  const ongoing = flagOf(cmd, "ongoing") === true;
  const extended = ongoing || flagOf(cmd, "extended") === true;
  const spec = makeRollSpec({
    pool, difficulty, requires: extended ? 1 : requires,
    tags: castTags, difficultyCap: rules.difficultyCap,
  });

  // spend= rides along (Living Resolve's focus/fuel-surge, a plain Willpower...).
  const poolTraits = poolTraitsOf(char, pool);
  const spend = await applySpend(char, cmd, ctx, spec.tags, poolTraits);
  if (spend.refuse) return sys(`${disp(char.name)} can't cast: ${spend.refuse}.`);
  if (spend.extra) {
    if (spend.extra.difficultyMod) seed.difficultyMod = (seed.difficultyMod ?? 0) + spend.extra.difficultyMod;
    if (spend.extra.diceMod) seed.diceMod = (seed.diceMod ?? 0) + spend.extra.diceMod;
    if (spend.extra.autoSuccesses) seed.autoSuccesses = (seed.autoSuccesses ?? 0) + spend.extra.autoSuccesses;
    if (spend.extra.uncancelableSuccesses) {
      // A spend= rider and the fuel's own grant are the same certainty - take
      // the larger, then let the Foundation cap stand.
      seed.uncancelableSuccesses = Math.min(
        uncancelableCap(foundationRating, rules),
        Math.max(seed.uncancelableSuccesses ?? 0, spend.extra.uncancelableSuccesses));
    }
    if (spend.extra.nAgain !== undefined) seed.nAgain = Math.min(seed.nAgain ?? 10, spend.extra.nAgain);
  }
  if (spend.note) notes.push(spend.note);

  const spellName = label ? `"${label}"` : `${pillars.map(p => `${disp(p.name)} ${p.required}`).join(" + ")}`;

  if (extended) {
    // Extended / ongoing: successes accrue over intervals; a botch ends the
    // casting (Backlash + every accrued success lost) unless on-botch says
    // otherwise. Ongoing spells need x10 successes and per-success fuel.
    const target = ongoing ? requires * rules.ongoingMultiplier : requires;
    if (!intOrUndef(cmd.named["requires"])) return sys(`An ${ongoing ? "ongoing" : "extended"} casting needs requires=N (the Storyteller's success total${ongoing ? ` - it is then ×${rules.ongoingMultiplier}` : ""}).`);
    if (ongoing) notes.push(`ongoing spell: ${requires}×${rules.ongoingMultiplier} = ${target} successes; fuel ${rules.ongoingFuelPerSuccess} magic-fuel per success as they land (ST-enforced); seal with [[seal-spell pillar=${primary.required}]] at the end`);
    const maxRolls = intOrUndef(cmd.named["intervals"]) ?? 20;
    return launchExtended(char, spec, {
      target, maxRolls,
      interval: cmd.named["interval"] ?? "",
      onBotch: parseBotchPolicy(cmd.named["on-botch"]),   // default "fail": a botch ends the casting
      label: label ? `cast: ${label}` : `cast: ${spellKey}`,
      firstExtra: seed, preNotes: notes,
      stepsTail: ` A botch is Backlash: successes lost, the Storyteller describes the price.`,
    }, ctx);
  }

  const { exec, notes: execNotes } = await execCharacterRoll(char, spec, ctx, seed);
  await CastAttempts.record(char, sceneName, spellKey, exec.outcome === "botch" ? "botch" : exec.outcome === "success" ? "success" : "failure");
  // In their own sanctum a mage is immune to Backlash at ANY rating - the spell
  // still fails utterly, but the power doesn't turn on them.
  const inSanctum = (await CharacterAfflictions.list(char.name)).some(a => a.def === "in-sanctum");
  const backlash = exec.outcome !== "botch" ? ""
    : inSanctum
      ? ` The spell fails utterly - but this is their sanctum: NO Backlash (retrying this scene: +${rules.botchRetryPenalty}/attempt).`
      : ` ⚡ BACKLASH - the spell fails utterly and the power turns on the caster (Storyteller describes; retrying this scene: +${rules.botchRetryPenalty}/attempt).`;
  const allNotes = [...notes, ...execNotes].filter(Boolean).join("; ");
  return sys(`${disp(char.name)} casts ${spellName} - ${formatExecution(exec)}${allNotes ? ` [${allNotes}]` : ""}.${backlash}`);
}

// The permanence seal on an ongoing spell: 5 Quintessence per dot of the
// highest Pillar involved + 1 Willpower per 10 of that Quintessence (rounded
// up). A fused payer (one resource filling both roles - Living Resolve) covers
// both components with the same points. pay=true spends now; otherwise the
// price is quoted, payable over time (ST tracks the debt).
export async function cmdSealSpell(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const rules = magicRulesFrom(MagicRulesConfig.current());
  const level = parseInt(cmd.named["pillar"] ?? cmd.positional[0] ?? "", 10);
  if (Number.isNaN(level) || level < 1) return sys(`seal-spell needs the highest Pillar level involved, e.g. [[seal-spell pillar=3]].`);
  const sealQ = rules.sealPerPillarDot * level;
  const sealW = Math.ceil(sealQ / rules.sealWillpowerPer);
  const price = `${sealQ} Quintessence + ${sealW} Willpower (1 per ${rules.sealWillpowerPer}, rounded up)`;

  const fuelDef = CharacterResources.resolveDef(char, "magic-fuel");
  const willDef = CharacterResources.resolveDef(char, "willpower");
  const fused = fuelDef && willDef && StringUtil.normalize(fuelDef.name) === StringUtil.normalize(willDef.name);

  if (flagOf(cmd, "pay") !== true) {
    const how = fused ? ` ${fuelDef.name} is the fused substance - the same ${Math.max(sealQ, sealW)} points cover both components.` : "";
    return sys(`Sealing (highest Pillar ${level}): ${price}.${how} Payable over time (ST tracks the debt) - [[seal-spell pillar=${level} pay=true]] to spend now.`);
  }

  const linesOut: string[] = [];
  if (fused) {
    const cost = Math.max(sealQ, sealW);
    const { spent } = await CharacterResources.spend(char, fuelDef.name, cost);
    const now = await CharacterResources.current(char, fuelDef);
    linesOut.push(`${spent}/${cost} ${fuelDef.name} (the fused substance covers both components) -> ${now}/${resourceNumbers(char, fuelDef).max}`);
    if (spent < cost) linesOut.push(`${cost - spent} still owed - payable over time (ST tracks the debt)`);
  } else {
    if (fuelDef) {
      const { spent } = await CharacterResources.spend(char, fuelDef.name, sealQ);
      linesOut.push(`${spent}/${sealQ} ${fuelDef.name}${spent < sealQ ? ` (${sealQ - spent} owed)` : ""}`);
    } else linesOut.push(`no magic-fuel resource - ${sealQ} Quintessence owed (ST tracks)`);
    if (willDef) {
      const { spent } = await CharacterResources.spend(char, willDef.name, sealW);
      linesOut.push(`${spent}/${sealW} ${willDef.name}${spent < sealW ? ` (${sealW - spent} owed)` : ""}`);
    } else linesOut.push(`no willpower resource - ${sealW} Willpower owed (ST tracks)`);
  }
  return sys(`${disp(char.name)} seals the spell (highest Pillar ${level}; ${price}): ${linesOut.join("; ")}.`);
}

// The fellowships the engine knows: their Foundation and Pillars, so a caster
// can see what [[cast]] expects in the sheet's traits bucket.
export async function cmdFellowships(cmd: ParsedCommand): Promise<string> {
  const which = cmd.positional[0]?.trim();
  const entries = Object.entries(FELLOWSHIPS);
  if (which) {
    const key = StringUtil.normalize(which);
    const hit = fellowshipByName(key);
    if (!hit) return sys(`No fellowship "${which}". Known: ${entries.map(([k]) => k).join(", ")}.`);
    const pillars = Object.entries(hit.pillars).map(([p, gloss]) => `${disp(p)} (${gloss})`).join(", ");
    return sys(`${hit.name} - Foundation: ${disp(hit.foundation)}${hit.foundationGloss ? ` (${hit.foundationGloss})` : ""}. `
      + `Pillars: ${pillars}. Rate them in the sheet's traits bucket; [[cast]] finds the Foundation on its own.`);
  }
  if (!entries.length) return sys(`No fellowships defined.`);
  const items = entries.map(([k, f]) => `${k}: ${disp(f.foundation)} + ${Object.keys(f.pillars).map(p => disp(p)).join("/")}`).join("; ");
  return sys(`Fellowships - ${items}. Detail with [[show-fellowship <name>]].`);
}
