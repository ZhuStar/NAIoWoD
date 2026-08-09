// Split out of the former 7941-line src/game.ts (memory §7.91). The cut points
// are the file's own section banners and SOURCE ORDER IS PRESERVED across the
// split, so dist/naiowod.ts keeps the exact declaration order it had as one
// file - the artifact's only diff is which //#region each line sits in.
import { ParsedCommand, sys } from "../command";
import { ExprScope, evaluateCondition } from "../core/expr";
import { Duration, MOON_GLYPHS, MOON_LABELS, MOON_PHASES, WEEKDAYS, countDayBoundaries, countFullMoons, diffCalendar, formatCalendarSpan, formatMoon, formatStoryDate, formatStoryDay, moonAt, nextFullMoon, nextMoonPhase, nextNewMoon, parseDuration, parseStoryDate, weekdayOf } from "../core/time";
import { StringUtil } from "../core/traits";
import { AfflictionExpiry, expiryElapsed, rollSpendsCharge } from "../rules";
import { ActiveAffliction, CharacterAfflictions, CharacterResources, CharacterStore, CrayStore, DateBook, PlayableCharacter, Scene, SceneStore, ScopeExtension, StoryClock, afflictionActive, afflictionNames, characterScope, effectiveTraitOf, resolveAffliction, resourceNumbers } from "../state";
import { disp, intOrUndef } from "./common";
import { syncSceneToAuthorNote } from "./narration";
import { countDownCooldowns, removeAffliction } from "./powers";

// =============================================================================
// TIME - the story clock: set when it begins, advance it, read it, bookmark &
// measure. Real Gregorian dates (core/time.ts); the clock lives in storyStorage.
// =============================================================================
export const NO_CLOCK = `No story clock yet - set when the story begins with [[story-start 1197-03-15-08]] (yyyy-mm-dd-hh).`;

// Resolve a date token for [[show-time-between]]: a saved bookmark, "now", "start",
// or an ad-hoc yyyy-mm-dd-hh literal.
async function resolveDateToken(tok: string): Promise<{ epoch?: number; label: string; error?: string }> {
  const t = tok.trim();
  const lc = t.toLowerCase();
  if (lc === "now" || lc === "start") {
    const c = await StoryClock.get();
    if (!c) return { label: t, error: NO_CLOCK };
    return { epoch: lc === "now" ? c.now : c.start, label: lc };
  }
  const saved = await DateBook.get(t);
  if (saved !== undefined) return { epoch: saved, label: StringUtil.normalize(t) };
  const parsed = parseStoryDate(t);
  if (typeof parsed === "number") return { epoch: parsed, label: formatStoryDate(parsed) };
  return { label: t, error: `"${t}" is not a saved date, "now"/"start", or a yyyy-mm-dd-hh date.` };
}

export async function cmdStoryStart(cmd: ParsedCommand): Promise<string> {
  const parsed = parseStoryDate(cmd.positional[0]);
  if (typeof parsed !== "number") return sys(parsed.error);
  const s = await StoryClock.setStart(parsed);
  return sys(`The story begins ${formatStoryDate(s.start)}. Move time with [[advance-time 1d]]; read it with [[show-date]].`);
}

