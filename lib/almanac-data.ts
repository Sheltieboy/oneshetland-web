import { publicClient } from "@/lib/supabase/public";

/** The Shetland Almanac — public reads. RLS only ever returns live articles
 *  (published/scheduled AND publish_at <= now), so callers can't leak drafts. */

export type Pillar = "dialect" | "events" | "cruise" | "boats" | "local" | "island" | "jobs";

export const PILLARS: { key: Pillar; label: string; color: string; sectionHref: string }[] = [
  { key: "dialect", label: "Dialect", color: "#12b3d6", sectionHref: "/spik" },
  { key: "events", label: "What's On", color: "#d4921a", sectionHref: "/whats-on" },
  { key: "cruise", label: "Cruise", color: "#0e6e8c", sectionHref: "/cruise" },
  { key: "boats", label: "Da Boats", color: "#1e3a8a", sectionHref: "/boats" },
  { key: "local", label: "Local", color: "#7c3aed", sectionHref: "/local" },
  { key: "island", label: "Island life", color: "#2a8b5c", sectionHref: "/" },
  { key: "jobs", label: "Work", color: "#2a8b5c", sectionHref: "/jobs" },
];
export const pillarMeta = (p: string) => PILLARS.find((x) => x.key === p) ?? PILLARS[5];

export interface LinkedEntity { type: "business" | "word" | "event" | "vessel" | "hub"; id: string; label?: string }

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  hero_url: string | null;
  pillar: Pillar;
  status: string;
  publish_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  linked_entities: LinkedEntity[];
  author: string;
  created_at: string;
  updated_at: string;
}

export type ArticleCard = Pick<Article, "id" | "slug" | "title" | "excerpt" | "hero_url" | "pillar" | "publish_at">;

const CARD_COLS = "id, slug, title, excerpt, hero_url, pillar, publish_at";

export async function fetchLiveArticles(opts: { pillar?: Pillar; limit?: number } = {}): Promise<ArticleCard[]> {
  try {
    let q = publicClient().from("content_articles").select(CARD_COLS).order("publish_at", { ascending: false });
    if (opts.pillar) q = q.eq("pillar", opts.pillar);
    if (opts.limit) q = q.limit(opts.limit);
    const { data } = await q;
    return (data ?? []) as ArticleCard[];
  } catch {
    return [];
  }
}

export async function fetchArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const { data } = await publicClient().from("content_articles").select("*").eq("slug", slug).maybeSingle();
    return (data as Article) ?? null;
  } catch {
    return null;
  }
}

export async function fetchRelatedArticles(pillar: string, excludeId: string, limit = 3): Promise<ArticleCard[]> {
  try {
    const { data } = await publicClient()
      .from("content_articles")
      .select(CARD_COLS)
      .eq("pillar", pillar)
      .neq("id", excludeId)
      .order("publish_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as ArticleCard[];
  } catch {
    return [];
  }
}

export function articleDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
