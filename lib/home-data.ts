import { publicClient } from "./supabase/public";

/* ── Types (the slim shapes the homepage renders) ─────────────────────────── */
export type HomeEvent = {
  id: string;
  title: string;
  starts_at: string;
  venue: string | null;
  category: string | null;
  cover_url: string | null;
  is_featured: boolean;
  price_text: string | null;
  has_tickets: boolean;
};

export type HomeBusiness = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
  slug: string | null;
};

export type HomeOffer = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  discount_type: string | null;
  discount_value: number | null;
  valid_until: string;
  business: { id: string; name: string; logo_url: string | null; category: string | null } | null;
};

export type HomeNotice = {
  id: string;
  severity: string | null;
  title: string;
  body: string;
  locality: string | null;
  published_at: string;
  publisher: string;
  logo_url: string | null;
  brand_color: string | null;
};

export type HomeJob = {
  id: string;
  title: string;
  location: string | null;
  pay_text: string | null;
  posted_at: string;
};

/** A short-notice shift — the app surfaces these alongside jobs on Home. */
export type HomeShift = {
  id: string;
  title: string;
  location_text: string | null;
  pay_text: string;
  start_at: string;
  urgency: string | null;
};

/** An active partner/urgent alert, surfaced as a banner at the top of Home. */
export type HomeAlert = {
  id: string;
  business_name: string;
  message: string;
  type: string; // emergency | disruption | info
};

export type HomeSpik = { word: string; meaning: string; example: string | null } | null;

/** An active hub fundraiser — surfaced with a live progress bar on the home. */
export type HomeCampaign = {
  id: string;
  title: string;
  goal_pence: number;
  raised_pence: number;
  donor_count: number;
  hub: string;
  logo_url: string | null;
  brand_color: string | null;
};

export type HomeData = {
  events: HomeEvent[];
  businesses: HomeBusiness[];
  offers: HomeOffer[];
  notices: HomeNotice[];
  campaigns: HomeCampaign[];
  jobs: HomeJob[];
  shifts: HomeShift[];
  alerts: HomeAlert[];
  spik: HomeSpik;
};

/** One round-trip's worth of homepage content, fetched in parallel. */
export async function getHomeData(): Promise<HomeData> {
  const sb = publicClient();
  const now = new Date().toISOString();

  const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch {
      return fallback;
    }
  };

  const [events, businesses, offers, notices, campaigns, jobs, shifts, alerts, spik] = await Promise.all([
    safe(fetchEvents(sb, now), []),
    safe(fetchBusinesses(sb), []),
    safe(fetchOffers(sb, now), []),
    safe(fetchNotices(sb, now), []),
    safe(fetchCampaigns(sb), []),
    safe(fetchJobs(sb, now), []),
    safe(fetchShifts(sb, now), []),
    safe(fetchAlerts(sb, now), []),
    safe(fetchSpik(sb), null),
  ]);

  return { events, businesses, offers, notices, campaigns, jobs, shifts, alerts, spik };
}

async function fetchCampaigns(sb: SB): Promise<HomeCampaign[]> {
  const { data } = await sb
    .from("hub_campaigns")
    .select("id, title, goal_pence, raised_pence, donor_count, hub:hubs ( name, logo_url, brand_color )")
    .eq("status", "active")
    .gt("goal_pence", 0)
    // Newest first so a freshly-launched appeal actually surfaces on the home
    // teaser (ranking by amount-raised buried brand-new £0 campaigns forever).
    .order("created_at", { ascending: false })
    .limit(2);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const hub = r.hub as { name?: string; logo_url?: string; brand_color?: string } | null;
    return {
      id: r.id as string,
      title: r.title as string,
      goal_pence: (r.goal_pence as number) ?? 0,
      raised_pence: (r.raised_pence as number) ?? 0,
      donor_count: (r.donor_count as number) ?? 0,
      hub: hub?.name ?? "Community hub",
      logo_url: hub?.logo_url ?? null,
      brand_color: hub?.brand_color ?? null,
    };
  });
}

