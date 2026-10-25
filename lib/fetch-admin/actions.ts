/**
 * actions.ts — every action the Fetch operations console can take, in one place (docs/FETCH_V2_IMPLEMENTATION.md, Step 10).
 *
 * Pure (no React, no Supabase) so tests run it under plain node. Each action names the fetch-v2-admin area and action it calls, says
 * exactly what will happen (never a vague confirmation), and whether the server requires a reason. buildAdminRequest() turns what the
 * administrator chose into the request body, refusing anything malformed before it leaves the server action. Money is never typed
 * free-form except the one return-override the server validates against the hold.
 */

export type AdminArea = "payments" | "drivers" | "support";
export type ActionField =
  | { name: "decision"; label: string; options: { value: string; label: string }[] }
  | { name: "outcome"; label: string; options: { value: string; label: string }[] }
  | { name: "fault"; label: string; options: { value: string; label: string }[] }
  | { name: "expires_on"; label: string; kind: "date"; optional?: boolean }
  | { name: "override_capture_pence"; label: string; kind: "pence"; optional: true }
  | { name: "replacement"; label: string; kind: "text"; optional: true };

export interface ActionSpec {
  area: AdminArea;
  action: string;
  target: "request_id" | "driver_id" | "item_id" | "issue_id" | "message_id" | "photo_id" | "member_id";
  label: string;
  consequence: string;
  reason: "required" | "optional" | "none";
  tone: "danger" | "normal";
  fields?: ActionField[];
}

