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
const CODE = "A".repeat(43), USER = "6f1c2b3a-1111-4222-8333-444455556666", EMAIL = "jane.smith@example.com", NUMBER = "4821";
const hdr = (o = {}) => ({ get: (k) => o[k.toLowerCase()] ?? null });

/** A fake of the edge function with REAL semantics: single use, check number, three wrong numbers burn the code. */
function world(over = {}) {
  const w = { used: new Set(), burned: false, fails: 0, expired: false, calls: [], exchanged: [], signedOut: 0, current: null, exchangeUser: USER, path: "/organise/zz-org/editions/summer-fest", completed: [], ...over };
  w.deps = {
    origin: ORIGIN, secureCookies: true, nonce: () => "NONCE", csrf: () => "CSRFTOKEN",
    edge: async (c) => {
      w.calls.push(c);
      const valid = c.code === CODE && !w.used.has(c.code) && !w.burned && !w.expired;
      if (c.action === "peek") return valid ? { valid: true, user_id: USER, email: EMAIL } : { valid: false };
      if (c.action === "complete") { w.completed.push({ ok: c.ok, reason: c.reason }); return { ok: true }; }
      if (!valid) return { ok: false };
      if (c.number !== NUMBER) { w.fails++; if (w.fails >= 3) w.burned = true; return { ok: false, reason: "bad_number", left: 3 - w.fails }; }
      w.used.add(c.code);
      return { ok: true, token_hash: "one-time-token", path: w.path, user_id: USER };
    },
    currentUser: async () => w.current,
    exchange: async (t) => { w.exchanged.push(t); return w.exchangeUser; },
    signOut: async () => { w.signedOut++; },
  };
  return w;
}
const okHeaders = (extra = {}) => ({ origin: ORIGIN, "sec-fetch-site": "same-origin", cookie: `${H.CSRF_COOKIE}=CSRFTOKEN`, "x-vercel-forwarded-for": "203.0.113.9", ...extra });
const post = (w, over = {}) => H.handleRedeem(hdr(okHeaders(over.headers)), { code: CODE, csrf: "CSRFTOKEN", number: NUMBER, ...over.form }, w.deps);
const peek = (w, over = {}) => H.handlePeek(hdr(okHeaders(over.headers)), { code: CODE, ...over.form }, w.deps);
const GENERIC = /This link is no longer available/;

// ── H2: the fragment ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("GET is static: no parameters read, no edge call, nothing consumed, the code is never on the page", () => {
  const w = world(); const o = H.handleGet(w.deps);
  assert.equal(o.status, 200); assert.equal(w.calls.length, 0); assert.doesNotMatch(o.body, new RegExp(CODE)); assert.equal(o.cookies.length, 0);
  assert.equal(H.handleGet.length, 1, "handleGet takes only the dependencies: it cannot see a code");
});

