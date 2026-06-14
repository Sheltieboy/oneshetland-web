import { publicClient } from "./supabase/public";

export const CATEGORIES = [
  { key: "food_drink", label: "Food & Drink" },
  { key: "retail", label: "Retail" },
  { key: "services", label: "Services" },
  { key: "tourism", label: "Tourism" },
  { key: "accommodation", label: "Accommodation" },
  { key: "other", label: "Other" },
] as const;

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
);

export type OpeningHours = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string>
>;

export type Business = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  locality: string | null;
  logo_url: string | null;
  cover_url: string | null;
  brand_color: string | null;
  tags: string[] | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  opening_hours: OpeningHours | null;
  is_verified: boolean;
  accepts_wallet: boolean;
  cashback_percent: number;
  accepts_bookings: boolean;
  subscription_tier: string;
  slug: string | null;
  is_claimed: boolean;
};

export type Offer = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  discount_type: string | null;
  discount_value: number | null;
  valid_until: string;
  business?: { id: string; name: string; logo_url: string | null; category: string | null; slug: string | null } | null;
};

export type Loyalty = {
  type: string;
  stamps_required: number | null;
  stamp_reward: string | null;
  points_per_pound: number | null;
  points_for_pound: number | null;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_pence: number;
  category: string | null;
};

const LIST_COLS =
  "id, name, category, description, address, logo_url, cover_url, brand_color, is_verified, accepts_wallet, cashback_percent, accepts_bookings, subscription_tier, slug, is_claimed";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Landing ──────────────────────────────────────────────────────────────── */
export async function getFeaturedBusinesses(limit = 8): Promise<Business[]> {
  const sb = publicClient();
  const now = new Date().toISOString();
  try {
    const { data: subs } = await sb
      .from("local_businesses")
      .select(LIST_COLS)
      .eq("is_active", true)
      .in("subscription_tier", ["pro", "premium"])
      .or(`subscription_until.is.null,subscription_until.gt.${now}`)
      .order("subscription_tier", { ascending: false })
      .limit(limit);
    const out = (subs ?? []) as unknown as Business[];
    if (out.length >= limit) return out;

    const have = new Set(out.map((b) => b.id));
    const { data: rest } = await sb
      .from("local_businesses")
      .select(LIST_COLS)
      .eq("is_active", true)
      .order("is_verified", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit * 3);
    for (const b of (rest ?? []) as unknown as Business[]) {
      if (out.length >= limit) break;
      if (!have.has(b.id)) {
        out.push(b);
        have.add(b.id);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function getActiveOffers(limit = 6): Promise<Offer[]> {
  const sb = publicClient();
  const now = new Date().toISOString();
  try {
    const { data } = await sb
      .from("local_offers")
      .select("id, business_id, title, description, image_url, discount_type, discount_value, valid_until")
      .eq("is_active", true)
      .lte("valid_from", now)
      .gte("valid_until", now)
      .order("created_at", { ascending: false })
      .limit(limit);
    const offers = (data ?? []) as Offer[];
    if (offers.length === 0) return [];
    const ids = [...new Set(offers.map((o) => o.business_id))];
    const { data: biz } = await sb
      .from("local_businesses")
      .select("id, name, logo_url, category, slug")
      .in("id", ids);
    const map = Object.fromEntries((biz ?? []).map((b) => [b.id, b]));
    return offers.map((o) => ({ ...o, business: map[o.business_id] ?? null }));
  } catch {
    return [];
  }
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const sb = publicClient();
  try {
    const { data } = await sb.from("local_businesses").select("category").eq("is_active", true);
    const counts: Record<string, number> = {};
    for (const r of (data ?? []) as { category: string | null }[]) {
      if (r.category) counts[r.category] = (counts[r.category] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

/* ── Directory ────────────────────────────────────────────────────────────── */
export async function getAllBusinesses(opts: { category?: string; q?: string } = {}): Promise<Business[]> {
  const sb = publicClient();
  try {
    let q = sb
      .from("local_businesses")
      .select(LIST_COLS)
      .eq("is_active", true)
      .order("is_verified", { ascending: false })
      .order("name", { ascending: true })
      .limit(200);
    if (opts.category) q = q.eq("category", opts.category);
    if (opts.q) q = q.ilike("name", `%${opts.q}%`);
    const { data } = await q;
    return (data ?? []) as unknown as Business[];
  } catch {
    return [];
  }
}

/* ── Profile ──────────────────────────────────────────────────────────────── */
export async function getBusiness(idOrSlug: string): Promise<Business | null> {
  const sb = publicClient();
  try {
    const col = UUID.test(idOrSlug) ? "id" : "slug";
    const { data } = await sb
      .from("local_businesses")
      .select("*")
      .eq(col, idOrSlug)
      .eq("is_active", true)
      .maybeSingle();
    return (data ?? null) as Business | null;
  } catch {
    return null;
  }
}

export async function getBusinessExtras(
  businessId: string,
): Promise<{ offers: Offer[]; loyalty: Loyalty | null; services: Service[] }> {
  const sb = publicClient();
  const now = new Date().toISOString();
  const safe = async <T>(p: PromiseLike<T>, f: T): Promise<T> => {
    try {
      return await p;
    } catch {
      return f;
    }
  };

  const [offers, loyalty, services] = await Promise.all([
    safe(
      sb
        .from("local_offers")
        .select("id, business_id, title, description, image_url, discount_type, discount_value, valid_until")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .lte("valid_from", now)
        .gte("valid_until", now)
        .order("created_at", { ascending: false })
        .then((r) => (r.data ?? []) as Offer[]),
      [] as Offer[],
    ),
    safe(
      sb
        .from("local_loyalty_programs")
        .select("type, stamps_required, stamp_reward, points_per_pound, points_for_pound")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .maybeSingle()
        .then((r) => (r.data ?? null) as Loyalty | null),
      null,
    ),
    safe(
      sb
        .from("book_services")
        .select("id, name, description, duration_minutes, price_pence, category")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .then((r) => (r.data ?? []) as Service[]),
      [] as Service[],
    ),
  ]);

  return { offers, loyalty, services };
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
export function offerBadge(o: Pick<Offer, "discount_type" | "discount_value">): string {
  if (o.discount_type === "percent" && o.discount_value) return `${o.discount_value}% off`;
  if (o.discount_type === "amount" && o.discount_value) return `£${(o.discount_value / 100).toFixed(0)} off`;
  return "Offer";
}
export function money(pence: number): string {
  return pence <= 0 ? "On request" : `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
}
