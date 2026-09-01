import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything the business dashboard shows before you click anything.
 *
 * The management page was twenty identical tiles — a menu of doors with
 * nothing written on them. You could not tell whether three orders were
 * waiting, whether anybody had booked, or how the week had gone, without
 * opening each one in turn. A dashboard answers "what needs me today?" first
 * and leaves the tiles for configuration.
 *
 * Every count is a REAL query. A dashboard showing a number nobody maintains
 * is worse than none: it gets believed once, found wrong, and then the whole
 * page stops being trusted.
 *
 * Everything runs in parallel and each piece fails to zero on its own, so a
 * broken bookings query can't blank the orders count.
 */

export type NeedsAction = {
  orders: number;
  bookings: number;
  leads: number;
  jobApplications: number;
};

export type WeekAtAGlance = {
  views: number;
  contacts: number;
  followers: number;
  /** Pence over the last 7 days. NULL = we genuinely can't see it, not £0. */
  revenuePence: number | null;
};

/** The actual things waiting, not just how many. */
export type OrderRow = { id: string; totalPence: number; fulfilment: string; createdAt: string; who: string | null; items: string };
export type BookingRow = { id: string; startsAt: string; service: string | null; who: string | null; pricePence: number };
export type LeadRow = { matchId: string; title: string; location: string; urgency: string; createdAt: string };

/**
 * Everything the five outcome rows need, and money's payout answer.
 *
 * null means "we could not read it", never zero. A failed count that renders as
 * "No products" is a lie an owner has no way to detect, so an unreadable value
 * degrades that row to a neutral "couldn't load this" instead.
 */
export type OutcomeReads = {
  products: number | null; productsActive: number | null;
  passes: number | null; passesActive: number | null;
  services: number | null; availability: number | null;
  events: number | null; eventsUpcoming: number | null;
  offers: number | null; offersLive: number | null;
  loyalty: number | null; loyaltyActive: number | null;
  meetsPro: boolean | null; meetsPremium: boolean | null;
  /** Boost bought and not yet expired. */
  boostActive: boolean | null;
  /**
   * Proved from BOTH payout routes — the platform account and the business's
   * own Connect account — via business_private_fields, which is owner-checked.
   * Half the evidence would tell a business that has set payouts up to go and
   * set them up.
   */
  payoutReady: boolean | null;
};

export type DashboardData = {
  code: string | null;
  orders: OrderRow[];
  bookings: BookingRow[];
  leads: LeadRow[];
  needs: NeedsAction;
  week: WeekAtAGlance;
  /** Only show the leads line to a business that has said it's a trade. */
  isTrade: boolean;
  tradeAvailability: string | null;
  tradeAvailabilitySetAt: string | null;
  outcomes: OutcomeReads;
};

type CountResult = PromiseSettledResult<{ count: number | null }>;
const countOf = (r: CountResult) => (r.status === "fulfilled" ? (r.value.count ?? 0) : 0);

