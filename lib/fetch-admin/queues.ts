/**
 * queues.ts — the Fetch operations queues and the words for their states (docs/FETCH_V2_IMPLEMENTATION.md, Step 10).
 * Pure; tested under plain node. The membership of each queue is the database's (fetch_v2_admin_queues); this only presents it.
 */

export type Priority = "action_required" | "waiting";
export type QueueKey = "payments" | "returns" | "verification_jobs" | "cancellations" | "issues" | "driver_verification" | "notifications";

/** In the order an administrator should look at them: money and items in someone's van first. */
export const QUEUES: { key: QueueKey; title: string; blurb: string; href: string }[] = [
  { key: "payments", title: "Payment problems", blurb: "Failed captures, holds lapsing after collection, returns to charge, holds left behind.", href: "/admin/fetch/jobs?queue=payments" },
  { key: "returns", title: "Cannot deliver / returns", blurb: "Items that could not be delivered and need a return decision.", href: "/admin/fetch/jobs?queue=returns" },
  { key: "verification_jobs", title: "Verification problems on live jobs", blurb: "A driver's documents lapsed while they hold a job.", href: "/admin/fetch/jobs?queue=verification_jobs" },
  { key: "cancellations", title: "Cancellation decisions", blurb: "Requests to cancel that the driver has not answered or declined.", href: "/admin/fetch/jobs?queue=cancellations" },
  { key: "issues", title: "Open issues", blurb: "Problems reported by requesters, drivers or the system.", href: "/admin/fetch/issues" },
  { key: "driver_verification", title: "Driver verification", blurb: "Applications and documents waiting for review.", href: "/admin/fetch/drivers" },
  { key: "notifications", title: "Stuck notifications", blurb: "Notices not written to the inbox, or pushes failing.", href: "/admin/fetch/notifications" },
];

export const PRIORITY_LABEL: Record<Priority, { label: string; tone: "red" | "amber" }> = {
  action_required: { label: "Action required", tone: "red" },
  waiting: { label: "Waiting", tone: "amber" },
};

export const REASON_LABEL: Record<string, string> = {
  payment_issue_open: "Payment issue open", capture_failed: "Capture failed", capture_unresolved: "Capture outcome unknown",
  hold_expiring_after_collection: "Card hold lapsing after collection", return_capture_pending: "Return charge not yet taken",
  void_pending: "Card hold left behind", driver_did_not_respond: "Driver did not respond in time", driver_declined: "Driver declined",
  awaiting_admin_decision: "Needs an admin decision", awaiting_driver: "Waiting for the driver", cannot_deliver: "Could not be delivered",
  return_reported: "Return reported by the driver", awaiting_return_report: "Waiting for the driver's return report", return_photo: "Return photo provided",
  driver_verification_expired: "Driver's documents expired", driver_verification_incomplete: "Driver's documents incomplete",
  driver_suspended: "Driver suspended", driver_not_approved: "Driver not approved", collection_blocked: "Collection blocked",
  already_collected: "Item already collected", new_evidence_waiting: "New document waiting for review",
  not_written_to_inbox: "Not written to the inbox", push_retrying: "Push being retried", failed: "Failed", provider_error: "Push provider refused",
  invalid_token: "Device no longer registered", push_unavailable: "Push not set up on the device",
};
export const reasonLabel = (code: string) => REASON_LABEL[code] ?? code.replace(/_/g, " ");

export const STATUS_LABEL: Record<string, string> = {
  pending: "Open", matched: "Accepted", collected: "Collected", delivered: "Delivered", undeliverable: "Could not deliver",
  returned: "Returned", cancelled: "Cancelled", expired: "Expired",
};

/** Action required first, then the oldest; stable. */
export function byUrgency<T extends { priority?: string; updated?: string | null; opened_at?: string | null; created_at?: string | null }>(rows: T[]): T[] {
  const t = (r: T) => Date.parse(r.updated ?? r.opened_at ?? r.created_at ?? "") || 0;
  return [...rows].sort((a, b) => (a.priority === b.priority ? t(a) - t(b) : a.priority === "action_required" ? -1 : 1));
}

export function formatPence(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  return `£${(p / 100).toFixed(2)}`;
}

/** "in 1h 20m" / "2h 5m overdue" against now. */
export function timeLeft(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const ms = Date.parse(iso) - now;
  const m = Math.round(Math.abs(ms) / 60000);
  const text = m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  return ms >= 0 ? `in ${text}` : `${text} overdue`;
}

/** The job-list filters an administrator may use, read from the URL. Anything else is dropped. */
export function jobFilters(sp: Record<string, string | string[] | undefined>): Record<string, string | boolean> {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const f: Record<string, string | boolean> = {};
  const status = one("status"); if (status && status in STATUS_LABEL) f.status = status;
  const queue = one("queue"); if (QUEUES.some((q) => q.key === queue)) f.queue = queue;
  for (const k of ["requester", "driver"]) { const v = one(k); if (/^[0-9a-f-]{36}$/i.test(v)) f[k] = v; }
  for (const k of ["from", "to"]) { const v = one(k); if (/^\d{4}-\d{2}-\d{2}$/.test(v)) f[k] = v; }
  const q = one("q").toLowerCase(); if (/^[0-9a-f-]{4,36}$/.test(q)) f.q = q;
  for (const k of ["open_issue", "payment_problem", "return_state", "cancellation"]) if (one(k) === "1") f[k] = true;
  return f;
}