/* ── Editable homepage promo tiles (managed in the admin control centre) ─────── */
export type HomeContent = {
  id: string;
  welcome_title: string | null;
  welcome_body: string | null;
  welcome_href: string | null;
  welcome_cta: string | null;
  feature_title: string | null;
  feature_image: string | null;
  feature_href: string | null;
  spotlight_title: string | null;
  spotlight_body: string | null;
  spotlight_image: string | null;
  spotlight_href: string | null;
  spotlight_cta: string | null;
};

const HOME_CONTENT_COLS =
  "id, welcome_title, welcome_body, welcome_href, welcome_cta, feature_title, feature_image, feature_href, spotlight_title, spotlight_body, spotlight_image, spotlight_href, spotlight_cta";

export async function getHomeContent(): Promise<HomeContent | null> {
  const sb = publicClient();
  try {
    const { data } = await sb.from("home_content").select(HOME_CONTENT_COLS).limit(1).maybeSingle();
    return (data ?? null) as HomeContent | null;
  } catch {
    return null;
  }
}

type SB = ReturnType<typeof publicClient>;

async function fetchEvents(sb: SB, now: string): Promise<HomeEvent[]> {
  const { data } = await sb
    .from("events")
    .select("id, title, starts_at, venue, category, cover_url, is_featured, price_text, has_tickets")
    .eq("is_hidden", false)
    .or("organiser_hub_id.is.null,calendar_approved.eq.true")
    .gte("starts_at", now)
    .order("is_featured", { ascending: false })
    .order("starts_at", { ascending: true })
    .limit(6);
  return (data ?? []) as HomeEvent[];
}

async function fetchBusinesses(sb: SB): Promise<HomeBusiness[]> {
  const now = new Date().toISOString();
  // Subscribed (featured) businesses first, then backfill with verified actives.
  const { data: subs } = await sb
    .from("local_businesses")
    .select("id, name, category, description, logo_url, cover_url, is_verified, slug")
    .eq("is_active", true)
    .in("subscription_tier", ["pro", "premium"])
    .or(`subscription_until.is.null,subscription_until.gt.${now}`)
    .order("subscription_tier", { ascending: false })
    .limit(6);

  const out = (subs ?? []) as HomeBusiness[];
  if (out.length >= 6) return out;

  const have = new Set(out.map((b) => b.id));
  const { data: rest } = await sb
    .from("local_businesses")
    .select("id, name, category, description, logo_url, cover_url, is_verified, slug")
    .eq("is_active", true)
    .order("is_verified", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(18);
  for (const b of (rest ?? []) as HomeBusiness[]) {
    if (out.length >= 6) break;
    if (!have.has(b.id)) {
      out.push(b);
      have.add(b.id);
    }
  }
  return out;
}

async function fetchOffers(sb: SB, now: string): Promise<HomeOffer[]> {
  const { data } = await sb
    .from("local_offers")
    .select("id, title, description, image_url, discount_type, discount_value, valid_until, business_id")
    .eq("is_active", true)
    .lte("valid_from", now)
    .gte("valid_until", now)
    .order("created_at", { ascending: false })
    .limit(4);
  const offers = (data ?? []) as (Omit<HomeOffer, "business"> & { business_id: string })[];
  if (offers.length === 0) return [];

  const ids = [...new Set(offers.map((o) => o.business_id))];
  const { data: biz } = await sb
    .from("local_businesses")
    .select("id, name, logo_url, category")
    .in("id", ids);
  const map = Object.fromEntries((biz ?? []).map((b) => [b.id, b]));
  return offers.map((o) => ({ ...o, business: map[o.business_id] ?? null }));
}

async function fetchNotices(sb: SB, now: string): Promise<HomeNotice[]> {
  const { data } = await sb
    .from("notices")
    .select(
      `id, severity, title, body, locality, published_at,
       publisher_business_id, publisher_user_id, publisher_hub_id,
       hub:hubs ( name, logo_url, brand_color ),
       business:local_businesses ( name, logo_url, brand_color )`,
    )
    .eq("is_hidden", false)
    .eq("visibility", "public")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(8);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const hub = r.hub as { name?: string; logo_url?: string; brand_color?: string } | null;
    const business = r.business as { name?: string; logo_url?: string; brand_color?: string } | null;
    return {
      id: r.id as string,
      severity: (r.severity as string) ?? null,
      title: r.title as string,
      body: (r.body as string) ?? "",
      locality: (r.locality as string) ?? null,
      published_at: r.published_at as string,
      publisher:
        hub?.name ??
        business?.name ??
        (r.publisher_hub_id ? "Community hub" : r.publisher_business_id ? "Local business" : "Member"),
      logo_url: hub?.logo_url ?? business?.logo_url ?? null,
      brand_color: hub?.brand_color ?? business?.brand_color ?? null,
    };
  });
}

