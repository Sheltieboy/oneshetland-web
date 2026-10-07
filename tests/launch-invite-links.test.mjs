/**
 * Launch invitation LINKS (web side): what a dead link looks like, what a live one still does, the one canonical lifetime, the email's expiry line,
 * and how Admin reads an invitation's state. The database behaviour is proved by supabase/tests/launch-invite-lifecycle.node.test.ts; the browser behaviour
 * by the local acceptance run. Run: node --test tests/launch-invite-links.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { inviteHandoff, inviteCookieName, isToken, isSlug, INVITE_COOKIE_MAX_AGE } from "../lib/launch-preview/invite.ts";
import { INVITE_DEFAULT_DAYS, INVITE_MAX_DAYS, SUPERSEDED_REASON, inviteLabel, isReplaced, clampInviteDays } from "../lib/launch-partners/invite-state.ts";
import { renderInvitationEmail, defaultEmailDraft, expiryLine, OUTREACH_OPT_OUT, OUTREACH_IDENTITY, OUTREACH_REGISTRATION, OUTREACH_OFFICE, OUTREACH_CONTACT } from "../lib/launch-partners/email.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const TOKEN = "7f3a9c1e5b2d4f60a8c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1";
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const walk = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((n) => { const p = `${dir}/${n}`; return statSync(new URL(`../${p}`, import.meta.url)).isDirectory() ? walk(p) : [p]; });

describe("The dead-link page", () => {
  const page = read("components/launch-preview/InviteInactive.tsx");
  const nf = read("app/launch/not-found.tsx");
  test("1 · the exact recipient-facing wording", () => {
    assert.match(page, /title: "This invitation link is no longer active"/);
    assert.match(page, /lead: "This can happen if the invitation has expired or a newer link has been issued\."/);
    assert.match(page, /If you were expecting to join OneShetland as a Launch Partner, reply to the email you received or contact/);
    assert.match(page, /href="mailto:hello@oneshetland\.com"/); assert.match(page, /and we’ll help\./);
  });
  test("2 · it takes NO input that could carry anything about the link: no slug, token, business or campaign — only which of three fixed variants", () => {
    assert.match(page, /export function InviteInactive\(\{ variant = "inactive" \}: \{ variant\?: InactiveVariant \}\)/);
    assert.doesNotMatch(code(page), /slug|token|businessName|businessId|campaign|cookies\(|headers\(|params/i);
    assert.doesNotMatch(code(nf), /params|cookies|headers|searchParams/); assert.match(nf, /<InviteInactive variant="inactive" \/>/);
  });
  test("3 · it never reveals or offers another link, an admin step, or a reason code", () => {
    assert.doesNotMatch(code(page + nf), /\/launch\/|invite=|superseded|revoked|expiredAt/i);
    assert.doesNotMatch(page, /redirect|router|useRouter|Link href=\{`/);
  });
  test("12–14 · the page itself is noindex and no-referrer, and /launch/* responses still carry noindex, no-store and no-referrer headers", () => {
    assert.match(nf, /robots: \{ index: false, follow: false, nocache: true, noarchive: true, nosnippet: true, noimageindex: true \}/); assert.match(nf, /referrer: "no-referrer"/);
    const cfg = read("next.config.ts"); const block = cfg.slice(cfg.indexOf('source: "/launch/:path*"'), cfg.indexOf('source: "/admin-preview/:path*"'));
    assert.match(block, /X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet"/); assert.match(block, /Referrer-Policy", value: "no-referrer"/); assert.match(block, /Cache-Control", value: "private, no-store, max-age=0"/);
  });
  test("4–6 · every kind of dead link ends in the same notFound(): the preview and the claim routes keep ONE failure path", () => {
    const preview = read("app/launch/[slug]/page.tsx"); const claim = read("app/launch/[slug]/claim/page.tsx");
    assert.match(preview, /const open = await openPrivatePreview\(slug\);\n  if \(!open\) notFound\(\);/);
    assert.match(claim, /if \(!open \|\| open\.review\) notFound\(\);/); assert.match(claim, /const view = await claimView\(slug, open\.token\);\n  if \(!view\) notFound\(\);/);
    assert.equal((code(preview) + code(claim)).match(/notFound\(\)/g).length, 3, "exactly three failure exits, all the same notFound()");
  });
  test("7 · a VALID invitation whose claiming is closed gets a calm, specific page — not a 404 — and says nothing about anyone else", () => {
    const claim = read("app/launch/[slug]/claim/page.tsx");
    assert.match(claim, /if \(open\.cfg\.claim === "holding"\) return <InviteInactive variant="not_open" \/>;/);
    assert.match(read("components/launch-preview/InviteInactive.tsx"), /title: "Claiming isn’t open yet"/);
  });
  test("7b · used / taken: the same words for both, no mention of who claimed what, in the preview AND the claim page", () => {
    for (const f of ["components/launch-preview/PreviewPage.tsx", "components/launch-preview/ClaimFlow.tsx"]) {
      const t = read(f); assert.match(t, /This invitation is no longer available/); assert.match(t, /hello@oneshetland\.com/);
      assert.doesNotMatch(t, /already been claimed|already been used|used from a different|from another OneShetland account|that claim is still being looked at/);
    }
  });
});

describe("The door is unchanged", () => {
  test("15/16 · a valid token is moved out of the address into an HttpOnly, SameSite=Lax cookie scoped to that one preview, and the redirect is the clean path", () => {
    const h = inviteHandoff("/launch/demo-shop", new URLSearchParams({ invite: TOKEN }));
    assert.equal(h.location, "/launch/demo-shop");
    assert.deepEqual(h.cookie, { name: "lp_invite_demo_shop", value: TOKEN, path: "/launch/demo-shop", maxAge: INVITE_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" });
    assert.doesNotMatch(h.location, /invite|\?/);
  });
  test("a malformed token or slug sets NO cookie, but the query is still shed (so a bad token never sits in the address either)", () => {
    for (const t of ["", "short", "x".repeat(200), "bad token!" + "a".repeat(40)]) { const h = inviteHandoff("/launch/demo-shop", new URLSearchParams({ invite: t })); assert.equal(h.cookie, null); assert.equal(h.location, "/launch/demo-shop"); }
    assert.equal(inviteHandoff("/launch/BAD SLUG", new URLSearchParams({ invite: TOKEN }))?.cookie ?? null, null);
    assert.equal(inviteHandoff("/launch/demo-shop", new URLSearchParams()), null, "no invite parameter: the request carries on untouched");
    assert.ok(isToken(TOKEN) && !isToken("abc") && isSlug("demo-shop") && !isSlug("Demo")); assert.equal(inviteCookieName("a-b-c"), "lp_invite_a_b_c");
  });
  test("the proxy still redirects with 303, no-store and no-referrer, and sets the cookie secure in production", () => {
    const px = read("proxy.ts"); assert.match(px, /status: 303/); assert.match(px, /"Cache-Control", "private, no-store"/); assert.match(px, /"Referrer-Policy", "no-referrer"/); assert.match(px, /secure: process\.env\.NODE_ENV === "production"/);
  });
  test("the door asks the database the SAME two questions for every well-formed token, so the work does not depend on the token's state", () => {
    const t = read("lib/launch-preview/invite.server.ts");
    const a = t.indexOf("await readStoredPreview(slug, token)"); const b = t.indexOf('rpc("launch_invite_resolve"'); const c = t.indexOf("if (!cfg || !cfg.directoryBusinessId) return null;");
    assert.ok(a > 0 && b > a && c > b, "both questions are asked BEFORE any early return on the answers");
    assert.match(t, /if \(!isSlug\(slug\)\) return null;/);
  });
  test("11 · no token reaches a log: nothing in the launch routes, the launch-preview code or the invitation helpers calls console.*", () => {
    const files = [...walk("app/launch"), ...walk("lib/launch-preview"), ...walk("components/launch-preview"), "lib/launch-partners/invite-state.ts", "proxy.ts"];
    for (const f of files) assert.doesNotMatch(read(f), /console\.(log|info|warn|error|debug)/, f);
  });
  test("a valid link still records a view through the database only (the token goes nowhere else)", () => {
    const p = read("app/launch/[slug]/page.tsx"); assert.match(p, /recordPreviewView\(slug, open\.token\)/);
    assert.match(read("lib/launch-partners/campaigns.server.ts"), /launch_invite_record_view/);
  });
});

describe("One canonical lifetime", () => {
  test("8 · 30 days, everywhere it is stated: the policy, the Admin box, the issue action, the email, and the database default", () => {
    assert.equal(INVITE_DEFAULT_DAYS, 30); assert.equal(INVITE_MAX_DAYS, 120);
    assert.equal(clampInviteDays(undefined), 30); assert.equal(clampInviteDays("abc"), 30); assert.equal(clampInviteDays(0), 30); assert.equal(clampInviteDays(-5), 30); assert.equal(clampInviteDays(7), 7); assert.equal(clampInviteDays(500), 120);
    assert.match(read("components/admin/launch-partners/InvitationSection.tsx"), /useState\(INVITE_DEFAULT_DAYS\)/); assert.match(read("components/admin/LaunchInvites.tsx"), /useState\(INVITE_DEFAULT_DAYS\)/);
    assert.match(read("app/admin/launch-partners/actions.ts"), /const d = clampInviteDays\(days\);/);
    for (const f of ["components/admin/launch-partners/InvitationSection.tsx", "components/admin/LaunchInvites.tsx", "app/admin/launch-partners/actions.ts"]) assert.doesNotMatch(read(f), /\|\| 30\b|Math\.min\(120/, `${f} has no second copy of the number`);
  });
  test("the database agrees (30, not 45) — checked against the migration when the sibling repo is present", () => {
    let mig = null; try { mig = readFileSync(new URL("../../../../../../../Users/darrenfullerton/Claude/oneshetland-delivers/supabase/migrations/20261114000000_launch_invite_default_30_days.sql", import.meta.url), "utf8"); } catch { /* sibling repo not present */ }
    if (mig !== null) { assert.match(mig, /default \(now\(\) \+ interval '30 days'\)/); assert.doesNotMatch(mig.replace(/--.*$/gm, ""), /45 days/); }
  });
});

