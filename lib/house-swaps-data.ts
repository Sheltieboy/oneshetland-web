/**
 * house-swaps-data.ts — server-side reads for OneShetland House Swaps.
 *
 * Everything runs on the VISITOR'S OWN Supabase session (never a privileged admin client). The tables are locked in the database: adverts are read from the
 * public view house_swap_listings_public, and every member action is a SECURITY DEFINER function that checks who is calling. If the feature switch is off
 * (house_swaps_enabled() = false) the whole section is a 404.
 */
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callRpc, type RpcResult } from "@/lib/notices-rpc";
import { PAGE_SIZE, isUuid, type BrowseQuery, type MatchRow, type MyListing, type PublicListing, type QueueRow, type ThreadMessage, type ThreadRow, type ModerationTab, type ReportRow, type InviteRow } from "@/lib/house-swaps";

/** True only when staff have switched House Swaps on. Any failure (function missing, database down) counts as OFF, so nothing half-works. */
export const houseSwapsEnabled = cache(async (): Promise<boolean> => {
  try {
    const sb = await createClient();
    const r = await callRpc<boolean>(sb, "house_swaps_enabled");
    return r.ok && r.data === true;
  } catch {
    return false;
  }
});

export type HouseSwapsGate = { mode: "off" | "preview" | "live"; allowed: boolean; signedIn: boolean };

/** What the layout needs to decide between 404, the restricted-preview page and the service. Uses the visitor's own session; any failure counts as OFF. */
export const houseSwapsGate = cache(async (): Promise<HouseSwapsGate> => {
  const off: HouseSwapsGate = { mode: "off", allowed: false, signedIn: false };
  try {
    const sb = await createClient();
    const r = await callRpc<{ mode?: string; allowed?: boolean; signed_in?: boolean }>(sb, "house_swaps_gate");
    if (!r.ok || !r.data) return off;
    const mode = r.data.mode === "preview" || r.data.mode === "live" ? r.data.mode : "off";
    return { mode, allowed: mode !== "off" && r.data.allowed === true, signedIn: r.data.signed_in === true };
  } catch {
    return off;
  }
});

/** Call at the top of every House Swaps page: 404 while the feature is off. */
export async function requireHouseSwaps(): Promise<void> {
  if (!(await houseSwapsEnabled())) notFound();
}

/** The signed-in member's id (null when signed out). One lookup per request. */
export const currentUserId = cache(async (): Promise<string | null> => {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user?.id ?? null;
});

type Page<T> = { rows: T[]; hasMore: boolean };

export async function getBrowse(q: BrowseQuery): Promise<RpcResult<Page<PublicListing>>> {
  try {
    const sb = await createClient();
    let qb = sb.from("house_swap_listings_public").select("*");
    if (q.area) qb = qb.eq("have_area_id", q.area);
    if (q.beds) qb = q.beds === "5+" ? qb.gte("have_bedrooms", 5) : qb.eq("have_bedrooms", Number(q.beds));
    if (q.types.length) qb = qb.in("have_type", q.types);
    if (q.features.length) qb = qb.contains("have_features", q.features);
    // "looking to move to X": adverts that list X, plus those open to anywhere (an empty list).
    if (q.want) qb = qb.or(`want_area_ids.cs.{${q.want}},want_area_ids.eq.{}`);
    const from = (q.page - 1) * PAGE_SIZE;
    const { data, error } = await qb.order("last_confirmed_at", { ascending: false }).order("id").range(from, from + PAGE_SIZE);
    if (error) return { ok: false, error: error.message || "The adverts could not be loaded." };
    const rows = (data ?? []) as PublicListing[];
    return { ok: true, data: { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE } };
  } catch {
    return { ok: false, error: "The adverts could not be loaded." };
  }
}

export async function getListing(id: string): Promise<PublicListing | null> {
  if (!isUuid(id)) return null;
  try {
    const sb = await createClient();
    const { data } = await sb.from("house_swap_listings_public").select("*").eq("id", id).maybeSingle();
    return (data as PublicListing | null) ?? null;
  } catch {
    return null;
  }
}

/** The member's own advert (null when signed out or they have none). */
export const getMyListing = cache(async (): Promise<RpcResult<MyListing | null>> => {
  if (!(await currentUserId())) return { ok: true, data: null };
  const sb = await createClient();
  return callRpc<MyListing | null>(sb, "my_house_swap");
});

/** Unread enquiry messages for the signed-in member (0 when signed out or on any failure): drives the badge in the section navigation. */
export async function getUnreadCount(): Promise<number> {
  const r = await getMyListing();
  return r.ok && r.data ? Number(r.data.unread_enquiries) || 0 : 0;
}

export async function getMatches(limit = 20): Promise<RpcResult<MatchRow[]>> {
  if (!(await currentUserId())) return { ok: true, data: [] };
  const sb = await createClient();
  const r = await callRpc<MatchRow[] | null>(sb, "house_swap_matches", { p_limit: limit });
  return r.ok ? { ok: true, data: r.data ?? [] } : r;
}

export async function getThreads(): Promise<RpcResult<ThreadRow[]>> {
  const sb = await createClient();
  const r = await callRpc<ThreadRow[] | null>(sb, "my_house_swap_threads");
  return r.ok ? { ok: true, data: r.data ?? [] } : r;
}

export async function getThreadMessages(id: string): Promise<RpcResult<ThreadMessage[]>> {
  const sb = await createClient();
  const r = await callRpc<ThreadMessage[] | null>(sb, "house_swap_thread_messages", { p_thread: id });
  return r.ok ? { ok: true, data: r.data ?? [] } : r;
}

export async function getModerationQueue(tab: ModerationTab): Promise<RpcResult<QueueRow[]>> {
  const sb = await createClient();
  const r = await callRpc<QueueRow[] | null>(sb, "admin_house_swap_queue", { p_state: tab });
  return r.ok ? { ok: true, data: r.data ?? [] } : r;
}

export async function getReports(): Promise<RpcResult<ReportRow[]>> {
  const sb = await createClient();
  const r = await callRpc<ReportRow[] | null>(sb, "admin_house_swap_reports");
  return r.ok ? { ok: true, data: r.data ?? [] } : r;
}

export async function getReportedThread(id: string): Promise<RpcResult<{ sender: string; body: string; created_at: string }[]>> {
  const sb = await createClient();
  const r = await callRpc<{ sender: string; body: string; created_at: string }[] | null>(sb, "admin_house_swap_reported_thread", { p_thread: id });
  return r.ok ? { ok: true, data: r.data ?? [] } : r;
}

/** Staff only (the database refuses anyone else): the invited preview reviewers. */
export async function getInvites(): Promise<RpcResult<InviteRow[]>> {
  const sb = await createClient();
  const r = await callRpc<InviteRow[] | null>(sb, "admin_house_swap_invites");
  return r.ok ? { ok: true, data: r.data ?? [] } : r;
}
