"use server";

/**
 * Server actions for the Launch Test Centre.
 *
 * Every action re-checks who is calling and then calls a database function that checks AGAIN (auth.uid() ownership for testers, the
 * administrator gate for admins). Nothing here uses a service-role key, calls a payment provider, or touches wallet, order or ledger tables.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-data.server";
import type { DeviceClass, Platform } from "./types";
import { isPlatform } from "./platform";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Database errors raised on purpose carry a safe, human message; anything else becomes a generic one. */
const SAFE_CODES = new Set(["42501", "22023", "P0002", "55000", "23505", "23514"]);
function fail(e: unknown): { ok: false; error: string } {
  const err = e as { code?: string; message?: string } | null;
  const msg = err?.message ?? "";
  if (err?.code && SAFE_CODES.has(err.code) && msg && msg.length < 240) {
    if (err.code === "23505") return { ok: false, error: "That has already been added." };
    if (err.code === "23514") return { ok: false, error: "One of those values is not allowed. Please check and try again." };
    return { ok: false, error: msg };
  }
  console.error("[launch-testing] action failed:", msg || e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const platformOk = (p: unknown): p is Platform => isPlatform(p);
const classOk = (c: unknown): c is DeviceClass => c === "desktop" || c === "mobile" || c === "tablet";

async function signedInClient() {
  const account = await getAccount();
  if (!account) return null;
  return createClient();
}

// ── tester ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type OpenSessionInput = {
  programmeId: string; platform: Platform; build?: string; device?: string;
  /** Website sessions only: coarse, non-identifying browser facts. Ignored (and nulled) for the apps. */
  browser?: string; deviceClass?: DeviceClass | null; viewport?: string;
};

export async function openSessionAction(input: OpenSessionInput): Promise<Result<{ sessionId: string }>> {
  const sb = await signedInClient();
  if (!sb) return { ok: false, error: "Please sign in again." };
  if (!isUuid(input.programmeId) || !platformOk(input.platform)) return { ok: false, error: "Choose Website, iPhone or Android." };
  const { data, error } = await sb.rpc("launch_test_open_session", { p_programme: input.programmeId, p_platform: input.platform, p_build: input.build ?? null, p_device: input.device ?? null,
    p_browser: input.platform === "web" ? (input.browser ?? null) : null,
    p_device_class: input.platform === "web" && classOk(input.deviceClass) ? input.deviceClass : null,
    p_viewport: input.platform === "web" && typeof input.viewport === "string" && /^[0-9]{2,5}x[0-9]{2,5}$/.test(input.viewport) ? input.viewport : null });
  if (error) return fail(error);
  revalidatePath("/launch-testing");
  return { ok: true, sessionId: data as string };
}

export async function startAttemptAction(input: { testId: string; sessionId: string; acknowledged: boolean }): Promise<Result<{ attemptId: string }>> {
  const sb = await signedInClient();
  if (!sb) return { ok: false, error: "Please sign in again." };
  if (!isUuid(input.testId) || !isUuid(input.sessionId)) return { ok: false, error: "That test is not available." };
  const { data, error } = await sb.rpc("launch_test_start", { p_test: input.testId, p_session: input.sessionId, p_ack: input.acknowledged === true });
  if (error) return fail(error);
  revalidatePath("/launch-testing", "layout");
  return { ok: true, attemptId: data as string };
}

export async function submitAttemptAction(input: { attemptId: string; status: "passed" | "issue" | "blocked"; note?: string; issue?: string }): Promise<Result> {
  const sb = await signedInClient();
  if (!sb) return { ok: false, error: "Please sign in again." };
  if (!isUuid(input.attemptId)) return { ok: false, error: "That test is not available." };
  const { error } = await sb.rpc("launch_test_submit", { p_attempt: input.attemptId, p_status: input.status, p_note: input.note ?? null, p_issue: input.issue ?? null });
  if (error) return fail(error);
  revalidatePath("/launch-testing", "layout");
  return { ok: true };
}

/** The picture itself is uploaded by the browser straight into the private bucket (the database policy allows only the owner's attempt folder); this records it. */
export async function registerAttachmentAction(input: { attemptId: string; path: string; mime: string; size: number }): Promise<Result<{ id: string }>> {
  const sb = await signedInClient();
  if (!sb) return { ok: false, error: "Please sign in again." };
  if (!isUuid(input.attemptId) || typeof input.path !== "string" || !Number.isInteger(input.size)) return { ok: false, error: "That picture could not be saved." };
  const { data, error } = await sb.rpc("launch_test_add_attachment", { p_attempt: input.attemptId, p_path: input.path, p_mime: input.mime, p_size: input.size });
  if (error) return fail(error);
  revalidatePath("/launch-testing", "layout");
  return { ok: true, id: data as string };
}

// ── administrator ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function addTesterAction(input: { programmeId: string; email: string; platforms: Platform[]; notes?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.programmeId)) return { ok: false, error: "Choose a programme." };
  const sb = await createClient();
  const { error } = await sb.rpc("launch_test_admin_add_tester", { p_programme: input.programmeId, p_email: input.email.trim(), p_platforms: input.platforms.filter(platformOk), p_notes: input.notes ?? null });
  if (error) return fail(error);
  revalidatePath("/admin/launch-testing", "layout");
  return { ok: true };
}

