import { publicClient } from "@/lib/supabase/public";

/**
 * Data for /visiting — the page someone reads BEFORE they travel, usually
 * having found it by googling "things to do in Shetland".
 *
 * Paid placement here reuses the ladder the homepage shelves already use
 * (premium above pro above free), so nothing new has to be priced: a business
 * that already pays for Premium is simply also seen by visitors. Within a
 * tier, ordering is by recency so the shelf keeps moving.
 */

const TIER_RANK: Record<string, number> = { premium: 2, pro: 1, free: 0 };

export type VisitingBusiness = {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  subscription_tier: string;
};

export type VisitingProduct = {
  id: string;
  title: string;
  price_pence: number;
  photo: string | null;
  business_name: string;
};

const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try { return await p; } catch { return fallback; }
};

/**
 * Places worth a visitor's time. Tourism, food & drink and retail only —
 * a plumber is no use to somebody here for four days.
 */
async function fetchPlaces(): Promise<VisitingBusiness[]> {
  const sb = publicClient();
  const { data } = await sb
    .from("local_businesses")
    .select("id, name, slug, category, description, logo_url, cover_url, subscription_tier")
    .eq("is_active", true)
    .in("category", ["tourism", "food_drink", "retail", "accommodation"])
    .order("created_at", { ascending: false })
    .limit(60);

  return ((data ?? []) as VisitingBusiness[])
    .sort((a, b) => (TIER_RANK[b.subscription_tier] ?? 0) - (TIER_RANK[a.subscription_tier] ?? 0))
    .slice(0, 12);
}

/** Things they can buy and take home — or have posted. */
async function fetchMakes(): Promise<VisitingProduct[]> {
  const sb = publicClient();
  const { data } = await sb
    .from("products")
    .select("id, title, price_pence, photos, business:local_businesses!inner(name, is_active)")
    .eq("is_active", true)
    .is("sold_at", null)
    .eq("business.is_active", true)
    .order("created_at", { ascending: false })
    .limit(12);

  return ((data ?? []) as Record<string, unknown>[]).map((p) => {
    const biz = (Array.isArray(p.business) ? p.business[0] : p.business) as { name?: string } | null;
    return {
      id: p.id as string,
      title: p.title as string,
      price_pence: p.price_pence as number,
      photo: (p.photos as string[])?.[0] ?? null,
      business_name: biz?.name ?? "A Shetland shop",
    };
  });
}

/** The next few cruise days — useful both to visitors arriving by ship and
 *  to independent travellers who'd rather dodge a 4,000-passenger day. */
async function fetchCruiseDays(): Promise<{ visit_date: string; ships_count: number; total_est_pax: number }[]> {
  const sb = publicClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from("cruise_day_summary")
    .select("visit_date, ships_count, total_est_pax")
    .gte("visit_date", today)
    .order("visit_date", { ascending: true })
    .limit(6);
  return (data ?? []) as { visit_date: string; ships_count: number; total_est_pax: number }[];
}

/** A few dialect words — the thing visitors reliably find delightful. */
async function fetchWords(): Promise<{ word: string; short_meaning: string | null }[]> {
  const sb = publicClient();
  const { data } = await sb
    .from("spik_dictionary")
    .select("word, short_meaning")
    // Most publicly-visible words carry a NULL status — RLS is what limits
    // anon to the public set, so filtering on status alone returns nothing.
    // Same predicate the homepage spik shelf uses.
    .or("word_status.is.null,word_status.in.(approved,published)")
    .not("short_meaning", "is", null)
    .limit(8);
  return (data ?? []) as { word: string; short_meaning: string | null }[];
}

export async function getVisitingData() {
  const [places, makes, cruiseDays, words] = await Promise.all([
    safe(fetchPlaces(), []),
    safe(fetchMakes(), []),
    safe(fetchCruiseDays(), []),
    safe(fetchWords(), []),
  ]);
  return { places, makes, cruiseDays, words };
}