// Clock-driven recovery: credit every character's recovery-bearing resources
// for the day boundaries and full moons crossed in (from, to]. Gated rules
// (`requires`) check the character's ACTIVE afflictions (def names and tags -
// "in-umbra" for Umbral communion). Returns "" when nothing was credited (a
// short hop inside one day, or everyone already full).
// AFFLICTIONS IN TIME, half one: the CLOCK side. Anything whose expiry has run
// out at `now` is lifted - through removeAffliction, so a mirror on somebody
// else goes with it. Every character, not just the current one: a curse on an
// absent NPC ends whether or not anyone was looking at his sheet.
// "UNTIL X", decided. The condition sees the CHARACTER plus the handful of
// clock facts an affliction cares about, all measured from when it began - so
// `full-moons >= 1` is "until the next full moon" and `blood <= 0` is "until his
// blood runs out". A condition the engine cannot read is FALSE and says so:
// nothing ends because a card was malformed.
// The TIME NAMESPACE, `system::time::…` (the parser folds `::` to `:`).
// Everything the clock can tell an expression lives under one prefix, so a
// chronicle can see at a glance which names are the engine's and which are its
// own traits. Two forms of each fact, and the short one is the point:
//
//   system:time:full-moons-since(a, b)   the general function, any two dates
//   system:time:full-moons               the same, with a = when this began
//                                        and b = now, filled in implicitly
//   full-moons                           the bare shorthand, for readability
//
// Dates come from anywhere a date can: an epoch literal, or a SAVED date by
// name (`system:time:date:my-wedding`, from the DateBook that [[save-date]]
// writes). So "until the full moon after the wedding" is expressible without
// anyone hard-coding a number.
//
// THE MOON AND THE WEEK ARE NUMBERS, and the names for them are numbers too.
// The expression language is numeric, so a phase can't be a string - but
// `moon-phase = moon:full` still reads like English, because `moon:full` is a
// NAMED CONSTANT (4) sitting in the same table as the fact it is compared to.
// Same for `weekday = day:friday`. A chronicle writes the words; the evaluator
// only ever sees arithmetic. `moon-phase` is the PHASE WINDOW, so it is true for
// the ~3.7 days the moon looks full - which is what "under the full moon" means
// in play; `full-moons` still counts exact instants, for recovery.
const TIME_PREFIX = "system:time";
function moonAndWeekFacts(now: number): Record<string, number> {
  const moon = moonAt(now);
  const facts: Record<string, number> = {
    "moon-phase": moon.index,
    "moon-illumination": Math.round(moon.illumination * 100),   // percent, so conditions stay integral
    "moon-age-days": Math.floor(moon.age / 86400),
    "moon-waxing": moon.waxing ? 1 : 0,
    "weekday": weekdayOf(now),
  };
  MOON_PHASES.forEach((p, i) => { facts[`moon:${p}`] = i; });
  WEEKDAYS.forEach((d, i) => { facts[`day:${d}`] = i; });
  return facts;
}

async function timeScopeExtension(fromEpoch: number, now: number): Promise<ScopeExtension> {
  const dates = await DateBook.all();
  const facts: Record<string, number> = {
    now, applied: fromEpoch,
    "full-moons": countFullMoons(fromEpoch, now),
    "elapsed-days": countDayBoundaries(fromEpoch, now),
    "elapsed-hours": Math.floor((now - fromEpoch) / 3600),   // the story clock counts SECONDS
    ...moonAndWeekFacts(now),
  };
  return (path) => {
    // The bare shorthands, so a condition reads like English. Whole path, not
    // path[0]: the named constants (`moon:full`, `day:friday`) are two segments.
    const joined = path.join(":");
    if (joined in facts) return { value: facts[joined] };
    if (!joined.startsWith(`${TIME_PREFIX}:`)) return undefined;
    const rest = joined.slice(TIME_PREFIX.length + 1);
    if (rest in facts) return { value: facts[rest], from: TIME_PREFIX };
    // A SAVED date by name - the same book [[show-date]] lists.
    const named = rest.startsWith("date:") ? dates[rest.slice("date:".length)] : undefined;
    return named === undefined ? undefined : { value: named, from: "saved date" };
  };
}

// The general functions, taking any two dates. `-since` reads left to right:
// how many of these fell between the first and the second.
function timeScopeCalls(): (name: string, args: number[]) => number | undefined {
  return (name, args) => {
    if (!name.startsWith(`${TIME_PREFIX}:`)) return undefined;
    const [a, b] = [args[0] ?? 0, args[1] ?? 0];
    switch (name.slice(TIME_PREFIX.length + 1)) {
      case "full-moons-since": return countFullMoons(a, b);
      case "days-since": return countDayBoundaries(a, b);
      case "hours-since": return Math.floor((b - a) / 3600);
      // One-argument forms, so a condition can ask about a date it names rather
      // than only about now: `moon-phase-at(system:time:date:the-pact)`.
      case "moon-phase-at": return moonAt(a).index;
      case "moon-illumination-at": return Math.round(moonAt(a).illumination * 100);
      case "weekday-at": return weekdayOf(a);
      case "next-full-moon": return nextFullMoon(a);
      case "next-new-moon": return nextNewMoon(a);
      default: return undefined;
    }
  };
}

