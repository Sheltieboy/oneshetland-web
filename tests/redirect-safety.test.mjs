/**
 * Post-sign-in redirect safety: a `?next=` value may only ever resolve to a path on OneShetland itself.
 * Run: node --test tests/redirect-safety.test.mjs
 *
 * The original bug: safeNext() refused "//host" and "/\host" but not "/<TAB>/host". A browser deletes tabs, CRs and LFs
 * before parsing, so that value is "//host": a link to another site, followed by client-side router.replace(next) right
 * after the person signed in on OneShetland. Everything here uses evil.example (a reserved name that never resolves) and
 * resolves URLs in memory; nothing is requested.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { safeNext, isLocalPath, manageReturnPath, manageSignInUrl } from "../lib/redirect.ts";
import { isSafeUrl } from "../lib/launch-partners/validate.ts";

const ORIGIN = "https://oneshetland.com";
const FALLBACK = "/account";
const ROOT = new URL("..", import.meta.url).pathname;

// ── where could a value end up? Each sink models a real consumer of `next`. ─────────────────────────────────────────
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const originOf = (s) => { try { return new URL(s, ORIGIN).origin; } catch { return "(unparseable)"; } };
/** Returns the names of the sinks through which `out` would leave the site. */
function leaks(out) {
  const found = [];
  if (originOf(out) !== ORIGIN) found.push("router.replace(next)");                                   // client navigation (sign-in, sign-up)
  if (originOf(ORIGIN + out) !== ORIGIN) found.push("redirect(`${origin}${next}`)");                    // /auth/callback
  if (originOf(dec(out)) !== ORIGIN) found.push("consumer that decodes once (mobile sanitizeNext)");
  if (originOf(dec(dec(out))) !== ORIGIN) found.push("consumer that decodes twice");
  try { const u = new URL(out, ORIGIN); if (originOf(u.pathname + u.search + u.hash) !== ORIGIN) found.push("re-emitting the normalised path"); } catch { /* unparseable */ }
  return found;
}
const exploitable = (fn, inputs) => inputs.filter((x) => { const out = fn(x); return out === x && leaks(out).length > 0; });

// ── the original validator, verbatim, so the bug is reproduced by the same detector that guards the fix ──────────────
function originalSafeNext(next) {
  const fallback = "/account";
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(next)) return fallback;
  return next;
}

const HOSTILE = [
  "https://evil.example", "http://evil.example", "//evil.example", "///evil.example", "////evil.example",
  "/\\evil.example", "/\\\\evil.example", "\\\\evil.example", "\\/evil.example",
  "/\t/evil.example", "/\r/evil.example", "/\n/evil.example", "/\r\n/evil.example", "/\t\t/evil.example",
  "/\t\\evil.example", "/\\\t/evil.example", "/\n\\evil.example", "/ \t/evil.example",
  "/%09/evil.example", "/%0d/evil.example", "/%0D/evil.example", "/%0a/evil.example", "/%0A/evil.example", "/%0d%0a/evil.example",
  "/%5cevil.example", "/%5Cevil.example", "/%2f/evil.example", "/%2F%2Fevil.example", "/%2f%2fevil.example",
  "/%2509/evil.example", "/%250d/evil.example", "/%250a/evil.example", "/%255cevil.example", "/%252f/evil.example", "/%25252f/evil.example",
  "/%252509/evil.example", "/%25255cevil.example",
  "%2f%2fevil.example", "%2F%2Fevil.example", "%5Cevil.example", "%09//evil.example",
  "@evil.example", "evil.example", "user@evil.example", "https:evil.example", "https:/evil.example",
  " //evil.example", "\t//evil.example", "\n//evil.example", "\r//evil.example", " //evil.example", "　//evil.example", "﻿//evil.example",
  "/ /evil.example", "/ /evil.example", "/ /evil.example", "/​/evil.example", "/‎/evil.example", "/‮/evil.example",
  "/　/evil.example", "/ /evil.example", "/ /evil.example", "/﻿/evil.example", "/\u0085/evil.example", "/­/evil.example",
  "/\u0000/evil.example", "/\u000b/evil.example", "/\u000c/evil.example", "/\u007f/evil.example",
  "/.//evil.example", "/..//evil.example", "/a/..//evil.example", "/./\t/evil.example",
  "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", "file:///etc/passwd", "ftp://evil.example",
];