export const FETCH_ADMIN_ACTIONS = {
  cancel_job: { area: "payments", action: "cancel", target: "request_id", label: "Cancel this job", tone: "danger", reason: "required",
    consequence: "The job is cancelled for both people. Any card hold is released; nothing is charged. This cannot be undone." },
  return_to_board: { area: "payments", action: "return_to_board", target: "request_id", label: "Return to the board", tone: "danger", reason: "required",
    consequence: "The driver is taken off this job and it goes back on the board for other drivers. Their card hold is released; the driver is not counted as having released it." },
  resolve_cancellation: { area: "payments", action: "resolve_cancellation", target: "request_id", label: "Decide the cancellation request", tone: "danger", reason: "required",
    consequence: "Cancel: the job ends and any hold is released. Keep: the job goes ahead and the request is closed. Both people are told.",
    fields: [{ name: "decision", label: "Decision", options: [{ value: "cancel", label: "Cancel the job" }, { value: "keep", label: "Keep the job" }] }] },
  resolve_return: { area: "payments", action: "resolve_return", target: "request_id", label: "Resolve the return", tone: "danger", reason: "optional",
    consequence: "Records what happened to the item and who was at fault. Not the driver's fault: the requester is charged the delivery plus the return mileage (one £1.50 fee). The driver's fault: nothing is charged. An override amount must stay within the card hold and needs a reason.",
    fields: [
      { name: "outcome", label: "What happened to the item", options: [{ value: "returned_to_sender", label: "Returned to the sender" },
        { value: "retained_for_collection", label: "Kept for collection" }, { value: "disposed_with_consent", label: "Disposed of with consent" }] },
      { name: "fault", label: "Fault", options: [{ value: "not_driver", label: "Not the driver's fault" }, { value: "driver", label: "The driver's fault" },
        { value: "undetermined", label: "Undetermined (reason required)" }] },
      { name: "override_capture_pence", label: "Override amount in pence (optional)", kind: "pence", optional: true }] },
  retry_capture: { area: "payments", action: "retry_capture", target: "request_id", label: "Retry the payment capture", tone: "normal", reason: "none",
    consequence: "Asks Stripe again to take the amount owed from the existing hold. Nothing above the hold is ever taken; a failure stays on this page." },
  void_hold: { area: "payments", action: "void_hold", target: "request_id", label: "Release the card hold", tone: "danger", reason: "required",
    consequence: "Cancels the card hold at Stripe. Refused while the item is in transit. Use only for a hold left behind by a finished or cancelled job." },
  reconcile: { area: "payments", action: "reconcile", target: "request_id", label: "Refresh from Stripe", tone: "normal", reason: "none",
    consequence: "Reads the payment's current state from Stripe and records it. Changes nothing at Stripe." },
  review_approve: { area: "drivers", action: "review", target: "item_id", label: "Accept this document", tone: "normal", reason: "optional",
    consequence: "Marks the document as checked. Where the requirement has an expiry, enter the date printed on the document; the driver is reminded before it.",
    fields: [{ name: "expires_on", label: "Expiry date on the document", kind: "date", optional: true }] },
  review_reject: { area: "drivers", action: "review", target: "item_id", label: "Reject this document", tone: "danger", reason: "required",
    consequence: "The document is marked as not accepted and the driver is told why (your reason is shown to them). They can upload another." },
  review_replace: { area: "drivers", action: "review", target: "item_id", label: "Ask for a replacement", tone: "danger", reason: "required",
    consequence: "The document stops counting at once and the driver is asked for a new one (your reason is shown to them). If it was their last valid copy, they cannot take new jobs until it is replaced." },
  driver_approve: { area: "drivers", action: "decide", target: "driver_id", label: "Approve the driver", tone: "normal", reason: "optional",
    consequence: "The driver can take Fetch jobs once their payouts are set up. Refused unless every required document is accepted and in date." },
  driver_reject: { area: "drivers", action: "decide", target: "driver_id", label: "Reject the application", tone: "danger", reason: "required",
    consequence: "The application is declined and the driver is told. They may apply again later." },
  driver_suspend: { area: "drivers", action: "decide", target: "driver_id", label: "Suspend the driver", tone: "danger", reason: "required",
    consequence: "The driver cannot take or collect any new job, and cannot re-apply their way back. Jobs they already hold are not changed — handle those from each job's page." },
  driver_reinstate: { area: "drivers", action: "decide", target: "driver_id", label: "Reinstate the driver", tone: "normal", reason: "required",
    consequence: "The driver can take jobs again, provided every required document is still accepted and in date." },
  resolve_issue: { area: "support", action: "resolve_issue", target: "issue_id", label: "Resolve the issue", tone: "normal", reason: "required",
    consequence: "Closes the issue with your outcome, which the person who reported it can read. A resolved issue cannot be reopened." },
  hide_message: { area: "support", action: "hide_message", target: "message_id", label: "Hide this message", tone: "danger", reason: "required",
    consequence: "Both people stop seeing the message's text; it shows as removed. The original stays visible to administrators only." },
  remove_photo: { area: "support", action: "remove_photo", target: "photo_id", label: "Remove this photo", tone: "danger", reason: "required",
    consequence: "The photo is removed from both people's view and from the board. If it was delivery or return evidence, it no longer counts as evidence. Administrators can still open it." },
  redact_description: { area: "support", action: "redact_description", target: "request_id", label: "Redact the item description", tone: "danger", reason: "required",
    consequence: "Replaces the description everyone sees (drivers on the board, the requester, the assigned driver). The original is kept for administrators only. Leave the new text empty to show 'Description removed by OneShetland'.",
    fields: [{ name: "replacement", label: "New description (optional, 3–140 characters)", kind: "text", optional: true }] },
  restrict_member: { area: "support", action: "restrict_member", target: "member_id", label: "Restrict from Fetch", tone: "danger", reason: "required",
    consequence: "From now on they cannot ask for, accept, or offer any Fetch job, or see the driver board. Their OneShetland account is otherwise unchanged, and jobs already in progress are not changed." },
  unrestrict_member: { area: "support", action: "unrestrict_member", target: "member_id", label: "Lift the Fetch restriction", tone: "normal", reason: "required",
    consequence: "They can use Fetch again, subject to the usual checks." },
} as const satisfies Record<string, ActionSpec>;

export type FetchAdminActionId = keyof typeof FETCH_ADMIN_ACTIONS;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type BuiltRequest = { ok: true; body: Record<string, unknown> } | { ok: false; error: string };

