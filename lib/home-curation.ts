/**
 * home-curation.ts — small pure decisions the Home page makes, kept out of the components so they can be tested.
 */
import type { TodaySnapshot } from "./shetland-today";
import { describeWeather } from "./shetland-today";

/**
 * Where a notice should take you. It used to be "/local" for everything, which landed on a page that no longer
 * shows notices. The most specific destination wins: the fundraiser, the event, the publishing hub, the
 * publishing business, and only then the hubs list.
 */
export function noticeHref(n: {
  campaign_id?: string | null;
  event_id?: string | null;
  hub?: { id?: string | null; slug?: string | null } | null;
  business?: { id?: string | null; slug?: string | null } | null;
}): string {
  if (n.campaign_id) return `/hubs/campaign/${n.campaign_id}`;
  if (n.event_id) return `/whats-on/${n.event_id}`;
  const hub = n.hub?.slug || n.hub?.id;
  if (hub) return `/hubs/${hub}`;
  const biz = n.business?.slug || n.business?.id;
  if (biz) return `/directory/${biz}`;
  return "/hubs";
}

/** Ship content belongs on Home only while it is useful: in port today, or arriving within three days. */
export function cruiseWorthShowing(card: { isToday?: boolean; date?: string | null } | null | undefined, now: Date = new Date()): boolean {
  if (!card) return false;
  if (card.isToday) return true;
  if (!card.date) return false;
  const ms = new Date(`${card.date}T00:00:00`).getTime() - now.getTime();
  return ms > -86_400_000 && ms <= 3 * 86_400_000;
}

/** The one-line Shetland Today treatment for a phone. */
export function todayStrip(s: TodaySnapshot | null): string | null {
  if (!s) return null;
  const parts: string[] = [];
  if (s.tempC != null) parts.push(`${Math.round(s.tempC)}° ${describeWeather(s.weatherCode).label}`.trim());
  if (s.sunset) parts.push(`Sunset ${s.sunset}`);
  return parts.length ? `${s.place}: ${parts.join(" · ")}` : null;
}
