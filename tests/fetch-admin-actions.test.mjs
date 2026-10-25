/**
 * Fetch operations console — the action registry (lib/fetch-admin/actions.ts). Pure; no network.
 * Every action says exactly what will happen, asks for a reason wherever the server requires one, names only real
 * fetch-v2-admin actions, and refuses malformed input before anything is sent.
 * Run: node --test tests/fetch-admin-actions.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { FETCH_ADMIN_ACTIONS, buildAdminRequest, describeCode } from "../lib/fetch-admin/actions.ts";

const ID = "5b8e0a52-7d1c-4f0e-9a3b-2c6d8e1f4a90";
const EDGE = {   // the actions fetch-v2-admin understands, per area (supabase/functions/_shared/fetch-v2-payments.ts handleAdmin; fetch-v2-verification.ts; fetch-v2-photos.ts)
  payments: ["cancel", "return_to_board", "resolve_cancellation", "resolve_return", "retry_capture", "void_hold", "reconcile"],
  drivers: ["review", "decide"],
  support: ["hide_message", "resolve_issue", "remove_photo", "redact_description", "restrict_member", "unrestrict_member"],
};
const SERVER_NEEDS_REASON = ["cancel_job", "return_to_board", "resolve_cancellation", "void_hold", "review_reject", "review_replace", "driver_reject",
  "driver_suspend", "driver_reinstate", "resolve_issue", "hide_message", "remove_photo", "redact_description", "restrict_member", "unrestrict_member"];

describe("registry", () => {
  test("every action calls a real fetch-v2-admin area/action", () => {
    for (const [k, s] of Object.entries(FETCH_ADMIN_ACTIONS)) assert.ok(EDGE[s.area]?.includes(s.action), `${k}: ${s.area}/${s.action}`);
  });
  test("every consequence is specific — never a vague 'Are you sure?'", () => {
    for (const [k, s] of Object.entries(FETCH_ADMIN_ACTIONS)) {
      assert.ok(s.consequence.length >= 50, k);
      assert.doesNotMatch(s.consequence, /are you sure/i, k);
    }
  });
  test("a reason is required wherever the server requires one", () => {
    for (const k of SERVER_NEEDS_REASON) assert.equal(FETCH_ADMIN_ACTIONS[k].reason, "required", k);
  });
  test("consequential actions are marked as such", () => {
    for (const k of ["cancel_job", "return_to_board", "resolve_return", "void_hold", "driver_suspend", "driver_reject", "restrict_member", "remove_photo", "resolve_cancellation"])
      assert.equal(FETCH_ADMIN_ACTIONS[k].tone, "danger", k);
  });
});

describe("buildAdminRequest", () => {
  test("refuses an unknown action, a malformed id, and a missing or too-short reason", () => {
    assert.equal(buildAdminRequest("drop_tables", { target: ID }).ok, false);
    assert.equal(buildAdminRequest("cancel_job", { target: "1 or 1=1", reason: "Duplicate job" }).ok, false);
    assert.match(buildAdminRequest("cancel_job", { target: ID }).error, /reason/);
    assert.match(buildAdminRequest("cancel_job", { target: ID, reason: "  x " }).error, /reason/);
  });
  test("builds exactly the body fetch-v2-admin expects", () => {
    assert.deepEqual(buildAdminRequest("cancel_job", { target: ID, reason: "Prohibited item" }),
      { ok: true, body: { area: "payments", action: "cancel", request_id: ID, reason: "Prohibited item" } });
    assert.deepEqual(buildAdminRequest("review_approve", { target: ID, fields: { expires_on: "2027-05-01" } }).body,
      { area: "drivers", action: "review", item_id: ID, outcome: "approve", expires_on: "2027-05-01" });
    assert.equal(buildAdminRequest("review_replace", { target: ID, reason: "Unreadable" }).body.outcome, "request_replacement");
    assert.deepEqual(buildAdminRequest("driver_suspend", { target: ID, reason: "Complaint" }).body,
      { area: "drivers", action: "decide", driver_id: ID, decision: "suspend", reason: "Complaint" });
    assert.deepEqual(buildAdminRequest("restrict_member", { target: ID, reason: "Repeated releases" }).body,
      { area: "support", action: "restrict_member", member_id: ID, reason: "Repeated releases" });
  });
  test("choices must be real options; money only as whole pence; an override or undetermined fault needs a reason", () => {
    assert.equal(buildAdminRequest("resolve_cancellation", { target: ID, reason: "Agreed", fields: { decision: "refund_everything" } }).ok, false);
    assert.equal(buildAdminRequest("resolve_return", { target: ID, fields: { outcome: "returned_to_sender" } }).ok, false, "fault is required");
    assert.equal(buildAdminRequest("resolve_return", { target: ID, fields: { outcome: "returned_to_sender", fault: "undetermined" } }).ok, false);
    assert.equal(buildAdminRequest("resolve_return", { target: ID, reason: "Unclear", fields: { outcome: "returned_to_sender", fault: "not_driver", override_capture_pence: "12.50" } }).ok, false);
    assert.equal(buildAdminRequest("resolve_return", { target: ID, fields: { outcome: "returned_to_sender", fault: "not_driver", override_capture_pence: "500" } }).ok, false);
    assert.deepEqual(buildAdminRequest("resolve_return", { target: ID, fields: { outcome: "returned_to_sender", fault: "not_driver" } }).body,
      { area: "payments", action: "resolve_return", request_id: ID, outcome: "returned_to_sender", fault: "not_driver" });
    assert.equal(buildAdminRequest("resolve_return", { target: ID, reason: "Split cost", fields: { outcome: "returned_to_sender", fault: "undetermined", override_capture_pence: "500" } }).body.override_capture_pence, 500);
  });
  test("a redaction's replacement text is bounded; empty means the standard wording", () => {
    assert.equal(buildAdminRequest("redact_description", { target: ID, reason: "Phone number", fields: { replacement: "ab" } }).ok, false);
    assert.equal("replacement" in buildAdminRequest("redact_description", { target: ID, reason: "Phone number" }).body, false);
  });
  test("server refusals are explained in words", () => {
    assert.match(describeCode("capture_exceeds_hold"), /Nothing was taken/);
    assert.match(describeCode("weird_code"), /weird_code/);
  });
});
