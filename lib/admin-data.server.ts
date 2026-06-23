/**
 * admin-data.server.ts — server reads + guard for the web Admin area.
 * SERVER-ONLY. Every read is wrapped so an admin page never 500s on a schema
 * difference — it just shows an empty section. Admin write actions live in the
 * client components (browser client; RLS enforces role='admin').
 */

import { redirect } from "next/navigation";
import { getAccount, type Account } from "@/lib/auth";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function requireAdmin(): Promise<Account> {
  const a = await getAccount();
  if (!a) redirect("/sign-in?next=/admin");
  if (a.profile?.role !== "admin") redirect("/account");
  return a;
}

export async function isAdmin(): Promise<boolean> {
  const a = await getAccount();
  return a?.profile?.role === "admin";
}

// Resilience wrappers: an admin page must never 500 on a schema/RLS difference.
// But a swallowed error must still be VISIBLE in the server logs — otherwise a
// broken read renders as an empty section / zero count and looks like "all
// clear" when it's actually misconfigured (QA M5/M6).
const safe = async <T>(p: PromiseLike<T>, f: T, label = "admin read"): Promise<T> => {
  try { return await p; }
  catch (err) { console.error(`[admin-data] ${label} failed — showing fallback:`, err); return f; }
};

async function count(table: string, build?: (q: any) => any): Promise<number> {
  try {
    const sb = await createServerClient();
    let q = sb.from(table).select("id", { count: "exact", head: true });
    if (build) q = build(q);
    const { count: c, error } = await q;
    if (error) { console.error(`[admin-data] count("${table}") errored — reporting 0:`, error.message); return 0; }
    return c ?? 0;
  } catch (err) { console.error(`[admin-data] count("${table}") threw — reporting 0:`, err); return 0; }
}

/* ── Dashboard stats ─────────────────────────────────────────────────────── */

export interface AdminStats {
  users: number; pendingDrivers: number; openRequests: number; activeRuns: number;
  pendingSpik: number; pendingClaims: number; pendingAlerts: number; pendingEvents: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [users, pendingDrivers, openRequests, activeRuns, pendingSpik, pendingClaims, pendingAlerts, pendingEvents] = await Promise.all([
    count("profiles"),
    count("driver_profiles", (q) => q.eq("driver_status", "pending")),
    count("delivery_requests", (q) => q.eq("status", "pending")),
    count("runs", (q) => q.eq("status", "open")),
    count("spik_suggestions", (q) => q.eq("status", "pending")),
    count("business_claims", (q) => q.eq("status", "pending")),
    count("business_alert_access", (q) => q.eq("status", "requested")),
    count("events", (q) => q.not("organiser_hub_id", "is", null).eq("calendar_approved", false)),
  ]);
  return { users, pendingDrivers, openRequests, activeRuns, pendingSpik, pendingClaims, pendingAlerts, pendingEvents };
}

/* ── Helper: attach profiles by id ───────────────────────────────────────── */

async function attachProfiles<T extends Record<string, unknown>>(rows: T[], idKey: keyof T, as = "profile"): Promise<(T & Record<string, unknown>)[]> {
  if (!rows.length) return rows as (T & Record<string, unknown>)[];
  const sb = await createServerClient();
  const ids = [...new Set(rows.map((r) => r[idKey]).filter(Boolean))] as string[];
  const { data } = await sb.from("profiles").select("id, full_name, location_area, role").in("id", ids);
  const map = Object.fromEntries((data ?? []).map((p: { id: string }) => [p.id, p]));
  return rows.map((r) => ({ ...r, [as]: map[r[idKey] as string] ?? null }));
}

/* ── Driver approvals ────────────────────────────────────────────────────── */

export async function getPendingDrivers() {
  return safe((async () => {
    const sb = await createServerClient();
    const { data } = await sb.from("driver_profiles")
      .select("id, vehicle_type, vehicle_reg, notes, created_at, driver_status")
      .eq("driver_status", "pending").order("created_at", { ascending: true });
    return attachProfiles(data ?? [], "id");
  })(), [] as Record<string, unknown>[]);
}

/* ── Event approvals ─────────────────────────────────────────────────────── */

