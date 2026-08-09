// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { CommandContext, CommandRouter, ParamSpec, ParsedCommand, flagOf, sys } from "../command";
import { SYSTEM } from "../core/bus";
import { CardValue, formatCardText } from "../core/cardtext";
import { formatStoryDate, parseDuration } from "../core/time";
import { StringUtil } from "../core/traits";
import { ABILITY_CATEGORIES, ALL_TRAIT_CATEGORIES, ATTRIBUTE_CATEGORIES, CAPABILITIES, CONSTRAINT_DOMAINS, CONSTRAINT_RELATIONS, GRANT_SOURCES, LIFT_POLICIES, SOAK_TABLES, describeExpiry, describeLift, disciplineDef, liftPolicyOf } from "../rules";
import { ArcanumRegistry, KEY, LorebookManager, MeritFlawRegistry, PostOffice, TrackedLorebook, namedDefsToCard, reloadAllConfigStores } from "../services";
import { AliasRef, AliasRegistry, AliasScope, CharacterAfflictions, CharacterCooldowns, CharacterResources, CharacterStore, CreatorMode, PLAYER_CHARACTERS_CATEGORY, PlayableCharacter, PlayerStore, StoryClock, TraitInstance, characterToCard, parseAliasToken, resolveAffliction, traitInCategory, traitKindOf } from "../state";
import { CREATION_FIELDS, cmdBackground, cmdBackgrounds, cmdBudget, cmdChoose, cmdClans, cmdCosts, cmdCreation, cmdDefineBackground, cmdDefineResource, cmdDerived, cmdEval, cmdExtendTemplate, cmdForgetBackground, cmdForgetTemplate, cmdGrant, cmdPaid, cmdSupernatural, cmdTemplates, cmdUngrant } from "./character";
import { cmdCreatePlayable, cmdCreatorMode, cmdPlay, disp, intOrUndef, noCharacter } from "./common";
import { cmdCancelContest, cmdContest, cmdContestStatus, cmdContinueContest, cmdExtendedContest, cmdResist } from "./contests";
import { cmdFlushContext } from "./context";
import { applySpend, characterRollEnv, cmdAddStep, cmdAttune, cmdCancelRoll, cmdCast, cmdClearSteps, cmdContinueRoll, cmdExtendedRoll, cmdFellowships, cmdForgetRoll, cmdListRolls, cmdNameRoll, cmdResources, cmdRoll, cmdRollFor, cmdRollInfo, cmdRollStatus, cmdSealSpell } from "./effects";
import { cmdDefineTable, cmdDefineTableCategory, cmdForgetTable, cmdForgetTableAlias, cmdHide, cmdTableAlias, cmdTables, reconcileLorebook } from "./narration";
import { cmdAbsorb, cmdCancelWizard, cmdClearBoosts, cmdConfigureResources, cmdCray, cmdDamage, cmdGain, cmdHarvest, cmdHealth, cmdLeaveLibrary, cmdMeasureDoor, cmdResearch, cmdResetUses, cmdSetCray, cmdSpend, enterPlace } from "./places";
import { afflictionLine, afflictionSubject, applyPassiveGrant, cmdAdvance, cmdAfflict, cmdAfflictionInfo, cmdArcana, cmdArcanumInfo, cmdCheckConstraints, cmdConstraint, cmdConstraints, cmdDefineAffliction, cmdDefineArcanum, cmdDefineConstraint, cmdDefineMerit, cmdDropArcanum, cmdDropMerit, cmdForgetAffliction, cmdForgetArcanum, cmdForgetConstraint, cmdForgetMerit, cmdForgetSpecialty, cmdInvoke, cmdMeritInfo, cmdMerits, cmdSpecialties, cmdSpecialty, cmdTakeArcanum, cmdTakeMerit, cmdToggle, cooldownLeft, expiryFromArgs, removeAffliction, resolveBindingValue } from "./powers";
import { cmdAdvanceTime, cmdDates, cmdDowntime, cmdEndScene, cmdForgetDate, cmdForgetScene, cmdSaveDate, cmdScene, cmdSceneInfo, cmdScenes, cmdStoryDate, cmdStoryStart, cmdTimeBetween, cmdTurn } from "./time";

// =============================================================================
// HELD DOWN, ENDED, AND BACK - three things, three verbs
// -----------------------------------------------------------------------------
// [[lift]]    holds it down. He is still under it; the relief runs out.
// [[remove]]  ends it. The thing causing it is gone.
// [[restore]] ends the relief early - it bites again now.
//
// The engine had one word for the first two, which made Majesty unsayable: you
// buy an hour free of it and you are STILL under Majesty, and what ends it is
// walking out of his presence.
// =============================================================================
async function cmdLift(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const name = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!name) return sys(`lift needs an affliction, e.g. [[lift majesty spend=willpower]]. `
    + `Lifting HOLDS IT DOWN - [[remove ${"<affliction>"}]] is what ends one.`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  const from = cmd.named["from"]?.trim();
  const held = (await CharacterAfflictions.list(subject.name!))
    .filter(a => a.def === name && (!from || StringUtil.normalize(a.from ?? "") === StringUtil.normalize(from)));
  if (!held.length) {
    return sys(`${disp(subject.name!)} does not have "${name}"${from ? ` from ${from}` : ""}. [[show-affliction]] lists them.`);
  }
  if (held.every(a => a.suspended)) return sys(`${name} is already held down on ${disp(subject.name!)}.`);
  const def = resolveAffliction(name);
  const policy = liftPolicyOf(def);
  const waived = flagOf(cmd, "waive") === true;
  // WHO MAY, AND AT WHAT PRICE. `never` is the default, because most
  // afflictions are not shruggable and a permissive default would quietly make
  // every one of them optional.
  if (policy === "never" && !waived) {
    return sys(`${name} ${describeLift(def?.lift)}. `
      + `Something else may hold it down (an affliction that suppresses it), [[remove ${name}]] ends it, `
      + `or add waive=true.`);
  }
  let spendNote = "";
  const wants = def?.lift?.cost;
  if (policy === "cost" && !waived) {
    const paying = cmd.named["spend"] ?? wants;
    if (!paying) return sys(`${name} is held down by paying, and its definition names no cost - give spend=<resource>.`);
    const char = await CharacterStore.load(subject.name!);
    if (!char) return sys(`${disp(subject.name!)} has no sheet to spend from.`);
    const spend = await applySpend(char, { ...cmd, named: { ...cmd.named, spend: paying } }, ctx, [], []);
    if (spend.refuse) return sys(`${disp(char.name)} can't: ${spend.refuse}.`);
    spendNote = spend.note ? ` (${spend.note})` : "";
  } else if (cmd.named["spend"]) {
    const char = await CharacterStore.load(subject.name!);
    if (char) {
      const spend = await applySpend(char, cmd, ctx, [], []);
      if (spend.refuse) return sys(`${disp(char.name)} can't: ${spend.refuse}.`);
      spendNote = spend.note ? ` (${spend.note})` : "";
    }
  }
  // HOW LONG the relief lasts: what was asked for, else what the definition
  // says, else until somebody restores it.
  const asked = await expiryFromArgs(cmd);
  if (asked.error) return sys(asked.error);
  let until = asked.value;
  if (!until && def?.lift?.for) {
    // "1 scene" / "3 rolls" / "1 hour" - the same three measures an expiry has,
    // read off the definition when the command names none.
    const spoken = StringUtil.normalize(def.lift.for);
    const counted = spoken.match(/^(\d+)-(roll|turn|scene)s?$/);
    if (counted) {
      const n = parseInt(counted[1], 10);
      until = counted[2] === "roll" ? { rolls: n } : counted[2] === "turn" ? { turns: n } : { scenes: n };
    } else {
      const parsed = parseDuration(def.lift.for);
      if (!("error" in parsed)) {
        const clock = await StoryClock.get();
        if (clock) until = { until: clock.now + parsed.seconds + parsed.months * 2_592_000 };
      }
    }
  }
  const now = (await StoryClock.get())?.now;
  const touched = await CharacterAfflictions.update(subject.name!,
    a => a.def === name && !a.suspended && (!from || StringUtil.normalize(a.from ?? "") === StringUtil.normalize(from)),
    a => { a.suspended = { by: "self", ...(until ? { until } : {}), ...(now !== undefined ? { at: now } : {}) }; });
  // Holding a suppressor down releases whatever IT was holding down.
  const knock = await CharacterAfflictions.refreshSuppression(subject.name!);
  const forHow = until ? ` for ${describeExpiry(until, formatStoryDate) || "a while"}` : " until restored";
  return sys(`${disp(subject.name!)} holds off ${name}${touched.length > 1 ? ` (${touched.length} of them)` : ""}`
    + `${spendNote}${forHow}. It is still on ${disp(subject.name!)} - [[restore ${name}]] ends the relief, `
    + `[[remove ${name}]] ends the affliction.${knock.length ? ` ${knock.join("; ")}.` : ""}`);
}

// [[restore]] - the relief is over, it bites again.
async function cmdRestore(cmd: ParsedCommand): Promise<string> {
  const name = StringUtil.normalize(cmd.positional[0]?.trim() ?? "");
  if (!name) return sys(`restore needs an affliction, e.g. [[restore majesty]].`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  const touched = await CharacterAfflictions.update(subject.name!,
    a => a.def === name && a.suspended?.by === "self",
    a => { delete a.suspended; });
  if (!touched.length) {
    const anyHeld = (await CharacterAfflictions.list(subject.name!)).find(a => a.def === name && a.suspended);
    return anyHeld
      ? sys(`${name} is held down by ${anyHeld.suspended!.by}, not by ${disp(subject.name!)} - that has to go first.`)
      : sys(`${name} is not being held down on ${disp(subject.name!)}.`);
  }
  const knock = await CharacterAfflictions.refreshSuppression(subject.name!);
  return sys(`${name} takes hold of ${disp(subject.name!)} again.${knock.length ? ` ${knock.join("; ")}.` : ""}`);
}

// [[remove]] - it is over. The thing causing it is gone.
async function cmdRemoveAffliction(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`remove needs an affliction, e.g. [[remove majesty]] (or [[lift]] to hold it down instead).`);
  const subject = await afflictionSubject(cmd);
  if (subject.error) return sys(`${subject.error}`);
  let spendNote = "";
  if (cmd.named["spend"]) {
    const char = await CharacterStore.load(subject.name!);
    if (!char) return sys(`${disp(subject.name!)} has no sheet to spend from.`);
    const spend = await applySpend(char, cmd, ctx, [], []);
    if (spend.refuse) return sys(`${disp(char.name)} can't: ${spend.refuse}.`);
    spendNote = spend.note ? ` (${spend.note})` : "";
  }
  const r = await removeAffliction(subject.name!, name, cmd.named["from"]?.trim());
  if (r.error) return sys(`${r.error}`);
  const knock = await CharacterAfflictions.refreshSuppression(subject.name!);
  const also = r.alsoLifted ? `; ${r.alsoLifted}` : "";
  return sys(`${disp(subject.name!)} is free of ${r.removed!.def}${spendNote}${also}.${knock.length ? ` ${knock.join("; ")}.` : ""}`);
}