// One scope for anything asked "has this run out yet?" - an affliction's
// until-condition, and a cooldown's.
export async function timedScope(char: PlayableCharacter | undefined, fromEpoch: number, now: number): Promise<ExprScope> {
  const extend = await timeScopeExtension(fromEpoch, now);
  const calls = timeScopeCalls();
  const base = char ? characterScope(char, extend) : { lookup: extend, call: undefined };
  return {
    lookup: base.lookup,
    // The time functions answer first; the character's own (trait-max,
    // road-virtues) answer for everything else.
    call: (name: string, args: number[]) => calls(name, args) ?? base.call?.(name, args),
  };
}

export async function expiryCondition(char: PlayableCharacter | undefined, c: { expiry?: AfflictionExpiry; at?: number }, now: number): Promise<boolean> {
  if (!c.expiry?.untilExpr) return false;
  const scope = await timedScope(char, c.at ?? now, now);
  return evaluateCondition(c.expiry.untilExpr, scope).truth;
}

// Has this instance ended, by any of its measures at once?
export async function afflictionEnded(char: PlayableCharacter | undefined, c: ActiveAffliction, now: number): Promise<boolean> {
  if (!c.expiry) return false;
  return expiryElapsed(c.expiry, now, await expiryCondition(char, c, now));
}

// THE RELIEF RUNS OUT. A suspension is an expiry pointed at the suspension
// rather than at the affliction, so it reuses the whole six-measure model: an
// hour of peace from Majesty, three rolls of it, or a scene. When it elapses
// the affliction is NOT re-applied - it never left - it simply bites again.
//
// Only a suspension somebody BOUGHT ("self") runs on a clock. One held by
// another affliction ends when that one does, which refreshSuppression decides.
async function tickSuspensions(subject: string, spend?: { field: "turns" | "scenes"; n: number } | { rolls: number }): Promise<string[]> {
  const list = await CharacterAfflictions.list(subject);
  if (!list.some(a => a.suspended?.by === "self" && a.suspended.until)) return [];
  let dirty = false;
  for (const a of list) {
    const until = a.suspended?.by === "self" ? a.suspended.until : undefined;
    if (!until || !spend) continue;
    if ("rolls" in spend) {
      if (until.rolls !== undefined) { until.rolls -= spend.rolls; dirty = true; }
    } else if (until[spend.field] !== undefined) {
      until[spend.field] = until[spend.field]! - spend.n; dirty = true;
    }
  }
  const now = (await StoryClock.get())?.now ?? 0;
  const char = await CharacterStore.load(subject);
  const back: string[] = [];
  for (const a of list) {
    if (a.suspended?.by !== "self" || !a.suspended.until) continue;
    // Judged with the affliction's OWN expiry machinery, on a synthetic
    // instance whose expiry is the relief's - one model, not two.
    const probe: ActiveAffliction = { ...a, expiry: a.suspended.until, at: a.suspended.at ?? a.at };
    if (!(await afflictionEnded(char ?? undefined, probe, now))) continue;
    delete a.suspended; dirty = true;
    back.push(`${disp(subject)}: ${disp(a.def)} takes hold again`);
  }
  if (dirty) await CharacterAfflictions.replace(subject, list);
  return back;
}

export async function expireAfflictions(now: number): Promise<string[]> {
  const lifted: string[] = [];
  for (const name of await CharacterStore.listNames()) {
    const char = await CharacterStore.load(name);
    for (const c of await CharacterAfflictions.list(name)) {
      if (!(await afflictionEnded(char ?? undefined, c, now))) continue;
      const r = await removeAffliction(name, c.def);
      if (r.removed) lifted.push(`${disp(name)}: ${disp(c.def)} ends${r.alsoLifted ? ` (and ${disp(r.alsoLifted)})` : ""}`);
    }
    lifted.push(...await tickSuspensions(name));
    await CharacterAfflictions.refreshSuppression(name);
  }
  return lifted;
}

