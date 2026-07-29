import type { MetadataRoute } from "next";
import { publicClient } from "@/lib/supabase/public";

const BASE = "https://oneshetland.com";

/** Rebuild the sitemap at most once a day. */
export const revalidate = 86400;

const STATIC: { path: string; freq: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "", freq: "daily", priority: 1 },
  { path: "/whats-on", freq: "daily", priority: 0.9 },
  { path: "/local", freq: "daily", priority: 0.9 },
  { path: "/loyalty", freq: "weekly", priority: 0.8 },
  { path: "/directory", freq: "daily", priority: 0.8 },
  { path: "/cruise", freq: "daily", priority: 0.8 },
  { path: "/boats", freq: "weekly", priority: 0.7 },
  { path: "/spik", freq: "weekly", priority: 0.7 },
  { path: "/memories", freq: "weekly", priority: 0.7 },
  { path: "/hubs", freq: "weekly", priority: 0.7 },
  { path: "/jobs", freq: "daily", priority: 0.7 },
  { path: "/games", freq: "weekly", priority: 0.6 },
  { path: "/almanac", freq: "daily", priority: 0.8 },
  { path: "/business", freq: "monthly", priority: 0.6 },
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
    rows("events", "id"),
    rows("spik_dictionary", "id, slug"),
    rows("vessels", "id"),
    rows("hubs", "id"),
    rows("content_articles", "slug, status, publish_at"),
  ]);

  for (const b of biz) {
    if (b.is_active === false) continue;
    out.push({ url: `${BASE}/directory/${(b.slug as string) || b.id}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const e of events) out.push({ url: `${BASE}/whats-on/${e.id}`, lastModified: now, changeFrequency: "daily", priority: 0.6 });
  for (const w of words) out.push({ url: `${BASE}/spik/${w.slug || w.id}`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
  for (const v of boats) out.push({ url: `${BASE}/boats/${v.id}`, lastModified: now, changeFrequency: "monthly", priority: 0.5 });
  for (const h of hubs) out.push({ url: `${BASE}/hubs/${h.id}`, lastModified: now, changeFrequency: "weekly", priority: 0.5 });
  for (const a of articles) {
    const live = (a.status === "published" || a.status === "scheduled") && a.publish_at && new Date(a.publish_at as string) <= now;
    if (live && a.slug) out.push({ url: `${BASE}/almanac/${a.slug}`, lastModified: new Date(a.publish_at as string), changeFrequency: "monthly", priority: 0.7 });
  }

  return out;
}
