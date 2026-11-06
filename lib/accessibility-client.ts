"use client";

/**
 * accessibility-client.ts — what a signed-in browser writes. Every call runs as the person; the database decides what is allowed
 * (save_accessibility checks the same ownership rules as the rest of the site) and its reason is shown as it is.
 */
import { createClient } from "@/lib/supabase/client";
import type { Fact, SubjectType } from "@/lib/accessibility";

const fail = (e: unknown): never => { throw new Error((e as { message?: string })?.message ?? "Something went wrong. Please try again."); };

export type SaveInput = { summary: string; visit_tips: string; access_contact: string };

export async function saveAccessibility(type: SubjectType, id: string, publish: boolean, p: SaveInput, facts: Fact[], confirm: boolean): Promise<{ published: boolean; facilities: number }> {
  const { data, error } = await createClient().rpc("save_accessibility", {
    p_type: type, p_id: id, p_publish: publish,
    p_profile: { summary: p.summary, visit_tips: p.visit_tips, access_contact: p.access_contact },
    p_facts: facts.map((f) => ({ facility: f.facility, status: f.status, ...(f.detail?.trim() ? { detail: f.detail.trim() } : {}) })),
    p_confirm: confirm,
  });
  if (error) fail(error);
  return data as { published: boolean; facilities: number };
}

export async function submitReport(type: SubjectType, id: string, kind: "incorrect" | "add" | "other", message: string) {
  const { error } = await createClient().from("accessibility_reports").insert({ subject_type: type, subject_id: id, kind, message: message.trim() });
  if (error) fail(error);
}

export type AdminReport = { id: string; subject_type: SubjectType; subject_id: string; subject_label: string | null; kind: string; message: string; status: string; staff_note: string | null; created_at: string; reporter_id: string | null };
export async function adminReports(status: string | null): Promise<AdminReport[]> {
  const { data, error } = await createClient().rpc("admin_accessibility_reports", { p_status: status, p_limit: 100 });
  if (error) fail(error);
  return (data ?? []) as AdminReport[];
}
export async function adminReviewReport(id: string, status: "accepted" | "rejected" | "applied", note: string) {
  const { error } = await createClient().rpc("admin_review_accessibility_report", { p_id: id, p_status: status, p_note: note });
  if (error) fail(error);
}
export async function adminVerify(type: SubjectType, id: string, level: string, note: string, on: string) {
  const { error } = await createClient().rpc("admin_set_accessibility_verification", { p_type: type, p_id: id, p_verification: level, p_note: note || null, p_on: on || null });
  if (error) fail(error);
}
export async function adminHide(type: SubjectType, id: string, hide: boolean, reason: string) {
  const { error } = await createClient().rpc("admin_hide_accessibility", { p_type: type, p_id: id, p_hide: hide, p_reason: reason });
  if (error) fail(error);
}
export type Coverage = { profiles_published: number; profiles_draft: number; claimed_businesses: number; reports_new: number; claimed_without_profile: { id: string; name: string }[] } & Record<string, unknown>;
export async function adminCoverage(): Promise<Coverage> {
  const { data, error } = await createClient().rpc("admin_accessibility_coverage");
  if (error) fail(error);
  return data as Coverage;
}
