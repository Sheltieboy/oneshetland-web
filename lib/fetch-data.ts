/**
 * fetch-data.ts — the Fetch (community delivery) data layer for the web.
 *
 * Mirrors the app's delivery feature (delivery_requests, runs, driver_profiles,
 * waiting_events) and reuses the SAME Supabase backend + edge functions:
 *   calculate-fee · notify-drivers · notify-collected ·
 *   authorise-payment · capture-payment · create-connect-account
 * and RPCs get_driver_info_for_request / get_customer_info_for_request.
 *
 * This module is imported by BOTH server and client components for its shared
 * types / constants / helpers, so it must NOT import next/headers. Auth-scoped
 * reads that need the cookie session live in fetch-data.server.ts. Client
 * writes live in components/fetch/* via the browser client.
 */

import { publicClient } from "@/lib/supabase/public";

export const FETCH = "#e0722a"; // section accent (matches lib/sections.ts)

export const safe = async <T>(p: PromiseLike<T>, f: T): Promise<T> => {
  try { return await p; } catch { return f; }
};

/* ── Domain types ─────────────────────────────────────────────────────────── */

export type RequestStatus = "pending" | "matched" | "collected" | "delivered" | "cancelled";
export type RunStatus = "open" | "full" | "completed" | "cancelled";
export type DriverStatus = "not_applied" | "pending" | "approved" | "rejected" | "suspended";
export type PaymentStatus = "unpaid" | "authorised" | "captured" | "refunded" | "failed";

export type DeliveryRequest = {
  id: string;
  customer_id: string;
  run_id: string | null;
  category_slug: string;
  pickup_name: string;
  pickup_location: string;
  pickup_notes: string | null;
  already_paid: boolean;
  ready_for_collection: boolean;
  destination_area: string | null;
  destination_address: string;
  contact_phone: string | null;
  delivery_notes: string | null;
  liability_acknowledged: boolean;
  status: RequestStatus;
  base_fee_pence: number | null;
  waiting_fee_pence: number | null;
  total_fee_pence: number | null;
  payment_status: PaymentStatus | null;
  created_at: string;
};

export type Run = {
  id: string;
  driver_id: string;
  destination_area: string | null;
  departure_start: string;
  departure_end: string;
  categories_accepted: string[] | null;
  ferry_crossing: boolean;
  notes: string | null;
  status: RunStatus;
  created_at: string;
};

export type DriverProfile = {
  id: string;
  driver_status: DriverStatus;
  vehicle_type: string | null;
  vehicle_reg: string | null;
  notes: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_payouts_enabled: boolean;
};

export type WaitingEvent = {
  id: string;
  request_id: string;
  driver_id: string;
  arrived_at: string;
  collected_at: string | null;
  waiting_fee_pence: number | null;
};

/** Driver info for a request, via the get_driver_info_for_request RPC. */
export type DriverInfo = {
  full_name: string | null;
  vehicle_type: string | null;
  departure_start: string | null;
  departure_end: string | null;
  ferry_crossing: boolean | null;
};

/* ── Constants ────────────────────────────────────────────────────────────── */

export const DELIVERY_CATEGORIES = [
  { slug: "takeaway", name: "Takeaway", icon: "🍕", description: "Food from restaurants, cafés and takeaways" },
  { slug: "pharmacy", name: "Pharmacy collection", icon: "💊", description: "Prescriptions and over-the-counter items" },
  { slug: "small-parcel", name: "Small parcel", icon: "📦", description: "Packages that fit in a car boot" },
  { slug: "shop-collection", name: "Shop collection", icon: "🛍️", description: "Items purchased from Lerwick shops" },
  { slug: "supermarket-click-collect", name: "Supermarket click-and-collect", icon: "🛒", description: "Pre-ordered grocery shopping" },
  { slug: "other", name: "Other small collection", icon: "📫", description: "Anything else that fits our guidelines" },
] as const;

export type CategorySlug = (typeof DELIVERY_CATEGORIES)[number]["slug"];

export function getCategoryName(slug: string): string {
  return DELIVERY_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}
export function getCategoryIcon(slug: string): string {
  return DELIVERY_CATEGORIES.find((c) => c.slug === slug)?.icon ?? "📦";
}

export const VEHICLE_TYPES = ["Car", "Estate car", "SUV / 4x4", "Van", "Pickup truck", "Minibus"] as const;

/* ── Status display ───────────────────────────────────────────────────────── */

type Pill = { label: string; bg: string; text: string };

export const REQUEST_STATUS_PILL: Record<RequestStatus, Pill> = {
  pending: { label: "Waiting for a driver", bg: "#FEF3C7", text: "#92400E" },
  matched: { label: "Driver on the way", bg: "#EFF6FF", text: "#1D4ED8" },
  collected: { label: "Out for delivery", bg: "#ECFEFF", text: "#0E7490" },
  delivered: { label: "Delivered", bg: "#DCFCE7", text: "#065F46" },
  cancelled: { label: "Cancelled", bg: "#FEE2E2", text: "#991B1B" },
};

