import { publicClient } from "./supabase/public";

/* ── Types (mirror the app's lib/hubs-api.ts) ──────────────────────────────── */

export type HubType =
  | "club" | "sports" | "youth" | "hall" | "charity"
  | "society" | "volunteer" | "arts" | "community" | "other";

export type HubRole = "member" | "committee" | "owner";
export type HubStatus = "pending" | "active" | "rejected" | "left";
export type JoinMode = "open" | "approval";
export type NoticeVisibility = "public" | "members" | "committee";
export type MembershipPeriod = "once" | "month" | "year";

export const HUB_TYPE_LABELS: Record<HubType, string> = {
  club: "Club",
  sports: "Sports club",
  youth: "Youth group",
  hall: "Hall / committee",
  charity: "Charity",
  society: "Society",
  volunteer: "Volunteer group",
  arts: "Arts & culture",
  community: "Community",
  other: "Other",
};

export const HUB_TYPES = Object.keys(HUB_TYPE_LABELS) as HubType[];

export const HUB_COLOR = "#6b47bf";

export type Hub = {
  id: string;
  owner_id: string;
  name: string;
  slug: string | null;
  type: HubType;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  brand_color: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  area: string | null;
  join_mode: JoinMode;
  is_active: boolean;
  is_verified: boolean;
  memberships_enabled: boolean;
  directory_enabled: boolean;
  is_charity: boolean;
  charity_number: string | null;
  created_at: string;
  member_count?: number;
};

export type HubMembershipType = {
  id: string;
  hub_id: string;
  name: string;
  description: string | null;
  price_pence: number;
  period: MembershipPeriod;
  benefits: string | null;
  is_active: boolean;
  sort_order: number;
};

export type HubNotice = {
  id: string;
  publisher_hub_id: string | null;
  title: string;
  body: string | null;
  severity: "urgent" | "community" | "info";
  visibility: NoticeVisibility;
  image_url: string | null;
  is_pinned: boolean;
  expires_at: string | null;
  published_at: string;
};

export type HubCampaign = {
  id: string;
  hub_id: string;
  title: string;
  story: string | null;
  goal_pence: number;
  raised_pence: number;
  donor_count: number;
  cover_url: string | null;
  status: "active" | "closed";
  ends_at: string | null;
  created_at: string;
};

export type HubMember = {
  id: string;
  hub_id: string;
  user_id: string;
  role: HubRole;
  status: HubStatus;
  joined_at: string;
  membership_type_id: string | null;
  member_no: string | null;
  paid_until: string | null;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
  membership_type?: Pick<HubMembershipType, "id" | "name" | "price_pence" | "period"> | null;
  hub?: Pick<Hub, "id" | "name" | "brand_color" | "logo_url" | "type"> | null;
};

/** A membership is currently valid if active and free (no expiry) or not expired. */
export function isMembershipActive(m: Pick<HubMember, "status" | "paid_until">): boolean {
  if (m.status !== "active") return false;
  if (!m.paid_until) return true;
  return new Date(m.paid_until).getTime() > Date.now();
}

export type HubEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  locality: string | null;
  cover_url: string | null;
  category: string | null;
  price_text: string | null;
  hub_visibility: "members" | "hub" | "islands" | null;
  status: string;
};

const EVENT_COLS = "id, title, starts_at, ends_at, venue, locality, cover_url, category, price_text, hub_visibility, status";

/** Upcoming published events organised by a hub (RLS gates members-only ones). */
export async function getHubEvents(hubId: string, limit = 12): Promise<HubEvent[]> {
  const sb = publicClient();
  try {
    const now = new Date().toISOString();
    const { data } = await sb
      .from("events")
      .select(EVENT_COLS)
      .eq("organiser_hub_id", hubId)
      .eq("status", "published")
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(limit);
    return (data ?? []) as HubEvent[];
  } catch {
    return [];
  }
}

export type HubDocument = {
  id: string;
  hub_id: string;
  title: string;
  url: string;
  visibility: NoticeVisibility;
  created_at: string;
};