describe("The email's expiry line", () => {
  const link = `https://oneshetland.com/launch/zz?invite=${TOKEN}`; const draft = defaultEmailDraft({ businessName: "ZZ", opening: "You make something genuinely Shetland." });
  const sentence = (v) => (/Your private invitation link is available [^\n<]*?\./.exec(v) ?? [""])[0];
  test("17 · canonical wording: the real date once an invitation exists; '30 days' in a pre-generation preview", () => {
    assert.equal(expiryLine("2026-11-05T19:50:17.506Z"), "Your private invitation link is available until 5 November 2026."); assert.equal(expiryLine(null), "Your private invitation link is available for 30 days.");
    assert.equal(expiryLine("2026-10-06T23:30:00.000Z"), "Your private invitation link is available until 7 October 2026.", "London date, not UTC");
  });
  test("18 · HTML and plain text carry the same sentence, once each", () => {
    const out = renderInvitationEmail({ ...draft, businessName: "ZZ", invitationUrl: link, invitationExpiresAt: "2026-11-05T19:50:17.506Z" });
    assert.equal(sentence(out.text), sentence(out.html)); assert.equal(sentence(out.text), expiryLine("2026-11-05T19:50:17.506Z"));
    for (const v of [out.text, out.html]) assert.equal(v.split("Your private invitation link is available").length - 1, 1);
  });
  test("the line is renderer-enforced: it is not in the editable template, and a draft cannot remove or replace it", () => {
    assert.doesNotMatch(draft.body, /available (until|for)|expires|valid for/i);
    for (const body of ["x\n\n{{INVITATION_CTA}}", "Valid for 90 days.\n\n{{INVITATION_CTA}}"]) assert.ok(renderInvitationEmail({ subject: "s", body, invitationUrl: link, invitationExpiresAt: "2026-11-05T19:50:17.506Z" }).html.includes("until 5 November 2026"));
  });
  test("19/20 · the I3 company disclosure and opt-out wording are untouched and still follow it", () => {
    const t = renderInvitationEmail({ ...draft, businessName: "ZZ", invitationUrl: link, invitationExpiresAt: "2026-11-05T19:50:17.506Z" }).text;
    for (const part of [OUTREACH_IDENTITY, OUTREACH_REGISTRATION, OUTREACH_OFFICE, OUTREACH_CONTACT, OUTREACH_OPT_OUT]) assert.ok(t.includes(part), part);
    assert.ok(t.indexOf("available until") < t.indexOf(OUTREACH_IDENTITY) && t.indexOf(OUTREACH_IDENTITY) < t.indexOf(OUTREACH_OPT_OUT));
  });
  test("the Admin preview shows the invitation's real expiry exactly as the sent email will", () => {
    assert.match(read("components/admin/launch-partners/EmailSection.tsx"), /invitationExpiresAt: sessionLink\?\.expiresAt \?\? \(invLive \? inv\.expires_at : null\)/);
    assert.match(read("app/admin/launch-partners/actions.ts"), /functions\.invoke\("send-launch-invitation"/);
  });
});

describe("How Admin reads an invitation", () => {
  test("states come from existing columns: active · expired · revoked · replaced · used for a claim · claimed — replaced is a revoked invitation with the 'superseded' reason", () => {
    assert.equal(SUPERSEDED_REASON, "superseded by a new invitation");
    const L = (status, revoked_reason = null) => inviteLabel({ status, revoked_reason });
    assert.equal(L("open"), "Active"); assert.equal(L("expired"), "Expired"); assert.equal(L("revoked", "sent to the wrong person"), "Revoked"); assert.equal(L("revoked", SUPERSEDED_REASON), "Replaced");
    assert.equal(L("revoked"), "Revoked"); assert.equal(L("claim pending"), "Used for a claim"); assert.equal(L("claimed"), "Claimed"); assert.equal(L("none"), "Not issued");
    assert.ok(isReplaced({ status: "revoked", revoked_reason: SUPERSEDED_REASON })); assert.ok(!isReplaced({ status: "open", revoked_reason: SUPERSEDED_REASON }));
    // an invitation that had already run out when a newer one was issued reads as Expired — that is what happened first
    assert.equal(inviteLabel({ status: "revoked", revoked_reason: SUPERSEDED_REASON, expires_at: "2026-10-01T10:00:00Z", revoked_at: "2026-10-07T10:00:00Z" }), "Expired");
    assert.equal(inviteLabel({ status: "revoked", revoked_reason: SUPERSEDED_REASON, expires_at: "2026-11-01T10:00:00Z", revoked_at: "2026-10-07T10:00:00Z" }), "Replaced");
    assert.equal(inviteLabel({ status: "revoked", revoked_reason: "sent to the wrong person", expires_at: "2026-11-01T10:00:00Z", revoked_at: "2026-10-07T10:00:00Z" }), "Revoked");
  });
  test("the campaign page shows the current invitation, keeps earlier ones as history, and never shows a link again", () => {
    const s = read("components/admin/launch-partners/InvitationSection.tsx");
    assert.match(s, /Earlier invitations \(\{history\.length\}\)/); assert.match(s, /never shows a newer link/);
    assert.match(read("app/admin/launch-partners/[id]/page.tsx"), /history=\{invitesForSlug\.slice\(1\)\}/);
    assert.match(read("components/admin/LaunchInvites.tsx"), /Replaced by a newer invitation/);
  });
  test("replacing is still guarded: an emailed invitation needs an explicit confirmation, and the action still requires an administrator", () => {
    const a = read("app/admin/launch-partners/actions.ts"); const f = a.slice(a.indexOf("export async function issueInvitationAction"), a.indexOf("export async function revokeInvitationAction"));
    assert.match(f, /await requireAdmin\(\);/); assert.match(f, /already been emailed\. Replacing it makes the link they received stop working/);
    assert.match(f, /admin_issue_launch_invite/); assert.doesNotMatch(f, /functions\.invoke|postmark/i);
  });
});