export const RUN_STATUS_PILL: Record<RunStatus, Pill> = {
  open: { label: "Open", bg: "#DCFCE7", text: "#065F46" },
  full: { label: "Full", bg: "#FEF3C7", text: "#92400E" },
  completed: { label: "Completed", bg: "#F3F4F6", text: "#4B5563" },
  cancelled: { label: "Cancelled", bg: "#FEE2E2", text: "#991B1B" },
};

export const DRIVER_STATUS_PILL: Record<DriverStatus, Pill> = {
  not_applied: { label: "Not applied", bg: "#F3F4F6", text: "#4B5563" },
  pending: { label: "Application under review", bg: "#FEF3C7", text: "#92400E" },
  approved: { label: "Approved driver", bg: "#DCFCE7", text: "#065F46" },
  rejected: { label: "Application rejected", bg: "#FEE2E2", text: "#991B1B" },
  suspended: { label: "Account suspended", bg: "#FEF3C7", text: "#92400E" },
};

/* ── Pricing / fee helpers (parity with the app) ──────────────────────────── */

export const PRICE_PER_MILE_PENCE = 95;
export const MIN_FEE_PENCE = 400;
export const ROAD_FACTOR = 1.4;

export const WAIT_GRACE_SECS = 5 * 60;
export const WAIT_PERIOD_SECS = 5 * 60;
export const WAIT_PERIOD_PENCE = 150;
export const WAIT_MAX_PENCE = 600;

export function penceToGBP(pence: number | null | undefined): string {
  return `£${((pence ?? 0) / 100).toFixed(2)}`;
}

/** Haversine distance in miles between two lat/lng points. */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Estimate the delivery fee from coordinates. Returns { feePence, miles }. */
export function estimateFee(pickupLat: number, pickupLng: number, destLat: number, destLng: number) {
  const roadMiles = haversineMiles(pickupLat, pickupLng, destLat, destLng) * ROAD_FACTOR;
  const feePence = Math.max(MIN_FEE_PENCE, Math.round(roadMiles * PRICE_PER_MILE_PENCE));
  return { feePence, miles: Math.round(roadMiles * 10) / 10 };
}

/** Live waiting fee from the driver's arrival time. */
export function calcWaitingFee(arrivedAt: Date, now: Date): number {
  const elapsed = Math.max(0, (now.getTime() - arrivedAt.getTime()) / 1000);
  const billable = Math.max(0, elapsed - WAIT_GRACE_SECS);
  const periods = Math.floor(billable / WAIT_PERIOD_SECS);
  return Math.min(periods * WAIT_PERIOD_PENCE, WAIT_MAX_PENCE);
}

export function extractPostcode(address: string): string | null {
  const m = address.match(/[A-Z]{1,2}\d[\dA-Z]?\s?\d[A-Z]{2}/i);
  return m ? m[0].toUpperCase() : null;
}

/* ── Run note helpers (origin/destination are stored in notes) ────────────── */

export function runOrigin(run: Pick<Run, "notes">): string {
  return (run.notes ?? "").split("\n").find((l) => l.startsWith("Origin:"))?.replace("Origin: ", "").trim() || "Lerwick";
}
export function runDestination(run: Pick<Run, "notes" | "destination_area">): string {
  const fromNotes = (run.notes ?? "").split("\n").find((l) => l.startsWith("Destination:"))?.replace("Destination: ", "").trim();
  return fromNotes || run.destination_area || "—";
}
export function runExtraNotes(run: Pick<Run, "notes">): string {
  return (run.notes ?? "")
    .split("\n")
    .filter((l) => !l.startsWith("Origin:") && !l.startsWith("Destination:"))
    .join("\n")
    .trim();
}

/* ── Date helpers ─────────────────────────────────────────────────────────── */

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  let day: string;
  if (d.toDateString() === today.toDateString()) day = "Today";
  else if (d.toDateString() === tomorrow.toDateString()) day = "Tomorrow";
  else day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function fmtTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso), e = new Date(endIso);
  const t = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${t(s)} – ${t(e)}`;
}

/* ── Public reads ─────────────────────────────────────────────────────────── */

/** Open runs happening now/soon — used on the signed-out hub to show activity. */
export async function getLiveRuns(limit = 12): Promise<Run[]> {
  const sb = publicClient();
  return safe((async () => {
    const { data } = await sb.from("runs")
      .select("id, driver_id, destination_area, departure_start, departure_end, categories_accepted, ferry_crossing, notes, status, created_at")
      .eq("status", "open")
      .gte("departure_end", new Date().toISOString())
      .order("departure_start", { ascending: true })
      .limit(limit);
    return (data ?? []) as Run[];
  })(), []);
}
