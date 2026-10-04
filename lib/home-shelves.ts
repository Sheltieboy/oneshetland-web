import { publicClient } from "./supabase/public";
import { getRecentMemories } from "./memories-data";

/**
 * home-shelves.ts — data for the homepage's remaining shelves: new products, open jobs, and the island-life
 * cards (a boat, a memory, the Spik word). Businesses are curated separately (lib/curated-businesses.ts).
 * Every shelf is optional: an empty one is simply not rendered.
 */

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
  freshProducts: ShelfProduct[];
  hiring: ShelfJob[];
  boat: ShelfBoat;
  story: ShelfStory;
  spik: ShelfSpik;
};

type SB = ReturnType<typeof publicClient>;

const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try { return await p; } catch { return fallback; }
};

export async function getHomeShelves(): Promise<HomeShelves> {
  const sb = publicClient();
  const [freshProducts, hiring, boat, story, spik] = await Promise.all([
    safe(fetchFreshProducts(sb), []),
    safe(fetchHiring(sb), []),
    safe(fetchBoat(sb), null),
    safe(fetchStory(), null),
    safe(fetchSpik(sb), null),
  ]);
  return { freshProducts, hiring, boat, story, spik };
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
