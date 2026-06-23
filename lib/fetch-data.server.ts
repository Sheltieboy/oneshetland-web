/**
 * fetch-data.server.ts — auth-scoped Fetch reads (cookie session via the server
 * client). SERVER-ONLY: never import from a client component. Shared
 * types/constants/helpers + public reads live in fetch-data.ts.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  safe,
  type DeliveryRequest, type Run, type DriverProfile, type WaitingEvent, type DriverInfo,
} from "@/lib/fetch-data";

const REQUEST_COLS =
  "id, customer_id, run_id, category_slug, pickup_name, pickup_location, pickup_notes, already_paid, ready_for_collection, destination_area, destination_address, contact_phone, delivery_notes, liability_acknowledged, status, base_fee_pence, waiting_fee_pence, total_fee_pence, payment_status, created_at";

const RUN_COLS =
  "id, driver_id, destination_area, departure_start, departure_end, categories_accepted, ferry_crossing, notes, status, created_at";

/* ── Driver profile ───────────────────────────────────────────────────────── */

export async function getDriverProfile(userId: string): Promise<DriverProfile | null> {
  const sb = await createServerClient();
  const { data } = await sb.from("driver_profiles")
    .select("id, driver_status, vehicle_type, vehicle_reg, notes, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled")
    .eq("id", userId).maybeSingle();
  return (data ?? null) as DriverProfile | null;
}

export function isApprovedDriver(dp: DriverProfile | null): boolean {
  return dp?.driver_status === "approved";
}
export function isBankConnected(dp: DriverProfile | null): boolean {
  return !!(dp?.stripe_onboarding_complete && dp?.stripe_payouts_enabled);
}

/* ── Requester (customer) reads ───────────────────────────────────────────── */

export async function getMyActiveRequests(userId: string): Promise<DeliveryRequest[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("delivery_requests")
      .select(REQUEST_COLS)
      .eq("customer_id", userId)
      .in("status", ["pending", "matched", "collected"])
      .order("created_at", { ascending: false });
    return (data ?? []) as DeliveryRequest[];
  })(), []);
}

export async function getMyPreviousRequests(userId: string): Promise<DeliveryRequest[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("delivery_requests")
      .select(REQUEST_COLS)
      .eq("customer_id", userId)
      .in("status", ["delivered", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as DeliveryRequest[];
  })(), []);
}

/* ── Driver reads ─────────────────────────────────────────────────────────── */

/** The driver's upcoming runs (departure window not yet past). */
export async function getMyRuns(userId: string): Promise<Run[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("runs")
      .select(RUN_COLS)
      .eq("driver_id", userId)
      .gte("departure_end", new Date().toISOString())
      .order("departure_start", { ascending: true });
    return (data ?? []) as Run[];
  })(), []);
}

/** Pending requests any approved driver can pick up (RLS-gated to approved drivers). */
export async function getOpenRequestsForDrivers(): Promise<DeliveryRequest[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("delivery_requests")
      .select(REQUEST_COLS)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    return (data ?? []) as DeliveryRequest[];
  })(), []);
}

/** Active deliveries matched/collected on the driver's own runs. */
export async function getMyActiveDeliveries(userId: string): Promise<DeliveryRequest[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("delivery_requests")
      .select(`${REQUEST_COLS}, runs!inner(driver_id)`)
      .in("status", ["matched", "collected"])
      .eq("runs.driver_id", userId)
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as DeliveryRequest[];
  })(), []);
}

/* ── Request detail ───────────────────────────────────────────────────────── */

export async function getRequest(id: string): Promise<DeliveryRequest | null> {
  const sb = await createServerClient();
  const { data } = await sb.from("delivery_requests").select(REQUEST_COLS).eq("id", id).maybeSingle();
  return (data ?? null) as DeliveryRequest | null;
}

/** Driver info for a request via RPC (bypasses RLS like the app). */
export async function getDriverInfoForRequest(id: string): Promise<DriverInfo | null> {
  const sb = await createServerClient();
  const { data } = await sb.rpc("get_driver_info_for_request", { request_id: id });
  if (!data) return null;
  // RPC may return a single row object or an array depending on definition.
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as DriverInfo | null;
}

export async function getLatestWaitingEvent(requestId: string): Promise<WaitingEvent | null> {
  const sb = await createServerClient();
  const { data } = await sb.from("waiting_events")
    .select("id, request_id, driver_id, arrived_at, collected_at, waiting_fee_pence")
    .eq("request_id", requestId)
    .order("arrived_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as WaitingEvent | null;
}

/** Is this user the driver assigned to this request's run? */
export async function isRequestDriver(req: DeliveryRequest, userId: string): Promise<boolean> {
  if (!req.run_id) return false;
  const sb = await createServerClient();
  const { data } = await sb.from("runs").select("driver_id").eq("id", req.run_id).maybeSingle();
  return (data as { driver_id: string } | null)?.driver_id === userId;
}

/* ── Header status summary ────────────────────────────────────────────────── */

export type FetchStatusSummary = {
  /** The single most-relevant in-flight request for this user (as requester). */
  status: string | null;
  count: number;
};

/** A compact summary for the always-on header indicator (initial server value). */
export async function getFetchStatusSummary(userId: string): Promise<FetchStatusSummary> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("delivery_requests")
      .select("status")
      .eq("customer_id", userId)
      .in("status", ["pending", "matched", "collected"])
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as { status: string }[];
    // Surface the most progressed in-flight status first.
    const order = ["collected", "matched", "pending"];
    const status = rows.length
      ? rows.map((r) => r.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]
      : null;
    return { status, count: rows.length };
  })(), { status: null, count: 0 });
}
