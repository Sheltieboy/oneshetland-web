"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { GRANT_FEATURES, ORGANISER_DECISIONS, adminError, grantEnd, isUuid, type OrganiserDecision } from "./helpers";

/**
 * Admin actions for Editions. Each starts with requireAdmin() and then runs as the signed-in user (RLS + the SECURITY DEFINER functions check the caller
 * again; nothing here uses a service key). Results are { ok: true } or { ok: false, error }.
 */
export type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown): Result => ({ ok: false, error: adminError(e instanceof Error ? e.message : typeof e === "string" ? e : "") });
const refresh = (...paths: string[]) => { for (const p of ["/admin/editions", ...paths]) revalidatePath(p); };
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Suspend, or reinstate, an existing organiser. Verification is not here any more: it happens inside Edition approval. */
export async function decideOrganiserAction(input: { organiserId: string; decision: string; note?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.organiserId)) return { ok: false, error: "Unknown organiser." };
  if (!(ORGANISER_DECISIONS as readonly string[]).includes(input.decision)) return { ok: false, error: "Unknown decision." };
  const decision = input.decision as OrganiserDecision;
  const note = str(input.note);
  if (decision === "suspend" && note.length < 5) return { ok: false, error: "Add a reason for the suspension." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_decide_edition_organiser", { p_org: input.organiserId, p_decision: decision, p_note: note || null });
    if (error) return fail(error.message);
    refresh(`/admin/editions/organisers/${input.organiserId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function markTestAction(input: { organiserId: string; editionId?: string | null }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.organiserId) || (input.editionId && !isUuid(input.editionId))) return { ok: false, error: "Unknown organiser or edition." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_mark_edition_test", { p_org: input.organiserId, p_edition: input.editionId || null });
    if (error) return fail(error.message);
    refresh(`/admin/editions/organisers/${input.organiserId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function moderateEditionAction(input: { editionId: string; action: string; reason?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.editionId)) return { ok: false, error: "Unknown edition." };
  if (input.action !== "suspend" && input.action !== "restore") return { ok: false, error: "Unknown action." };
  const reason = str(input.reason);
  if (reason.length < 5) return { ok: false, error: "Add a reason (at least 5 characters)." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("edition_moderate", { p_edition: input.editionId, p_action: input.action, p_reason: reason });
    if (error) return fail(error.message);
    refresh(`/admin/editions/${input.editionId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function grantEntitlementAction(input: { editionId: string; feature: string; preset?: string; customEnd?: string; reason?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.editionId)) return { ok: false, error: "Unknown edition." };
  if (!(GRANT_FEATURES as readonly string[]).includes(input.feature)) return { ok: false, error: "Choose what to grant." };
  const reason = str(input.reason);
  if (reason.length < 5) return { ok: false, error: "Add a reason (at least 5 characters)." };
  const end = grantEnd({ preset: input.preset, customEnd: input.customEnd });
  if (!end.ok) return end;
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_grant_edition_entitlement", {
      p_edition: input.editionId, p_feature: input.feature, p_starts: new Date().toISOString(), p_ends: end.endsAt, p_reason: reason,
    });
    if (error) return fail(error.message);
    refresh(`/admin/editions/${input.editionId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function voidEntitlementAction(input: { entitlementId: string; editionId?: string; reason?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.entitlementId)) return { ok: false, error: "Unknown entitlement." };
  const reason = str(input.reason);
  if (reason.length < 5) return { ok: false, error: "Add a reason (at least 5 characters)." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_void_edition_entitlement", { p_entitlement: input.entitlementId, p_reason: reason });
    if (error) return fail(error.message);
    refresh(input.editionId && isUuid(input.editionId) ? `/admin/editions/${input.editionId}` : "/admin/editions");
    return { ok: true };
  } catch (e) { return fail(e); }
}

/**
 * Refund a package order (all of what is left, or part of it). Administrators only; the database function validates, records the request and audits it, and OneShetland's refund worker
 * performs the card refund. A full refund ends the package, so the Edition stops being public. Amount is entered in pounds.
 */
export async function requestOrderRefundAction(input: { orderId: string; editionId: string; amount?: string; reason?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.orderId) || !isUuid(input.editionId)) return { ok: false, error: "Unknown order." };
  const reason = str(input.reason);
  if (reason.length < 5) return { ok: false, error: "Say why you are refunding (at least 5 characters)." };
  const raw = str(input.amount).replace(/^£/, "");
  let pence: number | null = null;
  if (raw) {
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false, error: "Enter an amount in pounds, like 20 or 20.50, or leave it empty to refund everything that is left." };
    pence = Math.round(parseFloat(raw) * 100);
    if (pence < 1) return { ok: false, error: "The refund must be more than nothing." };
  }
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_request_edition_order_refund", { p_order: input.orderId, p_amount_pence: pence, p_reason: reason });
    if (error) return fail(error.message);
    refresh(`/admin/editions/${input.editionId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}
