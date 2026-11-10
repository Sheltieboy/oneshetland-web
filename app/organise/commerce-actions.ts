"use server";

/**
 * Organiser money actions (R4). As the signed-in user through the anon key: the database functions check role, entitlement and the collection gate again; nothing
 * here can write a ledger, an entitlement or a business. Local simulation is available only on a loopback database (payments.server.ts).
 */
import { isDemoMode, DEMO_BLOCKED } from "@/lib/editions/demo-mode";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, friendlyError } from "@/lib/editions/rules";
import type { OrgRole } from "@/lib/editions/types";
import { isUuid } from "@/lib/editions/validate";
import { commerceId, offlineFields, termsFields, tierFields, toPence, vatFields, type TierInput } from "@/lib/editions/commerce";
import { paymentsMode } from "@/lib/editions/payments.server";

type Fail = { ok: false; error: string };
type Result<T = object> = ({ ok: true } & T) | Fail;
type Input = Record<string, unknown>;
const bad = (error: string): Fail => ({ ok: false, error });
const NO = "You do not have permission to do that.";
const isSlug = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 80;

async function ctx(slug: string, min: OrgRole) {
  if (!isSlug(slug)) return bad("That organiser could not be found.");
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return bad("Please sign in again to continue.");
  const { data: org } = await sb.from("edition_organisers").select("id, slug, name").eq("slug", slug).maybeSingle();
  if (!org) return bad("That organiser could not be found.");
  const { data: role } = await sb.rpc("edition_org_role", { p_org: org.id });
  if (!can(role as OrgRole | null, min)) return bad(NO);
  return { sb, user, org: org as { id: string; slug: string; name: string }, role: role as OrgRole };
}
const refresh = (slug: string) => { revalidatePath(`/organise/${slug}`, "layout"); revalidatePath("/account/editions"); revalidatePath("/editions", "layout"); };

/* ── payouts, VAT, terms ───────────────────────────────────────────────────────────────────────────────────── */

export async function connectPayouts(slug: string, returnUrl: string): Promise<Result<{ url: string | null; simulated: boolean }>> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await ctx(slug, "owner"); if ("ok" in c) return c;
  if (paymentsMode() === "simulated") {
    const { error } = await c.sb.rpc("edition_local_simulate_connect", { p_org: c.org.id });
    if (error) return bad(friendlyError(error.message));
    refresh(slug); return { ok: true, url: null, simulated: true };
  }
  const { data, error } = await c.sb.functions.invoke("edition-connect-onboard", { body: { organiser_id: c.org.id, return_url: returnUrl } });
  const d = data as { url?: string; already_complete?: boolean; error?: string } | null;
  if (error || !d || d.error) return bad(d?.error ? friendlyError(d.error) : "Payout setup is not available yet. Please try again later.");
  refresh(slug);
  return { ok: true, url: d.url ?? null, simulated: false };
}
export async function saveVatDetails(slug: string, input: Input): Promise<Result> {
  const c = await ctx(slug, "owner"); if ("ok" in c) return c;
  const v = vatFields(input); if (!v.ok) return bad(v.error);
  const { error } = await c.sb.rpc("edition_set_vat_details", { p_org: c.org.id, p_registered: v.value.registered, p_vat_number: v.value.vat_number, p_legal_name: v.value.legal_name });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); return { ok: true };
}
export async function acceptTerms(slug: string, version: string): Promise<Result> {
  const c = await ctx(slug, "owner"); if ("ok" in c) return c;
  if (typeof version !== "string" || version.length > 20) return bad("Those terms could not be found.");
  const { error } = await c.sb.rpc("edition_accept_commerce_terms", { p_org: c.org.id, p_version: version });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); return { ok: true };
}

/* ── memberships ───────────────────────────────────────────────────────────────────────────────────────────── */

