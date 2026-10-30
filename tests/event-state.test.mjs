/**
 * Stage 4B.2 — UPCOMING / ONGOING / FINISHED, and what each surface does with them.
 *
 * WHAT WAS WRONG: after the 4A.5A change kept running events discoverable, an event that began weeks ago (I Fly the Flag, 2 Oct,
 * running to January) could appear under its OLD start date, looking like something still to come, and could occupy
 * "what's happening next" slots. Now every event is exactly one of three states; upcoming-only surfaces take only events
 * that start today (Shetland) or later; the full What's On keeps ongoing events but labels them "Ongoing … until".
 *
 * Run: node --test --import ./tests/support/register.mjs tests/event-state.test.mjs
 */
import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDb, setViewer } from "./support/fake-supabase.mjs";
import {
  eventState, londonDayStartIso, isUpcomingSurfaceEligible, upcomingSurfaceFilter, untilLabel, ongoingLabel, splitByState, londonDayNumber, londonMonthShort,
} from "../lib/event-state.ts";
import { rowMeta, whenText } from "../lib/event-display.ts";

const at = (s) => Date.parse(s);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = at("2026-12-05T12:00:00Z"); // Saturday, day 2 of RIFFMAS (GMT)
const RIFF = { starts_at: "2026-12-04T19:00:00Z", ends_at: "2026-12-06T23:59:00Z" };
const FLAG = { starts_at: "2026-10-02T10:30:00Z", ends_at: "2027-01-18T00:30:00Z" };   // I Fly the Flag

describe("the three states", () => {
  test("1. a future event is UPCOMING", () => assert.equal(eventState({ starts_at: "2026-12-12T19:00:00Z", ends_at: "2026-12-12T22:00:00Z" }, NOW), "upcoming"));
  test("2. an event later today is UPCOMING", () => assert.equal(eventState({ starts_at: "2026-12-05T19:00:00Z", ends_at: "2026-12-05T21:00:00Z" }, NOW), "upcoming"));
  test("3. an event that started earlier TODAY and is still running is ONGOING (not past)", () => {
    assert.equal(eventState({ starts_at: "2026-12-05T10:00:00Z", ends_at: "2026-12-05T17:00:00Z" }, NOW), "ongoing");
  });
  test("4. a multi-day event on day two is ONGOING", () => assert.equal(eventState(RIFF, NOW), "ongoing"));
  test("5. a long-running exhibition is ONGOING", () => assert.equal(eventState(FLAG, NOW), "ongoing"));
  test("10. a finished event is FINISHED", () => assert.equal(eventState({ starts_at: "2026-11-28T19:00:00Z", ends_at: "2026-11-28T22:00:00Z" }, NOW), "finished"));
  test("11. with no end time: future = upcoming, started = FINISHED (never assumed to run on)", () => {
    assert.equal(eventState({ starts_at: "2026-12-06T10:00:00Z", ends_at: null }, NOW), "upcoming");
    assert.equal(eventState({ starts_at: "2026-12-05T09:00:00Z", ends_at: null }, NOW), "finished");
    assert.equal(eventState({ starts_at: "2026-12-01T10:00:00Z" }, NOW), "finished");
  });
  test("14. RIFFMAS before, during and after", () => {
    assert.equal(eventState(RIFF, at("2026-12-03T12:00:00Z")), "upcoming");
    assert.equal(eventState(RIFF, at("2026-12-04T19:30:00Z")), "ongoing");
    assert.equal(eventState(RIFF, at("2026-12-05T12:00:00Z")), "ongoing");
    assert.equal(eventState(RIFF, at("2026-12-06T23:30:00Z")), "ongoing");
    assert.equal(eventState(RIFF, at("2026-12-07T00:00:00Z")), "finished");
  });
  test("junk input is finished, never a crash", () => {
    assert.equal(eventState({ starts_at: "nope" }, NOW), "finished");
    assert.equal(eventState({ starts_at: "" }, NOW), "finished");
  });
});