export async function cmdAfflictions(cmd: ParsedCommand): Promise<string> {
  let subject: string;
  const arg = cmd.positional[0]?.trim();
  if (arg) {
    const r = await resolveBindingValue(arg);
    if (r.error) return sys(`${r.error}`);
    subject = r.value!;
  } else {
    const cur = await CharacterStore.getCurrent();
    if (!cur) return noCharacter(`or name someone: [[show-affliction "Wolf"]]`);
    subject = StringUtil.normalize(cur.name);
  }
  const list = await CharacterAfflictions.list(subject);
  const char = await CharacterStore.load(subject);   // a sheet lets scaled afflictions report their tiers
  // What is COOLING belongs on the same listing: "why can't I do that again"
  // is the same question as "what is on me", asked from the other side. The
  // read sweeps expired cooldowns on its way past, so nothing else has to.
  const cooling: string[] = [];
  for (const def of Object.keys(await CharacterCooldowns.all(subject))) {
    const left = await cooldownLeft(char ?? undefined, subject, def);
    if (left) cooling.push(`${disp(def)} (cooling - ${left})`);
  }
  if (!list.length && !cooling.length) return sys(`${disp(subject)} has no afflictions.`);
  const bits = [...list.map(c => afflictionLine(c, char)), ...cooling];
  return sys(`${disp(subject)} - ${bits.join("; ")}.`);
}

// --- ALIASES & PLAYERS ------------------------------------------------------
// A character argument may be a real name or an @alias; this is the ONE place
// that turns either into a concrete (normalized) character name. Pool-position
// @ is different machinery (saved rolls) and never comes through here.

// Resolve an explicit-scope owner ("default" -> the default player/character).
async function resolveAliasOwner(ref: AliasRef): Promise<string | undefined> {
  if (!ref.owner) return undefined;
  if (ref.scope === "player") return ref.owner === "default" ? PlayerStore.getDefault() : ref.owner;
  if (ref.owner === "default") return CharacterStore.getDefaultName();
  return ref.owner;
}

export async function resolveCharacterRef(token: string): Promise<{ name?: string; error?: string }> {
  const t = StringUtil.normalize(token);
  if (!t.startsWith("@")) return { name: t };
  const ref = parseAliasToken(t);
  if (!ref) return { error: `Malformed alias "${t}" - use @alias, @global::a, @player::<id>::a or @char::<name>::a.` };
  let target: string | undefined;
  if (ref.scope) {
    const owner = await resolveAliasOwner(ref);
    if (ref.scope !== "global" && !owner) return { error: `Alias "${t}" names no ${ref.scope} to look in.` };
    target = await AliasRegistry.lookup(ref.scope, owner, ref.alias);
  } else {
    const cur = await CharacterStore.getCurrent();
    target = await AliasRegistry.resolve(ref.alias, {
      charKey: cur ? StringUtil.normalize(cur.name) : undefined,
      playerKey: await PlayerStore.current(),
    });
  }
  return target ? { name: target } : { error: `Unknown alias "@${ref.alias}". [[show-alias]] lists them; [[alias @${ref.alias} "Name"]] defines it.` };
}

// Define (or overwrite) an alias. Bare @alias defines GLOBAL; the explicit
// prefixes pin a scope ("@char::default::sire" = the default character's).
async function cmdAlias(cmd: ParsedCommand): Promise<string> {
  const token = cmd.positional[0]?.trim();
  const target = (cmd.named["to"] ?? cmd.positional[1])?.trim();
  if (!token || !token.startsWith("@") || !target) {
    return sys(`alias needs an @token and a target, e.g. [[alias @kat "Katarina"]] or [[alias @char::erik::sire "Katarina"]].`);
  }
  if (target.startsWith("@")) return sys(`An alias must point at a character name, not another alias.`);
  const ref = parseAliasToken(StringUtil.normalize(token));
  if (!ref) return sys(`Malformed alias "${token}" - use @alias, @global::a, @player::<id>::a or @char::<name>::a.`);
  const scope: AliasScope = ref.scope ?? "global";
  const owner = ref.scope ? await resolveAliasOwner(ref) : undefined;
  if (scope !== "global" && !owner) return sys(`Alias "${token}" names no ${scope} to define it for.`);
  await AliasRegistry.set(scope, owner, ref.alias, target);
  const where = scope === "global" ? "globally" : `for ${scope} ${disp(owner!)}`;
  return sys(`@${ref.alias} now means ${disp(StringUtil.normalize(target))} ${where}.`);
}

export async function cmdAliases(): Promise<string> {
  const m = await AliasRegistry.all();
  const bits: string[] = [];
  const fmt = (map: Record<string, string>): string => Object.entries(map).map(([a, t]) => `@${a}->${disp(t)}`).join(", ");
  if (Object.keys(m.global).length) bits.push(`global: ${fmt(m.global)}`);
  for (const [p, map] of Object.entries(m.players)) if (Object.keys(map).length) bits.push(`player ${disp(p)}: ${fmt(map)}`);
  for (const [c, map] of Object.entries(m.characters)) if (Object.keys(map).length) bits.push(`character ${disp(c)}: ${fmt(map)}`);
  if (!bits.length) return sys(`No aliases defined. Add one with [[alias @kat "Katarina"]].`);
  return sys(`Aliases - ${bits.join(" | ")}.`);
}

async function cmdForgetAlias(cmd: ParsedCommand): Promise<string> {
  const token = cmd.positional[0]?.trim();
  if (!token || !token.startsWith("@")) return sys(`forget-alias needs an @token, e.g. [[forget-alias @kat]] or [[forget-alias @char::erik::sire]].`);
  const ref = parseAliasToken(StringUtil.normalize(token));
  if (!ref) return sys(`Malformed alias "${token}".`);
  const scope: AliasScope = ref.scope ?? "global";
  const owner = ref.scope ? await resolveAliasOwner(ref) : undefined;
  if (scope !== "global" && !owner) return sys(`Alias "${token}" names no ${scope} to forget it from.`);
  return (await AliasRegistry.remove(scope, owner, ref.alias))
    ? sys(`Forgot @${ref.alias}${scope === "global" ? "" : ` (${scope} ${disp(owner!)})`}.`)
    : sys(`No such alias @${ref.alias}${scope === "global" ? "" : ` for ${scope} ${disp(owner!)}`}.`);
}

// The current player is whoever is issuing commands; the default player is what
// "default" resolves to in alias scopes (the human, in a single-player story).
export async function cmdPlayer(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) {
    const cur = await PlayerStore.current();
    const def = await PlayerStore.getDefault();
    return sys(`Current player: ${disp(cur)}; default player: ${disp(def)}. [[player name="..."]] switches.`);
  }
  await PlayerStore.setCurrent(name);
  let note = "";
  if (flagOf(cmd, "default") === true) { await PlayerStore.setDefault(name); note = " (also the default player now)"; }
  return sys(`Current player is now ${disp(StringUtil.normalize(name))}${note}.`);
}

// --- DISCOVERABILITY -------------------------------------------------------
// [[help]] surfaces the command registry; [[show-character]] and [[set-default]]
// round out character selection (creation sets the first default; this changes it).
async function cmdHelp(cmd: ParsedCommand): Promise<string> {
  const verb = cmd.positional[0]?.trim().toLowerCase();
  if (verb) {
    const help = CommandRouter.helpFor(verb);
    return help
      ? sys(`${verb} - ${help}`)
      : sys(`No command "${verb}". [[help]] lists them all.`);
  }
  // THE ONLY vocabulary. The old names are gone rather than hidden (§7.92), so
  // this listing is now the complete truth about what the engine answers to.
  const verbs = CommandRouter.verbs();
  return sys(`${verbs.length} commands: ${verbs.join(", ")}. [[help <verb>]] for one's usage. `
    + `Anything named show-* only LOOKS at things, and its reply is kept out of the AI's context `
    + `(add in-story=true to keep one).`);
}

export async function cmdCharacters(): Promise<string> {
  const names = await CharacterStore.listNames();
  if (!names.length) return sys(`No characters yet. Make one with [[create-playable name="..." templates="..."]].`);
  const currentName = (await CharacterStore.getCurrent())?.name;
  const currentKey = currentName ? StringUtil.normalize(currentName) : undefined;
  const defKey = await CharacterStore.getDefaultName();
  const items: string[] = [];
  for (const key of names) {
    const c = await CharacterStore.load(key);
    const marks: string[] = [];
    if (key === currentKey) marks.push("current");
    if (key === defKey) marks.push("default");
    items.push(marks.length ? `${disp(c?.name ?? key)} (${marks.join(", ")})` : disp(c?.name ?? key));
  }
  return sys(`Characters: ${items.join("; ")}. [[play name="..."]] to switch.`);
}

// set-trait <name> <rating> - the writing counterpart of [[show-sheet]]. Merits have
// [[take-merit]] and specialties have [[specialty]]; every OTHER rating - an
// Attribute, an Ability, a Background, a Discipline, a Pillar - had only the
// lorebook card, which is fine until you want one command. The group is
// inferred from what the trait already is (traitKindOf), named with group=, or
// falls back to the free `traits` bucket.
const TRAIT_GROUPS: Record<string, keyof PlayableCharacter> = {
  attribute: "attributes", attributes: "attributes",
  ability: "abilities", abilities: "abilities",
  background: "backgrounds", backgrounds: "backgrounds",
  virtue: "virtues", virtues: "virtues",
  discipline: "disciplines", disciplines: "disciplines",
  trait: "traits", traits: "traits",
  pool: "poolStarts", pools: "poolStarts", "pool-starts": "poolStarts",
};

