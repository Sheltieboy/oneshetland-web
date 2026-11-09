/**
 * lib/home-new-this-week.ts — which genuinely NEW things the homepage's "New in Shetland this week" section shows.
 *
 * RULES (all enforced here, in one pure function, so the live loader only has to supply rows):
 *   1. FRESH: an item counts only if its real publication date is in the last WINDOW_DAYS (published_at for events, listed_at for jobs,
 *      owner_activated_at for businesses, start date for offers; never created_at where they differ). No date, or a date in the future, means not new.
 *   2. NOT STALE: an item must still be useful. An event or activity must not have started more than a few hours ago, an offer must not have
 *      ended, a job must not have closed. Expired things are never shown as new.
 *   3. NO DOUBLE EXPOSURE / NO PAID BOOST: ids already on the Discover local businesses shelf are passed in `excludeIds` and skipped. Ordering
 *      uses publication time and photograph only, never subscription tier, so this section cannot sell or hide commercial placement.
 *   4. ONE CARD PER TITLE: a touring show or a repeated session is the same news once; the newest listing of a kind+title is kept.
 *   5. VARIETY: one featured item (newest with a photograph, else newest), then up to three supporting items, preferring types not yet shown.
 *   6. QUIET WEEKS: fewer than MIN_TO_SHOW items shows nothing at all rather than padding with old content.
 */
export type NewKind = "event" | "activity" | "job" | "business" | "offer";

export type NewItem = {
  id: string;
  kind: NewKind;
  title: string;
  /** One short line: where / who / until when. */
  meta: string;
  href: string;
  image?: string | null;
  /** The real publication instant (ISO). */
  publishedAt: string | null;
  /** When it stops being useful (event start, offer end, job close), ISO. null = no end. */
  usefulUntil?: string | null;
};

export const WINDOW_DAYS = 7;
export const MIN_TO_SHOW = 1;
export const MAX_SUPPORTING = 3;
const DAY = 86_400_000;

export function isFresh(it: NewItem, now: number): boolean {
  const p = it.publishedAt ? Date.parse(it.publishedAt) : NaN;
  if (!Number.isFinite(p) || p > now || now - p > WINDOW_DAYS * DAY) return false;
  if (it.usefulUntil) {
    const u = Date.parse(it.usefulUntil);
    if (Number.isFinite(u) && u < now) return false;
  }
  return true;
}

export type NewPlan = { featured: NewItem; supporting: NewItem[] } | null;

export function planNewThisWeek(items: readonly NewItem[], now: number, excludeIds: ReadonlySet<string> = new Set()): NewPlan {
  const pool = items
    .filter((i) => !excludeIds.has(i.id) && isFresh(i, now))
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!));
  const titles = new Set<string>();
  const unique = pool.filter((i) => { const k = `${i.kind}|${i.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`; if (titles.has(k)) return false; titles.add(k); return true; });
  pool.length = 0; pool.push(...unique);
  if (pool.length < MIN_TO_SHOW) return null;
  const featured = pool.find((i) => !!i.image) ?? pool[0];
  const rest = pool.filter((i) => i !== featured);
  const supporting: NewItem[] = [];
  const seen = new Set<NewKind>([featured.kind]);
  for (const i of rest) { if (supporting.length < MAX_SUPPORTING && !seen.has(i.kind)) { supporting.push(i); seen.add(i.kind); } }
  for (const i of rest) { if (supporting.length < MAX_SUPPORTING && !supporting.includes(i)) supporting.push(i); }
  return { featured, supporting };
}

/** "Today", "Yesterday", or the weekday ("Mon"), in Shetland time. Never a date older than the window. */
export function publishedLabel(iso: string, now: number): string {
  const tz = "Europe/London";
  const day = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(t);
  const d = Date.parse(iso);
  if (day(d) === day(now)) return "Today";
  if (day(d) === day(now - DAY)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(d);
}

/** `color` fills tags and the foot bar; `ink` is the AA-contrast version for small text on white. */
export const KIND_META: Record<NewKind, { label: string; color: string; ink: string; verb: string }> = {
  event: { label: "Event", color: "#d4921a", ink: "#8a5a0b", verb: "Published" },
  activity: { label: "Activity", color: "#0f766e", ink: "#0f6b64", verb: "Added" },
  job: { label: "Job", color: "#2a8b5c", ink: "#1f6f47", verb: "Listed" },
  business: { label: "Business", color: "#7c3aed", ink: "#6d28d9", verb: "Joined" },
  offer: { label: "Offer", color: "#d97706", ink: "#a8480a", verb: "Started" },
};