export async function getPendingEvents() {
  return safe((async () => {
    const sb = await createServerClient();
    const { data } = await sb.from("events")
      .select("id, title, starts_at, venue, organiser_hub_id, hub:hubs(id, name, logo_url)")
      .not("organiser_hub_id", "is", null).eq("calendar_approved", false)
      .order("starts_at", { ascending: true }).limit(100);
    return (data ?? []) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}

/* ── Business claims ─────────────────────────────────────────────────────── */

export async function getBusinessClaims(status: "pending" | "approved" | "all" = "pending") {
  return safe((async () => {
    const sb = await createServerClient();
    let q = sb.from("business_claims")
      .select("id, business_id, user_id, status, contact_name, contact_email, contact_phone, role, evidence, created_at, business:local_businesses(id, name, slug, category)")
      .order("created_at", { ascending: false }).limit(200);
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    return (data ?? []) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}

/* ── Spik suggestions ────────────────────────────────────────────────────── */

export async function getSpikSuggestions(status: "pending" | "reviewed" | "all" = "pending") {
  return safe((async () => {
    const sb = await createServerClient();
    let q = sb.from("spik_suggestions")
      .select("id, word_id, word, field_name, field_label, current_value, suggested_value, submitter_name, show_name, status, created_at")
      .order("created_at", { ascending: false }).limit(300);
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    return (data ?? []) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}

/* ── Alerts ──────────────────────────────────────────────────────────────── */

export async function getAlertRequests() {
  return safe((async () => {
    const sb = await createServerClient();
    const { data } = await sb.from("business_alert_access")
      .select("id, business_id, status, requested_at, reviewed_at, reviewer_notes, business:local_businesses(name, category)")
      .order("requested_at", { ascending: false }).limit(200);
    return (data ?? []) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}

export async function getLiveAlerts() {
  return safe((async () => {
    const sb = await createServerClient();
    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data } = await sb.from("partner_alerts")
      .select("id, business_id, business_name, message, type, is_active, starts_at, expires_at, created_at")
      .gte("created_at", cutoff).order("created_at", { ascending: false });
    return (data ?? []) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}

/* ── Compliance search ───────────────────────────────────────────────────── */

export async function searchCompliance(email: string) {
  if (!email.trim()) return [];
  return safe((async () => {
    const sb = await createServerClient();
    const { data } = await sb.from("compliance_log")
      .select("id, user_id, user_email, user_name, event_type, document_version, description, ip_address, device_info, app_version, metadata, created_at")
      .ilike("user_email", `%${email.trim()}%`).order("created_at", { ascending: false }).limit(200);
    return (data ?? []) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}

/* ── Config + regions ────────────────────────────────────────────────────── */

export async function getAdminConfig() {
  return safe((async () => {
    const sb = await createServerClient();
    const { data } = await sb.from("admin_config")
      .select("key, value, description, category, is_secret, updated_at")
      .order("category", { ascending: true }).order("key", { ascending: true });
    return (data ?? []).filter((r: { is_secret?: boolean }) => !r.is_secret) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}

export async function getRegions() {
  return safe((async () => {
    const sb = await createServerClient();
    const { data } = await sb.from("regions").select("id, slug, name, display_order").order("display_order", { ascending: true });
    return (data ?? []) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}

/* ── Operations monitors ─────────────────────────────────────────────────── */

export async function getDeliveryRequests(status?: string) {
  return safe((async () => {
    const sb = await createServerClient();
    let q = sb.from("delivery_requests")
      .select("id, customer_id, category_slug, pickup_name, destination_area, destination_address, status, payment_status, total_fee_pence, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (status && status !== "all") q = q.eq("status", status);
    const { data } = await q;
    return attachProfiles(data ?? [], "customer_id", "customer");
  })(), [] as Record<string, unknown>[]);
}

export async function getRuns(status = "open") {
  return safe((async () => {
    const sb = await createServerClient();
    let q = sb.from("runs")
      .select("id, driver_id, departure_start, departure_end, ferry_crossing, status, categories_accepted")
      .order("departure_start", { ascending: false }).limit(100);
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    return attachProfiles(data ?? [], "driver_id", "driver");
  })(), [] as Record<string, unknown>[]);
}

export async function getEmailTemplates() {
  return safe((async () => {
    const sb = await createServerClient();
    const { data } = await sb.from("email_templates")
      .select("id, key, category, label, description, enabled, subject, body_html, variables, postmark_stream")
      .order("category", { ascending: true });
    return (data ?? []) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}

export async function getEmailLog() {
  return safe((async () => {
    const sb = await createServerClient();
    const { data } = await sb.from("email_log")
      .select("id, template_key, recipient_email, status, error, sent_at")
      .order("sent_at", { ascending: false }).limit(100);
    return (data ?? []) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}

export async function getDisputes() {
  return safe((async () => {
    const sb = await createServerClient();
    const { data } = await sb.from("waiting_events")
      .select("id, request_id, arrived_at, collected_at, waiting_fee_pence, customer_confirmed, dispute_raised, created_at")
      .eq("dispute_raised", true).order("created_at", { ascending: false }).limit(200);
    return (data ?? []) as Record<string, unknown>[];
  })(), [] as Record<string, unknown>[]);
}
