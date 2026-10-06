/**
 * Launch-partner GO LIVE (web side): the owner publishes the exact setup they approved. The database function is covered by
 * supabase/tests/launch-partner-go-live.node.test.ts; these pin the owner states, the action's gating, the public-page switch and the
 * admin rail. Run: node --test tests/launch-go-live.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deriveOwnerLaunch } from "../lib/launch-partners/owner-setup.ts";
import { deriveWorkflow } from "../lib/launch-partners/workflow.ts";
import { defaultEmailDraft } from "../lib/launch-partners/email.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const FUT = "2099-01-01T00:00:00Z";
const grant = (o = {}) => ({ expires_at: FUT, revoked_at: null, superseded_at: null, ...o });
const v = (kind, o = {}) => ({ id: `${kind}-1`, kind, created_at: "2026-10-07T10:00:00Z", ...o });
const owner = (versions, grants = [grant()]) => deriveOwnerLaunch({ hasCampaign: true, grants, versions });

describe("Owner states around go-live", () => {
  test("1 · approved, nothing published → 'Your setup is approved' with the Go live button, never automatic", () => {
    const s = owner([v("approved", { is_approved_current: true }), v("owner_edit")]);
    assert.equal(s.state, "approved"); assert.equal(s.title, "Your setup is approved");
    assert.equal(s.cta, "Go live on OneShetland"); assert.match(s.body, /Going live will make your approved OneShetland business page public/);
    assert.match(s.body, /optional/); assert.equal(s.approvedVersionId, "approved-1");
  });
  test("2 · live → a compact success state ('You’re live on OneShetland ✓', View my page); not an unfinished task", () => {
    const s = owner([v("published", { id: "p1", parent_id: "approved-1" }), v("approved", { is_approved_current: true }), v("owner_edit")]);
    assert.equal(s.state, "live"); assert.equal(s.title, "You’re live on OneShetland ✓"); assert.equal(s.cta, "View my page");
    assert.ok(s.steps.every((x) => x.state === "done"));
  });
  test("3 · a live page whose grant later ended is still live (the page is not taken down by an expiry)", () => {
    assert.equal(owner([v("published", { parent_id: "approved-1" }), v("approved")], [grant({ expires_at: "2020-01-01T00:00:00Z" })]).state, "live");
  });
  test("4 · an ordinary business, or an ended grant that never went live → no launch flow", () => {
    assert.equal(deriveOwnerLaunch({ hasCampaign: false, grants: [], versions: [] }).state, "none");
    assert.equal(owner([v("approved", { is_approved_current: true })], [grant({ revoked_at: "2026-01-01T00:00:00Z" })]).state, "ended");
  });
  test("5 · live with a saved-but-unpublished edit → says so; live with a newer approval → one-click publish", () => {
    const edited = owner([v("owner_edit", { id: "e2", created_at: "2026-10-09T10:00:00Z" }), v("published", { id: "p1", parent_id: "a1", created_at: "2026-10-08T10:00:00Z" }), v("approved", { id: "a1", created_at: "2026-10-07T10:00:00Z", is_approved_current: true })]);
    assert.equal(edited.state, "live"); assert.equal(edited.unpublishedChanges, true);
    const waiting = owner([v("approved", { id: "a2", created_at: "2026-10-09T10:00:00Z", is_approved_current: true }), v("published", { id: "p1", parent_id: "a1", created_at: "2026-10-08T10:00:00Z" }), v("approved", { id: "a1", created_at: "2026-10-07T10:00:00Z", is_approved_current: false })]);
    assert.equal(waiting.approvalWaiting, true);
  });
});

describe("The actions and the confirmation", () => {
  const actions = read("app/business/[id]/manage/launch-setup/actions.ts");
  const panel = read("components/business/GoLivePanel.tsx");
  test("6 · goLiveAction: owner-gated, approved version only, calls the one RPC, never touches the business record", () => {
    const fn = actions.slice(actions.indexOf("export async function goLiveAction"), actions.indexOf("export async function publishChangesAction"));
    assert.match(fn, /await context\(businessId\)/); assert.match(actions, /async function context\(businessId: string\) \{\s*await requireBusinessOwner\(/); assert.match(fn, /approvedVersionId/); assert.match(fn, /launch_partner_owner_go_live/);
    assert.doesNotMatch(fn, /\.from\("local_businesses"\)|\.from\("products"\)|\.update\(|\.insert\(/);
    assert.match(fn, /revalidateLive/);
  });
  test("7 · the confirmation uses the agreed words and the action runs only after it", () => {
    assert.match(panel, /Go live with this setup\?/);
    assert.match(panel, /This will make your approved OneShetland business page public\. You can continue editing your business afterwards\./);
    assert.match(panel, /Products, services, offers and other optional features are not required and will only appear if you add them\./);
    assert.ok(panel.indexOf("await confirm(") < panel.indexOf("goLiveAction(businessId)"));
    assert.match(panel, /runGuarded/);
  });
  test("8 · nothing calls go-live except the owner's two actions (no admin, no import, no email path)", () => {
    for (const f of ["app/admin/launch-partners/actions.ts", "lib/launch-partners/campaigns.server.ts"]) { let s = ""; try { s = read(f); } catch {} assert.doesNotMatch(s, /launch_partner_owner_go_live/, f); }
    assert.equal((actions.match(/launch_partner_owner_go_live/g) ?? []).length, 2);
  });
});

describe("The public page", () => {
  const dir = read("app/directory/[id]/page.tsx");
  const pub = read("components/business-page/PublishedBusinessPage.tsx");
  const reader = read("lib/launch-partners/published.server.ts");
  test("9 · the Directory page switches to the published setup only when one exists; everything else is the existing page", () => {
    assert.match(dir, /getPublishedLaunchPage\(b\.id\)/);
    assert.match(dir, /if \(published\) return <PublishedBusinessPage/);
    assert.ok(dir.indexOf("if (!b) notFound();") < dir.indexOf("await getPublishedLaunchPage(b.id)"));
  });
  test("10 · the reader asks only the public RPC and validates what comes back", () => {
    assert.match(reader, /launch_partner_published_profile/); assert.match(reader, /parsePageDraft/);
    assert.doesNotMatch(reader, /launch_partner_page_versions|createServiceClient|service_key/);
  });
  test("11 · it renders the LIVE model: no prepared banner, no invitation, no example commerce; real commerce keeps its widgets", () => {
    assert.match(pub, /mode: "live"/); assert.doesNotMatch(pub, /mode: "prepared"/);
    assert.match(pub, /offers: \[\], book: null, passes: \[\], rewards: null/);
    assert.doesNotMatch(pub, /invite|token|Not public|future live|private draft/i);
    for (const w of ["OfferClaimList", "ServicesSection", "UnitItemsSection", "LoyaltyProgress"]) assert.match(pub, new RegExp(w));
  });
  test("12 · nothing in the go-live web code writes the business record or creates products/services/offers/passes", () => {
    for (const f of ["lib/launch-partners/published.server.ts", "components/business-page/PublishedBusinessPage.tsx", "components/business/GoLivePanel.tsx"]) assert.doesNotMatch(read(f), /\.(insert|update|upsert|delete)\(/, f);
    const a = read("app/business/[id]/manage/launch-setup/actions.ts");
    assert.doesNotMatch(a, /from\("(local_businesses|products|book_services|local_offers|book_unit_items)"\)/);
  });
});

describe("The admin rail", () => {
  const FUTURE = FUT;
  const GOOD = (() => { const d = defaultEmailDraft({ businessName: "Demo", contactName: null, slug: "demo", category: null, locality: null }); return { subject: d.subject, body: d.body, opening: d.opening, contactEmail: "o@example.test" }; })();
  const row = (o = {}) => ({ id: "c1", business_id: "b1", slug: "demo", stage: "sent", sent_at: "x", is_test: false, positioning: null, name: "Demo", category: "retail", locality: "Lerwick",
    is_active: true, is_claimed: true, has_owner: true, tier: "premium", plan_live: true, grant: { tier: "premium", expires_at: FUTURE }, has_preview: true, has_page_draft: true,
    invite: { status: "claimed", created_at: "2026-10-06T10:00:00Z", expires_at: FUTURE }, claim: { status: "approved", created_at: "x" }, setup_ready_at: null, live_at: null, ...o });
  test("13 · approved, not live → 'Owner approved — waiting for them to go live'; live → 'Live' with every step ✓", () => {
    const w = deriveWorkflow({ row: row(), claimMode: "live", email: GOOD, owner: { edited: true, approved: true, published: false } });
    assert.equal(w.headline, "Owner approved — waiting for them to go live"); assert.equal(w.current.id, "go_live");
    const live = deriveWorkflow({ row: row({ setup_ready_at: "x", live_at: "y" }), claimMode: "live", email: GOOD, owner: { edited: true, approved: true, published: true } });
    assert.equal(live.headline, "Live"); assert.equal(live.current, null); assert.ok(live.steps.every((s) => s.state === "complete"));
  });
  test("14 · there is no admin control that can set live — admins cannot publish for an owner", () => {
    const rail = read("components/admin/launch-partners/WorkflowRail.tsx");
    assert.doesNotMatch(rail, /live_at|setup_ready_at|go_live.*checkbox|type="checkbox"/);
  });
});
