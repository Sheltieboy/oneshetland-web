/**
 * business-data.server.ts — auth-scoped reads for the Manage Business dashboard.
 * SERVER-ONLY. Owner RLS on local_businesses means a user only ever reads their
 * own management rows.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  BUSINESS_COLS,
  type ManagedBusiness, type BusinessAddon, type LocalOffer, type LoyaltyProgram,
  type WalletReceipt, type PartnerAlert, type AlertAccess,
} from "@/lib/business-data";

const safe = async <T>(p: PromiseLike<T>, f: T): Promise<T> => { try { return await p; } catch { return f; } };

/** Businesses owned by the current user (for the switcher / "my businesses"). */
export async function getMyManagedBusinesses(userId: string): Promise<Pick<ManagedBusiness, "id" | "name" | "slug" | "logo_url" | "subscription_tier">[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("local_businesses")
      .select("id, name, slug, logo_url, subscription_tier")
      .eq("owner_id", userId).eq("is_active", true).order("name");
    return (data ?? []) as Pick<ManagedBusiness, "id" | "name" | "slug" | "logo_url" | "subscription_tier">[];
  })(), []);
}

/** Full management row by id or slug (owner only — caller must verify ownership). */
export async function getManagedBusiness(idOrSlug: string): Promise<ManagedBusiness | null> {
  const sb = await createServerClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const { data } = await sb.from("local_businesses").select(BUSINESS_COLS)
    .eq(isUuid ? "id" : "slug", idOrSlug).maybeSingle();
  return (data ?? null) as ManagedBusiness | null;
}

export async function getBusinessAddons(businessId: string): Promise<BusinessAddon[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("business_addons").select("*").eq("business_id", businessId);
    return (data ?? []) as BusinessAddon[];
  })(), []);
}

export async function getBusinessOffers(businessId: string, includeExpired = false): Promise<LocalOffer[]> {
  const sb = await createServerClient();
  return safe((async () => {
    let q = sb.from("local_offers").select("id, business_id, title, description, discount_type, discount_value, valid_from, valid_until, is_active, redemption_count, created_at")
      .eq("business_id", businessId).order("created_at", { ascending: false });
    if (!includeExpired) q = q.eq("is_active", true).gte("valid_until", new Date().toISOString());
    const { data } = await q;
    return (data ?? []) as LocalOffer[];
  })(), []);
}

export async function getLoyaltyProgram(businessId: string): Promise<LoyaltyProgram | null> {
  const sb = await createServerClient();
  const { data } = await sb.from("local_loyalty_programs").select("*").eq("business_id", businessId).maybeSingle();
  return (data ?? null) as LoyaltyProgram | null;
}

export async function getWalletReceipts(businessId: string, limit = 10): Promise<WalletReceipt[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.rpc("get_business_wallet_receipts", { p_business_id: businessId, p_limit: limit });
    return (data ?? []) as WalletReceipt[];
  })(), []);
}

export async function getAlertAccess(businessId: string): Promise<AlertAccess | null> {
  const sb = await createServerClient();
  const { data } = await sb.from("business_alert_access").select("id, business_id, status, requested_at, activated_at").eq("business_id", businessId).maybeSingle();
  return (data ?? null) as AlertAccess | null;
}

export async function getBusinessAlerts(businessId: string): Promise<PartnerAlert[]> {
  const sb = await createServerClient();
  return safe((async () => {
    const { data } = await sb.from("partner_alerts").select("id, business_id, business_name, message, type, is_active, starts_at, expires_at, created_at")
      .eq("business_id", businessId).order("created_at", { ascending: false }).limit(10);
    return (data ?? []) as PartnerAlert[];
  })(), []);
}

export async function getBusinessServicesCount(businessId: string): Promise<number> {
  const sb = await createServerClient();
  const { count } = await sb.from("book_services").select("id", { count: "exact", head: true }).eq("business_id", businessId);
  return count ?? 0;
}