// AFFLICTIONS IN TIME, half two: the ROLL side. A roll spends a charge only on
// the afflictions whose filter it matches ("your next three MELEE rolls"), and
// whatever hits zero is lifted right here - so the reply that says the roll
// happened is the same reply that says the effect ended.
export async function spendAfflictionCharges(subject: string, tags: string[], poolTraits: string[]): Promise<string[]> {
  const active = await CharacterAfflictions.list(subject);
  // A relief measured in ROLLS counts down even when no affliction does.
  const anyCharge = active.some(c => c.expiry?.rolls !== undefined);
  const anyRelief = active.some(c => c.suspended?.by === "self" && c.suspended.until?.rolls !== undefined);
  if (!anyCharge && !anyRelief) return [];
  const notes: string[] = [];
  const next = active.map(c => {
    if (c.expiry?.rolls === undefined || !rollSpendsCharge(c.expiry, tags, poolTraits)) return c;
    return { ...c, expiry: { ...c.expiry, rolls: c.expiry.rolls - 1 } };
  });
  await CharacterAfflictions.replace(subject, next);
  await countDownCooldowns("rolls", 1, subject);
  notes.push(...await tickSuspensions(subject, { rolls: 1 }));
  const now = (await StoryClock.get())?.now ?? 0;
  const char = await CharacterStore.load(subject);
  for (const c of next) {
    if (!c.expiry) continue;
    if (await afflictionEnded(char ?? undefined, c, now)) {
      const r = await removeAffliction(subject, c.def);
      if (r.removed) notes.push(`${disp(c.def)} ends${r.alsoLifted ? ` (and ${disp(r.alsoLifted)})` : ""}`);
    } else if (c.expiry.rolls !== undefined && active.find(a => a.def === c.def)?.expiry?.rolls !== c.expiry.rolls) {
      notes.push(`${disp(c.def)}: ${c.expiry.rolls} roll${c.expiry.rolls === 1 ? "" : "s"} left`);
    }
  }
  return notes;
}

// The TURN and SCENE sides. Same shape as the roll charges: decrement, then
// lift whatever ended - across every character, since a scene ends for the
// whole table and not only for whoever is selected.
async function countDownAfflictions(field: "turns" | "scenes", n: number): Promise<string[]> {
  const ended: string[] = [];
  await countDownCooldowns(field, n);
  const now = (await StoryClock.get())?.now ?? 0;
  for (const name of await CharacterStore.listNames()) {
    const active = await CharacterAfflictions.list(name);
    // ...and so does a relief measured in turns or scenes.
    const anyRelief = active.some(c => c.suspended?.by === "self" && c.suspended.until?.[field] !== undefined);
    if (!active.some(c => c.expiry?.[field] !== undefined) && !anyRelief) continue;
    const next = active.map(c => c.expiry?.[field] === undefined
      ? c
      : { ...c, expiry: { ...c.expiry, [field]: c.expiry[field]! - n } });
    await CharacterAfflictions.replace(name, next);
    ended.push(...await tickSuspensions(name, { field, n }));
    const char = await CharacterStore.load(name);
    for (const c of next) {
      if (!(await afflictionEnded(char ?? undefined, c, now))) continue;
      const r = await removeAffliction(name, c.def);
      if (r.removed) ended.push(`${disp(name)}: ${disp(c.def)} ends`);
    }
  }
  return ended;
}