export async function saveTier(slug: string, tierId: string | null, input: Input): Promise<Result<{ id: string }>> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  if (tierId !== null && !isUuid(tierId)) return bad("That tier could not be found.");
  const v = tierFields(input); if (!v.ok) return bad(v.error);
  const t: TierInput = v.value;
  const { data, error } = await c.sb.rpc("edition_tier_save", { p_org: c.org.id, p_tier: tierId, p_name: t.name, p_description: t.description, p_benefits: t.benefits, p_monthly: t.monthly, p_annual: t.annual, p_free: t.free, p_vat_mode: t.vat_mode, p_join_mode: t.join_mode, p_edition_benefit: t.edition_benefit, p_discount: t.discount, p_max_members: t.max_members, p_sort: 0 });
  if (error) return bad(/not included in your package/.test(error.message) ? "Memberships are not part of your package yet." : friendlyError(error.message));
  refresh(slug); return { ok: true, id: String(data) };
}
export async function archiveTier(slug: string, tierId: string): Promise<Result> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  if (!isUuid(tierId)) return bad("That tier could not be found.");
  const { error } = await c.sb.rpc("edition_tier_archive", { p_tier: tierId });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); return { ok: true };
}
export async function findMemberBusinesses(slug: string, q: string): Promise<Result<{ rows: { id: string; name: string; category: string | null; address: string | null; claimed: boolean; membership_status: string | null }[] }>> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  const text = typeof q === "string" ? q.trim().slice(0, 80) : ""; if (text.length < 2) return { ok: true, rows: [] };
  const { data, error } = await c.sb.rpc("edition_member_find_businesses", { p_org: c.org.id, p_q: text });
  if (error) return bad(friendlyError(error.message));
  return { ok: true, rows: (data ?? []) as never };
}
export async function inviteMember(slug: string, input: Input): Promise<Result> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  if (!commerceId(input.tier) || !commerceId(input.business)) return bad("Choose a tier and a business.");
  const interval = input.interval === "annual" ? "annual" : "monthly"; const msg = typeof input.message === "string" ? input.message.trim() : "";
  if (msg.length > 500) return bad("The message must be 500 characters or fewer.");
  const { error } = await c.sb.rpc("edition_membership_invite", { p_org: c.org.id, p_tier: input.tier, p_business: input.business, p_interval: interval, p_message: msg || null });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); return { ok: true };
}
export async function decideMembership(slug: string, membershipId: string, decision: string, note?: string): Promise<Result> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  if (!isUuid(membershipId) || (decision !== "approve" && decision !== "decline")) return bad("That application could not be found.");
  const { error } = await c.sb.rpc("edition_membership_decide", { p_membership: membershipId, p_decision: decision, p_note: (note ?? "").slice(0, 300) || null });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); return { ok: true };
}
export async function endMembership(slug: string, membershipId: string, when: string, note: string): Promise<Result> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  if (!isUuid(membershipId) || (when !== "now" && when !== "period_end")) return bad("That membership could not be found.");
  const { error } = await c.sb.rpc("edition_membership_end", { p_membership: membershipId, p_when: when, p_note: (note ?? "").trim().slice(0, 300) });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); return { ok: true };
}
export async function setMemberNote(slug: string, membershipId: string, note: string): Promise<Result> {
  const c = await ctx(slug, "editor"); if ("ok" in c) return c;
  if (!isUuid(membershipId)) return bad("That membership could not be found.");
  const { error } = await c.sb.rpc("edition_membership_set_note", { p_membership: membershipId, p_note: (note ?? "").slice(0, 1000) });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); return { ok: true };
}
export async function recordOfflineMembership(slug: string, input: Input): Promise<Result> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  if (!commerceId(input.tier) || !commerceId(input.business)) return bad("Choose a tier and a business.");
  const v = offlineFields(input); if (!v.ok) return bad(v.error);
  const { error } = await c.sb.rpc("edition_membership_record_offline", { p_org: c.org.id, p_tier: input.tier, p_business: input.business, p_kind: v.value.kind, p_start: v.value.start ? `${v.value.start}T00:00:00Z` : null, p_end: `${v.value.end}T23:59:59Z`, p_amount: v.value.amount, p_method: v.value.method, p_note: v.value.note });
  if (error) return bad(/not included in your package/.test(error.message) ? "Recording offline memberships is not part of your package yet." : friendlyError(error.message));
  refresh(slug); return { ok: true };
}
export async function renewOfflineMembership(slug: string, membershipId: string, input: Input): Promise<Result> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  if (!isUuid(membershipId)) return bad("That membership could not be found.");
  const v = offlineFields({ ...input, kind: input.kind === "complimentary" ? "complimentary" : "offline" }); if (!v.ok) return bad(v.error);
  const { error } = await c.sb.rpc("edition_membership_renew_offline", { p_membership: membershipId, p_end: `${v.value.end}T23:59:59Z`, p_amount: v.value.amount ?? 0, p_method: v.value.method, p_note: v.value.note });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); return { ok: true };
}

/* ── Edition participation ─────────────────────────────────────────────────────────────────────────────────── */

