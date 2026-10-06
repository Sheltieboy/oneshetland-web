/**
 * The Launch workflow rail/bar — derived from the page's own facts, never from state of its own.
 * Run: node --test tests/launch-workflow.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deriveWorkflow, isWaitingStep } from "../lib/launch-partners/workflow.ts";
import { derivePipelineStatus, STATUS_LABEL } from "../lib/launch-partners/status.ts";
import { defaultEmailDraft } from "../lib/launch-partners/email.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const FUTURE = "2099-01-01T00:00:00Z";
const base = (o = {}) => ({
  id: "c1", business_id: "b1", slug: "demo", stage: "preparing", is_test: false, positioning: null, name: "Demo", category: "retail", locality: "Lerwick",
  is_active: true, is_claimed: false, has_owner: false, tier: "free", plan_live: false, grant: null,
  invite: { status: "none", created_at: null, expires_at: null }, claim: null, product_count: 0, active_product_count: 0, import_batch_count: 0,
  sent_at: null, first_viewed_at: null, last_viewed_at: null, view_count: 0, setup_ready_at: null, live_at: null,
  has_preview: true, has_page_draft: true, has_email_draft: true, has_contact_email: true, last_activity: null, ...o,
});
const draft = defaultEmailDraft({ businessName: "Demo", opening: "I liked your shop." });
const GOOD = { subject: draft.subject, body: draft.body, opening: draft.opening, contactEmail: "owner@example.test" };
const NOEMAIL = { ...GOOD, contactEmail: null };
const open = { status: "open", created_at: "2026-10-06T10:00:00Z", expires_at: FUTURE };
const wf = (row, claimMode = "holding", email = GOOD) => deriveWorkflow({ row, claimMode, email });
const cur = (w) => w.current && { id: w.current.id, state: w.current.state, action: w.current.action ?? null };

describe("The next action, from the real state", () => {
  test("1 · Preparing with preview and page prepared → 'Mark ready to invite' is current, and is a direct action", () => {
    const w = wf(base());
    assert.deepEqual(cur(w), { id: "mark_ready", state: "current", action: "mark_ready" });
    assert.equal(w.headline, "Next: Mark ready to invite"); assert.equal(w.current.cta, "Mark ready to invite");
    assert.equal(w.steps.find((s) => s.id === "prepare").state, "complete");
    for (const id of ["generate_invite", "open_claiming", "send"]) assert.notEqual(w.steps.find((s) => s.id === id).state, "complete");
  });
  test("1b · not prepared yet → 'Prepare preview' is current and jumps to the section that is missing", () => {
    assert.deepEqual(cur(wf(base({ has_preview: false, has_page_draft: false }))), { id: "prepare", state: "current", action: null });
    assert.deepEqual(wf(base({ has_preview: false })).current.target, { kind: "section", id: "preview" });
    assert.deepEqual(wf(base({ has_page_draft: false })).current.target, { kind: "section", id: "page" });
    assert.equal(wf(base({ has_preview: false, has_page_draft: false })).steps.find((s) => s.id === "mark_ready").available, false, "not actionable until prepared");
  });
  test("2 · Ready to invite, no invitation → 'Generate invitation' is current; it is a jump (its warnings and in-memory link live in the Invitation section)", () => {
    const w = wf(base({ stage: "ready_to_invite" }));
    assert.deepEqual(cur(w), { id: "generate_invite", state: "current", action: null });
    assert.deepEqual(w.current.target, { kind: "section", id: "invitation" }); assert.equal(w.current.cta, "Go to Invitation");
  });
  test("3 · Invitation generated, claiming closed → 'Open claiming' is current, and is a direct action", () => {
    const w = wf(base({ stage: "ready_to_invite", invite: open }), "holding");
    assert.deepEqual(cur(w), { id: "open_claiming", state: "current", action: "open_claiming" });
    assert.equal(w.steps.find((s) => s.id === "generate_invite").state, "complete");
  });
  test("4 · Invitation + claiming ready, email incomplete → 'Review email' is current, naming the first problem", () => {
    const w = wf(base({ stage: "ready_to_invite", invite: open }), "live", NOEMAIL);
    assert.deepEqual(cur(w), { id: "review_email", state: "current", action: null });
    assert.match(w.current.note, /contact's email address/); assert.deepEqual(w.current.target, { kind: "section", id: "email" });
    const prompt = wf(base({ stage: "ready_to_invite", invite: open }), "live", { ...GOOD, opening: "[Your short personal opening — why you chose Demo, in your own words. Replace this line before sending.]" });
    assert.equal(prompt.current.id, "review_email"); assert.match(prompt.current.note, /personalised-opening/i);
  });
  test("5 · Email valid → 'Send invitation' is current — a jump to the Email section, never a send from the rail", () => {
    const w = wf(base({ stage: "ready_to_invite", invite: open }), "live");
    assert.deepEqual(cur(w), { id: "send", state: "current", action: null });
    assert.deepEqual(w.current.target, { kind: "section", id: "email" }); assert.equal(w.current.cta, "Go to Email");
    assert.equal(w.steps.find((s) => s.id === "review_email").state, "complete");
  });
  test("6 · Sent → a waiting state, and no send action anywhere", () => {
    const w = wf(base({ stage: "sent", sent_at: "2026-10-06T11:00:00Z", invite: open }), "live");
    assert.deepEqual(cur(w), { id: "wait", state: "current", action: null });
    assert.equal(w.headline, "Waiting for the recipient"); assert.ok(isWaitingStep(w));
    assert.equal(w.steps.find((s) => s.id === "send").state, "complete"); assert.equal(w.steps.find((s) => s.id === "send").available, false);
    assert.ok(w.steps.every((s) => !s.action), "nothing is actionable in the rail while waiting");
    const viewed = wf(base({ stage: "sent", sent_at: "2026-10-06T11:00:00Z", invite: open, first_viewed_at: "2026-10-06T12:00:00Z", view_count: 2 }), "live");
    assert.equal(viewed.current.id, "wait"); assert.match(viewed.headline, /Opened — waiting for a claim/); assert.match(viewed.current.note, /opened 2 times/i);
  });
  test("7 · A claim submitted → 'Approve claim' is current and leads to the existing Business claims screen", () => {
    const w = wf(base({ stage: "sent", sent_at: "2026-10-06T11:00:00Z", invite: { ...open, status: "claim pending" }, claim: { status: "pending", created_at: "2026-10-07T09:00:00Z" } }), "live");
    assert.deepEqual(cur(w), { id: "approve_claim", state: "current", action: null });
    assert.deepEqual(w.current.target, { kind: "href", href: "/admin/claims?status=pending" }); assert.equal(w.current.cta, "Review claim");
    assert.equal(w.steps.find((s) => s.id === "wait").state, "complete");
  });
  test("claim approved → 'Grant Launch Partner'; granted → waiting for them; ready → waiting for Go live", () => {
    const claimed = base({ stage: "sent", sent_at: "x", invite: { ...open, status: "claimed" }, claim: { status: "approved", created_at: "x" }, has_owner: true, is_claimed: true });
    const g = wf(claimed, "live"); assert.equal(g.current.id, "grant"); assert.deepEqual(g.current.target, { kind: "section", id: "grant" }, "the grant is done ON this page, not on another screen");
    const granted = wf({ ...claimed, grant: { tier: "premium", expires_at: FUTURE } }, "live"); assert.equal(granted.current.id, "go_live"); assert.ok(isWaitingStep(granted)); assert.equal(granted.headline, "Waiting for them to set up");
    const rdy = wf({ ...claimed, grant: { tier: "premium", expires_at: FUTURE }, setup_ready_at: "x" }, "live"); assert.equal(rdy.current.id, "live"); assert.equal(rdy.headline, "Waiting for them to go live");
  });
  test("8 · Already live → everything complete, no current step, headline 'Live'", () => {
    const w = wf(base({ stage: "sent", sent_at: "x", invite: { ...open, status: "claimed" }, claim: { status: "approved", created_at: "x" }, has_owner: true, is_claimed: true, grant: { tier: "premium", expires_at: FUTURE }, setup_ready_at: "x", live_at: "y" }), "live");
    assert.equal(w.current, null); assert.equal(w.headline, "Live"); assert.equal(w.statusLabel, "Live");
    assert.ok(w.steps.every((s) => s.state === "complete"), w.steps.filter((s) => s.state !== "complete").map((s) => s.id).join());
  });
});

describe("Attention, tests and edge cases", () => {
  test("after sending, an expired or revoked invitation, or claiming still closed, needs attention — and outranks waiting", () => {
    const sent = { stage: "sent", sent_at: "x" };
    for (const status of ["expired", "revoked"]) {
      const w = wf(base({ ...sent, invite: { ...open, status } }), "live");
      assert.deepEqual(cur(w), { id: "generate_invite", state: "attention", action: null }); assert.match(w.headline, /^Needs attention: Generate invitation/); assert.match(w.current.note, new RegExp(status === "expired" ? "expired" : "revoked"));
    }
    const closed = wf(base({ ...sent, invite: open }), "holding");
    assert.deepEqual(cur(closed), { id: "open_claiming", state: "attention", action: "open_claiming" }); assert.match(closed.current.note, /cannot claim yet/);
    const rejected = wf(base({ ...sent, invite: open, claim: { status: "rejected", created_at: "x" } }), "live");
    assert.deepEqual(cur(rejected), { id: "approve_claim", state: "attention", action: null });
  });
  test("a test fixture does not need 'Ready to invite' to generate an invitation (the server's own rule), so the rail does not insist on it", () => {
    const w = wf(base({ is_test: true }));
    assert.equal(w.current.id, "generate_invite"); assert.equal(w.steps.find((s) => s.id === "generate_invite").available, true);
    assert.equal(wf(base()).steps.find((s) => s.id === "generate_invite").available, false, "a real partner in Preparing cannot yet");
  });
  test("a candidate cannot be marked ready from the rail (Status offers 'Start preparing' first): the step is a jump", () => {
    const w = wf(base({ stage: "candidate" })); assert.equal(w.current.id, "mark_ready"); assert.equal(w.current.action, undefined); assert.equal(w.current.cta, "Go to Status");
  });
  test("archived → nothing to do", () => { const w = wf(base({ stage: "archived" })); assert.equal(w.current, null); assert.equal(w.headline, "Archived — nothing to do"); });
  test("review steps never block and are never current: they are jump-only (no 'reviewed' fact exists to read)", () => {
    for (const row of [base(), base({ stage: "ready_to_invite" }), base({ has_preview: false })]) for (const id of ["review_preview", "review_page"]) assert.notEqual(wf(row).current?.id, id);
    assert.deepEqual(wf(base()).steps.find((s) => s.id === "review_preview").target, { kind: "section", id: "preview" });
    assert.deepEqual(wf(base()).steps.find((s) => s.id === "review_page").target, { kind: "section", id: "page" });
  });
  test("exactly one step is current (or attention) at a time", () => {
    const rows = [base(), base({ stage: "ready_to_invite" }), base({ stage: "ready_to_invite", invite: open }), base({ stage: "sent", sent_at: "x", invite: open })];
    for (const r of rows) for (const mode of ["live", "holding"]) assert.ok(wf(r, mode).steps.filter((s) => s.state === "current" || s.state === "attention").length <= 1);
  });
});

describe("It reads existing state and creates none", () => {
  test("9 · the headline status IS the page's own derivePipelineStatus; the input is not modified; same input, same output", () => {
    const row = base({ stage: "ready_to_invite", invite: open }); const frozen = JSON.stringify(row);
    const w1 = wf(row, "live"), w2 = wf(row, "live");
    assert.equal(w1.status, derivePipelineStatus(row)); assert.equal(w1.statusLabel, STATUS_LABEL[derivePipelineStatus(row)]);
    assert.equal(JSON.stringify(row), frozen); assert.deepEqual(w1, w2);
  });
  test("9 · the derivation has no storage, no network, no database, and the rail keeps no workflow state of its own", () => {
    const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const wfc = code("lib/launch-partners/workflow.ts");
    assert.doesNotMatch(wfc, /fetch\(|rpc\(|supabase|localStorage|sessionStorage|useState|process\.env|new Date\(|Date\.now/);
    assert.deepEqual([...wfc.matchAll(/from "(\.[^"]+)"/g)].map((m) => m[1]).sort(), ["./email.ts", "./status.ts"]);
    const rail = code("components/admin/launch-partners/WorkflowRail.tsx");
    assert.deepEqual([...rail.matchAll(/useState(?:<[^>]*>)?\(([^)]*)\)/g)].map((m) => m[1]), ["false", "null"], "only busy + error: no copy of the campaign's state");
    assert.doesNotMatch(rail, /localStorage|sessionStorage/);
    const page = read("app/admin/launch-partners/[id]/page.tsx");
    assert.match(page, /deriveWorkflow\(\{ row: c, claimMode, email: \{ subject: c\.email_subject, body: c\.email_body, opening: c\.email_opening, contactEmail: c\.contact_email \}, lastGrant: grant\.last \}\)/);
    assert.match(page, /const claimMode = preview\?\.claim === "live" \? "live" : "holding"/, "the same claim mode the page already computes");
  });
  test("the rail performs exactly two actions, through the page's own server actions; it cannot generate, send, revoke or grant", () => {
    const acts = read("lib/launch-partners/workflow-actions.ts");
    assert.match(acts, /setStageAction\(id, "ready_to_invite"\)/); assert.match(acts, /setClaimModeAction\(id, "live"\)/); assert.match(acts, /runGuarded\(/);
    const all = read("lib/launch-partners/workflow-actions.ts") + read("components/admin/launch-partners/WorkflowRail.tsx") + read("lib/launch-partners/workflow.ts");
    assert.doesNotMatch(all, /issueInvitationAction|sendInvitationEmailAction|revokeInvitationAction|markSentAction|enrichCampaignAction|saveEmailAction|setStageAction\(id, "(sent|archived|candidate|preparing)"/);
    const w = wf(base()).steps.concat(wf(base({ stage: "ready_to_invite", invite: open })).steps).filter((s) => s.action).map((s) => s.action);
    assert.deepEqual([...new Set(w)].sort(), ["mark_ready", "open_claiming"]);
    assert.ok(read("app/admin/launch-partners/actions.ts").includes('setClaimModeAction(id: string, mode: "live" | "holding")'), "the same action Invitation → Open claiming calls");
  });
  test("the page's own safeguards are untouched: Invitation, Email and Status sections are not modified by the rail", () => {
    for (const f of ["InvitationSection", "EmailSection", "StatusSection"]) assert.doesNotMatch(read(`components/admin/launch-partners/${f}.tsx`), /WorkflowRail|workflow/i, f);
  });
});

describe("Jump links, rail vs bar, accessibility", () => {
  test("10 · every section target exists on the page with the id the link uses, and each step jumps to the right one", () => {
    const sources = ["app/admin/launch-partners/[id]/page.tsx", "components/admin/launch-partners/PreviewEditor.tsx", "components/admin/launch-partners/PageDraftEditor.tsx", "components/admin/launch-partners/InvitationSection.tsx", "components/admin/launch-partners/EmailSection.tsx", "components/admin/launch-partners/StatusSection.tsx"].map(read).join("\n");
    for (const id of ["preview", "page", "invitation", "email", "status"]) assert.match(sources, new RegExp(`<Section id="${id}"`), id);
    const all = [...new Set(wf(base()).steps.concat(wf(base({ stage: "ready_to_invite", invite: open }), "live").steps).map((s) => `${s.id}:${JSON.stringify(s.target)}`))];
    const target = (id) => JSON.parse(all.find((x) => x.startsWith(`${id}:`)).slice(id.length + 1));
    assert.deepEqual(target("review_preview"), { kind: "section", id: "preview" }); assert.deepEqual(target("review_page"), { kind: "section", id: "page" });
    assert.deepEqual(target("mark_ready"), { kind: "section", id: "status" }); assert.deepEqual(target("generate_invite"), { kind: "section", id: "invitation" });
    assert.deepEqual(target("open_claiming"), { kind: "section", id: "invitation" }); assert.deepEqual(target("review_email"), { kind: "section", id: "email" });
    assert.deepEqual(target("send"), { kind: "section", id: "email" }); assert.deepEqual(target("approve_claim"), { kind: "href", href: "/admin/claims?status=pending" });
    const rail = read("components/admin/launch-partners/WorkflowRail.tsx");
    assert.match(rail, /scrollIntoView\(\{ behavior: reduce \? "auto" : "smooth", block: "start" \}\)/); assert.match(rail, /prefers-reduced-motion: reduce/);
    assert.match(rail, /preventDefault\(\); jumpTo\(id\)/, "no route change"); assert.match(rail, /href=\{`#\$\{id\}`\}/);
  });
  test("11 · wide screens get the sticky rail; narrower screens get the bottom bar instead (never both)", () => {
    const rail = read("components/admin/launch-partners/WorkflowRail.tsx");
    assert.match(rail, /data-workflow="rail" className="hidden xl:block"/); assert.match(rail, /sticky top-20/);
    assert.match(rail, /data-workflow="bar" className="sticky bottom-3 z-40 [^"]*xl:hidden"/);
    assert.doesNotMatch(rail, /fixed inset-x-0/, "the bar sticks inside the page column, so it can never sit on top of the site footer");
    const page = read("app/admin/launch-partners/[id]/page.tsx");
    assert.match(page, /className="xl:grid xl:grid-cols-\[minmax\(0,1fr\)_14rem\] xl:gap-5"/, "a second column only when the rail shows");
  });
  test("accessible: a labelled nav/region, aria-current on the current step, a polite live headline, visible focus, status not by colour alone", () => {
    const rail = read("components/admin/launch-partners/WorkflowRail.tsx");
    assert.match(rail, /aria-label="Launch workflow"/g); assert.match(rail, /aria-current="step"/); assert.match(rail, /aria-live="polite"/);
    assert.match(rail, /focus-visible:ring-2/); assert.match(rail, /const GLYPH[^\n]*complete: "✓"[^\n]*attention: "!"/); assert.match(rail, /sr-only/);
    assert.match(rail, /aria-disabled="true"/, "an unavailable step is not an actionable link");
    assert.match(rail, /h\.setAttribute\("tabindex", "-1"\); h\.focus\(\{ preventScroll: true \}\)/, "keyboard users land on the section heading");
  });
});