export async function getDashboardData(businessId: string): Promise<DashboardData> {
  const sb = await createClient();

  /* Applications are keyed by job, not by business, so the job ids come first.
     Cheap, and it keeps the count honest — the alternative was to leave
     applications off the dashboard entirely. */
  // Supabase's builder is a PromiseLike, not a Promise — it has no .catch.
  const jobsRes = await Promise.allSettled([
    sb.from("jobs").select("id").eq("business_id", businessId),
  ]);
  const jobIds = jobsRes[0].status === "fulfilled"
    ? ((jobsRes[0].value.data ?? []) as { id: string }[]).map((j) => j.id)
    : [];

  const now = new Date().toISOString();
  const count = (t: string, apply: (q: any) => any) =>   // eslint-disable-line @typescript-eslint/no-explicit-any
    apply(sb.from(t).select("id", { count: "exact", head: true }).eq("business_id", businessId));

  /* Started here rather than awaited later: these sixteen depend on nothing in
     the batch below, so letting them wait for it would cost Home a whole extra
     round trip for no reason. Two waves, not three. */
  const outcomeReads = Promise.allSettled([
    count("products", (q) => q),
    count("products", (q) => q.eq("is_active", true)),
    count("book_unit_items", (q) => q),
    count("book_unit_items", (q) => q.eq("is_active", true)),
    count("book_services", (q) => q),
    count("book_availability_rules", (q) => q),
    sb.from("events").select("id", { count: "exact", head: true })
      .eq("organiser_business_id", businessId),
    sb.from("events").select("id", { count: "exact", head: true })
      .eq("organiser_business_id", businessId).eq("status", "published")
      .eq("is_hidden", false).gt("starts_at", now),
    count("local_offers", (q) => q),
    count("local_offers", (q) => q.eq("is_active", true).lte("valid_from", now).gte("valid_until", now)),
    count("local_loyalty_programs", (q) => q),
    count("local_loyalty_programs", (q) => q.eq("is_active", true)),
    count("local_boost_purchases", (q) => q.eq("status", "succeeded").gt("expires_at", now)),
    sb.rpc("business_meets_tier", { p_business_id: businessId, p_required_tier: "pro" }),
    sb.rpc("business_meets_tier", { p_business_id: businessId, p_required_tier: "premium" }),
    sb.rpc("business_private_fields", { p_business_id: businessId }),
  ]);

  const [codeRes, ordersRes, bookingsRes, leadsRes, appsRes, bizRes, analyticsRes] =
    await Promise.allSettled([
      sb.from("local_business_codes")
        .select("current_code").eq("business_id", businessId).maybeSingle(),

      /* The rows themselves, not a count. A number that says "3 orders" and
         nothing else still makes you click through to learn anything — which
         is the whole complaint about the old page, just with a badge on it. */
      sb.from("product_orders")
        .select("id, total_pence, fulfilment, created_at, delivery_name, items:product_order_items(title, qty)")
        .eq("business_id", businessId).eq("status", "paid")
        .order("created_at", { ascending: false }).limit(5),

      sb.from("book_bookings")
        .select("id, starts_at, price_pence, service:book_services(name), customer:profiles!book_bookings_customer_id_fkey(full_name)")
        .eq("business_id", businessId).eq("status", "confirmed")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true }).limit(5),

      sb.from("trade_brief_matches")
        .select("id, created_at, trade_briefs(title, location_text, urgency)")
        .eq("business_id", businessId).eq("status", "sent")
        .order("created_at", { ascending: false }).limit(5),

      jobIds.length
        ? sb.from("job_applications").select("id", { count: "exact", head: true })
            .in("job_id", jobIds).eq("status", "applied")
        : Promise.resolve({ count: 0 } as { count: number | null }),

      sb.from("local_businesses")
        .select("trade_categories, trade_availability, trade_availability_set_at, payout_enabled")
        .eq("id", businessId).single(),

      sb.rpc("business_analytics", { p_business_id: businessId, p_days: 7 }),
    ]);

  const [
    productsRes, productsActiveRes, passesRes, passesActiveRes,
    servicesRes, availabilityRes, eventsRes, eventsUpcomingRes,
    offersRes, offersLiveRes, loyaltyRes, loyaltyActiveRes,
    boostRes, proRes, premiumRes, privateRes,
  ] = await outcomeReads;

  /** An exact count, or null when the read failed. Never a consoling zero. */
  const num = (r: PromiseSettledResult<{ count: number | null; error?: unknown }>): number | null =>
    r.status === "fulfilled" && !r.value.error ? (r.value.count ?? 0) : null;
  const bool = (r: PromiseSettledResult<{ data: unknown; error?: unknown }>): boolean | null =>
    r.status === "fulfilled" && !r.value.error ? r.value.data === true : null;

  const bizPayoutEnabled = bizRes.status === "fulfilled"
    ? ((bizRes.value.data as { payout_enabled?: boolean | null } | null)?.payout_enabled ?? false)
    : null;

  /* Payout is ready by one of two routes, and which one applies is the
     business's own setting. use_business_payout and its Connect flags are not
     readable through the table by any client role, so they come from the
     owner-checked RPC. */
  const priv = privateRes.status === "fulfilled" && !privateRes.value.error
    ? ((privateRes.value.data as Record<string, unknown>[] | null)?.[0] ?? null)
    : undefined;
  const payoutReady = priv === undefined
    ? null
    : priv === null
      ? false
      : priv.use_business_payout === true
        ? priv.business_stripe_payouts_enabled === true
        : (bizPayoutEnabled === true && priv.stripe_connected === true);

  const outcomes: OutcomeReads = {
    products: num(productsRes as never), productsActive: num(productsActiveRes as never),
    passes: num(passesRes as never), passesActive: num(passesActiveRes as never),
    services: num(servicesRes as never), availability: num(availabilityRes as never),
    events: num(eventsRes as never), eventsUpcoming: num(eventsUpcomingRes as never),
    offers: num(offersRes as never), offersLive: num(offersLiveRes as never),
    loyalty: num(loyaltyRes as never), loyaltyActive: num(loyaltyActiveRes as never),
    meetsPro: bool(proRes as never), meetsPremium: bool(premiumRes as never),
    boostActive: (() => { const c = num(boostRes as never); return c === null ? null : c > 0; })(),
    payoutReady,
  };

  const rows = <T,>(r: PromiseSettledResult<{ data: unknown }>): T[] =>
    r.status === "fulfilled" ? ((r.value.data ?? []) as T[]) : [];

  /** PostgREST types an embedded row as an array; these are all to-one. */
  const one = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v as T)) ?? null;

  const orders: OrderRow[] = rows<Record<string, unknown>>(ordersRes as PromiseSettledResult<{ data: unknown }>).map((o) => {
    const items = (o.items ?? []) as { title: string; qty: number }[];
    return {
      id: o.id as string,
      totalPence: (o.total_pence as number) ?? 0,
      fulfilment: (o.fulfilment as string) ?? "",
      createdAt: o.created_at as string,
      who: (o.delivery_name as string | null) ?? null,
      items: items.map((i) => `${i.qty}× ${i.title}`).join(", ") || "Order",
    };
  });

  const bookings: BookingRow[] = rows<Record<string, unknown>>(bookingsRes as PromiseSettledResult<{ data: unknown }>).map((b) => ({
    id: b.id as string,
    startsAt: b.starts_at as string,
    service: one<{ name: string | null }>(b.service)?.name ?? null,
    who: one<{ full_name: string | null }>(b.customer)?.full_name ?? null,
    pricePence: (b.price_pence as number) ?? 0,
  }));

  const leads: LeadRow[] = rows<Record<string, unknown>>(leadsRes as PromiseSettledResult<{ data: unknown }>).flatMap((m) => {
    const br = one<{ title: string; location_text: string; urgency: string }>(m.trade_briefs);
    return br ? [{
      matchId: m.id as string,
      title: br.title,
      location: br.location_text,
      urgency: br.urgency,
      createdAt: m.created_at as string,
    }] : [];
  });

  const codeRow = codeRes.status === "fulfilled" ? codeRes.value.data : null;
  const biz = bizRes.status === "fulfilled" ? bizRes.value.data : null;

  /* The analytics RPC returns { basic, full }, and `full` is null without the
     add-on — so revenue is genuinely UNKNOWN for most businesses rather than
     zero. Showing £0 to somebody who took £400 last week would be a lie, so
     null renders as "not shown". */
  const a = analyticsRes.status === "fulfilled"
    ? (analyticsRes.value.data as Record<string, unknown> | null)
    : null;
  const basic = (a?.basic ?? {}) as Record<string, number>;
  const full = (a?.full ?? null) as Record<string, number> | null;

  return {
    code: (codeRow as { current_code?: string } | null)?.current_code ?? null,
    orders,
    bookings,
    leads,
    needs: {
      orders: orders.length,
      bookings: bookings.length,
      leads: leads.length,
      jobApplications: countOf(appsRes as CountResult),
    },
    week: {
      views: basic.profile_views ?? 0,
      contacts: basic.contacts ?? 0,
      followers: basic.followers ?? 0,
      revenuePence: full
        ? (full.booking_revenue_pence ?? 0) + (full.unit_revenue_pence ?? 0) + (full.ticket_revenue_pence ?? 0)
        : null,
    },
    isTrade: (((biz?.trade_categories as string[] | null) ?? []).length > 0),
    tradeAvailability: (biz?.trade_availability as string | null) ?? null,
    tradeAvailabilitySetAt: (biz?.trade_availability_set_at as string | null) ?? null,
    outcomes,
  };
}
