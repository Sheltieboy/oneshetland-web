"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { GRANT_FEATURES, ORGANISER_DECISIONS, adminError, grantEnd, isPilotSlug, isUuid, type OrganiserDecision } from "./helpers";

/**
 * Admin actions for Editions. Each starts with requireAdmin() and then runs as the signed-in user (RLS + the SECURITY DEFINER functions check the caller
 * again; nothing here uses a service key). Results are { ok: true } or { ok: false, error }.
 */
export type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown): Result => ({ ok: false, error: adminError(e instanceof Error ? e.message : typeof e === "string" ? e : "") });
const refresh = (...paths: string[]) => { for (const p of ["/admin/editions", ...paths]) revalidatePath(p); };
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function decideOrganiserAction(input: { organiserId: string; decision: string; note?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.organiserId)) return { ok: false, error: "Unknown organiser." };
  if (!(ORGANISER_DECISIONS as readonly string[]).includes(input.decision)) return { ok: false, error: "Unknown decision." };
  const decision = input.decision as OrganiserDecision;
  const note = str(input.note);
  if (decision === "suspend" && note.length < 5) return { ok: false, error: "Add a reason for the suspension." };
  if (decision === "reject" && note.length < 5) return { ok: false, error: "Tell the organiser why (at least 5 characters)." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_decide_edition_organiser", { p_org: input.organiserId, p_decision: decision, p_note: note || null });
    if (error) return fail(error.message);
    refresh(`/admin/editions/organisers/${input.organiserId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function linkHubAction(input: { organiserId: string; hubId: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.organiserId)) return { ok: false, error: "Unknown organiser." };
  const hub = str(input.hubId);
  if (!isUuid(hub)) return { ok: false, error: "Enter a valid hub id (a UUID)." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_link_edition_organiser_hub", { p_org: input.organiserId, p_hub: hub });
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

/* ── Pilot (administrators only; each action is repeated and enforced by the database, and audited there) ───────────────────────────────────────────────── */

export async function setPilotSwitchAction(input: { on: boolean; note?: string }): Promise<Result> {
  await requireAdmin();
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_set_editions_pilot", { p_on: input.on === true, p_note: str(input.note) || null });
    if (error) return fail(error.message);
    refresh();
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function setupHubOrganiserAction(input: { hubId: string; slug: string; name?: string; note?: string }): Promise<Result> {
  await requireAdmin();
  const hub = str(input.hubId), slug = str(input.slug).toLowerCase();
  if (!isUuid(hub)) return { ok: false, error: "Enter a valid Hub id (a UUID)." };
  if (!isPilotSlug(slug)) return { ok: false, error: "Choose a web address of 3 to 60 lowercase letters, numbers and hyphens." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_create_edition_organiser_for_hub", { p_hub: hub, p_slug: slug, p_name: str(input.name) || null, p_note: str(input.note) || null });
    if (error) return fail(error.message);
    refresh();
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function approvePilotAction(input: { organiserId: string; note?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.organiserId)) return { ok: false, error: "Unknown organiser." };
  const note = str(input.note);
  if (note.length < 5) return { ok: false, error: "Add a note saying why this organiser is approved (at least 5 characters)." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_approve_edition_pilot", { p_org: input.organiserId, p_note: note });
    if (error) return fail(error.message);
    refresh(`/admin/editions/organisers/${input.organiserId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function revokePilotAction(input: { organiserId: string; reason?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.organiserId)) return { ok: false, error: "Unknown organiser." };
  const reason = str(input.reason);
  if (reason.length < 5) return { ok: false, error: "Add a reason (at least 5 characters)." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_revoke_edition_pilot", { p_org: input.organiserId, p_reason: reason });
    if (error) return fail(error.message);
    refresh(`/admin/editions/organisers/${input.organiserId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function grantPilotPublishAction(input: { editionId: string; reason?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.editionId)) return { ok: false, error: "Unknown edition." };
  const reason = str(input.reason);
  if (reason.length < 5) return { ok: false, error: "Add a reason (at least 5 characters)." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_grant_edition_pilot_publish", { p_edition: input.editionId, p_reason: reason, p_days: 90 });
    if (error) return fail(error.message);
    refresh(`/admin/editions/${input.editionId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** Verify, or remove verification from, a Hub. Administrators only; the database function checks again and writes the audit row. */
export async function setHubVerifiedAction(input: { hubId: string; verified: boolean; note?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.hubId)) return { ok: false, error: "Unknown Hub." };
  const note = str(input.note);
  if (note.length < 5) return { ok: false, error: "Add a note saying what you checked (at least 5 characters)." };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_set_hub_verified", { p_hub: input.hubId, p_verified: input.verified === true, p_note: note });
    if (error) return fail(error.message);
    refresh();
    return { ok: true };
  } catch (e) { return fail(e); }
}
