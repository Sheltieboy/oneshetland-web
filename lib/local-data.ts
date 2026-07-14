import { publicClient } from "./supabase/public";

export const SHETLAND_AREAS = [
  { key: "lerwick",        label: "Lerwick" },
  { key: "scalloway",      label: "Scalloway" },
  { key: "brae",           label: "Brae" },
  { key: "northmavine",    label: "Northmavine" },
  { key: "south mainland", label: "South Mainland" },
  { key: "west mainland",  label: "West Mainland" },
  { key: "yell",           label: "Yell" },
  { key: "unst",           label: "Unst" },
  { key: "fetlar",         label: "Fetlar" },
  { key: "whalsay",        label: "Whalsay" },
  { key: "skerries",       label: "Skerries" },
] as const;

export type ShetlandArea = (typeof SHETLAND_AREAS)[number]["key"];

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
  owner_id?: string | null;
  category: string | null;
  description: string | null;
  address: string | null;
  /** `local_businesses` has no locality column — area lives inside `address`. */
  locality?: string | null;
  lat: number | null;
  lng: number | null;
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
  business_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  price_pence: number;
  deposit_pence: number;
  requires_deposit: boolean;
  capacity: number;
  category: string | null;
};

export type UnitItem = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price_pence: number;
  stock: number | null;          // null = unlimited
  valid_days: number | null;     // null = no expiry
  uses_per_purchase: number;
  image_url: string | null;
  category: string | null;
};

const LIST_COLS =
  "id, name, category, description, address, tags, logo_url, cover_url, brand_color, is_verified, accepts_wallet, cashback_percent, accepts_bookings, subscription_tier, slug, is_claimed";

/** Escape a user query for safe use inside a PostgREST `.or(...)` filter value. */
function sanitizeOrTerm(s: string): string {
  // Commas and parens are PostgREST .or() delimiters; strip them out.
  return s.replace(/[,()]/g, " ").trim();
}

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

/**
 * Genuinely featured businesses (active pro/premium subscribers) — no backfill,
 * so the Directory "Featured" row only ever shows businesses that pay for it.
 */
