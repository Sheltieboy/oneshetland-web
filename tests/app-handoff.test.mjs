/** The website half of the app hand-off. Run: node --test tests/app-handoff.test.mjs (no network, no database). Threat model: docs/editions/APP_HANDOFF_SECURITY.md */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as H from "../lib/app-handoff.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const ORIGIN = "https://oneshetland.com";
const CODE = "A".repeat(43), USER = "6f1c2b3a-1111-4222-8333-444455556666";
const hdr = (o = {}) => ({ get: (k) => o[k.toLowerCase()] ?? null });

/** A fake of the edge function with REAL single-use semantics, so replay is genuinely tested. */
function world(over = {}) {
  const w = { used: new Set(), expired: false, calls: [], exchanged: [], signedOut: 0, current: null, exchangeUser: USER, path: "/organise/zz-org/editions/summer-fest", ...over };
  w.deps = {
    origin: ORIGIN, secureCookies: true, nonce: () => "NONCE", csrf: () => "CSRFTOKEN",
    edge: async (action, code, ip) => {
      w.calls.push({ action, code, ip });
      const valid = code === CODE && !w.used.has(code) && !w.expired;
      if (action === "peek") return valid ? { valid: true, email_masked: "j***@example.com" } : { valid: false };
      if (!valid) return { ok: false };
      w.used.add(code);
      return { ok: true, token_hash: "one-time-token", path: w.path, user_id: USER };
    },
    currentEmail: async () => w.current,
    exchange: async (t) => { w.exchanged.push(t); return w.exchangeUser; },
    signOut: async () => { w.signedOut++; },
  };
  return w;
}
const goodPost = (w, over = {}) => H.handlePost(hdr({ origin: ORIGIN, "sec-fetch-site": "same-origin", cookie: `${H.CSRF_COOKIE}=CSRFTOKEN`, "x-real-ip": "203.0.113.9", ...over.headers }), { code: CODE, csrf: "CSRFTOKEN", ...over.form }, w.deps);
const GENERIC = /This link is no longer available/;

test("GET never consumes the code, however many times scanners and previewers fetch it", async () => {
  const w = world();
  for (let i = 0; i < 5; i++) { const o = await H.handleGet(hdr(), CODE, w.deps); assert.equal(o.status, 200); }
  assert.ok(w.calls.every((c) => c.action === "peek")); assert.equal(w.used.size, 0); assert.equal(w.exchanged.length, 0);
  assert.equal((await goodPost(w)).status, 303, "the real person can still redeem afterwards");
});