test("the page script reads the FRAGMENT, clears the address bar first, and sends the code only as a POST body", () => {
  const o = H.handleGet(world().deps);
  assert.match(o.body, /location\.hash/); assert.match(o.body, /#c=\(\[A-Za-z0-9_-\]\{43\}\)/);
  assert.ok(o.body.indexOf('history.replaceState(null,"","/app-handoff")') < o.body.indexOf("fetch("), "the address bar is cleaned before anything is sent");
  assert.match(o.body, /method:"POST"/); assert.match(o.body, /body:"step=peek&code="/); assert.match(o.body, /referrerPolicy:"no-referrer"/);
  assert.doesNotMatch(o.body, /location\.search|searchParams|\?code=/);
  assert.match(o.body, /<script nonce="NONCE">/); assert.doesNotMatch(o.body, /\son[a-z]+=|javascript:/i);
});

test("the script's fragment pattern matches a real hand-off fragment and nothing sloppy", () => {
  const re = /^#c=([A-Za-z0-9_-]{43})$/;
  assert.ok(re.test(`#c=${CODE}`)); for (const b of ["", "#", "#c=", `#c=${CODE}x`, `#c=${CODE.slice(1)}`, `#x=${CODE}`, `#c=${CODE}&n=1`, `?c=${CODE}`]) assert.ok(!re.test(b), b);
});

test("every response: no-store, no-referrer, no framing, no indexing, strict CSP that allows only same-origin requests", async () => {
  const w = world();
  for (const o of [H.handleGet(w.deps), await peek(w), await post(w), await post(w)]) {
    assert.match(o.headers["Cache-Control"], /no-store/); assert.equal(o.headers["Referrer-Policy"], "no-referrer"); assert.equal(o.headers["X-Content-Type-Options"], "nosniff");
    if (o.status !== 303 && o.headers["Content-Type"].startsWith("text/html")) { assert.equal(o.headers["X-Frame-Options"], "DENY"); assert.match(o.headers["Content-Security-Policy"], /default-src 'none'.*connect-src 'self'.*form-action 'self'.*frame-ancestors 'none'/); assert.doesNotMatch(o.headers["Content-Security-Policy"], /unsafe-eval|script-src[^;]*unsafe-inline/); }
  }
});

// ── peek (the confirmation) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("peek consumes nothing, however often it is called, and a real person can still redeem afterwards", async () => {
  const w = world(); for (let i = 0; i < 5; i++) assert.equal((await peek(w)).status, 200);
  assert.ok(w.calls.every((c) => c.action === "peek")); assert.equal(w.used.size, 0);
  assert.equal((await post(w)).status, 303);
});

test("H1: the confirmation shows the FULL address prominently, 'Not you? Close this page' FIRST, and asks for the check number", async () => {
  const o = await peek(world()); const j = JSON.parse(o.body); assert.equal(j.valid, true);
  assert.match(j.html, new RegExp(EMAIL.replace(".", "\\."))); assert.doesNotMatch(j.html, /\*\*\*/, "not masked");
  assert.ok(j.html.startsWith('<a class="sec" id="notyou" href="about:blank">Not you? Close this page</a>'), "the safe action comes first");
  assert.match(j.html, /name="number"[^>]*inputmode="numeric"[^>]*maxlength="4"/); assert.match(j.html, /check number shown in the app/);
  assert.match(j.html, /<form method="post" action="\/app-handoff">/); assert.doesNotMatch(j.html, /\.submit\(|<script/);
  assert.equal(j.html.split(CODE).length - 1, 1, "the code appears once: the hidden field of a POST form");
});

test("peek sets a one-time CSRF cookie: HttpOnly, SameSite=Strict, Secure, scoped, short-lived", async () => {
  const o = await peek(world()); const c = o.cookies[0];
  assert.deepEqual([c.name, c.value, c.options.httpOnly, c.options.sameSite, c.options.secure, c.options.path, c.options.maxAge], [H.CSRF_COOKIE, "CSRFTOKEN", true, "strict", true, "/app-handoff", 300]);
});

test("H1: a browser signed in as a DIFFERENT user is refused with a plain message, no form, no code, no switch", async () => {
  const w = world({ current: { id: "99999999-9999-4999-8999-999999999999", email: "victim@example.org" } });
  const j = JSON.parse((await peek(w)).body); assert.equal(j.valid, true);
  assert.match(j.html, /Sign out first/); assert.match(j.html, /victim@example\.org/); assert.doesNotMatch(j.html, /<form|name="number"|csrf/);
  const o = await post(w); assert.equal(o.status, 200); assert.match(o.body, /Sign out first/); assert.equal(w.exchanged.length, 0); assert.equal(w.used.size, 0, "the code is not even redeemed");
  assert.equal(w.calls.filter((c) => c.action === "redeem").length, 0);
});

test("the SAME signed-in user is allowed straight through", async () => {
  const w = world({ current: { id: USER, email: EMAIL } }); assert.equal(JSON.parse((await peek(w)).body).html.includes("<form"), true); assert.equal((await post(w)).status, 303);
});

// ── H1: the number ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("the right number redeems once, exchanges server-side, completes AFTER the session exists, and 303s with nothing secret in it", async () => {
  const w = world(); const o = await post(w);
  assert.equal(o.status, 303); assert.equal(o.headers.Location, `${ORIGIN}/organise/zz-org/editions/summer-fest`);
  assert.deepEqual(w.exchanged, ["one-time-token"]); assert.doesNotMatch(JSON.stringify(o), new RegExp(`${CODE}|one-time-token|${NUMBER}`));
  assert.deepEqual(w.completed, [{ ok: true, reason: undefined }]);
  const seq = w.calls.map((c) => c.action); assert.deepEqual(seq, ["peek", "redeem", "complete"]);
});

