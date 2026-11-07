/**
 * event-dates-builder.ts — the pure logic behind the simple "add your dates" builder.
 *
 * People type dates and times as they would say them: "Saturday 14 November, 7:30pm" in SHETLAND time (UK local time, Europe/London).
 * The database wants an instant with an explicit offset. londonToUtc() converts correctly across the March and October clock changes.
 * No imports; nothing here touches the network, the clock (callers pass `now`) or the DOM.
 */

export const MAX_DATES = 60;
export const MAX_SPAN_DAYS = 400;
export const NOTE_MAX = 200;
const TZ = "Europe/London";
const DAY = 86_400_000;
const HOUR = 3_600_000;

export type DateRow = {
  id: string;
  date: string;       // YYYY-MM-DD, London calendar date
  start: string;      // HH:MM, 24-hour, London local time
  end: string;        // HH:MM or "" - an end earlier than the start means "after midnight"
  note: string;
  endDate?: string;   // only kept when an existing event ends more than one day after it starts
};

export type UtcOccurrence = { starts_at: string; ends_at?: string; note?: string };

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** London's offset from UTC (ms) at an instant: 0 in winter (GMT), 3 600 000 in summer (BST). */
export function londonOffsetMs(utcMs: number): number {
  const floored = Math.floor(utcMs / 1000) * 1000;
  const p: Record<string, number> = {};
  for (const part of partsFmt.formatToParts(new Date(floored))) if (part.type !== "literal") p[part.type] = Number(part.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - floored;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isRealDate(date: string): boolean {
  const m = DATE_RE.exec(date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

export function addDays(date: string, n: number): string {
  const m = DATE_RE.exec(date);
  if (!m) return date;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + n * DAY).toISOString().slice(0, 10);
}

export type LondonResult =
  | { ok: true; iso: string; ms: number; ambiguous: boolean }
  | { ok: false; reason: "format" | "gap" };

/**
 * A London wall-clock date + time -> the UTC instant.
 *  - A time that does not exist (clocks go forward, 01:00-01:59 on the last Sunday of March) is refused ("gap").
 *  - A time that happens twice (clocks go back, 01:00-01:59 on the last Sunday of October) takes the FIRST one (summer time) and is flagged.
 */
export function londonToUtc(date: string, time: string): LondonResult {
  const dm = DATE_RE.exec(date), tm = TIME_RE.exec(time);
  if (!dm || !tm || !isRealDate(date)) return { ok: false, reason: "format" };
  const local = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]));
  const valid: number[] = [];
  for (const off of [HOUR, 0]) {            // summer candidate first: it is the earlier instant
    const t = local - off;
    if (londonOffsetMs(t) === off) valid.push(t);
  }
  if (valid.length === 0) return { ok: false, reason: "gap" };
  const ms = valid[0];
  return { ok: true, ms, iso: new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z"), ambiguous: valid.length === 2 };
}

/** A UTC instant -> London date and time fields (for pre-filling a form from stored data). */
export function utcToLondonParts(iso: string): { date: string; time: string } | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(new Date(ms))) if (part.type !== "literal") p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

let counter = 0;
export function newRowId(): string { counter += 1; return `r${Date.now().toString(36)}${counter}`; }

export function blankRow(partial: Partial<DateRow> = {}): DateRow {
  return { id: newRowId(), date: "", start: "", end: "", note: "", ...partial };
}

/** "Copy the last row to the next day": same times and note, the following calendar day, placed right after it. Null when the list is full or the row has no date. */
export function copyRowToNextDay(rows: readonly DateRow[], index: number): DateRow[] | null {
  const src = rows[index];
  if (!src || rows.length >= MAX_DATES || !isRealDate(src.date)) return null;
  const copy: DateRow = { id: newRowId(), date: addDays(src.date, 1), start: src.start, end: src.end, note: src.note };
  if (src.endDate) copy.endDate = addDays(src.endDate, 1);
  return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
}

export type RowIssue = { rowId: string; field: "date" | "start" | "end" | "note" | "row"; message: string };
export type BuildResult =
  | { ok: true; occurrences: UtcOccurrence[]; warnings: string[] }
  | { ok: false; issues: RowIssue[]; general: string[] };

