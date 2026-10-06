/**
 * Launch Partner claim flow — the web half. The database half (invitations, labelled pending claims, one claimant,
 * revocation, approval staying with the admin) is proved in the mobile repo's
 * supabase/tests/launch-partner-claims.node.test.ts against the real SQL.
 *
 * Run: node --test tests/launch-claim.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inviteHandoff, TOKEN_RE, SLUG_RE, isToken, isSlug, inviteCookieName, invitePath, INVITE_COOKIE_MAX_AGE } from "../lib/launch-preview/invite.ts";
import { getPreviewConfig, previewSlugs, launchPreviewOptions } from "../lib/launch-preview/registry.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const TOKEN = "a1b2c3d4".repeat(8);                       // 64 hex, the shape the database issues

describe("the invitation never travels in an address after the first hit", () => {
  const hit = (path, search = "") => inviteHandoff(path, new URLSearchParams(search));

  test("?invite= becomes an HttpOnly cookie scoped to that one preview, and the redirect target is clean", () => {
    const h = hit("/launch/love-from-shetland", `?invite=${TOKEN}`);
    assert.equal(h.location, "/launch/love-from-shetland");
    assert.ok(!h.location.includes(TOKEN) && !h.location.includes("?"));
    assert.deepEqual(h.cookie, { name: inviteCookieName("love-from-shetland"), value: TOKEN, path: "/launch/love-from-shetland", maxAge: INVITE_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax" });
  });
  test("a cookie is only ever set for its own slug's path, so one invitation cannot ride on another preview", () => {
    assert.equal(hit("/launch/the-dowry", `?invite=${TOKEN}`).cookie.path, "/launch/the-dowry");
    assert.notEqual(inviteCookieName("the-dowry"), inviteCookieName("love-from-shetland"));
  });
  test("a malformed token or slug sets no cookie but still sheds the query string", () => {
    for (const [path, tok] of [["/launch/love-from-shetland", "short"], ["/launch/love-from-shetland", "x".repeat(200)], ["/launch/Bad_Slug", TOKEN], ["/launch/ab", TOKEN]]) {
      const h = hit(path, `?invite=${tok}`);
      assert.equal(h.cookie, null, `${path} ${tok.slice(0, 8)}`);
      assert.equal(h.location, path);
    }
  });
  test("nothing else is intercepted: other pages and other /launch paths pass straight through", () => {
    for (const [p, q] of [["/", ""], ["/directory", "?invite=x"], ["/launch/love-from-shetland/claim", `?invite=${TOKEN}`], ["/launch/love-from-shetland", ""], ["/launch/a/b/c", `?invite=${TOKEN}`]]) {
      assert.equal(hit(p, q), null, p);
    }
  });
  test("proxy.ts applies it: 303, no-store, no Referer, no query — and still refreshes the session otherwise", () => {
    const px = read("proxy.ts");
    assert.match(px, /inviteHandoff\(request\.nextUrl\.pathname, request\.nextUrl\.searchParams\)/);
    assert.match(px, /status: 303/); assert.match(px, /no-store/); assert.match(px, /no-referrer/); assert.match(px, /clean\.search = ""/);
    assert.match(px, /supabase\.auth\.getUser\(\)/);
  });
  test("the sign-in hand-off carries only the claim path, never a token", () => {
    const claim = read("app/launch/[slug]/claim/page.tsx");
    assert.match(claim, /redirect\(`\/sign-in\?next=\$\{encodeURIComponent\(`\/launch\/\$\{slug\}\/claim`\)\}`\)/);
    assert.doesNotMatch(claim, /next=[^`]*\$\{[^}]*token/i);
  });
});

describe("account creation keeps the way back", () => {
  test("the sign-in page's 'Create an account' link carries next, and sign-up uses it for both the confirmation link and the immediate path", () => {
    assert.match(read("app/sign-in/page.tsx"), /params\.get\("next"\) \? `\/sign-up\?next=\$\{encodeURIComponent\(next\)\}`/);
    const up = read("app/sign-up/page.tsx");
    assert.match(up, /auth\/callback\?next=\$\{encodeURIComponent\(next\)\}/); assert.match(up, /router\.replace\(next\)/);
  });
});

describe("shapes", () => {
  test("tokens and slugs", () => {
    assert.ok(isToken(TOKEN) && TOKEN_RE.test(TOKEN)); assert.ok(isToken("A".repeat(43) + "-_"));
    for (const bad of ["", "short", "x".repeat(129), `${TOKEN} `, "../" + TOKEN, null, undefined, 12, [TOKEN]]) assert.equal(isToken(bad), false, String(bad));
    assert.ok(isSlug("love-from-shetland")); for (const bad of ["Love", "a", "-x-y", "a_b_c", "x".repeat(70), "../x"]) assert.equal(isSlug(bad), false, bad);
  });
  test("every registered preview is tied to exactly one existing business id, and slugs are unique", () => {
    const slugs = previewSlugs();
    assert.equal(new Set(slugs).size, slugs.length);
    for (const s of slugs) assert.match(getPreviewConfig(s).directoryBusinessId, /^[0-9a-f-]{36}$/, s);
    assert.equal(launchPreviewOptions().length, slugs.length);
    assert.equal(getPreviewConfig("love-from-shetland").directoryBusinessId, "fdda4cbe-1e28-4f4d-89d8-aed8317be513");
    assert.equal(getPreviewConfig("zz-test-acceptance").directoryBusinessId, "7c685526-da90-48dc-baab-a962e1ac6956", "acceptance uses the explicit ZZ test listing, never Love From Shetland");
  });
});

describe("the claim goes through the database, with the server holding the token", () => {
  const actions = read("app/launch/[slug]/claim/actions.ts");
  test("the server action reads the token from the cookie, never from the form, and calls the one definer function", () => {
    assert.match(actions, /cookies\(\)\)\.get\(inviteCookieName\(slug\)\)/);
    assert.doesNotMatch(actions, /form\.get\(["'](invite|token)/);
    assert.match(actions, /rpc\("submit_launch_partner_claim"/);
    assert.doesNotMatch(actions, /from\("business_claims"\)|\.insert\(|approve_business_claim|owner_id|admin_grant_launch_plan|products|launch_plan/, "the action creates a claim through the RPC and nothing else");
  });
  test("it requires the explicit confirmation and a signed-in user before it calls the database", () => {
    assert.ok(actions.indexOf('form.get("confirm")') < actions.indexOf("rpc("));
    assert.ok(actions.indexOf("auth.getUser()") < actions.indexOf("rpc("));
  });
  test("the form never contains the token, and sends nothing but the claim fields", () => {
    const flow = read("components/launch-preview/ClaimFlow.tsx");
    assert.doesNotMatch(flow, /token|invite=|lp_invite/i);
    for (const f of ["name", "email", "phone", "role", "evidence", "confirm"]) assert.match(flow, new RegExp(`name="${f}"`));
    assert.match(flow, /I confirm that I own, or am authorised to manage/);
    assert.match(flow, /Your claim has been sent/);
    assert.match(flow, /We&apos;ll confirm the claim before giving you management access\. <strong[^>]*>Nothing from your private preview has been published\./);
  });
  test("every outcome state has its own screen and none names another person", () => {
    const flow = read("components/launch-preview/ClaimFlow.tsx");
    for (const s of ["pending", "owner", "claimed_by_other", "invite_used", "rejected"]) assert.match(flow, new RegExp(`"${s}"`));
    assert.match(flow, /Manage \{businessName\} →/); assert.match(flow, /\/manage\/products/);
    assert.match(flow, /Claimed · Still private setup/);
  });
  test("the owner view routes to the existing management area and products — and creates nothing", () => {
    const page = read("components/launch-preview/PreviewPage.tsx");
    assert.match(page, /\/business\/\$\{businessId\}\/manage`/); assert.match(page, /\/business\/\$\{businessId\}\/manage\/products/);
    assert.match(page, /Claimed · Still private setup/);
    assert.match(page, /Your existing Directory listing is exactly as it was/);
    assert.doesNotMatch(page, /products?\.insert|from\("products"\)/);
  });
  test("no web code copies preview products into the database", () => {
    for (const f of ["lib/launch-preview/invite.server.ts", "lib/launch-preview/directory.ts", "app/launch/[slug]/page.tsx", "app/launch/[slug]/claim/page.tsx", "app/launch/[slug]/claim/actions.ts"]) {
      assert.doesNotMatch(read(f), /\.from\(["']products["']\)|\.insert\(|\.upsert\(|import_create_batch/, f);
    }
  });
});

describe("admin", () => {
  test("a launch-partner claim is recognisable, decided by the existing approve, and leads to an EXPLICIT Premium grant", () => {
    const m = read("components/admin/ClaimsManager.tsx");
    assert.match(m, /Launch partner invitation/); assert.match(m, /approve_business_claim/);
    assert.match(m, /Continue in the launch workflow →/); assert.match(m, /or open Launch partner access directly/); assert.match(m, /tier=premium/);
    assert.doesNotMatch(m, /admin_grant_launch_plan/, "approving never grants a plan on its own");
    const la = read("components/admin/LaunchPartnerAccess.tsx");
    assert.match(la, /admin_grant_launch_plan/); assert.match(la, /initialTier/);
    assert.match(read("lib/admin-data.server.ts"), /source, source_ref/);
  });
  test("invitations are issued, listed and revoked only through the admin RPCs; the link is shown once", () => {
    const i = read("components/admin/LaunchInvites.tsx");
    for (const fn of ["admin_issue_launch_invite", "admin_revoke_launch_invite"]) assert.match(i, new RegExp(fn));
    assert.match(i, /will not be shown again/);
    assert.match(read("app/admin/claims/page.tsx"), /admin_list_launch_invites/);
    assert.doesNotMatch(i, /from\("launch_invites"\)/);
  });
});