export async function getDirectoryFeatured(limit = 6): Promise<Business[]> {
  const sb = publicClient();
  const now = new Date().toISOString();
  try {
    const { data } = await sb
      .from("local_businesses")
      .select(LIST_COLS)
      .eq("is_active", true)
      .in("subscription_tier", ["pro", "premium"])
      .or(`subscription_until.is.null,subscription_until.gt.${now}`)
      .order("subscription_tier", { ascending: false })
      .order("is_verified", { ascending: false })
      .limit(limit);
    return (data ?? []) as unknown as Business[];
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
export async function getAllBusinesses(
  opts: { category?: string; q?: string; area?: string; bookableOnly?: boolean } = {},
): Promise<Business[]> {
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
    if (opts.bookableOnly) q = q.eq("accepts_bookings", true);
    // Area filter — match locality first, falling back to address text (mirrors the app feed).
    if (opts.area) {
      const a = sanitizeOrTerm(opts.area);
      if (a) q = q.ilike("address", `%${a}%`);
    }
    // Deep search — name + category + address (parity with the app's
    // local-businesses-browse filter, which matches name/category/address/tags).
    // tags is text[]: PostgREST can't substring-match inside array elements, so
    // those rows are folded in via a post-filter below.
    const term = opts.q ? sanitizeOrTerm(opts.q) : "";
    if (term) {
      q = q.or(
        [
          `name.ilike.%${term}%`,
          `category.ilike.%${term}%`,
          `address.ilike.%${term}%`,
          `description.ilike.%${term}%`,
          `tags.cs.{${term}}`,
        ].join(","),
      );
    }
    const { data } = await q;
    let rows = (data ?? []) as unknown as Business[];

    // Fold in businesses whose tags contain the term as a substring (the SQL
    // `tags.cs.{term}` above only catches an exact-tag match). Cheap second
    // pass over the active set, deduped against the primary results.
    if (term) {
      const have = new Set(rows.map((b) => b.id));
      const lc = term.toLowerCase();
      let tq = sb
        .from("local_businesses")
        .select(LIST_COLS)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(200);
      if (opts.category) tq = tq.eq("category", opts.category);
      if (opts.bookableOnly) tq = tq.eq("accepts_bookings", true);
      const { data: tagData } = await tq;
      for (const b of (tagData ?? []) as unknown as Business[]) {
        if (have.has(b.id)) continue;
        if ((b.tags ?? []).some((t) => t.toLowerCase().includes(lc))) {
          rows.push(b);
          have.add(b.id);
        }
      }
      // keep verified-first, then alphabetical ordering across the merged set
      rows = rows.sort(
        (a, b) =>
          Number(b.is_verified) - Number(a.is_verified) || a.name.localeCompare(b.name),
      );
    }
    return rows;
  } catch {
    return [];
  }
}

/* ── Bookable browse ──────────────────────────────────────────────────────── */
export async function getBookableBusinesses(
  opts: { category?: string; area?: string } = {},
): Promise<Business[]> {
  const sb = publicClient();
  try {
    let q = sb
      .from("local_businesses")
      .select(LIST_COLS)
      .eq("is_active", true)
      .eq("accepts_bookings", true)
      .order("subscription_tier", { ascending: false })
      .order("is_verified", { ascending: false })
      .order("name", { ascending: true })
      .limit(200);
    if (opts.category) q = q.eq("category", opts.category);
    if (opts.area) {
      const a = sanitizeOrTerm(opts.area);
      if (a) q = q.ilike("address", `%${a}%`);
    }
    const { data } = await q;
    return (data ?? []) as unknown as Business[];
  } catch {
    return [];
  }
}

/** Count of active bookable services per business (for the bookable browse). */
export async function getServiceCounts(businessIds: string[]): Promise<Record<string, number>> {
  if (businessIds.length === 0) return {};
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("book_services")
      .select("business_id")
      .eq("is_active", true)
      .in("business_id", businessIds);
    const counts: Record<string, number> = {};
    for (const r of (data ?? []) as { business_id: string }[]) {
      counts[r.business_id] = (counts[r.business_id] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
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
): Promise<{ offers: Offer[]; loyalty: Loyalty | null; services: Service[]; unitItems: UnitItem[] }> {
  const sb = publicClient();
  const now = new Date().toISOString();
  const safe = async <T>(p: PromiseLike<T>, f: T): Promise<T> => {
    try {
      return await p;
    } catch {
      return f;
    }
  };

  const [offers, loyalty, services, unitItems] = await Promise.all([
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
        .select("id, business_id, name, description, duration_minutes, buffer_minutes, price_pence, deposit_pence, requires_deposit, capacity, category")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .then((r) => (r.data ?? []) as Service[]),
      [] as Service[],
    ),
    safe(
      sb
        .from("book_unit_items")
        .select("id, business_id, name, description, price_pence, stock, valid_days, uses_per_purchase, image_url, category")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true })
        .then((r) => (r.data ?? []) as UnitItem[]),
      [] as UnitItem[],
    ),
  ]);

  return { offers, loyalty, services, unitItems };
}

/* ── Local feed ───────────────────────────────────────────────────────────── */

export type FeedEvent = {
  id: string; title: string; starts_at: string; venue: string | null;
  locality: string | null; cover_url: string | null; category: string | null;
  price_text: string | null; has_tickets: boolean;
};
export type FeedJob = {
  id: string; title: string; location: string | null; pay_text: string | null; posted_at: string;
};
export type FeedNotice = {
  id: string; title: string; body: string | null; published_at: string;
  hub: { id: string; name: string; logo_url: string | null; slug: string | null } | null;
};