// What the chronicle's own lists say a name is - the lorebook is the authority
// on which Abilities and Backgrounds exist.
async function srdGroupOf(trait: string): Promise<string | undefined> {
  const key = StringUtil.normalize(trait);
  const has = (list: string[]): boolean => list.some(n => StringUtil.normalize(n) === key);
  if (has(await LorebookManager.allBackgrounds())) return "background";
  for (const list of [LorebookManager.allTalents, LorebookManager.allSkills, LorebookManager.allKnowledges]) {
    if (has(await list())) return "ability";
  }
  return undefined;
}

async function cmdSetTrait(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const rawName = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!rawName) {
    return sys(`set-trait needs a trait and a rating, e.g. [[set-trait sanctum 8]] or `
      + `[[set-trait mentor 5 note=\`his mother\` paid=0]]. Groups: ${Object.keys(TRAIT_GROUPS).filter(g => !g.endsWith("s")).join(", ")}.`);
  }
  const trait = StringUtil.normalize(rawName);
  const rating = intOrUndef((cmd.named["rating"] ?? cmd.positional[1]) ?? "");
  if (rating === undefined) return sys(`set-trait needs a rating, e.g. [[set-trait ${trait} 3]].`);

  // The character's own buckets answer first; failing that the chronicle's SRD
  // lists do, so a Background nobody has rated yet still files as a Background
  // rather than landing in the free `traits` bucket.
  const askedGroup = StringUtil.normalize(cmd.named["group"] ?? "");
  const kind = traitKindOf(char, trait) ?? await srdGroupOf(trait);
  const group = askedGroup ? TRAIT_GROUPS[askedGroup] : TRAIT_GROUPS[kind ?? ""] ?? "traits";
  if (askedGroup && !group) {
    return sys(`No trait group "${askedGroup}". Known: ${[...new Set(Object.values(TRAIT_GROUPS))].join(", ")}.`);
  }
  const bucket = char[group] as Record<string, number>;
  const had = trait in bucket ? bucket[trait] : undefined;

  const note = cmd.named["note"]?.trim();
  const paid = cmd.named["paid"]?.trim();
  const add = flagOf(cmd, "add") === true;
  if (add || note !== undefined || (char.instances?.[trait]?.length ?? 0) > 1) {
    // More than one of the same Background: keep them as instances, each with
    // its own note and its own price.
    const list = add ? [...(char.instances?.[trait] ?? [])] : [];
    if (add && !list.length && had !== undefined) list.push({ rating: had });
    const inst: TraitInstance = { rating };
    if (note) inst.note = note;
    if (paid !== undefined) inst.paid = paid;
    list.push(inst);
    char.instances = { ...(char.instances ?? {}), [trait]: list };
    bucket[trait] = Math.max(...list.map(i => i.rating));
  } else {
    bucket[trait] = rating;
    if (char.instances?.[trait]) { const rest = { ...char.instances }; delete rest[trait]; char.instances = rest; }
    if (paid !== undefined) char.paid = { ...(char.paid ?? {}), [trait]: paid };
  }
  await CharacterStore.save(char);
  // A Discipline that is simply ON (Potence, Fortitude) applies its passive the
  // moment it is rated, and takes it away again at 0 - the same rule the take
  // verbs follow, because a Discipline is a power like any other.
  let passiveNote = "";
  const disc = group === "disciplines" ? disciplineDef(trait) : undefined;
  if (disc?.grants) {
    const who = StringUtil.normalize(char.name);
    if (rating > 0 && (had ?? 0) <= 0) passiveNote = ` ${await applyPassiveGrant(who, "discipline", trait, disc.grants, { rating })}.`;
    else if (rating <= 0 && (had ?? 0) > 0) {
      const lost = await PostOffice.publish(SYSTEM.powerLost, { character: who, kind: "discipline", key: trait });
      const said = (lost.data as { said?: string }).said;
      if (said) passiveNote = ` ${said}.`;
    }
  }
  const held = char.instances?.[trait];
  const shown = held && held.length > 1
    ? held.map(i => `${i.rating}${i.note ? ` (${i.note})` : ""}`).join(" + ")
    : String(bucket[trait]);
  return sys(`${disp(char.name)} ${group === "poolStarts" ? "pool start" : StringUtil.normalize(group).replace(/ies$/, "y").replace(/s$/, "")} `
    + `${disp(trait)}: ${shown}${had !== undefined && !add ? ` (was ${had})` : ""}`
    + `${paid !== undefined ? `, paid ${paid}` : ""}.${passiveNote} [[show-sheet]] shows the whole record.`);
}

// --- MIGRATION: the one place that still understands the old JSON cards ------
// Cards written before the readable format hold JSON. Nothing READS that any
// more (core/cardtext.ts is the only card language), so this rewrites them in
// place: same header, same data, new language. Idempotent - a card already in
// the new format is not JSON and is left alone - and safe on a card the engine
// doesn't own, because only wod:/srd: categories are visited.
function jsonCardBody(text: string): CardValue | undefined {
  const body = LorebookManager.contentBelowHeader(text).trim();
  if (!body.startsWith("{") && !body.startsWith("[")) return undefined;
  try { return JSON.parse(body) as CardValue; } catch { return undefined; }
}

async function cmdConvertCards(): Promise<string> {
  const converted: string[] = [];
  const failed: string[] = [];
  for (const cat of await api.v1.lorebook.categories()) {
    const category = (cat.name ?? "").trim().toLowerCase();
    if (!category.startsWith("wod:") && !category.startsWith("srd:")) continue;
    for (const entry of await api.v1.lorebook.entries(cat.id)) {
      const text = entry.text ?? "";
      const parsed = jsonCardBody(text);
      if (parsed === undefined) continue;
      const label = (entry.displayName ?? "(unnamed)").trim();
      const header = text.slice(0, text.length - LorebookManager.contentBelowHeader(text).length);
      let value: CardValue | undefined;
      if (category === PLAYER_CHARACTERS_CATEGORY) {
        const char = parsed as unknown as PlayableCharacter;
        if (char && typeof char.name === "string" && Array.isArray(char.templates)) value = characterToCard(char);
      } else if (Array.isArray(parsed)) {
        // A list of named defs reads far better keyed by its names.
        value = parsed.every(d => typeof (d as Record<string, unknown>)?.["name"] === "string")
          ? namedDefsToCard(parsed as unknown as Array<{ name: string }>)
          : parsed;
      } else {
        value = parsed;
      }
      if (value === undefined) { failed.push(label); continue; }
      await api.v1.lorebook.updateEntry(entry.id, { text: `${header}\n${formatCardText(value)}` });
      await TrackedLorebook.refreshBackup(category, label, `${header}\n${formatCardText(value)}`);
      converted.push(label);
    }
  }
  if (!converted.length && !failed.length) return sys("Nothing to convert - every card is already in the readable format.");
  const sync = await CharacterStore.syncFromLorebook();
  await MeritFlawRegistry.loadFromLorebook();
  await ArcanumRegistry.loadFromLorebook();
  await reloadAllConfigStores();
  const bits = [`Converted ${converted.length} card${converted.length === 1 ? "" : "s"} from JSON: ${converted.join(", ")}.`];
  if (failed.length) bits.push(`Left alone (unreadable): ${failed.join(", ")}.`);
  if (sync.synced.length) bits.push(`Re-synced ${sync.synced.map(n => StringUtil.toTitleCase(n)).join(", ")}.`);
  if (sync.emptied.length) bits.push(`⚠ A whole group went empty: ${sync.emptied.join("; ")} - the card is the source of truth, so a group left OFF it is a group erased.`);
  return sys(`${bits.join(" ")} Open a card to see the new format; [[show-sheet]] confirms what the engine reads.`);
}

