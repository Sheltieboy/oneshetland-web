/**
 * Launch-partner TAKEDOWN (web side): an administrator takes a published page offline; the owner cannot undo it; republishing is controlled.
 * The database functions are covered by supabase/tests/launch-partner-takedown.node.test.ts; these pin the derived states (status, admin
 * workflow rail, owner dashboard), the actions' gating and the screens' words. Run: node --test tests/launch-takedown.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { derivePipelineStatus, isPublishedNow, isTakenOffline, STATUS_LABEL, nextAction } from "../lib/launch-partners/status.ts";
import { deriveWorkflow, isWaitingStep } from "../lib/launch-partners/workflow.ts";
import { deriveOwnerLaunch } from "../lib/launch-partners/owner-setup.ts";
import { defaultEmailDraft } from "../lib/launch-partners/email.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const FUTURE = "2099-01-01T00:00:00Z";
const d = defaultEmailDraft({ businessName: "Demo", contactName: null, slug: "demo", category: null, locality: null });
const GOOD = { subject: d.subject, body: d.body, opening: d.opening, contactEmail: "o@example.test" };
const row = (o = {}) => ({
  id: "c1", business_id: "b1", slug: "demo", stage: "sent", sent_at: "x", is_test: false, positioning: null, name: "Demo", category: "retail", locality: "Lerwick",
  is_active: true, is_claimed: true, has_owner: true, tier: "premium", plan_live: true, grant: { tier: "premium", expires_at: FUTURE }, has_preview: true, has_page_draft: true,
  has_email_draft: true, has_contact_email: true, first_viewed_at: "x", last_viewed_at: "x", view_count: 1, product_count: 0, active_product_count: 0, import_batch_count: 0, last_activity: null,
  invite: { status: "claimed", created_at: "2026-10-06T10:00:00Z", expires_at: FUTURE }, claim: { status: "approved", created_at: "x" }, setup_ready_at: "2026-10-07T10:00:00Z", live_at: "2026-10-07T10:00:00Z", ...o,
});
const LIVE = row({ is_published: true, offline_at: null });
const OFFLINE = row({ is_published: false, offline_at: "2026-10-08T10:00:00Z" });
const RELEASED = row({ is_published: false, offline_at: null });
const owner = { edited: true, approved: true, published: false };
const wf = (r, o = owner) => deriveWorkflow({ row: r, claimMode: "live", email: GOOD, owner: o });

describe("Status: live is 'published now'; live_at is history", () => {
  test("1 · published → Live; taken offline (hold in force) → Offline; hold lifted → back to 'ready to go live'; older rows without the new fields still read live_at", () => {
    assert.equal(derivePipelineStatus(LIVE), "live"); assert.ok(isPublishedNow(LIVE)); assert.ok(!isTakenOffline(LIVE));
    assert.equal(derivePipelineStatus(OFFLINE), "offline"); assert.equal(STATUS_LABEL.offline, "Offline"); assert.ok(isTakenOffline(OFFLINE)); assert.ok(!isPublishedNow(OFFLINE));
    assert.equal(derivePipelineStatus(RELEASED), "ready_to_go_live");
    assert.equal(derivePipelineStatus(row()), "live", "no is_published field: live_at alone");
    assert.equal(derivePipelineStatus({ ...OFFLINE, stage: "archived" }), "archived");
  });
  test("2 · the next-action sentence for an offline page points at Status", () => {
    assert.match(nextAction(OFFLINE), /taken offline/i);
  });
});

describe("Admin workflow rail", () => {
  test("3 · live: 'Live', every step complete, nothing to do (unchanged)", () => {
    const w = wf(LIVE, { ...owner, published: true });
    assert.equal(w.headline, "Live"); assert.equal(w.current, null); assert.ok(w.steps.every((s) => s.state === "complete"));
    const legacy = wf(row(), { ...owner, published: true }); assert.equal(legacy.headline, "Live");
  });
  test("4 · offline: the Live step needs attention, the headline is 'Page taken offline', and it is a thing to act on — not a quiet waiting state", () => {
    const w = wf(OFFLINE);
    assert.equal(w.headline, "Page taken offline"); assert.equal(w.statusLabel, "Offline");
    assert.equal(w.current.id, "live"); assert.equal(w.current.state, "attention"); assert.equal(isWaitingStep(w), false);
    assert.match(w.current.note, /administrator took this page offline.*until you allow it/i); assert.deepEqual(w.current.target, { kind: "section", id: "status" });
    assert.equal(w.current.cta, "Open Status");
  });
  test("5 · the campaign is not pretended never to have completed: every earlier step stays complete while offline", () => {
    const w = wf(OFFLINE);
    for (const id of ["prepare", "send", "approve_claim", "grant", "owner_review"]) assert.equal(w.steps.find((s) => s.id === id).state, "complete", id);
    assert.equal(w.steps.find((s) => s.id === "live").state, "attention");
    assert.equal(w.steps.find((s) => s.id === "go_live").state, "future", "and it is no longer 'ready to go live ✓'");
  });
  test("6 · hold lifted: the owner goes live again — a waiting state with its own headline, not 'Live' and not 'never completed'", () => {
    const w = wf(RELEASED);
    assert.equal(w.current.id, "go_live"); assert.equal(isWaitingStep(w), true);
    assert.equal(w.headline, "Taken offline earlier — waiting for the owner to go live again"); assert.match(w.current.note, /taken offline.*hold has been lifted.*owner goes live again/i);
  });
  test("7 · a grant problem still outranks nothing it should not: an ended grant on an offline page keeps its own attention step first", () => {
    const w = deriveWorkflow({ row: { ...OFFLINE, grant: null, plan_live: false }, claimMode: "live", email: GOOD, owner, lastGrant: { status: "expired", expires_at: "2020-01-01T00:00:00Z" } });
    assert.equal(w.current.id, "grant");
  });
});

describe("Owner dashboard", () => {
  const v = (kind, o = {}) => ({ id: `${kind}-${o.n ?? 1}`, kind, created_at: "2026-10-07T10:00:00Z", ...o });
  const versions = [v("unpublished", { id: "u1", parent_id: "p1" }), v("published", { id: "p1", parent_id: "a1" }), v("approved", { id: "a1", is_approved_current: true }), v("owner_edit", { id: "e1" })];
  const g = [{ expires_at: FUTURE, revoked_at: null, superseded_at: null }];
  test("8 · taken offline (hold in force, or hold unreadable) → 'Your page is currently offline' — never 'You’re live'", () => {
    for (const held of [true, null, undefined]) {
      const s = deriveOwnerLaunch({ hasCampaign: true, grants: g, versions, held });
      assert.equal(s.state, "offline"); assert.equal(s.title, "Your page is currently offline"); assert.doesNotMatch(s.title + s.body, /You’re live/);
      assert.match(s.body, /contact OneShetland/); assert.equal(s.showCard, true); assert.notEqual(s.cta, "Go live on OneShetland");
    }
  });
  test("9 · the owner is never told why: no reason, no 'administrator', no 'taken down' in what they read", () => {
    const s = deriveOwnerLaunch({ hasCampaign: true, grants: g, versions, held: true });
    assert.doesNotMatch(JSON.stringify(s), /reason|administrator|admin\b|taken down|removed/i);
  });
  test("10 · offline even if their access has ended (they are told, not left with a blank card)", () => {
    const s = deriveOwnerLaunch({ hasCampaign: true, grants: [{ expires_at: "2020-01-01T00:00:00Z" }], versions, held: true });
    assert.equal(s.state, "offline");
  });
  test("11 · hold lifted → the approved setup can go live again, with honest words; the approved version is not lost", () => {
    const s = deriveOwnerLaunch({ hasCampaign: true, grants: g, versions, held: false });
    assert.equal(s.state, "approved"); assert.equal(s.wasOffline, true); assert.equal(s.title, "Your page is offline — you can go live again");
    assert.equal(s.cta, "Go live on OneShetland"); assert.equal(s.approvedVersionId, "a1"); assert.match(s.body, /public again/);
  });
  test("12 · after the owner republishes, they are live again (the newest of published / unpublished decides)", () => {
    const again = [v("published", { id: "p2", parent_id: "a1" }), ...versions];
    const s = deriveOwnerLaunch({ hasCampaign: true, grants: g, versions: again, held: false });
    assert.equal(s.state, "live"); assert.equal(s.title, "You’re live on OneShetland ✓"); assert.equal(s.unpublishedChanges, false);
  });
  test("13 · a page that was never taken offline is unchanged", () => {
    const s = deriveOwnerLaunch({ hasCampaign: true, grants: g, versions: [v("published", { parent_id: "a1" }), v("approved", { id: "a1", is_approved_current: true })] });
    assert.equal(s.state, "live"); assert.equal(s.wasOffline, false);
  });
});

describe("Actions and screens", () => {
  const admin = read("app/admin/launch-partners/actions.ts");
  const owner_ = read("app/business/[id]/manage/launch-setup/actions.ts");
  const status = read("components/admin/launch-partners/StatusSection.tsx");
  const fnBody = (src, name) => src.slice(src.indexOf(`export async function ${name}`), src.indexOf("\n}\n", src.indexOf(`export async function ${name}`)) + 3);
  test("14 · taking a page offline is admin-only, needs a reason and an explicit confirmation, and calls only the takedown function", () => {
    const f = fnBody(admin, "takeOfflineAction");
    assert.match(f, /> \{\n  await requireAdmin\(\);\n  try \{/, "requireAdmin is the first statement");
    assert.match(f, /confirm !== true/); assert.match(f, /length < 3/); assert.match(f, /takeOffline\(id, why\)/);
    assert.doesNotMatch(f, /sendInvitation|postmark|functions\.invoke|\.from\("(local_businesses|products|launch_plan_grants|business_claims)"\)|\.delete\(|\.update\(/);
    assert.match(f, /revalidateTakedown/);
  });
  test("15 · allowing republication is admin-only and publishes nothing", () => {
    const f = fnBody(admin, "allowRepublishAction");
    assert.match(f, /await requireAdmin\(\);/); assert.match(f, /allowRepublish\(id\)/); assert.doesNotMatch(f, /go_live|goLive|published/);
  });
  test("16 · the owner's code can never call the admin takedown or the hold lift", () => {
    assert.doesNotMatch(owner_, /take_offline|allow_republish|takeOffline|allowRepublish/);
    for (const f of ["components/business/GoLivePanel.tsx", "components/business/LaunchSetupEditor.tsx", "components/business/LaunchSetupCard.tsx"]) assert.doesNotMatch(read(f), /take_offline|allow_republish|takeOffline|allowRepublish/, f);
  });
  test("17 · only the admin campaign module wraps the takedown RPCs, and nothing else in the app calls them", () => {
    const srv = read("lib/launch-partners/campaigns.server.ts");
    assert.match(srv, /admin_launch_partner_take_offline/); assert.match(srv, /admin_launch_partner_allow_republish/);
    for (const f of ["app/directory/[id]/page.tsx", "components/business-page/PublishedBusinessPage.tsx", "lib/launch-partners/published.server.ts", "lib/launch-partners/owner-setup.server.ts"]) assert.doesNotMatch(read(f), /take_offline|allow_republish/, f);
  });
  test("18 · owner actions refuse plainly while the page is offline (save, approve, go live), without giving a reason", () => {
    assert.equal((owner_.match(/ctx\.launch\.state === "offline"\) return \{ ok: false, error: OFFLINE \}/g) ?? []).length, 3);
    assert.match(owner_, /const OFFLINE = "Your page is currently offline\. Please contact OneShetland\."/);
    assert.match(owner_, /\^Your \(business\|Launch\|page\)/, "the database's own sentence is passed through");
  });
  test("19 · the confirmation uses the agreed words", () => {
    assert.match(status, /Take this Launch Partner page offline\?/);
    assert.match(status, /The rich published page will stop being public\. The business, owner, claim, Launch Partner access and saved versions will remain intact\.\\n\\nYou can publish an approved setup again later\./);
    assert.match(status, /confirmLabel: "Take page offline"/);
    assert.ok(status.indexOf("await confirm({ title: \"Take this Launch Partner page offline?\"") < status.indexOf("takeOfflineAction(row.id, reason"));
  });
  test("20 · the control is a secondary 'Danger zone', shown only for a page that is published now, and the button needs a reason", () => {
    assert.match(status, /\{published && row\.stage !== "archived" && \(\s*<details/); assert.match(status, /Danger zone/);
    assert.match(status, /disabled=\{busy \|\| reason\.trim\(\)\.length < 3\}/);
  });
  test("21 · the offline panel shows who, when and why to administrators, says what stays intact, and offers the one way back", () => {
    assert.match(status, /Page taken offline/); assert.match(status, /cannot go live again until you allow it/);
    assert.match(status, /Allow the owner to go live again/); assert.match(status, /This does not publish anything/);
    assert.match(status, /actor_name/); assert.match(status, /Reason: /);
  });
  test("22 · history labels exist for both new events", () => {
    assert.match(status, /went_offline: "Page taken offline"/); assert.match(status, /republish_allowed: "Owner allowed to go live again"/);
  });
  test("23 · the owner's setup page: an offline notice, no Go live button, a read-only editor", () => {
    const page = read("app/business/[id]/manage/launch-setup/page.tsx");
    assert.match(page, /Your page is currently offline\./); assert.match(page, /state === "approved" \|\| ctx\.launch\.state === "live"\) && <div className="mt-6"><GoLivePanel/);
    assert.match(page, /locked=\{ctx\.launch\.state === "approved" \|\| ctx\.launch\.state === "offline"\} offline=\{ctx\.launch\.state === "offline"\}/);
    assert.doesNotMatch(page, /reason/i);
  });
  test("24 · the owner's loader reads the hold through the owner-readable function, and fails safe", () => {
    const l = read("lib/launch-partners/owner-setup.server.ts");
    assert.match(l, /launch_partner_publication_hold/); assert.match(l, /hErr \|\| !h \? null/);
  });
});