// ═══════════════════════════ 0. the bug, reproduced ═══════════════════════════
test("the ORIGINAL validator let tab/CR/LF forms through, and they leave the site (this is the reported finding)", () => {
  const bad = exploitable(originalSafeNext, HOSTILE);
  for (const must of ["/\t/evil.example", "/\r/evil.example", "/\n/evil.example", "/\t\t/evil.example", "/\t\\evil.example"])
    assert.ok(bad.includes(must), `original validator should have accepted ${JSON.stringify(must)}`);
  assert.ok(leaks("/\t/evil.example").includes("router.replace(next)"), "a browser resolves it to another site");
});

// ═══════════════════════════ 1. what must still work ═══════════════════════════
test("legitimate local paths are returned unchanged: plain, query, fragment, unicode, encoded, spaces", () => {
  for (const ok of [
    "/account", "/", "/directory/test", "/directory/some-slug-123", "/events/abc", "/whats-on/00000000-0000-4000-8000-000000000001/check-in",
    "/business/abc/manage/leads", "/launch/some-biz/claim", "/directory/abc/claim", "/fetch/apply", "/hubs/new", "/jobs?tab=shifts",
    "/search?q=lerwick&page=2", "/directory/test?a=1&b=2", "/directory/test#reviews", "/directory/test?a=1#reviews",
    "/directory/café", "/s?q=hello world", "/s?q=a%20b", "/s?q=100%25", "/g/ABC123", "/@someone", "/x?u=https://ok.example/a",
    "/path/with/%7Eencoded", "/a-b_c.d~e", "/launch/x?next=%2Faccount",
  ]) {
    assert.equal(safeNext(ok), ok, ok);
    assert.equal(isLocalPath(ok), true, ok);
    assert.deepEqual(leaks(ok), [], ok);
  }
});

test("a value with a query string and a fragment keeps both", () => {
  assert.equal(safeNext("/directory/test?a=1&b=two#frag"), "/directory/test?a=1&b=two#frag");
});

// ═══════════════════════════ 2. what must be refused ═══════════════════════════
test("every hostile form falls back to /account and nothing leaks", () => {
  for (const h of HOSTILE) {
    const out = safeNext(h);
    assert.equal(out, FALLBACK, `${JSON.stringify(h)} -> ${JSON.stringify(out)}`);
    assert.equal(isLocalPath(h), false, JSON.stringify(h));
    assert.deepEqual(leaks(out), []);
  }
});

test("explicit cases from the report: absolute, protocol-relative, triple slash, backslash, TAB, CR, LF", () => {
  const eq = (v) => assert.equal(safeNext(v), FALLBACK, JSON.stringify(v));
  eq("https://evil.example"); eq("//evil.example"); eq("///evil.example"); eq("/\\evil.example"); eq("/\\\\evil.example");
  eq("/\t/evil.example"); eq("/\r/evil.example"); eq("/\n/evil.example");
});

test("percent-encoded tab, CR, LF, backslash and slash are refused, at every layer of encoding", () => {
  for (const enc of ["%09", "%0d", "%0a", "%5c", "%2f"]) {
    let layered = enc;
    for (let layer = 1; layer <= 5; layer++) {
      const v = `/${layered}${enc === "%2f" ? "" : "/"}evil.example`;
      assert.equal(safeNext(v), FALLBACK, `layer ${layer}: ${v}`);
      layered = layered.replace(/%/g, "%25");
    }
  }
});

