// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { CommandContext, ParsedCommand, sys } from "../command";
import { HealthSummary } from "../core/damage";
import { Duration, addDuration, diffCalendar, formatCalendarSpan, formatStoryDate, formatStoryDay, parseDuration } from "../core/time";
import { StringUtil } from "../core/traits";
import { formatExecution, makeRollSpec } from "../rolls";
import { EffectOp, RITUAL_TIME_OP, capabilityNote, magicRulesFrom, resourceEffect, ritualTimePercent, scaleRitualSeconds } from "../rules";
import { CharacterAfflictions, CharacterBoosts, CharacterHealth, CharacterResources, CharacterStore, CrayState, CrayStore, EffectUses, MagicRulesConfig, PlayableCharacter, StoryClock, WizardSession, effectiveTraitOf, resolveAffliction, resolveTraitFromRecord, resourceNumbers } from "../state";
import { renderPromptText } from "../wizard";
import { RESOURCES_WIZARD, disp, isRollOp, noCharacter, runRoll } from "./common";
import { applyEffectSpec, execCharacterRoll, resolveFoundation } from "./effects";
import { applyAffliction, removeAffliction } from "./powers";
import { applyRecovery, expireAfflictions } from "./time";

// =============================================================================
// PLACES OF POWER - the sanctum, the library, and the cray within it
// -----------------------------------------------------------------------------
// Where a mage stands is mechanical: rating-scaled afflictions (in-sanctum /
// in-library, §rules.ts) fold their tiers into every roll, and a cray is a real
// site with points that run out. The Talisman ritual below is the door.
// =============================================================================
const LIBRARY_STATES = ["in-sanctum", "in-umbra", "in-library"];

// BEING SOMEWHERE IS AN AFFLICTION. That is the whole model: a sanctum grants
// no affordances of its own - it applies `in-sanctum`, and what THAT grants is
// data (rules.ts DEFAULT_AFFLICTIONS, editable as a story card, tier by tier
// against the character's rating). So the place verbs below are thin: they
// afflict and they lift, and every affordance stays describable without code.
const PLACES: Record<string, { states: string[]; needs: string; blurb: string }> = {
  sanctum: {
    states: ["in-sanctum"], needs: "sanctum",
    blurb: "his own place of power - what its rating grants is on the in-sanctum card",
  },
  library: {
    states: ["in-library"], needs: "library",
    blurb: "the shelves he knows - what its rating grants is on the in-library card",
  },
};

// enter <place> / exit <place>, shared: afflict or lift, and say what the place
// is doing right now rather than what it is.
export async function enterPlace(key: string, enter: boolean): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const place = PLACES[key];
  const subject = StringUtil.normalize(char.name);
  if (enter) {
    const rating = effectiveTraitOf(char, place.needs);
    if (rating <= 0) {
      return sys(`${disp(char.name)} has no ${disp(place.needs)} to enter - rate one with `
        + `[[set-trait ${place.needs} <n>]], or it is somebody else's.`);
    }
    const applied: string[] = [];
    for (const state of place.states) {
      const def = resolveAffliction(state);
      if (!def) { applied.push(`⚠ "${state}" is not defined`); continue; }
      const r = await applyAffliction(subject, def, {});
      if (!r.error) applied.push(state);
    }
    return sys(`${disp(char.name)} enters his ${disp(key)} (${disp(place.needs)} ${rating}) - ${place.blurb}. `
      + `Now ${applied.join(" + ")}; [[show-affliction]] shows what it grants. Leave with [[exit-${key}]].`);
  }
  const lifted: string[] = [];
  for (const state of place.states) {
    const r = await removeAffliction(subject, state);
    if (!r.error) lifted.push(state);
  }
  if (!lifted.length) return sys(`${disp(char.name)} is not in his ${disp(key)}.`);
  return sys(`${disp(char.name)} leaves his ${disp(key)} (${lifted.join(", ")} lifted).`);
}

