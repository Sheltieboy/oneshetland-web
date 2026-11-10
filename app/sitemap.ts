import { isDemoMode } from "@/lib/editions/demo-mode";
import { itemSlug } from "@/lib/editions/session-url";
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
type SelectQuery = ReturnType<ReturnType<ReturnType<typeof publicClient>["from"]>["select"]>;
async function rowsFiltered(table: string, colSets: string[], build: (q: SelectQuery) => SelectQuery): Promise<Record<string, unknown>[]> {
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
  if (isDemoMode()) return [];
  const now = new Date();
  const out: MetadataRoute.Sitemap = STATIC.map((s) => ({
    url: `${BASE}${s.path}`,
    lastModified: now,
    changeFrequency: s.freq,
    priority: s.priority,
  }));

  const [biz, events, words, boats, hubs, articles, editions, organisers, editionSessions] = await Promise.all([
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
    // Editions: the public client only ever sees published, entitled, verified, non-test rows (RLS), and nothing while the feature is off.
    rowsFiltered("editions", ["id, slug, status, updated_at", "slug, status, updated_at", "slug, status"], (q) => q.eq("status", "published").eq("is_test", false)),
    rowsFiltered("edition_organisers", ["slug, status"], (q) => q.eq("status", "verified").eq("is_test", false)),
    // every programme session has its own page; the public client again only sees sessions of Editions that are public
    rowsFiltered("edition_sessions", ["id, edition_id, title, status, updated_at", "id, edition_id, title, status"], (q) => q.neq("status", "cancelled")),
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
  for (const e of editions) {
    if (e.slug) out.push({ url: `${BASE}/editions/${e.slug}`, lastModified: lastMod(e.updated_at, now), changeFrequency: "daily", priority: 0.7 });
  }
  const slugByEdition = new Map(editions.filter((e) => e.id && e.slug).map((e) => [e.id as string, e.slug as string]));
  for (const x of editionSessions) {
    const slug = slugByEdition.get(x.edition_id as string);
    if (slug && x.id && x.title) out.push({ url: `${BASE}/editions/${slug}/programme/${itemSlug(String(x.title), String(x.id))}`, lastModified: lastMod(x.updated_at, now), changeFrequency: "weekly", priority: 0.5 });
  }
  for (const o of organisers) {
    if (o.slug) out.push({ url: `${BASE}/organisers/${o.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.5 });
  }

  return out;
}
