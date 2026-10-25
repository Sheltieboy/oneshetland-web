/**
 * Fetch operations console — queues, labels, filters and which actions apply (lib/fetch-admin/queues.ts, job-actions.ts). Pure.
 * Run: node --test tests/fetch-admin-queues.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUEUES, REASON_LABEL, byUrgency, formatPence, jobFilters, timeLeft } from "../lib/fetch-admin/queues.ts";
import { driverDecisions, evidenceActions, jobActions } from "../lib/fetch-admin/job-actions.ts";
import { adminAccessFor } from "../lib/admin-access.ts";

test("seven queues, money and items-in-a-van first, each linking to its list", () => {
  assert.deepEqual(QUEUES.map((q) => q.key), ["payments", "returns", "verification_jobs", "cancellations", "issues", "driver_verification", "notifications"]);
  for (const q of QUEUES) assert.match(q.href, /^\/admin\/fetch(\/[a-z]+)?(\?queue=[a-z_]+)?$/);
});
test("every reason code the database produces has words", () => {
  const codes = ["payment_issue_open", "capture_failed", "capture_unresolved", "hold_expiring_after_collection", "return_capture_pending", "void_pending",
    "driver_did_not_respond", "driver_declined", "awaiting_admin_decision", "awaiting_driver", "cannot_deliver", "return_reported", "awaiting_return_report",
    "return_photo", "driver_verification_expired", "driver_verification_incomplete", "driver_suspended", "driver_not_approved", "collection_blocked",
    "already_collected", "new_evidence_waiting", "not_written_to_inbox", "push_retrying", "failed", "provider_error", "invalid_token", "push_unavailable"];
  for (const c of codes) assert.ok(REASON_LABEL[c], c);
});
test("action required first, then the oldest", () => {
  const rows = [{ id: 1, priority: "waiting", updated: "2026-10-20T10:00:00Z" }, { id: 2, priority: "action_required", updated: "2026-10-22T10:00:00Z" },
    { id: 3, priority: "action_required", updated: "2026-10-21T10:00:00Z" }];
  assert.deepEqual(byUrgency(rows).map((r) => r.id), [3, 2, 1]);
});
test("money and time read plainly", () => {
  assert.equal(formatPence(1250), "£12.50"); assert.equal(formatPence(null), "—");
  const now = Date.parse("2026-10-25T12:00:00Z");
  assert.equal(timeLeft("2026-10-25T13:20:00Z", now), "in 1h 20m");
  assert.equal(timeLeft("2026-10-25T09:55:00Z", now), "2h 5m overdue");
});
test("job filters keep only known, well-formed values", () => {
  assert.deepEqual(jobFilters({ status: "collected", queue: "payments", q: "5B8E0A52", from: "2026-10-01", open_issue: "1", junk: "x", requester: "not-an-id",
    driver: "5b8e0a52-7d1c-4f0e-9a3b-2c6d8e1f4a90" }),
    { status: "collected", queue: "payments", q: "5b8e0a52", from: "2026-10-01", open_issue: true, driver: "5b8e0a52-7d1c-4f0e-9a3b-2c6d8e1f4a90" });
  assert.deepEqual(jobFilters({ status: "drop table", q: "' or 1=1" }), {});
});
test("the actions offered follow the job's state (the server still decides)", () => {
  assert.deepEqual(jobActions({ status: "pending" }), ["cancel_job", "redact_description"]);
  assert.deepEqual(jobActions({ status: "matched", cancel_requested_at: "x" }, { payment_intent_id: "pi_1", attempt_status: "authorised" }),
    ["resolve_cancellation", "return_to_board", "cancel_job", "void_hold", "reconcile", "redact_description"]);
  assert.deepEqual(jobActions({ status: "undeliverable" }, { payment_intent_id: "pi_1", attempt_status: "authorised" }),
    ["resolve_return", "retry_capture", "reconcile", "redact_description"], "no hold release while the item is in transit");
  assert.ok(jobActions({ status: "collected" }, { payment_intent_id: "pi_1", capture_state: "failed", attempt_status: "authorised" }).includes("retry_capture"));
  assert.deepEqual(driverDecisions("pending"), ["driver_approve", "driver_reject", "driver_suspend"]);
  assert.deepEqual(driverDecisions("suspended"), ["driver_reinstate"]);
  assert.deepEqual(evidenceActions("submitted"), ["review_approve", "review_reject"]);
  assert.deepEqual(evidenceActions("verified"), ["review_replace"]);
  assert.deepEqual(evidenceActions("superseded"), []);
});
test("only administrators reach the console; signed-out visitors are sent to sign in", () => {
  assert.equal(adminAccessFor(null), "sign_in");
  assert.equal(adminAccessFor({ profile: { role: "customer" } }), "deny");
  assert.equal(adminAccessFor({ profile: { role: "driver" } }), "deny");
  assert.equal(adminAccessFor({ profile: { role: "admin" } }), "allow");
});