async function editionOf(c: Exclude<Awaited<ReturnType<typeof ctx>>, Fail>, edSlug: string) {
  if (!isSlug(edSlug)) return null;
  const { data } = await c.sb.from("editions").select("id, slug").eq("organiser_id", c.org.id).eq("slug", edSlug).maybeSingle();
  return data as { id: string; slug: string } | null;
}
export async function saveParticipationTerms(slug: string, edSlug: string, input: Input): Promise<Result> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  const ed = await editionOf(c, edSlug); if (!ed) return bad("That Edition could not be found.");
  const v = termsFields(input); if (!v.ok) return bad(v.error);
  const { error } = await c.sb.rpc("edition_set_participation_terms", { p_edition: ed.id, p_mode: v.value.mode, p_fee: v.value.fee, p_vat_mode: v.value.vat_mode, p_refund_policy: v.value.refund_policy, p_refund_until: v.value.refund_until, p_capacity: v.value.capacity, p_closes: v.value.closes });
  if (error) return bad(/not included in your package/.test(error.message) ? "Charging for participation is not part of your package yet." : /cannot be changed once/.test(error.message) ? "The fee and refund terms cannot change once businesses have paid." : friendlyError(error.message));
  refresh(slug); revalidatePath(`/organise/${slug}/editions/${edSlug}/participation`); return { ok: true };
}
export async function waiveParticipation(slug: string, linkId: string, note: string): Promise<Result> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  if (!isUuid(linkId)) return bad("That partner could not be found.");
  const { error } = await c.sb.rpc("edition_participation_waive", { p_link: linkId, p_note: (note ?? "").trim().slice(0, 500) });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); return { ok: true };
}
export async function recordOfflineParticipation(slug: string, linkId: string, input: Input): Promise<Result> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  if (!isUuid(linkId)) return bad("That partner could not be found.");
  const amount = toPence(input.amount); if (amount === null) return bad("Enter the amount received, like 50 or 50.00.");
  const note = typeof input.note === "string" ? input.note.trim() : ""; if (note.length < 3) return bad("Add a note, such as the cheque number.");
  const { error } = await c.sb.rpc("edition_participation_record_offline", { p_link: linkId, p_amount: amount, p_method: String(input.method), p_note: note.slice(0, 500) });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); return { ok: true };
}

/* ── refunds and packages ──────────────────────────────────────────────────────────────────────────────────── */

export async function requestRefund(slug: string, paymentId: string, amount: unknown, reason: string): Promise<Result> {
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  if (!isUuid(paymentId)) return bad("That payment could not be found.");
  const pence = toPence(amount); if (pence === null || pence <= 0) return bad("Enter the amount to refund, like 10 or 10.50.");
  const { error } = await c.sb.rpc("edition_payment_request_refund", { p_payment: paymentId, p_amount: pence, p_reason: (reason ?? "").trim().slice(0, 300) });
  if (error) return bad(friendlyError(error.message));
  if (paymentsMode() === "simulated") await c.sb.rpc("edition_local_simulate_refunds");
  refresh(slug); return { ok: true };
}
export async function createPackageOrder(slug: string, edSlug: string, packageId: string, attempt: string): Promise<Result<{ orderId: string }>> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  const ed = await editionOf(c, edSlug); if (!ed) return bad("That Edition could not be found.");
  if (!isUuid(packageId) || typeof attempt !== "string" || attempt.length < 8 || attempt.length > 80) return bad("That package could not be found.");
  const { data, error } = await c.sb.rpc("edition_create_order", { p_org: c.org.id, p_edition: ed.id, p_package: packageId, p_attempt: attempt });
  if (error) return bad(/not switched on/.test(error.message) ? "Online payment is not available yet." : friendlyError(error.message));
  refresh(slug); revalidatePath(`/organise/${slug}/editions/${edSlug}`); return { ok: true, orderId: String(data) };
}
/** A free package is chosen, not bought: no payment, no order to pay. The database checks approval, the package and the owner or administrator. */
export async function claimFreePackage(slug: string, edSlug: string, packageId: string, attempt: string): Promise<Result<{ orderId: string }>> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await ctx(slug, "admin"); if ("ok" in c) return c;
  const ed = await editionOf(c, edSlug); if (!ed) return bad("That Edition could not be found.");
  if (!isUuid(packageId) || typeof attempt !== "string" || attempt.length < 8 || attempt.length > 80) return bad("That package could not be found.");
  const { data, error } = await c.sb.rpc("edition_claim_free_package", { p_org: c.org.id, p_edition: ed.id, p_package: packageId, p_attempt: attempt });
  if (error) return bad(friendlyError(error.message));
  refresh(slug); revalidatePath(`/organise/${slug}/editions/${edSlug}`); return { ok: true, orderId: String(data) };
}
