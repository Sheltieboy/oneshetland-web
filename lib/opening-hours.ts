/**
 * Opening hours — one definition of the shape, the parsing and the wording.
 *
 * The column is jsonb: { mon: "09:00-17:00", tue: "Closed", … }. Historically
 * it took free text ("7am - 12noon Monday to Saturday"), and some rows still
 * will, so everything here tolerates a value it can't parse rather than
 * throwing it away — it just can't be reasoned about.
 *
 * The editor writes the canonical "HH:MM-HH:MM" form. That matters because the
 * visitor planner has to answer "is this open at 14:20 on a Tuesday", and you
 * cannot ask that of "opens when the boat's in".
 *
 * Kept in step with the app's lib/opening-hours.ts — same shape, same rules.
 */

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type OpeningHours = Partial<Record<DayKey, string>>;

export const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

export const CLOSED = "Closed";

/** Minutes since midnight, or null if it isn't a canonical HH:MM-HH:MM range. */
export function parseRange(value: string | undefined | null): { open: number; close: number } | null {
  if (!value) return null;
  const m = /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const open = Number(m[1]) * 60 + Number(m[2]);
  let close = Number(m[3]) * 60 + Number(m[4]);
  // A closing time at or before opening means past midnight (a bar till 1am).
  if (close <= open) close += 24 * 60;
  return { open, close };
}

/** Mon=0 … Sun=6, matching DAYS. JS getDay() is Sun=0, hence the shift. */
export function dayKeyFor(date: Date): DayKey {
  return DAYS[(date.getDay() + 6) % 7].key;
}

/**
 * Have these hours passed their sell-by date?
 *
 * Seasonal opening times come with an end date — Quendale Mill's 10-5 is true
 * until 11 October and then it isn't. `until` is the last date the hours are
 * known good; after it they're UNKNOWN, not closed. We know the summer times
 * expired; we don't know what replaced them, and inventing a winter closure
 * would be the same mistake pointing the other way.
 *
 * Compared date-only, in local time — an evening on the last day is still the
 * last day.
 */
export function hoursExpired(until: string | null | undefined, when: Date): boolean {
  if (!until) return false;
  const [y, m, d] = until.split("-").map(Number);
  if (!y || !m || !d) return false;
  const lastMoment = new Date(y, m - 1, d, 23, 59, 59, 999);
  return when.getTime() > lastMoment.getTime();
}

/**
 * Is it open at this moment? `null` means "we don't know" — no hours recorded,
 * free text we can't read, or hours that have gone out of season. Never guess:
 * the planner shows "check times" for null, and that's a far better answer
 * than a confident wrong one.
 */
export function isOpenAt(
  hours: OpeningHours | null | undefined,
  when: Date,
  until?: string | null,
): boolean | null {
  if (!hours) return null;
  if (hoursExpired(until, when)) return null;
  const value = hours[dayKeyFor(when)];
  if (!value) return null;
  if (value.trim().toLowerCase() === CLOSED.toLowerCase()) return false;
  const range = parseRange(value);
  if (!range) return null;
  const mins = when.getHours() * 60 + when.getMinutes();
  return mins >= range.open && mins < range.close;
}

/** "09:00" → "9am", "17:30" → "5.30pm" — UK English, no leading zero. */
function prettyTime(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}.${String(m).padStart(2, "0")}${suffix}`;
}

/** Human wording for one day. Unparseable free text is shown as written. */
export function formatDay(value: string | undefined | null): string {
  if (!value) return "—";
  if (value.trim().toLowerCase() === CLOSED.toLowerCase()) return CLOSED;
  const range = parseRange(value);
  if (!range) return value;
  return `${prettyTime(range.open)} – ${prettyTime(range.close)}`;
}

/** True when at least one day has been filled in. */
export function hasAnyHours(hours: OpeningHours | null | undefined): boolean {
  return !!hours && DAYS.some((d) => !!hours[d.key]);
}

/** True when every recorded day is canonical — i.e. the planner can trust it. */
export function isMachineReadable(hours: OpeningHours | null | undefined): boolean {
  if (!hasAnyHours(hours)) return false;
  return DAYS.every((d) => {
    const v = hours?.[d.key];
    if (!v) return true;
    return v.trim().toLowerCase() === CLOSED.toLowerCase() || parseRange(v) !== null;
  });
}