export async function getLocalFeed(area?: string): Promise<{
  events: FeedEvent[];
  jobs: FeedJob[];
  businesses: Business[];
  notices: FeedNotice[];
  offers: Offer[];
}> {
  const sb = publicClient();
  const now = new Date().toISOString();
  const safe = async <T>(p: PromiseLike<T>, f: T): Promise<T> => { try { return await p; } catch { return f; } };

  const areaFilter = (field: string) => area ? `${field}.ilike.%${area}%` : undefined;

  const [events, jobs, businesses, notices, offers] = await Promise.all([
    safe(
      (async () => {
        let q = sb.from("events")
          .select("id, title, starts_at, venue, locality, cover_url, category, price_text, has_tickets")
          .eq("status", "published")
          .or("organiser_hub_id.is.null,calendar_approved.eq.true")
          .gte("starts_at", now)
          .order("starts_at", { ascending: true })
          .limit(6);
        if (area) q = q.ilike("locality", `%${area}%`);
        const { data } = await q;
        return (data ?? []) as FeedEvent[];
      })(),
      [] as FeedEvent[],
    ),
    safe(
      (async () => {
        let q = sb.from("jobs")
          .select("id, title, location, pay_text, posted_at")
          .eq("is_hidden", false)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order("posted_at", { ascending: false })
          .limit(6);
        if (area) q = q.ilike("location", `%${area}%`);
        const { data } = await q;
        return (data ?? []) as FeedJob[];
      })(),
      [] as FeedJob[],
    ),
    safe(
      (async () => {
        let q = sb.from("local_businesses")
          .select(LIST_COLS)
          .eq("is_active", true)
          .order("subscription_tier", { ascending: false })
          .order("is_verified", { ascending: false })
          .limit(6);
        if (area) q = q.ilike("address", `%${area}%`);
        const { data } = await q;
        return (data ?? []) as unknown as Business[];
      })(),
      [] as Business[],
    ),
    safe(
      (async () => {
        let q = sb.from("notices")
          .select("id, title, body, published_at, hub:hubs(id, name, logo_url, slug)")
          .eq("visibility", "public")
          .order("published_at", { ascending: false })
          .limit(4);
        const { data } = await q;
        const rows = (data ?? []) as unknown as FeedNotice[];
        if (!area) return rows;
        // Filter by hub area after fetch (hubs have an `area` field)
        const hubIds = rows.map(r => r.hub?.id).filter(Boolean) as string[];
        if (!hubIds.length) return rows;
        const { data: hubAreas } = await sb.from("hubs").select("id, area").in("id", hubIds);
        const areaMap = Object.fromEntries((hubAreas ?? []).map((h: { id: string; area: string | null }) => [h.id, h.area]));
        return rows.filter(r => {
          if (!r.hub?.id) return true;
          const ha = areaMap[r.hub.id] ?? "";
          return ha.toLowerCase().includes(area.toLowerCase());
        });
      })(),
      [] as FeedNotice[],
    ),
    safe(
      (async () => {
        const { data: offerRows } = await sb.from("local_offers")
          .select("id, business_id, title, description, image_url, discount_type, discount_value, valid_until")
          .eq("is_active", true)
          .lte("valid_from", now)
          .gte("valid_until", now)
          .order("created_at", { ascending: false })
          .limit(24);
        const rows = (offerRows ?? []) as Offer[];
        if (rows.length === 0) return [];
        const ids = [...new Set(rows.map(o => o.business_id))];
        const { data: biz } = await sb.from("local_businesses")
          .select("id, name, logo_url, category, slug, address")
          .in("id", ids);
        const map = Object.fromEntries((biz ?? []).map((b) => [b.id, b]));
        let withBiz: Offer[] = rows.map(o => ({ ...o, business: map[o.business_id] ?? null }));
        // Area filter via the business address (offers have no address of their own)
        if (area) {
          withBiz = withBiz.filter(o => {
            const addr = (map[o.business_id] as { address?: string } | undefined)?.address ?? "";
            return addr.toLowerCase().includes(area.toLowerCase());
          });
        }
        // One offer per business (freshest first), capped at 6
        const seen = new Set<string>();
        return withBiz.filter(o => {
          if (seen.has(o.business_id)) return false;
          seen.add(o.business_id);
          return true;
        }).slice(0, 6);
      })(),
      [] as Offer[],
    ),
  ]);

  return { events, jobs, businesses, notices, offers };
}