describe("upcoming-only eligibility uses the Shetland day (GMT, BST, midnight, clock changes)", () => {
  test("a six-week exhibition and RIFFMAS on day 2 are NOT upcoming-surface material; today's events are", () => {
    assert.equal(isUpcomingSurfaceEligible(FLAG, NOW), false);
    assert.equal(isUpcomingSurfaceEligible(RIFF, NOW), false);
    assert.equal(isUpcomingSurfaceEligible({ starts_at: "2026-12-05T10:00:00Z", ends_at: "2026-12-05T17:00:00Z" }, NOW), true, "started earlier today, still on");
    assert.equal(isUpcomingSurfaceEligible({ starts_at: "2026-12-05T19:00:00Z", ends_at: null }, NOW), true);
    assert.equal(isUpcomingSurfaceEligible({ starts_at: "2026-12-05T08:00:00Z", ends_at: "2026-12-05T10:00:00Z" }, NOW), false, "already over");
  });
  test("GMT winter: the day starts at 00:00Z", () => assert.equal(londonDayStartIso(at("2026-12-05T12:00:00Z")), "2026-12-05T00:00:00.000Z"));
  test("BST summer: the day starts an hour before UTC midnight", () => assert.equal(londonDayStartIso(at("2026-07-15T12:00:00Z")), "2026-07-14T23:00:00.000Z"));
  test("spring-forward Sunday (29 Mar 2026) starts at 00:00Z; autumn-back Sunday (25 Oct 2026) starts at 23:00Z the day before", () => {
    assert.equal(londonDayStartIso(at("2026-03-29T12:00:00Z")), "2026-03-29T00:00:00.000Z");
    assert.equal(londonDayStartIso(at("2026-10-25T12:00:00Z")), "2026-10-24T23:00:00.000Z");
  });
  test("just after midnight BST it is already the next Shetland day", () => {
    const now = at("2026-07-15T23:10:00Z"); // 00:10 on 16 July in Lerwick
    assert.equal(londonDayStartIso(now), "2026-07-15T23:00:00.000Z");
    const started2330BST = { starts_at: "2026-07-15T22:30:00Z", ends_at: "2026-07-16T00:00:00Z" }; // 23:30 BST on the 15th, ends 01:00 BST
    assert.equal(eventState(started2330BST, now), "ongoing");
    assert.equal(isUpcomingSurfaceEligible(started2330BST, now), false, "it began yesterday (Shetland), so not an upcoming-slot event");
    assert.equal(isUpcomingSurfaceEligible({ starts_at: "2026-07-15T23:30:00Z", ends_at: "2026-07-16T01:00:00Z" }, now), true, "starts 00:30 BST today");
  });
  test("the query filter says the same thing as the in-memory rule", () => {
    const f = upcomingSurfaceFilter(NOW);
    assert.equal(f.fromIso, "2026-12-05T00:00:00.000Z");
    assert.equal(f.orFilter, "ends_at.gte.2026-12-05T12:00:00.000Z,and(ends_at.is.null,starts_at.gte.2026-12-05T12:00:00.000Z)");
  });
});

describe("how an ongoing card reads", () => {
  test("8/9. an ongoing row shows 'Until …', NOT its old start time/date, and is flagged ongoing", () => {
    const m = rowMeta({ ...FLAG, venue: "Burra Hall" }, null, at("2026-12-05T12:00:00Z"));
    assert.equal(m.ongoing, true);
    assert.equal(m.line, "Until Mon 18 Jan · Burra Hall");
    assert.doesNotMatch(m.line, /\b2 Oct|10:30|Fri/);
  });
  test("a festival on day two says it runs until Sunday, not that it starts Friday", () => {
    const m = rowMeta({ ...RIFF, venue: "Lerwick British Legion" }, null, NOW);
    assert.equal(m.line, "Until Sun 6 Dec · Lerwick British Legion");
    assert.doesNotMatch(m.line, /19:00|Fri/);
  });
  test("an event that ends later today says 'Until 17:00'", () => {
    assert.equal(untilLabel({ starts_at: "2026-12-05T10:00:00Z", ends_at: "2026-12-05T17:00:00Z" }, NOW), "Until 17:00");
    assert.equal(ongoingLabel({ starts_at: "2026-12-05T10:00:00Z", ends_at: "2026-12-05T17:00:00Z" }, NOW), "Ongoing · Until 17:00");
  });
  test("strips and cards: whenText shows 'Ongoing · Until …' while running and the normal date otherwise", () => {
    assert.equal(whenText(RIFF, NOW), "Ongoing · Until Sun 6 Dec");
    assert.equal(whenText(RIFF, at("2026-12-03T12:00:00Z")), "Friday 4 December at 19:00");
  });
  test("an UPCOMING row keeps its normal time (and the multi-day suffix); same-day has no suffix", () => {
    assert.equal(rowMeta({ ...RIFF, venue: "Lerwick British Legion" }, null, at("2026-12-03T12:00:00Z")).line, "19:00 · Lerwick British Legion · to Sun 6 Dec");
    const one = rowMeta({ starts_at: "2026-12-12T19:30:00Z", ends_at: "2026-12-12T22:00:00Z", venue: "Mareel" }, "Shetland Arts", NOW);
    assert.equal(one.line, "19:30 · Mareel · Shetland Arts"); assert.equal(one.ongoing, false);
  });
  test("the date badge uses Shetland's day and month", () => {
    assert.equal(londonDayNumber("2026-07-15T23:30:00Z"), "16"); // 00:30 BST on the 16th
    assert.equal(londonMonthShort("2026-12-04T19:00:00Z"), "Dec");
  });
  test("splitByState puts running events in their own group, order kept", () => {
    const l = [{ id: "a", ...FLAG }, { id: "b", starts_at: "2026-12-12T19:00:00Z" }, { id: "c", ...RIFF }, { id: "d", starts_at: "2026-11-01T10:00:00Z", ends_at: "2026-11-01T11:00:00Z" }];
    const s = splitByState(l, NOW);
    assert.deepEqual(s.ongoing.map((x) => x.id), ["a", "c"]);
    assert.deepEqual(s.rest.map((x) => x.id), ["b", "d"]);
  });
});

