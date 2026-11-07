/**
 * Regular Activities attribution (7 Nov 2026): a business or hub owner shows its own name; a platform-owned activity, or one whose owner name the database
 * could not give (it falls back to the literal 'OneShetland'), makes NO organiser claim. Run: node --test --import ./tests/support/register.mjs tests/activity-organiser.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activityOrganiser, activityOrganiserLabel } from "../lib/activity-organiser.ts";
import { homeActivityPlan } from "../lib/home-activities.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const KINDS = ["business", "hub", "platform", undefined, null, "", "weird", 7];
const NAMES = ["Ruth Archer Fitness", "  Unst   Hub ", "OneShetland", "oneshetland", " One Shetland ", "ONESHETLAND", "", "   ", null, undefined, 42];

test("exhaustive owner kind x name: never a false 'OneShetland' organiser", () => {
  for (const k of KINDS) for (const n of NAMES) {
    const o = activityOrganiser(k, n), label = activityOrganiserLabel(k, n);
    assert.equal(o.name, label);
    if (label !== null) assert.doesNotMatch(label, /^one\s*shetland$/i, `${k}/${n}`);
    if (k !== "business" && k !== "hub") { assert.equal(label, null, `non-business/hub ${String(k)} must claim nothing`); assert.equal(o.kind, "platform"); }
    else if (typeof n === "string" && n.trim() && !/^one\s*shetland$/i.test(n.trim())) assert.equal(label, n.trim().replace(/\s+/g, " "), `${k}/${n}`);
    else assert.equal(label, null, `${k}/${String(n)} has no usable name`);
  }
});
test("a name that merely contains OneShetland is a real name and is kept", () => {
  assert.equal(activityOrganiserLabel("business", "OneShetland Pilates Studio"), "OneShetland Pilates Studio");
  assert.equal(activityOrganiserLabel("hub", "Friends of OneShetland"), "Friends of OneShetland");
});

let n = 0;
const row = (o) => { n++; const start = "2026-11-10T18:00:00Z"; return { id: `a${n}`, slug: `s${n}`, title: `T${n}`, description: null, category: "fitness", audience: null, venue: "Hall", locality: "Lerwick", price_text: null, booking_mode: "drop_in", cover_url: null, owner_kind: o.kind, owner_id: o.id ?? null, owner_name: o.name, owner_slug: null, next_starts_at: start, next_ends_at: "2026-11-10T19:00:00Z", sessions_in_window: 2, cancelled_in_window: 0, upcoming: [] }; };

test("homepage plan: business/hub keep their names; platform-owned and fallback-named owners have organiser null", () => {
  const NOW = new Date("2026-11-09T12:00:00Z");
  const plan = homeActivityPlan([
    row({ kind: "business", id: "b1", name: "Ruth Archer Fitness" }), row({ kind: "hub", id: "h1", name: "Unst Hub" }),
    row({ kind: "platform", name: "OneShetland" }), row({ kind: "hub", id: "h2", name: "OneShetland" }), row({ kind: "business", id: "b2", name: "OneShetland" }),
  ], {}, NOW);
  const by = Object.fromEntries(plan.map((c) => [c.title, c.organiser]));
  assert.equal(plan.length, 5);
  const orgs = plan.map((c) => c.organiser);
  assert.deepEqual(orgs.filter((x) => x !== null).sort(), ["Ruth Archer Fitness", "Unst Hub"]);
  assert.equal(orgs.filter((x) => x === null).length, 3);
  assert.ok(!JSON.stringify(by).includes('"OneShetland"'));
});

test("source: no component or loader labels an activity 'OneShetland' or 'Listed by OneShetland' as its organiser", () => {
  const card = read("components/activities/ActivityCard.tsx");
  assert.match(card, /activityOrganiserLabel\(a\.owner_kind, a\.owner_name\)/);
  assert.match(card, /\{organiser && <p /);
  assert.doesNotMatch(card, /"OneShetland"/);
  const view = read("components/activities/detail/ActivityDetailView.tsx");
  assert.doesNotMatch(view, /Listed by OneShetland/);
  assert.match(view, /const ownerKnown = owner\.kind !== "platform" && !!owner\.name/);
  const data = read("lib/activities-data.ts");
  assert.doesNotMatch(data, /kind: "platform", id: null, name: "OneShetland"/);
  assert.match(data, /activityOrganiserLabel\("hub", data\?\.name\)/);
  assert.match(data, /activityOrganiserLabel\("business", data\?\.name\)/);
  const home = read("lib/home-activities.ts");
  assert.doesNotMatch(home, /"OneShetland"/);
  const tile = read("components/preview/v2/HomeActivities.tsx");
  assert.equal((tile.match(/\{c\.organiser && </g) ?? []).length, 2);
});
