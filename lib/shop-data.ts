import { publicClient } from "./supabase/public";

/**
 * shop-data.ts — Shop Shetland types + public reads (browse/product/rate card)
 * shared by the business shop tab, product pages and checkout.
 */

export type StockMode = "tracked" | "made_to_order" | "one_off";

export type Product = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  category: string | null;
  price_pence: number;
  compare_at_pence: number | null;
  photos: string[];
  stock_mode: StockMode;
  stock: number | null;
  reserved: number;
  lead_time_days: number | null;
  collect_only: boolean;
  free_uk_post: boolean;
  is_active: boolean;
  sold_at: string | null;
  created_at: string;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  price_delta_pence: number;
  stock: number | null;
  reserved: number;
  position: number;
  is_active: boolean;
};

export type BusinessShipping = {
  business_id: string;
  collect_enabled: boolean;
  collect_note: string | null;
  post_enabled: boolean;
  post_shetland_pence: number | null;
  post_uk_pence: number | null;
  post_per_extra_item_pence: number;
  free_over_pence: number | null;
  fetch_enabled: boolean;
  vat_registered: boolean;
};

export const PRODUCT_CATEGORIES: { value: string; label: string }[] = [
  { value: "knitwear", label: "Knitwear" },
  { value: "craft", label: "Craft" },
  { value: "art", label: "Art & prints" },
  { value: "food_drink", label: "Food & drink" },
  { value: "home", label: "Home" },
  { value: "beauty", label: "Health & beauty" },
  { value: "outdoor", label: "Outdoor" },
  { value: "books_music", label: "Books & music" },
  { value: "other", label: "Other" },
];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment",
  paid: "New order",
  accepted: "Accepted",
  ready: "Ready to collect",
  handed_over: "Handed over",
  posted: "Posted",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  expired: "Expired",
};

export const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/** Sellable right now? (stock modes are honest: made-to-order is always buyable) */
export function availableQty(p: Product, v?: ProductVariant | null): number {
  if (!p.is_active || p.sold_at) return 0;
  if (p.stock_mode === "made_to_order") return 99;
  if (p.stock_mode === "one_off") return p.reserved > 0 ? 0 : 1;
  if (v && v.stock != null) return Math.max(0, v.stock - v.reserved);
  if (p.stock == null) return 99;
  return Math.max(0, p.stock - p.reserved);
}

export function shippingQuote(
  ship: BusinessShipping | null,
  itemsPence: number,
  totalQty: number,
  postcode: string,
  allFreeUkPost: boolean,
): number | null {
  if (!ship?.post_enabled) return null;
  if (allFreeUkPost) return 0;
  const isShetland = postcode.trim().toUpperCase().startsWith("ZE");
  const base = isShetland ? (ship.post_shetland_pence ?? ship.post_uk_pence ?? 0) : (ship.post_uk_pence ?? 0);
  let quote = base + (ship.post_per_extra_item_pence ?? 0) * Math.max(0, totalQty - 1);
  if (ship.free_over_pence && itemsPence >= ship.free_over_pence) quote = 0;
  return quote;
}

/* ── Public reads ─────────────────────────────────────────────────────────── */

export type ProductThumbs = { photos: string[]; count: number };

/**
 * One batched query: product thumbnails for a set of businesses (up to 3
 * photos + total count each). Powers the peerie product strips on business
 * cards across Directory, Local and the homepage rails.
 */
export async function getProductThumbs(businessIds: string[]): Promise<Record<string, ProductThumbs>> {
  const out: Record<string, ProductThumbs> = {};
  if (!businessIds.length) return out;
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("products")
      .select("business_id, photos")
      .in("business_id", [...new Set(businessIds)])
      .eq("is_active", true)
      .is("sold_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    for (const p of (data ?? []) as { business_id: string; photos: string[] }[]) {
      const photo = p.photos?.[0];
      const entry = (out[p.business_id] ??= { photos: [], count: 0 });
      entry.count += 1;
      if (photo && entry.photos.length < 3) entry.photos.push(photo);
    }
    // A strip with no images is just noise — require at least one photo.
    for (const k of Object.keys(out)) if (out[k].photos.length === 0) delete out[k];
  } catch { /* strips are decorative — never break a listing page */ }
  return out;
}

export type BrowseProduct = Product & { business_name: string; business_slug: string | null };
export type BrowseSort = "newest" | "price_low" | "price_high";

/**
 * Everything on sale across Shetland — the standalone /shop surface.
 *
 * Until now a product was only reachable through the shop that sells it, or
 * the homepage rail. That's fine if you know the maker and useless if you just
 * want to buy something Shetland.
 *
 * Sold one-offs and products from deactivated shops are excluded. `!inner`
 * makes the business join filterable server-side, so paging stays honest.
 */
export async function browseProducts(opts: {
  category?: string | null;
  query?: string;
  sort?: BrowseSort;
  limit?: number;
  offset?: number;
} = {}): Promise<BrowseProduct[]> {
  const { category = null, query = "", sort = "newest", limit = 24, offset = 0 } = opts;
  const sb = publicClient();
  try {
    let q = sb
      .from("products")
      .select("*, business:local_businesses!inner(name, slug, is_active)")
      .eq("is_active", true)
      .is("sold_at", null)
      .eq("business.is_active", true);

    if (category) q = q.eq("category", category);
    if (query.trim()) {
      // Commas and % are PostgREST filter syntax, so they can't reach `or()` raw.
      const safe = query.trim().replace(/[%,]/g, " ");
      q = q.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
    }

    if (sort === "price_low") q = q.order("price_pence", { ascending: true });
    else if (sort === "price_high") q = q.order("price_pence", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    const { data } = await q.range(offset, offset + limit - 1);
    return ((data ?? []) as Record<string, unknown>[]).map((p) => {
      const biz = (Array.isArray(p.business) ? p.business[0] : p.business) as
        { name?: string; slug?: string | null } | null;
      const { business: _drop, ...rest } = p;
      return {
        ...(rest as unknown as Product),
        business_name: biz?.name ?? "A Shetland shop",
        business_slug: biz?.slug ?? null,
      };
    });
  } catch { return []; }
}

export async function getShopProducts(businessId: string): Promise<Product[]> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(60);
    return (data ?? []) as Product[];
  } catch { return []; }
}

export async function getProduct(id: string): Promise<{ product: Product; variants: ProductVariant[]; shipping: BusinessShipping | null; business: { id: string; name: string; slug: string | null; logo_url: string | null } | null } | null> {
  const sb = publicClient();
  try {
    const { data: product } = await sb.from("products").select("*").eq("id", id).maybeSingle();
    if (!product) return null;
    const [{ data: variants }, { data: shipping }, { data: business }] = await Promise.all([
      sb.from("product_variants").select("*").eq("product_id", id).eq("is_active", true).order("position"),
      sb.from("business_shipping").select("*").eq("business_id", product.business_id).maybeSingle(),
      sb.from("local_businesses").select("id, name, slug, logo_url").eq("id", product.business_id).maybeSingle(),
    ]);
    return {
      product: product as Product,
      variants: (variants ?? []) as ProductVariant[],
      shipping: (shipping ?? null) as BusinessShipping | null,
      business: (business ?? null) as { id: string; name: string; slug: string | null; logo_url: string | null } | null,
    };
  } catch { return null; }
}

export async function getBusinessShipping(businessId: string): Promise<BusinessShipping | null> {
  const sb = publicClient();
  try {
    const { data } = await sb.from("business_shipping").select("*").eq("business_id", businessId).maybeSingle();
    return (data ?? null) as BusinessShipping | null;
  } catch { return null; }
}
