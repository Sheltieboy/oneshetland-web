/**
 * event-display.ts — how an event's "when" and "where" read on a page.
 *
 * MULTI-DAY EVENTS
 * An event that starts on one Shetland calendar day and ends on a later one (a festival, an exhibition, a gig
 * that runs past midnight) used to show only its start date plus "Until 23:59" — so RIFFMAS (Fri 4 to Sun 6
 * December) read as if it ended on the 4th. When the two dates differ we now name BOTH. An event that starts and
 * ends on the same day keeps the concise "Until HH:MM".
 *
 * The comparison is on the Europe/London calendar day (not the server's or the viewer's), so an event ending at
 * 00:30 BST is correctly "the next day", whatever the machine's clock says. The start label is built with the same
 * options as fmtLongDateTime in events-data.ts (a test pins them equal).
 *
 * VENUE AND ORGANISER
 * A business hosting its own event is both venue and organiser, and the list printed it twice
 * ("Harry's Department Store · Harry's Department Store"). joinVenueOrganiser drops the organiser when it is the
 * same name as the venue (trim, case, whitespace and apostrophe style only — no fuzzy matching), and keeps both
 * when they genuinely differ.
 *
 * No imports, so the suites that execute it under `node --test` can load it directly.
 */

const SHETLAND_TZ = "Europe/London";

const dayKey = (iso: string): string => new Date(iso).toLocaleDateString("en-CA", { timeZone: SHETLAND_TZ });

/** "Friday 4 December at 19:00" — identical to fmtLongDateTime in events-data.ts. */
export function longDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: SHETLAND_TZ,
  });
}

export const timeOnly = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: SHETLAND_TZ });

/** The END of a multi-day event: the long date, then a padded 24-hour clock ("00:30", never "0:30"). */
function endLabel(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: SHETLAND_TZ });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: SHETLAND_TZ });
  return `${date} at ${time}`;
}

/** "Sun 6 Dec" — for the compact list rows. */
export const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: SHETLAND_TZ });

/** True when the event has an end and it falls on a different Shetland calendar day from the start. */
export function isMultiDay(startsAt: string, endsAt?: string | null): boolean {
  if (!endsAt) return false;
  const s = new Date(startsAt).getTime(), e = new Date(endsAt).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
  return dayKey(startsAt) !== dayKey(endsAt);
}

export type EventWhen = {
  /** "Friday 4 December at 19:00" */
  start: string;
  /** Same-day: "Until 23:00". Multi-day: "to Sunday 6 December at 23:59". Null when there is no end time. */
  end: string | null;
  multiDay: boolean;
  /** One line for a hero: "Friday 4 December at 19:00 to Sunday 6 December at 23:59", or just the start. */
  line: string;
};

export function eventWhen(startsAt: string, endsAt?: string | null): EventWhen {
  const start = longDateTime(startsAt);
  if (!endsAt || !Number.isFinite(new Date(endsAt).getTime())) return { start, end: null, multiDay: false, line: start };
  if (isMultiDay(startsAt, endsAt)) {
    const to = endLabel(endsAt);
    return { start, end: `to ${to}`, multiDay: true, line: `${start} to ${to}` };
  }
  return { start, end: `Until ${timeOnly(endsAt)}`, multiDay: false, line: start };
}

/** For a list row: "to Sun 6 Dec" when the event runs past its start day, otherwise null. */
export function rowEndSuffix(startsAt: string, endsAt?: string | null): string | null {
  return endsAt && isMultiDay(startsAt, endsAt) ? `to ${shortDate(endsAt)}` : null;
}

const norm = (s: string): string => s.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

/** True when two display names are the same apart from case, spacing and apostrophe style. */
export function sameName(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && norm(a) === norm(b);
}

/** The venue and (if different) the organiser, ready to join with " · ". Empty and missing values are skipped. */
export function venueAndOrganiser(venue?: string | null, organiser?: string | null): string[] {
  const v = venue?.trim() || null;
  const o = organiser?.trim() || null;
  const out: string[] = [];
  if (v) out.push(v);
  if (o && !sameName(v, o)) out.push(o);
  return out;
}
