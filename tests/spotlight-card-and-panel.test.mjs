/**
 * Business Spotlight, web side: the generated business card, and the read-only admin panel showing the composer's rotation snapshot.
 * Run: node --test tests/spotlight-card-and-panel.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSpotlightReport, LANE_LABEL } from "../lib/spotlight-report.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const good = { at: "2026-11-09T05:40:00.000Z", streak: 1, counts: { pool: 5, eligible: 3, welcome: 2, new: 1, rotation: 0, excluded: 2 },
  order: [{ id: "a", name: "Alpha", lane: "welcome", claimedAt: "2026-11-06", lastPostedAt: null, sensitive: false }, { id: "b", name: "Beta Counselling", lane: "new", claimedAt: "2026-09-01", lastPostedAt: null, sensitive: true }],
  excluded: [{ id: "c", name: "Gamma", reason: "featured 2026-10-01", until: "2026-12-30" }], recent: [{ id: "a", name: "Alpha", status: "posted", when: "2026-11-06T13:00:00Z" }] };

test("the snapshot is parsed defensively: good data round-trips; bad, huge or hostile data becomes null or safe values", () => {
  const r = parseSpotlightReport(JSON.stringify(good)); assert.equal(r.order.length, 2); assert.equal(r.order[1].sensitive, true); assert.equal(r.counts.pool, 5); assert.equal(r.excluded[0].until, "2026-12-30");
  for (const bad of [null, undefined, "", "not json", "[1,2]", "5", 7, {}]) assert.equal(parseSpotlightReport(bad), null, String(bad));
  assert.equal(parseSpotlightReport("x".repeat(500_000)), null);
  const hostile = parseSpotlightReport(JSON.stringify({ at: 5, order: [{ name: "<script>alert(1)</script>", lane: "evil", sensitive: "yes" }], counts: { pool: "9" }, excluded: "nope", recent: null }));
  assert.equal(hostile.order[0].lane, "new"); assert.equal(hostile.order[0].sensitive, false); assert.equal(hostile.counts.pool, 0); assert.deepEqual(hostile.excluded, []);
  assert.equal(parseSpotlightReport(JSON.stringify({ order: Array.from({ length: 500 }, () => ({ id: "x", name: "n" })) })).order.length, 60, "bounded");
});
test("the three lanes have plain-English labels", () => { assert.deepEqual(Object.keys(LANE_LABEL).sort(), ["new", "rotation", "welcome"]); });

test("the admin panel is read-only, escapes nothing by hand (React text), and shows next up, exclusions with reasons, and recent picks", () => {
  const p = read("components/admin/SpotlightPanel.tsx");
  for (const t of ["Business Spotlight rotation", "Next up", "Not eligible, and why", "Recent picks", "Needs your approval", "No selection has been recorded yet"]) assert.ok(p.includes(t), t);
  assert.doesNotMatch(p, /dangerouslySetInnerHTML|onClick|\.from\(|rpc\(|fetch\(|"use client"/, "a server-rendered, read-only view");
});
test("the page reads it through the admin-only server function and cannot be loaded by anyone else", () => {
  const s = read("lib/social-admin.server.ts"); assert.match(s, /export async function getSpotlightReport\(\)[\s\S]*?await requireAdmin\(\)/);
  assert.match(s, /social\.spotlight_pool/);
  const page = read("app/admin/social/page.tsx"); assert.match(page, /getSpotlightReport\(\)\.catch\(\(\) => null\)/, "a failed read never hides the Social Studio"); assert.match(page, /<SpotlightPanel report=\{spotlight\} \/>/);
});

test("the generated business card: reads only the public business view, sends every picture through the safe loader, and falls back to the branded design with no photo", () => {
  const r = read("app/api/social-image/route.tsx"); const i = r.indexOf('if (kind === "business")'); const j = r.indexOf('if (kind === "product")');
  assert.ok(i > 0 && j > i, "a business branch exists before the product one");
  const b = r.slice(i, j);
  assert.match(b, /\.from\("local_businesses_public"\)/); assert.doesNotMatch(b, /local_businesses"\)|service|SERVICE/);
  const calls = [...b.matchAll(/coverAsJpegDataUri\(([^;]*?)\)( \?\? null)?;/g)].map((m) => m[1]); assert.equal(calls.length, 2);
  for (const c of calls) assert.match(c, /imagePolicy\(\)/);
  assert.doesNotMatch(b, /\bfetch\s*\(/); assert.match(b, /return new Response\("business not found", \{ status: 404 \}\)/);
  assert.match(b, /LOCAL BUSINESS SPOTLIGHT/); assert.match(b, /ringUrl/);
});