/* ── real query code over fixtures, at a frozen "now" ─────────────────────── */
let n = 0;
const ev = (title, starts, ends, extra = {}) => ({
  id: `ev-${++n}`, title, category: "Music", status: "published", is_hidden: false, organiser_hub_id: null, calendar_approved: false,
  is_featured: false, has_tickets: false, venue: "Somewhere", locality: "Lerwick", cover_url: null, price_text: null, description: null,
  lat: 60.15, lng: -1.15, organiser_business_id: null, starts_at: starts, ends_at: ends, ticket_types: [], business: null, hub: null, ...extra,
});
const FIX = [
  ev("Future Gig", "2026-12-12T19:00:00Z", "2026-12-12T22:00:00Z"),
  ev("Later Today", "2026-12-05T19:00:00Z", "2026-12-05T21:00:00Z"),
  ev("Started Earlier Today", "2026-12-05T10:00:00Z", "2026-12-05T17:00:00Z"),
  ev("RIFFMAS 2026", RIFF.starts_at, RIFF.ends_at),
  ev("I Fly the Flag", FLAG.starts_at, FLAG.ends_at, { category: "Arts & Culture" }),
  ev("Finished Show", "2026-11-28T19:00:00Z", "2026-11-28T22:00:00Z"),
  ev("Old No End", "2026-12-01T10:00:00Z", null),
  ev("Draft Ongoing", RIFF.starts_at, RIFF.ends_at, { status: "draft", is_hidden: true }),
  ev("Cancelled Ongoing", "2026-12-05T10:00:00Z", "2026-12-05T20:00:00Z", { status: "cancelled", is_hidden: true }),
  ev("Business Exhibition", "2026-11-20T10:00:00Z", "2026-12-24T17:00:00Z", { organiser_business_id: "biz-1" }),
  ev("Business Later", "2026-12-19T10:00:00Z", "2026-12-19T12:00:00Z", { organiser_business_id: "biz-1" }),
];
const titles = (rows) => rows.map((r) => r.title);
let events, home, local, hubs;
before(async () => {
  mock.timers.enable({ apis: ["Date"], now: NOW });
  setDb({ events: FIX }); setViewer("anon");
  events = await import("../lib/events-data.ts"); home = await import("../lib/home-data.ts"); local = await import("../lib/local-data.ts"); hubs = await import("../lib/hubs-data.ts");
});
after(() => mock.timers.reset());

