/**
 * Regression: a real launch partner whose invitation "wouldn't generate", and an Admin button that stayed dead.
 *
 * What happened (Avril Thomson-Smith, a REAL, enriched campaign in Preparing): nothing reached the invitation function. A real
 * (non-test) partner cannot be given an invitation until it is marked "Ready to invite" — that gate is deliberate, and only test
 * fixtures (ZZ) skip it, which is why ZZ "just worked". The step that unlocks it, "Mark ready to invite", ran through an unguarded
 * helper: when its request failed, the button stayed disabled for ever and said nothing. A refresh showed Preparing and no invitation.
 *
 * Run: node --test tests/launch-admin-guards.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { runGuarded } from "../lib/launch-partners/invitation-replace.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const DIR = "components/admin/launch-partners";

describe("The gate that a real partner meets, and why ZZ did not", () => {
  const actions = read("app/admin/launch-partners/actions.ts");
  const inv = read(`${DIR}/InvitationSection.tsx`);
  test("SERVER: only a test fixture, a ready partner or a sent one may be issued an invitation — unchanged", () => {
    assert.match(actions, /if \(!c\.is_test && c\.stage !== "ready_to_invite" && c\.stage !== "sent"\) return \{ ok: false, error: "Mark the campaign Ready to invite before generating its private invitation\." \}/);
  });
  test("SCREEN: Generate is enabled by the SAME rule (test, ready or sent) — so for a real partner in Preparing it is switched off", () => {
    assert.match(inv, /const canGenerate = row\.is_test \|\| row\.stage === "ready_to_invite" \|\| row\.stage === "sent";/);
    assert.match(inv, /disabled=\{busy \|\| !canGenerate \|\| !!pending\}/);
  });
  test("the way through is offered right beside the switched-off button: 'Mark ready to invite', only while Preparing with a preview, guarded", () => {
    assert.match(inv, /row\.stage === "preparing" && row\.has_preview && <button onClick=\{markReady\}/);
    const fn = inv.slice(inv.indexOf("async function markReady()"), inv.indexOf("async function revoke()"));
    assert.match(fn, /runGuarded\(\(\) => setStageAction\(row\.id, "ready_to_invite"\)\)/); assert.ok(fn.indexOf("setBusy(false)") > fn.indexOf("runGuarded(") && fn.indexOf("setBusy(false)") < fn.indexOf("if (!g.ok)"));
    assert.match(fn, /router\.refresh\(\)/);
    assert.match(inv, /can be generated once this partner is marked <strong>Ready to invite<\/strong>/);
    assert.doesNotMatch(inv, /setStageAction\(row\.id, "(sent|archived|candidate)"/, "it can only ever mark ready");
  });
  test("generating still never emails anything or touches the business", () => {
    assert.doesNotMatch(inv, /sendInvitationEmailAction|markSentAction|local_businesses/);
  });
});

describe("No Admin button can be left disabled by a failed request", () => {
  test("THE CAUSE: the Status buttons (Mark ready to invite, Back to preparing, I've sent it, Archive, Restore) run through a guarded helper", () => {
    const s = read(`${DIR}/StatusSection.tsx`); const go = s.slice(s.indexOf("async function go("), s.indexOf("const milestones"));
    assert.match(go, /runGuarded\(fn\)/); assert.doesNotMatch(go, /await fn\(\)/, "the unguarded call is gone");
    assert.ok(go.indexOf("setBusy(false)") > go.indexOf("runGuarded(") && go.indexOf("setBusy(false)") < go.indexOf("if (!g.ok)"), "released before any branch can return");
    assert.match(go, /setErr\(g\.error\); router\.refresh\(\)/);
  });
  test("every Save button (positioning, preview, business page) is released and shows an error when its request fails", () => {
    const f = read(`${DIR}/fields.tsx`); const bar = f.slice(f.indexOf("export function SaveBar"), f.indexOf("export const lines"));
    assert.match(bar, /runGuarded\(onSave\)/); assert.doesNotMatch(bar, /await onSave\(\)/); assert.ok(bar.indexOf("setBusy(false)") > bar.indexOf("runGuarded("));
  });
  test("the Email actions (save, reset) are guarded; SEND is guarded with a longer limit and an honest message", () => {
    const e = read(`${DIR}/EmailSection.tsx`);
    assert.match(e, /runGuarded\(\(\) => saveEmailAction\(row\.id, f\)\)/); assert.match(e, /runGuarded\(\(\) => resetEmailToDefaultAction\(row\.id\)\)/);
    assert.match(e, /runGuarded\(\(\) => sendInvitationEmailAction\([^]*?\), 90_000\)/);
    const send = e.slice(e.indexOf("async function send()"), e.indexOf("return (\n    <Section"));
    assert.ok(send.indexOf("setBusy(false)") > send.indexOf("runGuarded("));
    assert.match(send, /if \(!g\.ok\) \{ setMsg\(\{ ok: false, text: SEND_UNKNOWN \}\); router\.refresh\(\); return; \}/);
    const unknown = /const SEND_UNKNOWN = "([^"]+)"/.exec(e)[1];
    assert.match(unknown, /isn’t clear whether the email went/); assert.match(unknown, /will not send the same invitation twice/); assert.match(unknown, /Nothing has been resent/);
    assert.doesNotMatch(unknown, /nothing was changed|was not sent|did not go|try again\./i, "a lost send request must never claim the email did NOT go");
  });
  test("no Admin launch-partner component awaits a server action bare: each is inside runGuarded, or inside a SaveBar (which guards it)", () => {
    const viaSaveBar = ["PageDraftEditor.tsx", "PreviewEditor.tsx", "PositioningField.tsx"]; // their save handlers run only through <SaveBar onSave=…>
    const allowed = new Map([["PrepareLaunchPartner.tsx", ["searchCandidatesAction"]], ["WorkflowRail.tsx", ["runWorkflowAction"]]]); // the debounced search holds no button; runWorkflowAction is itself the runGuarded wrapper (tested in launch-workflow)
    for (const f of readdirSync(new URL(`../${DIR}/`, import.meta.url)).filter((x) => x.endsWith(".tsx"))) {
      const src = read(`${DIR}/${f}`);
      for (const m of src.matchAll(/await\s+([a-zA-Z]+Action)\(/g)) {
        if (viaSaveBar.includes(f)) { assert.match(src, /<SaveBar onSave=/, `${f}: its save handler must run through SaveBar`); continue; }
        assert.ok((allowed.get(f) ?? []).includes(m[1]), `${f}: bare await ${m[1]}(…)`);
      }
    }
    assert.match(read(`${DIR}/Pipeline.tsx`), /runGuarded\(\(\) => importExistingAction\(\), 60_000\)/);
  });
});

describe("The guard itself (behaviour)", () => {
  test("a refused / lost request settles as an error instead of hanging, and does not leak internals", async () => {
    const r = await runGuarded(async () => { throw new Error("Server action not found. SECRET"); });
    assert.equal(r.ok, false); assert.equal(r.kind, "rejected"); assert.match(r.error, /may be out of date/); assert.doesNotMatch(r.error, /SECRET/);
    const hung = await runGuarded(() => new Promise(() => {}), 20); assert.equal(hung.kind, "timeout");
    const fine = await runGuarded(async () => ({ ok: true })); assert.equal(fine.ok, true);
  });
});