// The Talisman "Cosmos Within the Measure": ritually measure any door (ten
// minutes, no roll, no resource) and it opens onto the Library of the Unseen -
// an Umbral realm that is also the mage's sanctum, hence all three states.
export async function cmdMeasureDoor(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  if (effectiveTraitOf(char, "library") <= 0) {
    return sys(`${disp(char.name)} has no Library to open a door onto (the Talisman measures the way to YOUR library).`);
  }
  const clock = await StoryClock.get();
  if (clock) await StoryClock.advance({ months: 0, seconds: 10 * 60 });
  for (const state of LIBRARY_STATES) {
    const def = resolveAffliction(state);
    if (def) await applyAffliction(StringUtil.normalize(char.name), def, {});
  }
  const when = clock ? ` Ten minutes pass (${formatStoryDate((await StoryClock.get())!.now)}).` : "";
  return sys(`${disp(char.name)} measures the door - jamb, lintel, threshold - and it opens onto the Library of the Unseen.${when} `
    + `Now ${LIBRARY_STATES.join(" + ")}; [[show-affliction]] shows what they grant. Leave with [[leave-library]].`);
}

export async function cmdLeaveLibrary(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const lifted: string[] = [];
  for (const state of LIBRARY_STATES) {
    const r = await removeAffliction(StringUtil.normalize(char.name), state);
    if (!r.error) lifted.push(state);
  }
  if (!lifted.length) return sys(`${disp(char.name)} is not in the Library.`);
  return sys(`${disp(char.name)} steps back through the measured door (${lifted.join(", ")} lifted).`);
}

// One line of cray state, for the status command and after every draw.
function crayLine(char: PlayableCharacter, state: CrayState): string {
  const rating = CrayStore.rating(char);
  const status = state.status === "active" ? "" : ` - ${state.status.toUpperCase()}`;
  return `cray ${rating} (${state.points}/${CrayStore.capacity(char)} points${status})`;
}

// WHAT THE RITUAL COSTS IN TIME. Two hours a point at one cray, one at another
// (CrayState.perPoint), falling back to the chronicle's own default; then
// whatever the character HAS that shortens it - "Cray Harvesting Expertise
// halves the time" is an affliction carrying a `ritual-time` op, exactly like
// every other modifier here. Sources are named, because a player reading "3
// hours" deserves to know which of his merits made it three.
interface RitualTime { seconds: number; base: number; percent: number; sources: string[]; perPoint: string }

async function harvestTime(char: PlayableCharacter, points: number): Promise<RitualTime> {
  const state = await CrayStore.get(char);
  const fallbackMinutes = magicRulesFrom(MagicRulesConfig.current()).crayHarvestMinutesPerPoint;
  const now = (await StoryClock.get())?.now ?? 0;
  let perPoint = `${fallbackMinutes}m`;
  let onePoint = fallbackMinutes * 60;
  if (state.perPoint) {
    const dur = parseDuration(state.perPoint);
    if (!("error" in dur)) {
      // Measured against the clock rather than assumed, so "1mo" is the month
      // that actually follows rather than a guess at how long a month is.
      onePoint = addDuration(now, dur) - now;
      perPoint = state.perPoint;
    }
  }
  const base = onePoint * Math.max(1, points);
  const sources: string[] = [];
  const ops: EffectOp[] = [];
  for (const { from, ops: theirs } of await CharacterAfflictions.ops(char.name)) {
    const mine = theirs.filter(o => o.op === RITUAL_TIME_OP);
    if (!mine.length) continue;
    ops.push(...mine);
    sources.push(from);
  }
  const percent = ritualTimePercent(ops, "harvest");
  return { seconds: scaleRitualSeconds(base, percent), base, percent, sources, perPoint };
}

// "2 hours per point; 3 points = 6 hours" - and the modifier when there is one.
function describeHarvestTime(t: RitualTime, points: number): string {
  const span = (s: number): string => formatCalendarSpan(diffCalendar(0, s));
  const cut = t.percent === 0 ? ""
    : ` (${t.percent > 0 ? "+" : ""}${t.percent}% from ${t.sources.join(", ") || "an affliction"}, was ${span(t.base)})`;
  return `${span(t.seconds)} for ${points} point${points === 1 ? "" : "s"} at ${t.perPoint} each${cut}`;
}