test("a WRONG number is refused, the code survives, the page says how many tries are left, and the right number then works", async () => {
  const w = world(); const o = await post(w, { form: { number: "0000" } });
  assert.equal(o.status, 200); assert.match(o.body, /That number does not match\. 2 tries left\./); assert.equal(w.exchanged.length, 0); assert.match(o.body, /name="number"/);
  assert.match(o.body, new RegExp(EMAIL.replace(".", "\\."))); assert.equal(o.cookies[0].value, "CSRFTOKEN", "a fresh CSRF token for the retry");
  assert.equal((await post(w)).status, 303);
});

test("THREE wrong numbers burn the code: the third says so, and the right number afterwards gets the generic page and no session", async () => {
  const w = world();
  assert.match((await post(w, { form: { number: "1111" } })).body, /2 tries left/); assert.match((await post(w, { form: { number: "2222" } })).body, /1 try left/);
  const third = await post(w, { form: { number: "3333" } }); assert.equal(third.status, 400); assert.match(third.body, /cancelled/); assert.doesNotMatch(third.body, /name="number"/);
  const after = await post(w); assert.equal(after.status, 400); assert.match(after.body, GENERIC); assert.equal(w.exchanged.length, 0);
  assert.equal((await peek(w)).body, JSON.stringify({ valid: false }), "a burned code is also dead for the confirmation");
});

test("malformed numbers never reach the edge function or count as a try", async () => {
  const w = world();
  for (const n of [undefined, null, "", "123", "12345", "12a4", " 123", "１２３４", ["4821"]]) { const o = await post(w, { form: { number: n } }); assert.equal(o.status, 200); assert.match(o.body, /Enter the 4 digits/); }
  assert.equal(w.calls.filter((c) => c.action === "redeem").length, 0); assert.equal(w.fails, 0);
});

test("REPLAY / EXPIRED / unknown: the same generic page each time, and no session", async () => {
  const w = world(); assert.equal((await post(w)).status, 303);
  const again = await post(w); assert.equal(again.status, 400); assert.match(again.body, GENERIC); assert.equal(w.exchanged.length, 1);
  const bodies = new Set();
  bodies.add((await post(world({ expired: true }))).body); bodies.add((await post(world(), { form: { code: "B".repeat(43) } })).body); bodies.add((await post(world(), { form: { code: "short" } })).body);
  assert.equal(bodies.size, 1); assert.match([...bodies][0], GENERIC);
});

test("WRONG USER: a session minted for somebody else is never kept, and only THIS browser is signed out (local scope)", async () => {
  const w = world({ exchangeUser: "99999999-9999-4999-8999-999999999999" }); const o = await post(w);
  assert.equal(o.status, 400); assert.equal(w.signedOut, 1); assert.deepEqual(w.completed, [{ ok: false, reason: "exchange_failed" }]);
  const w2 = world({ exchangeUser: null }); assert.equal((await post(w2)).status, 400); assert.equal(w2.signedOut, 0); assert.equal(w2.completed[0].ok, false);
});

test("M2: the real signOut is local scope", () => { assert.match(read("lib/app-handoff.server.ts"), /signOut\(\{ scope: "local" \}\)/); assert.doesNotMatch(read("lib/app-handoff.server.ts"), /signOut\(\)/); });

test("LOGIN CSRF: a post without the page's own cookie, with the wrong one, or from elsewhere is refused before the code is touched", async () => {
  for (const h of [{ cookie: "" }, { cookie: `${H.CSRF_COOKIE}=WRONG` }, { origin: "https://evil.example" }, { origin: undefined }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }]) {
    const w = world(); const o = await post(w, { headers: h }); assert.equal(o.status, 403, JSON.stringify(h)); assert.equal(w.calls.length, 0, "the code was not even presented");
    if (!("cookie" in h)) { w.calls.length = 0; const p = await peek(w, { headers: h }); assert.equal(JSON.parse(p.body).valid, false, "peek refuses a foreign origin too"); assert.equal(w.calls.length, 0); }
  }
  const w = world(); assert.equal((await post(w, { form: { csrf: "" } })).status, 403); assert.equal((await post(w, { form: { csrf: undefined } })).status, 403); assert.equal(w.calls.length, 0);
});