test("every control character, anywhere in the value, is refused", () => {
  for (let c = 0; c <= 0x1f; c++) for (const where of [(s) => `/${s}/x`, (s) => `/x${s}y`, (s) => `/x?q=${s}`, (s) => `/x#${s}`])
    assert.equal(safeNext(where(String.fromCharCode(c))), FALLBACK, `U+${c.toString(16).padStart(4, "0")}`);
  for (let c = 0x7f; c <= 0x9f; c++) assert.equal(safeNext(`/x${String.fromCharCode(c)}y`), FALLBACK, `U+${c.toString(16)}`);
});

test("Unicode whitespace, separators and invisible/bidi characters are refused; a plain space is not", () => {
  for (const c of [" ", " ", " ", " ", " ", " ", " ", " ", " ", "　", "​", "‌", "‍", "‎", "‏", "‪", "‮", "⁠", "⁦", "⁩", "﻿", "­"])
    assert.equal(safeNext(`/x${c}y`), FALLBACK, `U+${c.codePointAt(0).toString(16)}`);
  assert.equal(safeNext("/x y"), "/x y");
});

test("dot-segments that collapse to a protocol-relative path are refused", () => {
  for (const v of ["/.//evil.example", "/..//evil.example", "/a/..//evil.example", "/a/./.././/evil.example"]) assert.equal(safeNext(v), FALLBACK, v);
});

test("malformed, non-string and oversize input falls back and never throws", () => {
  for (const v of [null, undefined, "", 42, 0, true, false, {}, [], ["/account"], () => "/account", Symbol.iterator.description, "/%", "/%zz", "/%E0%A4%A", "/\ud800", "/\udc00x", "/".repeat(3000), "/" + "a".repeat(2100)])
    assert.doesNotThrow(() => safeNext(v));
  for (const v of [null, undefined, "", 42, {}, [], "/".repeat(3000), "/" + "a".repeat(2100), "/\ud800", "/\udc00x"]) assert.equal(safeNext(v), FALLBACK);
  assert.equal(safeNext("/" + "a".repeat(2047)), "/" + "a".repeat(2047), "exactly at the limit is fine");
  assert.equal(safeNext("/x?bad=%"), "/x?bad=%", "a stray % is just a path, not an attack");
});

// ═══════════════════════════ 3. property: nothing it accepts can leave the site ═══════════════════════════
test("fuzz: 40,000 hostile-alphabet strings; whatever safeNext returns is the fallback or the input, and never leaves the site", () => {
  let seed = 0x5eed1234;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const alphabet = ["/", "/", "/", "\\", "\t", "\r", "\n", "%", "09", "0d", "0a", "5c", "2f", "25", "2e", ".", "@", ":", "a", "evil.example", " ", " ", "​", " ", "?", "#", "=", "&", "\u0000", "é", "https:", "x"];
  let accepted = 0;
  for (let i = 0; i < 40_000; i++) {
    let s = rnd() < 0.8 ? "/" : "";
    for (let n = Math.floor(rnd() * 14); n > 0; n--) s += alphabet[Math.floor(rnd() * alphabet.length)];
    const out = safeNext(s);
    assert.ok(out === FALLBACK || out === s, `output must be the fallback or the input: ${JSON.stringify(s)} -> ${JSON.stringify(out)}`);
    assert.deepEqual(leaks(out), [], `${JSON.stringify(s)} -> ${JSON.stringify(out)} leaves the site`);
    if (out === s) accepted++;
  }
  assert.ok(accepted > 500, `the fuzz must also exercise the accept path (${accepted})`);
});

// ═══════════════════════════ 4. the real flows ═══════════════════════════
/** Every literal `/sign-in?next=…` the codebase generates, with ${…} placeholders replaced by a typical id. */
function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "tests"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out); else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const FILES = [...sourceFiles(join(ROOT, "app")), ...sourceFiles(join(ROOT, "lib")), ...sourceFiles(join(ROOT, "components"))];
const read = (p) => readFileSync(p, "utf8");