export async function cmdCray(forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  if (CrayStore.rating(char) <= 0) return sys(`${disp(char.name)} has no Cray (it is a Background - rate it on the sheet).`);
  const state = await CrayStore.get(char);
  const regen = state.status === "dead" ? "never regenerates"
    : state.status === "dormant" ? "1 point per YEAR (dormant)"
    : "1 point per day it goes untapped";
  const ritual = await harvestTime(char, 1);
  const cut = ritual.percent === 0 ? "" : ` (${ritual.percent > 0 ? "+" : ""}${ritual.percent}% from ${ritual.sources.join(", ")})`;
  return sys(`${disp(char.name)}'s ${crayLine(char, state)}: ${regen}. `
    + `Harvesting it costs ${formatCalendarSpan(diffCalendar(0, ritual.seconds))} per point${cut}`
    + `${state.perPoint ? "" : " (the chronicle's default - [[set-cray per-point=2h]] gives this cray its own)"}. `
    + `[[harvest N]] to draw it ritually, [[absorb]] to tear it out (Wits + Foundation vs ${10 - CrayStore.rating(char)}).`);
}

// A cray's own facts, set on the SITE rather than on the rules: each cray asks
// a different price in time, so that price lives with the cray.
export async function cmdSetCray(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  if (CrayStore.rating(char) <= 0) return sys(`${disp(char.name)} has no Cray (it is a Background - [[set-trait cray 3]] rates it).`);
  const raw = (cmd.named["per-point"] ?? cmd.positional[0])?.trim();
  if (!raw) {
    return sys(`set-cray needs what to set, e.g. [[set-cray per-point=2h]] (the ritual time per point drawn). [[show-cray]] shows it.`);
  }
  const state = await CrayStore.get(char);
  if (raw === "default" || raw === "-") {
    await CrayStore.set(char, { ...state, perPoint: undefined });
    const back = await harvestTime(char, 1);
    return sys(`${disp(char.name)}'s cray goes back to the chronicle's default: ${formatCalendarSpan(diffCalendar(0, back.seconds))} per point.`);
  }
  const dur = parseDuration(raw);
  if ("error" in dur) return sys(dur.error);
  await CrayStore.set(char, { ...state, perPoint: raw });
  const ritual = await harvestTime(char, 1);
  return sys(`${disp(char.name)}'s cray now asks ${formatCalendarSpan(diffCalendar(0, ritual.seconds))} per point harvested`
    + `${ritual.percent === 0 ? "" : ` (after ${ritual.percent}% from ${ritual.sources.join(", ")})`}. `
    + `[[harvest 3]] would take ${formatCalendarSpan(diffCalendar(0, (await harvestTime(char, 3)).seconds))}.`);
}

// Draw `want` points out of the cray and into the mage. Shared by the ritual
// harvest and the dangerous absorption: both can OVERDRAW, and overdrawing is
// what breaks a site (a dot lost, then dormancy or death).
async function drawFromCray(char: PlayableCharacter, want: number, ctx: CommandContext): Promise<{ gained: number; notes: string[]; refuse?: string }> {
  const notes: string[] = [];
  const state = await CrayStore.get(char);
  if (state.status === "dead") return { gained: 0, notes, refuse: `the cray is dead - it will never give again` };
  const rating = CrayStore.rating(char);
  const day = Math.floor(((await StoryClock.get())?.now ?? 0) / 86400);
  const overdraw = Math.max(0, want - state.points);
  if (overdraw > rating) {
    return { gained: 0, notes, refuse: `the cray holds ${state.points} and can be forced ${rating} beyond that - ${want} would tear it apart entirely` };
  }

  const fromPool = await CrayStore.tap(char, want, day);
  let gained = fromPool;
  if (overdraw > 0) {
    // Past empty: the site itself pays. A dot goes, and its own (reduced)
    // rating decides whether it recovers, sleeps for years, or dies.
    gained += overdraw;
    const reduced = Math.max(0, rating - 1);
    char.backgrounds = { ...char.backgrounds, cray: reduced };
    await CharacterStore.save(char);
    const exec = runRoll(makeRollSpec({ pool: `${reduced}`, difficulty: 8 }), () => 0, { rng: ctx.rng });
    const status: CrayState["status"] = exec.outcome === "botch" ? "dead" : exec.met ? "active" : "dormant";
    await CrayStore.set(char, { points: 0, status, lastTapDay: day });
    notes.push(`OVERDRAWN by ${overdraw}: the cray drops to ${reduced} dot${reduced === 1 ? "" : "s"} and is drained`);
    notes.push(exec.result!.message);
    notes.push(status === "dead" ? `💀 the cray DIES - it will never generate Quintessence again`
      : status === "dormant" ? `the cray falls DORMANT - one point per year until it wakes`
      : `the cray survives, depleted, and will refill at its normal rate`);
  }
  const def = CharacterResources.resolveDef(char, "magic-fuel");
  if (!def) return { gained: 0, notes, refuse: `has no magic-fuel resource to hold Quintessence` };
  const before = await CharacterResources.current(char, def);
  const { value } = await CharacterResources.gain(char, def.name, gained);
  notes.push(value - before < gained
    ? `${value - before} of ${gained} fit - ${def.name} is at ${value}/${resourceNumbers(char, def).max}, the rest spills`
    : `+${gained} ${def.name} -> ${value}/${resourceNumbers(char, def).max}`);
  return { gained, notes };
}

