/**
 * assisted-invitations.test.mjs — Phase 2 of Assisted Publishing, from the web's side.
 *
 * WHAT MUST BE TRUE
 *
 *   · the token leaves the address on the FIRST request and lives in an HttpOnly cookie scoped to
 *     that one invitation, so it never reaches the address bar, history, a Referer, analytics or the
 *     sign-in `next=` parameter;
 *   · the recipient page is readable with no account, and declining needs no account;
 *   · nothing in the web layer can make somebody an owner, and nothing uses a service key;
 *   · the invitation email carries no tracking, no marketing list and no unsubscribe machinery, and
 *     the words the administrator reads are the words the Edge Function sends;
 *   · the send path cannot be reached without a confirmed recipient and a live link;
 *   · the wording never calls a fetch a read.
 *
 * Reads the real source files, so it fails if an invariant is quietly removed.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TOKEN_RE, SLUG_RE, isToken, isSlug, claimCookieName, claimPath, claimUrl,
  CLAIM_COOKIE_MAX_AGE, claimHandoff, INVITE_STATUSES, INVITE_STATUS_MEANING, whatYouCouldManage,
} from "../lib/assisted/invites.ts";
import {
  subjectLine, bodyLines, bodyText, bodyHtml, copyBlock, emailGates, EMAIL_GATE_MESSAGE,
} from "../lib/assisted/email.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DELIVERS = join(ROOT, "..", "oneshetland-delivers");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
/** The same file with its comments taken out, for assertions about what the CODE or the SCREEN says. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const readDelivers = (p) => readFileSync(join(DELIVERS, p), "utf8");

const TOKEN = "a".repeat(64);

/* ─────────────────────────────────────────────────────────────────────────── */