// The record as the ENGINE reads it: every numeric bucket, with the effective
// value marked wherever enhancements/boosts change what a roll will actually
// use. This is the verification half of the creator-mode loop: hand-edit the
// lorebook card, run [[show-sheet]], see exactly what synced.
export async function cmdSheet(cmd: ParsedCommand): Promise<string> {
  const raw = (cmd.named["character"] ?? cmd.positional[0])?.trim();
  let char: PlayableCharacter | undefined;
  if (raw) {
    const ref = await resolveCharacterRef(raw);
    if (ref.error) return sys(`${ref.error}`);
    char = await CharacterStore.load(ref.name!);
    if (!char) return sys(`No character named "${ref.name}".`);
  } else {
    char = await CharacterStore.getCurrent();
    if (!char) return noCharacter();
  }
  const { resolver } = await characterRollEnv(char);
  const fmt = (bucket: Record<string, number>, skipZeros: boolean): string => {
    const bits = Object.entries(bucket ?? {})
      .filter(([, v]) => !skipZeros || v !== 0)
      .map(([k, v]) => {
        const eff = resolver(k);
        return eff !== v ? `${k} ${v} (${eff} eff)` : `${k} ${v}`;
      });
    return bits.length ? bits.join(", ") : "none";
  };
  // BY CATEGORY, because that is how a sheet is read and how the creation
  // budget is allocated: Physical/Social/Mental and Talents/Skills/Knowledges.
  // A trait the chronicle's lists do not name still shows, under "other" -
  // nothing is ever hidden because it could not be filed.
  const byCategory = (bucket: Record<string, number>, categories: readonly string[], skipZeros: boolean): string => {
    const held = Object.keys(bucket ?? {});
    const bits: string[] = [];
    const filed = new Set<string>();
    for (const category of categories) {
      const mine = held.filter(n => traitInCategory(n, category));
      mine.forEach(n => filed.add(n));
      const shown = Object.fromEntries(mine.map(n => [n, bucket[n]]));
      const text = fmt(shown, skipZeros);
      if (text !== "none") bits.push(`${disp(category)}: ${text}`);
    }
    const rest = held.filter(n => !filed.has(n));
    if (rest.length) {
      const text = fmt(Object.fromEntries(rest.map(n => [n, bucket[n]])), skipZeros);
      if (text !== "none") bits.push(`Other: ${text}`);
    }
    return bits.length ? bits.join(" | ") : "none";
  };
  const parts = [
    `${disp(char.name)} [${char.templates.join("+")}, ${char.stage}]`,
    `Attributes - ${byCategory(char.attributes, ATTRIBUTE_CATEGORIES, false)}`,
    `Abilities (nonzero) - ${byCategory(char.abilities, ABILITY_CATEGORIES, true)}`,
  ];
  const optional: Array<[string, Record<string, number>]> = [
    ["Backgrounds", char.backgrounds], ["Virtues", char.virtues],
    ["Disciplines", char.disciplines], ["Traits", char.traits],
    ["Pool starts", char.poolStarts],
  ];
  for (const [label, bucket] of optional) {
    if (Object.keys(bucket ?? {}).length) parts.push(`${label}: ${fmt(bucket, false)}`);
  }
  if (Object.keys(char.meritsFlaws ?? {}).length) {
    parts.push(`Merits/Flaws: ${Object.entries(char.meritsFlaws).map(([k, v]) => `${StringUtil.normalize(k)} ${v}`).join(", ")} ([[show-merit]] for detail)`);
  }
  // Its own line, because it is its own category - and absent entirely from the
  // sheets of the characters (nearly all of them) who have no Arcana.
  if (Object.keys(char.arcana ?? {}).length) {
    parts.push(`Arcana/Taints: ${Object.entries(char.arcana!).map(([k, v]) => `${StringUtil.normalize(k)} ${v}`).join(", ")} ([[show-arcanum]] for detail)`);
  }
  const specs = Object.entries(char.specialties ?? {}).filter(([, labels]) => labels.length);
  if (specs.length) parts.push(`Specialties: ${specs.map(([t, labels]) => `${t}: ${labels.join(", ")}`).join("; ")}`);
  // More than one of the same Background: the slot shows the highest, so say
  // what else is held (which one a roll means is the Storyteller's call).
  const held = Object.entries(char.instances ?? {}).filter(([, list]) => list.length > 1);
  if (held.length) {
    parts.push(`Held more than once: ${held.map(([t, list]) =>
      `${t} ${list.map(i => `${i.rating}${i.note ? ` (${i.note})` : ""}${i.paid !== undefined ? ` [paid ${i.paid}]` : ""}`).join(" + ")}`).join("; ")} - the slot rates the highest; which one a roll is about is Storyteller-adjudicated`);
  }
  const priced = Object.entries(char.paid ?? {});
  if (priced.length) parts.push(`Prices the Storyteller set: ${priced.map(([k, v]) => `${k} = ${v}`).join(", ")}`);
  if (char.tags.length) parts.push(`Tags: ${char.tags.join(", ")}`);
  // A pool start naming a resource this character doesn't have is a leftover -
  // most often a Willpower entry on someone whose Willpower was REPLACED. Trait
  // lookups can still find it, so say so rather than let it lurk.
  const own = new Set(CharacterResources.defsFor(char).map(d => StringUtil.normalize(d.name)));
  const stale = Object.keys(char.poolStarts ?? {}).filter(k => !own.has(StringUtil.normalize(k)));
  if (stale.length) {
    parts.push(`⚠️ pool start${stale.length === 1 ? "" : "s"} for ${stale.join(", ")} - this character has no such resource `
      + `(replaced or never granted). Delete the line in creator mode; [[show-resource]] is the truth`);
  }
  parts.push(`Live pools via [[show-resource]], damage via [[show-health]]`);
  return sys(`${parts.join(". ")}.`);
}

async function cmdSetDefault(cmd: ParsedCommand): Promise<string> {
  const name = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (!name) return sys(`set-default needs a name, e.g. [[set-default name="Rok"]].`);
  const ref = await resolveCharacterRef(name);
  if (ref.error) return sys(`${ref.error}`);
  const c = await CharacterStore.load(ref.name!);
  if (!c) return sys(`No character named "${ref.name}". [[show-character]] lists them.`);
  await CharacterStore.setDefault(c.name);
  return sys(`${disp(c.name)} is now the default character ([[play]] with no name selects it).`);
}


// --- CREATOR-MODE SYNC (the router's game-side hook) -------------------------
// While creator mode is on, the player may have hand-edited character entries
// or any wod:config entry: re-sync characters (player edits win) and reload
// every config store before a command runs, and again when leaving the mode.
// The beforeRoute hook syncs BEFORE the command runs, so by the time
// [[creator-mode set=false]] does its own sync there is nothing left to notice.
// Whatever the last sync saw is kept here so the reply can still say it.
// TAKEN, not read: the single consumer read this and cleared it in the same
// breath, so the pair is the honest shape of the operation as well as the only
// one ESM allows - an exported `let` is a read-only binding at the far end.
let lastEmptied: string[] = [];
export function takeLastEmptied(): string[] {
  const was = lastEmptied;
  lastEmptied = [];
  return was;
}
export async function syncFromCreatorEdits(): Promise<{ synced: string[]; failed: string[]; emptied: string[] }> {
  await reconcileLorebook();   // tracked-card drift first (may open modals)
  const result = await CharacterStore.syncFromLorebook();
  await reloadAllConfigStores();
  if (result.emptied.length) lastEmptied = result.emptied;
  return result;
}
CommandRouter.beforeRoute(async () => {
  if (await CreatorMode.enabled()) await syncFromCreatorEdits();
});

// --- REGISTRATIONS ------------------------------------------------------------
// Every verb registers with its CommandSpec: the ONE declarative description
// of its arguments. [[help]] derives from it; windows render forms and compose
// command strings from it. Handlers stay the validators - a spec describes,
// it never rejects.
// `hint` is the GRAMMAR (it goes in the one-line usage [[help]] prints);
// `example` is what a window shows inside the empty field, so it must be
// something a player could type. The grammar reads: a resource name, "::effect"
// to pick one of its NAMED effects (heal, boost, fuel, cast...) instead of the
// default, and a trailing "!" to make payment REQUIRED - unpayable means the
// action is refused rather than rolled for free.
const SPEND_HINT = "res[::effect][!]";
const SPEND_EXAMPLE = "blood  ·  blood::heal  ·  willpower!";
const ROLL_KNOBS: ParamSpec[] = [
  { key: "difficulty", kind: "positional", hint: "[difficulty|expr]" },
  { key: "diff-mod", kind: "positional", hint: "[diff-mod]" },
  { key: "requires", kind: "named", type: "int", desc: "Successes required" },
  { key: "dice-modifier", kind: "named", type: "int", desc: "Dice added or removed" },
  { key: "min-difficulty", kind: "named", type: "int", desc: "Floor the die target never drops below (overrides the chronicle's)" },
  { key: "successes", kind: "named", type: "int", desc: "Automatic successes, granted before the dice (a rolled 1 can cancel these)" },
  { key: "uncancelable", kind: "named", type: "int", desc: "Un-cancelable successes: certain ones no rolled 1 can ever take away" },
  { key: "tags", kind: "named", hint: '"a,b"', desc: "Roll tags (fire registered modifiers)" },
  { key: "spend", kind: "named", hint: SPEND_HINT, example: SPEND_EXAMPLE,
    desc: 'Resource to spend on the roll — "::effect" picks a named effect, "!" means no payment, no roll' },
  { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1; a resource may cap it per use)" },
  { key: "specialty", kind: "named", hint: "<trait|label>", example: "Swords  ·  or its trait: melee",
    desc: "Apply ONE specialty (+1 die; pool must use its trait)" },
];

