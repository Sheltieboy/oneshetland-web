import { publicClient } from "@/lib/supabase/public";
import { getActiveOffers, type Offer } from "@/lib/local-data";

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

export type VisitingCruiseDay = {
  visit_date: string;
  ships_count: number;
  total_est_pax: number;
  lead_image: string | null;
  lead_ship: string | null;
};

/**
 * The next few cruise days — useful both to visitors arriving by ship and to
 * independent travellers who'd rather dodge a 4,000-passenger day. Carries the
 * day's lead ship photo, because six identical text tiles is a dull way to
 * show something as photogenic as a liner in Lerwick.
 */
async function fetchCruiseDays(): Promise<VisitingCruiseDay[]> {
  const sb = publicClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from("cruise_day_summary")
    .select("visit_date, ships_count, total_est_pax")
    .gte("visit_date", today)
    .order("visit_date", { ascending: true })
    .limit(6);

  const days = (data ?? []) as { visit_date: string; ships_count: number; total_est_pax: number }[];
  if (days.length === 0) return [];

  // One batched lookup for the photos: the biggest ship of each day that has one.
  const { data: visits } = await sb
    .from("cruise_visits")
    .select("visit_date, est_pax, ship:cruise_ships(name, image_url)")
    .in("visit_date", days.map((d) => d.visit_date))
    .neq("status", "cancelled");

  const lead: Record<string, { pax: number; img: string; name: string | null }> = {};
  for (const v of (visits ?? []) as Record<string, unknown>[]) {
    const ship = (Array.isArray(v.ship) ? v.ship[0] : v.ship) as { name?: string; image_url?: string } | null;
    if (!ship?.image_url) continue;
    const date = v.visit_date as string;
    const pax = (v.est_pax as number) ?? 0;
    if (!lead[date] || pax > lead[date].pax) {
      lead[date] = { pax, img: ship.image_url, name: ship.name ?? null };
    }
  }

  return days.map((d) => ({
    ...d,
    lead_image: lead[d.visit_date]?.img ?? null,
    lead_ship: lead[d.visit_date]?.name ?? null,
  }));
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
  const [places, makes, cruiseDays, words, offers] = await Promise.all([
    safe(fetchPlaces(), []),
    safe(fetchMakes(), []),
    safe(fetchCruiseDays(), []),
    safe(fetchWords(), []),
    // Offers work for anyone standing in the shop — a visitor can use a
    // two-for-one the same as a local. Reuses the Local feed's fetcher so
    // there's one definition of "a live offer".
    safe(getActiveOffers(6), [] as Offer[]),
  ]);
  return { places, makes, cruiseDays, words, offers };
}
