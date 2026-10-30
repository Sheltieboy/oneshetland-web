/**
 * Homepage "What's happening" mosaic — seven events, every card with a cover uses it.
 *
 * WHAT CHANGED: the mosaic showed four events and its two lower-right cards were plain coloured text cards even when the event had
 * a proper approved cover (Harry's, the Accordion Club). It now shows SEVEN — a hero, a medium card, two small cards, then a row of
 * three — and every card with a cover draws it; the text card is only the fallback for an event with no cover. Selection is
 * unchanged: the same chronological, freshness-filtered query, only the limit rose from 6 to 7.
 *
 * Run: node --test --import ./tests/support/register.mjs tests/home-mosaic.test.mjs
 */
import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDb, setViewer } from "./support/fake-supabase.mjs";
import { homeMosaicPlan, HOME_MOSAIC_COUNT } from "../lib/event-display.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = Date.parse("2026-12-05T12:00:00Z");
const COVER = (n) => `https://example.invalid/event-media/${n}.jpg`;

let n = 0;
const ev = (title, starts, ends, extra = {}) => ({
  id: `ev-${++n}`, title, category: "Music", status: "published", is_hidden: false, organiser_hub_id: null, calendar_approved: false,
  is_featured: false, has_tickets: false, venue: `Venue ${n}`, locality: "Lerwick", cover_url: COVER(title.replace(/\W+/g, "-")), price_text: null,
  description: null, lat: 60.15, lng: -1.15, organiser_business_id: null, starts_at: starts, ends_at: ends, ticket_types: [], business: null, hub: null, ...extra,
});
const day = (d, h = 19) => `2026-12-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`;

// Ten eligible events (one with no cover), plus everything that must stay out.
const ELIGIBLE = [
  ev("Started Earlier Today", day(5, 10), day(5, 17)),            // 1  in progress, finishing today
  ev("Later Today", day(5, 19), day(5, 21)),                       // 2
  ev("No Cover Comedy", day(6, 19), day(6, 21), { cover_url: null }), // 3  small card, no cover -> fallback
  ev("Harry's Christmas Sunday Opening", day(6, 12), day(6, 17)),  // 4  (sorted by start below)
  ev("Accordion Club", day(7, 14), null),
  ev("Winter Warmers", day(8, 18), day(8, 21)),
  ev("Craft Night", day(9, 19), day(9, 21)),
  ev("Ninth Event", day(10, 19), day(10, 21)),
  ev("Tenth Event", day(11, 19), day(11, 21)),
  ev("Eleventh Event", day(12, 19), day(12, 21)),
];
const OUT = [
  ev("I Fly the Flag", "2026-10-02T10:30:00Z", "2027-01-18T00:30:00Z"),
  ev("Gaada Began Today Runs On", day(5, 10), "2027-01-05T17:00:00Z"),
  ev("Art in Nature", "2026-10-20T10:00:00Z", "2026-12-21T15:00:00Z"),
  ev("Finished Show", "2026-11-28T19:00:00Z", "2026-11-28T22:00:00Z"),
  ev("Old No End", "2026-12-01T10:00:00Z", null),
  ev("Draft Event", day(7, 19), day(7, 21), { status: "draft", is_hidden: true }),
  ev("Hidden Cancelled", day(7, 20), day(7, 22), { status: "cancelled", is_hidden: true }),
];
let home;
before(async () => { mock.timers.enable({ apis: ["Date"], now: NOW }); setDb({ events: [...ELIGIBLE, ...OUT] }); setViewer("anon"); home = await import("../lib/home-data.ts"); });
after(() => mock.timers.reset());

describe("selection: seven events, existing freshness rules intact", () => {
  test("1. the homepage takes up to 7 eligible events", async () => {
    const ev7 = (await home.getHomeData()).events;
    assert.equal(ev7.length, 7); assert.equal(HOME_MOSAIC_COUNT, 7);
    assert.match(read("lib/home-data.ts"), /\.limit\(7\);\s+\/\/ the homepage mosaic/);
  });
  test("9. order stays chronological (nothing re-ranked for a better picture)", async () => {
    const e = (await home.getHomeData()).events; const t = e.map((x) => Date.parse(x.starts_at));
    assert.deepEqual(t, [...t].sort((a, b) => a - b));
    assert.deepEqual(e.map((x) => x.title).slice(0, 3), ["Started Earlier Today", "Later Today", "Harry's Christmas Sunday Opening"]);
  });
  test("2/3/10. long-running, finished, no-end-old, draft and hidden events stay out", async () => {
    const titles = (await home.getHomeData()).events.map((x) => x.title);
    for (const out of OUT.map((o) => o.title)) assert.ok(!titles.includes(out), `${out} must not be on Home`);
    assert.ok(titles.includes("Started Earlier Today"), "in progress and finishing today is still eligible");
  });
  test("a visitor and an ordinary signed-in user get the same answer", async () => {
    setViewer("authenticated"); const t = (await home.getHomeData()).events.map((x) => x.title); setViewer("anon");
    assert.equal(t.length, 7); assert.ok(!t.includes("Draft Event"));
  });
});

