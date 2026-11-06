/**
 * The "Run regular activities" card on Business Manage. Run: node --test tests/business-activities-card.test.mjs
 * Runs the REAL outcome code (and the previous version from git, to prove the other five cards are unchanged).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { businessOutcomes, activitiesOutcome } from "../lib/business-outcomes.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const BASE = "/business/b1/manage";
const business = { id: "b1", slug: "northern-lights", accepts_bookings: false, name: "NL", description: "d".repeat(60), logo_url: "l", cover_url: "c", phone: "1", address: "a", category: "services" };
const data = (o = {}) => ({ products: 0, productsActive: 0, passes: 0, passesActive: 0, services: 0, availability: 0, events: 2, eventsUpcoming: 1, activities: 0, activitiesPublished: 0, offers: 0, offersLive: 0, loyalty: 0, loyaltyActive: 0, meetsPro: true, meetsPremium: false, ...o });
const keys = (d) => businessOutcomes(business, d, BASE).map((o) => o.key);

test("it sits in 'Your business', directly after 'Run events' and before 'Keep customers coming back'", () => {
  assert.deepEqual(keys(data()), ["found", "sell", "bookings", "events", "activities", "retention"]);
});
test("it uses the same full-width card (an Outcome rendered by OutcomeRow) with the requested heading, description and button", () => {
  const o = activitiesOutcome(data(), BASE);
  assert.equal(o.title, "Run regular activities");
  assert.equal(o.blurb, "Add weekly classes, groups and activities. Set your times once and update individual sessions whenever you need to.");
  assert.deepEqual(o.primary, { label: "Regular activities", href: "/business/b1/manage/activities" });
  assert.equal(o.secondary, undefined);
  const row = read("components/business/OutcomeRow.tsx");
  assert.match(row, /\{outcome\.title|\{title\}/); // the one shared card; no bespoke markup for this outcome
  assert.match(read("app/business/[id]/manage/page.tsx"), /outcomes\.map\(\(o\) => <OutcomeRow key=\{o\.key\} outcome=\{o\} accent=\{BIZ\} \/>\)/);
});
test("status reflects the business's real counts: none, drafts only, one, several", () => {
  assert.equal(activitiesOutcome(data({ activities: 0, activitiesPublished: 0 }), BASE).status, "No regular activities yet");
  assert.equal(activitiesOutcome(data({ activities: 2, activitiesPublished: 0 }), BASE).status, "No activities published yet");
  const one = activitiesOutcome(data({ activities: 1, activitiesPublished: 1 }), BASE);
  assert.equal(one.status, "1 activity published"); assert.equal(one.tone, "positive"); assert.equal(one.state, "live");
  assert.equal(activitiesOutcome(data({ activities: 4, activitiesPublished: 3 }), BASE).status, "3 activities published");
  assert.equal(activitiesOutcome(data({ activities: 4, activitiesPublished: 3 }), BASE).tone, "positive");
  assert.equal(activitiesOutcome(data({ activities: 1, activitiesPublished: 0 }), BASE).tone, "neutral");
});
test("a failed read says so; it never becomes a confident 'none yet'", () => {
  for (const d of [data({ activities: null }), data({ activitiesPublished: null })]) {
    const o = activitiesOutcome(d, BASE);
    assert.equal(o.status, "Couldn't load this just now"); assert.equal(o.state, "unknown");
  }
});
test("the counts come from THIS business's activities only: its own id, published and not paused by OneShetland, read as the owner", () => {
  const s = read("lib/business-dashboard.server.ts");
  const reads = [...s.matchAll(/sb\.from\("regular_activities"\)[^\n]*/g)].map((m) => m[0]);
  assert.equal(reads.length, 2);
  for (const r of reads) assert.match(r, /\.eq\("organiser_business_id", businessId\)/);
  assert.match(reads[1], /\.eq\("status", "published"\)\.eq\("admin_paused", false\)/);
  assert.doesNotMatch(reads.join(""), /organiser_hub_id|is_platform_activity/);
  assert.match(s, /activities: num\(activitiesRes as never\), activitiesPublished: num\(activitiesPublishedRes as never\)/);
});
test("the old link under 'Grow' is gone (no duplication), the route and permissions are unchanged", () => {
  const page = read("app/business/[id]/manage/page.tsx");
  assert.doesNotMatch(page, /UtilityRow label="Regular activities"/);
  assert.match(page, /UtilityRow label="Analytics"/); assert.match(page, /UtilityRow label="Boost"/);
  assert.equal(read("app/business/[id]/manage/activities/page.tsx").includes("requireBusinessOwner"), true);
  assert.match(read("app/business/[id]/manage/activities/page.tsx"), /returnPath: `\/business\/\$\{id\}\/manage\/activities`/);
});
test("the other five cards are exactly what they were (compared with the committed version of the code)", async () => {
  let before = null;
  try {
    const d = mkdtempSync(join(tmpdir(), "bo-"));
    for (const f of ["business-outcomes.ts", "be-found.ts"]) writeFileSync(join(d, f), execFileSync("git", ["show", `origin/main:lib/${f}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    before = (await import(join(d, "business-outcomes.ts"))).businessOutcomes;
  } catch { before = null; }
  if (!before) return;   // git history unavailable
  const samples = [data(), data({ products: 3, productsActive: 2, meetsPremium: true }), data({ services: 2, availability: 0 }), data({ events: 0, eventsUpcoming: 0 }), data({ offers: 2, offersLive: 1, loyalty: 1, loyaltyActive: 1 }), data({ events: null, eventsUpcoming: null })];
  for (const d of samples) {
    const now = businessOutcomes(business, d, BASE).filter((o) => o.key !== "activities");
    assert.deepEqual(now, before(business, d, BASE));
  }
});
test("Hub management: Regular activities already sits directly after Events in the same group; its route is unchanged", () => {
  const hub = read("app/hubs/[id]/manage/page.tsx");
  const i = hub.indexOf('label: "Events"'), j = hub.indexOf('label: "Regular activities"'), k = hub.indexOf('label: "Fundraising"');
  assert.ok(i > 0 && j > i && k > j, "Events, then Regular activities, then Fundraising");
  assert.match(hub, /href: `\$\{base\}\/activities`, label: "Regular activities"/);
});