export async function updateTesterAction(input: { testerId: string; enabled: boolean; platforms: Platform[]; notes: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.testerId)) return { ok: false, error: "No such tester." };
  const sb = await createClient();
  const { error } = await sb.rpc("launch_test_admin_update_tester", { p_tester: input.testerId, p_enabled: input.enabled, p_platforms: input.platforms.filter(platformOk), p_notes: input.notes });
  if (error) return fail(error);
  revalidatePath("/admin/launch-testing", "layout");
  return { ok: true };
}

export type TestPatch = Partial<{
  title: string; category: string; purpose: string; steps: string[]; web_steps: string[] | null; expected_outcome: string; priority: string; mandatory: boolean;
  platform: string; sort_order: number; active: boolean; target_url: string | null; target_note: string | null; money_test_type: string;
  expected_max_spend_pence: number | null; help_text: string | null; effort_minutes: number | null;
}>;

export async function updateTestAction(testId: string, patch: TestPatch): Promise<Result> {
  await requireAdmin();
  if (!isUuid(testId)) return { ok: false, error: "No such test." };
  const sb = await createClient();
  const { error } = await sb.rpc("launch_test_admin_update_test", { p_test: testId, p_patch: patch });
  if (error) return fail(error);
  revalidatePath("/admin/launch-testing", "layout");
  revalidatePath("/launch-testing", "layout");
  return { ok: true };
}

export async function updateProgrammeAction(programmeId: string, patch: Partial<{ name: string; description: string; status: string; expected_ios_build: string; expected_android_version: string }>): Promise<Result> {
  await requireAdmin();
  if (!isUuid(programmeId)) return { ok: false, error: "No such programme." };
  const sb = await createClient();
  const { error } = await sb.rpc("launch_test_admin_update_programme", { p_programme: programmeId, p_patch: patch });
  if (error) return fail(error);
  revalidatePath("/admin/launch-testing", "layout");
  revalidatePath("/launch-testing", "layout");
  return { ok: true };
}

export async function reviewAttemptAction(attemptId: string, state: string, note: string): Promise<Result> {
  await requireAdmin();
  if (!isUuid(attemptId)) return { ok: false, error: "No such result." };
  const sb = await createClient();
  const { error } = await sb.rpc("launch_test_admin_review", { p_attempt: attemptId, p_state: state, p_note: note });
  if (error) return fail(error);
  revalidatePath("/admin/launch-testing", "layout");
  return { ok: true };
}

export async function requestRetestAction(attemptId: string, note: string): Promise<Result> {
  await requireAdmin();
  if (!isUuid(attemptId)) return { ok: false, error: "No such result." };
  const sb = await createClient();
  const { error } = await sb.rpc("launch_test_admin_request_retest", { p_attempt: attemptId, p_note: note });
  if (error) return fail(error);
  revalidatePath("/admin/launch-testing", "layout");
  revalidatePath("/launch-testing", "layout");
  return { ok: true };
}
