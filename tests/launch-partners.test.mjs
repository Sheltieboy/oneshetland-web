/**
 * Launch-partner management — pipeline status, invitation email, draft/validation rules, Business Page V2 section rules.
 * Run: node --test tests/launch-partners.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { derivePipelineStatus, nextAction, countByStatus, pipelineCells, STATUS_ORDER } from "../lib/launch-partners/status.ts";
import { defaultEmailDraft, classifyDraft, ACTIVE_EMAIL_TEMPLATE, renderInvitationEmail, checkEmail, emailStatus, isOpeningPrompt, openingPrompt, TOKEN_CTA, TOKEN_OPENING, LINK_PLACEHOLDER, NO_INVITATION_TITLE, CTA_LABEL, CTA_FALLBACK_LINE } from "../lib/launch-partners/email.ts";
import { evaluateSendGates, GATE_MESSAGE } from "../lib/launch-partners/send-core.ts";
import { listingState, prepareEligibility, eligibilityOf, LISTING_LABEL } from "../lib/launch-partners/eligibility.ts";
import { parsePreviewConfig, parsePageDraft, isSafeUrl } from "../lib/launch-partners/validate.ts";
import { buildPageDraft } from "../lib/launch-partners/draft.ts";
import { planSections, availability, heroActions, chooseHeroVisual, enforceLive, MAX_HERO_ACTIONS } from "../lib/business-page/sections.ts";
import { PREPARED_COPY } from "../lib/business-page/prepared-copy.ts";
import { buildBusinessPageModel } from "../lib/business-page/model.ts";
import { getPreviewConfig, previewSlugs } from "../lib/launch-preview/registry.ts";
import { CATALOGUE_OPTIONS } from "../lib/launch-preview/catalogue.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const walkSrc = (d) => { const root = new URL("../", import.meta.url).pathname; const out = []; const go = (p) => { for (const f of readdirSync(p)) { const q = join(p, f); statSync(q).isDirectory() ? go(q) : /\.(ts|tsx)$/.test(q) && out.push(q); } }; go(join(root, d)); return out; };

const row = (o = {}) => ({
  id: "c1", business_id: "b1", slug: "demo-shop", stage: "candidate", is_test: false, positioning: null, name: "Demo", category: "retail", locality: "Lerwick",
  is_active: true, is_claimed: false, has_owner: false, tier: "free", plan_live: false, grant: null,
  invite: { status: "none", created_at: null, expires_at: null }, claim: null, product_count: 0, active_product_count: 0, import_batch_count: 0,
  sent_at: null, first_viewed_at: null, last_viewed_at: null, view_count: 0, setup_ready_at: null, live_at: null,
  has_preview: false, has_page_draft: false, has_email_draft: false, has_contact_email: false, last_activity: null, ...o,
});

describe("pipeline status is derived from real facts", () => {
  test("the editorial stages map straight through", () => {
    assert.equal(derivePipelineStatus(row()), "candidate");
    assert.equal(derivePipelineStatus(row({ stage: "preparing" })), "preparing");
    assert.equal(derivePipelineStatus(row({ stage: "ready_to_invite" })), "ready_to_invite");
    assert.equal(derivePipelineStatus(row({ stage: "sent", sent_at: "2026-10-06" })), "sent");
    assert.equal(derivePipelineStatus(row({ stage: "archived" })), "archived");
  });
  test("viewed needs a view and an invitation that has not been revoked", () => {
    assert.equal(derivePipelineStatus(row({ stage: "sent", first_viewed_at: "2026-10-07", invite: { status: "open" } })), "viewed");
    assert.equal(derivePipelineStatus(row({ stage: "sent", sent_at: "x", first_viewed_at: "2026-10-07", invite: { status: "revoked" } })), "sent");
  });
  test("a claim is derived from business_claims, not from anything Darren typed", () => {
    assert.equal(derivePipelineStatus(row({ stage: "sent", claim: { status: "pending", created_at: "x" } })), "claim_submitted");
    // rejected: back to wherever they were
    assert.equal(derivePipelineStatus(row({ stage: "sent", first_viewed_at: "x", claim: { status: "rejected", created_at: "x" } })), "viewed");
  });
  test("claimed → setting up → ready to go live → live", () => {
    const claimed = { claim: { status: "approved", created_at: "x" }, has_owner: true, stage: "sent" };
    assert.equal(derivePipelineStatus(row(claimed)), "claimed");
    assert.equal(derivePipelineStatus(row({ ...claimed, grant: { tier: "premium", expires_at: "x" } })), "setting_up");
    assert.equal(derivePipelineStatus(row({ ...claimed, product_count: 3 })), "setting_up");
    assert.equal(derivePipelineStatus(row({ ...claimed, setup_ready_at: "x" })), "ready_to_go_live");
    assert.equal(derivePipelineStatus(row({ ...claimed, setup_ready_at: "x", live_at: "y" })), "live");
  });
  test("an approved claim without an owner is NOT treated as claimed", () => {
    assert.equal(derivePipelineStatus(row({ stage: "sent", claim: { status: "approved", created_at: "x" }, has_owner: false })), "sent");
  });
  test("nothing can reach 'live' or 'ready to go live' without the explicit reserved timestamps", () => {
    for (const stage of ["candidate", "preparing", "ready_to_invite", "sent"]) assert.ok(!["live", "ready_to_go_live"].includes(derivePipelineStatus(row({ stage }))));
  });
  test("every status has a next action and the counts add up", () => {
    const rows = STATUS_ORDER.map((s, i) => row({ id: String(i), stage: s === "preparing" ? "preparing" : "candidate" }));
    for (const r of rows) assert.ok(nextAction(r).length > 3);
    assert.equal(Object.values(countByStatus(rows)).reduce((a, b) => a + b, 0), rows.length);
  });
  test("next action walks the preparation: preview, then page, then invitation, then the email", () => {
    assert.match(nextAction(row({ stage: "preparing" })), /launch preview/i);
    assert.match(nextAction(row({ stage: "preparing", has_preview: true })), /business page/i);
    assert.match(nextAction(row({ stage: "preparing", has_preview: true, has_page_draft: true })), /mark it ready/i);
    assert.match(nextAction(row({ stage: "ready_to_invite", has_preview: true })), /private invitation/i);
    assert.match(nextAction(row({ stage: "ready_to_invite", invite: { status: "open" } })), /contact and write the email/i);
    assert.match(nextAction(row({ stage: "ready_to_invite", invite: { status: "open" }, has_contact_email: true, has_email_draft: true })), /yourself/i);
  });
  test("the glance cells show the right facts", () => {
    const c = pipelineCells(row({ has_preview: true, invite: { status: "open" }, first_viewed_at: "x", view_count: 3, grant: { tier: "premium", expires_at: "x" }, product_count: 4, active_product_count: 0, import_batch_count: 1 }));
    assert.equal(c.preview.label, "✓"); assert.equal(c.viewed.label, "✓ ×3"); assert.equal(c.plan.label, "premium (launch)"); assert.equal(c.products.label, "4 (0 live)");
  });
});

const LFS_OPENING = "You make something genuinely Shetland, and I think more locals and visitors should be able to find what you do easily.";
const TOKEN64 = "7f3a9c1e5b2d4f60a8c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1";
const URL64 = `https://oneshetland.com/launch/love-from-shetland?invite=${TOKEN64}`;

describe("the standard outreach email", () => {
  test("a new campaign's draft is the approved PRE-LAUNCH template, with the business name substituted", () => {
    const d = defaultEmailDraft({ businessName: "Love From Shetland", opening: LFS_OPENING });
    assert.equal(ACTIVE_EMAIL_TEMPLATE, "prelaunch");
    assert.equal(d.subject, "I’ve made a private OneShetland preview for Love From Shetland");
    assert.equal(d.opening, LFS_OPENING);
    for (const line of ["Hello,", "I’m Darren, and I’m getting ready to launch OneShetland — a new locally built platform designed to bring more of Shetland into one place.",
      "It will help locals and visitors discover Shetland businesses, events, things to do, products, bookings, offers and community activity through one website and app.",
      "Before launch, I’m inviting a small number of Shetland businesses to become launch partners, and Love From Shetland is one of the businesses I’d really like to include.",
      "Rather than just emailing you a description of OneShetland, I’ve made a private preview specifically for Love From Shetland, using information that is already publicly available, so you can actually see how it could work for you.",
      "A few important things before you look:", "• It’s completely private — only someone with your invitation link can see it.", "• Nothing is live or published.", "• You don’t need to join or claim anything just to have a look.",
      "• If you do want to take part, launch partners get complimentary Premium access, and I’ll personally help you get set up.", "• You stay in control — nothing goes live until you review it and approve it yourself.",
      "If you like what you see, you can claim the business from there and take it at your own pace. And if it’s not for you, absolutely no problem.", "Darren\nDarren Fullerton\nOneShetland"]) assert.ok(d.body.includes(line), line);
    assert.ok(d.body.includes(TOKEN_OPENING) && d.body.includes(TOKEN_CTA), "the opening and the call to action stay as tokens");
    assert.ok(!d.body.includes("{{BUSINESS_NAME}}"), "no unfilled business-name token");
    assert.equal(d.body.split("Love From Shetland").length - 1, 2, "the business name is substituted wherever the template uses it");
    assert.equal(d.body.split(TOKEN_CTA).length, 2, "exactly one call to action");
  });
  test("the template says OneShetland has NOT launched, and never implies it is established, populated or live", () => {
    for (const name of ["Love From Shetland", "The Dowry"]) {
      const d = defaultEmailDraft({ businessName: name, opening: LFS_OPENING });
      const all = `${d.subject}\n${d.body}`;
      assert.match(all, /getting ready to launch/); assert.match(all, /Before launch/); assert.match(all, /a new locally built platform/); assert.match(all, /It will help/);
      const claims = /OneShetland (is|has) (now |already )?(live|launched|established|open|busy)|already (live|launched|using|participating|on OneShetland|signed up|joined)|(businesses|partners|locals|visitors) (already|are already|have already|are using|are now)|join(ed)? (the )?(many|hundreds|thousands|other)|trusted by|over \d+|\b\d+\+? (businesses|partners|users)|now live|is live now|launched in|since launch/i;
      assert.doesNotMatch(all, claims, "no wording that implies it has launched or is already used");
    }
  });
  test("only the Love From Shetland opening is researched; every other business gets the prompt", () => {
    assert.ok(isOpeningPrompt(defaultEmailDraft({ businessName: "The Dowry" }).opening));
  });
  test("template modes: pre-launch is active, a post-launch template is reserved but deliberately not written yet", () => {
    assert.throws(() => defaultEmailDraft({ businessName: "X", mode: "live" }), /no outreach email template for "live" yet/i);
    assert.equal(defaultEmailDraft({ businessName: "X", mode: "prelaunch" }).body, defaultEmailDraft({ businessName: "X" }).body, "default = the active mode");
    assert.match(read("lib/launch-partners/email.ts"), /export const ACTIVE_EMAIL_TEMPLATE: EmailTemplateMode = "prelaunch"/);
  });
  test("an untouched earlier default is recognised as safely upgradable; anything edited is preserved", () => {
    const name = "Love From Shetland";
    const cur = defaultEmailDraft({ businessName: name, opening: LFS_OPENING });
    assert.equal(classifyDraft({ subject: cur.subject, body: cur.body }, name), "current");
    // the previous approved default (exactly as it was stored in production)
    const legacySubject = `I made a private OneShetland preview for ${name}`;
    const legacyBody = ["Hello,", "", `I’ve made a private OneShetland preview for ${name}.`, "", TOKEN_OPENING, "", `I’ve put together an example of how ${name} could look on OneShetland, using only information already publicly available.`, "",
      "A few important things before you look:", "", "• It’s completely private — only someone with your invitation link can see it.", "• Nothing is live or published.", "• You don’t need to join or claim anything just to have a look.",
      "• If you do want to take part, launch partners get complimentary Premium access, and I’ll help you get set up.", "• You stay in control — nothing goes live until you review it and approve it yourself.", "", TOKEN_CTA, "",
      "If you like it, you can claim the business from the preview and take it from there. And if it’s not for you, absolutely no problem.", "", "Darren", "Darren Fullerton", "OneShetland"].join("\n");
    assert.equal(classifyDraft({ subject: legacySubject, body: legacyBody }, name), "upgradable");
    assert.equal(classifyDraft({ subject: legacySubject + "!", body: legacyBody }, name), "edited", "a one-character subject edit is a human edit");
    assert.equal(classifyDraft({ subject: legacySubject, body: legacyBody.replace("absolutely no problem", "no worries at all") }, name), "edited");
    assert.equal(classifyDraft({ subject: cur.subject, body: cur.body + "\nPS" }, name), "edited");
    assert.equal(classifyDraft({ subject: null, body: null }, name), "empty");
    assert.equal(classifyDraft({ subject: legacySubject, body: legacyBody }, "The Dowry"), "edited", "a draft for another business is not an untouched copy");
  });
  test("the opening is never invented: without a researched line the draft carries a clear prompt for Darren", () => {
    const d = defaultEmailDraft({ businessName: "The Dowry" });
    assert.ok(isOpeningPrompt(d.opening)); assert.equal(d.opening, openingPrompt("The Dowry")); assert.match(d.opening, /Replace this line before sending/);
    assert.equal(defaultEmailDraft({ businessName: "X", opening: "   " }).opening, openingPrompt("X"));
    assert.doesNotMatch(read("lib/launch-partners/email.ts"), /genuinely Shetland/, "no marketing line is baked into the generator");
  });
  test("only the Love From Shetland config carries a researched opening, and it is the approved sentence", () => {
    assert.equal(getPreviewConfig("love-from-shetland").outreachOpening, LFS_OPENING);
    for (const slug of previewSlugs().filter((x) => x !== "love-from-shetland")) assert.equal(getPreviewConfig(slug).outreachOpening, undefined, slug);
  });
  test("every campaign creation path generates the draft through the same function — nothing is hand-coded per business", () => {
    const m = read("lib/launch-partners/campaigns.server.ts"), a = read("app/admin/launch-partners/actions.ts");
    assert.match(m, /export async function createCampaignWithDraft/); assert.match(m, /defaultEmailDraft\(\{ businessName: a\.businessName, opening: a\.opening \}\)/);
    assert.match(m, /createCampaignWithDraft\(\{ businessName: cfg\.businessName, opening: cfg\.outreachOpening \?\? null/);
    assert.match(a, /createCampaignWithDraft\(\{ businessName: rec\.name, opening: null/);
    assert.doesNotMatch(m + a, /Love From Shetland/, "no campaign-specific email text in the generators");
    assert.equal((m.match(/updateCampaign\([^)]*email_/g) ?? []).length, 1, "the draft is written in one place only");
  });
  test("edits are preserved: a draft is regenerated only on creation or an explicit reset", () => {
    const a = read("app/admin/launch-partners/actions.ts");
    const writers = [...a.matchAll(/defaultEmailDraft\(/g)].length;
    assert.equal(writers, 1, "defaultEmailDraft is called from the reset action only (creation goes through createCampaignWithDraft)");
    const reset = a.slice(a.indexOf("export async function resetEmailToDefaultAction"), a.indexOf("export async function sendInvitationEmailAction"));
    assert.match(reset, /defaultEmailDraft/); assert.match(reset, /await requireAdmin\(\)/);
    for (const other of ["savePreviewAction", "savePageDraftAction", "savePositioningAction", "setStageAction"]) assert.doesNotMatch(a.slice(a.indexOf(`export async function ${other}`), a.indexOf(`export async function ${other}`) + 900).split("export async function")[1] ?? "", /email_(subject|body|opening)/, `${other} must not touch the email`);
    const ui = read("components/admin/launch-partners/EmailSection.tsx");
    assert.match(ui, /Reset to default template/); assert.match(ui, /This <strong>replaces<\/strong> the current subject, personalised opening and message/); assert.match(ui, /danger: true/);
  });
});

describe("the email as rendered", () => {
  const d = defaultEmailDraft({ businessName: "Love From Shetland", opening: LFS_OPENING });
  test("before an invitation exists there is no link anywhere and the preview says so", () => {
    const r = renderInvitationEmail({ ...d, businessName: "Love From Shetland" });
    assert.equal(r.hasInvitation, false);
    for (const out of [r.html, r.text]) { assert.doesNotMatch(out, /invite=/); assert.doesNotMatch(out, /https?:\/\/oneshetland\.com\/launch/); assert.ok(out.includes(NO_INVITATION_TITLE)); }
    assert.match(r.html, /inserted here when you generate the invitation/); assert.doesNotMatch(r.html, /<a /, "no link element at all");
    assert.ok(r.html.includes(LFS_OPENING) && r.text.includes(LFS_OPENING), "the opening is substituted");
  });
  test("with an invitation the HTML has the primary button, linked, and the copy-and-paste fallback beneath it", () => {
    const r = renderInvitationEmail({ ...d, businessName: "Love From Shetland", invitationUrl: URL64 });
    assert.equal(r.hasInvitation, true);
    assert.ok(r.html.includes(`href="${URL64}"`) && r.html.includes(CTA_LABEL), "button text and href");
    const iBtn = r.html.indexOf(CTA_LABEL), iFall = r.html.indexOf(CTA_FALLBACK_LINE), iUrl = r.html.indexOf(URL64, iFall);
    assert.ok(iBtn > 0 && iFall > iBtn && iUrl > iFall, "fallback line, then the full URL, directly beneath the button");
    assert.equal(r.html.split(URL64).length - 1, 2, "the URL appears exactly twice: the link and the fallback text");
    assert.match(r.html, /<ul /); assert.equal((r.html.match(/<li /g) ?? []).length, 5);
  });
  test("the plain-text email uses 'View your private preview: {link}'", () => {
    const r = renderInvitationEmail({ ...d, businessName: "Love From Shetland", invitationUrl: URL64 });
    assert.ok(r.text.includes(`View your private preview: ${URL64}`)); assert.equal(r.text.split(URL64).length, 2, "once, in plain text");
    assert.ok(!r.text.includes("{{") && !r.html.includes("{{"), "no unresolved token");
  });
  test("recipient-controlled and admin-typed text is escaped in the HTML, and only http(s) can become a link", () => {
    const r = renderInvitationEmail({ subject: "<b>x</b>", body: "Hi <script>alert(1)</script>\n\n" + TOKEN_CTA, opening: "a & b", invitationUrl: "javascript:alert(1)" });
    assert.doesNotMatch(r.html, /<script|javascript:/); assert.equal(r.hasInvitation, false);
    assert.match(r.html, /&lt;script&gt;/); assert.match(r.html, /<title>&lt;b&gt;x&lt;\/b&gt;<\/title>/);
    assert.equal(renderInvitationEmail({ subject: "s", body: TOKEN_CTA, invitationUrl: 'https://x.example/a"onmouseover="y' }).hasInvitation, false);
  });
  test("an old draft that used {{INVITATION_LINK}} still renders the same call to action", () => {
    const r = renderInvitationEmail({ subject: "s", body: "Hi\n\n" + LINK_PLACEHOLDER, invitationUrl: URL64 });
    assert.ok(r.html.includes(CTA_LABEL) && r.text.includes(`View your private preview: ${URL64}`));
  });
  test("the token never appears in a rendered draft unless a real link was supplied, and a draft containing one is refused", () => {
    const noLink = renderInvitationEmail({ ...d, businessName: "x", maskedUrl: "https://oneshetland.com/launch/x?invite=[the real link is shown once]" });
    assert.doesNotMatch(noLink.html + noLink.text, /invite=[0-9a-f]{20,}/);
    assert.equal(checkEmail({ ...d, contactEmail: "a@b.co" }).ok, true);
    assert.equal(checkEmail({ ...d, body: d.body.replace(TOKEN_CTA, URL64), contactEmail: "a@b.co" }).ok, false);
    assert.equal(checkEmail({ ...d, opening: URL64, contactEmail: "a@b.co" }).ok, false);
    assert.equal(checkEmail({ ...d, opening: openingPrompt("X"), contactEmail: "a@b.co" }).ok, false, "the prompt must be replaced");
  });
});

describe("email status", () => {
  const base = { sentAt: null, contactEmail: "a@b.co", subject: "s", body: `x ${TOKEN_CTA}`, opening: "my line", stage: "preparing", invitation: { status: "none", expiresAt: null } };
  test("Contact missing → Draft needed → Draft ready → Invitation needed → Ready to send → Sent", () => {
    assert.equal(emailStatus({ ...base, contactEmail: null }), "contact_missing");
    assert.equal(emailStatus({ ...base, opening: openingPrompt("X") }), "draft_needed");
    assert.equal(emailStatus(base), "draft_ready");
    assert.equal(emailStatus({ ...base, stage: "ready_to_invite" }), "invitation_needed");
    assert.equal(emailStatus({ ...base, stage: "ready_to_invite", invitation: { status: "open", expiresAt: "2999-01-01" } }), "ready_to_send");
    assert.equal(emailStatus({ ...base, stage: "ready_to_invite", invitation: { status: "open", expiresAt: "2000-01-01" } }), "invitation_needed", "an expired invitation is not ready");
    assert.equal(emailStatus({ ...base, sentAt: "2026-10-06" }), "sent");
  });
});

describe("sending: the web app only asks — the Supabase Edge Function sends", () => {
  const draft = defaultEmailDraft({ businessName: "Love From Shetland", opening: LFS_OPENING });
  const future = new Date(Date.now() + 7 * 864e5).toISOString();
  const ok = () => ({
    campaign: { id: "c1", slug: "love-from-shetland", businessName: "Love From Shetland", stage: "ready_to_invite", sentAt: null, contactEmail: "hello@example.test", subject: draft.subject, opening: draft.opening, body: draft.body },
    invitation: { status: "open", expiresAt: future, tokenValidForThisBusiness: true }, invitationUrl: URL64,
    confirmation: { confirm: true, recipient: "hello@example.test", subject: draft.subject },
  });
  const now = { now: () => new Date() };

  test("the Admin pre-check names each missing requirement (the function re-checks every one itself)", () => {
    assert.deepEqual(evaluateSendGates(ok(), now), []);
    const cases = [
      ["not_confirmed", (i) => { i.confirmation = null; }], ["contact_missing", (i) => { i.campaign.contactEmail = null; }], ["contact_invalid", (i) => { i.campaign.contactEmail = "nope"; i.confirmation.recipient = "nope"; }],
      ["draft_incomplete", (i) => { i.campaign.opening = openingPrompt("X"); }], ["not_ready", (i) => { i.campaign.stage = "preparing"; }], ["already_sent", (i) => { i.campaign.sentAt = "2026-10-06"; }],
      ["invitation_invalid", (i) => { i.invitation.status = "revoked"; }], ["invitation_expired", (i) => { i.invitation.expiresAt = "2000-01-01T00:00:00Z"; }], ["link_missing", (i) => { i.invitationUrl = null; }],
      ["recipient_changed", (i) => { i.confirmation.recipient = "other@example.test"; }], ["subject_changed", (i) => { i.confirmation.subject = "older"; }],
    ];
    for (const [gate, mutate] of cases) { const i = ok(); mutate(i); assert.ok(evaluateSendGates(i, now).includes(gate), gate); }
    for (const g of Object.keys(GATE_MESSAGE)) assert.ok(GATE_MESSAGE[g].length > 10, g);
  });
  test("golden vectors: the web renderer, checks and gates produce exactly what the Edge Function's copy is tested against", () => {
    const g = JSON.parse(read("tests/fixtures/launch-invitation-email.golden.json"));
    for (const r of g.renders) assert.deepEqual(renderInvitationEmail(r.input), r.expected, `render ${r.name}`);
    for (const c of g.checks) assert.deepEqual(checkEmail(c.input), c.expected, `check ${c.name}`);
    for (const t of g.gates) {
      const i = t.input;
      const got = evaluateSendGates({ campaign: { id: "c", slug: "love-from-shetland", businessName: "Love From Shetland", stage: i.stage, sentAt: i.sentAt, contactEmail: i.contactEmail, subject: i.subject, opening: i.opening, body: i.body },
        invitation: { status: i.invitationStatus, expiresAt: i.expiresAt, tokenValidForThisBusiness: i.tokenValid }, invitationUrl: URL64, confirmation: i.confirm }, { now: () => new Date(t.nowIso) });
      assert.deepEqual([...got].sort(), t.expected, `gates ${t.name}`);
    }
  });
  test("when the sibling repo is present, its golden file is byte-identical (the two copies cannot drift)", () => {
    const other = new URL("../../../../../../../Users/darrenfullerton/Claude/oneshetland-delivers/supabase/functions/_shared/launch-invitation-email.golden.json", import.meta.url);
    let theirs = null; try { theirs = readFileSync(other, "utf8"); } catch { /* sibling repo not checked out here */ }
    if (theirs !== null) assert.equal(theirs, read("tests/fixtures/launch-invitation-email.golden.json"));
  });
  test("the web app contains NO mail transport, NO provider key and NO path to the provider", () => {
    const all = ["app", "components", "lib"].flatMap((d) => walkSrc(d));
    for (const f of all) assert.doesNotMatch(readFileSync(f, "utf8"), /process\.env\.(POSTMARK|LAUNCH_OUTREACH)|api\.postmarkapp\.com|TrackOpens|TrackLinks|MailTransport|configuredTransport/, f);
    for (const f of all.filter((f) => /launch-partners|launch-preview|business-page|\/launch\//.test(f))) assert.doesNotMatch(readFileSync(f, "utf8"), /postmark/i, `${f} must not mention the provider`);
    assert.ok(!all.some((f) => f.endsWith("send.server.ts")), "the web-side transport module is gone");
    assert.doesNotMatch(read("next.config.ts"), /POSTMARK|LAUNCH_OUTREACH/);
  });
  test("the send action asks the Edge Function (as the signed-in admin), carries only id + token + confirmation, and never records a send itself", () => {
    const a = read("app/admin/launch-partners/actions.ts");
    const start = a.indexOf("export async function sendInvitationEmailAction"); const fn = a.slice(start, a.indexOf("export async function", start + 10));
    assert.match(fn, /await requireAdmin\(\)/); assert.match(fn, /functions\.invoke\("send-launch-invitation"/); assert.match(fn, /Authorization: `Bearer \$\{session\.access_token\}`/);
    assert.match(fn, /body: \{ campaign_id: id, invite_token: m\[2\], confirm: \{/);
    for (const forbidden of ["markSent(", "setStage(", "updateCampaign(", "email_body", "contact_email", "recipient:"].filter((x) => x !== "recipient:")) assert.ok(!fn.includes(forbidden), `the action must not touch ${forbidden}`);
    assert.match(fn, /nothing was recorded as sent/);
    const callers = ["app", "components", "lib"].flatMap((d) => walkSrc(d)).filter((f) => /functions\.invoke\("send-launch-invitation"/.test(readFileSync(f, "utf8"))).map((f) => f.split("/").slice(-2).join("/"));
    assert.deepEqual(callers, ["launch-partners/actions.ts"]);
  });
  test("the confirmation dialog shows business, recipient, subject and expiry before anything is sent", () => {
    const ui = read("components/admin/launch-partners/EmailSection.tsx");
    assert.match(ui, /title: "Send the invitation email\?"/); for (const w of ["Business", "Recipient", "Subject", "Invitation expires"]) assert.ok(ui.includes(w), w);
    assert.match(ui, /sendInvitationEmailAction\(row\.id, path, \{ confirm: true, recipient: saved\.contactEmail, subject: saved\.subject \}\)/);
  });
  test("the invitation token is confined: built into a URL only where it is generated", () => {
    const holders = ["app", "components", "lib"].flatMap((d) => walkSrc(d)).filter((f) => /invite=\$\{/.test(readFileSync(f, "utf8"))).map((f) => f.split("/").slice(-2).join("/")).sort();
    assert.deepEqual(holders, ["admin/LaunchInvites.tsx", "launch-partners/actions.ts"].sort());
    for (const f of ["components/admin/launch-partners/Pipeline.tsx", "app/admin/launch-partners/[id]/page.tsx", "app/admin/launch-partners/page.tsx"]) assert.doesNotMatch(read(f), /invite=\$|issueInvitation|token/i, `${f} must not touch the token`);
    assert.doesNotMatch(read("lib/launch-partners/campaigns.server.ts"), /invite=\$/);
  });
  test("replacing an invitation that was already EMAILED needs its own explicit confirmation, server-side too", () => {
    const a = read("app/admin/launch-partners/actions.ts");
    assert.match(a, /if \(c\.sent_at && !opts\.replaceSent\)/);
    const ui = read("components/admin/launch-partners/InvitationSection.tsx");
    assert.match(ui, /Replace an invitation that was already emailed\?/); assert.match(ui, /replaceSent: !!row\.sent_at/);
  });
  test("no test in this file sends to a real address", () => {
    const here = read("tests/launch-partners.test.mjs");
    assert.doesNotMatch(here.replace(/hello@oneshetland\.com|hello@example\.test|other@example\.test|someone-else@example\.test|me@example\.test|a@b\.co|d@example\.test|nope/g, ""), /@(gmail|outlook|yahoo|hotmail|oneshetland\.com)/i);
  });
});

describe("private outreach content never reaches public output", () => {
  test("the template and renderer are imported only by the admin launch-partner code (and the send path)", () => {
    const users = ["app", "components", "lib"].flatMap((d) => walkSrc(d)).filter((f) => /launch-partners\/email["']|from "\.\/email"|from "\.\.\/launch-partners\/email"/.test(readFileSync(f, "utf8")) && !f.includes("lib/launch-partners/email.ts"))
      .map((f) => f.split("/").slice(-3).join("/")).sort();
    for (const u of users) assert.match(u, /launch-partners|admin\/launch-partners|send/, `unexpected importer of the outreach email: ${u}`);
    for (const f of walkSrc("app").concat(walkSrc("components")).filter((f) => !/admin|launch-partners|launch\//.test(f))) assert.doesNotMatch(readFileSync(f, "utf8"), /getting ready to launch|launch partners get complimentary|INVITATION_CTA|defaultEmailDraft/, `${f} must not carry outreach content`);
  });
  test("the outreach copy appears in no public page source, no sitemap and no API route", () => {
    for (const f of walkSrc("app/api")) assert.doesNotMatch(readFileSync(f, "utf8"), /launch-partners\/email|outreach|INVITATION_CTA/, f);
    assert.doesNotMatch(read("app/sitemap.ts"), /launch|outreach/);
  });
});


describe("Directory eligibility: the card and the Prepare action cannot contradict each other", () => {
  const ALL = [{ is_active: true, publicly_visible: true }, { is_active: true, publicly_visible: false }, { is_active: false, publicly_visible: false }, { is_active: false, publicly_visible: true }];

  test("THE reported contradiction: an active test fixture hidden from public discovery is NOT labelled 'Publicly listed' — and it CAN be prepared", () => {
    const fixture = { is_active: true, publicly_visible: false }; // ZZ TEST — OneShetland Acceptance Fixture (active, registered in discovery_fixtures)
    const e = eligibilityOf(fixture);
    assert.equal(e.state, "hidden_from_public"); assert.equal(e.label, "Hidden from public discovery"); assert.notEqual(e.label, LISTING_LABEL.listed);
    assert.equal(e.canPrepare, true); assert.equal(e.reason, null);
    assert.equal(prepareEligibility(fixture).ok, true, "the action and the card agree: no 'isn't in the public Directory' error for this record");
  });
  test("'Publicly listed' appears only when an anonymous visitor really sees the business", () => {
    for (const f of ALL) assert.equal(eligibilityOf(f).label === "Publicly listed", f.is_active && f.publicly_visible, JSON.stringify(f));
    assert.equal(listingState({ is_active: false, publicly_visible: true }), "unlisted", "an inactive record is never reported as listed");
  });
  test("preparing is blocked exactly when the card says 'Not publicly listed' (inactive) — never for a listed or hidden-fixture business", () => {
    for (const f of ALL) { const e = eligibilityOf(f); assert.equal(e.canPrepare, f.is_active, JSON.stringify(f)); assert.equal(!e.canPrepare, e.state === "unlisted"); assert.equal(!e.canPrepare, e.reason !== null); }
    assert.match(prepareEligibility({ is_active: false, publicly_visible: false }).reason, /isn't active in the OneShetland Directory/);
  });
  test("the old contradictory message is gone, and the card and the action share ONE eligibility function", () => {
    const a = read("app/admin/launch-partners/actions.ts"), card = read("components/admin/launch-partners/PrepareLaunchPartner.tsx");
    assert.doesNotMatch(a + card, /isn't in the public Directory/);
    assert.match(a, /prepareEligibility\(cand\)/); assert.match(card, /eligibilityOf\(c\)/);
    assert.match(card, /<StatusPill label=\{el\.label\} tone=\{el\.tone\} \/>/); assert.doesNotMatch(card, /"Publicly listed"/, "the card never hard-codes the label from a raw flag");
    assert.match(card, /disabled=\{busy !== null \|\| !el\.canPrepare\}/);
  });
  test("both read the same facts: the action re-queries the SAME candidate lookup the search uses (public visibility asked of the anonymous view)", () => {
    const m = read("lib/launch-partners/campaigns.server.ts"), a = read("app/admin/launch-partners/actions.ts");
    assert.match(m, /export async function candidateFor/); assert.match(m, /publicClient\(\)\.from\("local_businesses_public"\)\.select\("id"\)\.in\("id"/);
    assert.match(m, /publicly_visible: r\.is_active && visible\.has\(r\.business_id\)/);
    assert.match(a, /candidateFor\(input\.businessId\)/);
  });
  test("the record to draft from is read with the administrator's own session (so a hidden fixture can be prepared), never the anonymous client", () => {
    const a = read("app/admin/launch-partners/actions.ts");
    const fn = a.slice(a.indexOf("export async function prepareCampaignAction"), a.indexOf("export async function importExistingAction"));
    assert.match(fn, /const sb = await createClient\(\)/); assert.match(fn, /sb\.from\("local_businesses_public"\)/); assert.doesNotMatch(fn, /publicClient/);
    assert.doesNotMatch(fn, /\.(insert|update|upsert|delete)\(/, "reading only: the Directory record is never written");
  });
  test("if the public check cannot be made, nothing is claimed to be public", () => {
    assert.match(read("lib/launch-partners/campaigns.server.ts"), /let visible = new Set<string>\(\);[^]*catch \{ \/\* if the public check cannot be made, nothing is claimed to be public \*\/ \}/);
  });
});
