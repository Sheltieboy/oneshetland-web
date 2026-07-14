import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHub, hubAccent, type Hub, type HubMember, type HubRole } from "@/lib/hubs-data";

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