async function fetchJobs(sb: SB, now: string): Promise<HomeJob[]> {
  const { data } = await sb
    .from("jobs")
    .select("id, title, location, pay_text, posted_at")
    .eq("is_hidden", false)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("is_featured", { ascending: false })
    .order("posted_at", { ascending: false })
    .limit(4);
  return (data ?? []) as HomeJob[];
}

function shiftPayText(payType: string | null, payAmount: number | null): string {
  if (payType === "volunteer") return "Voluntary";
  if (payType === "negotiable") return "Negotiable";
  if (payType === "discuss") return "To discuss";
  if (!payAmount) return "Pay TBC";
  if (payType === "hourly") return `£${payAmount.toFixed(2)}/hr`;
  return `£${payAmount.toFixed(0)} fixed`;
}

async function fetchShifts(sb: SB, now: string): Promise<HomeShift[]> {
  const { data } = await sb
    .from("shifts")
    .select("id, title, location_text, pay_type, pay_amount, start_at, urgency, boosted_until")
    .eq("status", "open")
    .gte("end_at", now)
    .order("start_at", { ascending: true })
    .limit(6);
  const order = ["asap", "today", "this_week", "planned"];
  const rows = (data ?? []) as {
    id: string; title: string; location_text: string | null;
    pay_type: string | null; pay_amount: number | null;
    start_at: string; urgency: string | null; boosted_until: string | null;
  }[];
  return rows
    .sort((a, b) => {
      const ab = a.boosted_until && a.boosted_until > now ? 0 : 1;
      const bb = b.boosted_until && b.boosted_until > now ? 0 : 1;
      if (ab !== bb) return ab - bb;
      return order.indexOf(a.urgency ?? "planned") - order.indexOf(b.urgency ?? "planned");
    })
    .map((s) => ({
      id: s.id,
      title: s.title,
      location_text: s.location_text,
      pay_text: shiftPayText(s.pay_type, s.pay_amount),
      start_at: s.start_at,
      urgency: s.urgency,
    }));
}

async function fetchAlerts(sb: SB, now: string): Promise<HomeAlert[]> {
  const { data } = await sb
    .from("partner_alerts")
    .select("id, business_name, message, type")
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(3);
  return (data ?? []) as HomeAlert[];
}

async function fetchSpik(sb: SB): Promise<HomeSpik> {
  const { data } = await sb.rpc("spik_daily");
  if (Array.isArray(data) && data.length > 0) {
    const r = data[0] as { word: string; meaning: string; example?: string };
    return { word: r.word, meaning: r.meaning, example: r.example ?? null };
  }
  return null;
}

/* ── Formatting helpers ───────────────────────────────────────────────────── */
export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
export function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}
export function offerBadge(o: HomeOffer): string {
  if (o.discount_type === "percent" && o.discount_value) return `${o.discount_value}% off`;
  if (o.discount_type === "amount" && o.discount_value) return `£${(o.discount_value / 100).toFixed(0)} off`;
  return "Offer";
}