test("normal sign-in: every ?next= the application itself generates is accepted unchanged (so no flow regresses)", () => {
  const seen = [];
  for (const f of FILES) {
    for (const m of read(f).matchAll(/sign-in\?next=(?:encodeURIComponent\()?`?([^"'`\s)]*)/g)) {
      const raw = m[1].replace(/\$\{[^}]*\}/g, "abc123").replace(/`$/, "");
      if (!raw.startsWith("/") && !raw.startsWith("%2F")) continue;                       // a variable (manageSignInUrl) — covered below
      const next = new URLSearchParams(`next=${raw}`).get("next");
      seen.push([relative(ROOT, f), next]);
      assert.equal(safeNext(next), next, `${relative(ROOT, f)} generates ?next=${next}, which would now be refused`);
    }
  }
  assert.ok(seen.length >= 40, `expected to find the app's real sign-in redirects, found ${seen.length}`);
});

test("sign-up and e-mail confirmation: the callback URL carries a validated next, and a hostile one lands on the fallback", () => {
  for (const next of ["/welcome", "/launch/x/claim", "/directory/abc/claim"]) {
    const callback = new URL(`${ORIGIN}/auth/callback?next=${encodeURIComponent(safeNext(next))}&code=x`);
    assert.equal(safeNext(callback.searchParams.get("next")), next);
  }
  for (const h of ["/\t/evil.example", "/%09/evil.example", "//evil.example"]) {
    const callback = new URL(`${ORIGIN}/auth/callback?next=${encodeURIComponent(h)}&code=x`);
    const landed = safeNext(callback.searchParams.get("next"));
    assert.equal(landed, FALLBACK);
    assert.equal(originOf(`${ORIGIN}${landed}`), ORIGIN);
  }
});