/** Rows -> the occurrence list the server wants, with every rule the server enforces checked first, in friendly words. */
export function buildOccurrences(rows: readonly DateRow[], now: Date | number = new Date()): BuildResult {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const issues: RowIssue[] = [];
  const general: string[] = [];
  const warnings: string[] = [];
  const out: { ms: number; endMs: number; occ: UtcOccurrence; rowId: string }[] = [];

  if (rows.length === 0) general.push("Add at least one date.");
  if (rows.length > MAX_DATES) general.push(`You can add up to ${MAX_DATES} dates. Please remove some.`);

  for (const r of rows) {
    if (!r.date) { issues.push({ rowId: r.id, field: "date", message: "Choose the date." }); continue; }
    if (!isRealDate(r.date)) { issues.push({ rowId: r.id, field: "date", message: "That date does not look right." }); continue; }
    if (!r.start) { issues.push({ rowId: r.id, field: "start", message: "Add the start time." }); continue; }
    const s = londonToUtc(r.date, r.start);
    if (!s.ok) {
      issues.push({ rowId: r.id, field: "start", message: s.reason === "gap" ? "The clocks go forward that night, so that time does not exist. Pick a different time." : "That start time does not look right." });
      continue;
    }
    if (s.ambiguous) warnings.push("One of your times falls when the clocks go back, so it happens twice that night. We have used the first one.");
    if (s.ms <= nowMs) { issues.push({ rowId: r.id, field: "date", message: "This date has already passed. Please choose a date in the future." }); continue; }

    let endIso: string | undefined;
    let endMs = s.ms;
    if (r.end) {
      if (!TIME_RE.test(r.end)) { issues.push({ rowId: r.id, field: "end", message: "That end time does not look right." }); continue; }
      if (r.end === r.start && !r.endDate) { issues.push({ rowId: r.id, field: "end", message: "The end time must be after the start time." }); continue; }
      const endDate = r.endDate && isRealDate(r.endDate) ? r.endDate : r.end > r.start ? r.date : addDays(r.date, 1);   // earlier than the start = after midnight
      const e = londonToUtc(endDate, r.end);
      if (!e.ok) { issues.push({ rowId: r.id, field: "end", message: e.reason === "gap" ? "That end time does not exist because the clocks go forward." : "That end time does not look right." }); continue; }
      if (e.ms <= s.ms) { issues.push({ rowId: r.id, field: "end", message: "The end time must be after the start time." }); continue; }
      endIso = e.iso; endMs = e.ms;
    }
    const note = r.note.trim();
    if (note.length > NOTE_MAX) { issues.push({ rowId: r.id, field: "note", message: `Keep this note under ${NOTE_MAX} characters.` }); continue; }
    out.push({ ms: s.ms, endMs, rowId: r.id, occ: { starts_at: s.iso, ...(endIso ? { ends_at: endIso } : {}), ...(note ? { note } : {}) } });
  }

  // Two rows that start at the same moment
  const seen = new Map<number, string>();
  for (const o of out) {
    if (seen.has(o.ms)) issues.push({ rowId: o.rowId, field: "row", message: "You have already listed this date and start time." });
    else seen.set(o.ms, o.rowId);
  }

  if (out.length > 0 && issues.length === 0) {
    const first = Math.min(...out.map((o) => o.ms));
    const last = Math.max(...out.map((o) => o.endMs));
    if (last - first > MAX_SPAN_DAYS * DAY) general.push(`Your dates need to fall within ${MAX_SPAN_DAYS} days of each other. Please remove the ones that are furthest away.`);
  }

  if (issues.length || general.length) return { ok: false, issues, general };
  out.sort((a, b) => a.ms - b.ms);
  return { ok: true, occurrences: out.map((o) => o.occ), warnings: [...new Set(warnings)] };
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });

/** "Sat 14 Nov 2026, 7:30pm to 10:00pm" in Shetland time. */
export function describeOccurrence(o: { starts_at: string; ends_at?: string | null }): string {
  const s = new Date(o.starts_at);
  if (Number.isNaN(s.getTime())) return "";
  const t = (d: Date) => timeFmt.format(d).replace(/\s/g, "").toLowerCase();
  let out = `${dayFmt.format(s).replace(/,/g, "")}, ${t(s)}`;
  if (o.ends_at) {
    const e = new Date(o.ends_at);
    if (!Number.isNaN(e.getTime())) {
      const sameDay = utcToLondonParts(o.starts_at)?.date === utcToLondonParts(o.ends_at)?.date;
      out += sameDay ? ` to ${t(e)}` : ` to ${dayFmt.format(e).replace(/,/g, "")}, ${t(e)}`;
    }
  }
  return out;
}

/** Stored occurrences (UTC) -> editable rows in London time. */
export function rowsFromOccurrences(list: readonly { starts_at: string; ends_at?: string | null; note?: string | null }[]): DateRow[] {
  return list.map((o) => {
    const s = utcToLondonParts(o.starts_at);
    const e = o.ends_at ? utcToLondonParts(o.ends_at) : null;
    const row = blankRow({ date: s?.date ?? "", start: s?.time ?? "", end: e?.time ?? "", note: o.note ?? "" });
    // The builder assumes the same day, or the next day when the end is earlier than the start. Keep the real end date when it differs.
    if (s && e && e.date !== (e.time > s.time ? s.date : addDays(s.date, 1))) row.endDate = e.date;
    return row;
  });
}