// The ritual method: no roll, the mage controls exactly how much - but it is
// time-consuming (pass time= to advance the clock with it).
export async function cmdHarvest(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  if (CrayStore.rating(char) <= 0) return sys(`${disp(char.name)} has no Cray to harvest.`);
  const want = Math.max(1, parseInt(cmd.positional[0] ?? "1", 10) || 1);
  // THE TIME PASSES BY ITSELF. Harvesting is a ritual measured in hours per
  // point, so asking the player to also type `time=6h` was asking them to do
  // the engine's arithmetic. `time=` still overrides (a Storyteller may rule
  // this one took all night), and `time=0` skips the clock entirely.
  const ritual = await harvestTime(char, want);
  const override = cmd.named["time"]?.trim();
  let move: Duration = { months: 0, seconds: ritual.seconds };
  if (override) {
    const dur = parseDuration(override);
    if ("error" in dur) return sys(dur.error);
    move = dur;
  }

  const r = await drawFromCray(char, want, ctx);
  if (r.refuse) return sys(`${disp(char.name)} can't harvest ${want}: ${r.refuse}.`);

  let timeNote = "";
  const before = await StoryClock.get();
  if (before && (move.months || move.seconds)) {
    const after = (await StoryClock.advance(move))!;
    timeNote = ` The ritual runs ${override ? formatCalendarSpan(diffCalendar(before.now, after.now)) : describeHarvestTime(ritual, want)}`
      + `, until ${formatStoryDay(after.now)}.`;
    timeNote += await applyRecovery(before.now, after.now);
    timeNote += (await expireAfflictions(after.now)).map(e => ` ${e}.`).join("");
  }
  const state = await CrayStore.get(char);
  return sys(`${disp(char.name)} harvests the cray - ${r.notes.join("; ")}. Now ${crayLine(char, state)}.${timeNote}`);
}

// The dangerous method: tear it out directly. Wits + Foundation vs 10 - rating,
// one point per success - and the mage must absorb everything drawn.
export async function cmdAbsorb(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const rating = CrayStore.rating(char);
  if (rating <= 0) return sys(`${disp(char.name)} has no Cray to draw from.`);
  const found = resolveFoundation(cmd.named["foundation"], (n: string) => resolveTraitFromRecord(char, n));
  const spec = makeRollSpec({ pool: `wits+${found.trait}`, difficulty: Math.max(2, 10 - rating), tags: ["magic"] });
  const { exec, notes } = await execCharacterRoll(char, spec, ctx);
  const net = exec.outcome === "botch" ? 0 : Math.max(0, exec.result?.net ?? 0);
  if (net <= 0) {
    return sys(`${disp(char.name)} reaches into the cray - ${formatExecution(exec)}${notes.length ? ` [${notes.join("; ")}]` : ""}. Nothing comes.`);
  }
  const r = await drawFromCray(char, net, ctx);
  if (r.refuse) return sys(`${disp(char.name)} draws ${net} - but ${r.refuse}.`);
  const state = await CrayStore.get(char);
  return sys(`${disp(char.name)} tears ${net} point${net === 1 ? "" : "s"} from the cray - ${formatExecution(exec)} - ${r.notes.join("; ")}. Now ${crayLine(char, state)}.`);
}