describe("cards: every event with a cover uses it; no cover -> text fallback", () => {
  const plan = () => homeMosaicPlan(ELIGIBLE.slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at)), NOW);
  test("seven cards in the order given, with the hero / medium / small / small / tile x3 structure", () => {
    const p = plan(); assert.equal(p.length, 7);
    assert.deepEqual(p.map((c) => c.slot), ["hero", "medium", "small", "small", "tile", "tile", "tile"]);
    assert.deepEqual(p.map((c) => c.position), [1, 2, 3, 4, 5, 6, 7]);
  });
  test("4. every card that has a cover is a photo card using that exact cover", () => {
    for (const c of plan()) { if (c.cover) { assert.equal(c.photo, true); assert.match(c.cover, /^https:\/\/example\.invalid\/event-media\//); } }
  });
  test("5. position 3 uses its image", () => { const c = plan()[2]; assert.equal(c.photo, c.cover !== null); });
  test("5b/6. positions 3 and 4 are image cards when their events have covers (they used to be text-only by position)", () => {
    const withCovers = homeMosaicPlan([ELIGIBLE[0], ELIGIBLE[1], ELIGIBLE[3], ELIGIBLE[4]], NOW);   // all four have covers
    assert.equal(withCovers[2].slot, "small"); assert.equal(withCovers[2].photo, true); assert.equal(withCovers[2].cover, ELIGIBLE[3].cover_url);
    assert.equal(withCovers[3].slot, "small"); assert.equal(withCovers[3].photo, true); assert.equal(withCovers[3].cover, ELIGIBLE[4].cover_url);
  });
  test("7. positions 5-7 use their images where available", () => {
    const p = homeMosaicPlan(ELIGIBLE.filter((e) => e.cover_url).slice(0, 7), NOW);
    for (const c of p.slice(4)) { assert.equal(c.slot, "tile"); assert.equal(c.photo, true); assert.ok(c.cover); }
  });
  test("8. an event with no cover gets the text-only fallback (and only that event does)", () => {
    const p = plan(); const none = p.find((c) => c.title === "No Cover Comedy");
    assert.equal(none.photo, false); assert.equal(none.cover, null);
    assert.equal(p.filter((c) => !c.photo).length, 1);
    assert.equal(homeMosaicPlan([{ id: "x", title: "Blank", starts_at: day(6), cover_url: "   " }], NOW)[0].photo, false, "a blank cover is no cover");
  });
  test("an event in progress says so; an upcoming one shows its Shetland date and time", () => {
    const p = plan();
    assert.equal(p[0].live, true); assert.equal(p[0].badge, "Happening now"); assert.equal(p[0].line, "Until 17:00 · Venue 1");
    assert.equal(p[1].live, false); assert.equal(p[1].badge, "Sat 5 Dec"); assert.match(p[1].line, /^19:00 · /);
  });
  test("date numerals use Shetland's day (00:30 BST on the 16th is the 16th)", () => {
    const c = homeMosaicPlan([{ id: "b", title: "Late", starts_at: "2026-07-15T23:30:00Z", cover_url: null }], Date.parse("2026-07-15T12:00:00Z"))[0];
    assert.equal(c.day, "16"); assert.equal(c.month, "Jul");
  });
  test("fewer than seven events: just those, never padded", () => assert.equal(homeMosaicPlan(ELIGIBLE.slice(0, 3), NOW).length, 3));
  test("more than seven: capped at seven", () => assert.equal(homeMosaicPlan([...ELIGIBLE, ...OUT], NOW).length, 7));
});

describe("component wiring", () => {
  const s = read("components/preview/v2/HomeV2.tsx");
  test("the section builds its cards from the shared plan and uses the cover for every card with one", () => {
    assert.match(s, /homeMosaicPlan\(events, new Date\(\)\)/);
    assert.match(s, /if \(c\.photo\)/); assert.match(s, /<CropImg src=\{c\.cover!\}/);
  });
  test("small cards 3 and 4 are rendered through the same photo-capable card (not the old text-only branches)", () => {
    assert.match(s, /<EventCard c=\{c2\} kind="small"/); assert.match(s, /<EventCard c=\{c3\} kind="small"/);
    assert.doesNotMatch(s, /d\(e2\)|d\(e3\)/);
  });
  test("row two is three tiles; mobile is one swipeable scroll-snap rail, not seven stacked cards", () => {
    assert.match(s, /kind="tile"/); assert.match(s, /lg:grid-cols-3/);
    assert.match(s, /snap-x snap-mandatory/); assert.match(s, /aria-label="More events"/); assert.match(s, /lg:hidden/);
  });
  test("accessible: real links, visible keyboard focus, text clamps and truncation", () => {
    assert.match(s, /focus-visible:ring-4/); assert.match(s, /line-clamp-2/); assert.match(s, /truncate/);
    assert.match(s, /<Link href=\{`\/whats-on\/\$\{c\.id\}`\}/);
  });
  test("Full calendar CTA is still there, and the cruise card still appears when ships are in", () => {
    assert.match(s, /label: "Full calendar", href: "\/whats-on"/); assert.match(s, /showCruise && cruise/);
  });
  test("the freshness rules were not touched by this change", () => {
    const d = read("lib/home-data.ts");
    assert.match(d, /\.or\(upcomingSurfaceFilter\(\)\.orFilter\)/); assert.match(d, /\.or\(currentEventsFilter\(now\)\)/);
  });
});
