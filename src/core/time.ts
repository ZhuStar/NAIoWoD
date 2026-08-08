// =============================================================================
// TIME - pure calendar/clock math (no host)
// -----------------------------------------------------------------------------
// The story runs on a real (proleptic Gregorian) clock: historical Dark Ages
// dates work, durations roll over months/years correctly, and the cursor is
// second-granular so combat's future 3-second turns fit. Everything here is
// PURE - epoch SECONDS (UTC) in and out. The surface syntax is "yyyy-mm-dd-hh"
// (hour optional); durations are "s/m/h/d/w/mo/y" tokens ("2w 4h", "1mo").
// Adding a duration is calendar-aware (Jan 31 + 1mo = Feb 28); the span between
// two instants is reported as a natural breakdown, computed from the real
// endpoints so it is never the ambiguous "how many days IS a month" guess.
// =============================================================================

const padNum = (n: number, w = 2): string => String(Math.trunc(Math.abs(n))).padStart(w, "0");

// Days in a 1-based month of a (possibly historical) year - leap-aware, and safe
// for years < 100 (which Date.UTC would otherwise remap to 1900-1999).
function daysInMonth(year: number, month1to12: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month1to12, 0);   // month index `month1to12` = the NEXT month; day 0 = its last previous day
  return d.getUTCDate();
}

function secondsOfDay(d: Date): number {
  return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}

// --- Instants: "yyyy-mm-dd[-hh[:mm[:ss]]]" <-> epoch seconds ------------------

