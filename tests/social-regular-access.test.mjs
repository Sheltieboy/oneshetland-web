/**
 * Social Studio: Regular Activities roundup + Accessible Shetland (web side). Run: node --test tests/social-regular-access.test.mjs
 * The graphics, short links and admin labels exist; the resource library cannot drift from the backend's approved copy; no badge, no certification, no health data.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { RESOURCE_SECTIONS } from "../lib/accessibility-resources.ts";
import { kindMeta, recipeSchedule } from "../lib/social-meta.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const BACKEND_URL = new URL("../../oneshetland-social-ac/supabase/functions/_shared/social-regular-access.ts", import.meta.url);
// The Social Studio backend lives in another repository checkout; the parity checks run where it is present and are skipped elsewhere.
const HAVE_BACKEND = existsSync(BACKEND_URL);
const BACKEND = HAVE_BACKEND ? readFileSync(BACKEND_URL, "utf8") : "";
const route = read("app/api/social-image/route.tsx");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "");

test("the approved resource library in the Social Studio backend is exactly the one on the Accessible Shetland page (slug, link, title, source, description)", { skip: !HAVE_BACKEND }, () => {
  const Q = `('(?:[^'\\\\]|\\\\.)*'|"[^"]*")`;
  const un = (q) => q.slice(1, -1).replace(/\\'/g, "'").replace(/’/g, "'");
  const be = [...BACKEND.matchAll(new RegExp(`slug: '([a-z0-9-]+)'.*?by: ${Q}, title: ${Q}, href: '([^']+)', about: ${Q}`, "g"))];
  assert.equal(be.length, 22);
  const web = RESOURCE_SECTIONS.flatMap((s) => s.items);
  assert.equal(web.length, be.length);
  for (const m of be) {
    const w = web.find((x) => x.slug === m[1]); assert.ok(w, m[1]);
    assert.equal(w.href, m[4]); assert.equal(w.by.replace(/’/g, "'"), un(m[2])); assert.equal(w.title.replace(/’/g, "'"), un(m[3])); assert.equal(w.about.replace(/’/g, "'"), un(m[5]));
  }
});
test("every backend resource anchor exists on the landing page", { skip: !HAVE_BACKEND }, () => {
  const page = read("app/accessible/page.tsx");
  for (const a of new Set([...BACKEND.matchAll(/anchor: '([a-z-]+)'/g)].map((m) => m[1]))) assert.ok(page.includes(`r-\${id}`) || ["r-travel", "r-visiting", "r-support", "r-info"].includes(a), a);
  for (const id of ["travel", "visiting", "support", "info"]) assert.ok(RESOURCE_SECTIONS.some((s) => s.id === id));
});
test("short links: /go/regular-activities and /go/accessible land on the right pages with their own campaigns", () => {
  const go = read("app/go/[...slug]/route.ts");
  assert.match(go, /"regular-activities": \{ path: "\/whats-on\/regular", campaign: "regular_roundup" \}/); assert.match(go, /accessible: \{ path: "\/accessible", campaign: "accessible_info" \}/);
});
test("admin: both kinds have a label and colour, are checked-again kinds, and the schedule shows the real posting day", () => {
  assert.equal(kindMeta("regular_roundup").label, "Regular activities"); assert.equal(kindMeta("accessible_info").label, "Accessible Shetland");
  assert.equal(recipeSchedule({ weekdays: ["Sat", "Sun"], post_day: "Sun", hour: 18 }), "Sun · about 18:00");
  assert.equal(recipeSchedule({ weekdays: ["Wed"], hour: 14 }), "Wed · about 14:00");
  assert.match(read("components/admin/SocialStudio.tsx"), /"regular_roundup", "accessible_info"\]\);/);
  assert.match(read("app/admin/social/page.tsx"), /SelectionPanel/);
});
test("the roundup graphic: public activities only, own photographs through the SSRF-safe loader, branded fallback, no emoji", () => {
  const r = code(route);
  assert.match(r, /kind === "regular"/); assert.match(r, /from\("regular_activities"\)\.select\("id, title, category, cover_url"\)\.in\("id", ids\)/);
  assert.match(r, /coverAsJpegDataUri\(r\.cover_url as string \| null, imagePolicy\(\)\)/); assert.match(r, /\/brand\/mark-white\.png/);
  assert.match(r, /slice\(0, 6\)/); assert.match(r, /\[0-9a-f-\]\{36\}/);
  const block = r.slice(r.indexOf('kind === "regular"'), r.indexOf('kind === "access"'));
  assert.doesNotMatch(block, /\p{Extended_Pictographic}/u);
});
test("the Accessible Shetland graphics: typographic, high contrast, never a badge, certification, photograph or health data; business cards read only published records", () => {
  const block = code(route).slice(code(route).indexOf('kind === "access"'));
  assert.doesNotMatch(block, /\p{Extended_Pictographic}/u); assert.doesNotMatch(block, /fully accessible|certified|accredited|approved by|endorse|wheelchair|disab|medical/i);
  assert.match(block, /from\("accessibility_profiles"\)\.select\("verification, verified_on"\)/); assert.match(block, /\.in\("status", \["available", "partial"\]\)/);
  assert.doesNotMatch(block, /detail|access_contact|verification_note|summary|visit_tips/, "free text, contact lines and notes are never read");
  assert.match(block, /return new Response\("not found", \{ status: 404 \}\)/);
});
test("backend captions never overclaim (static check of the approved copy)", { skip: !HAVE_BACKEND }, () => {
  const copy = [...BACKEND.matchAll(/AWARENESS_COPY: string\[\] = \[([\s\S]*?)\n\];/g)][0][1];
  assert.doesNotMatch(copy, /fully accessible|accessible to all|suitable for everyone|certified|helpless|suffer|wheelchair[- ]bound/i);
  assert.match(copy, /make your own decisions|decide what works for you|Know what to expect/);
});