// Search the library: Intelligence + Library, the Storyteller setting the
// difficulty by how obscure the secret is. What the pages SAY is theirs to
// narrate; the roll says how much of it the mage finds.
export async function cmdResearch(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const topic = cmd.positional.join(" ").trim() || cmd.named["topic"]?.trim();
  if (!topic) return sys(`research needs a topic, e.g. [[research \`the seals of Belial\` difficulty=8]].`);
  const rating = effectiveTraitOf(char, "library");
  if (rating <= 0) return sys(`${disp(char.name)} has no Library to search.`);
  const present = (await CharacterAfflictions.list(char.name)).some(a => a.def === "in-library");
  if (!present) return sys(`${disp(char.name)} is not in their library - [[measure-door]] opens the way, or [[afflict in-library]] if they are simply there.`);
  const difficulty = parseInt(cmd.named["difficulty"] ?? "6", 10) || 6;
  const spec = makeRollSpec({ pool: "intelligence+library", difficulty, tags: (cmd.named["tags"] ?? "").split(",").map(t => t.trim()).filter(Boolean) });
  const { exec, notes } = await execCharacterRoll(char, spec, ctx);
  const found = exec.outcome === "botch" ? "the sources contradict each other - worse than nothing"
    : exec.met ? `${exec.result!.net} success${exec.result!.net === 1 ? "" : "es"} of material - the Storyteller says what it says`
    : "nothing useful surfaces";
  return sys(`${disp(char.name)} searches the library for "${topic}" - ${formatExecution(exec)}${notes.length ? ` [${notes.join("; ")}]` : ""}. ${found}.`);
}

// One line of health state for OOC replies.
export function healthLine(s: HealthSummary): string {
  const state = s.isDead ? " - DEAD" : s.isIncapacitated ? " - INCAPACITATED" : "";
  const overkill = s.overkill ? ` +${s.overkill} overkill` : "";
  return `${s.level} (penalty ${s.penalty}): ${s.bashing}B/${s.lethal}L/${s.aggravated}A, ${s.filled}/${s.capacity}${overkill}${state}`;
}

// spend <resource[::effect]> [target] [applications] - a plain deduction, or any
// configured effect run through the interpreter (heal, increase, pure cost,
// advisory ops...). The target argument is only consumed when an "increase" op
// has a group/bucket constraint to pick within.
export async function cmdSpend(cmd: ParsedCommand, ctx: CommandContext): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const raw = cmd.positional[0]?.trim();
  if (!raw) return sys(`spend needs a resource, e.g. [[spend willpower]], [[spend blood:heal 2]] or [[spend blood:boost strength 2]].`);
  const [which, effectName] = raw.split(":").map(s => s.trim());
  const def = CharacterResources.resolveDef(char, which);
  if (!def) return sys(`${disp(char.name)} has no resource "${which}".`);
  // Having the points and being able to burn them are different questions, and
  // this is where they come apart: a talisman may hand anyone a pool.
  const blocked = CharacterResources.cannotUse(char, def);
  if (blocked.length) {
    return sys(`${disp(char.name)} holds ${def.name} but cannot use it - that needs ${blocked.join(", ")} `
      + `(${blocked.map(b => capabilityNote(b)).filter(Boolean).join("; ") || "no rule the engine knows"}). `
      + `[[attune ${blocked[0]}]] if something granted it to him.`);
  }
  const e = resourceEffect(def, effectName || undefined);
  if (effectName && !e) return sys(`${def.name} has no "${effectName}" effect.`);

  if (!e) {
    // No effect configured: plain deduction (with optional reason).
    const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
    const { spent } = await CharacterResources.spend(char, which, amount);
    if (spent === 0) return sys(`${disp(char.name)} has no ${def.name} to spend.`);
    const now = await CharacterResources.current(char, def);
    const reason = cmd.named["reason"] ? ` (${cmd.named["reason"]})` : "";
    return sys(`${disp(char.name)} spends ${spent} ${def.name}${reason}. Now ${now}/${resourceNumbers(char, def).max}.`);
  }

  // Does any increase op need the player to pick a trait within a constraint?
  const needsTarget = e.apply.some(o =>
    o.op.toLowerCase() === "increase" && "need" in CharacterBoosts.resolveIncreaseTarget(char, o.target, undefined));
  const targetArg = needsTarget ? cmd.positional[1]?.trim() : undefined;
  if (needsTarget && !targetArg) {
    return sys(`${def.name}${effectName ? `:${effectName}` : ""} needs a trait, e.g. [[spend ${raw} strength 2]].`);
  }
  const applications = Math.max(1, parseInt(cmd.positional[needsTarget ? 2 : 1] ?? "1", 10) || 1);

  const r = await applyEffectSpec(char, def, effectName ?? "", e, { targetArg, applications, rng: ctx.rng });
  if (r.insufficient) return sys(`${disp(char.name)} has no ${def.name} to spend - ${r.insufficient}.`);
  if (r.refuse) return sys(`${r.refuse}.`);
  const now = await CharacterResources.current(char, def);
  const rollOnly = r.extra !== undefined && e.apply.every(isRollOp) && e.apply.length > 0;
  const tail = rollOnly ? " (roll modifiers apply only inside a roll - use [[roll ... spend=...]])" : "";
  return sys(`${disp(char.name)} - ${r.notes.join("; ")}. ${def.name} now ${now}/${resourceNumbers(char, def).max}.${tail}`);
}