describe("surfaces", () => {
  test("6. an ongoing event does NOT appear in an upcoming-only component (Home, Local, business, strips)", async () => {
    for (const [name, t] of [
      ["home", titles((await home.getHomeData()).events)],
      ["local", titles((await local.getLocalFeed()).events)],
      ["business", titles((await local.getBusinessEventsAndJobs("biz-1")).events)],
      ["upcomingOnly list", titles(await events.getUpcomingEvents({ limit: 100, upcomingOnly: true }))],
    ]) {
      for (const old of ["RIFFMAS 2026", "I Fly the Flag", "Business Exhibition"]) assert.ok(!t.includes(old), `${name} must not show ${old}`);
    }
    assert.deepEqual(titles((await local.getBusinessEventsAndJobs("biz-1")).events), ["Business Later"]);
  });
  test("an event later today or started earlier today is still in the upcoming-only slots", async () => {
    const t = titles((await home.getHomeData()).events);
    assert.ok(t.includes("Later Today") && t.includes("Started Earlier Today") && t.includes("Future Gig"));
  });
  test("7. an ongoing event DOES remain in the full What's On list", async () => {
    const t = titles(await events.getUpcomingEvents({ limit: 100 }));
    for (const want of ["RIFFMAS 2026", "I Fly the Flag", "Business Exhibition", "Future Gig"]) assert.ok(t.includes(want), want);
  });
  test("10/11. finished and old no-end events are absent from the full list too", async () => {
    const t = titles(await events.getUpcomingEvents({ limit: 100 }));
    assert.ok(!t.includes("Finished Show") && !t.includes("Old No End"));
  });
  test("12. draft and hidden events stay out of every surface", async () => {
    for (const viewer of ["anon", "authenticated"]) {
      setViewer(viewer);
      const all = [...titles(await events.getUpcomingEvents({ limit: 100 })), ...titles(await events.getUpcomingEvents({ limit: 100, upcomingOnly: true })),
        ...titles((await home.getHomeData()).events), ...titles((await local.getLocalFeed()).events)];
      assert.ok(!all.includes("Draft Ongoing") && !all.includes("Cancelled Ongoing"), viewer);
    }
    setViewer("anon");
  });
});

describe("14. RIFFMAS through its life, in the real queries", () => {
  const riffIn = async (iso) => {
    mock.timers.reset(); mock.timers.enable({ apis: ["Date"], now: at(iso) });
    return { full: titles(await events.getUpcomingEvents({ limit: 100 })).includes("RIFFMAS 2026"),
             home: titles((await home.getHomeData()).events).includes("RIFFMAS 2026") };
  };
  test("before: in the list and (once today/within slots) upcoming", async () => { const r = await riffIn("2026-12-03T12:00:00Z"); assert.equal(r.full, true); assert.equal(r.home, true); });
  test("opening night (it starts today): still an upcoming-style event today", async () => { const r = await riffIn("2026-12-04T18:00:00Z"); assert.equal(r.full, true); assert.equal(r.home, true); });
  test("day two: in the full list (as ongoing), NOT in the upcoming-only Home", async () => { const r = await riffIn("2026-12-05T12:00:00Z"); assert.equal(r.full, true); assert.equal(r.home, false); });
  test("after Sunday 23:59: gone from both", async () => { const r = await riffIn("2026-12-07T09:00:00Z"); assert.equal(r.full, false); assert.equal(r.home, false); mock.timers.reset(); mock.timers.enable({ apis: ["Date"], now: NOW }); });
});

describe("the pages use the shared state rule", () => {
  test("What's On list groups ongoing events under their own heading and passes one 'now' down", () => {
    const l = read("components/events/EventsListing.tsx"), p = read("app/whats-on/page.tsx");
    assert.match(l, /splitByState\(events, now\)/); assert.match(l, /Ongoing now/); assert.match(l, /rowMeta\(e, organiser/);
    assert.match(p, /upcomingOnly: true/); assert.match(p, /nowIso=\{nowIso\}/);
  });
  test("every upcoming-only query carries the same filter", () => {
    for (const f of ["lib/home-data.ts", "lib/local-data.ts", "lib/hubs-data.ts", "lib/business-dashboard.server.ts"]) assert.match(read(f), /upcomingSurfaceFilter\(\)\.fromIso/, f);
    assert.match(read("app/visiting/page.tsx"), /upcomingOnly: true/);
  });
  test("the detail page marks a running event 'Ongoing' and keeps its real dates", () => {
    const s = read("app/whats-on/[id]/page.tsx");
    assert.match(s, /eventState\(e, new Date\(\)\) === "ongoing"/); assert.match(s, /eventWhen\(e\.starts_at, e\.ends_at\)\.start/);
  });
  test("Home no longer builds its badge from the server's local date", () => {
    assert.doesNotMatch(read("components/home/HomeSections.tsx"), /new Date\(e\.starts_at\)\.getDate\(\)/);
  });
});
