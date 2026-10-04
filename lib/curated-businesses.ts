import { publicClient } from "./supabase/public";

/**
 * curated-businesses.ts — "Open for business": a short, genuine shelf of businesses.
 *
 * Home and Local both used to show whatever was newest. That put lighthouses and memorials (the directory
 * holds heritage points of interest under "Tourism") and unfinished records in front of the first-time visitor.
 * This picks a handful of real, trading businesses instead.
 *
 *   • COMMERCIAL categories only: food & drink, retail, services, accommodation. Tourism and "other" are points
 *     of interest and stay in the Directory, where somebody is looking for them.
 *   • Ranked, not "newest": a paying plan, a claimed listing, a verified listing, then how complete the listing
 *     is (logo, cover, a real description, phone, website). A listing somebody has put effort into outranks a bare
 *     import.
 *   • One card per trading name (the directory has the same business from several sources).
 *   • Test fixtures never reach this list: they are withheld from public reads by the database
 *     (discovery_fixtures, migration 20261104010000), so there is nothing to filter here.
 */

export const COMMERCIAL_CATEGORIES = ["food_drink", "retail", "services", "accommodation"] as const;

export type CuratedBusiness = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  slug: string | null;
  subscription_tier: string;
  is_claimed: boolean;
  is_verified: boolean;
  address: string | null;
};

export type CuratedRow = CuratedBusiness & {
  subscription_until: string | null;
  phone: string | null;
  website: string | null;
  created_at: string | null;
};

const COLS =
  "id, name, category, description, logo_url, cover_url, slug, subscription_tier, subscription_until, is_claimed, is_verified, address, phone, website, created_at";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Higher is better. Exported so the weighting is testable and visible. */
export function businessScore(b: CuratedRow, now: Date): number {
  const paid = (b.subscription_tier === "premium" || b.subscription_tier === "pro") &&
    (!b.subscription_until || new Date(b.subscription_until) > now);
  return (
    (paid ? (b.subscription_tier === "premium" ? 200 : 150) : 0) +   // a paying plan always sorts first (the paid ladder); effort decides the rest
    (b.is_claimed ? 40 : 0) +
    (b.is_verified ? 10 : 0) +
    (b.logo_url ? 30 : 0) +
    (b.cover_url ? 10 : 0) +
    ((b.description?.trim().length ?? 0) >= 40 ? 15 : 0) +
    (b.phone ? 5 : 0) +
    (b.website ? 5 : 0)
  );
}

/** Pure: filter to commercial listings, rank, drop repeated names, take `limit`. */
export function rankBusinesses(rows: CuratedRow[], now: Date, limit: number): CuratedBusiness[] {
  const scored = rows
    .filter((b) => b.name?.trim() && (COMMERCIAL_CATEGORIES as readonly string[]).includes(b.category ?? ""))
    .map((b) => ({ b, s: businessScore(b, now) }))
    .sort((x, y) => y.s - x.s || (y.b.created_at ?? "").localeCompare(x.b.created_at ?? ""));
  const seen = new Set<string>();
  const unique: CuratedBusiness[] = [];
  for (const { b } of scored) {
    const key = norm(b.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push({
      id: b.id, name: b.name, category: b.category, description: b.description, logo_url: b.logo_url,
      cover_url: b.cover_url, slug: b.slug, subscription_tier: b.subscription_tier, is_claimed: b.is_claimed,
      is_verified: b.is_verified, address: b.address,
    });
  }
  // A shelf of eight banks and solicitors is not "open for business". Take the best of each kind first (at most
  // ceil(limit / 2) of any one category), then top up from whatever is left, still best first.
  const cap = Math.max(1, Math.ceil(limit / 2));
  const perCategory = new Map<string, number>();
  const out: CuratedBusiness[] = [];
  for (const b of unique) {
    const c = b.category ?? "";
    if ((perCategory.get(c) ?? 0) >= cap) continue;
    perCategory.set(c, (perCategory.get(c) ?? 0) + 1);
    out.push(b);
    if (out.length >= limit) return out;
  }
  for (const b of unique) {
    if (out.length >= limit) break;
    if (!out.includes(b)) out.push(b);
  }
  return out;
}

/** `areaLabel`, when given, narrows to businesses whose address names that area (the same rule the Directory uses). */
export async function getCuratedBusinesses(opts: { limit?: number; areaLabel?: string } = {}): Promise<CuratedBusiness[]> {
  const limit = opts.limit ?? 8;
  try {
    let q = publicClient()
      .from("local_businesses")
      .select(COLS)
      .eq("is_active", true)
      .in("category", [...COMMERCIAL_CATEGORIES])
      .limit(300);
    if (opts.areaLabel) q = q.ilike("address", `%${opts.areaLabel}%`);
    const { data } = await q;
    return rankBusinesses((data ?? []) as CuratedRow[], new Date(), limit);
  } catch {
    return [];
  }
}

/** How many products are genuinely on sale. Test fixtures are withheld by the database, so this is the public count. */
export async function countShopProducts(): Promise<number> {
  try {
    const { count } = await publicClient()
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("sold_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}
