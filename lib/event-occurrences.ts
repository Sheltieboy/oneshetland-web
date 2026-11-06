/**
 * event-occurrences.ts — dated runs (a pantomime with fifteen performances, a week of shows) as ONE production with many performances.
 *
 * PURE. No database, no network, no clock of its own: every function is given `now`. It reads nothing that does not exist in
 * production today; callers will feed it rows from `event_occurrences` once that table is live. Nothing imports it yet.
 *
 * RULES
 *   · A production is one event (the parent) with zero or more occurrences (performances). Zero occurrences means "an ordinary
 *     event": every function then behaves exactly as lib/event-state.ts does today (that module is reused, not changed).
 *   · Cancelled performances are ignored when working out what is NEXT, but kept for display (so a visitor sees "cancelled").
 *     A run whose performances are all cancelled is cancelled.
 *   · BETWEEN: the run has started, no performance is on right now, and more are to come. It is treated as UPCOMING with a next date
 *     and is NEVER called "ongoing" (an exhibition is ongoing; a pantomime on Tuesday night is not "on now" all December).
 *   · Every day boundary is Europe/London (GMT/BST), via the zone database, so it is right across the clock-change weekends.
 *   · A performance with no end time is a point in time: once it has started it is over (the same rule eventState applies).
 */

import { eventState, londonDate } from "./event-state";

const TZ = "Europe/London";

export type OccurrenceStatus = "scheduled" | "cancelled" | "changed";
export type Occurrence = {
  id?: string;
  event_id?: string;
  starts_at: string;
  ends_at?: string | null;
  status?: OccurrenceStatus | string | null;
  venue?: string | null;
  locality?: string | null;
  note?: string | null;
};
export type RunEvent = {
  id: string;
  title?: string;
  starts_at: string;
  ends_at?: string | null;
  status?: string | null;
  is_dated_run?: boolean | null;
  is_featured?: boolean | null;
  organiser_name?: string | null;
  organiser_hub_id?: string | null;
  organiser_business_id?: string | null;
};

/** upcoming | live | between | finished | cancelled; "ongoing" appears ONLY for an event with no occurrences (today's behaviour, unchanged). */
export type RunState = "upcoming" | "live" | "between" | "finished" | "cancelled" | "ongoing";

const ms = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = v instanceof Date ? v.getTime() : typeof v === "number" ? v : new Date(v as string).getTime();
  return Number.isFinite(n) ? n : null;
};
const isCancelled = (o: Occurrence) => o.status === "cancelled";
const startOf = (o: Occurrence) => ms(o.starts_at) as number;

/** Occurrences with a readable start, soonest first (stable for equal starts). Cancelled ones are KEPT. */
export function displayOccurrences<T extends Occurrence>(occurrences: readonly T[] | null | undefined): T[] {
  return (occurrences ?? [])
    .map((o, i) => ({ o, i, s: ms(o.starts_at) }))
    .filter((x): x is { o: T; i: number; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.o);
}

/** The next performance still to start (starts at or after `now`), cancelled ones ignored. Null when there is none. */
export function nextOccurrence<T extends Occurrence>(occurrences: readonly T[] | null | undefined, now: Date | number = new Date()): T | null {
  const n = ms(now) ?? Date.now();
  return displayOccurrences(occurrences).find((o) => !isCancelled(o) && startOf(o) >= n) ?? null;
}

/** The performance that is on right now (started, not yet ended), cancelled ones ignored. */
export function liveOccurrence<T extends Occurrence>(occurrences: readonly T[] | null | undefined, now: Date | number = new Date()): T | null {
  const n = ms(now) ?? Date.now();
  return (
    displayOccurrences(occurrences).find((o) => {
      if (isCancelled(o)) return false;
      const s = startOf(o), e = ms(o.ends_at);
      return s < n && e !== null && e >= n;
    }) ?? null
  );
}

export function runState(event: RunEvent, occurrences: readonly Occurrence[] | null | undefined, now: Date | number = new Date()): RunState {
  const occ = displayOccurrences(occurrences);
  if (occ.length === 0) return eventState({ starts_at: event.starts_at, ends_at: event.ends_at }, now);   // an ordinary event: today's rule
  const live = occ.filter((o) => !isCancelled(o));
  if (live.length === 0) return "cancelled";
  if (liveOccurrence(live, now)) return "live";
  if (nextOccurrence(live, now)) return startOf(live[0]) < (ms(now) ?? Date.now()) ? "between" : "upcoming";
  return "finished";
}

/** True for the states that belong on an "upcoming" surface (a run in progress with performances to come is upcoming, never ongoing). */
export const isUpcomingLike = (s: RunState): boolean => s === "upcoming" || s === "between" || s === "live";

/* ── Wording ───────────────────────────────────────────────────────────────────────────────────────────────────────────────── */

const dayLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });

export type ListingCard = {
  eventId: string;
  title: string;
  href: string;
  state: RunState;
  isFeatured: boolean;
  organiserKey: string | null;
  /** Start of the next performance (or, for an ordinary event, its own start while it is still to come). Null when nothing is to come. */
  nextStartsAt: string | null;
  /** Performances that have not been cancelled (the size of the production); 0 for an ordinary event. */
  performances: number;
  /** Performances still to come. */
  remaining: number;
  /** "Next: Sat 6 Dec · 15 performances"; null for an ordinary event or when nothing is to come. */
  label: string | null;
};

const organiserKeyOf = (e: RunEvent): string | null => {
  const n = e.organiser_name?.trim().toLowerCase();
  return n ? `name:${n}` : e.organiser_hub_id ? `hub:${e.organiser_hub_id}` : e.organiser_business_id ? `biz:${e.organiser_business_id}` : null;
};

