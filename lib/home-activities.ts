/**
 * home-activities.ts — which Regular Activities the homepage features, and what each card says.
 *
 * Pure and testable. Rules:
 *  - Only activities with a LIVE session still to come are featured. Cancelled sessions and breaks never count as upcoming, and an
 *    activity whose sessions in the window are all cancelled or on a break is simply not featured (it is still on the full listing, with its warning).
 *  - Variety: picks are made one at a time, preferring an organiser and a kind of activity not yet used. No organiser gets more than
 *    MAX_PER_ORGANISER cards however many activities it runs.
 *  - Fair rotation: among equally good candidates the choice rotates DAILY (a stable hash of the activity and the London date), so when the
 *    catalogue is bigger than the mosaic no activity or organiser is favoured day after day. With few activities, all of them show.
 *  - Order: by next session; the soonest one with a photograph leads, so the large tile is image-led when any activity has a photo.
 */
import { CATEGORY_LABEL, activityHref, londonDate, nextLine, patternText, safeHttps, type ListingRow, type RuleRow } from "./activities.ts";
import { thumbUrl } from "./activity-image-url.ts";
import { activityOrganiserLabel } from "./activity-organiser.ts";

export const HOME_ACTIVITY_MAX = 7;
export const MAX_PER_ORGANISER = 2;

export type HomeActivityCard = {
  id: string; href: string; title: string; /** null = no organiser claim (platform-owned or unreadable owner): the card shows no organiser line. */ organiser: string | null; category: string; categoryLabel: string;
  /** The activity's own photograph (full size), or null: the card then uses its category colours. */
  photo: string | null; thumb: string | null;
  days: string | null; place: string | null; next: string; nextStartsAt: string;
};

const ownerKey = (r: Pick<ListingRow, "owner_kind" | "owner_id" | "owner_name">) => `${r.owner_kind}:${r.owner_id ?? r.owner_name}`;
/** FNV-1a, stable across servers and restarts. */
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const hasFutureLive = (r: ListingRow, now: Date) => r.sessions_in_window > 0 && !!r.next_starts_at && !!r.next_ends_at && new Date(r.next_ends_at).getTime() > now.getTime();

export function homeActivityPlan(rows: readonly ListingRow[], rules: Record<string, RuleRow[]>, now: Date = new Date(), max = HOME_ACTIVITY_MAX): HomeActivityCard[] {
  const day = londonDate(now);
  const rot = new Map(rows.map((r) => [r.id, hash(`${day}|${r.id}`)]));
  const pool = rows.filter((r) => hasFutureLive(r, now)).sort((a, b) => rot.get(a.id)! - rot.get(b.id)! || a.title.localeCompare(b.title));
  const chosen: ListingRow[] = [];
  const perOwner = new Map<string, number>();
  const cats = new Set<string>();
  while (chosen.length < max) {
    let best: ListingRow | null = null; let bestScore = -1;
    for (const r of pool) {
      if (chosen.includes(r)) continue;
      const k = ownerKey(r); const n = perOwner.get(k) ?? 0;
      if (n >= MAX_PER_ORGANISER) continue;
      const score = (n === 0 ? 2 : 0) + (cats.has(r.category) ? 0 : 1);     // new organiser matters more than new category; the pool is in today's rotation order
      if (score > bestScore) { best = r; bestScore = score; }
    }
    if (!best) break;
    chosen.push(best); perOwner.set(ownerKey(best), (perOwner.get(ownerKey(best)) ?? 0) + 1); cats.add(best.category);
  }
  chosen.sort((a, b) => new Date(a.next_starts_at!).getTime() - new Date(b.next_starts_at!).getTime() || a.title.localeCompare(b.title));
  const firstPhoto = chosen.findIndex((r) => !!safeHttps(r.cover_url));
  if (firstPhoto > 0) chosen.unshift(...chosen.splice(firstPhoto, 1));
  return chosen.map((r) => {
    const photo = safeHttps(r.cover_url);
    const place = [...new Set([r.venue, r.locality].filter((x): x is string => !!x && !!x.trim()))].join(", ") || null;
    const rs = rules[r.id];
    return {
      id: r.id, href: activityHref(r.slug), title: r.title, organiser: activityOrganiserLabel(r.owner_kind, r.owner_name),
      category: r.category, categoryLabel: CATEGORY_LABEL[r.category] ?? "Activity", photo, thumb: photo ? safeHttps(thumbUrl(photo)) : null,
      days: rs && rs.length > 0 ? patternText(rs) : null, place, next: nextLine(r, now).text, nextStartsAt: r.next_starts_at!,
    };
  });
}