/** The request body for fetch-v2-admin, or why it cannot be sent. */
export function buildAdminRequest(id: string, input: { target: string; reason?: string; fields?: Record<string, string> }): BuiltRequest {
  const spec = (FETCH_ADMIN_ACTIONS as Record<string, ActionSpec>)[id];
  if (!spec) return { ok: false, error: "Unknown action." };
  if (!UUID.test(input.target ?? "")) return { ok: false, error: "That record could not be identified." };
  const reason = (input.reason ?? "").trim();
  if (spec.reason === "required" && reason.length < 3) return { ok: false, error: "Please give a reason (at least 3 characters)." };
  if (reason.length > 1000) return { ok: false, error: "The reason is too long (1000 characters at most)." };
  const body: Record<string, unknown> = { area: spec.area, action: spec.action, [spec.target]: input.target };
  if (reason) body.reason = reason;
  if (id === "review_approve") body.outcome = "approve";
  if (id === "review_reject") body.outcome = "reject";
  if (id === "review_replace") body.outcome = "request_replacement";
  if (id.startsWith("driver_")) body.decision = id.slice("driver_".length);
  for (const f of spec.fields ?? []) {
    const v = (input.fields?.[f.name] ?? "").trim();
    if (!v) { if ("optional" in f && f.optional) continue; return { ok: false, error: `Please choose: ${f.label}.` }; }
    if ("options" in f) {
      if (!f.options.some((o) => o.value === v)) return { ok: false, error: `${f.label}: not a valid choice.` };
      body[f.name] = v;
    } else if (f.kind === "date") {
      if (!DATE.test(v) || Number.isNaN(Date.parse(v))) return { ok: false, error: `${f.label}: use a date.` };
      body[f.name] = v;
    } else if (f.kind === "pence") {
      if (!/^\d{1,7}$/.test(v)) return { ok: false, error: `${f.label}: whole pence only.` };
      body[f.name] = Number(v);
    } else {
      if (v.length < 3 || v.length > 140) return { ok: false, error: `${f.label}: 3–140 characters.` };
      body[f.name] = v;
    }
  }
  if (id === "resolve_return" && (body.fault === "undetermined" || body.override_capture_pence !== undefined) && reason.length < 3) {
    return { ok: false, error: "An undetermined fault or an override amount needs a reason." };
  }
  return { ok: true, body };
}

/** What the server's refusal codes mean, in words for an administrator. */
export const SERVER_CODES: Record<string, string> = {
  forbidden: "Only an administrator can do that.", reason_required: "The server needs a reason for this.", resolution_required: "Please write the outcome.",
  not_found: "That record no longer exists.", invalid_request: "The server did not accept those details.", invalid_state: "The job or record has moved on; refresh the page.",
  invalid_transition: "That is not possible from the job's current state; refresh the page.", item_in_transit: "The item is in transit; the hold cannot be released now.",
  capture_exceeds_hold: "More is owed than the card hold allows. Nothing was taken; this needs a decision outside the hold.",
  capture_failed: "Stripe refused the capture. Nothing was taken.", capture_pending: "Stripe did not answer. Try again in a moment; it will not be taken twice.",
  payment_not_ready: "The payment is not in a state that allows this.", override_reason_required: "An override or undetermined fault needs a reason.",
  override_out_of_range: "The override must be within the card hold.", evidence_incomplete: "Not every required document is accepted and in date.",
  expiry_required: "This document needs its expiry date.", expiry_out_of_range: "That expiry date is not valid.", cannot_review_own: "You cannot review your own driver record.",
  cannot_restrict_self: "You cannot restrict your own account.", driver_vehicle_missing: "The driver has not given their vehicle yet.", file_deleted: "The file has been deleted.",
  rate_limited: "Too many actions in a short time. Wait a moment.", server_error: "Something went wrong. Nothing was confirmed; refresh to check.",
};
export const describeCode = (code: unknown) => (typeof code === "string" && SERVER_CODES[code]) || `The server refused this (${String(code ?? "unknown")}).`;
