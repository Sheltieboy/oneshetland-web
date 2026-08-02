import { publicClient } from "./supabase/public";
import { getRecentMemories } from "./memories-data";

/**
 * home-shelves.ts — data for the homepage's shelf bands (Featured this week,
 * Offers & rewards, Eat/drink/shop rails, Island life, Hiring now).
 *
 * The paid ladder lives here: premium businesses fill the Featured shelf,
 * pro+ sort first in the rails. When nobody is paying yet, shelves fall back
 * to fresh real content ("New on OneShetland") so nothing renders empty —
 * and flip to paid automatically as subscriptions arrive.
 */

const TIER_RANK: Record<string, number> = { premium: 2, pro: 1, free: 0 };

export type ShelfBusiness = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  slug: string | null;
  subscription_tier: string;
  is_claimed: boolean;
};

export type ShelfJob = {
  id: string;
  title: string;
  where: string | null;
  pay_text: string | null;
  contract_type: string | null;
  employer: string | null;
  logo_url: string | null;
};

export type ShelfBoat = {
  vessel_id: string;
  name: string;
  built_year: number | null;
  image_url: string;
} | null;

export type ShelfStory = {
  id: string;
  title: string | null;
  place_name: string | null;
  era: string | null;
  hero_url: string;
} | null;

export type ShelfSpik = { word: string; meaning: string; example: string | null } | null;

export type ShelfProduct = {
  id: string;
  title: string;
  price_pence: number;
  photo: string | null;
  business_name: string;
};

export type HomeShelves = {
  featured: ShelfBusiness[]; // 3+ → shelf renders; premium first, fallback fresh
  anyPaid: boolean;          // true once a premium/pro business is in the shelf
  eatDrink: ShelfBusiness[];
  shops: ShelfBusiness[];
  freshProducts: ShelfProduct[];
  hiring: ShelfJob[];
  boat: ShelfBoat;
  story: ShelfStory;
  spik: ShelfSpik;
};

type SB = ReturnType<typeof publicClient>;
const BIZ_COLS = "id, name, category, description, logo_url, cover_url, slug, subscription_tier, is_claimed";

const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try { return await p; } catch { return fallback; }
};

const byTier = (a: ShelfBusiness, b: ShelfBusiness) =>
  (TIER_RANK[b.subscription_tier] ?? 0) - (TIER_RANK[a.subscription_tier] ?? 0);

export async function getHomeShelves(): Promise<HomeShelves> {
  const sb = publicClient();
  const [featured, eatDrink, shops, freshProducts, hiring, boat, story, spik] = await Promise.all([
    safe(fetchFeatured(sb), []),
    safe(fetchRail(sb, ["food_drink"]), []),
    safe(fetchRail(sb, ["retail", "services"]), []),
    safe(fetchFreshProducts(sb), []),
    safe(fetchHiring(sb), []),
    safe(fetchBoat(sb), null),
    safe(fetchStory(), null),
    safe(fetchSpik(sb), null),
  ]);
  return {
    featured,
    anyPaid: featured.some((b) => TIER_RANK[b.subscription_tier] > 0),
    eatDrink,
    shops,
    freshProducts,
    hiring,
    boat,
    story,
    spik,
  };
}

/** Premium (paying) businesses first; topped up with fresh claimed/logo'd ones. */
async function fetchFeatured(sb: SB): Promise<ShelfBusiness[]> {
  const now = new Date().toISOString();
  const { data: paid } = await sb
    .from("local_businesses")
    .select(BIZ_COLS)
    .eq("is_active", true)
    .in("subscription_tier", ["premium", "pro"])
    .or(`subscription_until.is.null,subscription_until.gt.${now}`)
    .limit(6);
  const out = ((paid ?? []) as ShelfBusiness[]).sort(byTier);

  if (out.length < 3) {
    // Fallback: newest claimed businesses, then newest with a logo — real,
    // fresh content so the shelf never renders empty pre-monetisation.
    const have = new Set(out.map((b) => b.id));
    const names = new Set(out.map((b) => b.name.toLowerCase().trim()));
    const { data: fresh } = await sb
      .from("local_businesses")
      .select(BIZ_COLS)
      .eq("is_active", true)
      .not("logo_url", "is", null)
      .order("is_claimed", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12);
    for (const b of (fresh ?? []) as ShelfBusiness[]) {
      if (out.length >= 3) break;
      const key = b.name.toLowerCase().trim();
      // Same trading name twice on one shelf looks broken (dupes exist across
      // directory sources) — one card per name.
      if (!have.has(b.id) && !names.has(key)) { out.push(b); have.add(b.id); names.add(key); }
    }
  }
  return out.slice(0, 3);
}

