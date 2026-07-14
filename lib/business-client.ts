"use client";

/**
 * business-client.ts — browser-side writes + edge-function calls for the Manage
 * Business dashboard. Invokes the SAME edge functions the app uses so behaviour
 * matches: local-business-onboard, local-subscription-intent, local-subscription-change,
 * local-boost-checkout, local-billing-portal, create-setup-intent, alert-addon-intent.
 */

import { createClient } from "@/lib/supabase/client";
import type { AddonKey, AlertType, ManagedBusiness, BusinessCode } from "@/lib/business-data";

async function invoke<T = Record<string, unknown>>(name: string, body?: Record<string, unknown>): Promise<T> {
  const sb = createClient();
  const { data, error } = await sb.functions.invoke(name, body ? { body } : undefined);
  if (error) {
    let msg = error.message;
    try { const ctx = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* */ }
    throw new Error(msg);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

/* ── Direct column writes (RLS: owner only) ───────────────────────────────── */

export async function updateBusiness(id: string, patch: Partial<ManagedBusiness>): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("local_businesses").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Upload a business logo/cover to the public `business-media` bucket and return
 * the public URL. Mirrors the app's lib/image-upload.ts contract (migration 037):
 * bucket `business-media`, path `<business_id>/<kind>/<uuid>.<ext>`, public-read /
 * owner-write via RLS. Same bucket + path shape the mobile app writes, so both
 * platforms share the same files. Save the returned URL onto
 * local_businesses.logo_url / cover_url.
 */
export async function uploadBusinessMedia(businessId: string, kind: "logo" | "cover", file: File): Promise<string> {
  const sb = createClient();
  // Direct REST POST with explicit apikey + bearer — the supabase-js storage
  // client can stall / fall back to anon (RLS then rejects). Mirrors the app's
  // proven upload path (lib/image-upload.ts).
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Please sign in.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${businessId}/${kind}/${uuid}.${ext}`;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/business-media/${path}`, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${session.access_token}`,
      "x-upsert": "true",
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image upload failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const { data } = sb.storage.from("business-media").getPublicUrl(path);
  return data.publicUrl;
}

export async function toggleAddon(businessId: string, key: AddonKey, enabled: boolean): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("business_addons").update({ enabled }).eq("business_id", businessId).eq("addon_key", key);
  if (error) throw error;
}

export async function setAcceptsBookings(businessId: string, value: boolean): Promise<void> {
  await updateBusiness(businessId, { accepts_bookings: value });
  await toggleAddon(businessId, "bookings", value).catch(() => { /* addon row may not exist */ });
}

export async function deactivateOffer(offerId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("local_offers").update({ is_active: false }).eq("id", offerId);
  if (error) throw error;
}

export async function upsertLoyaltyProgram(businessId: string, input: {
  type: "stamps" | "points"; stamps_required?: number | null; stamp_reward?: string | null;
  points_per_pound?: number | null; points_for_pound?: number | null;
}): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("local_loyalty_programs")
    .upsert({ business_id: businessId, is_active: true, ...input }, { onConflict: "business_id" });
  if (error) throw error;
}

/* ── Stripe / edge functions ──────────────────────────────────────────────── */

export const createBusinessOnboardingLink = (businessId: string) =>
  invoke<{ url: string; account_id?: string }>("local-business-onboard", { business_id: businessId });

export const createSubscriptionIntent = (businessId: string, tier: "pro" | "premium") =>
  invoke<{ activated?: boolean; paymentIntent?: string; ephemeralKey?: string; customer?: string; subscriptionId?: string }>("local-subscription-intent", { business_id: businessId, tier });

export const previewSubscriptionChange = (businessId: string, tier: "pro" | "premium") =>
  invoke<{ previewAmountPence: number; currency: string; nextRenewalAt: string | null; noChange?: boolean }>("local-subscription-change", { business_id: businessId, tier, preview: true });

export const applySubscriptionChange = (businessId: string, tier: "pro" | "premium") =>
  invoke<{ success: boolean; subscriptionId: string }>("local-subscription-change", { business_id: businessId, tier, preview: false });

export const createBoostIntent = (businessId: string, weeks: 1 | 2 | 3) =>
  invoke<{ charged?: boolean; payment_intent_id?: string; paymentIntent?: string; amountPence: number; weeks: number }>("local-boost-checkout", { business_id: businessId, weeks });

export const createBillingPortalLink = (businessId: string) =>
  invoke<{ url: string }>("local-billing-portal", { business_id: businessId });

/** Reconcile the £10/mo add-on line item with the number of extra premium add-ons. */
export const syncBusinessAddons = (businessId: string) =>
  invoke<{ extras: number; billed: boolean }>("sync-business-addons", { business_id: businessId });

export const createBusinessSetupIntent = (businessId: string) =>
  invoke<{ client_secret: string; customer_id?: string }>("create-setup-intent", { business_id: businessId });

/* ── Alerts ───────────────────────────────────────────────────────────────── */

export async function requestAlertAccess(businessId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("business_alert_access").upsert({ business_id: businessId, status: "requested" }, { onConflict: "business_id" });
  if (error) throw error;
}

export const createAlertAddonIntent = (businessId: string) =>
  invoke<{ activated?: boolean; paymentIntent?: string }>("alert-addon-intent", { business_id: businessId });

export const createAnalyticsAddonIntent = (businessId: string) =>
  invoke<{ activated?: boolean; paymentIntent?: string; ephemeralKey?: string; customer?: string }>("analytics-addon-intent", { business_id: businessId });

export async function sendAlert(p: { businessId: string; businessName: string; message: string; type: AlertType; expiresAt?: Date | null; scheduledFor?: Date | null }): Promise<void> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data, error } = await sb.from("partner_alerts").insert({
    business_id: p.businessId, business_name: p.businessName, message: p.message, type: p.type,
    is_active: !p.scheduledFor, starts_at: (p.scheduledFor ?? new Date()).toISOString(),
    expires_at: p.expiresAt ? p.expiresAt.toISOString() : null, created_by: user?.id ?? null,
  }).select("id").single();
  if (error) throw error;
  // Push immediately-active alerts to the business's customers (same edge fn the app uses).
  if (!p.scheduledFor && data?.id) sb.functions.invoke("notify-business-alert", { body: { alert_id: data.id } }).catch(() => {});
}

export async function cancelAlert(alertId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("partner_alerts").update({ is_active: false }).eq("id", alertId);
  if (error) throw error;
}

/** Force-end a live alert immediately — mirrors the app's forceExpireAlert (sets expires_at = now). */
export async function forceExpireAlert(alertId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("partner_alerts").update({ is_active: false, expires_at: new Date().toISOString() }).eq("id", alertId);
  if (error) throw error;
}

/* ── At-till rotating code ─────────────────────────────────────────────────── */

/** Generate + persist a fresh 6-digit till code. Mirrors the app's refreshBusinessCode
 *  (random 6 digits, 90s window for tolerance, upsert keyed on business_id). */
export async function refreshBusinessCode(businessId: string): Promise<BusinessCode> {
  const sb = createClient();
  const code = Math.floor(100_000 + Math.random() * 900_000).toString();
  const now = new Date();
  const { data, error } = await sb.from("local_business_codes")
    .upsert({ business_id: businessId, current_code: code, expires_at: new Date(now.getTime() + 90_000).toISOString(), updated_at: now.toISOString() }, { onConflict: "business_id" })
    .select("business_id, current_code, expires_at, updated_at").single();
  if (error) throw error;
  return data as BusinessCode;
}

export async function requestNfcTile(businessId: string): Promise<void> {
  // The app uses an RPC to mint a token; do the same.
  const sb = createClient();
  const { error } = await sb.rpc("request_nfc_tile", { p_business_id: businessId });
  if (error) {
    // Fallback: mark requested without a token if the RPC name differs in this env.
    const { error: e2 } = await sb.from("local_businesses").update({ nfc_status: "requested" }).eq("id", businessId);
    if (e2) throw error;
  }
}
