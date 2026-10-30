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
 * Only imports ./event-state (itself dependency-free), so the suites that execute it under `node --test` can load it.
 */

import { eventState, untilLabel, ongoingLabel, londonDayNumber, londonMonthShort } from "./event-state";

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

/**
 * The grey meta line under a list row's title, and whether the row is ONGOING.
 *  · upcoming (or any not-running event): "19:30 · Mareel · Shetland Arts · to Sun 6 Dec"
 *  · ongoing: "Until Sun 18 Jan · Mareel" — its old start time/date is NOT shown, because that would read as still to come.
 */
export function rowMeta(
  e: { starts_at: string; ends_at?: string | null; venue?: string | null },
  organiser: string | null | undefined,
  now: Date | number = new Date(),
): { line: string; ongoing: boolean } {
  const who = venueAndOrganiser(e.venue, organiser);
  if (eventState(e, now) === "ongoing") return { line: [untilLabel(e, now), ...who].filter(Boolean).join(" · "), ongoing: true };
  return { line: [timeOnly(e.starts_at), ...who, rowEndSuffix(e.starts_at, e.ends_at)].filter(Boolean).join(" · "), ongoing: false };
}

/** Longer "when" text for strips and cards that show a date: the date normally, "Ongoing · Until …" while it is running. */
export function whenText(e: { starts_at: string; ends_at?: string | null }, now: Date | number = new Date()): string {
  return eventState(e, now) === "ongoing" ? ongoingLabel(e, now) : longDateTime(e.starts_at);
}

/* ── Homepage "What's happening" mosaic ───────────────────────────────────── */

/** How many events the homepage mosaic shows: 1 hero + 1 medium + 2 small, then a row of 3. */
export const HOME_MOSAIC_COUNT = 7;
/** The OneShetland image used when an event has no cover of its own (the homepage has always used this). */
export const HOME_FALLBACK_IMAGE = "/preview-v2/concert.jpg";
export type HomeSlot = "hero" | "medium" | "small" | "tile";
const SLOTS: HomeSlot[] = ["hero", "medium", "small", "small", "tile", "tile", "tile"];

export type HomeCard = {
  id: string;
  title: string;
  /** 1-based position in the mosaic, in the order the events arrived (chronological; nothing is re-ranked for its picture). */
  position: number;
  slot: HomeSlot;
  /** The event's own cover, or null when it has none. */
  cover: string | null;
  /** What the card draws: the event's own cover, else the OneShetland fallback image. Every card is image-backed. */
  image: string;
  /** true when `image` is the fallback because the event has no cover. */
  usesFallback: boolean;
  /** "Fri 30 Oct", or "Happening now" for an event in progress. */
  badge: string;
  /** "19:30 · Mareel", or "Until 17:00 · Mareel" for an event in progress. */
  line: string;
  venue: string | null;
  live: boolean;
  day: string;
  month: string;
  price: string | null;
};

const dateBadge = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: SHETLAND_TZ });

/**
 * Which card each homepage event gets. Pure, so the layout rules are testable without rendering:
 *   · the events are taken in the order given (the page's own query already sorted them) — never re-ordered for a better picture;
 *   · EVERY card with a cover uses it, whatever its size; an event with no cover uses the OneShetland fallback image (as it always
 *     has) — the coloured text card is only the last resort, if that image itself cannot load (see HomeCardImage);
 *   · an event that is in progress (started today, finishing today) says "Happening now" and "Until HH:MM" rather than a stale time.
 */
export function homeMosaicPlan(
  events: readonly { id: string; title: string; starts_at: string; ends_at?: string | null; venue?: string | null; cover_url?: string | null; price_text?: string | null }[],
  now: Date | number = new Date(),
): HomeCard[] {
  return events.slice(0, HOME_MOSAIC_COUNT).map((e, i) => {
    const live = eventState(e, now) === "ongoing";
    const cover = e.cover_url?.trim() || null;
    const venue = e.venue?.trim() || null;
    const time = live ? untilLabel(e, now) : timeOnly(e.starts_at);
    return {
      id: e.id, title: e.title, position: i + 1, slot: SLOTS[i], cover, image: cover ?? HOME_FALLBACK_IMAGE, usesFallback: !cover,
      badge: live ? "Happening now" : dateBadge(e.starts_at),
      line: [time, venue].filter(Boolean).join(" · "), venue, live,
      day: londonDayNumber(e.starts_at), month: londonMonthShort(e.starts_at), price: e.price_text?.trim() || null,
    };
  });
}
