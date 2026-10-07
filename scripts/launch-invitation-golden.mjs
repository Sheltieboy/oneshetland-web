#!/usr/bin/env node
/**
 * Regenerates the golden vectors that keep the web renderer (lib/launch-partners/email.ts) and the Edge Function's copy
 * (oneshetland-delivers: supabase/functions/_shared/launch-invitation-email.ts) in lock-step. The SAME file lives in both
 * repos; each repo's test renders every vector with its own code and compares. Run:
 *   node scripts/launch-invitation-golden.mjs   (writes tests/fixtures/launch-invitation-email.golden.json)
 * then copy it to the other repo.
 */
import { writeFileSync } from "node:fs";
import { defaultEmailDraft, renderInvitationEmail, checkEmail, TOKEN_CTA, TOKEN_OPENING, LINK_PLACEHOLDER } from "../lib/launch-partners/email.ts";
import { evaluateSendGates } from "../lib/launch-partners/send-core.ts";

const LINK = "https://oneshetland.com/launch/love-from-shetland?invite=" + "7f3a9c1e5b2d4f60a8c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1";
const lfs = defaultEmailDraft({ businessName: "Love From Shetland", opening: "You make something genuinely Shetland, and I think more locals and visitors should be able to find what you do easily." });
const dowry = defaultEmailDraft({ businessName: "The Dowry" });
const renders = [
  { name: "lfs-no-invitation", input: { ...lfs, businessName: "Love From Shetland" } },
  { name: "lfs-with-invitation", input: { ...lfs, businessName: "Love From Shetland", invitationUrl: LINK, invitationExpiresAt: "2026-11-05T19:50:17.506Z" } },
  { name: "lfs-with-invitation-no-expiry-known", input: { ...lfs, businessName: "Love From Shetland", invitationUrl: LINK } },
  { name: "lfs-with-invitation-bst-boundary", input: { ...lfs, businessName: "Love From Shetland", invitationUrl: LINK, invitationExpiresAt: "2026-10-25T00:30:00.000Z" } },
  { name: "lfs-with-invitation-london-midnight", input: { ...lfs, businessName: "Love From Shetland", invitationUrl: LINK, invitationExpiresAt: "2026-10-06T23:30:00.000Z" } },
  { name: "lfs-with-invitation-bad-expiry", input: { ...lfs, businessName: "Love From Shetland", invitationUrl: LINK, invitationExpiresAt: "not a date" } },
  { name: "lfs-masked", input: { ...lfs, businessName: "Love From Shetland", maskedUrl: "https://oneshetland.com/launch/love-from-shetland?invite=[the real link is shown once, when you generate the invitation]", invitationExpiresAt: "2026-11-05T19:50:17.506Z" } },
  { name: "dowry-prompt-with-invitation", input: { ...dowry, businessName: "The Dowry", invitationUrl: LINK.replace("love-from-shetland", "the-dowry") } },
  { name: "legacy-link-token", input: { subject: "s", body: "Hi\n\n" + LINK_PLACEHOLDER + "\n\nBye", opening: "x", businessName: "X", invitationUrl: LINK } },
  { name: "hostile-text", input: { subject: "<b>Hi & bye</b>", body: "A <script>alert(1)</script> & \"q\" 'q'\n\n" + TOKEN_OPENING + "\n\n" + TOKEN_CTA, opening: "a < b > c", businessName: "X & Y", invitationUrl: "javascript:alert(1)" } },
  { name: "hostile-url-attribute", input: { subject: "s", body: TOKEN_CTA, invitationUrl: 'https://x.example/a"onmouseover="y' } },
  { name: "bullets-and-breaks", input: { subject: "s", body: "Line one\nLine two\n\n• a\n• b & c\n\n" + TOKEN_CTA, invitationUrl: LINK } },
];
const checks = [
  { name: "ok", input: { subject: lfs.subject, body: lfs.body, opening: lfs.opening, contactEmail: "a@b.co" } },
  { name: "prompt-left", input: { subject: dowry.subject, body: dowry.body, opening: dowry.opening, contactEmail: "a@b.co" } },
  { name: "no-contact", input: { subject: lfs.subject, body: lfs.body, opening: lfs.opening, contactEmail: "" } },
  { name: "bad-contact", input: { subject: lfs.subject, body: lfs.body, opening: lfs.opening, contactEmail: "nope" } },
  { name: "link-pasted-in-body", input: { subject: lfs.subject, body: lfs.body.replace(TOKEN_CTA, LINK), opening: lfs.opening, contactEmail: "a@b.co" } },
  { name: "link-in-opening", input: { subject: lfs.subject, body: lfs.body, opening: LINK, contactEmail: "a@b.co" } },
  { name: "no-cta", input: { subject: lfs.subject, body: "just text", opening: "x", contactEmail: "a@b.co" } },
  { name: "no-subject", input: { subject: "", body: lfs.body, opening: lfs.opening, contactEmail: "a@b.co" } },
];
const NOW = "2026-10-06T12:00:00.000Z";
const future = "2026-11-01T00:00:00.000Z", past = "2026-09-01T00:00:00.000Z";
const base = () => ({ stage: "ready_to_invite", sentAt: null, contactEmail: "hello@example.test", subject: lfs.subject, opening: lfs.opening, body: lfs.body, invitationStatus: "open", expiresAt: future, tokenValid: true, confirm: { confirm: true, recipient: "hello@example.test", subject: lfs.subject } });
const mut = (f) => { const c = base(); f(c); return c; };
const gates = [
  ["all-good", base()],
  ["not-confirmed", mut((c) => { c.confirm.confirm = false; })], ["no-confirmation", mut((c) => { c.confirm = null; })],
  ["already-sent", mut((c) => { c.sentAt = "2026-10-05T00:00:00Z"; })], ["not-ready", mut((c) => { c.stage = "preparing"; })],
  ["no-contact", mut((c) => { c.contactEmail = null; })], ["bad-contact", mut((c) => { c.contactEmail = "nope"; c.confirm.recipient = "nope"; })],
  ["empty-subject", mut((c) => { c.subject = ""; c.confirm.subject = ""; })], ["opening-prompt", mut((c) => { c.opening = dowry.opening; })], ["no-cta-token", mut((c) => { c.body = "no token"; })],
  ["no-invitation", mut((c) => { c.invitationStatus = "none"; })], ["revoked", mut((c) => { c.invitationStatus = "revoked"; })], ["token-wrong-business", mut((c) => { c.tokenValid = false; })],
  ["expired", mut((c) => { c.expiresAt = past; })], ["recipient-changed", mut((c) => { c.confirm.recipient = "other@example.test"; })], ["subject-changed", mut((c) => { c.confirm.subject = "older"; })],
  ["recipient-case-insensitive", mut((c) => { c.confirm.recipient = "HELLO@Example.TEST"; })],
  ["do-not-contact", mut((c) => { c.outreachStopped = true; })],
  ["do-not-contact-and-other-problems", mut((c) => { c.outreachStopped = true; c.stage = "preparing"; c.contactEmail = null; })],
].map(([name, input]) => ({ name, input, nowIso: NOW }));

const out = {
  renders: renders.map((r) => ({ ...r, expected: (({ subject, text, html, hasInvitation }) => ({ subject, text, html, hasInvitation }))(renderInvitationEmail(r.input)) })),
  checks: checks.map((c) => ({ ...c, expected: checkEmail(c.input) })),
  gates: gates.map((g) => {
    const i = g.input;
    const failures = evaluateSendGates({
      campaign: { id: "c", slug: "love-from-shetland", businessName: "Love From Shetland", stage: i.stage, sentAt: i.sentAt, contactEmail: i.contactEmail, subject: i.subject, opening: i.opening, body: i.body, outreachStopped: i.outreachStopped === true },
      invitation: { status: i.invitationStatus, expiresAt: i.expiresAt, tokenValidForThisBusiness: i.tokenValid }, invitationUrl: LINK, confirmation: i.confirm,
    }, { transport: { send: async () => ({ id: "" }) }, now: () => new Date(g.nowIso) });
    return { ...g, expected: [...failures].sort() };
  }),
};
writeFileSync(new URL("../tests/fixtures/launch-invitation-email.golden.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log("golden vectors:", out.renders.length, "renders,", out.checks.length, "checks,", out.gates.length, "gate cases");
