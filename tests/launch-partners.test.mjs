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
import { evaluateSendGates, sendInvitationEmail, GATE_MESSAGE } from "../lib/launch-partners/send-core.ts";
import { configuredTransport, outreachFrom } from "../lib/launch-partners/send.server.ts";
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

describe("sending is gated — and tests can never reach a mailbox", () => {
  const draft = defaultEmailDraft({ businessName: "Love From Shetland", opening: LFS_OPENING });
  const future = new Date(Date.now() + 7 * 864e5).toISOString();
  const ok = () => ({
    campaign: { id: "c1", slug: "love-from-shetland", businessName: "Love From Shetland", stage: "ready_to_invite", sentAt: null, contactEmail: "hello@example.test", subject: draft.subject, opening: draft.opening, body: draft.body },
    invitation: { status: "open", expiresAt: future, tokenValidForThisBusiness: true }, invitationUrl: URL64,
    confirmation: { confirm: true, recipient: "hello@example.test", subject: draft.subject },
  });
  const rec = () => { const sent = []; return { sent, transport: { send: async (m) => { sent.push(m); return { id: "msg-1" }; } }, from: "Darren <darren@example.test>", now: () => new Date() }; };

  test("with every gate satisfied exactly one message is handed to the (stub) transport, containing the link and nothing tracked", async () => {
    const d = rec(); const out = await sendInvitationEmail(ok(), d);
    assert.equal(out.ok, true); assert.equal(d.sent.length, 1);
    const m = d.sent[0]; assert.equal(m.to, "hello@example.test"); assert.equal(m.subject, draft.subject);
    assert.ok(m.html.includes(CTA_LABEL) && m.html.includes(URL64) && m.text.includes(`View your private preview: ${URL64}`));
    assert.deepEqual(Object.keys(m.metadata).sort(), ["campaign", "kind"]); assert.ok(!JSON.stringify(m.metadata).includes(TOKEN64), "the provider's metadata never holds the token");
  });
  test("each missing requirement blocks the send and nothing reaches the transport", async () => {
    const cases = [
      ["not_confirmed", (i) => { i.confirmation = { ...i.confirmation, confirm: false }; }], ["not_confirmed", (i) => { i.confirmation = null; }],
      ["contact_missing", (i) => { i.campaign.contactEmail = null; }], ["contact_invalid", (i) => { i.campaign.contactEmail = "nope"; i.confirmation.recipient = "nope"; }],
      ["draft_incomplete", (i) => { i.campaign.subject = ""; i.confirmation.subject = ""; }], ["draft_incomplete", (i) => { i.campaign.opening = openingPrompt("X"); }], ["draft_incomplete", (i) => { i.campaign.body = "no call to action"; }],
      ["not_ready", (i) => { i.campaign.stage = "preparing"; }], ["already_sent", (i) => { i.campaign.sentAt = "2026-10-06"; }],
      ["invitation_invalid", (i) => { i.invitation.status = "none"; }], ["invitation_invalid", (i) => { i.invitation.status = "revoked"; }], ["invitation_invalid", (i) => { i.invitation.tokenValidForThisBusiness = false; }],
      ["invitation_expired", (i) => { i.invitation.expiresAt = "2000-01-01T00:00:00Z"; }], ["link_missing", (i) => { i.invitationUrl = null; }],
      ["recipient_changed", (i) => { i.confirmation.recipient = "someone-else@example.test"; }], ["subject_changed", (i) => { i.confirmation.subject = "an older subject"; }],
    ];
    for (const [gate, mutate] of cases) { const i = ok(); mutate(i); const d = rec(); const out = await sendInvitationEmail(i, d); assert.equal(out.ok, false, gate); assert.ok(out.failures.includes(gate), `${gate}: ${out.failures}`); assert.equal(d.sent.length, 0, `${gate}: nothing was sent`); }
  });
  test("no transport configured means no send, whatever else is true — and no network is touched", async () => {
    const realFetch = globalThis.fetch; let calls = 0; globalThis.fetch = () => { calls++; throw new Error("network must not be used"); };
    try {
      assert.equal(configuredTransport({}), null); assert.equal(configuredTransport({ POSTMARK_API_KEY: "k" }), null, "a key alone is not enough"); assert.equal(configuredTransport({ LAUNCH_OUTREACH_FROM: "Darren <d@example.test>" }), null);
      assert.equal(outreachFrom({ LAUNCH_OUTREACH_FROM: "not an address" }), null);
      assert.notEqual(configuredTransport({ POSTMARK_API_KEY: "k", LAUNCH_OUTREACH_FROM: "Darren <d@example.test>" }), null);
      const out = await sendInvitationEmail(ok(), { transport: null, from: "", now: () => new Date() });
      assert.equal(out.ok, false); assert.deepEqual(out.failures, ["not_configured"]); assert.match(out.message, /isn't configured/);
    } finally { globalThis.fetch = realFetch; }
    assert.equal(calls, 0);
  });
  test("every failure has a plain-English explanation", () => { for (const g of Object.keys(GATE_MESSAGE)) assert.ok(GATE_MESSAGE[g].length > 10, g); });
  test("the real transport sends a personal note: no open tracking, no link tracking, no footer wrapper", () => {
    const t = read("lib/launch-partners/send.server.ts");
    assert.match(t, /TrackOpens: false/); assert.match(t, /TrackLinks: "None"/); assert.doesNotMatch(t, /email_templates|buildFooter|sendEmail\(/);
  });
  test("the send action is the only caller, begins with requireAdmin, re-reads the draft and invitation from the database, and records the send", () => {
    const a = read("app/admin/launch-partners/actions.ts");
    const fn = a.slice(a.indexOf("export async function sendInvitationEmailAction"));
    assert.match(fn, /await requireAdmin\(\)/); assert.match(fn, /getCampaign\(id\)/); assert.match(fn, /launch_invite_resolve/); assert.match(fn, /listInvites\(\)/); assert.match(fn, /markSent\(/);
    const callers = ["app", "components", "lib"].flatMap((d) => walkSrc(d)).filter((f) => /sendInvitationEmail\(/.test(readFileSync(f, "utf8")) && !f.endsWith("send-core.ts"));
    assert.deepEqual(callers.map((f) => f.split("/").slice(-2).join("/")), ["launch-partners/actions.ts"]);
    const ui = read("components/admin/launch-partners/EmailSection.tsx");
    assert.match(ui, /title: "Send the invitation email\?"/); for (const w of ["Business", "Recipient", "Subject", "Invitation expires"]) assert.ok(ui.includes(w), w);
  });
  test("the invitation token is confined: it is built into a URL in exactly the places that must hold it", () => {
    const holders = ["app", "components", "lib"].flatMap((d) => walkSrc(d)).filter((f) => /invite=\$\{/.test(readFileSync(f, "utf8"))).map((f) => f.split("/").slice(-2).join("/")).sort();
    assert.deepEqual(holders, ["admin/LaunchInvites.tsx", "launch-partners/actions.ts"].sort(), "only the two places that build the real link from a token");
    for (const f of ["components/admin/launch-partners/Pipeline.tsx", "app/admin/launch-partners/[id]/page.tsx", "app/admin/launch-partners/page.tsx"]) assert.doesNotMatch(read(f), /invite=\$|issueInvitation|token/i, `${f} must not touch the token`);
    assert.doesNotMatch(read("lib/launch-partners/campaigns.server.ts"), /invite=\$/, "the data layer never builds a link (it only passes a visitor's token to the view-tracking function)");
  });
  test("no test and no code path in this repo sends to a real address", () => {
    const here = read("tests/launch-partners.test.mjs");
    assert.doesNotMatch(here.replace(/hello@example\.test|someone-else@example\.test|a@b\.co|d@example\.test|darren@example\.test|nope/g, ""), /@(gmail|outlook|yahoo|hotmail|oneshetland\.com)/i);
  });
});

describe("validation of what an administrator saves", () => {
  test("unsafe addresses are refused everywhere they could appear", () => {
    for (const u of ["javascript:alert(1)", "data:text/html,x", "http://example.com/a.jpg", "//evil.example/a.jpg", "/\\evil"]) assert.equal(isSafeUrl(u), false, u);
    for (const u of ["/launch/x/a.jpg", "https://cdn.shopify.com/a.jpg"]) assert.equal(isSafeUrl(u), true, u);
  });
  test("every existing preview config passes the validator, unchanged", () => {
    for (const slug of previewSlugs()) { const r = parsePreviewConfig(getPreviewConfig(slug), slug); assert.ok(r.ok, `${slug}: ${r.error}`); }
  });
  test("a preview with a javascript: link or an extra product field is rejected", () => {
    const base = structuredClone(getPreviewConfig("shetland-jewellery"));
    assert.equal(parsePreviewConfig({ ...base, sourceSite: { label: "x", url: "javascript:alert(1)" } }).ok, false);
    assert.equal(parsePreviewConfig({ ...base, products: [{ ...base.products[0], checkout: "/buy" }] }).ok, false);
    assert.equal(parsePreviewConfig({ ...base, products: base.products.concat(base.products) }).ok, false);
    assert.equal(parsePreviewConfig({ ...base, slug: "other-name" }, "shetland-jewellery").ok, false);
  });
  test("every page draft built from a preview passes the draft validator", () => {
    for (const slug of previewSlugs()) { const r = parsePageDraft(buildPageDraft(getPreviewConfig(slug))); assert.ok(r.ok, `${slug}: ${r.error}`); }
  });
  test("a page draft needs a picture, a tagline and safe addresses", () => {
    const d = buildPageDraft(getPreviewConfig("the-dowry"));
    assert.equal(parsePageDraft({ ...d, hero: { ...d.hero, image: { src: "javascript:x", alt: "" } } }).ok, false);
    assert.equal(parsePageDraft({ ...d, emphasis: "nonsense" }).ok, false);
    assert.equal(parsePageDraft({ ...d, version: 2 }).ok, false);
  });
});

describe("Business Page V2 adapts to each business", () => {
  const model = (slug, over = {}) => {
    const cfg = getPreviewConfig(slug);
    return buildBusinessPageModel({
      mode: "prepared", business: { id: "b", name: cfg.businessName, category: cfg.business.category ?? "retail", description: cfg.business.description, address: "1 High St, Lerwick", lat: 60.15, lng: -1.14, logo_url: null, cover_url: null, brand_color: null, phone: "01595 000000", website: null, email: null, opening_hours: { mon: "9-5" }, opening_hours_until: null, is_verified: false, is_claimed: false, accepts_bookings: false },
      fallback: { id: "b", name: cfg.businessName }, categoryLabels: { retail: "Retail", food_drink: "Food & Drink" }, products: [], offers: [], passes: [], services: [], loyalty: null, events: [], draft: buildPageDraft(cfg), ...over,
    });
  };
  test("Shetland Jewellery: story → shop → workshop experience, then the practical sections", () => {
    assert.deepEqual(planSections(model("shetland-jewellery")), ["story", "shop", "experience", "rewards", "hours", "location", "contact"]);
  });
  test("The Dowry: booking leads, then about/discovery, then rewards ideas", () => {
    const o = planSections(model("the-dowry"));
    assert.equal(o[0], "book"); assert.ok(o.indexOf("book") < o.indexOf("story") && o.indexOf("story") < o.indexOf("rewards")); assert.ok(!o.includes("shop"), "no shop section for a business with no products");
  });
  test("Shetland Soap Company: story → shop", () => {
    const o = planSections(model("shetland-soap-company")); assert.ok(o.indexOf("story") < o.indexOf("shop"));
  });
  test("Da Craft Shed and Peerie Shop: shop first", () => {
    for (const s of ["da-craft-shed", "peerie-shop"]) { const o = planSections(model(s)); assert.ok(o.indexOf("shop") < o.indexOf("story"), s); }
  });
  test("hours, location and contact always close the page, and hero is not in the middle list", () => {
    for (const s of previewSlugs()) { const o = planSections(model(s)); assert.deepEqual(o.slice(-3).filter((x) => ["hours", "location", "contact"].includes(x)), o.slice(-3).filter((x) => ["hours", "location", "contact"].includes(x))); assert.ok(!o.includes("hero")); const tail = o.slice(o.indexOf("hours")); assert.deepEqual(tail, ["hours", "location", "contact"]); }
  });
  test("no content, no section — nothing is invented", () => {
    const m = model("the-dowry", { draft: null, business: null, fallback: { id: "b", name: "Bare Co" } });
    assert.deepEqual(planSections(m), []);
    assert.equal(m.shop, null); assert.equal(m.book, null); assert.equal(m.rewards, null);
  });
  test("real content replaces examples: real products win, and examples are marked", () => {
    const ex = model("shetland-jewellery");
    assert.ok(ex.shop.example && ex.shop.items.every((i) => i.example));
    const real = model("shetland-jewellery", { products: [{ id: "p1", title: "Real ring", price_pence: 4500, photos: ["https://x/y.jpg"] }] });
    assert.equal(real.shop.example, false); assert.equal(real.shop.items.length, 1); assert.equal(real.shop.items[0].pricePounds, 45);
  });
  test("an explicit layout from Admin reorders the middle only", () => {
    const m = model("shetland-jewellery"); m.layout = ["experience", "shop", "story"];
    assert.deepEqual(planSections(m).slice(0, 3), ["experience", "shop", "story"]);
    assert.ok(availability(m).location);
  });
  test("a real booking replaces the example booking", () => {
    const m = model("the-dowry", { business: { id: "b", name: "The Dowry", category: "food_drink", description: "x", address: "a", lat: null, lng: null, logo_url: null, cover_url: null, brand_color: null, phone: null, website: null, email: null, opening_hours: null, opening_hours_until: null, is_verified: false, is_claimed: true, accepts_bookings: true }, services: [{ id: "s1", name: "Table for two", description: null, duration_minutes: 90, price_pence: null }] });
    assert.equal(m.book.example, false); assert.equal(m.book.services.length, 1);
  });
});

describe("the common preview treatment says Import products — Available", () => {
  test("shared catalogue options", () => {
    const by = Object.fromEntries(CATALOGUE_OPTIONS.map((o) => [o.id, o]));
    assert.equal(by.import.chip, "Available"); assert.equal(by.manual.chip, "Available"); assert.equal(by.connect.chip, "Coming next");
    assert.match(by.import.body, /Upload your existing catalogue and review everything before anything goes live\./);
    assert.equal(by.connect.body, "Shopify · WooCommerce · Square");
    assert.doesNotMatch(JSON.stringify(CATALOGUE_OPTIONS), /Being prepared|connected|synced|live sync/i);
  });
  test("the page takes it from the shared module, with no hand-written chip per preview", () => {
    const page = read("components/launch-preview/PreviewPage.tsx");
    assert.match(page, /CATALOGUE_OPTIONS/); assert.doesNotMatch(page, /Being prepared/);
    for (const slug of previewSlugs()) assert.doesNotMatch(read(`lib/launch-preview/partners/${slug}.ts`), /Being prepared|Import products/);
  });
});

describe("guarantees: admin-only, private drafts, nothing automatic", () => {
  const walk = (d) => { const root = new URL("../", import.meta.url).pathname; const out = []; const go = (p) => { for (const f of readdirSync(p)) { const q = join(p, f); statSync(q).isDirectory() ? go(q) : out.push(q); } }; go(join(root, d)); return out; };
  const actions = read("app/admin/launch-partners/actions.ts");

  test("every admin action begins with requireAdmin()", () => {
    const fns = actions.split(/\nexport async function /).slice(1);
    assert.ok(fns.length >= 10);
    for (const f of fns) {
      const at = f.indexOf("await requireAdmin()");
      assert.ok(at > 0, `${f.split("(")[0]} never checks`);
      assert.doesNotMatch(f.slice(0, at), /await |try \{|rpc\(/, `${f.split("(")[0]} does something before the admin check`);
    }
  });
  test("admin preview pages are admin-gated; the owner page needs ownership AND the database's approved-claim check", () => {
    for (const p of ["app/admin-preview/launch-partners/[id]/business-page/page.tsx", "app/admin-preview/launch-partners/[id]/launch/page.tsx"]) assert.match(read(p), /await requireAdmin\(\)/, p);
    const owner = read("app/business/[id]/manage/page-draft/page.tsx");
    assert.match(owner, /requireBusinessOwner/); assert.match(owner, /readPageDraft/); assert.match(owner, /if \(!d\) notFound\(\)/);
  });
  test("the campaign tables and drafts are reachable only through the admin screens and the server module — no public page, API route or other component names them", () => {
    const banned = /launch_partner_campaigns|launch_partner_events|page_config|preview_config|admin_launch_partner_|launch_partner_page_draft/;
    const allowed = ["lib/launch-partners/", "lib/business-page/", "app/admin/launch-partners/", "app/admin-preview/", "components/admin/launch-partners/", "app/business/[id]/manage/page-draft/"];
    const root = new URL("../", import.meta.url).pathname;
    for (const dir of ["app", "components", "lib"]) for (const f of walk(dir)) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const rel = f.slice(root.length);
      if (allowed.some((a) => rel.startsWith(a))) continue;
      if (banned.test(readFileSync(f, "utf8"))) assert.fail(`${rel} references campaign data directly`);
    }
    for (const f of walk("app/api")) assert.doesNotMatch(readFileSync(f, "utf8"), /launch-partners|campaigns\.server|page-draft|page_config/, f);
  });
  test("the server module has no service-role key, no direct table access, and nothing that writes a listing", () => {
    const m = read("lib/launch-partners/campaigns.server.ts") + actions;
    assert.doesNotMatch(m, /service_role|SERVICE_ROLE|serviceClient|createAdminClient/i);
    assert.doesNotMatch(m, /\.from\(["'](?!local_businesses_public)/, "only the public Directory VIEW is read directly");
    assert.doesNotMatch(m, /\.(insert|update|upsert|delete)\(/, "no direct writes");
    assert.doesNotMatch(m, /local_businesses["']\)\s*\.\s*(update|insert)/);
  });
  test("an invitation is created in exactly one place, behind an admin click — never by preparing, importing or viewing", () => {
    const all = walk("app").concat(walk("lib"), walk("components")).filter((f) => /\.(ts|tsx)$/.test(f));
    const users = all.filter((f) => /admin_issue_launch_invite/.test(readFileSync(f, "utf8"))).map((f) => f.split("/").slice(-2).join("/")).sort();
    assert.deepEqual(users, ["launch-partners/actions.ts", "admin/LaunchInvites.tsx"].sort());
    const prepare = actions.slice(actions.indexOf("export async function prepareCampaignAction"), actions.indexOf("export async function importExistingAction"));
    assert.doesNotMatch(prepare, /admin_issue_launch_invite|issueInvitation|setClaimMode|markSent/);
    assert.doesNotMatch(read("lib/launch-partners/campaigns.server.ts").slice(read("lib/launch-partners/campaigns.server.ts").indexOf("export async function importExistingPreviews")), /admin_issue_launch_invite|markSent|setStage/);
  });
  test("a real campaign cannot get an invitation until it is marked ready; only a test fixture is exempt", () => {
    assert.match(actions, /!c\.is_test && c\.stage !== "ready_to_invite" && c\.stage !== "sent"/);
  });
  test("claiming can only be opened while an invitation is live, and the claim action itself refuses a closed preview", () => {
    assert.match(actions, /Generate a private invitation first/);
    assert.match(read("app/launch/[slug]/claim/actions.ts"), /open\.cfg\.claim === "holding"/);
  });
  test("view tracking: not for admins or review tokens, token goes only to the database, failures never break the page", () => {
    const page = read("app/launch/[slug]/page.tsx");
    assert.match(page, /!open\.review && account\?\.profile\?\.role !== "admin"/);
    const s = read("lib/launch-partners/campaigns.server.ts");
    const fn = s.slice(s.indexOf("export async function recordPreviewView"), s.indexOf("export interface ImportOutcome"));
    assert.match(fn, /catch/); assert.doesNotMatch(fn, /console\.|fetch\(|headers|referer/i);
  });
  test("the public business route is untouched: it neither imports Business Page V2 nor reads a draft", () => {
    const pub = read("app/directory/[id]/page.tsx");
    assert.doesNotMatch(pub, /BusinessPageV2|business-page|page-draft|launch-partners|readPageDraft/);
    assert.doesNotMatch(read("components/site/SiteHeader.tsx") + read("app/sitemap.ts"), /admin-preview|page-draft|launch-partners/);
  });
  test("private drafts are never indexed or cached", () => {
    const cfg = read("next.config.ts");
    assert.match(cfg, /source: "\/admin-preview\/:path\*"[\s\S]{0,260}noindex/);
    assert.match(cfg, /source: "\/business\/:id\/manage\/page-draft"[\s\S]{0,260}noindex/);
    for (const p of ["app/admin-preview/launch-partners/[id]/business-page/page.tsx", "app/business/[id]/manage/page-draft/page.tsx"]) assert.match(read(p), /index: false/);
  });
  test("the outreach contact email never reaches a public renderer", () => {
    for (const f of ["components/business-page/BusinessPageV2.tsx", "lib/business-page/model.ts", "lib/business-page/load.server.ts", "components/launch-preview/PreviewPage.tsx", "app/launch/[slug]/page.tsx", "app/business/[id]/manage/page-draft/page.tsx", "app/admin-preview/launch-partners/[id]/business-page/page.tsx"]) {
      assert.doesNotMatch(read(f), /contact_email|contactEmail|email_body|email_subject/, f);
    }
    const s = read("lib/launch-partners/campaigns.server.ts");
    assert.doesNotMatch(s.slice(s.indexOf("export async function readPageDraft"), s.indexOf("export interface ImportOutcome")), /contact_email/);
  });
});


describe("prepared → approved → live: profile moves forward, commerce never does", () => {
  const biz = (o = {}) => ({ id: "b", name: "Love From Shetland", category: "retail", description: "A small family-run company.", address: "Lerwick, Shetland", lat: 60.15, lng: -1.14, logo_url: null, cover_url: null, brand_color: null, phone: null, website: null, email: null, opening_hours: null, opening_hours_until: null, is_verified: false, is_claimed: false, accepts_bookings: false, ...o });
  const build = (mode, slug, over = {}) => buildBusinessPageModel({ mode, business: biz({ name: slug }), fallback: { id: "b", name: slug }, categoryLabels: { retail: "Retail" }, products: [], offers: [], passes: [], services: [], loyalty: null, events: [], draft: buildPageDraft(getPreviewConfig(slug)), ...over });
  const PROFILE_FIRST = ["love-from-shetland", "shetland-jewellery", "the-dowry", "peerie-shop", "da-craft-shed", "shetland-soap-company"];

  test("extractProfile keeps exactly the profile and drops every commerce key and the notes", async () => {
    const { extractProfile, nonProfileKeys, COMMERCE_KEYS, PROFILE_TOP_KEYS, PROFILE_HERO_KEYS } = await import("../lib/business-page/profile.ts");
    for (const slug of PROFILE_FIRST) {
      const draft = buildPageDraft(getPreviewConfig(slug));
      const full = { ...draft, products: draft.products ?? [{ id: "x", title: "T", price: 1, image: "/a.jpg", blurb: "b" }], experience: draft.experience ?? { title: "t", blurb: "b", image: { src: "/a.jpg", alt: "" }, source: "https://x" }, booking: draft.booking ?? { cta: "c", line: "l" }, rewards: draft.rewards ?? { title: "r", body: "b" }, notes: "internal", productsTitle: "Shop" };
      const p = extractProfile(full);
      assert.deepEqual(nonProfileKeys(p), [], `${slug}: nothing outside the profile`);
      for (const k of COMMERCE_KEYS) assert.ok(!(k in p), `${slug}: ${k} must not be promoted`);
      for (const k of Object.keys(p)) assert.ok(k === "version" || PROFILE_TOP_KEYS.includes(k));
      for (const k of Object.keys(p.hero)) assert.ok(PROFILE_HERO_KEYS.includes(k));
      assert.ok(p.hero.image && p.hero.tagline, "the hero identity is promoted");
    }
    assert.deepEqual(nonProfileKeys({ hero: { tagline: "x", price: 1 }, products: [], story: {} }).sort(), ["hero.price", "products"]);
  });
  test("a LIVE model keeps the whole profile — hero, label, place, story, order — and carries no example commerce", () => {
    for (const slug of PROFILE_FIRST) {
      const prep = build("prepared", slug), live = build("live", slug);
      assert.equal(live.hero.headline, prep.hero.headline, slug); assert.equal(live.hero.tagline, prep.hero.tagline);
      assert.equal(live.identity.categoryLabel, prep.identity.categoryLabel); assert.equal(live.identity.locality, prep.identity.locality);
      assert.deepEqual(live.hero.image, prep.hero.image); assert.equal(live.hero.visual, prep.hero.visual, `${slug}: same hero treatment as the prepared page`);
      assert.deepEqual(live.story, prep.story); assert.equal(live.emphasis, prep.emphasis);
      assert.equal(live.shop, null, `${slug}: no example products`); assert.equal(live.book, null); assert.equal(live.experience, null); assert.equal(live.rewards, null);
    }
  });
  test("the profile is not thrown away in favour of sparse Directory fields", () => {
    const live = build("live", "shetland-jewellery", { business: biz({ name: "Shetland Jewellery", description: null, address: "Shetland" }) });
    assert.match(live.hero.tagline, /family jewellery business in Weisdale/);
    assert.equal(live.identity.categoryLabel, "Hand-made jewellery"); assert.equal(live.identity.locality, "Weisdale, Shetland");
    assert.equal(live.hero.visual, "photo"); assert.ok(live.story && live.story.body.join(" ").includes("Weisdale"));
  });
  test("Love From Shetland's mosaic hero survives, as price-less pictures — the example products' prices and titles do not", () => {
    const live = build("live", "love-from-shetland"), prep = build("prepared", "love-from-shetland");
    assert.equal(live.hero.visual, "mosaic"); assert.equal(live.hero.collage.length, 3);
    assert.ok(live.hero.collage.every((c) => c.price === undefined && c.example === undefined), "gallery pictures carry no commerce claim");
    assert.ok(prep.hero.collage.every((c) => c.price !== undefined && c.example === true), "prepared keeps its priced example tiles (unchanged)");
  });
  test("Shetland Jewellery's photograph hero has no product thumbnails in live (they carried example names and prices)", () => {
    assert.equal(build("live", "shetland-jewellery").hero.collage.length, 0);
    assert.ok(build("prepared", "shetland-jewellery").hero.collage.length >= 2);
  });
  test("real commerce slots in automatically, and only real commerce", () => {
    const m = build("live", "love-from-shetland", {
      products: [{ id: "p1", title: "Real soap", price_pence: 395, photos: ["https://x/s.jpg"] }, { id: "p2", title: "Real balm", price_pence: 800, photos: ["https://x/b.jpg"] }, { id: "p3", title: "Real kit", price_pence: 2195, photos: ["https://x/k.jpg"] }],
      loyalty: { type: "stamps", stamps_required: 8, stamp_reward: "a free soap", points_per_pound: null, points_for_pound: null },
    });
    assert.deepEqual(m.shop.items.map((i) => i.id), ["p1", "p2", "p3"]); assert.ok(m.shop.items.every((i) => i.example === false)); assert.equal(m.shop.title, "Shop");
    assert.equal(m.rewards.example, false); assert.match(m.rewards.body, /free soap/);
    assert.ok(m.hero.collage.every((c) => c.price !== undefined) && m.hero.collage[0].alt === "Real soap", "the mosaic now shows the real products, with real prices");
    const order = planSections(m); assert.ok(order.includes("shop") && order.includes("rewards"));
  });
  test("example experiences and suggested rewards never go live; a pass counts only if it is a real pass", () => {
    const m = build("live", "shetland-jewellery");
    assert.equal(m.experience, null); assert.deepEqual(m.passes, []);
    assert.equal(planSections(m).includes("experience"), false);
    const real = build("live", "shetland-jewellery", { passes: [{ id: "u1", name: "Workshop tour", description: null, price_pence: 500, image_url: null }] });
    assert.equal(planSections(real).includes("experience"), true); assert.equal(real.experience, null, "still no example experience alongside it");
  });
  test("enforceLive removes example commerce but keeps the profile", () => {
    const dirty = { ...build("prepared", "love-from-shetland"), mode: "live" };
    assert.ok(dirty.shop.example && dirty.rewards.example && dirty.story);
    const m = enforceLive(dirty);
    assert.equal(m.shop, null); assert.equal(m.rewards, null); assert.equal(m.experience, null); assert.equal(m.book, null);
    assert.ok(m.story && m.hero.image && m.hero.tagline, "profile untouched");
    assert.deepEqual(m.hero.collage, [], "priced example tiles removed");
    assert.equal(enforceLive(build("prepared", "love-from-shetland")).shop.example, true, "prepared is untouched");
  });
  test("review slot hints show where real commerce will appear, without carrying any content", async () => {
    const { slotHintsFromDraft } = await import("../lib/business-page/profile.ts");
    const hints = slotHintsFromDraft(buildPageDraft(getPreviewConfig("shetland-jewellery")));
    assert.deepEqual(hints.sort(), ["experience", "rewards", "shop"]);
    const m = build("live", "shetland-jewellery");
    assert.deepEqual(planSections(m), ["story", "location"].filter((x) => planSections(m).includes(x)));
    const withSlots = planSections(m, hints);
    assert.ok(withSlots.indexOf("story") < withSlots.indexOf("shop") && withSlots.indexOf("shop") < withSlots.indexOf("experience"), "slots sit in the same hierarchy as the prepared page");
    assert.equal(m.shop, null, "hints add no content");
  });
  test("the words that mark something as an example live in ONE module and in no live-capable file", () => {
    assert.equal(PREPARED_COPY.intro, "This is a private preview of how your real OneShetland page could look. Example sections disappear unless you choose to set them up.");
    assert.equal(PREPARED_COPY.bar, "Private draft · Not public"); assert.equal(PREPARED_COPY.tag, "Example · not live");
    assert.equal(PREPARED_COPY.futureLiveBar, "Future live preview · Not public");
    const forbidden = /Example|Idea\b|Not set up|Replaced by|\bcould\b|[Rr]epresentative|Suggestion|not for sale/;
    const files = ["lib/business-page/model.ts", "lib/business-page/sections.ts", "lib/business-page/profile.ts", "lib/business-page/tokens.ts", "lib/business-page/load.server.ts", "components/business-page/LocationPanel.tsx", "components/business-page/slots.ts", "components/design-v2/primitives.tsx"];
    for (const f of files) assert.doesNotMatch(read(f), forbidden, `${f} spells out prepared-only wording`);
    assert.doesNotMatch(read("components/business-page/BusinessPageV2.tsx"), forbidden, "the page itself spells out no prepared-only wording (it imports it)");
  });
  test("the page strips example commerce before rendering, shows its furniture only for prepared or a private review, and marks slots as review notes", () => {
    const page = read("components/business-page/BusinessPageV2.tsx");
    assert.match(page, /const model = enforceLive\(given\)/);
    assert.match(page, /const showBar = prepared \|\| review/); assert.match(page, /data-review-note="true"/);
    for (const k of ["notForSale", "tag", "bookingNote", "experienceNote", "rewardsTag", "futureLiveBar", "futureLiveIntro", "slotTag"]) assert.match(page, new RegExp(`PREPARED_COPY\\.${k}`));
  });
  test("slots are never offered an example item", () => {
    const page = read("components/business-page/BusinessPageV2.tsx");
    assert.match(page, /p\.example \? <span[^]*?: slots\.productAction\?\.\(p\)/);
    assert.match(page, /\{!r\.example && slots\.rewardsProgress/);
  });
  test("there is no 'live from today's sparse Directory record' view any more", () => {
    const route = read("app/admin-preview/launch-partners/[id]/business-page/page.tsx");
    assert.doesNotMatch(route, /mode === "live"|mode=live|Live-mode simulation/);
    assert.match(route, /view === "future-live"/); assert.match(route, /Future live preview/);
  });
});

describe("hero: actions come from real capabilities; the visual always has something deliberate", () => {
  const base = { mode: "live", emphasis: undefined, identity: { id: "b", name: "X" }, shop: null, book: null, offers: [], passes: [], experience: null, rewards: null, events: [], useful: [], story: null, about: null, location: { address: null, lat: null, lng: null, mapHref: null }, contact: { phone: null, website: null, email: null }, hours: { hours: null, until: null } };
  test("a business with nothing gets no buttons at all", () => assert.deepEqual(heroActions(base), []));
  test("each button exists only for a capability the business has", () => {
    const ids = (o) => heroActions({ ...base, ...o }).map((a) => a.id);
    assert.deepEqual(ids({ shop: { items: [{}] } }), ["shop"]);
    assert.deepEqual(ids({ offers: [{}] }), ["offers"]);
    assert.deepEqual(ids({ passes: [{}] }), ["experience"]);
    assert.deepEqual(ids({ location: { address: "a", lat: null, lng: null, mapHref: "https://maps/x" } }), ["directions"]);
    assert.deepEqual(ids({ contact: { phone: "123", website: "https://w", email: null } }), ["call", "website"]);
  });
  test("the lead action follows the emphasis, and there are never more than the maximum", () => {
    const rich = { shop: { items: [{}] }, book: { cta: "Reserve a table" }, offers: [{}], passes: [{}], location: { address: "a", lat: null, lng: null, mapHref: "https://maps/x" }, contact: { phone: "1", website: "https://w", email: null } };
    assert.equal(heroActions({ ...base, ...rich, emphasis: "book_first" })[0].id, "book");
    assert.equal(heroActions({ ...base, ...rich, emphasis: "shop_first" })[0].id, "shop");
    assert.equal(heroActions({ ...base, ...rich, emphasis: "experience_first" })[0].id, "experience");
    assert.equal(heroActions({ ...base, ...rich }).length, MAX_HERO_ACTIONS);
  });
  test("hero visual: photograph, then product mosaic, then the branded card — never nothing", () => {
    assert.equal(chooseHeroVisual(undefined, true, 0), "photo"); assert.equal(chooseHeroVisual(undefined, false, 3), "mosaic"); assert.equal(chooseHeroVisual(undefined, false, 1), "brand");
    assert.equal(chooseHeroVisual("mosaic", true, 3), "mosaic"); assert.equal(chooseHeroVisual("mosaic", true, 1), "photo", "an explicit mosaic without enough pictures falls back");
    assert.equal(chooseHeroVisual("photo", false, 0), "brand", "an explicit photo with no photograph falls back");
    assert.equal(chooseHeroVisual("brand", true, 3), "brand");
  });
  test("Love From Shetland leads with its products, Shetland Jewellery with its photograph — different heroes from different content", () => {
    const mk = (slug) => buildBusinessPageModel({ mode: "prepared", business: null, fallback: { id: "b", name: slug }, categoryLabels: {}, products: [], offers: [], passes: [], services: [], loyalty: null, events: [], draft: buildPageDraft(getPreviewConfig(slug)) });
    assert.equal(mk("love-from-shetland").hero.visual, "mosaic"); assert.equal(mk("shetland-jewellery").hero.visual, "photo"); assert.equal(mk("the-dowry").hero.visual, "brand");
  });
});

describe("the map fails gracefully", () => {
  test("Google's rejection hook and a load timeout both lead to the caller's fallback, never to Google's error box", () => {
    const m = read("components/local/BusinessLocationMap.tsx");
    assert.match(m, /window\.gm_authFailure = /); assert.match(m, /setTimeout\(/); assert.match(m, /fallback/);
    const panel = read("components/business-page/LocationPanel.tsx");
    assert.match(panel, /fallback=\{card\}/); assert.match(panel, /Open in Maps/);
  });
});

describe("admin pipeline: small polish", () => {
  test("test fixtures are kept out of the normal pipeline", async () => {
    const { realRows, isTestRow, countByStatus } = await import("../lib/launch-partners/status.ts");
    const rows = [row({ id: "a" }), row({ id: "t", is_test: true, stage: "preparing" })];
    assert.deepEqual(realRows(rows).map((r) => r.id), ["a"]); assert.ok(isTestRow(rows[1]));
    assert.equal(Object.values(countByStatus(realRows(rows))).reduce((x, y) => x + y, 0), 1);
    const ui = read("components/admin/launch-partners/Pipeline.tsx"); assert.match(ui, /filter === "test" \? tests/); assert.match(ui, /Test <span/);
  });
  test("the Next action leads somewhere that already exists", async () => {
    const { nextActionHref } = await import("../lib/launch-partners/status.ts");
    assert.equal(nextActionHref(row({ id: "c1" })), "/admin/launch-partners/c1#preview");
    assert.equal(nextActionHref(row({ id: "c1", stage: "preparing", has_preview: true })), "/admin/launch-partners/c1#page");
    assert.equal(nextActionHref(row({ id: "c1", stage: "preparing", has_preview: true, has_page_draft: true })), "/admin/launch-partners/c1#status");
    assert.equal(nextActionHref(row({ id: "c1", stage: "ready_to_invite" })), "/admin/launch-partners/c1#invitation");
    assert.equal(nextActionHref(row({ id: "c1", stage: "ready_to_invite", invite: { status: "open" } })), "/admin/launch-partners/c1#email");
    assert.equal(nextActionHref(row({ stage: "sent", claim: { status: "pending", created_at: "x" } })), "/admin/claims?status=pending");
    assert.equal(nextActionHref(row({ business_id: "b9", stage: "sent", claim: { status: "approved", created_at: "x" }, has_owner: true })), "/admin/claims?status=launch&business=b9");
  });
  test("email readiness is one compact cell", () => {
    assert.equal(pipelineCells(row()).email.label, "—");
    assert.equal(pipelineCells(row({ has_contact_email: true })).email.label, "contact");
    assert.equal(pipelineCells(row({ has_email_draft: true })).email.label, "draft");
    assert.equal(pipelineCells(row({ has_contact_email: true, has_email_draft: true })).email.label, "ready");
  });
});


describe("imported and stored campaigns are claim-closed by default", () => {
  test("the import forces holding, and a stored preview that omits the setting is read as holding", () => {
    const m = read("lib/launch-partners/campaigns.server.ts");
    assert.match(m, /preview: \{ \.\.\.preview\.value, claim: "holding" \}/);
    assert.match(m, /claim: parsed\.value\.claim === "live" \? "live" : "holding"/);
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