/** One card per production. */
export function listingCard(event: RunEvent, occurrences: readonly Occurrence[] | null | undefined, now: Date | number = new Date()): ListingCard {
  const occ = displayOccurrences(occurrences);
  const state = runState(event, occ, now);
  const live = occ.filter((o) => !isCancelled(o));
  const n = ms(now) ?? Date.now();
  const next = nextOccurrence(live, n);
  let nextStartsAt: string | null = null;
  if (occ.length === 0) nextStartsAt = state === "upcoming" ? event.starts_at : null;
  else nextStartsAt = next?.starts_at ?? null;
  const remaining = live.filter((o) => startOf(o) >= n).length;
  let label: string | null = null;
  if (occ.length > 0 && next) {
    label = live.length > 1 ? `Next: ${dayLabel(next.starts_at)} · ${live.length} performances` : `Next: ${dayLabel(next.starts_at)}`;
  }
  return {
    eventId: event.id,
    title: event.title ?? "",
    href: `/whats-on/${event.id}`,
    state,
    isFeatured: !!event.is_featured,
    organiserKey: organiserKeyOf(event),
    nextStartsAt,
    performances: live.length,
    remaining,
    label,
  };
}

/**
 * The homepage's What's On slots: featured first, then soonest; each production at most once; no organiser takes more than
 * `perOrganiserMax` slots; at most `max` cards. Cards with nothing to come (finished, cancelled, or an ordinary event that is
 * already ongoing) never take a slot.
 */
export function homepageSelect(cards: readonly ListingCard[], opts: { max?: number; perOrganiserMax?: number } = {}): ListingCard[] {
  const max = opts.max ?? 7, cap = opts.perOrganiserMax ?? 2;
  const eligible = cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => isUpcomingLike(c.state) && c.nextStartsAt !== null && ms(c.nextStartsAt) !== null)
    .sort((a, b) => Number(b.c.isFeatured) - Number(a.c.isFeatured) || (ms(a.c.nextStartsAt) as number) - (ms(b.c.nextStartsAt) as number) || a.i - b.i)
    .map((x) => x.c);
  const seen = new Set<string>(), perOrg = new Map<string, number>(), out: ListingCard[] = [];
  for (const c of eligible) {
    if (out.length >= max) break;
    if (seen.has(c.eventId)) continue;
    if (c.organiserKey) {
      const used = perOrg.get(c.organiserKey) ?? 0;
      if (used >= cap) continue;
      perOrg.set(c.organiserKey, used + 1);
    }
    seen.add(c.eventId);
    out.push(c);
  }
  return out;
}

/* ── Calendar ──────────────────────────────────────────────────────────────────────────────────────────────────────────────── */

const londonHour = (t: number): number =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date(t)));

/** YYYY-MM-DD plus n days (calendar arithmetic, no clock involved). */
function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * The Shetland calendar days a window covers. A window that merely runs past midnight (under a day long and finishing within
 * the first six hours of the next morning, like a 22:00 to 01:00 show) belongs to the day it STARTS on; a longer span (an
 * exhibition, a festival weekend) is on every day it covers. Capped at 400 days.
 */
export function coveredDays(startsAt: string, endsAt?: string | null): string[] {
  const s = ms(startsAt);
  if (s === null) return [];
  const first = londonDate(s);
  const e = ms(endsAt);
  if (e === null || e <= s) return [first];
  let last = londonDate(e);
  if (last > first && e - s < 24 * 3600_000 && londonHour(e) < 6) { const back = addDays(last, -1); last = back < first ? first : back; }
  const out: string[] = [];
  for (let d = first, i = 0; d <= last && i < 400; d = addDays(d, 1), i++) out.push(d);
  return out;
}

export type CalendarMonth = { year: number; month: number };   // month 1-12
export type CalendarEntry = {
  date: string;
  eventId: string;
  occurrenceId: string | null;
  title: string;
  href: string;
  starts_at: string;
  ends_at: string | null;
  cancelled: boolean;
};

/** One entry per performance on its own date, and one per covered day for a multi-day span; each links back to the parent. */
export function calendarEntries(
  events: readonly RunEvent[],
  occurrences: readonly (Occurrence & { event_id?: string })[] | null | undefined,
  month: CalendarMonth,
): CalendarEntry[] {
  const prefix = `${month.year}-${String(month.month).padStart(2, "0")}-`;
  const byEvent = new Map<string, Occurrence[]>();
  for (const o of occurrences ?? []) {
    if (!o.event_id) continue;
    (byEvent.get(o.event_id) ?? byEvent.set(o.event_id, []).get(o.event_id)!).push(o);
  }
  const out: CalendarEntry[] = [];
  for (const e of events) {
    const occ = displayOccurrences(byEvent.get(e.id));
    const windows: { occurrenceId: string | null; starts_at: string; ends_at: string | null; cancelled: boolean }[] =
      occ.length > 0
        ? occ.map((o) => ({ occurrenceId: o.id ?? null, starts_at: o.starts_at, ends_at: o.ends_at ?? null, cancelled: isCancelled(o) || e.status === "cancelled" }))
        : [{ occurrenceId: null, starts_at: e.starts_at, ends_at: e.ends_at ?? null, cancelled: e.status === "cancelled" }];
    for (const w of windows) {
      for (const date of coveredDays(w.starts_at, w.ends_at)) {
        if (!date.startsWith(prefix)) continue;
        out.push({ date, eventId: e.id, occurrenceId: w.occurrenceId, title: e.title ?? "", href: `/whats-on/${e.id}`, starts_at: w.starts_at, ends_at: w.ends_at, cancelled: w.cancelled });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (ms(a.starts_at) as number) - (ms(b.starts_at) as number) || a.title.localeCompare(b.title));
}