export type DonorWallEntry = {
  name: string;
  amount_pence: number;
  message: string | null;
  is_anonymous: boolean;
  created_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HUB_COLS =
  "id, owner_id, name, slug, type, description, logo_url, cover_url, brand_color, contact_email, contact_phone, website, area, join_mode, is_active, is_verified, memberships_enabled, directory_enabled, is_charity, charity_number, created_at";

/** Resolve a hex brand colour (falls back to the Hubs section purple). */
export function hubAccent(hub: Pick<Hub, "brand_color">): string {
  const c = hub.brand_color;
  if (c && /^#?[0-9a-fA-F]{6}$/.test(c)) return c.startsWith("#") ? c : `#${c}`;
  return HUB_COLOR;
}

/* ── Public reads ──────────────────────────────────────────────────────────── */

/** All active hubs, verified first then newest. Optional type filter. */
export async function getHubs(type?: HubType): Promise<Hub[]> {
  const sb = publicClient();
  try {
    let q = sb
      .from("hubs")
      .select(HUB_COLS)
      .eq("is_active", true)
      .order("is_verified", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (type) q = q.eq("type", type);
    const { data } = await q;
    const hubs = (data ?? []) as unknown as Hub[];
    return withMemberCounts(hubs);
  } catch {
    return [];
  }
}

/** Counts of active hubs per type (drives the filter chips). */
export async function getHubTypeCounts(): Promise<Record<string, number>> {
  const sb = publicClient();
  try {
    const { data } = await sb.from("hubs").select("type").eq("is_active", true);
    const counts: Record<string, number> = {};
    for (const r of (data ?? []) as { type: string }[]) {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

/** A single hub by slug or id. */
export async function getHub(idOrSlug: string): Promise<Hub | null> {
  const sb = publicClient();
  try {
    const col = UUID.test(idOrSlug) ? "id" : "slug";
    const { data } = await sb
      .from("hubs")
      .select(HUB_COLS)
      .eq(col, idOrSlug)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return null;
    const [hub] = await withMemberCounts([data as unknown as Hub]);
    return hub;
  } catch {
    return null;
  }
}

/** Currently-valid member count for a hub (active + free or not expired). */
export async function getMemberCount(hubId: string): Promise<number> {
  const sb = publicClient();
  try {
    const now = new Date().toISOString();
    const { count } = await sb
      .from("hub_members")
      .select("id", { count: "exact", head: true })
      .eq("hub_id", hubId)
      .eq("status", "active")
      .or(`paid_until.is.null,paid_until.gt.${now}`);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function withMemberCounts(hubs: Hub[]): Promise<Hub[]> {
  return Promise.all(
    hubs.map(async (h) => ({ ...h, member_count: await getMemberCount(h.id) })),
  );
}

/** Active membership tiers for a hub, ordered for display. */
export async function getMembershipTypes(hubId: string): Promise<HubMembershipType[]> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("hub_membership_types")
      .select("id, hub_id, name, description, price_pence, period, benefits, is_active, sort_order")
      .eq("hub_id", hubId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("price_pence", { ascending: true });
    return (data ?? []) as HubMembershipType[];
  } catch {
    return [];
  }
}

/** Public notices for a hub's page (RLS returns members-only ones to members). */
export async function getHubNotices(hubId: string, limit = 20): Promise<HubNotice[]> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("notices")
      .select("id, publisher_hub_id, title, body, severity, visibility, image_url, is_pinned, expires_at, published_at")
      .eq("publisher_hub_id", hubId)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);
    const now = Date.now();
    return ((data ?? []) as HubNotice[]).filter(
      (n) => !n.expires_at || new Date(n.expires_at).getTime() > now,
    );
  } catch {
    return [];
  }
}

/** Public documents for a hub (RLS gates members/committee ones). */
export async function getHubDocuments(hubId: string): Promise<HubDocument[]> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("hub_documents")
      .select("id, hub_id, title, url, visibility, created_at")
      .eq("hub_id", hubId)
      .order("created_at", { ascending: false });
    return (data ?? []) as HubDocument[];
  } catch {
    return [];
  }
}

/** Campaigns for a hub (active first, then newest). */
export async function getHubCampaigns(hubId: string, includeClosed = true): Promise<HubCampaign[]> {
  const sb = publicClient();
  try {
    let q = sb
      .from("hub_campaigns")
      .select("id, hub_id, title, story, goal_pence, raised_pence, donor_count, cover_url, status, ends_at, created_at")
      .eq("hub_id", hubId)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });
    if (!includeClosed) q = q.eq("status", "active");
    const { data } = await q;
    return (data ?? []) as HubCampaign[];
  } catch {
    return [];
  }
}

/** The most recent active campaign for a hub, or null. */
export async function getActiveCampaign(hubId: string): Promise<HubCampaign | null> {
  const list = await getHubCampaigns(hubId, false);
  return list[0] ?? null;
}

/** A single campaign by id. */
export async function getCampaign(id: string): Promise<HubCampaign | null> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("hub_campaigns")
      .select("id, hub_id, title, story, goal_pence, raised_pence, donor_count, cover_url, status, ends_at, created_at")
      .eq("id", id)
      .maybeSingle();
    return (data ?? null) as HubCampaign | null;
  } catch {
    return null;
  }
}

/** Public donor wall for a campaign (safe fields only, via RPC). */
export async function getCampaignDonors(campaignId: string): Promise<DonorWallEntry[]> {
  const sb = publicClient();
  try {
    const { data } = await sb.rpc("get_campaign_donors", { p_campaign: campaignId });
    return (data ?? []) as DonorWallEntry[];
  } catch {
    return [];
  }
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

export function membershipPrice(pricePence: number, period: MembershipPeriod): string {
  if (pricePence <= 0) return "Free";
  const amount = `£${(pricePence / 100).toFixed(2).replace(/\.00$/, "")}`;
  if (period === "once") return amount;
  return `${amount} / ${period === "year" ? "year" : "month"}`;
}
