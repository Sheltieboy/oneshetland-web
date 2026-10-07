/**
 * /api/social-image must route every database-supplied picture URL through lib/social-image-source.ts.
 * Run: node --test tests/social-image-route.test.mjs
 *
 * The route reads URLs from columns an ordinary signed-in user can write (events.cover_url, products.photos), so it
 * must never fetch or decode one itself. This is a source-level guard against someone "simplifying" that back.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/social-image/route.tsx", import.meta.url), "utf8");
const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");   // comments out

test("the route does not fetch anything or decode images itself", () => {
  assert.doesNotMatch(code, /\bfetch\s*\(/, "route.tsx must not call fetch() — use coverAsJpegDataUri");
  assert.doesNotMatch(code, /from\s+["']sharp["']|import\s*\(\s*["']sharp["']\s*\)|require\s*\(\s*["']sharp["']\s*\)/, "route.tsx must not import sharp");
  assert.doesNotMatch(code, /\.arrayBuffer\s*\(/);
});

test("every cover/photo goes through coverAsJpegDataUri with the trusted-origin policy", () => {
  assert.match(code, /import\s*\{[^}]*coverAsJpegDataUri[^}]*\}\s*from\s*["']@\/lib\/social-image-source["']/);
  const calls = [...code.matchAll(/coverAsJpegDataUri\s*\(([^)]*\)?[^)]*)\)/g)].map((m) => m[1]);
  assert.equal(calls.length, 2, "event cover and product photo are the only picture sources on this route");
  for (const c of calls) assert.match(c, /imagePolicy\(\)/, `call is missing the policy: ${c}`);
  assert.match(code, /policyFromSupabaseUrl\(process\.env\.NEXT_PUBLIC_SUPABASE_URL\)/, "the trusted origin is the project's own Supabase URL, never request data");
});

test("no request parameter ever becomes an image URL", () => {
  // the only user-supplied inputs are kind, id, start, days — none is passed to the loader, and none is read as a URL
  assert.doesNotMatch(code, /p\.get\(["'](url|src|cover|image|photo)/i);
  assert.doesNotMatch(code, /searchParams\.get\(["'](url|src|cover|image|photo)/i);
});

test("the route still sends cacheable image headers and no diagnostic headers", () => {
  assert.match(code, /"Cache-Control":\s*"public, s-maxage=86400, max-age=3600"/);
  assert.match(code, /"Netlify-Vary":\s*"query"/);
  assert.doesNotMatch(code, /X-Debug|x-debug|stack|err\.message/);
});