export async function applyRecovery(fromEpoch: number, toEpoch: number): Promise<string> {
  const days = countDayBoundaries(fromEpoch, toEpoch);
  const moons = countFullMoons(fromEpoch, toEpoch);
  if (days <= 0 && moons <= 0) return "";
  const lines: string[] = [];
  for (const name of await CharacterStore.listNames()) {
    const char = await CharacterStore.load(name);
    if (!char) continue;
    // A gate names an affliction, and an affliction answers to its current name
    // AND every older one - so a chronicle written before the rename still gates.
    const active = await CharacterAfflictions.list(char.name);
    const gates = new Set<string>([
      ...(await CharacterAfflictions.tags(char.name)).map(t => StringUtil.normalize(t)),
      ...active.filter(afflictionActive).flatMap(c => {
        const def = resolveAffliction(c.def);
        return def ? afflictionNames(def) : [StringUtil.normalize(c.def)];
      }),
    ]);
    for (const def of CharacterResources.defsFor(char)) {
      if (!def.recovery?.length) continue;
      let credit = 0;
      const parts: string[] = [];
      for (const rule of def.recovery) {
        // A single gate, or several that must ALL be active at once
        // (full-rested AND in-sanctum).
        const needs = rule.requires === undefined ? [] : Array.isArray(rule.requires) ? rule.requires : [rule.requires];
        if (!needs.every(n => gates.has(StringUtil.normalize(n)))) continue;
        // A Background threshold too (the sanctum's sleep point is Sanctum 4's).
        if (rule.requiresTrait && effectiveTraitOf(char, rule.requiresTrait.trait) < rule.requiresTrait.atLeast) continue;
        const times = rule.per === "day" ? days : moons;
        if (times <= 0) continue;
        credit += rule.amount * times;
        parts.push(`${rule.per === "full-moon" ? "🌕 " : ""}${rule.amount}/${rule.per}×${times}${rule.note ? ` (${rule.note})` : ""}`);
      }
      if (credit <= 0) continue;
      const had = await CharacterResources.current(char, def);
      const { value } = await CharacterResources.gain(char, def.name, credit);
      if (value > had) lines.push(`${disp(char.name)} +${value - had} ${def.name} -> ${value}/${resourceNumbers(char, def).max} (${parts.join(", ")})`);
    }
    // A cray bubbles back too - 1/day on the days it went untapped.
    if (CrayStore.rating(char) > 0) {
      const gained = await CrayStore.replenish(char, Math.floor(fromEpoch / 86400), Math.floor(toEpoch / 86400));
      if (gained > 0) {
        const state = await CrayStore.get(char);
        lines.push(`${disp(char.name)}'s cray +${gained} -> ${state.points}/${CrayStore.capacity(char)}`);
      }
    }
  }
  return lines.length ? ` Recovery: ${lines.join("; ")}.` : "";
}

export async function cmdAdvanceTime(cmd: ParsedCommand): Promise<string> {
  const before = await StoryClock.get();
  if (!before) return sys(NO_CLOCK);
  const dur = parseDuration(cmd.positional.join(" ").trim());
  if ("error" in dur) return sys(dur.error);
  const after = (await StoryClock.advance(dur))!;
  const span = diffCalendar(after.start, after.now);
  const since = after.now === after.start ? "back to the very beginning" : `${formatCalendarSpan(span)} since it began`;
  const recovery = await applyRecovery(before.now, after.now);
  const ended = await expireAfflictions(after.now);
  const endedBit = ended.length ? ` ${ended.join("; ")}.` : "";
  return sys(`Time advances: ${formatStoryDate(before.now)} -> ${formatStoryDate(after.now)} (${since}).${recovery}${endedBit}`);
}

export async function cmdStoryDate(): Promise<string> {
  const c = await StoryClock.get();
  if (!c) return sys(NO_CLOCK);
  // The date now carries the DAY it fell on, and the moon as a phase rather
  // than a distant instant - the two things anyone narrating a night asks.
  const moon = ` ${formatMoon(moonAt(c.now))}. [[show-moon]] for the whole cycle.`;
  if (c.now === c.start) return sys(`Story date: ${formatStoryDay(c.now)} - the story has just begun.${moon}`);
  const span = diffCalendar(c.start, c.now);
  return sys(`Story date: ${formatStoryDay(c.now)} - ${formatCalendarSpan(span)} since it began (${formatStoryDay(c.start)}).${moon}`);
}

// The mean cycle is only good to a few hours, so printing a moon instant to the
// SECOND would be claiming precision the model does not have. Rounded to the
// minute for display; the epochs themselves stay exact.
const moonMoment = (epoch: number): string => formatStoryDate(Math.round(epoch / 60) * 60);
const moonDay = (epoch: number): string => formatStoryDay(Math.round(epoch / 60) * 60);
const moonAway = (from: number, to: number): string =>
  formatCalendarSpan(diffCalendar(from, from + Math.round((to - from) / 3600) * 3600));

