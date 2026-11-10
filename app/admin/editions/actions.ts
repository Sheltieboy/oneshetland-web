"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { GRANT_FEATURES, ORGANISER_DECISIONS, adminError, autoNote, grantEnd, isUuid, slugProblem, suggestOrganiserSlug, type OrganiserDecision } from "./helpers";

/**
 * Admin actions for Editions. Each starts with requireAdmin() and then runs as the signed-in user (RLS + the SECURITY DEFINER functions check the caller
 * again; nothing here uses a service key). Results are { ok: true } or { ok: false, error }.
 */
export type Result = { ok: true } | { ok: false; error: string };
const fail = (e: unknown): Result => ({ ok: false, error: adminError(e instanceof Error ? e.message : typeof e === "string" ? e : "") });
const refresh = (...paths: string[]) => { for (const p of ["/admin/editions", ...paths]) revalidatePath(p); };
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** The administrator's own name for audit notes (never their email). */
const adminName = (a: { profile: { full_name: string | null; display_name?: string | null } | null }) => a.profile?.full_name?.trim() || a.profile?.display_name?.trim() || "";

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
  const admin = await requireAdmin();
  const on = input.on === true;
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_set_editions_pilot", { p_on: on, p_note: autoNote(on ? "pilot_on" : "pilot_off", adminName(admin), str(input.note)) });
    if (error) return fail(error.message);
    refresh();
    return { ok: true };
  } catch (e) { return fail(e); }
}

export type SetupResult = { ok: true; organiserId: string; slug: string; name: string } | { ok: false; error: string };

/** Is this web address free for an organiser? Used while the administrator edits the suggestion. */
export async function checkOrganiserSlugAction(input: { slug: string }): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const slug = str(input.slug).toLowerCase();
  try {
    const sb = await createClient();
    const { data } = await sb.from("edition_organisers").select("slug").eq("slug", slug).limit(1);
    const taken = ((data ?? []) as { slug: string }[]).map((r) => r.slug);
    const problem = slugProblem(slug, taken);
    return problem ? { ok: false, message: problem } : { ok: true, message: "Available." };
  } catch { return { ok: false, message: "Could not check the address. Try again." }; }
}

/**
 * Set up the Editions organiser for a Hub. The administrator picks the Hub; its name is read here (never typed), the address is suggested and checked, and the audit
 * note is written for them. This only creates the verified organiser: it does not approve the pilot, grant publishing or publish anything.
 */
export async function setupHubOrganiserAction(input: { hubId: string; slug?: string; name?: string; note?: string }): Promise<SetupResult> {
  const admin = await requireAdmin();
  const hubId = str(input.hubId);
  if (!isUuid(hubId)) return { ok: false, error: "Choose a Hub from the list." };
  try {
    const sb = await createClient();
    const { data: hub } = await sb.from("hubs").select("id, name, is_active").eq("id", hubId).maybeSingle();
    if (!hub || !hub.is_active) return { ok: false, error: "That Hub was not found or is not active." };
    const { data: existing } = await sb.from("edition_organisers").select("id, name").eq("hub_id", hubId).neq("status", "rejected").limit(1);
    if (existing?.length) return { ok: false, error: `${hub.name} already has an Editions organiser (${existing[0].name}). Open it instead of creating another.` };
    const { data: slugs } = await sb.from("edition_organisers").select("slug").limit(5000);
    const taken = ((slugs ?? []) as { slug: string }[]).map((r) => r.slug);
    const name = str(input.name) || hub.name;
    const slug = (str(input.slug) || suggestOrganiserSlug(name, taken)).toLowerCase();
    const problem = slugProblem(slug, taken);
    if (problem) return { ok: false, error: problem };
    const { data, error } = await sb.rpc("admin_create_edition_organiser_for_hub", { p_hub: hubId, p_slug: slug, p_name: name, p_note: autoNote("hub_setup", adminName(admin), str(input.note), hub.name) });
    if (error) return { ok: false, error: adminError(error.message) };
    refresh();
    return { ok: true, organiserId: String(data), slug, name };
  } catch (e) { return { ok: false, error: adminError(e instanceof Error ? e.message : "") }; }
}

export async function approvePilotAction(input: { organiserId: string; note?: string }): Promise<Result> {
  const admin = await requireAdmin();
  if (!isUuid(input.organiserId)) return { ok: false, error: "Unknown organiser." };
  const note = autoNote("approve", adminName(admin), str(input.note));
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_approve_edition_pilot", { p_org: input.organiserId, p_note: note });
    if (error) return fail(error.message);
    refresh(`/admin/editions/organisers/${input.organiserId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function revokePilotAction(input: { organiserId: string; reason?: string }): Promise<Result> {
  const admin = await requireAdmin();
  if (!isUuid(input.organiserId)) return { ok: false, error: "Unknown organiser." };
  const reason = autoNote("revoke", adminName(admin), str(input.reason));
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_revoke_edition_pilot", { p_org: input.organiserId, p_reason: reason });
    if (error) return fail(error.message);
    refresh(`/admin/editions/organisers/${input.organiserId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function grantPilotPublishAction(input: { editionId: string; reason?: string }): Promise<Result> {
  const admin = await requireAdmin();
  if (!isUuid(input.editionId)) return { ok: false, error: "Unknown edition." };
  const reason = autoNote("grant", adminName(admin), str(input.reason));
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
  const admin = await requireAdmin();
  if (!isUuid(input.hubId)) return { ok: false, error: "Unknown Hub." };
  try {
    const sb = await createClient();
    const { data: hub } = await sb.from("hubs").select("name").eq("id", input.hubId).maybeSingle();
    const note = autoNote(input.verified === true ? "hub_verify" : "hub_unverify", adminName(admin), str(input.note), hub?.name ?? "the Hub");
    const { error } = await sb.rpc("admin_set_hub_verified", { p_hub: input.hubId, p_verified: input.verified === true, p_note: note });
    if (error) return fail(error.message);
    refresh();
    return { ok: true };
  } catch (e) { return fail(e); }
}
