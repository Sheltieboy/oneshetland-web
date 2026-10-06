/**
 * The launch-partner OWNER's setup: dashboard card, review, edit, approval — and the admin workflow reading the owner's real progress.
 * Nothing here publishes or imports anything; there is no draft → real-business mechanism, and these tests pin that down.
 * Run: node --test tests/launch-owner-setup.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { deriveOwnerLaunch, profileOf, overlayProfile, sameProfile, buildOwnerProfile } from "../lib/launch-partners/owner-setup.ts";
import { deriveWorkflow } from "../lib/launch-partners/workflow.ts";
import { defaultEmailDraft } from "../lib/launch-partners/email.ts";
import { parsePageDraft } from "../lib/launch-partners/validate.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const FUT = "2099-01-01T00:00:00Z", PAST = "2020-01-01T00:00:00Z";
const grant = (o = {}) => ({ expires_at: FUT, revoked_at: null, superseded_at: null, ...o });
const v = (kind, o = {}) => ({ id: `${kind}-1`, kind, created_at: "2026-10-07T10:00:00Z", ...o });
const input = (o = {}) => ({ hasCampaign: true, grants: [grant()], versions: [], ...o });
const draft = () => ({
  version: 1, emphasis: "story_then_shop",
  hero: { headline: "Studio", tagline: "Paintings from Walls.", eyebrow: "Art & prints", locality: "Walls", image: { src: "https://s.example/logo.png", alt: "x" }, treatment: "mosaic",
          gallery: [{ src: "https://s.example/a.jpg", alt: "a" }, { src: "https://s.example/b.jpg", alt: "b" }, { src: "https://s.example/c.jpg", alt: "c" }] },
  story: { title: "Painted from the hills", body: ["One."], source: "https://s.example/about" },
  useful: [{ title: "What we offer", body: ["Originals"] }],
  products: [{ id: "p", title: "Moorland Light", price: 450, image: "https://s.example/p.jpg", blurb: "" }],
  notes: "Drafted by Peerie Bot. Please check: …",
});

describe("The owner's launch state — read from real records", () => {
  test("1 · an ordinary claimed business (no launch campaign for it) → the normal dashboard: no card, no launch flow", () => {
    const o = deriveOwnerLaunch(input({ hasCampaign: false, grants: [] }));
    assert.equal(o.state, "none"); assert.equal(o.showCard, false);
    assert.equal(deriveOwnerLaunch(input({ hasCampaign: false })).showCard, false, "even a business with a grant");
  });
  test("a campaign with NO grant yet is also the normal dashboard (the task starts once Launch Partner access is active)", () => {
    const o = deriveOwnerLaunch(input({ grants: [] })); assert.equal(o.state, "none"); assert.equal(o.showCard, false);
  });
  test("2 · launch partner, claimed, grant active, setup incomplete → the prominent card, with the call to action and honest progress", () => {
    const o = deriveOwnerLaunch(input());
    assert.equal(o.state, "review"); assert.equal(o.showCard, true); assert.equal(o.title, "Your OneShetland setup is ready to review"); assert.equal(o.cta, "Review my launch setup");
    assert.match(o.body, /already prepared your business page and initial content/); assert.match(o.body, /Nothing is public until you say so/);
    assert.deepEqual(o.steps.map((s) => [s.label, s.state]), [["Business claimed", "done"], ["Launch Partner access active", "done"], ["Review your prepared page", "current"], ["Confirm your content", "todo"], ["Ready to go live", "todo"]]);
  });
  test("an owner who has started editing, then one who approved, move the card on — from the version records alone", () => {
    const e = deriveOwnerLaunch(input({ versions: [v("owner_edit")] })); assert.equal(e.state, "edited"); assert.equal(e.showCard, true); assert.equal(e.steps[3].state, "current");
    const a = deriveOwnerLaunch(input({ versions: [v("approved", { is_approved_current: true }), v("owner_edit")] }));
    assert.equal(a.state, "approved"); assert.equal(a.showCard, true); assert.equal(a.steps[3].state, "done"); assert.equal(a.steps[4].state, "current"); assert.equal(a.title, "Your setup is approved"); assert.equal(a.cta, "Go live on OneShetland"); assert.match(a.body, /Going live will make your approved OneShetland business page public/); assert.match(a.body, /optional/);
  });
  test("9/16 · a published (live) launch partner → the unfinished-task card is replaced by a compact success state; the ordinary dashboard is primary again", () => {
    const l = deriveOwnerLaunch(input({ versions: [v("published", { id: "p1", parent_id: "a1" }), v("approved", { id: "a1", is_approved_current: true })] }));
    assert.equal(l.state, "live"); assert.equal(l.title, "You’re live on OneShetland ✓"); assert.equal(l.cta, "View my page"); assert.ok(l.steps.every((s) => s.state === "done"));
    assert.equal(l.unpublishedChanges, false); assert.equal(l.approvalWaiting, false);
    const m = read("app/business/[id]/manage/page.tsx"); assert.match(m, /const launchPrompt = launch\.state === "review" \|\| launch\.state === "edited"/, "the generic 'Nothing needs you' stays suppressed only while a TASK is waiting, never once live");
    assert.equal(deriveOwnerLaunch(input({ grants: [grant({ revoked_at: PAST })], versions: [v("published", { id: "p1", parent_id: "a1" }), v("approved", { id: "a1", is_approved_current: true })] })).state, "live", "an ended grant does not un-live a published page");
  });
  test("10 · a revoked, expired or replaced grant → no 'ready to launch' flow at all", () => {
    for (const g of [grant({ revoked_at: PAST }), grant({ expires_at: PAST }), grant({ superseded_at: PAST })]) {
      const o = deriveOwnerLaunch(input({ grants: [g] })); assert.equal(o.state, "ended"); assert.equal(o.showCard, false); assert.equal(o.cta, "");
    }
    assert.equal(deriveOwnerLaunch(input({ grants: [grant({ revoked_at: PAST }), grant()] })).state, "review", "a fresh grant after a removed one reopens the setup");
    assert.equal(deriveOwnerLaunch(input({ grants: [grant({ revoked_at: PAST })], versions: [v("approved", { is_approved_current: true })] })).showCard, false, "even if they had approved");
  });
});

describe("Editing is private, and limited to what the database lets an owner save", () => {
  const edit = (o = {}) => ({ headline: "Studio", tagline: "My words.", eyebrow: "Art", locality: "Walls", treatment: "mosaic", keepGallery: ["https://s.example/a.jpg", "https://s.example/b.jpg", "https://s.example/c.jpg"], story: { title: "About", body: "One.\n\nTwo." }, useful: [{ title: "Offer", body: "Originals" }], ...o });
  test("6 · an edit builds a PROFILE only: hero, story, information sections — never products, notes or anything commercial", () => {
    const r = buildOwnerProfile(draft(), edit()); assert.ok(r.ok);
    assert.deepEqual(Object.keys(r.profile).sort(), ["emphasis", "hero", "story", "useful"]);
    assert.deepEqual(Object.keys(r.profile.hero).sort(), ["eyebrow", "gallery", "headline", "image", "locality", "tagline", "treatment"]);
    const flat = JSON.stringify(r.profile); assert.doesNotMatch(flat, /Moorland Light|products|notes|Peerie/);
    assert.deepEqual(r.profile.story.body, ["One.", "Two."]);
  });
  test("an owner can REMOVE pictures but cannot introduce one (no new address), and a mosaic needs three", () => {
    assert.ok(buildOwnerProfile(draft(), edit({ treatment: "photo", keepGallery: ["https://s.example/a.jpg"] })).ok);
    const bad = buildOwnerProfile(draft(), edit({ keepGallery: ["https://s.example/a.jpg", "https://evil.example/x.jpg"] })); assert.equal(bad.ok, false); assert.match(bad.error, /not add new ones/);
    const m = buildOwnerProfile(draft(), edit({ keepGallery: ["https://s.example/a.jpg"] })); assert.equal(m.ok, false); assert.match(m.error, /needs three pictures/);
    assert.equal(buildOwnerProfile(draft(), edit({ tagline: "  " })).ok, false); assert.equal(buildOwnerProfile(draft(), edit({ story: { title: "", body: "text" } })).ok, false);
    assert.equal(buildOwnerProfile(draft(), edit({ useful: Array.from({ length: 7 }, () => ({ title: "t", body: "b" })) })).ok, false);
  });
  test("an owner can remove their story and sections, and the overlaid page then lacks them (a saved profile is a whole snapshot)", () => {
    const r = buildOwnerProfile(draft(), edit({ story: null, useful: [], treatment: "photo", keepGallery: [] })); assert.ok(r.ok);
    const page = overlayProfile(draft(), r.profile); assert.equal(page.story, undefined); assert.equal(page.useful, undefined); assert.equal(page.hero.gallery, undefined);
    assert.equal(page.products.length, 1, "commerce examples still come from the prepared draft, untouched"); assert.match(page.notes, /Peerie Bot/);
    assert.ok(parsePageDraft(page).ok, "the result is a valid page under the same validator as any draft");
  });
  test("the overlaid page keeps everything outside the profile exactly as prepared; the prepared draft object is not modified", () => {
    const d = draft(); const frozen = JSON.stringify(d); const r = buildOwnerProfile(d, edit({ tagline: "Changed." }));
    const page = overlayProfile(d, r.profile); assert.equal(page.hero.tagline, "Changed."); assert.deepEqual(page.products, d.products); assert.equal(JSON.stringify(d), frozen);
    assert.equal(sameProfile(profileOf(d), profileOf(d)), true); assert.equal(sameProfile(profileOf(d), r.profile), false);
  });
});

describe("Safety: nothing is published or imported, and the owner is the only actor", () => {
  const walk = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((f) => { const p = `${dir}/${f}`; return statSync(new URL(`../${p}`, import.meta.url)).isDirectory() ? (f === "node_modules" || f === ".next" ? [] : walk(p)) : [p]; });
  const strip = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const ownerFiles = ["app/business/[id]/manage/launch-setup/actions.ts", "app/business/[id]/manage/launch-setup/page.tsx", "components/business/LaunchSetupEditor.tsx", "components/business/LaunchSetupCard.tsx", "lib/launch-partners/owner-setup.ts", "lib/launch-partners/owner-setup.server.ts"];
  test("5 · the prepared draft stays private: nothing in the owner flow writes the business, products, services, offers, passes, images or publication state", () => {
    const code = ownerFiles.map(strip).join("\n");
    assert.doesNotMatch(code, /\.from\(["'`](local_businesses|products|book_services|book_unit_items|local_offers|launch_partner_campaigns)/);
    assert.doesNotMatch(code, /\.(insert|upsert|delete)\(|\.update\(|\.storage\b|service_role|SERVICE_ROLE|setup_ready_at|live_at/i);
    assert.doesNotMatch(code, /product_import|import_set_row|createProduct|admin_launch_partner_update|admin_grant_launch_plan/);
  });
  test("6 · the only database writes are the three audited owner functions (save a private version; approve a version; go live with the approved one)", () => {
    const code = ownerFiles.map(strip).join("\n");
    const rpcs = [...code.matchAll(/\.rpc\(\s*["'`]([a-z_]+)["'`]/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(rpcs)].sort(), ["launch_partner_owner_approve", "launch_partner_owner_go_live", "launch_partner_owner_save_profile", "launch_partner_page_draft", "launch_partner_profile_versions", "launch_partner_publication_hold", "launch_partner_version_profile"]);   // publication_hold is a READ (no reason, nothing written)
    const a = strip("app/business/[id]/manage/launch-setup/actions.ts");
    assert.match(a, /^"use server"|\n"use server"/m); assert.equal((a.match(/launch_partner_owner_save_profile/g) ?? []).length, 2); assert.equal((a.match(/launch_partner_owner_approve/g) ?? []).length, 2, "approve: once for the owner's approval, once when publishing a later edit"); assert.equal((a.match(/launch_partner_owner_go_live/g) ?? []).length, 2);
  });
  test("3/4 · the owner is identified by the database, per business: every action starts with requireBusinessOwner(this id), the draft reader answers only the approved owner, and the page 404s otherwise", () => {
    const a = read("app/business/[id]/manage/launch-setup/actions.ts"); assert.match(a, /await requireBusinessOwner\(businessId, \{ returnPath/); assert.doesNotMatch(a, /businessId = |let businessId/);
    const p = read("app/business/[id]/manage/launch-setup/page.tsx"); assert.match(p, /requireBusinessOwner\(id, \{ returnPath/); assert.match(p, /if \(!ctx\.draft \|\| !ctx\.prepared\) notFound\(\)/);
    const s = read("lib/launch-partners/owner-setup.server.ts"); assert.match(s, /launch_partner_page_draft", \{ p_business_id: businessId \}/); assert.match(s, /if \(!row\) return none\(\)/);
    const d = read("app/business/[id]/manage/page-draft/page.tsx"); assert.match(d, /requireBusinessOwner\(id/); assert.match(d, /if \(!setup\.draft\) notFound\(\)/);
    const m = read("app/business/[id]/manage/page.tsx"); assert.match(m, /requireBusinessOwner\(id\)/); assert.match(m, /getOwnerLaunchSetup\(business\.id\)/, "the card is computed for the page's own, verified business");
  });
  test("3 · the card's link points at the SAME business's setup", () => {
    const m = read("app/business/[id]/manage/page.tsx"); assert.match(m, /<LaunchSetupCard launch=\{launch\} href=\{`\$\{base\}\/launch-setup`\} publicHref=\{`\/directory\/\$\{business\.id\}`\} \/>/); assert.match(m, /const base = `\/business\/\$\{business\.id\}\/manage`/);
    assert.match(read("components/business/LaunchSetupCard.tsx"), /href=\{href\}/);
  });
  test("2/9 · the card outranks 'Nothing needs you right now' and the ordinary Next suggestion only while a task is waiting; the ordinary dashboard is untouched otherwise", () => {
    const m = read("app/business/[id]/manage/page.tsx"); assert.match(m, /const launchPrompt = launch\.state === "review" \|\| launch\.state === "edited"/); assert.match(m, /\{launch\.showCard && /);
    const t = read("components/business/DashboardTop.tsx"); assert.match(t, /\{nothingWaiting && !launchOnboarding && \(/); assert.match(t, /\{next && !launchOnboarding && \(/); assert.match(t, /launchOnboarding = false/);
  });
  test("approval records the owner's agreement as a real version, from exactly what they saw; it publishes nothing", () => {
    const a = read("app/business/[id]/manage/launch-setup/actions.ts");
    assert.match(a, /const shown: OwnerProfile = profileOf\(ctx\.draft\)/); assert.match(a, /"Saved as shown, to be approved"/);
    assert.match(a, /if \(ctx\.launch\.state === "approved"\) return \{ ok: false, error: "You’ve already approved this setup\." \}/);
    assert.match(a, /!\["review", "edited"\]\.includes\(ctx\.launch\.state\)/, "no approving or editing when access has ended or it is already approved");
    const ui = read("components/business/LaunchSetupEditor.tsx"); assert.match(ui, /Approving does not publish anything/); assert.match(ui, /disabled=\{dirty \|\| !!busy\}/); assert.match(ui, /does not publish anything/);
  });
  test("no second onboarding content system: the owner flow reads the campaign's own draft and versions, and examples are shown as examples (no copy into the business)", () => {
    const p = read("app/business/[id]/manage/launch-setup/page.tsx"); assert.match(p, /not on sale/); assert.match(p, /They aren’t products or services on OneShetland/); assert.match(p, /nothing is copied into your business/);
    assert.match(p, /\/products\/import/); assert.doesNotMatch(read("components/business/LaunchSetupEditor.tsx"), /gbp\(|price:|pricePounds|\.products/, "the editor has no product or price fields at all");
  });
  test("the page is private to the owner and carries no admin controls, provenance or campaign internals", () => {
    const text = ["app/business/[id]/manage/launch-setup/page.tsx", "components/business/LaunchSetupEditor.tsx", "components/business/LaunchSetupCard.tsx"].map(read).join("\n");
    assert.doesNotMatch(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"), /Peerie Bot|provenance|enrichment|admin_|launch_partner_campaigns|campaignId/);
    assert.match(read("app/business/[id]/manage/launch-setup/page.tsx"), /robots: \{ index: false, follow: false, nocache: true \}/);
  });
});

describe("The admin workflow reflects the owner's real progress", () => {
  const d = defaultEmailDraft({ businessName: "Demo", opening: "x" });
  const email = { subject: d.subject, body: d.body, opening: d.opening, contactEmail: "o@example.test" };
  const row = (o = {}) => ({
    id: "c1", business_id: "b1", slug: "demo", stage: "sent", is_test: false, positioning: null, name: "Demo", category: "retail", locality: "x", is_active: true, is_claimed: true, has_owner: true, tier: "premium", plan_live: true,
    grant: { tier: "premium", expires_at: FUT }, invite: { status: "claimed", created_at: "x", expires_at: FUT }, claim: { status: "approved", created_at: "x" }, product_count: 0, active_product_count: 0, import_batch_count: 0,
    sent_at: "x", first_viewed_at: "x", last_viewed_at: "x", view_count: 1, setup_ready_at: null, live_at: null, has_preview: true, has_page_draft: true, has_email_draft: true, has_contact_email: true, last_activity: null, ...o });
  const w = (owner) => deriveWorkflow({ row: row(), claimMode: "live", email, owner });
  test("8 · granted, owner has done nothing → 'Waiting for owner review'", () => { const x = w({ edited: false, approved: false, published: false }); assert.equal(x.current.id, "owner_review"); assert.equal(x.headline, "Waiting for owner review"); assert.match(x.current.note, /Waiting for the owner to review/); });
  test("8 · the owner edited → 'Owner is editing — waiting for approval'", () => { const x = w({ edited: true, approved: false, published: false }); assert.equal(x.headline, "Owner is editing — waiting for approval"); assert.match(x.current.note, /started editing/); });
  test("7/8 · the owner approved → 'Owner review' is ticked from the approval record, and the next step is honest that it is the owner's call to go live", () => {
    const x = w({ edited: true, approved: true, published: false });
    assert.equal(x.steps.find((s) => s.id === "owner_review").state, "complete"); assert.equal(x.current.id, "go_live"); assert.equal(x.headline, "Owner approved — waiting for them to go live");
    assert.match(x.current.note, /Nothing is public until they choose to go live/);
  });
  test("there is no admin checkbox: the input is only the owner's real actions, and the page derives them from the campaign's own records", () => {
    const page = read("app/admin/launch-partners/[id]/page.tsx");
    assert.match(page, /owner: \{ edited: \(c\.versions \?\? \[\]\)\.some\(\(v\) => v\.kind === "owner_edit"\), approved: !!c\.approved_at, published: !!c\.published_version_id \}/);
    const code = read("lib/launch-partners/workflow.ts").replace(/\/\*[\s\S]*?\*\//g, ""); assert.doesNotMatch(code, /useState|setApproved|localStorage|fetch\(/);
  });
  test("the admin status line no longer says the owner should add their catalogue; it names the real wait", () => {
    const s = read("lib/launch-partners/status.ts"); assert.doesNotMatch(s, /Let them add their catalogue/); assert.match(s, /Wait for the owner to review and approve their setup/); assert.match(s, /waiting for them to go live/);
  });
  test("a removed grant after the owner approved is still flagged to the admin, not hidden by the approval", () => {
    const x = deriveWorkflow({ row: row({ grant: null }), claimMode: "live", email, lastGrant: { status: "revoked", expires_at: PAST }, owner: { edited: true, approved: true, published: false } });
    assert.deepEqual([x.current.id, x.current.state], ["grant", "attention"]);
  });
});