// The moon in full: where it is, how deep into that phase, when the phase turns,
// and when each principal instant next falls. A named phase asks the other
// question - "when is the next one of THOSE" - which is what a rite or a
// werewolf's auspice actually needs.
export async function cmdMoon(cmd: ParsedCommand): Promise<string> {
  const c = await StoryClock.get();
  if (!c) return sys(NO_CLOCK);
  const asked = (cmd.named["name"] ?? cmd.positional[0])?.trim();
  if (asked) {
    const key = StringUtil.normalize(asked).replace(/^moon:/, "");
    const phase = MOON_PHASES.find(p => p === key || MOON_LABELS[p] === key.replace(/-/g, " "));
    if (!phase) {
      return sys(`No moon phase "${key}". The eight: ${MOON_PHASES.map(p => `${MOON_GLYPHS[p]} ${p}`).join(", ")}.`);
    }
    const opens = nextMoonPhase(c.now, phase);
    const here = moonAt(c.now).phase === phase ? ` It is the ${MOON_LABELS[phase]} right now.` : "";
    const exact = phase === "full" ? ` Exact full moon: ${moonMoment(nextFullMoon(c.now))}.`
                : phase === "new" ? ` Exact new moon: ${moonMoment(nextNewMoon(c.now))}.` : "";
    return sys(`${MOON_GLYPHS[phase]} The ${MOON_LABELS[phase]} next begins ${moonDay(opens)}, `
             + `${moonAway(c.now, opens)} from now.${here}${exact}`);
  }
  const m = moonAt(c.now);
  const cycle = MOON_PHASES.map(p => (p === m.phase ? `[${MOON_GLYPHS[p]} ${p}]` : `${MOON_GLYPHS[p]} ${p}`)).join(" -> ");
  return sys(
    `${formatStoryDay(c.now)}. ${formatMoon(m)}.`
    + ` This phase runs ${moonMoment(m.begins)} -> ${moonMoment(m.ends)};`
    + ` day ${Math.floor(m.age / 86400) + 1} of the cycle, ${m.waxing ? "waxing" : "waning"}.`
    + ` Next full moon ${moonMoment(nextFullMoon(c.now))}, next new moon ${moonMoment(nextNewMoon(c.now))} (mean cycle).`
    + ` Cycle: ${cycle}.`);
}

export async function cmdSaveDate(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`save-date needs a name, e.g. [[save-date siege-began]] (saves the current date) or [[save-date yuletide 1197-12-25-00]].`);
  let epoch: number;
  const dateArg = cmd.positional[1]?.trim();
  if (dateArg) {
    const p = parseStoryDate(dateArg);
    if (typeof p !== "number") return sys(p.error);
    epoch = p;
  } else {
    const c = await StoryClock.get();
    if (!c) return sys(`No story clock yet - [[story-start ...]] first, or pass a date: [[save-date ${StringUtil.normalize(name)} 1197-06-01-00]].`);
    epoch = c.now;
  }
  await DateBook.save(name, epoch);
  return sys(`Saved date "${StringUtil.normalize(name)}" = ${formatStoryDate(epoch)}.`);
}

export async function cmdForgetDate(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`forget-date needs a name, e.g. [[forget-date siege-began]].`);
  const key = StringUtil.normalize(name);
  return (await DateBook.remove(name)) ? sys(`Forgot date "${key}".`) : sys(`No saved date named "${key}".`);
}

export async function cmdDates(): Promise<string> {
  const map = await DateBook.all();
  const names = Object.keys(map);
  if (!names.length) return sys(`No saved dates yet. Save one with [[save-date <name>]] (or [[save-date <name> yyyy-mm-dd-hh]]).`);
  const items = names.map(n => `${n} (${formatStoryDate(map[n])})`).join("; ");
  return sys(`Saved dates: ${items}. [[show-time-between <a> <b>]] measures any two.`);
}