CommandRouter.register("help", cmdHelp, {
  summary: "list commands, or show one's usage",
  params: [{ key: "verb", kind: "positional", hint: "<verb>" }],
});
CommandRouter.register("creator-mode", cmdCreatorMode, {
  summary: "toggle lorebook hand-editing; edits sync in while on",
  params: [{ key: "set", kind: "named", type: "bool", required: true }],
});
CommandRouter.register("create-playable", cmdCreatePlayable, {
  summary: "create a playable character (attributes 1, abilities 0 - allocation is opt-in)",
  params: [
    { key: "name", kind: "named", required: true, desc: "Name", example: "e.g. Erik the Red" },
    { key: "templates", kind: "named", required: true, hint: '"a,b"', desc: "Templates (comma-separated; hybrids legal)", example: "e.g. vampire" },
  ],
});
CommandRouter.register("play", cmdPlay, {
  summary: "switch to a character; no name selects the default",
  params: [{ key: "name", kind: "named", hint: '"<name|@alias>"' }],
});
CommandRouter.register("set-trait", cmdSetTrait, {
  summary: "set any rating the sheet holds (Attribute, Ability, Background, Discipline, Pillar, pool start)",
  note: "merits use [[take-merit]]; specialties use [[specialty]]",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<trait>", example: "sanctum" },
    { key: "rating", kind: "positional", required: true, hint: "<n>", example: "8" },
    { key: "group", kind: "named", desc: "Which group it belongs to (inferred when the trait is already known)", example: "background" },
    { key: "note", kind: "named", type: "literal", desc: "Whose/which one this is - keeps it as a separate instance" },
    { key: "paid", kind: "named", desc: "What it really cost (0 = the Storyteller granted it)" },
    { key: "add", kind: "named", type: "bool", desc: "Hold ANOTHER of the same trait rather than replacing" },
  ],
});
CommandRouter.register("convert-cards", cmdConvertCards, {
  summary: "rewrite any lorebook card still holding JSON in the readable format (one-shot)",
});
CommandRouter.register("set-default", cmdSetDefault, {
  summary: "change the default character",
  params: [{ key: "name", kind: "named", required: true, hint: '"<name|@alias>"' }],
});
CommandRouter.register("roll", cmdRoll, {
  summary: "roll a dice pool for the current character",
  params: [{ key: "pool", kind: "positional", required: true, hint: "<pool|@name>" }, ...ROLL_KNOBS,
    { key: "table", kind: "named", desc: "Success table to read the outcome" }],
});
CommandRouter.register("roll-for", cmdRollFor, {
  summary: "roll for a named character without switching to them",
  params: [
    { key: "character", kind: "positional", required: true, hint: '"<name|@alias>"' },
    { key: "pool", kind: "positional", required: true, hint: "<pool|@name>" }, ...ROLL_KNOBS,
    { key: "table", kind: "named", desc: "Success table to read the outcome" }],
});
CommandRouter.register("name-roll", cmdNameRoll, {
  summary: "save a roll under a name; @name invokes it with its spend/specialty/table baked in (extended=true makes a procedure, opposed= makes a contest)",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>" },
    { key: "pool", kind: "positional", required: true, hint: "<pool>" }, ...ROLL_KNOBS,
    { key: "table", kind: "named", desc: "Success table read when the roll is invoked" },
    { key: "extended", kind: "named", type: "bool", desc: "Make it an extended procedure (target supplied at invoke)" },
    { key: "intervals", kind: "named", type: "int", desc: "Extended: default max rolls" },
    { key: "interval", kind: "named", desc: "Extended: advisory spacing (e.g. 1 turn)" },
    { key: "on-botch", kind: "named", type: "enum", options: ["fail", "lose-successes", "ignore"], desc: "Extended: botch policy" },
    { key: "opposed", kind: "named", type: "enum", options: ["resisted", "contested"], desc: "Make it a contest (opponent supplied at invoke via vs=); with extended=, a race" },
    { key: "vs-pool", kind: "named", desc: "Opposed: the opposition's pool (default: your own pool)" },
    { key: "vs-difficulty", kind: "named", type: "int", desc: "Opposed: default difficulty for the opposition's roll" },
    { key: "description", kind: "named", type: "literal", desc: "Rules prose (verbatim)" }],
});
CommandRouter.register("add-step", cmdAddStep, {
  summary: "append a follow-up step to a saved procedure (composes named rolls)",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<procedure>" },
    { key: "roll", kind: "named", required: true, hint: "@<saved-roll>", desc: "The follow-up roll to run" },
    { key: "when", kind: "named", type: "enum", options: ["always", "on-success", "on-fail", "on-botch"], desc: "When this step applies, by the entry's outcome" },
    { key: "note", kind: "named", type: "literal", desc: "What this step is, in fiction" }],
});
CommandRouter.register("clear-steps", cmdClearSteps, {
  summary: "drop all follow-up steps from a saved procedure (its entry roll stays)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<procedure>" }],
});
CommandRouter.register("forget-roll", cmdForgetRoll, {
  summary: "delete a saved roll",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("extended-roll", cmdExtendedRoll, {
  summary: "start an extended action (rolls interval 1 now)",
  note: "plus the usual roll knobs",
  params: [
    { key: "pool", kind: "positional", required: true, hint: "<pool>" },
    { key: "requires", kind: "named", type: "int", required: true, hint: "<target>", desc: "Accumulated successes to reach" },
    { key: "intervals", kind: "named", type: "int", required: true, hint: "<max>", desc: "Maximum rolls" },
    { key: "interval", kind: "named", desc: "In-fiction spacing (ST-enforced)", example: "e.g. 1 night" },
    { key: "label", kind: "named", type: "literal", desc: "Display label" },
    { key: "on-botch", kind: "named", type: "enum", options: ["fail", "lose-successes", "ignore"] },
    { key: "difficulty", kind: "named", type: "int" },
    { key: "dice-modifier", kind: "named", type: "int" },
    { key: "tags", kind: "named", hint: '"a,b"' },
    { key: "spend", kind: "named", hint: SPEND_HINT, example: SPEND_EXAMPLE },
    { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1)" },
  ],
});
CommandRouter.register("continue-roll", cmdContinueRoll, {
  summary: "whoever is current rolls the next interval (named-only overrides)",
  params: [
    { key: "id", kind: "positional", hint: "[id]" },
    { key: "difficulty", kind: "named", type: "int" },
    { key: "diff-mod", kind: "named", type: "int" },
    { key: "dice-modifier", kind: "named", type: "int" },
    { key: "tags", kind: "named", hint: '"a,b"' },
    { key: "spend", kind: "named", hint: SPEND_HINT, example: SPEND_EXAMPLE },
    { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1)" },
  ],
});
CommandRouter.register("cancel-roll", cmdCancelRoll, {
  summary: "cancel an extended action",
  params: [{ key: "id", kind: "positional", hint: "[id]" }],
});
CommandRouter.register("attune", cmd => cmdAttune(cmd), {
  summary: "what this character can USE (a pool he cannot use is only points)",
  params: [
    { key: "capability", kind: "positional", hint: "[awakened|vitae|resolve]" },
    { key: "off", kind: "positional", hint: "[off]" },
  ],
});
CommandRouter.register("spend", cmdSpend, {
  summary: "spend a resource / fire a named effect outside a roll",
  params: [
    { key: "resource", kind: "positional", required: true, hint: "<resource[::effect]>" },
    { key: "target", kind: "positional", hint: "[target]" },
    { key: "amount", kind: "positional", hint: "[amount]" },
    { key: "reason", kind: "named", type: "literal", desc: "Why (echoed in the note)" },
  ],
});
CommandRouter.register("gain", cmdGain, {
  summary: "regain a resource",
  params: [
    { key: "resource", kind: "positional", required: true, hint: "<resource>" },
    { key: "amount", kind: "positional", hint: "[amount]" },
  ],
});
CommandRouter.register("damage", cmdDamage, {
  summary: "mark damage on the current character",
  params: [
    { key: "severity", kind: "positional", required: true, type: "enum", options: ["bashing", "lethal", "aggravated"], hint: "<bashing|lethal|aggravated>" },
    { key: "n", kind: "positional", hint: "[n]" },
  ],
});
CommandRouter.register("clear-boosts", cmdClearBoosts, { summary: "clear trait boosts (the ST calls the duration)" });
CommandRouter.register("reset-uses", cmdResetUses, { summary: "scene/turn change: clears effect-use counters" });
CommandRouter.register("configure-resources", cmdConfigureResources, { summary: "guided resource setup; plain replies answer it" });
CommandRouter.register("cancel-wizard", cmdCancelWizard, { summary: "abandon the running wizard" });
// Both sides, the same shape: [[resist]] and [[contest]] differ only in how the
// margin is read, so their grammar is one list.
const TWO_SIDED_PARAMS: ParamSpec[] = [
  { key: "your-pool", kind: "positional", required: true, hint: "<your-pool>" },
  { key: "their-pool", kind: "positional", required: true, hint: "<their-pool>" },
  { key: "vs", kind: "named", hint: '"Name"', desc: "Opposing character (stored characters roll live)" },
  { key: "difficulty", kind: "named", type: "int" },
  { key: "vs-difficulty", kind: "named", type: "int" },
  { key: "table", kind: "named", desc: "Success table read with your margin" },
  { key: "spend", kind: "named", hint: SPEND_HINT, example: SPEND_EXAMPLE },
  { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1)" },
];
CommandRouter.register("resist", cmdResist, {
  summary: "resisted action: your margin over theirs counts (tie = fail)",
  params: [...TWO_SIDED_PARAMS],
});
CommandRouter.register("contest", cmdContest, {
  summary: "contested action: higher total wins (tie = draw)",
  params: [...TWO_SIDED_PARAMS],
});
CommandRouter.register("extended-contest", cmdExtendedContest, {
  summary: "both sides accumulate; first to the goal wins (dead heat stays open)",
  params: [
    { key: "your-pool", kind: "positional", required: true, hint: "<your-pool>" },
    { key: "their-pool", kind: "positional", required: true, hint: "<their-pool>" },
    { key: "target", kind: "named", type: "int", required: true, hint: "<n>", desc: "Accumulated successes to win" },
    { key: "rounds", kind: "named", type: "int", required: true, hint: "<max>", desc: "Maximum rounds" },
    { key: "vs", kind: "named", hint: '"Name"' },
    { key: "label", kind: "named", type: "literal", desc: "Display label" },
    { key: "interval", kind: "named", desc: "In-fiction spacing (ST-enforced)" },
    { key: "on-botch", kind: "named", type: "enum", options: ["fail", "lose-successes", "ignore"] },
    { key: "difficulty", kind: "named", type: "int" },
    { key: "vs-difficulty", kind: "named", type: "int" },
  ],
});
CommandRouter.register("continue-contest", cmdContinueContest, {
  summary: "roll the next contest round",
  params: [
    { key: "id", kind: "positional", hint: "[id]" },
    { key: "difficulty", kind: "named", type: "int" },
    { key: "vs-difficulty", kind: "named", type: "int" },
    { key: "diff-mod", kind: "named", type: "int" },
    { key: "dice-modifier", kind: "named", type: "int" },
    { key: "tags", kind: "named", hint: '"a,b"' },
  ],
});
CommandRouter.register("cancel-contest", cmdCancelContest, {
  summary: "cancel an extended contest",
  params: [{ key: "id", kind: "positional", hint: "[id]" }],
});
CommandRouter.register("story-start", cmdStoryStart, {
  summary: "set when the story begins (yyyy-mm-dd-hh)",
  params: [{ key: "date", kind: "positional", required: true, hint: "yyyy-mm-dd-hh", example: "1197-03-15-08" }],
});
CommandRouter.register("advance-time", cmdAdvanceTime, {
  summary: "move the story clock forward (s/m/h/d/w/mo/y); crossing midnights/full moons applies recovery",
  params: [{ key: "duration", kind: "positional", required: true, hint: "<duration>", example: "2d 6h" }],
});
// MAGICK, with the k, and the reason is disambiguation rather than flavour:
// Sorcery, Blood Sorcery (Kulunic among them) and Disciplines that look like
// spellcasting (Chimerstry) are all "casting" too, and each will want its own
// verb. `magick` is the AWAKENED one and says so in its name.
CommandRouter.register("magick", cmdCast, {
  summary: "work Awakened magick (Dark Ages: Mage) - pillars carry the REQUIRED levels",
  params: [
    { key: "pillars", kind: "named", required: true, hint: '"name:level[,name:level...]"', example: 'e.g. "warrior:4,chieftain:2"' },
    { key: "foundation", kind: "named", hint: "<trait>", desc: "Foundation trait name (default: foundation)" },
    { key: "quintessence", kind: "named", type: "int", desc: "Extra points: -1 difficulty each (min 4; 3/turn cap)" },
    { key: "label", kind: "named", desc: "Spell name (keys the same-scene retry ledger)" },
    { key: "requires", kind: "named", type: "int", desc: "Successes needed (extended/ongoing: the ST's total)" },
    { key: "extended", kind: "named", type: "bool", desc: "Accrue successes over intervals" },
    { key: "ongoing", kind: "named", type: "bool", desc: "Indefinite-duration spell (successes ×10; per-success fuel; seal at the end)" },
    { key: "interval", kind: "named", desc: "Time between extended rolls (advisory)" },
    { key: "intervals", kind: "named", type: "int", desc: "Max rolls for an extended casting" },
    { key: "on-botch", kind: "named", type: "enum", options: ["fail", "lose-successes", "ignore"], desc: "Extended botch policy (default fail: Backlash ends it)" },
    { key: "spend", kind: "named", hint: "<res[:effect][!]>", desc: "Resource to spend on the roll" },
    { key: "spend-amount", kind: "named", type: "int", desc: "How many points to spend (default 1; a resource may cap it per use)" },
  ],
});
CommandRouter.register("seal-spell", cmdSealSpell, {
  summary: "seal an ongoing spell: 5 Quintessence per highest-Pillar dot + 1 Willpower per 10",
  params: [
    { key: "pillar", kind: "named", type: "int", required: true, desc: "Highest Pillar level involved" },
    { key: "pay", kind: "named", type: "bool", desc: "Spend now (else the price is quoted as a debt)" },
  ],
});
CommandRouter.register("choose", cmdChoose, {
  summary: "pick a clan, a fellowship, or the Attribute/Ability priorities",
  params: [
    { key: "what", kind: "positional", hint: "<clan|fellowship|attributes|abilities>", example: "clan" },
    { key: "value", kind: "positional", hint: "<value>", example: "tremere" },
  ],
});
CommandRouter.register("extend-template", cmdExtendTemplate, {
  inStory: false,
  summary: "a new template from an old one: state only what differs",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>", example: "Ouroboros" },
    { key: "extends", kind: "named", hint: "<template>", example: "mage", desc: "The template it inherits everything else from" },
    { key: "description", kind: "named", hint: "<text>", desc: "Its display name" },
    { key: "soak", kind: "named", type: "enum", options: Object.keys(SOAK_TABLES), desc: "Which soak table it uses" },
    { key: "morality", kind: "named", type: "enum", options: ["humanity", "torment", "none"], desc: "Its Road/Humanity, or none" },
    { key: "awakened", kind: "named", type: "bool", desc: "Does it work Awakened magic?" },
    { key: "has-virtues", kind: "named", type: "bool" },
    { key: "resources", kind: "named", hint: '"a,b"', desc: "Resources to ADD (define them first with [[define-resource]])" },
    { key: "capabilities", kind: "named", hint: '"vitae,resolve"', desc: "What it can USE, added to the parent's" },
    {
      key: "budgets", kind: "named", hint: '"arcana=role:willpower"', example: "arcana=role:willpower,arcana:freebie=-",
      desc: 'Any part of any purse: "purse=<allowance expression>", or "purse:freebie=" / "purse:experience=" for what a dot costs ("-" = cannot be bought)',
    },
    {
      key: "creation", kind: "named", hint: '"disciplines=4"', example: "disciplines=4,discipline-max=5",
      desc: `The creation pools: ${CREATION_FIELDS.map(([n]) => n).join(", ")}`,
    },
    {
      key: "disciplines", kind: "named", hint: '"celerity,potence"', example: "=celerity,potence",
      desc: "The Disciplines that are its own; a leading = means these and no family's",
    },
  ],
});
CommandRouter.register("forget-template", cmdForgetTemplate, {
  inStory: false,
  summary: "drop a chronicle template (the shipped one, if any, resurfaces)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("define-resource", cmdDefineResource, {
  inStory: false,
  summary: "define a pool or tracker a template can then grant",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>", example: "Living Resolve" },
    { key: "kind", kind: "named", type: "enum", options: ["pool", "tracker"] },
    { key: "start", kind: "named", type: "int", desc: "What it starts at" },
    { key: "max", kind: "named", type: "int", desc: "Its ceiling" },
    { key: "roles", kind: "named", hint: '"a,b"', desc: "Names it also answers to (blood, willpower, magic-fuel...)" },
    { key: "replaces", kind: "named", hint: '"a,b"', desc: "Resources it stands in for, hiding them" },
    { key: "requires", kind: "named", hint: '"vitae"', desc: `What a character must be able to USE (${Object.keys(CAPABILITIES).join(", ")}) to spend it at all` },
    { key: "per-turn", kind: "named", type: "int", desc: "Most that may be spent in one turn" },
    { key: "description", kind: "named", hint: "<text>" },
  ],
});
CommandRouter.register("define-background", cmdDefineBackground, {
  inStory: false,
  summary: "define/replace a background (a Talisman that IS a place grants that place's ratings)",
  params: [
    { key: "name", kind: "named", required: true, type: "literal", desc: "Name - BACKTICKS", example: "Talisman" },
    { key: "max", kind: "named", type: "int", desc: "Ceiling (default 5)", example: "5" },
    { key: "templates", kind: "named", hint: '"a,b"', desc: "Who may take it (blank = anyone)" },
    { key: "grants", kind: "named", hint: '"trait:n,trait:n"', desc: "Other traits it confers", example: "cray:5,library:5,sanctum:5" },
    { key: "description", kind: "named", type: "literal", desc: "Description - BACKTICKS" },
  ],
});
CommandRouter.register("forget-background", cmdForgetBackground, {
  inStory: false,
  summary: "remove a custom background (a built-in resurfaces)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("grant", cmd => cmdGrant(cmd), {
  summary: "where something came from when it wasn't bought: a template's free dot, or a Storyteller's bonus",
  params: [
    { key: "what", kind: "positional", hint: "<trait|merit|purse>", example: "potence  ·  freebie" },
    { key: "points", kind: "positional", type: "int", hint: "[points]", desc: "Given: this ADDS to that purse" },
    { key: "source", kind: "named", type: "enum", options: Object.keys(GRANT_SOURCES), desc: "Where it came from (default: storyteller)" },
    { key: "note", kind: "named", hint: "<text>", example: "everyone in this chronicle is Suspect" },
  ],
});
CommandRouter.register("forget-grant", cmdUngrant, {
  summary: "drop a grant - the thing goes back to being bought normally",
  params: [{ key: "what", kind: "positional", required: true, hint: "<trait|purse>" }],
});
CommandRouter.register("paid", cmdPaid, {
  summary: "record what a purchase really cost (no expression = the Storyteller granted it)",
  params: [
    { key: "key", kind: "positional", hint: "<trait|merit-key>", example: "mentor" },
    { key: "expr", kind: "positional", hint: "[expr|listed]", example: "0" },
  ],
});
CommandRouter.register("flush-context", cmdFlushContext, {
  summary: "clean the story now: strip engine notes and hidden blocks (run this if things feel slow)",
});
// Being somewhere IS an affliction: these four only afflict and lift, and every
// affordance they grant lives in the affliction's own card.
CommandRouter.register("enter-sanctum", () => enterPlace("sanctum", true), { summary: "enter your sanctum (applies in-sanctum)" });
CommandRouter.register("exit-sanctum", () => enterPlace("sanctum", false), { summary: "leave your sanctum (lifts in-sanctum)" });
CommandRouter.register("enter-library", () => enterPlace("library", true), { summary: "enter your library (applies in-library)" });
CommandRouter.register("exit-library", () => enterPlace("library", false), { summary: "leave your library (lifts in-library)" });
CommandRouter.register("measure-door", cmdMeasureDoor, {
  summary: "the Talisman ritual: ten minutes measuring a door opens the Library of the Unseen",
});
CommandRouter.register("leave-library", cmdLeaveLibrary, {
  summary: "step back through the measured door",
});
CommandRouter.register("set-cray", cmdSetCray, {
  summary: "what this cray asks of you - the ritual time per point harvested",
  note: "Each cray is different: `per-point=2h` here, `1h` there. `default` hands it back to the chronicle's rule. A merit or affliction carrying a `ritual-time` op modifies it (e.g. -50% halves it).",
  params: [
    { key: "per-point", kind: "named", hint: "<duration|default>", example: "2h",
      desc: "How long the ritual takes per point drawn" },
  ],
});
CommandRouter.register("harvest", cmdHarvest, {
  summary: "draw Quintessence from the cray ritually - the ritual's time passes by itself (no roll; overdrawing costs the site a dot)",
  note: "Time per point is the cray's own ([[set-cray per-point=2h]]), shortened by anything the character has carrying a `ritual-time` op. `time=` overrides it; `time=0` skips the clock.",
  params: [
    { key: "points", kind: "positional", type: "int", hint: "[points]", example: "3" },
    { key: "time", kind: "named", desc: "Override how long the ritual takes (0 = do not move the clock)", example: "2h" },
  ],
});
CommandRouter.register("absorb", cmdAbsorb, {
  summary: "tear Quintessence from the cray directly: Wits + Foundation vs 10 - its rating",
  params: [{ key: "foundation", kind: "named", hint: "<trait>", desc: "Foundation trait (default: auto)" }],
});
CommandRouter.register("research", cmdResearch, {
  summary: "search the library: Intelligence + Library (must be in it)",
  params: [
    { key: "topic", kind: "positional", required: true, hint: "<topic>", example: "`the seals of Belial`" },
    { key: "difficulty", kind: "named", type: "int", desc: "How obscure the secret is (default 6)" },
    { key: "tags", kind: "named", hint: '"a,b"', desc: "Roll tags (e.g. hermetic, in the rotunda)" },
  ],
});
CommandRouter.register("save-date", cmdSaveDate, {
  summary: "bookmark the current moment (or a given date) under a name",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>" },
    { key: "date", kind: "positional", hint: "[yyyy-mm-dd-hh]", example: "1197-12-25-00" }],
});
CommandRouter.register("forget-date", cmdForgetDate, {
  summary: "delete a saved date bookmark",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("scene", cmdScene, {
  summary: "open a named scene at the current story time (one location; turn=<len> sets a Turn's length)",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name>" },
    { key: "location", kind: "named", type: "literal", desc: "The scene's single location" },
    { key: "turn", kind: "named", desc: "A Turn's length here (e.g. 3s for combat); omit for freeform", example: "3s" },
    { key: "chapter", kind: "named", type: "literal", desc: "Optional grouping label" }],
});
CommandRouter.register("turn", cmdTurn, {
  summary: "advance the current scene by one turn (moves the clock by its turn length)",
  params: [{ key: "count", kind: "positional", type: "int", hint: "[n]", desc: "How many turns (default 1)" }],
});
CommandRouter.register("end-scene", cmdEndScene, { summary: "close the current scene" });
CommandRouter.register("downtime", cmdDowntime, {
  summary: "close the current scene and gloss the clock forward",
  params: [{ key: "duration", kind: "positional", required: true, hint: "<duration>", example: "3d" }],
});
CommandRouter.register("forget-scene", cmdForgetScene, {
  summary: "delete a scene record",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("hide", cmdHide, {
  summary: "write to the current scene's private plan (mirrored into the Author's Note)",
  note: "the AI does this automatically via <hide op=append|overwrite>...</hide> in its narration",
  params: [
    { key: "text", kind: "named", type: "literal", desc: "The plan text (verbatim)" },
    { key: "op", kind: "named", type: "enum", options: ["append", "overwrite"], desc: "Append (default) or overwrite the plan" }],
});
CommandRouter.register("define-table", cmdDefineTable, {
  inStory: false,
  summary: "define/replace a success table in its category's general card",
  note: "a missing subcategory prompts a modal to create it",
  params: [
    { key: "name", kind: "named", required: true, hint: '"[sub::]name"', desc: "Name (optionally sub::name)", example: "e.g. combat::quick-kill" },
    { key: "rows", kind: "named", type: "literal", hint: "`1:Cowed, 3:Terrified[=2]`", desc: "Ladder rows: <successes>:<label>[=<value>], separated by ; (or , when no label needs one)", example: "e.g. 1:Cowed, 3:Terrified" },
    { key: "value-per-success", kind: "named", type: "int", desc: "Direct numeric output per success" },
    { key: "cap", kind: "named", type: "int", desc: "Successes beyond this are wasted" },
    { key: "overflow-per", kind: "named", type: "int", desc: "Batch size beyond the last row" },
    { key: "overflow-value", kind: "named", type: "int", desc: "Value added per overflow batch" },
    { key: "overflow-label", kind: "named", type: "literal", desc: "Overflow annotation" },
    { key: "botch", kind: "named", type: "literal", desc: "What a botch means here" },
    { key: "failure", kind: "named", type: "literal", desc: "What failure means here" },
    { key: "description", kind: "named", type: "literal", desc: "Description" },
  ],
});
CommandRouter.register("forget-table", cmdForgetTable, {
  inStory: false,
  summary: "remove a table from its category's general card; built-ins can only be shadowed",
  params: [{ key: "name", kind: "positional", required: true, hint: "<[sub::]name|@alias>" }],
});
CommandRouter.register("define-table-category", cmdDefineTableCategory, {
  inStory: false,
  summary: "create a table subcategory (a real lorebook category with its general card)",
  params: [{ key: "name", kind: "named", required: true, desc: "Category name (single segment)", example: "e.g. combat" }],
});
CommandRouter.register("table-alias", cmdTableAlias, {
  inStory: false,
  summary: "define a table alias, or list them (no args); table=@alias resolves it",
  params: [
    { key: "token", kind: "positional", hint: "<@alias>" },
    { key: "target", kind: "positional", hint: '"<[sub::]name>"' },
  ],
});
CommandRouter.register("forget-table-alias", cmdForgetTableAlias, {
  inStory: false,
  summary: "remove a table alias",
  params: [{ key: "token", kind: "positional", required: true, hint: "<@alias>" }],
});
CommandRouter.register("define-constraint", cmdDefineConstraint, {
  inStory: false,
  summary: "define/replace a constraint group",
  params: [
    { key: "name", kind: "named", required: true, desc: "Name", example: "e.g. clan-only-backgrounds" },
    { key: "relation", kind: "named", type: "enum", options: [...CONSTRAINT_RELATIONS], default: "exclusive", desc: "Relation" },
    { key: "domain", kind: "named", type: "enum", options: [...CONSTRAINT_DOMAINS], default: "background", desc: "Domain" },
    { key: "members", kind: "named", hint: '"a,b"', desc: "Members (comma-separated Backgrounds or Merits/Flaws)", example: "e.g. status, anonymity" },
    { key: "max", kind: "named", type: "int", desc: "Max to hold (exclusive only; default 1)" },
    { key: "scope", kind: "named", desc: "Scope: templates/choices it applies to (comma-separated; empty = everyone)", example: "e.g. tzimisce" },
    { key: "note", kind: "named", desc: "Note (optional)" },
  ],
});
CommandRouter.register("forget-constraint", cmdForgetConstraint, {
  inStory: false,
  summary: "remove a constraint group",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("take-merit", cmdTakeMerit, {
  summary: "take a merit/flaw; parameterized defs take name::param instances",
  note: "Merits and Flaws only. Arcana and Taints are a different category - [[take-arcanum]]",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name[::param]>" },
    { key: "points", kind: "positional", hint: "[points]" },
    { key: "paid", kind: "named", desc: "What it REALLY cost (0 = the Storyteller granted it)" },
    { key: "waive", kind: "named", type: "bool", desc: "Waive unmet prerequisites" },
  ],
});
CommandRouter.register("drop-merit", cmdDropMerit, {
  summary: "drop an owned merit/flaw instance",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name[::param]>" }],
});
// A verb that writes a DEFINITION CARD is the player editing the chronicle's
// rulebook, not a beat of the story: `inStory: false` keeps every "Defined
// merit X" out of the AI's context, where it was pure noise. Sheet edits
// ([[set-trait]], [[take-merit]], [[specialty]], [[grant]]) are NOT in this set
// - those are things that happen to a character, and the Storyteller should see
// them. `in-story` still overrides either way, per call.
CommandRouter.register("define-merit", cmdDefineMerit, {
  inStory: false,
  summary: "define a merit or flaw (writes the srd:merits-flaws overlay)",
  note: "kind= takes merit or flaw ONLY - an arcanum is not a merit; use [[define-arcanum]]",
  params: [
    { key: "name", kind: "named", required: true, type: "literal", hint: "`<name>`", example: "e.g. `Inviolate Soul`" },
    { key: "kind", kind: "named", type: "enum", options: ["merit", "flaw"], desc: "Merits cost freebies, flaws grant them (default merit)" },
    { key: "points", kind: "named", hint: "<n|1,2,3>", desc: "Cost, or the ladder of allowed ratings (default 0)" },
    { key: "passive", kind: "named", type: "literal", hint: "`<op>[:<target>] [+N] [if=] [while=]`", desc: 'Always-on ops, ";"-separated (or a raw JSON array) - BACKTICKS' },
    { key: "param", kind: "named", desc: "Instance-parameter slot (owned as name::value)" },
    { key: "templates", kind: "named", hint: '"a,b"', desc: "Templates that may take it" },
    { key: "budget", kind: "named", desc: "Which purse it trades in (default: freebie)", example: "freebie" },
    { key: "per-template", kind: "named", hint: '"vampire:3,ghoul:1"', desc: "Price per template; `no` closes it to one", example: "vampire:3,ghoul:1" },
    { key: "limit-at", kind: "named", type: "int", desc: "The rating that is rationed across instances", example: "3" },
    { key: "limit-slots", kind: "named", type: "int", desc: "How many instances may hold that rating (default 1)", example: "2" },
    { key: "limit-per-kind", kind: "named", desc: "And at most this many of a trait kind", example: "attribute:1" },
    { key: "max-from-trait", kind: "named", desc: "Rating ceiling is this trait (\"no more purchases than his Resolve\")", example: "resolve" },
    { key: "param-from", kind: "named", type: "enum", options: [...ALL_TRAIT_CATEGORIES],
      desc: "The param must be a trait of this category (\"pick a Knowledge\")", example: "knowledge" },
    { key: "grants", kind: "named", desc: "Affliction this applies when taken (defined for you if new)", example: "iron-willed" },
    { key: "grants-mode", kind: "named", type: "enum", options: ["automatic", "offered"],
      desc: "automatic = on as soon as it is taken; offered = it grants the ABILITY, [[invoke]] uses it" },
    { key: "grants-togglable", kind: "named", type: "bool", desc: "The character may switch it off without losing the power" },
    { key: "grants-orphan", kind: "named", desc: "What happens to the affliction when the power is lost (default: immediately)", example: "immediately" },
    { key: "description", kind: "named", type: "literal", hint: "`<text>`", desc: "Rules text" },
  ],
});
CommandRouter.register("forget-merit", cmdForgetMerit, {
  inStory: false,
  summary: "delete a custom merit/flaw definition (built-ins resurface)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});

CommandRouter.register("define-arcanum", cmdDefineArcanum, {
  inStory: false,
  summary: "define an arcanum or taint (writes the srd:arcana overlay)",
  note: "per-template= gives it a price per splat; kind=taint makes it GRANT points. NOT [[define-merit]] - a different list",
  params: [
    { key: "name", kind: "named", required: true, type: "literal", desc: "Name - BACKTICKS" },
    { key: "kind", kind: "named", type: "enum", options: ["arcanum", "taint"], desc: "Default arcanum" },
    { key: "points", kind: "named", hint: "<n|1,2,3>", desc: "Cost, or the ladder of allowed ratings" },
    { key: "per-template", kind: "named", hint: '"demon:7,thrall:5"', desc: "Price per template; `no` closes it to one" },
    { key: "param", kind: "named", desc: "Instance-parameter slot (owned as name::value)" },
    { key: "templates", kind: "named", hint: '"a,b"', desc: "Templates that may take it" },
    { key: "budget", kind: "named", desc: "Which purse it trades in (default: arcana)", example: "arcana" },
    { key: "limit-at", kind: "named", type: "int", desc: "The rating that is rationed across instances", example: "3" },
    { key: "limit-slots", kind: "named", type: "int", desc: "How many instances may hold that rating (default 1)", example: "2" },
    { key: "limit-per-kind", kind: "named", desc: "And at most this many of a trait kind", example: "attribute:1" },
    { key: "max-from-trait", kind: "named", desc: "Rating ceiling is this trait", example: "resolve" },
    { key: "passive", kind: "named", type: "literal", desc: 'Always-on ops, ";"-separated - BACKTICKS' },
    { key: "param-from", kind: "named", type: "enum", options: [...ALL_TRAIT_CATEGORIES],
      desc: "The param must be a trait of this category (\"pick a Knowledge\")", example: "knowledge" },
    { key: "grants", kind: "named", desc: "Affliction this applies when taken (defined for you if new)", example: "iron-willed" },
    { key: "grants-mode", kind: "named", type: "enum", options: ["automatic", "offered"],
      desc: "automatic = on as soon as it is taken; offered = it grants the ABILITY, [[invoke]] uses it" },
    { key: "grants-togglable", kind: "named", type: "bool", desc: "The character may switch it off without losing the power" },
    { key: "grants-orphan", kind: "named", desc: "What happens to the affliction when the power is lost (default: immediately)", example: "immediately" },
    { key: "description", kind: "named", type: "literal", desc: "Description - BACKTICKS" },
  ],
});
CommandRouter.register("take-arcanum", cmdTakeArcanum, {
  summary: "take an arcanum or taint (needs the arcana capability - [[attune]])",
  params: [
    { key: "name", kind: "positional", required: true, hint: "<name[::param]>" },
    { key: "points", kind: "positional", hint: "[points]" },
    { key: "paid", kind: "named", desc: "What it REALLY cost (0 = the Storyteller granted it)" },
    { key: "waive", kind: "named", type: "bool", desc: "Waive prerequisites / template limits / the capability gate" },
  ],
});
CommandRouter.register("drop-arcanum", cmdDropArcanum, {
  summary: "drop an owned arcanum or taint (its passives lift with it)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name[::param]>" }],
});
CommandRouter.register("forget-arcanum", cmdForgetArcanum, {
  inStory: false,
  summary: "remove a custom arcanum/taint definition (a built-in resurfaces)",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
CommandRouter.register("specialty", cmdSpecialty, {
  summary: "add a specialty to a trait (labels keep their case)",
  params: [
    { key: "trait", kind: "positional", required: true, hint: "<trait>" },
    { key: "label", kind: "positional", required: true, type: "literal", hint: "`<Label>`" },
  ],
});
CommandRouter.register("forget-specialty", cmdForgetSpecialty, {
  summary: "remove a specialty (label needed only when a trait has several)",
  params: [
    { key: "trait", kind: "positional", required: true, hint: "<trait>" },
    { key: "label", kind: "positional", type: "literal", hint: "[`<Label>`]" },
  ],
});
CommandRouter.register("define-affliction", cmdDefineAffliction, {
  inStory: false,
  summary: "define/replace an affliction (overlay; may shadow a built-in)",
  params: [
    { key: "name", kind: "named", required: true, desc: "Name", example: "e.g. dazed" },
    { key: "bindings", kind: "named", hint: '"target"', desc: "Required slots (comma-separated)", example: "e.g. target" },
    { key: "duration", kind: "named", hint: '"1 turn|until x|instant"', desc: "Advisory duration" },
    { key: "then", kind: "named", desc: "Successor affliction ([[advance]] applies it)" },
    { key: "mirror", kind: "named", desc: "Affliction the bound target gains, bound back" },
    { key: "apply", kind: "named", type: "literal",
      hint: "`<op>[:<tag>] [+N|-N] [if=<trait|category>]`", example: "difficulty -2 if=drive on=reckless",
      desc: 'What it DOES while it is on - the same shorthand a merit passive uses; "$slot" reads a binding' },
    { key: "lift", kind: "named", type: "enum", options: [...LIFT_POLICIES],
      desc: "Who may HOLD IT DOWN: at-will, cost (pay for relief), never (default - only something else can)" },
    { key: "lift-cost", kind: "named", hint: "<resource>", example: "willpower", desc: "What buying relief costs" },
    { key: "lift-for", kind: "named", hint: "<duration>", example: "1 scene", desc: "How long the relief lasts" },
    { key: "lift-roll", kind: "named", desc: "...or a pool rolled for it (ST-adjudicated)" },
    { key: "lift-note", kind: "named", type: "literal", desc: "Why it can or cannot be shrugged off" },
    { key: "suppresses", kind: "named", hint: '"a,b"', example: "claw-hands",
      desc: "Afflictions HELD DOWN while this one is on (the glove over the claws)" },
    { key: "tags", kind: "named", hint: '"a,b"', desc: "Tags joined to the afflicted character's rolls" },
    { key: "description", kind: "named", type: "literal", desc: "Description" },
    { key: "note", kind: "named", desc: "Note (optional)" },
  ],
});
CommandRouter.register("forget-affliction", cmdForgetAffliction, {
  inStory: false,
  summary: "remove an overlay definition; built-ins can only be shadowed",
  params: [{ key: "name", kind: "positional", required: true, hint: "<name>" }],
});
// Every way an affliction can end, on one verb. They compose: whichever
// measure runs out first ends it.
const EXPIRY_PARAMS: ParamSpec[] = [
  { key: "rolls", kind: "named", type: "int", desc: "Ends after this many MATCHING rolls" },
  { key: "with-tags", kind: "named", hint: '"a,b"', desc: "Only rolls carrying all of these count" },
  { key: "without-tags", kind: "named", hint: '"a,b"', desc: "Rolls carrying any of these do not count" },
  { key: "using", kind: "named", hint: '"melee"', desc: "Only rolls whose pool uses one of these count" },
  { key: "not-using", kind: "named", hint: '"wits"', desc: "Rolls whose pool uses any of these do not count" },
  { key: "turns", kind: "named", type: "int", desc: "Ends after this many turns ([[turn]] counts them)" },
  { key: "scenes", kind: "named", type: "int", desc: "Ends after this many scenes ([[end-scene]] counts them)" },
  { key: "for", kind: "named", hint: "<duration>", example: "1 hour", desc: "Ends after this much story time" },
  {
    key: "until", kind: "named", hint: "<condition>", example: "full-moons >= 1",
    desc: "Ends when this becomes true: full-moons, elapsed-days, elapsed-hours and any trait, with > < >= <= = != and and/or/not",
  },
  { key: "until-event", kind: "named", hint: "<text>", example: "you next attend the voivode", desc: "ADVISORY: nothing ends it but [[lift]]" },
  { key: "from", kind: "named", hint: "<source>", example: "arcanum:sharpened-senses", desc: "What inflicted it - an arcanum, a spell, a Discipline, a botch" },
  // A cooldown is the same six measures asking "when may this happen again",
  // so it is the same argument names behind one prefix.
  { key: "cooldown-for", kind: "named", hint: "<duration>", example: "1 day", desc: "After it ends, this long before it may be taken again" },
  { key: "cooldown-rolls", kind: "named", type: "int" },
  { key: "cooldown-turns", kind: "named", type: "int" },
  { key: "cooldown-scenes", kind: "named", type: "int" },
  { key: "cooldown-until", kind: "named", hint: "<condition>", example: "full-moons >= 1" },
  { key: "waive", kind: "named", type: "bool", desc: "Apply it even while cooling" },
  {
    key: "orphan", kind: "named", hint: "immediately | keep | <expression>", example: "immediately",
    desc: "What happens if its source goes: end at once, carry on unchanged, or an expression over what is left (remaining-seconds, remaining-rolls)",
  },
];
CommandRouter.register("afflict", cmdAfflict, {
  summary: "apply an affliction; extra <slot>=<name|@alias> args fill its bindings",
  note: "mirror defs also afflict the bound target",
  openNamed: true,
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>", desc: "Who (default: the current character)" },
    { key: "level", kind: "named", type: "int", example: "2",
      desc: "How MANY steps - its ops scale by this (the 1/2/3 ladder every rated merit is written on)" },
    ...EXPIRY_PARAMS,
  ],
});
CommandRouter.register("toggle", cmdToggle, {
  summary: "switch a togglable passive off, or back on (the power is not lost either way)",
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>", desc: "Who (default: the current character)" },
  ],
});
CommandRouter.register("invoke", cmdInvoke, {
  summary: "use a power that OFFERS an affliction rather than applying it automatically",
  params: [{ key: "affliction", kind: "positional", required: true, hint: "<affliction>" }],
});
CommandRouter.register("advance", cmdAdvance, {
  summary: "end an affliction and begin its successor, bindings carried forward",
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>" },
  ],
});
CommandRouter.register("lift", cmdLift, {
  summary: "HOLD an affliction down - he is still under it, and the relief runs out",
  note: "[[remove]] is what ENDS one; [[restore]] ends the relief early",
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>", desc: "Who (default: the current character)" },
    { key: "from", kind: "named", desc: "Which instance, when several sources applied the same one", example: "merit:crack-rider" },
    { key: "spend", kind: "named", hint: SPEND_HINT, desc: "Pay for the relief (its definition may name the price)" },
    { key: "spend-amount", kind: "named", type: "int" },
    { key: "waive", kind: "named", type: "bool", desc: "Hold it down even though its definition says it cannot be" },
    ...EXPIRY_PARAMS,
  ],
});
CommandRouter.register("restore", cmdRestore, {
  summary: "end the relief early - the affliction takes hold again",
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>" },
  ],
});
CommandRouter.register("remove", cmdRemoveAffliction, {
  summary: "END an affliction - the thing causing it is gone",
  note: "[[lift]] only holds one down",
  params: [
    { key: "affliction", kind: "positional", required: true, hint: "<affliction>" },
    { key: "on", kind: "named", hint: "<name|@alias>" },
    { key: "from", kind: "named", desc: "Which instance, when several sources applied the same one", example: "merit:crack-rider" },
    { key: "spend", kind: "named", hint: SPEND_HINT, desc: "Pay to be rid of it" },
    { key: "spend-amount", kind: "named", type: "int" },
  ],
});
CommandRouter.register("alias", cmdAlias, {
  summary: "define an alias for a character",
  note: "bare @a = global; @global::a, @player::<id|storyteller|default>::a, @char::<name|default>::a pin a scope",
  params: [
    { key: "token", kind: "positional", required: true, hint: "<@token>" },
    { key: "target", kind: "positional", required: true, hint: '"Target Name"' },
  ],
});
CommandRouter.register(KEY.aliases, cmdAliases, { summary: "list every alias, grouped by scope" });
CommandRouter.register("forget-alias", cmdForgetAlias, {
  summary: "remove an alias (bare @a = global; scoped tokens as in alias)",
  params: [{ key: "token", kind: "positional", required: true, hint: "<@token>" }],
});
CommandRouter.register("player", cmdPlayer, {
  summary: "show or switch the current player; storyteller is always valid",
  params: [
    { key: "name", kind: "named", hint: '"<id>"' },
    { key: "default", kind: "named", type: "bool", desc: "Also make it the default player" },
  ],
});