test("LOW: Origin 'null' is refused with a clear message", async () => {
  const w = world(); const o = await post(w, { headers: { origin: "null" } }); assert.equal(o.status, 403); assert.match(o.body, /opened in a way we cannot check/); assert.equal(w.calls.length, 0);
  assert.equal(H.originCheck(hdr({ origin: "null" }), ORIGIN), "null");
});

test("malformed codes never reach the edge function", async () => {
  const w = world();
  for (const c of [undefined, null, 5, "", "short", "A".repeat(44), "A".repeat(42) + "=", "A".repeat(42) + " ", `${CODE}\n`, ["x"]]) { await post(w, { form: { code: c } }); await peek(w, { form: { code: c } }); }
  assert.equal(w.calls.length, 0);
});

test("DESTINATION: only the closed set of organiser paths is ever redirected to", async () => {
  for (const p of ["/organise/zz-org", "/organise/zz-org/editions", "/organise/zz-org/team", "/organise/zz-org/profile", "/organise/zz-org/editions/summer-fest"]) assert.equal((await post(world({ path: p }))).status, 303, p);
  const bad = ["/organise/zz-org/packages", "/organise/zz-org/promote", "/organise/zz-org/payments", "/organise/zz-org/members", "/organise/zz-org/editions/x/package", "/organise/zz-org/editions/x/promote", "/organise/zz-org/editions/x/participation", "https://evil.example/organise/a", "//evil.example", "/\tevil.example", "/\\evil.example", "/account", "/organise/a/../../account", "/organise/a?next=/packages", "/organise/a#frag", "/organise/", "", null, 5];
  for (const p of bad) { const w = world({ path: p }); const o = await post(w); assert.equal(o.status, 400, String(p)); assert.equal(w.exchanged.length, 0); }
});

// ── M1 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("M1: the address comes only from the platform-verified header; spoofable headers and a missing header give null, never a shared bucket", () => {
  assert.equal(H.clientIp(hdr({ "x-vercel-forwarded-for": "203.0.113.9" })), "203.0.113.9"); assert.equal(H.clientIp(hdr({ "x-vercel-forwarded-for": "2001:db8::1, 10.0.0.1" })), "2001:db8::1");
  assert.equal(H.clientIp(hdr({ "x-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2" })), null); assert.equal(H.clientIp(hdr()), null);
  assert.equal(H.clientIp(hdr({ "x-vercel-forwarded-for": "not an ip<script>" })), null); assert.notEqual(H.clientIp(hdr()), "unknown");
});

test("the address is passed to the edge function only when verified, and as null otherwise", async () => {
  const w = world(); await peek(w, { headers: { "x-vercel-forwarded-for": undefined } }); await post(w, { headers: { "x-vercel-forwarded-for": undefined } });
  assert.ok(w.calls.filter((c) => c.action !== "complete").every((c) => c.ip === null));
  const w2 = world(); await peek(w2); assert.equal(w2.calls[0].ip, "203.0.113.9");
});

