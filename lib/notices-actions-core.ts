/**
 * notices-actions-core.ts — what the Notices & Alerts server actions are allowed to do, kept pure and injectable so it can be tested.
 *
 * Every write goes through ONE allow-list: a function name that is not listed, or an argument that is not one of its named parameters, is refused
 * before anything is sent. The calls run on the SIGNED-IN USER'S OWN session, so the database (security-definer functions that check auth.uid() and
 * the caller's authority) is what authorises - there is no service-role path in this app code, and a refusal is returned to the page in the
 * database's own words, never swallowed.
 */
import { callRpc, type RpcClient, type RpcResult } from "./notices-rpc";

export const WRITE_RPCS: Record<string, readonly string[]> = {
  // member
  set_my_notice_areas: ["p_areas"],
  // members' own notices (moderated)
  submit_person_notice: ["p_title", "p_body", "p_category", "p_area_ids", "p_expires_at"],
  edit_my_person_notice: ["p_notice", "p_title", "p_body", "p_category", "p_area_ids", "p_expires_at"],
  withdraw_my_person_notice: ["p_notice"],
  // staff moderation of members' notices
  staff_approve_person_notice: ["p_notice"],
  staff_decline_person_notice: ["p_notice", "p_reason"],
  set_my_notice_prefs: ["p_essential", "p_official", "p_community", "p_categories", "p_funeral", "p_all_community_categories"],
  // funeral (family / funeral director)
  submit_funeral_notice: ["p"],
  update_my_funeral_submission: ["p_id", "p"],
  withdraw_my_funeral_notice: ["p_id"],
  request_funeral_notice_change: ["p_id", "p_kind", "p_message", "p_contact"],
  // NOTE: submit_funeral_enquiry is deliberately NOT here. It is service-role only; visitors use the submit-funeral-enquiry Edge Function (lib/funeral-enquiry-client.ts).
  // verified organisations
  official_publish_notice: ["p_publisher", "p_title", "p_body", "p_category", "p_area_ids", "p_expires_at", "p_starts_at", "p_link_url", "p_action_text", "p_is_essential", "p_review_at"],
  official_update_notice: ["p_notice", "p_title", "p_body", "p_category", "p_area_ids", "p_expires_at", "p_link_url", "p_action_text", "p_is_essential", "p_review_at"],
  official_set_notice_status: ["p_notice", "p_status"],
  // platform administration (the database allows administrators; funeral_* also moderators)
  admin_upsert_official_publisher: ["p_slug", "p_name", "p_kind", "p_website_url", "p_import_source"],
  admin_verify_official_publisher: ["p_publisher", "p_note"],
  admin_set_official_publisher_active: ["p_publisher", "p_active"],
  admin_set_official_publisher_member: ["p_publisher", "p_user", "p_role", "p_active"],
  admin_grant_essential_alert: ["p_publisher", "p_reason"],
  admin_revoke_essential_alert: ["p_publisher", "p_reason"],
  admin_funeral_review: ["p_id", "p_action", "p_note", "p_verification_method", "p_verification_outcome", "p_followup", "p_rejection_code"],
  admin_funeral_takedown: ["p_id", "p_reason"],
  admin_funeral_resolve_change: ["p_request", "p_outcome", "p_note", "p_correction", "p_authority_check"],
  admin_log_funeral_enquiry: ["p_id", "p_kind", "p_message", "p_contact", "p_contact_name", "p_relationship"],
  admin_set_funeral_retention_hold: ["p_id", "p_hold", "p_reason"],
  admin_set_funeral_retention_enabled: ["p_enabled", "p_note"],
  admin_redact_audit_text: ["p_audit_id", "p_keys", "p_reason"],
  admin_set_import_source_enabled: ["p_id", "p_enabled", "p_reuse_note"],
  manage_set_notice_status: ["p_notice", "p_status"],
};

/** Reads the admin screens make on demand from the browser (lists load on the server). Same rule: named functions, named parameters. */
export const READ_RPCS: Record<string, readonly string[]> = {
  admin_list_official_publisher_members: ["p_publisher"],
  admin_notice_dispatch_history: ["p_notice"],
  staff_member_notice_preview: ["p_notice"],            // staff-only in the database; counts and text, never a recipient
  admin_funeral_retention_report: [],
  admin_audit_redaction_candidates: ["p_months"],
  admin_audit_redactions: ["p_limit"],
};

export function isAllowedWrite(fn: string, args: Record<string, unknown>): string | null {
  const allowed = WRITE_RPCS[fn];
  if (!allowed) return "That action is not available.";
  const extra = Object.keys(args).filter((k) => !allowed.includes(k));
  return extra.length ? "That action is not available." : null;
}

export async function runWrite(sb: RpcClient, fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const refused = isAllowedWrite(fn, args);
  if (refused) return { ok: false, error: refused };
  return callRpc(sb, fn, args);
}

/** The two things that need a reason / note must have one before anything is sent (the server requires them too). */
export function requireText(value: unknown, what: string, min = 1): string | null {
  return typeof value === "string" && value.trim().length >= min ? null : `${what} is required.`;
}

/** Revoking the Essential Alert entitlement demotes the organisation's live alerts: the admin must give a reason first. */
export async function revokeEssential(sb: RpcClient, publisher: string, reason: string): Promise<RpcResult> {
  const e = requireText(reason, "A reason");
  if (e) return { ok: false, error: e };
  return runWrite(sb, "admin_revoke_essential_alert", { p_publisher: publisher, p_reason: reason.trim() });
}

/**
 * A note is SUPPLEMENTARY: it must not carry a telephone number or email address (the database refuses it too). How the announcement was verified is recorded
 * in structured fields (method, outcome, reviewer, date); the family's contact details stay in the restricted submission, not in free text.
 */
export function noteHasContact(text: string | null | undefined): boolean {
  const t = text ?? "";
  return /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(t) || /(\+?[0-9][0-9 ().-]{7,}[0-9])/.test(t);
}
export const NOTE_CONTACT_MESSAGE = "Please don't put telephone numbers or email addresses in a note: record how it was verified using the options above.";

/** Approve needs HOW it was verified (a structured method); the outcome is "confirmed" by approving; a short note is optional. */
export async function approveFuneral(sb: RpcClient, id: string, method: string, note: string, followup = "none"): Promise<RpcResult> {
  if (!method) return { ok: false, error: "Record how the announcement was verified before approving." };
  if (noteHasContact(note)) return { ok: false, error: NOTE_CONTACT_MESSAGE };
  return runWrite(sb, "admin_funeral_review", { p_id: id, p_action: "approve", p_note: note.trim() || null, p_verification_method: method, p_verification_outcome: "confirmed", p_followup: followup });
}

/** Turning an import source on is a deliberate act that needs a reuse note (what permits republishing this feed). */
export async function enableImportSource(sb: RpcClient, id: string, note: string): Promise<RpcResult> {
  const e = requireText(note, "A reuse note (what permits republishing this source)", 10);
  if (e) return { ok: false, error: e };
  return runWrite(sb, "admin_set_import_source_enabled", { p_id: id, p_enabled: true, p_reuse_note: note.trim() });
}

export async function runRead(sb: RpcClient, fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const allowed = READ_RPCS[fn];
  if (!allowed || Object.keys(args).some((k) => !allowed.includes(k))) return { ok: false, error: "That action is not available." };
  return callRpc(sb, fn, args);
}
