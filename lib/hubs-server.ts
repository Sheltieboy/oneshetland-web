import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHub, hubAccent, type Hub, type HubMember, type HubRole, type MyDonation } from "@/lib/hubs-data";

/** Load a hub by slug/id and require the signed-in user to be an admin.
 *  notFound() if the hub is missing; redirect to the public page otherwise. */
export async function requireHubAdmin(idOrSlug: string): Promise<{ hub: Hub; accent: string }> {
  const hub = await getHub(idOrSlug);
  if (!hub) notFound();
  const admin = await isHubAdmin(hub.id);
  if (!admin.isAdmin) redirect(`/hubs/${hub.slug || hub.id}`);
  return { hub, accent: hubAccent(hub) };
}

/** The signed-in user's membership in a hub (any status), or null. */
export async function getMyMembership(hubId: string): Promise<HubMember | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("hub_members")
    .select("*, membership_type:hub_membership_types ( id, name, price_pence, period )")
    .eq("hub_id", hubId)
    .eq("user_id", user.id)
    .maybeSingle();
  return (data ?? null) as HubMember | null;
}

/** Is the signed-in user an owner/committee admin of this hub? */
export async function isHubAdmin(hubId: string): Promise<{ isAdmin: boolean; role: HubRole | null; userId: string | null }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { isAdmin: false, role: null, userId: null };
  const { data } = await sb
    .from("hub_members")
    .select("role, status")
    .eq("hub_id", hubId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (data?.role ?? null) as HubRole | null;
  const isAdmin = data?.status === "active" && (role === "owner" || role === "committee");
  return { isAdmin, role, userId: user.id };
}

/** All members of a hub (admin only by RLS), optional status filter. */
export async function getHubMembers(hubId: string, status?: string): Promise<HubMember[]> {
  const sb = await createClient();
  let q = sb
    .from("hub_members")
    .select("*, profile:profiles ( full_name, avatar_url ), membership_type:hub_membership_types ( id, name, price_pence, period )")
    .eq("hub_id", hubId)
    .order("joined_at", { ascending: true });
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (data ?? []) as HubMember[];
}

export type DirectoryEntry = { user_id: string; name: string; role: HubRole; tier: string };

/** Privacy-safe member directory (members-only), via RPC. */
export async function getHubDirectory(hubId: string): Promise<DirectoryEntry[]> {
  const sb = await createClient();
  const { data } = await sb.rpc("get_hub_directory", { p_hub: hubId });
  return (data ?? []) as DirectoryEntry[];
}

/** The signed-in user's active hub memberships (for digital cards). */
export async function getMyHubMemberships(): Promise<HubMember[]> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const { data } = await sb
    .from("hub_members")
    .select("*, hub:hubs ( id, name, brand_color, logo_url, type ), membership_type:hub_membership_types ( id, name, price_pence, period )")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("joined_at", { ascending: false });
  return (data ?? []) as HubMember[];
}

/** Hubs the signed-in user owns or helps run (owner/committee, active). */
export async function getMyHubs(): Promise<Hub[]> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const { data } = await sb
    .from("hub_members")
    .select("role, hub:hubs(*)")
    .eq("user_id", user.id)
    .in("role", ["owner", "committee"])
    .eq("status", "active");
  const hubs = ((data ?? []) as unknown as { hub: Hub | null }[])
    .map((r) => r.hub)
    .filter((h): h is Hub => !!h && h.is_active);
  return hubs;
}

/** All events organised by a hub (admin view — any status/date). */
export async function getHubEventsAdmin(hubId: string): Promise<Record<string, unknown>[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("events")
    .select("id, title, starts_at, ends_at, venue, locality, category, price_text, hub_visibility, calendar_approved, status, has_tickets, ticket_url, ticket_types:event_ticket_types(id,name,price_pence,quantity_available,display_order)")
    .eq("organiser_hub_id", hubId)
    .order("starts_at", { ascending: false });
  return (data ?? []) as Record<string, unknown>[];
}

/** All donations for a hub (admin only by RLS) — for Gift Aid export. */
export async function getHubDonations(hubId: string, giftAidOnly = false): Promise<Record<string, unknown>[]> {
  const sb = await createClient();
  let q = sb.from("hub_donations").select("*").eq("hub_id", hubId).order("created_at", { ascending: false });
  if (giftAidOnly) q = q.eq("gift_aid", true);
  const { data } = await q;
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Everything this person has given, ever.
 *
 * Reads the snapshotted hub and campaign names rather than joining, so an
 * edited campaign title does not rewrite an old receipt and a deleted one does
 * not blank it. RLS scopes this to the donor — there is no donor filter here
 * because there does not need to be one, and adding it would invite the belief
 * that it is what protects the data.
 *
 * Deliberately NOT selected: stripe_payment_intent_id, fee_pence, and every
 * ga_* declarant field. The donor knows what they gave; the payment reference
 * is an idempotency key and the home address belongs to the Gift Aid export.
 */
export async function getMyDonations(): Promise<MyDonation[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("hub_donations")
    .select("id, hub_id, hub_name, campaign_title, amount_pence, is_anonymous, message, gift_aid, payment_method, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as MyDonation[];
}

export type HubDonationRow = {
  id: string;
  campaign_title: string | null;
  amount_pence: number;
  is_anonymous: boolean;
  message: string | null;
  gift_aid: boolean;
  payment_method: "card" | "wallet" | null;
  created_at: string;
  donorName: string;
};

/**
 * The itemised donation ledger for a hub's own admins.
 *
 * Donor naming follows the rule the product already applies everywhere else:
 * the notification a hub admin receives for an anonymous donation says "An
 * anonymous supporter", so this says the same. Being an admin is not a way
 * round somebody's choice — RLS lets an admin read donor_user_id, and this
 * deliberately does not ask for it.
 *
 * Gift Aid appears as a yes/no. The declarant's name, address and postcode stay
 * where they belong, behind the existing Gift Aid export.
 */
export async function getHubDonationLedger(hubId: string): Promise<HubDonationRow[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("hub_donations")
    .select("id, campaign_title, amount_pence, is_anonymous, message, gift_aid, payment_method, created_at, donor_user_id")
    .eq("hub_id", hubId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as (Omit<HubDonationRow, "donorName"> & { donor_user_id: string | null })[];
  const namedIds = [...new Set(rows.filter((r) => !r.is_anonymous && r.donor_user_id).map((r) => r.donor_user_id as string))];
  const names = new Map<string, string>();
  if (namedIds.length) {
    const { data: profs } = await sb.from("profiles").select("id, display_name, full_name").in("id", namedIds);
    for (const p of (profs ?? []) as { id: string; display_name: string | null; full_name: string | null }[]) {
      names.set(p.id, p.display_name || p.full_name || "A supporter");
    }
  }

  return rows.map(({ donor_user_id, ...r }) => ({
    ...r,
    donorName: r.is_anonymous
      ? "An anonymous supporter"
      : (donor_user_id ? names.get(donor_user_id) ?? "A supporter" : "A supporter"),
  }));
}