test("password reset: the redirect is the site's own origin + a fixed path, with no request-supplied part; no flow reads `next` there", () => {
  const forgot = read(join(ROOT, "app/forgot-password/page.tsx"));
  assert.match(forgot, /redirect_to:\s*`\$\{window\.location\.origin\}\/reset-password`/);
  assert.doesNotMatch(forgot, /searchParams|useSearchParams|get\(["']next["']\)/);
  const reset = read(join(ROOT, "app/reset-password/page.tsx"));
  assert.doesNotMatch(reset, /get\(["'](next|redirect|returnTo|callback)/);
});

test("OAuth: not used. If a provider sign-in is ever added, its return path must go through safeNext (this test will say so)", () => {
  const using = FILES.filter((f) => /signInWithOAuth|signInWithIdToken|linkIdentity/.test(read(f))).map((f) => relative(ROOT, f));
  for (const f of using) assert.match(read(join(ROOT, f)), /safeNext\(/, `${f} starts an OAuth flow without safeNext`);
});

test("claim / Launch Partner / business management: return paths stay local and in their own area", () => {
  assert.equal(safeNext("/launch/some-biz/claim"), "/launch/some-biz/claim");
  assert.equal(safeNext("/directory/abc/claim"), "/directory/abc/claim");
  const root = "/business/biz-1/manage";
  assert.equal(manageReturnPath("biz-1", `${root}/leads?x=1`), `${root}/leads?x=1`);
  assert.equal(manageReturnPath("biz-1", root), root);
  for (const h of ["/\t/evil.example", "//evil.example", "/%09/evil.example", "/business/OTHER/manage/leads", "https://evil.example", `${root}/\t/x`])
    assert.equal(manageReturnPath("biz-1", h), root, JSON.stringify(h));
  const url = manageSignInUrl("biz-1", "/\t/evil.example");
  assert.equal(url, `/sign-in?next=${encodeURIComponent(root)}`);
  assert.equal(safeNext(new URL(url, ORIGIN).searchParams.get("next")), root);
});

test("Launch Partner content links: local paths via the same validator, https still allowed, tab/backslash/script forms refused", () => {
  for (const ok of ["/launch/x", "/directory/y#z", "https://www.example.com/a", "https://shop.example/p?x=1"]) assert.equal(isSafeUrl(ok), true, ok);
  for (const bad of ["//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "/%09/evil.example", "javascript:alert(1)", "http://evil.example", "data:text/html,x", "evil.example"])
    assert.equal(isSafeUrl(bad), false, JSON.stringify(bad));
});

// ═══════════════════════════ 5. nobody bypasses or duplicates the validator ═══════════════════════════
test("static: every file that reads ?next= validates it with safeNext, and passes only the validated value to a navigation", () => {
  const readers = FILES.filter((f) => /\.get\(["']next["']\)/.test(read(f)));
  assert.ok(readers.length >= 4, `found ${readers.length} readers of ?next=`);
  for (const f of readers) {
    const src = read(f);
    assert.match(src, /import\s*\{[^}]*safeNext[^}]*\}\s*from\s*["']@\/lib\/redirect["']/, `${relative(ROOT, f)} reads ?next= without importing safeNext`);
    // the raw value may only appear as the argument of safeNext(...) (or a truthiness test of it)
    for (const m of src.matchAll(/(^|[^\w])(\w+)\s*=\s*[^;\n]*\.get\(["']next["']\)/g)) {
      const name = m[2];
      const rawUses = [...src.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;
      const safeUses = [...src.matchAll(new RegExp(`safeNext\\(\\s*${name}\\s*\\)`, "g"))].length;
      assert.ok(safeUses >= 1 || /safeNext\([^)]*\.get\(["']next["']\)/.test(src), `${relative(ROOT, f)}: raw ?next= (${name}) is never passed to safeNext`);
      void rawUses;
    }
    assert.doesNotMatch(src, /(router\.(push|replace)|redirect|NextResponse\.redirect|location\.(href|assign|replace))\(\s*[^)]*\.get\(["']next["']\)/, `${relative(ROOT, f)} navigates to the raw ?next=`);
  }
});

test("static: /auth/callback validates next before building the redirect, and only ever redirects onto its own origin", () => {
  const src = read(join(ROOT, "app/auth/callback/route.ts"));
  assert.match(src, /const next = safeNext\(searchParams\.get\("next"\)\)/);
  const redirects = [...src.matchAll(/NextResponse\.redirect\(([^;]*)\)/g)].map((m) => m[1]);
  assert.ok(redirects.length >= 4);
  for (const r of redirects) assert.match(r, /^`\$\{origin\}/, `redirect not pinned to the request origin: ${r}`);
});

test("static: there is exactly one safeNext, and no second hand-rolled path check in app/lib/components", () => {
  const defs = FILES.filter((f) => /(function|const)\s+safeNext\b/.test(read(f))).map((f) => relative(ROOT, f));
  assert.deepEqual(defs, ["lib/redirect.ts"]);
  const weak = FILES.filter((f) => f !== join(ROOT, "lib/redirect.ts") && /startsWith\(["']\/\/["']\)\s*\|\||!\w+\.startsWith\(["']\/\/["']\)\s*&&/.test(read(f))).map((f) => relative(ROOT, f));
  assert.deepEqual(weak, [], "a second prefix-style local-path check; use isLocalPath from lib/redirect");
});

// ═══════════════════════════ 6. mutation: each guard is load-bearing ═══════════════════════════
const mutantDir = mkdtempSync(join(tmpdir(), "redirect-mutants-"));
after(() => rmSync(mutantDir, { recursive: true, force: true }));
const source = readFileSync(join(ROOT, "lib/redirect.ts"), "utf8");
const mutate = async (name, ...pairs) => {
  let src = source;
  for (let i = 0; i < pairs.length; i += 2) {
    assert.ok(src.includes(pairs[i]), `mutation target for "${name}" is gone from lib/redirect.ts: ${pairs[i]}`);
    src = src.replace(pairs[i], pairs[i + 1]);
  }
  const file = join(mutantDir, `${name}.ts`);
  writeFileSync(file, src);
  return import(`file://${file}`);
};
const RESOLUTION_CHECK = "if (resolved.origin !== YARDSTICK.origin) return false;";
const CHAR_RULE = ["&& !UNSAFE_CHAR.test(s);", ";"];
const PREFIX_RULE = ['s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\\\")', 's.startsWith("/")'];

test("the real validator leaks nothing from the hostile corpus (control for the mutation tests)", () => {
  assert.deepEqual(exploitable(safeNext, HOSTILE), []);
});

test("mutation: the resolution check alone is NOT enough, and neither is the character rule alone: they are independent layers", async () => {
  // Without the character rule, raw tab/CR/LF are still caught by URL resolution, but every encoded form leaks to a decoding consumer.
  const noChars = await mutate("no-controls", ...CHAR_RULE);
  const a = exploitable(noChars.safeNext, HOSTILE);
  assert.ok(a.includes("/%09/evil.example") && a.includes("/%0a/evil.example") && a.includes("/%2509/evil.example"), `character rule is what stops encoded forms: ${JSON.stringify(a)}`);
  assert.ok(!a.includes("/\t/evil.example"), "raw tab is still caught by the resolution layer");
  // Without the resolution check the character rule alone still holds the corpus.
  const noResolve = await mutate("no-resolution", RESOLUTION_CHECK, "");
  assert.deepEqual(exploitable(noResolve.safeNext, HOSTILE), [], "layers overlap on this corpus: the character rule covers it");
});

test("mutation: dropping the character rule AND the resolution check re-opens the tab, CR and LF redirect", async () => {
  const m = await mutate("no-controls-no-resolution", ...CHAR_RULE, RESOLUTION_CHECK, "");
  const bad = exploitable(m.safeNext, HOSTILE);
  assert.ok(bad.includes("/\t/evil.example") && bad.includes("/\r/evil.example") && bad.includes("/\n/evil.example"), JSON.stringify(bad));
});

test("mutation: dropping the percent-decoding layers re-opens the encoded tab/backslash/slash forms for a decoding consumer", async () => {
  const m = await mutate("no-decode", "try { decoded = decodeURIComponent(level); } catch { break; }", "break;");
  const bad = exploitable(m.safeNext, HOSTILE);
  assert.ok(bad.includes("/%2f/evil.example") && bad.includes("/%5cevil.example") && bad.includes("/%2509/evil.example"), JSON.stringify(bad));
});

test("mutation: dropping the '//' prefix rule alone leaks the encoded '%2f' forms; with the resolution check also gone, '//host' leaks", async () => {
  const alone = await mutate("no-prefix", ...PREFIX_RULE);
  const a = exploitable(alone.safeNext, HOSTILE);
  assert.ok(a.includes("/%2f/evil.example") && a.includes("/%2F%2Fevil.example"), JSON.stringify(a));
  const both = await mutate("no-prefix-no-resolution", ...PREFIX_RULE, RESOLUTION_CHECK, "");
  const b = exploitable(both.safeNext, HOSTILE);
  assert.ok(b.includes("//evil.example") && b.includes("///evil.example"), JSON.stringify(b));
  assert.ok(!b.includes("/\\evil.example"), "the backslash rule is a separate layer and still holds");
});

test("mutation: dropping the dot-segment collapse rule re-opens '/.//host' for a consumer that re-emits the normalised path", async () => {
  const m = await mutate("no-collapse", 'if (resolved.pathname.startsWith("//")) return false;', "");
  const bad = exploitable(m.safeNext, HOSTILE);
  assert.ok(bad.includes("/.//evil.example") && bad.includes("/..//evil.example"), JSON.stringify(bad));
});

test("mutation: dropping the Unicode-space rule lets NBSP-style separators through", async () => {
  const m = await mutate("no-space", "if (UNSAFE_SPACE.test(value)) return false;", "");
  assert.equal(m.safeNext("/ /x"), "/ /x", "the separator is accepted without the rule");
  assert.equal(safeNext("/ /x"), FALLBACK);
});

test("mutation: the original validator, restored, fails the same hostile corpus", () => {
  assert.ok(exploitable(originalSafeNext, HOSTILE).length >= 5);
});