test("GET shows the masked identity, the code only inside the form, a Continue button, and no auto-submit", async () => {
  const w = world(); const o = await H.handleGet(hdr(), CODE, w.deps);
  assert.match(o.body, /j\*\*\*@example\.com/); assert.match(o.body, /<form method="post" action="\/app-handoff">/); assert.match(o.body, /<button type="submit">Continue<\/button>/);
  assert.doesNotMatch(o.body, /\.submit\(|requestSubmit|setTimeout|location\s*=|location\.href|fetch\(/);
  assert.match(o.body, /history\.replaceState\(null,"","\/app-handoff"\)/);
  assert.equal(o.body.split(CODE).length - 1, 1, "the code appears exactly once (the hidden field)");
});

test("GET tells a signed-in browser it will be switched (login-CSRF visibility), masked", async () => {
  const w = world({ current: "victim@example.org" }); const o = await H.handleGet(hdr(), CODE, w.deps);
  assert.match(o.body, /currently signed in to the website as v\*\*\*@example\.org/); assert.doesNotMatch(o.body, /victim@example/);
});

test("GET sets a one-time CSRF cookie: HttpOnly, SameSite=Strict, Secure, scoped to the route, short-lived", async () => {
  const o = await H.handleGet(hdr(), CODE, world().deps); const c = o.cookies[0];
  assert.deepEqual([c.name, c.value, c.options.httpOnly, c.options.sameSite, c.options.secure, c.options.path, c.options.maxAge], [H.CSRF_COOKIE, "CSRFTOKEN", true, "strict", true, "/app-handoff", 300]);
});

test("every response: no-store, no-referrer, no framing, no indexing, strict CSP", async () => {
  const w = world();
  for (const o of [await H.handleGet(hdr(), CODE, w.deps), await H.handleGet(hdr(), "bad", w.deps), await goodPost(w), await goodPost(w)]) {
    assert.match(o.headers["Cache-Control"], /no-store/); assert.equal(o.headers["Referrer-Policy"], "no-referrer"); assert.equal(o.headers["X-Content-Type-Options"], "nosniff");
    if (o.status !== 303) { assert.equal(o.headers["X-Frame-Options"], "DENY"); assert.match(o.headers["Content-Security-Policy"], /default-src 'none'.*form-action 'self'.*frame-ancestors 'none'/); assert.doesNotMatch(o.headers["Content-Security-Policy"], /unsafe-eval|script-src[^;]*unsafe-inline/); }
  }
});

test("a good POST redeems once, exchanges the token server-side, and 303s to the allowlisted path with no code in it", async () => {
  const w = world(); const o = await goodPost(w);
  assert.equal(o.status, 303); assert.equal(o.headers.Location, `${ORIGIN}/organise/zz-org/editions/summer-fest`);
  assert.deepEqual(w.exchanged, ["one-time-token"]); assert.doesNotMatch(JSON.stringify(o), new RegExp(`${CODE}|one-time-token`));
  assert.equal(o.cookies[0].value, "", "the CSRF cookie is cleared"); assert.equal(w.calls.at(-1).ip, "203.0.113.9");
});

test("REPLAY: the second use of a code is refused with the generic page and no session is made", async () => {
  const w = world(); assert.equal((await goodPost(w)).status, 303);
  const again = await goodPost(w); assert.equal(again.status, 400); assert.match(again.body, GENERIC); assert.equal(w.exchanged.length, 1);
});

test("EXPIRED: an expired code is refused (GET and POST) with the same generic page", async () => {
  const w = world({ expired: true });
  const g = await H.handleGet(hdr(), CODE, w.deps); const p = await goodPost(w);
  assert.match(g.body, GENERIC); assert.match(p.body, GENERIC); assert.equal(w.exchanged.length, 0);
});

test("failures are indistinguishable: expired, replayed, malformed and unknown all give the same body", async () => {
  const bodies = new Set();
  bodies.add((await H.handleGet(hdr(), CODE, world({ expired: true }).deps)).body.replace(/NONCE/g, ""));
  bodies.add((await H.handleGet(hdr(), "x", world().deps)).body);
  bodies.add((await H.handleGet(hdr(), null, world().deps)).body);
  bodies.add((await H.handleGet(hdr(), "B".repeat(43), world().deps)).body);
  assert.equal(bodies.size, 1);
});

test("WRONG USER: a session minted for somebody else is never kept", async () => {
  const w = world({ exchangeUser: "99999999-9999-4999-8999-999999999999" }); const o = await goodPost(w);
  assert.equal(o.status, 400); assert.equal(w.signedOut, 1);
  const w2 = world({ exchangeUser: null }); assert.equal((await goodPost(w2)).status, 400); assert.equal(w2.signedOut, 0);
});

test("LOGIN CSRF: a cross-site auto-submitted POST (no cookie, or wrong cookie, or wrong origin) is refused before the code is touched", async () => {
  for (const h of [{ cookie: "" }, { cookie: `${H.CSRF_COOKIE}=WRONG` }, { origin: "https://evil.example" }, { origin: undefined }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }]) {
    const w = world(); const o = await goodPost(w, { headers: h });
    assert.equal(o.status, 403, JSON.stringify(h)); assert.equal(w.calls.length, 0, "the code was not even presented"); assert.equal(w.used.size, 0);
  }
  const w = world(); assert.equal((await goodPost(w, { form: { csrf: "" } })).status, 403); assert.equal((await goodPost(w, { form: { csrf: undefined } })).status, 403); assert.equal(w.calls.length, 0);
  assert.equal((await H.handlePost(hdr({ origin: ORIGIN }), { code: CODE, csrf: "" }, w.deps)).status, 403, "empty csrf never equals an empty cookie");
});

test("malformed codes never reach the edge function", async () => {
  const w = world();
  for (const c of [undefined, null, 5, "", "short", "A".repeat(44), "A".repeat(42) + "=", "A".repeat(42) + " ", `${CODE}\n`, ["x"]]) { await goodPost(w, { form: { code: c } }); }
  for (const c of [null, "", "short", "A".repeat(44)]) await H.handleGet(hdr(), c, w.deps);
  assert.equal(w.calls.length, 0);
});

test("DESTINATION: only the closed set of organiser paths is ever redirected to", async () => {
  const good = ["/organise/zz-org", "/organise/zz-org/editions", "/organise/zz-org/team", "/organise/zz-org/profile", "/organise/zz-org/editions/summer-fest"];
  for (const p of good) { const w = world({ path: p }); assert.equal((await goodPost(w)).status, 303, p); }
  const bad = ["/organise/zz-org/packages", "/organise/zz-org/promote", "/organise/zz-org/payments", "/organise/zz-org/members", "/organise/zz-org/editions/x/package", "/organise/zz-org/editions/x/promote", "/organise/zz-org/editions/x/participation", "/organise/zz-org/editions/x/package/checkout", "https://evil.example/organise/a", "//evil.example", "/\tevil.example", "/\\evil.example", "/account", "/organise/a/../../account", "/organise/a?next=/packages", "/organise/a#frag", "/organise/", "", null, 5];
  for (const p of bad) { const w = world({ path: p }); const o = await goodPost(w); assert.equal(o.status, 400, String(p)); assert.equal(w.exchanged.length, 0, "no session is established for a disallowed destination"); }
});

test("the edge client: secret and code travel in headers and body, never a URL; any problem is a refusal", async () => {
  let seen;
  const mk = (resp, over = {}) => async (url, init) => { seen = { url, init }; return resp instanceof Error ? Promise.reject(resp) : { ok: over.ok ?? true, json: async () => resp }; };
  const cfg = (f) => ({ url: "https://proj.supabase.co/", anonKey: "anon", secret: "s".repeat(40), fetch: f });
  const r = await H.callEdge(cfg(mk({ ok: true, token_hash: "t", path: "/organise/a", user_id: USER })), "redeem", CODE, "1.2.3.4");
  assert.equal(r.ok, true); assert.equal(seen.url, "https://proj.supabase.co/functions/v1/editions-web-handoff"); assert.doesNotMatch(seen.url, new RegExp(CODE));
  assert.equal(seen.init.headers["x-handoff-secret"], "s".repeat(40)); assert.equal(seen.init.cache, "no-store"); assert.equal(seen.init.redirect, "error");
  assert.deepEqual(await H.callEdge(cfg(mk({ ok: true, token_hash: "t", path: "/organise/a/packages", user_id: USER })), "redeem", CODE, "ip"), { ok: false }, "a disallowed path from the server is refused here too");
  assert.deepEqual(await H.callEdge(cfg(mk({ ok: true, token_hash: "", path: "/organise/a", user_id: USER })), "redeem", CODE, "ip"), { ok: false });
  assert.deepEqual(await H.callEdge(cfg(mk({}, { ok: false })), "peek", CODE, "ip"), { valid: false });
  assert.deepEqual(await H.callEdge(cfg(mk(new Error("boom"))), "redeem", CODE, "ip"), { ok: false });
  assert.deepEqual(await H.callEdge({ ...cfg(mk({ valid: true, email_masked: "a***@b.c" })), secret: "" }, "peek", CODE, "ip"), { valid: false }, "no secret configured: refused without a request");
});

test("clientIp, maskEmail, cookieValue, escapeHtml", () => {
  assert.equal(H.clientIp(hdr({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "1.1.1.1"); assert.equal(H.clientIp(hdr({ "x-real-ip": "3.3.3.3", "x-forwarded-for": "1.1.1.1" })), "3.3.3.3"); assert.equal(H.clientIp(hdr()), "unknown");
  assert.equal(H.maskEmail("jane@example.com"), "j***@example.com"); assert.equal(H.maskEmail(null), "another account");
  assert.equal(H.cookieValue("a=1; app_handoff_csrf=xyz; b=2", H.CSRF_COOKIE), "xyz"); assert.equal(H.cookieValue("", H.CSRF_COOKIE), ""); assert.equal(H.cookieValue("xapp_handoff_csrf=1", H.CSRF_COOKIE), "");
  assert.equal(H.escapeHtml(`<img src=x onerror="a">'&`), "&lt;img src=x onerror=&quot;a&quot;&gt;&#39;&amp;");
});

test("a hostile masked name cannot inject markup into the confirmation page", async () => {
  const w = world(); w.deps.edge = async () => ({ valid: true, email_masked: '"><script>alert(1)</script>' });
  const o = await H.handleGet(hdr(), CODE, w.deps); assert.doesNotMatch(o.body, /<script>alert/);
});

test("source guards: no service key on the website, no logging, no redirect helpers that could take a parameter, no links to it", () => {
  const files = ["app/app-handoff/route.ts", "lib/app-handoff.ts", "lib/app-handoff.server.ts"].map(read).join("\n");
  assert.doesNotMatch(files, /SERVICE_ROLE|service_role|generateLink|admin\.auth/); assert.doesNotMatch(files, /console\.(log|info|warn|error)/);
  assert.doesNotMatch(files, /searchParams\.get\((?!"code")/, "the only query parameter read is the code (no next / redirect / destination)");
  assert.doesNotMatch(files, /safeNext|redirect\(|NextResponse\.redirect/);
  assert.match(read("lib/app-handoff.server.ts"), /type: "magiclink", token_hash/);
  const route = read("app/app-handoff/route.ts"); assert.match(route, /export async function GET/); assert.match(route, /export async function POST/); assert.match(route, /export async function HEAD/);
  assert.ok(!existsSync(join(ROOT, "app/app-handoff/page.tsx")), "a page and a route at one path would conflict");
});

test("the allowlist regex agrees with the backend's", () => {
  const be = join(ROOT, "..", "oneshetland-be-editions-11-release/supabase/functions/_shared/editions-web-handoff-core.ts");
  if (!existsSync(be)) return;
  const m = readFileSync(be, "utf8").match(/ALLOWED_PATH = (\/.*\/);/); assert.ok(m);
  assert.equal(m[1], String(H.ALLOWED_PATH));
});
