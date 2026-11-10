import { createClient } from "@/lib/supabase/server";
import type { MyMembership, MyParticipation, MyPayment, OrgMember, OrgPayment, ParticipationRow, Pkg, PayoutStatus, PublicTier, StatementRow, Tier } from "./commerce";

const arr = <T,>(d: unknown): T[] => (Array.isArray(d) ? (d as T[]) : []);
const b = (x: unknown): string[] => (Array.isArray(x) ? (x as unknown[]).filter((v): v is string => typeof v === "string") : []);

/** Server reads for the commerce screens. Every one runs as the visitor; the database functions decide what they may see. */
export async function getCollectBlocker(orgId: string): Promise<string | null> {
  const sb = await createClient();
  const { data } = await sb.rpc("edition_collect_blocker", { p_org: orgId });
  return typeof data === "string" ? data : null;
}
export async function getCommerceEnabled(): Promise<boolean> {
  const sb = await createClient();
  const { data } = await sb.rpc("edition_commerce_enabled");
  return data === true;
}
export async function getPayoutStatus(orgId: string): Promise<PayoutStatus | null> {
  const sb = await createClient();
  const { data } = await sb.from("edition_payout_accounts").select("organiser_id, details_submitted, charges_enabled, payouts_enabled, requirements_due, vat_registered, vat_number, legal_name, collection_suspended, suspended_reason").eq("organiser_id", orgId).maybeSingle();
  return (data as PayoutStatus | null) ?? null;
}
export async function getTermsAccepted(orgId: string): Promise<{ accepted: boolean; version: string }> {
  const sb = await createClient();
  const { data: cfg } = await sb.rpc("edition_commerce_terms_version");
  const version = typeof cfg === "string" ? cfg : "draft-1";
  const { count } = await sb.from("edition_commerce_terms_acceptances").select("id", { count: "exact", head: true }).eq("organiser_id", orgId).eq("version", version);
  return { accepted: (count ?? 0) > 0, version };
}
export async function getOrgEntitlements(orgId: string): Promise<{ feature: string; ends_at: string; max_value: number | null }[]> {
  const sb = await createClient();
  const { data } = await sb.from("edition_organiser_entitlements").select("feature, ends_at, max_value").eq("organiser_id", orgId).is("voided_at", null).gt("ends_at", new Date().toISOString());
  return arr(data);
}
export async function getOrgTiers(orgId: string): Promise<Tier[]> {
  const sb = await createClient();
  const { data } = await sb.rpc("edition_org_tiers", { p_org: orgId });
  return arr<Tier>(data).map((t) => ({ ...t, benefits: b(t.benefits) }));
}
export async function getOrgMembers(orgId: string): Promise<OrgMember[]> { const sb = await createClient(); const { data } = await sb.rpc("edition_org_members", { p_org: orgId }); return arr<OrgMember>(data); }
export async function getRenewalsDue(orgId: string) { const sb = await createClient(); const { data } = await sb.rpc("edition_membership_renewals_due", { p_org: orgId, p_days: 30 }); return arr<{ membership_id: string; business_name: string; tier_name: string; billing_interval: string; current_period_end: string; status: string }>(data); }
export async function getPublicTiers(slug: string): Promise<PublicTier[]> { const sb = await createClient(); const { data } = await sb.rpc("edition_public_tiers", { p_org_slug: slug }); return arr<PublicTier>(data).map((t) => ({ ...t, benefits: b(t.benefits) })); }
export async function getMyMemberships(): Promise<MyMembership[]> { const sb = await createClient(); const { data } = await sb.rpc("edition_my_memberships"); return arr<MyMembership>(data).map((m) => ({ ...m, benefits: b(m.benefits) })); }
export async function getMyParticipations(): Promise<MyParticipation[]> { const sb = await createClient(); const { data } = await sb.rpc("edition_my_participations"); return arr<MyParticipation>(data); }
export async function getMyPayments(): Promise<MyPayment[]> { const sb = await createClient(); const { data } = await sb.rpc("edition_my_payments"); return arr<MyPayment>(data); }
export async function getOrgPayments(orgId: string, kind?: string): Promise<OrgPayment[]> { const sb = await createClient(); const { data } = await sb.rpc("edition_org_payments", { p_org: orgId, p_from: null, p_to: null, p_kind: kind ?? null }); return arr<OrgPayment>(data); }
export async function getOrgStatement(orgId: string): Promise<StatementRow[]> { const sb = await createClient(); const from = new Date(Date.now() - 366 * 864e5).toISOString(); const { data } = await sb.rpc("edition_org_statement", { p_org: orgId, p_from: from, p_to: new Date(Date.now() + 864e5).toISOString() }); return arr<StatementRow>(data); }
export async function getParticipationRows(editionId: string): Promise<ParticipationRow[]> { const sb = await createClient(); const { data } = await sb.rpc("edition_participation_rows", { p_edition: editionId }); return arr<ParticipationRow>(data); }
export async function getParticipationTerms(editionId: string) {
  const sb = await createClient();
  const { data } = await sb.from("edition_participation_terms").select("mode, fee_pence, vat_mode, refund_policy, refund_until, capacity, applications_close").eq("edition_id", editionId).maybeSingle();
  return (data as { mode: "free" | "fee_required"; fee_pence: number | null; vat_mode: string; refund_policy: "none" | "until_date" | "full"; refund_until: string | null; capacity: number | null; applications_close: string | null } | null) ?? null;
}
export async function getActivePackages(): Promise<Pkg[]> { const sb = await createClient(); const { data } = await sb.from("edition_packages").select("*").eq("active", true).order("sort"); return arr<Pkg>(data).map((p) => ({ ...p, features: b(p.features) })); }
export async function getOrgOrders(orgId: string) { const sb = await createClient(); const { data } = await sb.from("edition_orders").select("id, edition_id, status, amount_pence, created_at, paid_at, package_snapshot").eq("organiser_id", orgId).order("created_at", { ascending: false }).limit(50); return arr<{ id: string; edition_id: string; status: string; amount_pence: number; created_at: string; paid_at: string | null; package_snapshot: { name?: string } }>(data); }
export async function getRefundRequests(orgId: string) { const sb = await createClient(); const { data } = await sb.from("edition_refund_requests").select("id, payment_id, amount_pence, status, reason, created_at").eq("organiser_id", orgId).order("created_at", { ascending: false }).limit(30); return arr<{ id: string; payment_id: string; amount_pence: number; status: string; reason: string; created_at: string }>(data); }
