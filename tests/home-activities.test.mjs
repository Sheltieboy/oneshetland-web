/**
 * Homepage "What's happening" tabs: Regular Activities discovery. Run: node --test tests/home-activities.test.mjs
 * Real data only; cancelled and break sessions never count as upcoming; variety across organisers; accessible tabs; events mosaic untouched.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homeActivityPlan, MAX_PER_ORGANISER, HOME_ACTIVITY_MAX } from "../lib/home-activities.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = new Date("2026-11-09T12:00:00Z");
const at = (h, d = 0) => new Date(NOW.getTime() + d * 86_400_000 + (h - 12) * 3_600_000).toISOString();
let n = 0;
const A = (o = {}) => { n++; const start = o.start ?? at(18, 1); return {
  id: `a${n}`, slug: `act-${n}`, title: o.title ?? `Activity ${n}`, description: null, category: o.category ?? "fitness", audience: null, venue: o.venue ?? "Hall", locality: o.locality ?? "Lerwick", price_text: null,
  booking_mode: "drop_in", cover_url: o.cover ?? null, owner_kind: "business", owner_id: o.owner ?? `o${n}`, owner_name: o.ownerName ?? `Org ${o.owner ?? n}`, owner_slug: null,
  next_starts_at: o.live === false ? null : start, next_ends_at: o.live === false ? null : new Date(new Date(start).getTime() + 3_600_000).toISOString(),
  sessions_in_window: o.live === false ? 0 : 2, cancelled_in_window: o.live === false ? 3 : 0, upcoming: [] }; };

test("only activities with a live session still to come are featured; all-cancelled and finished ones are not", () => {
  const live = A({ title: "Runs" }), cancelled = A({ title: "Cancelled", live: false });
  const finished = A({ title: "Finished", start: at(8, 0) });          // started and ended this morning
  const plan = homeActivityPlan([live, cancelled, finished], {}, NOW);
  assert.deepEqual(plan.map((c) => c.title), ["Runs"]);
});
test("a session in progress counts only if it has not ended; cancelled sessions are never 'next'", () => {
  const inProgress = A({ title: "Now", start: at(11.5, 0) });           // 11:30–12:30, now is 12:00
  assert.equal(homeActivityPlan([inProgress], {}, NOW).length, 1);
  assert.equal(homeActivityPlan([A({ live: false })], {}, NOW).length, 0);
});
test("variety: one organiser cannot dominate, and different organisers and kinds come first", () => {
  const rows = [];
  for (let i = 0; i < 6; i++) rows.push(A({ owner: "big", ownerName: "Big Org", start: at(9 + i, 1), category: "fitness" }));
  rows.push(A({ owner: "x", start: at(20, 3), category: "music" }), A({ owner: "y", start: at(20, 4), category: "arts_crafts" }), A({ owner: "z", start: at(20, 5), category: "learning" }));
  const plan = homeActivityPlan(rows, {}, NOW);
  const byOrg = (name) => plan.filter((c) => c.organiser === name).length;
  assert.ok(byOrg("Big Org") <= MAX_PER_ORGANISER);
  assert.ok(plan.length <= HOME_ACTIVITY_MAX);
  assert.equal(new Set(plan.slice(0, 4).map((c) => c.organiser)).size >= 3, true, "the first four come from at least three organisers");
  assert.ok(new Set(plan.map((c) => c.category)).size >= 4);
});
test("a small catalogue still fills sensibly: fewer than the cap, each activity once", () => {
  const plan = homeActivityPlan([A({ owner: "one" }), A({ owner: "one" }), A({ owner: "one" })], {}, NOW);
  assert.equal(plan.length, MAX_PER_ORGANISER);
  assert.equal(new Set(plan.map((c) => c.id)).size, plan.length);
});
test("the large first card is the soonest one with a photograph", () => {
  const plan = homeActivityPlan([A({ title: "Early no photo", start: at(7, 1) }), A({ title: "Later photo", start: at(19, 2), cover: "https://example.com/x.webp" })], {}, NOW);
  assert.equal(plan[0].title, "Later photo"); assert.equal(plan[0].photo, "https://example.com/x.webp");
});
test("cards carry name, organiser, recurring days, place and next session; photos only when https", () => {
  const r = A({ title: "Chairobics", ownerName: "Ruth Archer Fitness", venue: "Hall", locality: "Lerwick", cover: "http://insecure.example/x.jpg" });
  const rules = { [r.id]: [{ day_of_week: 6, start_time: "14:00:00", end_time: "15:00:00", interval_weeks: 1, is_active: true }] };
  const [c] = homeActivityPlan([r], rules, NOW);
  assert.equal(c.organiser, "Ruth Archer Fitness"); assert.match(c.days, /Saturday/); assert.equal(c.place, "Hall, Lerwick"); assert.match(c.next, /^Next: /); assert.equal(c.photo, null);
  assert.equal(c.href, `/whats-on/regular/${r.slug}`);
});
test("no invented data: with no rows there are no cards", () => { assert.deepEqual(homeActivityPlan([], {}, NOW), []); });

test("tabs are accessible: tablist, aria-selected, roving tabindex, arrow/Home/End, both panels in the page for instant switching", () => {
  const t = read("components/preview/v2/HappeningTabs.tsx");
  for (const s of ['role="tablist"', 'role="tab"', 'role="tabpanel"', "aria-selected", "aria-controls", "aria-labelledby", "tabIndex={on ? 0 : -1}", "ArrowRight", "ArrowLeft", "Home", "End", "min-h-11"]) assert.ok(t.includes(s), s);
  assert.match(t, /hidden=\{tab !== "events"\}/); assert.match(t, /hidden=\{tab !== "regular"\}/);
  assert.match(t, /useState<"events" \| "regular">\("events"\)/, "Events is the default");
  assert.doesNotMatch(t, /fetch\(|useEffect/, "no request on switch");
});
test("the Events mosaic is preserved, tabs only appear when there are real activities, and the page links to the full listing", () => {
  const h = read("components/preview/v2/HomeV2.tsx");
  assert.match(h, /EventCard c=\{c0\} kind="hero"/); assert.match(h, /aria-label="More events"/);
  assert.match(h, /hasActivities \? \(\s*<HappeningTabs/); assert.match(h, /\) : eventsMosaic\}/);
  assert.match(h, /href: "\/whats-on\/regular"/); assert.match(h, /Explore all regular activities/);
  assert.match(h, /cta=\{hasActivities \? undefined : \{ label: "Full calendar"/);
});
test("the homepage loads activities anonymously, cached and bounded; nothing personal; no sample data", () => {
  const p = read("app/page.tsx");
  assert.match(p, /resilient<[\s\S]*?\("home:activities"/); assert.match(p, /getHomeActivities\(now\)/);
  const d = read("lib/activities-data.ts");
  assert.match(d, /p_limit: 60/); assert.match(d, /sessions_in_window > 0/);
  for (const f of ["lib/home-activities.ts", "components/preview/v2/HomeActivities.tsx"]) assert.doesNotMatch(read(f), /lorem|sample|placeholder|mock/i, f);
});
test("cards are image-led with category fallbacks, never an unrelated stock photo", () => {
  const c = read("components/preview/v2/HomeActivities.tsx");
  assert.match(c, /HERO\[c\.category\]/); assert.match(c, /GLYPH/); assert.match(c, /SafeImage/);
  assert.doesNotMatch(c, /HOME_FALLBACK_IMAGE|\.jpg|\.png/);
});