export async function cmdTimeBetween(cmd: ParsedCommand): Promise<string> {
  const a = cmd.positional[0]?.trim(), b = cmd.positional[1]?.trim();
  if (!a || !b) return sys(`time-between needs two dates, e.g. [[show-time-between start now]] or [[show-time-between siege-began 1197-12-25-00]] (each: a saved name, "now", "start", or yyyy-mm-dd-hh).`);
  const ra = await resolveDateToken(a);
  if (ra.error) return sys(ra.error);
  const rb = await resolveDateToken(b);
  if (rb.error) return sys(rb.error);
  const span = diffCalendar(ra.epoch!, rb.epoch!);
  if (span.totalSeconds === 0) return sys(`${ra.label} and ${rb.label} are the same moment (${formatStoryDate(ra.epoch!)}).`);
  const totalDays = Math.floor(span.totalSeconds / 86400);
  const totalBit = totalDays >= 1 ? ` (${totalDays} day${totalDays === 1 ? "" : "s"} total)` : "";
  const dir = span.negative ? "before" : "after";
  return sys(`${rb.label} is ${formatCalendarSpan(span)} ${dir} ${ra.label}${totalBit}. [${formatStoryDate(ra.epoch!)} -> ${formatStoryDate(rb.epoch!)}]`);
}

// =============================================================================
// SCENES - the named unit of play on the story clock (§7.31). A scene has one
// location and as many turns as it needs; [[turn]] advances by its turnLength.
// =============================================================================
function describeTurnLength(d: Duration | undefined): string {
  if (!d) return "freeform";
  const parts: string[] = [];
  if (d.months) parts.push(`${d.months} month${d.months === 1 ? "" : "s"}`);
  if (d.seconds) parts.push(formatCalendarSpan(diffCalendar(0, d.seconds)));   // fixed part as a span
  return parts.join(", ") || "freeform";
}

export async function cmdScene(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`scene needs a name, e.g. [[scene "The Parapet" location=\`Buda ramparts\` turn=3s]].`);
  const clock = await StoryClock.get();
  if (!clock) return sys(NO_CLOCK);
  let turnLength: Duration | undefined;
  const turnRaw = cmd.named["turn"]?.trim();
  if (turnRaw) {
    const d = parseDuration(turnRaw);
    if ("error" in d) return sys(d.error);
    turnLength = d;
  }
  // Auto-close any other open scene at the current instant (a new scene = a new place).
  const prev = await SceneStore.current();
  let closedNote = "";
  if (prev && StringUtil.normalize(prev.name) !== StringUtil.normalize(name)) {
    prev.status = "closed"; prev.endedAt = clock.now;
    await SceneStore.save(prev);
    closedNote = ` (closed "${prev.name}")`;
  }
  const scene: Scene = {
    name: StringUtil.normalize(name),
    startedAt: clock.now, turnsElapsed: 0, status: "open",
  };
  const location = cmd.named["location"]?.trim();
  const chapter = cmd.named["chapter"]?.trim();
  if (location) scene.location = location;
  if (chapter) scene.chapter = chapter;
  if (turnLength) scene.turnLength = turnLength;
  await SceneStore.save(scene);
  await SceneStore.setCurrent(scene.name);
  await syncSceneToAuthorNote(scene);   // a fresh scene has no plan yet -> clears any prior plan block
  return sys(`Scene "${scene.name}" opens${location ? ` at ${location}` : ""} (${formatStoryDate(clock.now)}; turns: ${describeTurnLength(turnLength)})${closedNote}.`);
}

export async function cmdTurn(cmd: ParsedCommand): Promise<string> {
  const scene = await SceneStore.current();
  if (!scene) return sys(`No open scene. Start one with [[scene "name" turn=3s]].`);
  const n = intOrUndef(cmd.positional[0]) ?? 1;
  if (n < 1) return sys(`turn count must be at least 1.`);
  let clockNote = "";
  if (scene.turnLength) {
    const total: Duration = { months: scene.turnLength.months * n, seconds: scene.turnLength.seconds * n };
    const after = await StoryClock.advance(total);
    if (after) clockNote = ` -> ${formatStoryDate(after.now)}`;
  }
  scene.turnsElapsed += n;
  await SceneStore.save(scene);
  const tag = scene.turnLength ? `${describeTurnLength(scene.turnLength)}/turn${clockNote}` : "freeform - no clock move";
  const ended = await countDownAfflictions("turns", n);
  // A turn that moved the clock may also have run a TIMED affliction out.
  if (scene.turnLength) ended.push(...await expireAfflictions((await StoryClock.get())?.now ?? 0));
  return sys(`${disp(scene.name)}: turn ${scene.turnsElapsed}${n > 1 ? ` (+${n})` : ""} (${tag}).`
    + `${ended.length ? ` ${ended.join("; ")}.` : ""}`);
}

