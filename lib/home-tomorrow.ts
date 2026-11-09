/**
 * lib/home-tomorrow.ts — the "Tomorrow" preview under What's happening: the first few real things starting tomorrow, Shetland time.
 * Pure (the loader in home-tomorrow.server.ts only fetches). An event counts only if it is published, visible and starts tomorrow (London); a regular
 * activity counts only through a genuine next session tomorrow. Nothing is invented, and an empty tomorrow means no strip at all.
 */
import { londonDate, londonMidnight } from "./activities.ts";

export type TomorrowEvent = { id: string; title: string; starts_at: string; venue?: string | null; locality?: string | null };
export type TomorrowActivity = { id: string; slug: string; title: string; next_starts_at: string | null; venue?: string | null; locality?: string | null };
export type TomorrowItem = { time: string; title: string; place: string; href: string };

const HOUR = 3_600_000;
/** [start, end) of tomorrow in Europe/London, as ISO instants. DST-safe: stepping by 36 h from midnight always lands inside the next day. */
export function tomorrowWindow(now: Date): { startIso: string; endIso: string; label: string } {
  const todayStart = londonMidnight(londonDate(now));
  const tomorrowYmd = londonDate(new Date(todayStart.getTime() + 36 * HOUR));
  const start = londonMidnight(tomorrowYmd);
  const end = londonMidnight(londonDate(new Date(start.getTime() + 36 * HOUR)));
  const label = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(start.getTime() + 12 * HOUR);
  return { startIso: start.toISOString(), endIso: end.toISOString(), label };
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/London" });

export function tomorrowItems(events: readonly TomorrowEvent[], activities: readonly TomorrowActivity[], now: Date, max = 3): TomorrowItem[] {
  const { startIso, endIso } = tomorrowWindow(now);
  const inWindow = (iso: string | null) => !!iso && iso >= startIso && iso < endIso;
  const rows = [
    ...events.filter((e) => inWindow(e.starts_at)).map((e) => ({ at: e.starts_at, time: clock(e.starts_at), title: e.title, place: (e.venue ?? e.locality ?? "").trim(), href: `/whats-on/${e.id}` })),
    ...activities.filter((a) => inWindow(a.next_starts_at)).map((a) => ({ at: a.next_starts_at as string, time: clock(a.next_starts_at as string), title: a.title, place: (a.venue ?? a.locality ?? "").trim(), href: `/whats-on/regular/${a.slug}` })),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.title.localeCompare(b.title));
  return rows.slice(0, max).map(({ time, title, place, href }) => ({ time, title, place, href }));
}
