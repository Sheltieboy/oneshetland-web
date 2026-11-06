import type { MetadataRoute } from "next";
import { publicClient } from "@/lib/supabase/public";
import { eventIsListable, activityIsListable } from "@/lib/whats-on-seo";

const BASE = "https://oneshetland.com";

/** Rebuild the sitemap at most once a day. */
export const revalidate = 86400;

const STATIC: { path: string; freq: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "", freq: "daily", priority: 1 },
  { path: "/whats-on", freq: "daily", priority: 0.9 },
  { path: "/whats-on/regular", freq: "daily", priority: 0.7 },
  { path: "/local", freq: "daily", priority: 0.9 },
  // The two pages people reach by search rather than by knowing us: someone
  // googling "Shetland knitwear" or "things to do in Shetland".
  { path: "/shop", freq: "daily", priority: 0.9 },
  { path: "/visiting", freq: "weekly", priority: 0.9 },
  { path: "/visiting/plan", freq: "weekly", priority: 0.8 },
  { path: "/loyalty", freq: "weekly", priority: 0.8 },
  { path: "/directory", freq: "daily", priority: 0.8 },
  { path: "/accessible", freq: "weekly", priority: 0.7 },
  { path: "/cruise", freq: "daily", priority: 0.8 },
  { path: "/boats", freq: "weekly", priority: 0.7 },
  { path: "/spik", freq: "weekly", priority: 0.7 },
  { path: "/memories", freq: "weekly", priority: 0.7 },
  { path: "/hubs", freq: "weekly", priority: 0.7 },
  { path: "/jobs", freq: "daily", priority: 0.7 },
  { path: "/notices", freq: "daily", priority: 0.7 },
  { path: "/games", freq: "weekly", priority: 0.6 },
  { path: "/almanac", freq: "daily", priority: 0.8 },
  { path: "/business", freq: "monthly", priority: 0.6 },
  { path: "/support", freq: "monthly", priority: 0.4 },
  { path: "/terms", freq: "yearly", priority: 0.2 },
  { path: "/privacy", freq: "yearly", priority: 0.2 },
  { path: "/community-guidelines", freq: "yearly", priority: 0.2 },
];

/** Pull a table's rows, tolerating a missing table/column without failing the build. */
async function rows(table: string, cols: string): Promise<Record<string, unknown>[]> {
  try {
    const { data } = await publicClient().from(table).select(cols).limit(5000);
    return (data ?? []) as unknown as Record<string, unknown>[];
  } catch {
    return [];
  }
}

/** Read rows with a filter, trying the preferred columns first and falling back if one is missing (never fails the build). */
async function rowsFiltered(table: string, colSets: string[], build: (q: any) => any): Promise<Record<string, unknown>[]> {
  for (const cols of colSets) {
    try {
      const { data, error } = await build(publicClient().from(table).select(cols)).limit(5000);
      if (!error) return (data ?? []) as unknown as Record<string, unknown>[];
    } catch {
      /* try the next column set */
    }
  }
  return [];
}

const lastMod = (v: unknown, fallback: Date): Date => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && Number.isFinite(d.getTime()) ? d : fallback;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const out: MetadataRoute.Sitemap = STATIC.map((s) => ({
    url: `${BASE}${s.path}`,
    lastModified: now,
    changeFrequency: s.freq,
    priority: s.priority,
  }));

  const [biz, events, words, boats, hubs, articles] = await Promise.all([
    rows("local_businesses", "id, slug, is_active"),
    rowsFiltered(
      "events",
      ["id, status, is_hidden, organiser_hub_id, calendar_approved, updated_at", "id, status, is_hidden, organiser_hub_id, calendar_approved"],
      (q) => q.eq("status", "published").or("organiser_hub_id.is.null,calendar_approved.eq.true"),
    ),
    rows("spik_dictionary", "id, slug"),
    rows("vessels", "id"),
    rows("hubs", "id"),
    rows("content_articles", "slug, status, publish_at"),
  ]);

  for (const b of biz) {
    if (b.is_active === false) continue;
    out.push({ url: `${BASE}/directory/${(b.slug as string) || b.id}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const e of events) {
    if (!eventIsListable(e as { id: string })) continue;
    out.push({ url: `${BASE}/whats-on/${e.id}`, lastModified: lastMod(e.updated_at, now), changeFrequency: "daily", priority: 0.6 });
  }
  // Regular activities: the activity_is_public rule, applied explicitly (published, not paused, owner live), on top of RLS.
  const [acts, hubsLive, bizLive] = await Promise.all([
    rowsFiltered(
      "regular_activities",
      ["slug, status, admin_paused, calendar_approved, organiser_hub_id, organiser_business_id, is_platform_activity, updated_at", "slug, status, admin_paused, calendar_approved, organiser_hub_id, organiser_business_id, is_platform_activity"],
      (q) => q.eq("status", "published").eq("admin_paused", false),
    ),
    rowsFiltered("hubs", ["id, is_active"], (q) => q.eq("is_active", true)),
    rowsFiltered("local_businesses", ["id, is_active"], (q) => q.eq("is_active", true)),
  ]);
  const activeHubs = new Set(hubsLive.map((h) => String(h.id))), activeBiz = new Set(bizLive.map((b) => String(b.id)));
  for (const a of acts) {
    if (!activityIsListable(a, activeHubs, activeBiz)) continue;
    out.push({ url: `${BASE}/whats-on/regular/${a.slug}`, lastModified: lastMod(a.updated_at, now), changeFrequency: "weekly", priority: 0.5 });
  }
  for (const w of words) out.push({ url: `${BASE}/spik/${w.slug || w.id}`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
  for (const v of boats) out.push({ url: `${BASE}/boats/${v.id}`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
  for (const h of hubs) out.push({ url: `${BASE}/hubs/${h.id}`, lastModified: now, changeFrequency: "weekly", priority: 0.5 });
  for (const a of articles) {
    const live = (a.status === "published" || a.status === "scheduled") && a.publish_at && new Date(a.publish_at as string) <= now;
    if (live && a.slug) out.push({ url: `${BASE}/almanac/${a.slug}`, lastModified: new Date(a.publish_at as string), changeFrequency: "monthly", priority: 0.7 });
  }

  return out;
}
