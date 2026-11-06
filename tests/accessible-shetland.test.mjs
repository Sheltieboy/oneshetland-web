/**
 * Accessible Shetland (web side). Run: node --test tests/accessible-shetland.test.mjs
 * Guards the promises: the vocabulary matches the database's, nothing rates or scores a place, missing is never "not accessible",
 * resource links are https and unique, public pages stay silent when empty, and nothing in the feature collects health data.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ALL_FACILITIES, groupFacts, highlights, hasContent, FILTERS, STATUS_LONG, subjectHref } from "../lib/accessibility.ts";
import { RESOURCE_SECTIONS } from "../lib/accessibility-resources.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const SQL = readFileSync(new URL("../../oneshetland-for-you-pin/supabase/migrations/20261210000000_accessible_shetland.sql", import.meta.url), "utf8");
const FILES = ["lib/accessibility.ts", "lib/accessibility-data.ts", "lib/accessibility-client.ts", "components/accessibility/AccessibilityPanel.tsx", "components/accessibility/AccessibilityEditor.tsx",
  "components/accessibility/SuggestCorrection.tsx", "components/accessibility/AccessibleBrowse.tsx", "app/accessible/page.tsx"];

test("the facility keys are exactly the database's list", () => {
  const m = SQL.match(/accessibility_facility_keys\(\)[\s\S]*?array\[([\s\S]*?)\]/)[1];
  const db = [...m.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(ALL_FACILITIES.map((f) => f.key).sort(), db);
});
test("every filter is a real facility", () => { for (const f of FILTERS) assert.ok(ALL_FACILITIES.some((x) => x.key === f.key), f.key); });
test("no rating, score or blanket 'accessible' label anywhere in the feature, and no health or disability fields", () => {
  for (const f of FILES) {
    const s = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(s, /\bscore\b|\brating\b|stars?\b|fully accessible|wheelchair accessible|is_accessible|fully_accessible/i, f);
    assert.doesNotMatch(s, /diagnos|medical condition|your disability|type of disability/i, f);
  }
});
test("missing information is never worded as 'not accessible'; 'not known' is its own answer", () => {
  assert.equal(STATUS_LONG.not_known, "Not known");
  const raw = read("components/accessibility/AccessibilityPanel.tsx");
  const panel = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(panel, /has not been provided/);
  assert.doesNotMatch(panel, /not accessible|inaccessible/i);
});
test("grouping shows only answered facilities, in order, and an empty profile has no content", () => {
  const g = groupFacts([{ facility: "hearing_loop", status: "partial", detail: "Counter" }, { facility: "ramp", status: "available", detail: null }]);
  assert.deepEqual(g.map((x) => x.group.id), ["getting-in", "communication"]);
  assert.equal(hasContent(null), false);
  assert.equal(hasContent({ facts: [], summary: " ", visit_tips: null }), false);
  assert.equal(hasContent({ facts: [], summary: "Ground floor", visit_tips: null }), true);
  assert.deepEqual(highlights([{ facility: "ramp", status: "partial" }, { facility: "lift", status: "available" }]), ["Lift"], "only Yes answers are highlighted");
});
test("links to public pages", () => {
  assert.equal(subjectHref("business", "i", "s"), "/directory/s"); assert.equal(subjectHref("hub", "i", null), "/hubs/i");
  assert.equal(subjectHref("activity", "i", "walk"), "/whats-on/regular/walk"); assert.equal(subjectHref("event", "e"), "/whats-on/e");
});
test("resource links: https, unique, no secrets, every one has an owner named", () => {
  const all = RESOURCE_SECTIONS.flatMap((s) => s.items); assert.ok(all.length >= 15);
  const seen = new Set();
  for (const r of all) { assert.match(r.href, /^https:\/\/[a-z0-9.-]+\//); assert.ok(!/[?#].*(token|key|utm)/i.test(r.href)); assert.ok(r.by && r.title && r.about); assert.ok(!seen.has(r.href), r.href); seen.add(r.href); }
});
test("the landing page makes no claim of completeness, endorsement or involvement", () => {
  const s = read("app/accessible/page.tsx");
  assert.match(s, /More information will be added as people get involved/);
  assert.match(s, /does not mean they are involved with OneShetland or endorse it/);
  assert.doesNotMatch(s, /comprehensive|fully verified|complete guide|officially|in partnership with|endorsed by/i);
});
test("public pages cannot be taken down by this feature: reads are guarded and the panel is silent when empty", () => {
  const d = read("lib/accessibility-data.ts");
  assert.equal((d.match(/catch/g) ?? []).length >= 5, true);
  assert.match(d, /BROWSE_LIMIT = 120/);
  assert.match(read("components/accessibility/AccessibilityPanel.tsx"), /if \(!hasContent\(profile\)\) return <OwnerInvite/);
});
test("the edit form: nothing compulsory, 'No answer' exists, every control is labelled and touch-sized", () => {
  const s = read("components/accessibility/AccessibilityEditor.tsx");
  assert.match(s, /No answer/); assert.doesNotMatch(s, /\brequired\b/); assert.match(s, /<fieldset/); assert.match(s, /<legend/); assert.match(s, /min-h-11/);
  assert.match(s, /aria-live="polite"/); assert.match(s, /role=\{msg\.ok \? "status" : "alert"\}/);
});
test("no tier gate: the feature never reads a plan", () => {
  for (const f of FILES) assert.doesNotMatch(read(f), /tierUnlocks|meetsPro|subscription|TIER/i, f);
});
test("every new route is wired: sidebar, business dashboard, hub tile, four public pages", () => {
  assert.match(read("components/admin/AdminSidebar.tsx"), /\/admin\/accessibility/);
  assert.match(read("app/business/[id]/manage/page.tsx"), /Help people plan their visit/);
  assert.match(read("app/hubs/[id]/manage/page.tsx"), /accessible\/edit\/hub/);
  for (const [p, t] of [["app/directory/[id]/page.tsx", "business"], ["app/hubs/[id]/page.tsx", "hub"], ["app/whats-on/[id]/page.tsx", "event"], ["app/whats-on/regular/[slug]/page.tsx", "activity"]]) assert.match(read(p), new RegExp(`AccessibilitySection type="${t}"`), p);
  assert.ok(readdirSync(new URL("../app/accessible/edit/[type]/[id]", import.meta.url)).includes("page.tsx"));
});