describe("1. the token leaves the address immediately", () => {
  test("a well-formed token and slug produce a path-scoped HttpOnly cookie and a clean address", () => {
    const h = claimHandoff("/claim/c0123456789abcdef0123", new URLSearchParams({ invite: TOKEN }));
    assert.equal(h.location, "/claim/c0123456789abcdef0123", "the redirect must drop the query string");
    assert.equal(h.cookie.name, "os_claim_c0123456789abcdef0123");
    assert.equal(h.cookie.value, TOKEN);
    assert.equal(h.cookie.path, "/claim/c0123456789abcdef0123", "the cookie must be scoped to this one invitation");
    assert.equal(h.cookie.httpOnly, true, "the browser's JavaScript must never see the token");
    assert.equal(h.cookie.sameSite, "lax");
    assert.equal(h.cookie.maxAge, CLAIM_COOKIE_MAX_AGE);
  });
  test("a malformed token or slug still sheds the query, and sets no cookie", () => {
    for (const t of ["", "short", "x".repeat(200), "bad token!" + "a".repeat(40)]) {
      const h = claimHandoff("/claim/c0123456789abcdef0123", new URLSearchParams({ invite: t }));
      assert.equal(h.cookie, null);
      assert.equal(h.location, "/claim/c0123456789abcdef0123");
    }
    assert.equal(claimHandoff("/claim/BAD SLUG", new URLSearchParams({ invite: TOKEN })).cookie, null);
  });
  test("a request with no invite parameter is left completely alone", () => {
    assert.equal(claimHandoff("/claim/c0123456789abcdef0123", new URLSearchParams()), null);
    assert.equal(claimHandoff("/hubs/voe-rowing-club", new URLSearchParams({ invite: TOKEN })), null);
    assert.equal(claimHandoff("/claim/abc/extra", new URLSearchParams({ invite: TOKEN })), null);
  });
  test("the handoff is actually wired into the proxy, after the other two", () => {
    const proxy = read("proxy.ts").replace(/\s+/g, " ");
    assert.match(proxy, /claimHandoff\(request\.nextUrl\.pathname/, "the claim handoff is not called");
    assert.match(proxy, /\?\? claimHandoff/, "it must be tried alongside the existing handoffs");
    assert.match(proxy, /Referrer-Policy["']?, ["']no-referrer/, "the redirect must send no referrer");
    assert.match(proxy, /Cache-Control["']?, ["']private, no-store/);
  });
  test("the shapes agree with what the database issues", () => {
    assert.ok(isToken(TOKEN));
    assert.ok(isToken("0".repeat(64)));
    assert.ok(!isToken("0".repeat(39)));
    assert.ok(isSlug("c0123456789abcdef0123"), "the database issues c + 20 hex characters");
    assert.ok(!isSlug("Da-Muckle-Market"), "a slug must never carry the organisation name's case");
    assert.ok(TOKEN_RE.source.includes("40,128"));
    assert.ok(SLUG_RE.source.includes("2,60"));
  });
  test("the only place a link is built is from a token still in memory", () => {
    assert.equal(claimUrl("https://oneshetland.com/", "c0123456789abcdef0123", TOKEN),
      `https://oneshetland.com/claim/c0123456789abcdef0123?invite=${TOKEN}`);
    assert.equal(claimPath("c0123456789abcdef0123"), "/claim/c0123456789abcdef0123");
  });
});

describe("2. the recipient page", () => {
  const page = read("app/claim/[slug]/page.tsx");
  test("it is never indexed, and sends no referrer", () => {
    assert.match(page, /robots:\s*{[^}]*index:\s*false/s);
    assert.match(page, /referrer:\s*"no-referrer"/);
    assert.match(page, /dynamic = "force-dynamic"/);
  });
  test("it reads the token from the cookie, never from the address", () => {
    assert.doesNotMatch(page, /searchParams/, "the page must not read a token from the query string");
    assert.match(page, /openInvitation\(slug\)/);
  });
  test("every failure is the same notFound(), so nothing is distinguishable", () => {
    assert.match(page, /if \(!open\) notFound\(\);/);
    const dead = code("app/claim/not-found.tsx");
    assert.match(dead, /no longer active/i);
    assert.doesNotMatch(dead, /<form|<input|<textarea/, "the dead-link page must take no input");
    assert.doesNotMatch(dead, /expired|revoked|declined|wrong/i, "it must not say WHICH failure it was");
  });
  test("signing in comes back to an address with no token in it", () => {
    assert.match(page, /\/sign-in\?next=\$\{encodeURIComponent\(`\/claim\/\$\{slug\}`\)\}/);
    assert.doesNotMatch(page, /next=.*invite=/, "the token must never go into a next= parameter");
  });
  test("rendering the page counts a FETCH and nothing more", () => {
    assert.match(page, /await recordFetch\(slug, open\.token\)/);
    assert.match(page, /security scanner/i, "the page must say what a fetch actually is");
    const server = read("lib/assisted/invites.server.ts");
    assert.match(server, /assisted_invite_record_fetch/);
    assert.match(server, /catch \{ \/\* counting a fetch must never break the page/);
  });
  test("nobody is signed in and the page still works", () => {
    assert.match(page, /const state = account \? .* : null;/s);
    const ui = read("components/assisted/InvitationPage.tsx");
    assert.match(ui, /signedIn \? /s);
    assert.match(ui, /No thanks/);
  });
  test("the page says plainly that it is optional and free", () => {
    const ui = read("components/assisted/InvitationPage.tsx");
    assert.match(ui, /You do not have to do anything/);
    assert.match(ui, /optional and free/);
    assert.match(ui, /the link on its own is not enough/i);
  });
});

describe("3. nothing in the web layer grants ownership or uses a key", () => {
  const files = [
    "lib/assisted/invites.ts", "lib/assisted/invites.server.ts", "lib/assisted/email.ts",
    "app/claim/[slug]/page.tsx", "app/claim/[slug]/actions.ts", "app/admin/assisted/actions.ts",
    "app/assisted-help/actions.ts",
    "components/assisted/InvitationPage.tsx", "components/assisted/OwnerHelpToggle.tsx",
    "components/admin/assisted/InviteToManage.tsx", "components/admin/assisted/ClaimsWaiting.tsx",
    "components/admin/assisted/ContinuedHelp.tsx",
  ];
  test("no service key, anywhere", () => {
    for (const f of files) {
      assert.doesNotMatch(read(f), /SERVICE_ROLE|service_role|service_key/i, `${f} reaches for a service key`);
    }
  });
  test("no direct write to an ownership column", () => {
    for (const f of files) {
      const s = read(f);
      assert.doesNotMatch(s, /\.from\(["'](hubs|local_businesses|business_claims|hub_claims|assisted_invites)["']\)/,
        `${f} writes to an ownership table directly instead of through a function`);
      assert.doesNotMatch(s, /owner_id\s*[:=]\s*/, `${f} sets owner_id itself`);
    }
  });
  test("every admin action begins with requireAdmin()", () => {
    const s = read("app/admin/assisted/actions.ts");
    const fns = s.match(/export async function \w+/g) ?? [];
    assert.ok(fns.length >= 12, `expected the Phase 1 and Phase 2 actions, found ${fns.length}`);
    for (const m of s.split(/export async function /).slice(1)) {
      const name = m.slice(0, m.indexOf("("));
      const head = m.slice(0, 600);
      assert.match(head, /await requireAdmin\(\);/, `${name} does not check that the caller is an administrator`);
    }
  });
  test("the owner's own action file is deliberately NOT behind requireAdmin", () => {
    const s = code("app/assisted-help/actions.ts");
    assert.doesNotMatch(s, /requireAdmin/, "the owner is not an administrator; the database checks they are the owner");
    assert.match(s, /owner_assisted_support_grant|grantSupportAsOwner/);
    assert.match(read("app/assisted-help/actions.ts"), /checks that the caller really is the owner/i);
  });
  test("the recipient's actions read the token server-side and confirm the connection", () => {
    const s = code("app/claim/[slug]/actions.ts");
    assert.match(s, /"use server"/);
    assert.match(s, /await tokenFor\(slug\)/);
    assert.match(s, /form\.get\("confirm"\) !== "on"/, "a claim must require the authorisation tick");
    assert.doesNotMatch(s, /approve/i, "the recipient's own actions must not be able to approve anything");
  });
});

describe("4. the invitation email", () => {
  const facts = {
    kind: "hub", name: "Voe Rowing Club",
    publicUrl: "https://oneshetland.com/hubs/voe-rowing-club",
    claimUrl: `https://oneshetland.com/claim/c0123456789abcdef0123?invite=${TOKEN}`,
    invitedName: "Ina Smith",
    expiresAt: "2026-12-21T12:00:00.000Z",
  };
  test("it says what we made, that it is already public, and that claiming is optional", () => {
    const t = bodyText(facts);
    assert.match(t, /I've added a page for Voe Rowing Club/);
    assert.match(t, /It is already there/);
    assert.match(t, /It is free, and it is entirely up to you/);
    assert.match(t, /if you'd rather not have an account, that's completely fine/);
    assert.match(t, /taken down altogether/);
  });
  test("it does not pretend a link is enough", () => {
    assert.match(bodyText(facts), /I check that you're connected to Voe Rowing Club before handing it over/);
  });
  test("it names a real expiry date", () => {
    assert.match(bodyText(facts), /This link works until 21 December 2026\./);
  });
  test("it lists what they could actually manage, and the two kinds differ", () => {
    const hub = whatYouCouldManage("hub");
    const biz = whatYouCouldManage("business");
    assert.notDeepEqual(hub, biz);
    assert.ok(hub.some((l) => /fundraising/.test(l)));
    assert.ok(biz.some((l) => /offers and products/i.test(l)));
    for (const l of hub) assert.ok(bodyText(facts).includes(l), `the email omits "${l}"`);
  });
  test("there is no tracking pixel, no remote image and no marketing machinery", () => {
    const html = bodyHtml(facts);
    assert.doesNotMatch(html, /<img/i, "an email like this must carry no image, tracked or otherwise");
    assert.doesNotMatch(html, /unsubscribe|mailing list|preferences/i);
    assert.doesNotMatch(html, /utm_|\?src=|pixel/i);
    assert.ok(!/https?:\/\/(?!oneshetland\.com)/.test(html.replace(/oneshetland\.com/g, "oneshetland.com")) ||
      (html.match(/https?:\/\/[^"' ]+/g) ?? []).every((u) => u.includes("oneshetland.com")),
      "every link in the email must be to oneshetland.com");
  });
  test("the subject names the organisation and asks rather than tells", () => {
    assert.equal(subjectLine(facts), "Voe Rowing Club is on OneShetland — would you like to look after the page?");
    assert.match(subjectLine({ ...facts, kind: "business" }), /look after the listing\?$/);
  });
  test("the copy block is ready for the clipboard, subject and all", () => {
    const c = copyBlock(facts);
    assert.ok(c.startsWith("Subject: "));
    assert.ok(c.includes(facts.claimUrl));
  });
  test("with no link generated yet, the email says so instead of inventing one", () => {
    const t = bodyText({ ...facts, claimUrl: null });
    assert.match(t, /inserted here when you generate the invitation/);
    assert.doesNotMatch(t, /invite=/);
  });
  test("the recipient's name is used when we have it, and skipped when we do not", () => {
    assert.match(bodyText(facts), /^Hello Ina Smith,/);
    assert.match(bodyText({ ...facts, invitedName: null }), /^Hello,/);
    assert.match(bodyText({ ...facts, invitedName: "   " }), /^Hello,/);
  });
  test("HTML is escaped, so a name cannot inject markup", () => {
    const html = bodyHtml({ ...facts, name: 'Voe <script>alert(1)</script> Club' });
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });
});

describe("5. the two renderers stay in lock-step", () => {
  // The web renders the message for the administrator to read; the Edge Function renders it for the
  // provider to send. They are separate files because one is Deno, so this reads both and compares.
  const web = read("lib/assisted/email.ts");
  const deno = readDelivers("supabase/functions/_shared/assisted-invitation-text.ts");
  const norm = (s) => s.replace(/\\?['"]/g, "'").replace(/\s+/g, " ").trim();
  const sentences = [
    "I'm Darren, and I run OneShetland",
    "It is already there, and you can see it here",
    "I wrote it from information that is already publicly available",
    "If you'd like to look after it yourself, you can. It is free",
    "before handing it over, which is why it isn't simply a case of clicking a link",
    "This link works until",
    "that's completely fine. The",
    "taken down altogether, say so and I'll remove it",
  ];
  test("every paragraph of the message appears in both files", () => {
    for (const s of sentences) {
      assert.ok(norm(web).includes(norm(s)), `the web renderer has lost: ${s}`);
      assert.ok(norm(deno).includes(norm(s)), `the Deno renderer has lost: ${s}`);
    }
  });
  test("so does every bullet, and the subject line", () => {
    for (const kind of ["hub", "business"]) {
      for (const l of whatYouCouldManage(kind)) {
        assert.ok(norm(deno).includes(norm(l)), `the Deno renderer has lost the bullet: ${l}`);
      }
    }
    assert.ok(norm(deno).includes(norm("is on OneShetland — would you like to look after the")));
  });
  test("and the Deno copy says out loud that it is a copy", () => {
    assert.match(deno, /DELIBERATE SECOND COPY/);
    assert.match(deno, /lock-step/);
  });
});

describe("6. sending is a separate, gated, confirmed step", () => {
  test("creating or generating an invitation sends nothing", () => {
    const ui = read("components/admin/assisted/InviteToManage.tsx");
    assert.match(ui, /It sends nothing/);
    const actions = read("app/admin/assisted/actions.ts");
    assert.match(actions, /This SENDS NOTHING/);
  });
  test("the gates say what is missing, in a sensible order", () => {
    assert.deepEqual(emailGates({ claimUrl: null, recipient: null, status: "prepared", doNotContact: false, resend: false }),
      ["no_link", "no_recipient"]);
    assert.deepEqual(emailGates({ claimUrl: "x", recipient: "nope", status: "prepared", doNotContact: false, resend: false }),
      ["bad_recipient"]);
    assert.deepEqual(emailGates({ claimUrl: "x", recipient: "a@b.co", status: "revoked", doNotContact: false, resend: false }),
      ["not_live"]);
    assert.deepEqual(emailGates({ claimUrl: "x", recipient: "a@b.co", status: "sent", doNotContact: false, resend: false }),
      ["already_sent"]);
    assert.deepEqual(emailGates({ claimUrl: "x", recipient: "a@b.co", status: "sent", doNotContact: false, resend: true }), []);
    assert.equal(emailGates({ claimUrl: "x", recipient: "a@b.co", status: "prepared", doNotContact: true, resend: false })[0],
      "do_not_contact", "do-not-contact must come first — nothing below can make it sendable");
  });
  test("every gate has a message written for a person", () => {
    for (const [k, v] of Object.entries(EMAIL_GATE_MESSAGE)) {
      assert.ok(v.length > 12 && /[.!]$/.test(v), `${k} has no plain-English message`);
    }
  });
  test("the web has no mail transport: it asks the Edge Function", () => {
    const s = read("app/admin/assisted/actions.ts");
    assert.match(s, /functions\.invoke\("send-assisted-invitation"/);
    assert.match(s, /NO mail transport and NO provider key/);
    assert.doesNotMatch(s, /postmarkapp|POSTMARK_API_KEY|nodemailer|sendgrid/i);
    // The request carries no recipient, subject or body — only the slug, the token and the confirmation.
    assert.match(s, /body: \{ slug: m\[1\], token: m\[2\], confirm:/);
  });
  test("a failure to send is never reported as sent", () => {
    const s = read("app/admin/assisted/actions.ts");
    assert.match(s, /nothing was recorded as sent/);
    assert.match(s, /can never be mistaken for "sent"/);
  });
  test("the Edge Function reserves the send before it calls the provider", () => {
    const send = readDelivers("supabase/functions/_shared/assisted-invitation-send.ts");
    assert.ok(send.indexOf("markSent(slug)") < send.indexOf("d.send("),
      "the send must be reserved in the database BEFORE the provider is called");
    assert.match(send, /holds no service-role key/);
    assert.match(send, /Never the link, never the token, never the recipient/);
  });
  test("the Edge Function is admin-only and reads the recipient from the database", () => {
    const fn = readDelivers("supabase/functions/send-assisted-invitation/index.ts");
    assert.match(fn, /me\?\.role !== 'admin'/);
    assert.match(fn, /not a general email relay/);
    assert.match(fn, /enforceRateLimit\('send-assisted-invitation'/);
    assert.doesNotMatch(fn, /SUPABASE_SERVICE_ROLE_KEY/);
  });
  test("link and open tracking are off, through the shared provider helper", () => {
    const pm = readDelivers("supabase/functions/_shared/launch-invitation-postmark.ts");
    assert.match(pm, /TrackOpens: false/);
    assert.match(pm, /TrackLinks: 'None'/);
    const fn = readDelivers("supabase/functions/send-assisted-invitation/index.ts");
    assert.match(fn, /postmarkSend/, "it must go through the helper that turns tracking off");
  });
});

describe("7. the wording never calls a fetch a read", () => {
  test("the status list is the one the database reports", () => {
    assert.deepEqual([...INVITE_STATUSES],
      ["prepared", "sent", "link fetched", "claim requested", "approved", "rejected", "declined", "expired", "revoked"]);
    for (const s of INVITE_STATUSES) {
      assert.ok(INVITE_STATUS_MEANING[s]?.length > 15, `${s} has no explanation`);
    }
  });
  test('"link fetched" explains itself honestly', () => {
    assert.match(INVITE_STATUS_MEANING["link fetched"], /security scanner/i);
    assert.match(INVITE_STATUS_MEANING["link fetched"], /not proof/i);
  });
  test("nothing in the admin screens says opened, read or seen", () => {
    for (const f of ["components/admin/assisted/InviteToManage.tsx", "lib/assisted/invites.ts"]) {
      const s = read(f);
      assert.doesNotMatch(s, /\bopen(ed|s)? the (email|invitation)\b/i, `${f} claims somebody opened it`);
      assert.doesNotMatch(s, /\bhas read\b|\bwas read\b|\bthey read it\b/i, `${f} claims somebody read it`);
    }
  });
  test("declining and expiring are both described as leaving the page alone", () => {
    assert.match(INVITE_STATUS_MEANING.declined, /unchanged/);
    assert.match(INVITE_STATUS_MEANING.expired, /unchanged/);
    assert.match(INVITE_STATUS_MEANING.rejected, /unchanged/);
  });
  test("the admin screen shows the link once, and says so", () => {
    const ui = read("components/admin/assisted/InviteToManage.tsx");
    assert.match(ui, /only time the link is shown/i);
    assert.match(ui, /one-way hash/i);
    assert.match(ui, /the link is lost/i);
  });
});

describe("8. the decision screen, and carrying on helping", () => {
  test("the claim screen warns that a matching address is a hint, not proof", () => {
    const s = read("components/admin/assisted/ClaimsWaiting.tsx");
    assert.match(s, /a hint, not proof/);
    assert.match(s, /an invitation\s*\n?\s*can be forwarded/s);
  });
  test("it refuses to offer a handover for a Hub with private history", () => {
    const s = read("components/admin/assisted/ClaimsWaiting.tsx");
    assert.match(s, /disabled=\{busy === c\.claim_id \|\| history\.length > 0\}/);
    assert.match(s, /must not inherit members,\s*\n?\s*donors or payments/s);
  });
  test("turning a claim down is described as leaving everything alone", () => {
    const s = read("components/admin/assisted/ClaimsWaiting.tsx");
    assert.match(s, /leaves the page exactly as it is/);
    assert.match(s, /Nothing is taken down/);
  });
  test("the owner's toggle is honest about what it does and does not do", () => {
    const s = read("components/assisted/OwnerHelpToggle.tsx");
    assert.match(s, /You stay the owner/);
    assert.match(s, /stop this at any moment/);
    assert.match(s, /every edit\s*\n?\s*they make is recorded/s);
    assert.doesNotMatch(s, /transfer|hand over/i, "lending a permission is not a handover");
  });
  test("an administrator can only WRITE DOWN a permission, and must say how it was given", () => {
    const s = read("components/admin/assisted/ContinuedHelp.tsx");
    assert.match(s, /the permission belongs to the owner/i);
    assert.match(s, /required/);
    assert.match(s, /minLength=\{10\}/);
    assert.match(s, /marked as a permission you recorded rather than one they set/);
  });
  test("the toggle is offered to the Hub's owner only, not to a committee member", () => {
    const s = read("app/hubs/[id]/manage/page.tsx");
    assert.match(s, /admin\.role === "owner" && \(/);
    assert.match(s, /the database refuses anybody else, including a committee member/);
  });
});

describe("9. the migration promises what the web relies on", () => {
  const sql = readFileSync(join(ROOT, "..", "oneshetland-be-edfinish",
    "supabase/migrations/20270316000000_assisted_publishing_phase2.sql"), "utf8");
  test("only a hash of the token is stored", () => {
    assert.match(sql, /token_hash\s+text not null/);
    assert.doesNotMatch(sql, /^\s*token\s+text/m);
    assert.match(sql, /encode\(sha256\(convert_to\(/);
  });
  test("anon may read an invitation, count a fetch and decline — and nothing else", () => {
    const grant = sql.slice(sql.indexOf("to anon;") - 400, sql.indexOf("to anon;") + 10);
    assert.match(grant, /assisted_invite_open/);
    assert.match(grant, /assisted_invite_record_fetch/);
    assert.match(grant, /assisted_invite_decline/);
    assert.doesNotMatch(grant, /submit_assisted_claim|admin_assisted/);
  });
  test("the invitation binds on acceptance, not on a fetch", () => {
    assert.match(sql, /acceptance-based binding: set when a signed-in person submits a claim/);
    const fetchFn = sql.slice(sql.indexOf("function public.assisted_invite_record_fetch"));
    const body = fetchFn.slice(0, fetchFn.indexOf("$$;"));
    assert.doesNotMatch(body, /bound_user_id|owner_id/, "counting a fetch must not bind or own anything");
  });
  test("a Hub with private history is refused, by name", () => {
    assert.match(sql, /has_private_history/);
    for (const t of ["hub_members", "hub_donations", "hub_campaigns", "hub_membership_purchases", "hub_membership_types", "hub_documents"]) {
      assert.ok(sql.includes(t), `the private-history guard does not look at ${t}`);
    }
  });
  test("the Launch Partner machinery is left alone", () => {
    assert.doesNotMatch(sql, /alter table public\.launch_invites/i);
    assert.match(sql, /launch_invites was altered: refusing to commit/);
  });
  test("ownership still cannot be written by a client", () => {
    assert.match(sql, /a client can write hub ownership: refusing to commit/);
    assert.match(sql, /the hub column lock is gone: refusing to commit/);
  });
  test("it creates no invitation and invites nobody", () => {
    assert.match(sql, /this migration created % invitations: refusing to commit/);
    assert.match(sql, /this migration created % hub claims: refusing to commit/);
  });
});

describe("10. declining: the person is respected, the organisation is not punished", () => {
  const sql = readFileSync(join(ROOT, "..", "oneshetland-be-edfinish",
    "supabase/migrations/20270316000000_assisted_publishing_phase2.sql"), "utf8");
  const ui = read("components/admin/assisted/InviteToManage.tsx");
  const page = read("components/assisted/InvitationPage.tsx");

  test("a decline cancels that invitation and records a contact preference by ADDRESS", () => {
    assert.match(sql, /the invitation is cancelled/);
    assert.match(sql, /insert into public\.assisted_contact_preferences/);
    assert.match(sql, /keyed by ADDRESS/i, "the reason for keying it by address must be written down");
    assert.match(sql, /contact_preference_recorded/);
  });
  test("it never writes to the Launch Partner list, and says why it cannot", () => {
    assert.doesNotMatch(sql, /insert into public\.launch_outreach_suppressions/);
    assert.match(sql, /business_id` is NOT NULL/, "the reason a separate list exists must be recorded");
    assert.match(sql, /launch_outreach_suppressions was altered: refusing to commit/);
  });
  test("the preference is append-only: written once, afterwards only lifted", () => {
    assert.match(sql, /assisted_contact_preferences is append-only/);
    assert.match(sql, /before update or delete on public\.assisted_contact_preferences/);
    assert.match(sql, /the contact-preference append-only guard is missing: refusing to commit/);
  });
  test("both lists stop a send, and the refusal says which one", () => {
    assert.match(sql, /function public\.assisted_contact_blocked/);
    assert.match(sql, /they declined an invitation/);
    assert.match(sql, /Launch Partner outreach was stopped/);
    assert.match(ui, /r\.reason === "do_not_contact"/);
    assert.match(ui, /by email or by hand/);
  });
  test("it stops writing to that PERSON, not inviting that organisation", () => {
    assert.match(sql, /It stops SENDS, and nothing else/);
    assert.match(sql, /can still be invited again after an administrator checks and says why/);
    assert.match(ui, /The organisation can still be invited; only writing to/);
  });
  test("a second ask is possible, needs a reason, and is its own audit line", () => {
    assert.match(sql, /must never PERMANENTLY stop the organisation being/);
    assert.match(sql, /Write down what you checked before inviting them again/);
    assert.match(sql, /'declined_override'/);
    assert.match(ui, /name="override_reason" required minLength=\{10\}/);
    assert.match(ui, /What have you checked\?/);
    assert.doesNotMatch(ui, /Invite them again anyway/, "a second ask must not read as a shrug");
  });
  test("lifting a preference needs a reason, is offered in the same panel, and is kept", () => {
    assert.match(sql, /function public\.admin_assisted_contact_preference_lift/);
    assert.match(sql, /how they told us it was all right to write again/);
    assert.match(sql, /lift_reason\s+text check \(lift_reason is null or \(char_length\(lift_reason\) between 10 and 500\)\)/);
    assert.match(ui, /liftContactPreference\(\{ email:/);
    assert.match(ui, /They have told us it is all right…/);
  });
  test("the Send button is withheld while the address is blocked", () => {
    assert.match(ui, /!live\.do_not_contact && !issued\.contactBlocked/);
    assert.match(ui, /the Send button is not offered/);
  });
  test("and no client can reach the preference list", () => {
    assert.match(sql, /revoke all on public\.assisted_contact_preferences from anon, authenticated/);
    assert.match(sql, /a client can read an invitation or assistance table: refusing to commit/);
    const grant = sql.slice(sql.indexOf("to anon;") - 500, sql.indexOf("to anon;") + 10);
    assert.doesNotMatch(grant, /contact_preference/);
  });
  test("the recipient's own page still says declining changes nothing", () => {
    assert.match(page, /stays exactly as it is/);
    assert.match(page, /we will not ask again/);
  });
});

describe("11. an assistance grant is scoped, time-limited, auditable and revocable", () => {
  const sql = readFileSync(join(ROOT, "..", "oneshetland-be-edfinish",
    "supabase/migrations/20270316000000_assisted_publishing_phase2.sql"), "utf8");
  test("scoped to one record", () => {
    assert.match(sql, /subject_kind\s+text not null check \(subject_kind in \('business', 'hub'\)\)/);
    assert.match(sql, /where subject_kind = p_kind and subject_id = p_id/);
  });
  test("time-limited, and void when the record changes hands", () => {
    assert.match(sql, /expires_at\s+timestamptz not null/);
    assert.match(sql, /Choose between 1 and 365 days/);
    assert.match(sql, /and owner_at_grant = v_owner/, "a grant must not follow the record to a new owner");
  });
  test("revocable by either side", () => {
    assert.match(sql, /function public\.assisted_support_revoke/);
    assert.match(sql, /if v_owner is distinct from v_uid and not public\.is_admin\(\) then/);
  });
  test("auditable, with the fields each edit touched", () => {
    assert.match(sql, /insert into public\.assisted_support_edits/);
    assert.match(sql, /jsonb_object_agg\(k, true\)/);
    assert.match(sql, /function public\.admin_assisted_support_log/);
  });
  test("and owner-granted is distinguishable from recorded-by-us, everywhere", () => {
    assert.match(sql, /granted_via\s+text not null check \(granted_via in \('owner', 'owner_asked_us'\)\)/);
    assert.match(sql, /assisted_support_note_when_recorded/);
    const owner = read("components/assisted/OwnerHelpToggle.tsx");
    assert.match(owner, /written down by OneShetland after you asked them to help/);
    assert.match(owner, /You turned this on yourself/);
    const admin = read("components/admin/assisted/ContinuedHelp.tsx");
    assert.match(admin, /turned this on themselves/);
    assert.match(admin, /You recorded this after they asked/);
  });
  test("and the organisation that would rather we managed it does nothing at all", () => {
    const page = read("components/assisted/InvitationPage.tsx");
    assert.match(page, /You do not have to do anything/);
    assert.match(page, /we will keep looking\s*\n?\s*after it/s);
  });
});

describe("12. one do-not-contact posture across both programmes", () => {
  const sql = readFileSync(join(ROOT, "..", "oneshetland-be-edfinish",
    "supabase/migrations/20270316000000_assisted_publishing_phase2.sql"), "utf8");
  const rollback = readFileSync(join(ROOT, "..", "oneshetland-be-edfinish",
    "supabase/rollbacks/20270316000000_assisted_publishing_phase2.rollback.sql"), "utf8");
  const panel = read("components/admin/launch-partners/OutreachStopSection.tsx");
  const status = read("lib/launch-partners/status.ts");
  const workflow = read("lib/launch-partners/workflow.ts");

  test("exactly ONE Launch Partner function is replaced, and it is the chokepoint", () => {
    const replaced = [...sql.matchAll(/create or replace function public\.(launch[a-z_]*|_launch[a-z_]*|admin_launch[a-z_]*)\(/g)]
      .map((m) => m[1]);
    assert.deepEqual([...new Set(replaced)], ["_launch_partner_outreach_block"],
      `this migration replaces more of the Launch Partner programme than the one gate: ${replaced.join(", ")}`);
  });
  test("and the proof refuses to commit if the send stops calling that gate", () => {
    assert.match(sql, /the Launch Partner send no longer calls the do-not-contact gate: refusing to commit/);
    assert.match(sql, /the Launch Partner do-not-contact gate is missing: refusing to commit/);
  });
  test("applying it is a no-op on the day, and the proof says so", () => {
    assert.match(sql, /it changes NOTHING: assisted_contact_preferences is empty/);
    assert.match(sql, /this is not a no-op change: refusing to commit/);
  });
  test("every key the Launch Partner screens already read is preserved", () => {
    for (const k of ["'id'", "'scope'", "'reason'", "'note'", "'since'", "'by'", "'business_id'", "'address_recorded'"]) {
      assert.ok(sql.includes(`${k}, `), `the gate no longer returns ${k}`);
    }
    assert.match(sql, /'contact_email', c\.contact_email/, "the new scope needs the address, for the lift");
  });
  test("a business-scoped suppression still wins, so its own screen can still lift it", () => {
    assert.match(sql, /order by c\.business_scoped desc, c\.since desc/);
    assert.match(sql, /the more specific rule and the only one liftable from that business's own screen/);
  });
  test("the type admits the third scope and a null business", () => {
    assert.match(status, /scope: "business" \| "address" \| "assisted_decline";/);
    assert.match(status, /business_id: string \| null;/);
    assert.match(status, /contact_email\?: string \| null;/);
  });
  test("the panel never builds a business link for a decline", () => {
    const declineBranch = panel.slice(panel.indexOf('o.scope === "assisted_decline" ? ('),
      panel.indexOf("To lift it, open the business"));
    assert.doesNotMatch(declineBranch, /for-business\/\$\{o\.business_id\}/,
      "a decline carries no business_id, so it must not be linked");
    assert.match(declineBranch, /liftAssistedContactPreferenceAction/, "the lift must be offered in place");
    assert.match(declineBranch, /lift\.trim\(\)\.length < 10/, "the reason must be a real one");
  });
  test("it says clearly that the PERSON is blocked and the business is not", () => {
    assert.match(panel, /contact declined a OneShetland invitation/);
    assert.match(panel, /itself is not blocked: a different contact can still be invited/);
    assert.match(panel, /affects both\s*\n?\s*Launch Partner outreach and OneShetland invitations/s);
  });
  test("and the workflow rail says which of the three rules stopped the send", () => {
    assert.match(workflow, /assisted_decline" \? " \(this contact declined a OneShetland invitation/);
  });
  test("the rollback puts the gate back BEFORE it drops the table the gate reads", () => {
    const gate = rollback.indexOf("create or replace function public._launch_partner_outreach_block");
    const drop = rollback.indexOf("drop table if exists public.assisted_contact_preferences");
    assert.ok(gate > -1 && drop > gate,
      "the rollback would leave the Launch Partner send gate reading a table that no longer exists");
    // Only the restored FUNCTION BODY, not everything between it and the drop (which is a list of
    // drops that legitimately name the assisted objects).
    const body = rollback.slice(gate, rollback.indexOf("$$;", gate));
    assert.doesNotMatch(body, /assisted_contact_preferences/,
      "the restored gate still references the assisted table");
    assert.match(body, /from public\.launch_outreach_suppressions s/, "the restored gate is not the production one");
  });
});