async function fetchRail(sb: SB, categories: string[]): Promise<ShelfBusiness[]> {
  const { data } = await sb
    .from("local_businesses")
    .select(BIZ_COLS)
    .eq("is_active", true)
    .in("category", categories)
    .not("logo_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(24);
  // Paid tiers sort to the front of the rail — the visible "Pro sorts first".
  return ((data ?? []) as ShelfBusiness[]).sort(byTier).slice(0, 10);
}

/** Newest products across every shop — the Shop Shetland discovery rail. */
async function fetchFreshProducts(sb: SB): Promise<ShelfProduct[]> {
  const { data } = await sb
    .from("products")
    .select("id, title, price_pence, photos, business:local_businesses(name, is_active)")
    .eq("is_active", true)
    .is("sold_at", null)
    .order("created_at", { ascending: false })
    .limit(16);
  const out: ShelfProduct[] = [];
  for (const p of (data ?? []) as Record<string, unknown>[]) {
    const biz = (Array.isArray(p.business) ? (p.business as Record<string, unknown>[])[0] : p.business) as { name?: string; is_active?: boolean } | null;
    if (!biz?.is_active || !biz.name) continue;
    const photo = (p.photos as string[])?.[0] ?? null;
    if (!photo) continue;
    out.push({ id: p.id as string, title: p.title as string, price_pence: p.price_pence as number, photo, business_name: biz.name });
    if (out.length >= 10) break;
  }
  return out;
}

async function fetchHiring(sb: SB): Promise<ShelfJob[]> {
  const now = new Date().toISOString();
  const { data } = await sb
    .from("jobs")
    .select("id, title, locality, location, pay_text, contract_type, external_employer_name, external_employer_logo_url, biz:local_businesses!posted_as_business_id(name, logo_url)")
    .eq("status", "open")
    .eq("is_hidden", false)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("is_featured", { ascending: false })
    .order("posted_at", { ascending: false })
    .limit(4);
  return ((data ?? []) as Record<string, unknown>[]).map((j) => {
    const biz = (Array.isArray(j.biz) ? (j.biz as Record<string, unknown>[])[0] : j.biz) as { name?: string; logo_url?: string } | null;
    return {
      id: j.id as string,
      title: j.title as string,
      where: (j.locality ?? j.location ?? null) as string | null,
      pay_text: (j.pay_text as string) ?? null,
      contract_type: (j.contract_type as string) ?? null,
      employer: biz?.name ?? (j.external_employer_name as string) ?? null,
      logo_url: biz?.logo_url ?? (j.external_employer_logo_url as string) ?? null,
    };
  });
}

async function fetchBoat(sb: SB): Promise<ShelfBoat> {
  // !inner + not-null filter: many media rows are photo *references* with no
  // actual image — only real photos qualify for the card.
  const { data } = await sb
    .from("vessel_media_links")
    .select("vessel_id, media:media_assets!inner(image_url, thumbnail_url, asset_type), vessel:vessels(canonical_name, built_year)")
    .not("media.image_url", "is", null)
    .limit(16);
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const media = (Array.isArray(r.media) ? (r.media as Record<string, unknown>[])[0] : r.media) as { image_url?: string; thumbnail_url?: string } | null;
    const vessel = (Array.isArray(r.vessel) ? (r.vessel as Record<string, unknown>[])[0] : r.vessel) as { canonical_name?: string; built_year?: number } | null;
    const img = media?.image_url ?? media?.thumbnail_url;
    if (img && vessel?.canonical_name) {
      return { vessel_id: r.vessel_id as string, name: vessel.canonical_name, built_year: vessel.built_year ?? null, image_url: img };
    }
  }
  return null;
}

/** Word of the day, picked deterministically per London day. (The spik_daily
 *  RPC referenced by older code never existed in the DB — this replaces it.) */
async function fetchSpik(sb: SB): Promise<ShelfSpik> {
  const { data } = await sb
    .from("spik_dictionary")
    .select("word, short_meaning, example_sentence")
    .not("short_meaning", "is", null)
    .not("example_sentence", "is", null)
    .or("word_status.is.null,word_status.in.(approved,published)")
    .order("id", { ascending: true })
    .limit(400);
  const pool = (data ?? []) as { word: string; short_meaning: string; example_sentence: string | null }[];
  if (!pool.length) return null;
  const day = Math.floor(Date.now() / 86400_000);
  const w = pool[day % pool.length];
  return { word: w.word, meaning: w.short_meaning, example: w.example_sentence };
}

async function fetchStory(): Promise<ShelfStory> {
  const pins = await getRecentMemories(8);
  const withPhoto = pins.find((p) => p.hero_url && p.hero_kind !== "video");
  if (!withPhoto?.hero_url) return null;
  return {
    id: withPhoto.id,
    title: withPhoto.title,
    place_name: withPhoto.place_name,
    era: withPhoto.era,
    hero_url: withPhoto.hero_url,
  };
}
