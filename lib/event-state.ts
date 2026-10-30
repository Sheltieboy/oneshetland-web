/**
 * event-state.ts — is an event UPCOMING, ONGOING or FINISHED, and how should a card say so.
 *
 * WHY
 * Keeping a multi-day event discoverable while it runs (lib/event-currency.ts) is right, but it meant an exhibition that
 * began on 2 October could sit in an event list under "2 OCT", looking like something still to come. Every event is now
 * exactly one of three states, decided from the real timestamps:
 *
 *   UPCOMING  it has not started yet (starts_at >= now)
 *   ONGOING   it has started and has an end time that has not passed (ends_at >= now) — including an event that started
 *             earlier TODAY and is still running
 *   FINISHED  it has ended, or it has no end time and has started (we never assume an open-ended event goes on forever)
 *
 * TWO KINDS OF SURFACE
 *   · Upcoming-only ("what's happening", "next events", a business's or hub's coming events, the visitor page): an event
 *     is eligible when it STARTS today (Shetland time) or later and has not finished. A six-week exhibition that began
 *     weeks ago never takes one of those slots, but something starting at 10:00 today that is still running does.
 *   · The full What's On list: ongoing events stay discoverable until they finish, but are grouped under "Ongoing now"
 *     and labelled "until …" — their old start date is never shown as if it were a future date.
 *
 * TIME
 * States compare absolute instants. "Today" is the Europe/London calendar day (GMT or BST), computed with the zone
 * database, so it is the same on a UTC server, in a browser abroad and across the clock-change weekends.
 *
 * No imports, so the suites that run it under `node --test` can load it directly.
 */

const TZ = "Europe/London";

export type EventState = "upcoming" | "ongoing" | "finished";
export type StateWindow = { starts_at: string; ends_at?: string | null };

const ms = (v: Date | number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = v instanceof Date ? v.getTime() : typeof v === "number" ? v : new Date(v).getTime();
  return Number.isFinite(n) ? n : null;
};

export function eventState(e: StateWindow, now: Date | number = new Date()): EventState {
  const n = ms(now), s = ms(e.starts_at), en = ms(e.ends_at);
  if (n === null || s === null) return "finished";
  if (s >= n) return "upcoming";
  return en !== null && en >= n ? "ongoing" : "finished";
}

/* ── Shetland calendar day ────────────────────────────────────────────────── */

const parts = (t: number) => {
  const o: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(t))) o[p.type] = p.value;
  return { y: Number(o.year), m: Number(o.month), d: Number(o.day), h: Number(o.hour), mi: Number(o.minute), s: Number(o.second) };
};
const offsetMs = (t: number): number => {
  const p = parts(t);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000;
};

/** ISO instant of 00:00 Shetland time at the start of the day `now` falls in (the same day on any machine). */
export function londonDayStartIso(now: Date | number = new Date()): string {
  const n = ms(now) ?? Date.now();
  const p = parts(n);
  const guess = Date.UTC(p.y, p.m - 1, p.d);
  let t = guess - offsetMs(guess);
  t = guess - offsetMs(t);
  return new Date(t).toISOString();
}

/** YYYY-MM-DD of the Shetland day an instant falls on. */
export const londonDate = (v: Date | number | string): string =>
  new Date(ms(v) ?? 0).toLocaleDateString("en-CA", { timeZone: TZ });

/**
 * Upcoming-only surfaces: starts today (Shetland) or later, and has not finished.
 * Mirrors the query the pages send (upcomingSurfaceFilter) so what is shown and what is fetched cannot drift.
 */
export function isUpcomingSurfaceEligible(e: StateWindow, now: Date | number = new Date()): boolean {
  if (eventState(e, now) === "finished") return false;
  const s = ms(e.starts_at);
  return s !== null && s >= new Date(londonDayStartIso(now)).getTime();
}

/** PostgREST filter pieces for an upcoming-only query: `.gte("starts_at", fromIso)` and `.or(orFilter)`. */
export function upcomingSurfaceFilter(now: Date | number = new Date()): { fromIso: string; orFilter: string } {
  const nowIso = new Date(ms(now) ?? Date.now()).toISOString();
  return { fromIso: londonDayStartIso(now), orFilter: `ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${nowIso})` };
}

/* ── Wording ──────────────────────────────────────────────────────────────── */

const shortDay = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });

/** "Until 17:00" when it ends today (Shetland), otherwise "Until Sun 18 Jan". Empty when there is no end. */
export function untilLabel(e: StateWindow, now: Date | number = new Date()): string {
  const en = ms(e.ends_at);
  if (en === null || !e.ends_at) return "";
  return londonDate(en) === londonDate(now) ? `Until ${clock(e.ends_at)}` : `Until ${shortDay(e.ends_at)}`;
}

/** "Ongoing · Until Sun 18 Jan" — what an ongoing card says INSTEAD of its old start date or time. */
export function ongoingLabel(e: StateWindow, now: Date | number = new Date()): string {
  const u = untilLabel(e, now);
  return u ? `Ongoing · ${u}` : "Ongoing";
}

/** Split a list into ongoing events and the rest, keeping each group's order. */
export function splitByState<T extends StateWindow>(events: readonly T[], now: Date | number = new Date()): { ongoing: T[]; rest: T[] } {
  const ongoing: T[] = [], rest: T[] = [];
  for (const e of events) (eventState(e, now) === "ongoing" ? ongoing : rest).push(e);
  return { ongoing, rest };
}

/** Day-of-month and short month for a date badge, in Shetland time (never the server's or the viewer's). */
export const londonDayNumber = (iso: string): string => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", timeZone: TZ });
export const londonMonthShort = (iso: string): string => new Date(iso).toLocaleDateString("en-GB", { month: "short", timeZone: TZ });