export async function cmdEndScene(): Promise<string> {
  const scene = await SceneStore.current();
  if (!scene) return sys(`No open scene to end.`);
  const clock = await StoryClock.get();
  scene.status = "closed";
  if (clock) scene.endedAt = clock.now;
  await SceneStore.save(scene);
  await SceneStore.clearCurrent();
  await syncSceneToAuthorNote(undefined);   // no open scene -> clear the plan block from the Author's Note
  const span = clock && scene.startedAt !== clock.now ? diffCalendar(scene.startedAt, clock.now) : undefined;
  const spanBit = span && span.totalSeconds ? `, ${formatCalendarSpan(span)} of story time` : "";
  const ended = await countDownAfflictions("scenes", 1);
  return sys(`Scene "${scene.name}" ends after ${scene.turnsElapsed} turn${scene.turnsElapsed === 1 ? "" : "s"}${spanBit}.`
    + `${ended.length ? ` ${ended.join("; ")}.` : ""}`);
}

export async function cmdDowntime(cmd: ParsedCommand): Promise<string> {
  const before = await StoryClock.get();
  if (!before) return sys(NO_CLOCK);
  const dur = parseDuration(cmd.positional.join(" ").trim());
  if ("error" in dur) return sys(dur.error);
  const scene = await SceneStore.current();
  let sceneNote = "";
  if (scene) {
    scene.status = "closed"; scene.endedAt = before.now;
    await SceneStore.save(scene);
    await SceneStore.clearCurrent();
    await syncSceneToAuthorNote(undefined);
    sceneNote = ` (closed "${scene.name}")`;
  }
  const after = (await StoryClock.advance(dur))!;
  return sys(`Downtime: ${formatStoryDate(before.now)} -> ${formatStoryDate(after.now)}${sceneNote}.`);
}

export async function cmdScenes(): Promise<string> {
  const names = await SceneStore.names();
  if (!names.length) return sys(`No scenes yet. Start one with [[scene "name"]].`);
  const cur = await SceneStore.currentName();
  const items: string[] = [];
  for (const n of names) {
    const s = await SceneStore.get(n);
    if (s) items.push(`${disp(s.name)}${s.name === cur ? " (open)" : ""} [${formatStoryDate(s.startedAt)}, ${s.turnsElapsed} turn${s.turnsElapsed === 1 ? "" : "s"}]`);
  }
  return sys(`Scenes: ${items.join("; ")}. [[show-scene <name>]] for detail.`);
}

export async function cmdSceneInfo(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  const scene = name ? await SceneStore.get(name) : await SceneStore.current();
  if (!scene) return sys(name ? `No scene named "${StringUtil.normalize(name)}".` : `No open scene. Name one, or start with [[scene "name"]].`);
  const bits = [`${disp(scene.name)} [${scene.status}]`];
  if (scene.location) bits.push(`at ${scene.location}`);
  if (scene.chapter) bits.push(`chapter ${scene.chapter}`);
  bits.push(`began ${formatStoryDate(scene.startedAt)}`);
  if (scene.endedAt) bits.push(`ended ${formatStoryDate(scene.endedAt)}`);
  bits.push(`${scene.turnsElapsed} turn${scene.turnsElapsed === 1 ? "" : "s"} of ${describeTurnLength(scene.turnLength)}`);
  const planBit = scene.plan ? ` Plan: ${scene.plan}` : "";
  return sys(`${bits.join(", ")}.${planBit}`);
}

export async function cmdForgetScene(cmd: ParsedCommand): Promise<string> {
  const name = cmd.positional[0]?.trim();
  if (!name) return sys(`forget-scene needs a name, e.g. [[forget-scene the-parapet]].`);
  const key = StringUtil.normalize(name);
  if ((await SceneStore.currentName()) === key) { await SceneStore.clearCurrent(); await syncSceneToAuthorNote(undefined); }
  return (await SceneStore.remove(name)) ? sys(`Forgot scene "${key}".`) : sys(`No scene named "${key}".`);
}
