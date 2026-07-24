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
