/**
 * job-actions.ts — which audited actions make sense for a job in its current state (pure; tested under node).
 * The server still decides: an action offered here can be refused there, and the console shows that answer.
 */
import type { FetchAdminActionId } from "@/lib/fetch-admin/actions";

export function jobActions(s: { status?: string; cancel_requested_at?: string | null },
                           p: { payment_intent_id?: string | null; attempt_status?: string | null; capture_state?: string | null } = {}): FetchAdminActionId[] {
  const a: FetchAdminActionId[] = [];
  const live = s.status === "pending" || s.status === "matched";
  if (s.status === "matched" && s.cancel_requested_at) a.push("resolve_cancellation");
  if (s.status === "undeliverable") a.push("resolve_return");
  if (s.status === "matched") a.push("return_to_board");
  if (live) a.push("cancel_job");
  if (p.capture_state === "failed" || p.capture_state === "unresolved"
      || (p.attempt_status === "authorised" && ["collected", "undeliverable", "returned", "delivered"].includes(s.status ?? ""))) a.push("retry_capture");
  if (p.payment_intent_id && !["terminal", "captured"].includes(p.attempt_status ?? "") && !["collected", "undeliverable"].includes(s.status ?? "")) a.push("void_hold");
  if (p.payment_intent_id) a.push("reconcile");
  a.push("redact_description");
  return a;
}

/** The driver decisions that apply to an account in this state. */
export function driverDecisions(status?: string): FetchAdminActionId[] {
  switch (status) {
    case "pending": return ["driver_approve", "driver_reject", "driver_suspend"];
    case "rejected": return ["driver_approve"];
    case "approved": return ["driver_suspend"];
    case "suspended": return ["driver_reinstate"];
    default: return [];
  }
}

/** The review actions for one piece of evidence. */
export function evidenceActions(status?: string): FetchAdminActionId[] {
  if (status === "submitted") return ["review_approve", "review_reject"];
  if (status === "verified") return ["review_replace"];
  return [];
}