// Parse a story date. Accepts yyyy-mm-dd, yyyy-mm-dd-hh, yyyy-mm-dd-hh:mm, and
// yyyy-mm-dd-hh:mm:ss (the hour may also be space-separated). Returns epoch
// SECONDS (UTC) or a citing error.
export function parseStoryDate(raw: string | undefined): number | { error: string } {
  const s = (raw ?? "").trim();
  const m = s.match(/^(\d{1,6})-(\d{1,2})-(\d{1,2})(?:[-\s]+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (!m) return { error: `Can't read date "${s}" - use yyyy-mm-dd-hh (e.g. 1197-03-15-08).` };
  const [year, month, day, hour, minute, second] = m.slice(1).map(x => (x === undefined ? 0 : parseInt(x, 10)));
  if (month < 1 || month > 12) return { error: `Month must be 1-12 in "${s}".` };
  const dim = daysInMonth(year, month);
  if (day < 1 || day > dim) return { error: `Day must be 1-${dim} for ${year}-${padNum(month)} in "${s}".` };
  if (hour > 23 || minute > 59 || second > 59) return { error: `Time out of range in "${s}" (hh:mm:ss up to 23:59:59).` };
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, second, 0);
  return Math.floor(d.getTime() / 1000);
}

// Format epoch seconds as "yyyy-mm-dd hh:mm" (with ":ss" only when nonzero).
export function formatStoryDate(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const base = `${d.getUTCFullYear()}-${padNum(d.getUTCMonth() + 1)}-${padNum(d.getUTCDate())} ${padNum(d.getUTCHours())}:${padNum(d.getUTCMinutes())}`;
  return d.getUTCSeconds() ? `${base}:${padNum(d.getUTCSeconds())}` : base;
}

// --- Days of the week ---------------------------------------------------------

// The week is the one calendar cycle that never broke: the Gregorian reform of
// 1582 dropped ten DATES but not a single weekday (Thursday 4 Oct was followed
// by Friday 15 Oct), so the weekday of a proleptic-Gregorian instant is the real
// weekday, unbroken back past 1197. What is NOT the same is the date itself - a
// scribe in 1197 wrote Julian, which ran six days behind the Gregorian dates
// this engine stores. The DAY NAME here is right; the NUMBER beside it is the
// Gregorian one.
export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type Weekday = typeof WEEKDAYS[number];

// 0 = Sunday .. 6 = Saturday.
export function weekdayOf(epochSeconds: number): number {
  return new Date(epochSeconds * 1000).getUTCDay();
}

export function weekdayName(epochSeconds: number): Weekday {
  return WEEKDAYS[weekdayOf(epochSeconds)];
}

const titleCase = (s: string): string => s.replace(/(^|[\s-])([a-z])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase());

// "Friday 1197-03-15 08:00" - the parseable form with the day it fell on.
export function formatStoryDay(epochSeconds: number): string {
  return `${titleCase(weekdayName(epochSeconds))} ${formatStoryDate(epochSeconds)}`;
}

// --- Durations: fixed part (seconds) + calendar part (months) ----------------

// Months and years are calendar-relative (variable length) so they are kept
// apart from the fixed units and applied by walking the calendar.
export interface Duration { months: number; seconds: number }

const UNIT_SECONDS: Record<string, number> = {
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1,
  m: 60, min: 60, mins: 60, minute: 60, minutes: 60,
  h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
  d: 86400, day: 86400, days: 86400,
  w: 604800, wk: 604800, wks: 604800, week: 604800, weeks: 604800,
};
const UNIT_MONTHS: Record<string, number> = {
  mo: 1, mon: 1, mons: 1, month: 1, months: 1,
  y: 12, yr: 12, yrs: 12, year: 12, years: 12,
};

// Parse "2w 4h", "1mo", "90s", "3 days" (tokens may be space-separated or not;
// negatives rewind). Returns a Duration or a citing error.
export function parseDuration(raw: string | undefined): Duration | { error: string } {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return { error: `Needs a duration, e.g. "3d", "2w 4h", "1mo", "90s".` };
  let months = 0, seconds = 0, matched = false;
  const re = /(-?\d+)\s*([a-z]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = parseInt(m[1], 10);
    const unit = m[2];
    if (unit in UNIT_MONTHS) months += n * UNIT_MONTHS[unit];
    else if (unit in UNIT_SECONDS) seconds += n * UNIT_SECONDS[unit];
    else return { error: `Unknown time unit "${unit}" in "${s}" - use s/m/h/d/w/mo/y.` };
    matched = true;
  }
  if (!matched) return { error: `Can't read duration "${s}" - use e.g. "3d", "2w 4h", "1mo", "90s".` };
  return { months, seconds };
}

// Add a duration to an instant. The month/year part is applied first, clamping
// the day to the target month's length (Jan 31 + 1mo -> Feb 28), then the fixed
// seconds are added.
export function addDuration(epochSeconds: number, dur: Duration): number {
  const d = new Date(epochSeconds * 1000);
  if (dur.months) {
    const targetIndex = d.getUTCMonth() + dur.months;
    const targetYear = d.getUTCFullYear() + Math.floor(targetIndex / 12);
    const targetMonth = ((targetIndex % 12) + 12) % 12;   // 0-11
    const day = Math.min(d.getUTCDate(), daysInMonth(targetYear, targetMonth + 1));
    d.setUTCFullYear(targetYear, targetMonth, day);
  }
  return Math.floor(d.getTime() / 1000) + dur.seconds;
}

// --- Spans between two instants ----------------------------------------------

export interface CalendarSpan {
  negative: boolean;                 // b is before a
  years: number; months: number; days: number;
  hours: number; minutes: number; seconds: number;
  totalSeconds: number;              // absolute magnitude
}

// The exact span from a to b, as a natural years/months/days/h:m:s breakdown.
// Whole calendar months are counted from the earlier endpoint (backing off if
// they would overshoot); the remainder is a plain fixed-time difference - so the
// answer is unambiguous and reversible with addDuration.
export function diffCalendar(aEpoch: number, bEpoch: number): CalendarSpan {
  const negative = bEpoch < aEpoch;
  const lo = negative ? bEpoch : aEpoch;
  const hi = negative ? aEpoch : bEpoch;
  const totalSeconds = hi - lo;
  const loD = new Date(lo * 1000), hiD = new Date(hi * 1000);

  let months = (hiD.getUTCFullYear() - loD.getUTCFullYear()) * 12 + (hiD.getUTCMonth() - loD.getUTCMonth());
  if (loD.getUTCDate() > hiD.getUTCDate() ||
     (loD.getUTCDate() === hiD.getUTCDate() && secondsOfDay(loD) > secondsOfDay(hiD))) {
    months -= 1;   // the final month has not fully elapsed
  }
  if (months < 0) months = 0;

  let rem = hi - addDuration(lo, { months, seconds: 0 });   // leftover seconds, >= 0
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const days = Math.floor(rem / 86400); rem -= days * 86400;
  const hours = Math.floor(rem / 3600); rem -= hours * 3600;
  const minutes = Math.floor(rem / 60); rem -= minutes * 60;
  return { negative, years, months: remMonths, days, hours, minutes, seconds: rem, totalSeconds };
}

// A span as prose: "1 year, 2 months, 14 days, 12 hours" (empty units dropped).
export function formatCalendarSpan(span: CalendarSpan): string {
  const parts: string[] = [];
  const push = (n: number, unit: string): void => { if (n) parts.push(`${n} ${unit}${n === 1 ? "" : "s"}`); };
  push(span.years, "year"); push(span.months, "month"); push(span.days, "day");
  push(span.hours, "hour"); push(span.minutes, "minute"); push(span.seconds, "second");
  return parts.length ? parts.join(", ") : "no time";
}

// --- Recovery boundaries: days crossed & full moons ---------------------------

// How many UTC midnights lie in (from, to]. Successive small advances accumulate
// correctly (no "lastRecovery" state needed): each crossing is counted exactly
// once, whichever advance stepped over it. 0 when to <= from (rewinds recover
// nothing).
export function countDayBoundaries(fromEpoch: number, toEpoch: number): number {
  if (toEpoch <= fromEpoch) return 0;
  return Math.floor(toEpoch / 86400) - Math.floor(fromEpoch / 86400);
}

// Full moons on the MEAN lunar cycle: the synodic month (29.530588853 days)
// anchored to the 2000-01-06 18:14 UTC new moon, offset half a cycle. Real
// phases wobble a few hours around the mean, so a computed instant can be off
// by up to ~half a day - plenty for a story clock, even proleptically in 1197.
const SYNODIC_SECONDS = 29.530588853 * 86400;
const NEW_MOON_REF = 947182440;                          // 2000-01-06 18:14 UTC
const FULL_MOON_REF = NEW_MOON_REF + SYNODIC_SECONDS / 2;

// How many full-moon instants lie in (from, to]. 0 when to <= from.
export function countFullMoons(fromEpoch: number, toEpoch: number): number {
  if (toEpoch <= fromEpoch) return 0;
  return Math.floor((toEpoch - FULL_MOON_REF) / SYNODIC_SECONDS)
       - Math.floor((fromEpoch - FULL_MOON_REF) / SYNODIC_SECONDS);
}

// The first full-moon instant strictly after `epoch` (epoch seconds).
export function nextFullMoon(epoch: number): number {
  const k = Math.floor((epoch - FULL_MOON_REF) / SYNODIC_SECONDS) + 1;
  return Math.round(FULL_MOON_REF + k * SYNODIC_SECONDS);
}

// The first new-moon instant strictly after `epoch`.
export function nextNewMoon(epoch: number): number {
  const k = Math.floor((epoch - NEW_MOON_REF) / SYNODIC_SECONDS) + 1;
  return Math.round(NEW_MOON_REF + k * SYNODIC_SECONDS);
}

// --- The moon as a PHASE, not just an instant --------------------------------

// An INSTANT and a PHASE are different questions and the engine needs both.
// countFullMoons/nextFullMoon answer "when is the moon exactly full", which is
// what a recovery rule counts. Nobody in the story talks that way: they say it
// IS the full moon for the few nights it looks full. So the cycle is cut into
// eight slices, each CENTERED on its defining instant - the full moon phase runs
// from ~1.85 days before the exact full moon to ~1.85 days after. The two
// therefore disagree on purpose: it can be the full moon tonight while the exact
// instant is still a day out, and both statements are true.
export const MOON_PHASES = [
  "new", "waxing-crescent", "first-quarter", "waxing-gibbous",
  "full", "waning-gibbous", "last-quarter", "waning-crescent",
] as const;
export type MoonPhase = typeof MOON_PHASES[number];

export const MOON_GLYPHS: Record<MoonPhase, string> = {
  "new": "🌑", "waxing-crescent": "🌒", "first-quarter": "🌓", "waxing-gibbous": "🌔",
  "full": "🌕", "waning-gibbous": "🌖", "last-quarter": "🌗", "waning-crescent": "🌘",
};
export const MOON_LABELS: Record<MoonPhase, string> = {
  "new": "new moon", "waxing-crescent": "waxing crescent", "first-quarter": "first quarter",
  "waxing-gibbous": "waxing gibbous", "full": "full moon", "waning-gibbous": "waning gibbous",
  "last-quarter": "last quarter", "waning-crescent": "waning crescent",
};

const PHASE_SECONDS = SYNODIC_SECONDS / 8;

export interface MoonState {
  phase: MoonPhase;
  index: number;            // 0-7, MOON_PHASES order
  next: MoonPhase;
  age: number;              // seconds since the new moon that opened this cycle
  fraction: number;         // 0..1 through the cycle (0 = new, 0.5 = full)
  illumination: number;     // 0..1 of the disc lit
  waxing: boolean;
  into: number;             // seconds since THIS phase began
  toNext: number;           // seconds until the next phase begins
  begins: number;           // epoch seconds this phase began
  ends: number;             // epoch seconds the next phase begins
}

// Where the moon is at `epoch`. Every date this engine handles is a thousand
// years BEFORE the reference, so the slice index is taken with Math.floor
// (which rounds toward -Infinity and so keeps working) rather than a modulo
// that would flip sign.
export function moonAt(epoch: number): MoonState {
  const slice = Math.floor((epoch - NEW_MOON_REF + PHASE_SECONDS / 2) / PHASE_SECONDS);
  const begins = NEW_MOON_REF + slice * PHASE_SECONDS - PHASE_SECONDS / 2;
  const index = ((slice % 8) + 8) % 8;
  const age = (((epoch - NEW_MOON_REF) % SYNODIC_SECONDS) + SYNODIC_SECONDS) % SYNODIC_SECONDS;
  const fraction = age / SYNODIC_SECONDS;
  return {
    phase: MOON_PHASES[index],
    index,
    next: MOON_PHASES[(index + 1) % 8],
    age,
    fraction,
    illumination: (1 - Math.cos(2 * Math.PI * fraction)) / 2,
    waxing: fraction < 0.5,
    into: epoch - begins,
    toNext: begins + PHASE_SECONDS - epoch,
    begins: Math.round(begins),
    ends: Math.round(begins + PHASE_SECONDS),
  };
}

// When the named phase next BEGINS, strictly after `epoch`. Note this is the
// start of the window, not the principal instant: nextMoonPhase(e, "full") comes
// ~1.85 days before nextFullMoon(e).
export function nextMoonPhase(epoch: number, phase: MoonPhase): number {
  const k = MOON_PHASES.indexOf(phase);
  const base = NEW_MOON_REF + k * PHASE_SECONDS - PHASE_SECONDS / 2;
  const m = Math.floor((epoch - base) / SYNODIC_SECONDS) + 1;
  return Math.round(base + m * SYNODIC_SECONDS);
}

// A rough span for the moon report: hours matter, seconds do not.
function roundToHour(seconds: number): number {
  return Math.max(0, Math.round(seconds / 3600) * 3600);
}

// "🌔 waxing gibbous (71% lit) - 2 days, 3 hours in, 1 day, 15 hours to the
// full moon". Deliberately says all three things the Storyteller asks for:
// which phase, how deep into it, how long until the next.
export function formatMoon(m: MoonState): string {
  // Both spans are bounded by one slice (~3.7 days), so measuring them from
  // epoch 0 can never surface a calendar unit - it is a plain fixed breakdown.
  const span = (secs: number): string => formatCalendarSpan(diffCalendar(0, roundToHour(secs)));
  const pct = Math.round(m.illumination * 100);
  return `${MOON_GLYPHS[m.phase]} ${MOON_LABELS[m.phase]} (${pct}% lit) - ${span(m.into)} in, `
       + `${span(m.toNext)} to the ${MOON_LABELS[m.next]}`;
}