// ── edge client and helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("the edge client: secret and code travel in headers and body, never a URL; any problem is a refusal", async () => {
  let seen;
  const mk = (resp, over = {}) => async (url, init) => { seen = { url, init }; return resp instanceof Error ? Promise.reject(resp) : { ok: over.ok ?? true, json: async () => resp }; };
  const cfg = (f) => ({ url: "https://proj.supabase.co/", anonKey: "anon", secret: "s".repeat(40), fetch: f });
  const r = await H.callEdge(cfg(mk({ ok: true, token_hash: "t", path: "/organise/a", user_id: USER })), { action: "redeem", code: CODE, number: NUMBER, ip: null });
  assert.equal(r.ok, true); assert.equal(seen.url, "https://proj.supabase.co/functions/v1/editions-web-handoff"); assert.doesNotMatch(seen.url, new RegExp(CODE));
  assert.equal(seen.init.headers["x-handoff-secret"], "s".repeat(40)); assert.equal(seen.init.cache, "no-store"); assert.equal(seen.init.redirect, "error"); assert.match(seen.init.body, new RegExp(CODE));
  assert.deepEqual(await H.callEdge(cfg(mk({ ok: true, token_hash: "t", path: "/organise/a/packages", user_id: USER })), { action: "redeem", code: CODE, number: NUMBER, ip: null }), { ok: false });
  assert.deepEqual(await H.callEdge(cfg(mk({ ok: false, reason: "bad_number", left: 2 })), { action: "redeem", code: CODE, number: "0000", ip: null }), { ok: false, reason: "bad_number", left: 2 });
  assert.deepEqual(await H.callEdge(cfg(mk({ valid: true, user_id: USER, email: "a@b.co" })), { action: "peek", code: CODE, ip: null }), { valid: true, user_id: USER, email: "a@b.co" });
  assert.deepEqual(await H.callEdge(cfg(mk({}, { ok: false })), { action: "peek", code: CODE, ip: null }), { valid: false });
  assert.deepEqual(await H.callEdge(cfg(mk(new Error("boom"))), { action: "redeem", code: CODE, number: NUMBER, ip: null }), { ok: false });
  assert.deepEqual(await H.callEdge({ ...cfg(mk({ valid: true })), secret: "" }, { action: "peek", code: CODE, ip: null }), { valid: false });
});

test("helpers: cookieValue, escapeHtml, and hostile values cannot inject markup", async () => {
  assert.equal(H.cookieValue("a=1; app_handoff_csrf=xyz; b=2", H.CSRF_COOKIE), "xyz"); assert.equal(H.cookieValue("xapp_handoff_csrf=1", H.CSRF_COOKIE), "");
  assert.equal(H.escapeHtml(`<img src=x onerror="a">'&`), "&lt;img src=x onerror=&quot;a&quot;&gt;&#39;&amp;");
  const w = world(); w.deps.edge = async (c) => c.action === "peek" ? { valid: true, user_id: USER, email: '"><script>alert(1)</script>@x.co' } : { ok: false };
  assert.doesNotMatch(JSON.parse((await peek(w)).body).html, /<script>alert/);
});

test("source guards: no service key on the website, no logging, no query parameters read, no redirect helpers, no code in any URL string", () => {
  const files = ["app/app-handoff/route.ts", "lib/app-handoff.ts", "lib/app-handoff.server.ts"].map(read).join("\n");
  assert.doesNotMatch(files, /SERVICE_ROLE|service_role|generateLink|admin\.auth/); assert.doesNotMatch(files, /console\.(log|info|warn|error)/);
  assert.doesNotMatch(files, /searchParams|request\.url\)\.search|\?code=|[?&]c=|x-forwarded-for|x-real-ip/, "the code is never read from or written to a query string; no spoofable address header");
  assert.doesNotMatch(files, /safeNext|redirect\(|NextResponse\.redirect/);
  assert.match(read("lib/app-handoff.server.ts"), /type: "magiclink", token_hash/);
  const route = read("app/app-handoff/route.ts"); for (const m of ["GET", "POST", "HEAD"]) assert.match(route, new RegExp(`export async function ${m}`));
  assert.doesNotMatch(route.replace(/\/\*\*[\s\S]*?\*\//, ""), /request\.url\)\.searchParams/);
  assert.ok(!existsSync(join(ROOT, "app/app-handoff/page.tsx")), "a page and a route at one path would conflict");
});

test("the allowlist regex agrees with the backend's", () => {
  const be = join(ROOT, "..", "oneshetland-be-editions-11-release/supabase/functions/_shared/editions-web-handoff-core.ts");
  if (!existsSync(be)) return;
  const m = readFileSync(be, "utf8").match(/ALLOWED_PATH = (\/.*\/);/); assert.ok(m); assert.equal(m[1], String(H.ALLOWED_PATH));
});