export async function cmdResetUses(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  await EffectUses.resetAll(char);
  return sys(`${disp(char.name)}'s effect-use counters reset (new scene/turn).`);
}

export async function cmdDamage(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const severity = (cmd.positional[0] ?? "").trim().toLowerCase();
  if (severity !== "bashing" && severity !== "lethal" && severity !== "aggravated") {
    return sys(`damage needs a severity (bashing, lethal or aggravated), e.g. [[damage lethal 2]].`);
  }
  const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
  const summary = await CharacterHealth.damage(char, severity, amount);
  return sys(`${disp(char.name)} takes ${amount} ${severity}. Health: ${healthLine(summary)}.`);
}

export async function cmdHealth(forChar?: PlayableCharacter): Promise<string> {
  const char = forChar ?? await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const summary = await CharacterHealth.summary(char);
  const boosts = await CharacterBoosts.all(char);
  const boostBits = Object.entries(boosts).map(([k, v]) => `${StringUtil.toTitleCase(k)} +${v}`).join(", ");
  return sys(`${disp(char.name)} - ${healthLine(summary)}${boostBits ? `. Boosts: ${boostBits}` : ""}.`);
}

export async function cmdClearBoosts(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  await CharacterBoosts.clear(char);
  return sys(`${disp(char.name)}'s attribute boosts fade.`);
}

export async function cmdConfigureResources(): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter(`first - the wizard configures the resources your templates grant`);
  if (await WizardSession.get()) return sys(`A wizard is already running - answer it, or [[cancel-wizard]].`);
  const defs = CharacterResources.defsFor(char);
  const r = await RESOURCES_WIZARD.start({ charName: char.name, defs });
  if (r.done || !r.prompt || !r.state) return sys(`${r.summary ?? "Nothing to configure."}`);
  await WizardSession.set({ def: RESOURCES_WIZARD.id, state: r.state, prompt: r.prompt });
  return sys(`${RESOURCES_WIZARD.title} - your next plain messages answer the wizard. ${renderPromptText(r.prompt)}`);
}

export async function cmdCancelWizard(): Promise<string> {
  if (!(await WizardSession.get())) return sys(`No wizard is running.`);
  await WizardSession.clear();
  return sys(`Wizard cancelled - nothing saved.`);
}

export async function cmdGain(cmd: ParsedCommand): Promise<string> {
  const char = await CharacterStore.getCurrent();
  if (!char) return noCharacter();
  const which = cmd.positional[0]?.trim();
  if (!which) return sys(`gain needs a resource, e.g. [[gain willpower]].`);
  const amount = Math.max(1, parseInt(cmd.positional[1] ?? "1", 10) || 1);
  const def = CharacterResources.resolveDef(char, which);
  if (!def) return sys(`${disp(char.name)} has no resource "${which}".`);
  const { value } = await CharacterResources.gain(char, which, amount);
  return sys(`${disp(char.name)} regains ${def.name}. Now ${value}/${resourceNumbers(char, def).max}.`);
}