/* ── Business creation ────────────────────────────────────────────────────── */

export type BusinessCreateInput = {
  name: string;
  category: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  locality?: string | null;
};

/* ── Hub search fallback ──────────────────────────────────────────────────── */

export type HubResult = {
  id: string; name: string; slug: string | null; type: string;
  description: string | null; logo_url: string | null; area: string | null;
  member_count: number | null;
};

export async function searchHubs(q: string): Promise<HubResult[]> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("hubs")
      .select("id, name, slug, type, description, logo_url, area, member_count")
      .eq("is_active", true)
      .ilike("name", `%${q}%`)
      .limit(6);
    return (data ?? []) as HubResult[];
  } catch {
    return [];
  }
}

/* ── Business extras: events + jobs ──────────────────────────────────────── */

export type BusinessEvent = {
  id: string; title: string; starts_at: string; venue: string | null; cover_url: string | null;
};
export type BusinessJob = {
  id: string; title: string; location: string | null; pay_text: string | null; posted_at: string;
};
export type BusinessOwner = { full_name: string | null } | null;

export async function getBusinessEventsAndJobs(businessId: string): Promise<{
  events: BusinessEvent[]; jobs: BusinessJob[]; owner: BusinessOwner;
}> {
  const sb = publicClient();
  const now = new Date().toISOString();
  const safe = async <T>(p: PromiseLike<T>, f: T): Promise<T> => { try { return await p; } catch { return f; } };

  // Get owner_id from the business row
  const { data: biz } = await sb.from("local_businesses").select("owner_id").eq("id", businessId).maybeSingle();
  const ownerId = (biz as { owner_id?: string | null } | null)?.owner_id;

  const [events, jobs, ownerProfile] = await Promise.all([
    safe(
      sb.from("events")
        .select("id, title, starts_at, venue, cover_url")
        .eq("organiser_business_id", businessId)
        .eq("status", "published")
        .gte("starts_at", now)
        .order("starts_at", { ascending: true })
        .limit(3)
        .then(r => (r.data ?? []) as BusinessEvent[]),
      [] as BusinessEvent[],
    ),
    safe(
      sb.from("jobs")
        .select("id, title, location, pay_text, posted_at")
        .eq("business_id", businessId)
        .eq("is_hidden", false)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("posted_at", { ascending: false })
        .limit(4)
        .then(r => (r.data ?? []) as BusinessJob[]),
      [] as BusinessJob[],
    ),
    ownerId
      ? safe(
          sb.from("profiles")
            .select("full_name")
            .eq("id", ownerId)
            .maybeSingle()
            .then(r => (r.data ?? null) as BusinessOwner),
          null,
        )
      : Promise.resolve(null as BusinessOwner),
  ]);

  return { events, jobs, owner: ownerProfile };
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
export function offerBadge(o: Pick<Offer, "discount_type" | "discount_value">): string {
  const v = o.discount_value;
  switch (o.discount_type) {
    case "percent": return v ? `${v}% off` : "% off";
    case "fixed":   return v != null ? `£${v.toFixed(2)} off` : "£ off"; // stored in pounds (app convention)
    case "amount":  return v != null ? `£${(v / 100).toFixed(0)} off` : "£ off"; // stored in pence
    case "freebie": return "Freebie";
    case "bogo":    return "2 for 1";
    default:        return "Offer";
  }
}
export function money(pence: number): string {
  return pence <= 0 ? "On request" : `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
}
