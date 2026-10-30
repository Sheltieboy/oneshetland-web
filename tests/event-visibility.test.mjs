/**
 * Stage 4A.5A — ongoing events stay discoverable, legacy categories collapse into one, and drafts stay private.
 *
 * WHAT THIS EXERCISES
 * The REAL query code (getUpcomingEvents, getEventCategories, getHomeData, getLocalFeed,
 * getBusinessEventsAndJobs, getHubEvents, getPlannerCandidates) running over fixture events in an in-memory
 * Supabase fake that EXECUTES the filters those functions build and mimics the production row-level rule on
 * events (signed-out and ordinary signed-in users see only non-hidden rows; an admin sees everything).
 * Time is frozen with mock timers, so "now" is the second day of RIFFMAS.
 *
 * SAFETY: no network, no Supabase project, no production access of any kind. Fixtures only.
 *
 * Run: node --test --import ./tests/support/register.mjs tests/event-visibility.test.mjs
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { setDb, setViewer } from "./support/fake-supabase.mjs";

const NOW = Date.parse("2026-12-05T12:00:00Z"); // Saturday, day 2 of RIFFMAS (Shetland = GMT in December)

let n = 0;
const ev = (title, starts, ends, extra = {}) => ({
  id: `ev-${++n}`, title, category: "Music", status: "published", is_hidden: false, organiser_hub_id: null,
  calendar_approved: false, is_featured: false, has_tickets: false, venue: "Somewhere", locality: "Lerwick",
  cover_url: null, price_text: null, description: null, lat: 60.15, lng: -1.15, organiser_business_id: null,
  starts_at: starts, ends_at: ends, ticket_types: [], business: null, hub: null, ...extra,
});

const FIXTURE = [
  ev("Future Gig", "2026-12-12T19:00:00Z", "2026-12-12T22:00:00Z"),
  ev("Tonight's Show", "2026-12-05T11:00:00Z", "2026-12-05T14:00:00Z"),
  ev("Last Week", "2026-11-28T19:00:00Z", "2026-11-28T22:00:00Z"),
  ev("RIFFMAS 2026", "2026-12-04T19:00:00Z", "2026-12-06T23:59:00Z"),
  ev("Art in Nature", "2026-10-24T09:00:00Z", "2026-12-20T17:00:00Z", { category: "Arts & Culture" }),
  ev("Pop-up Market", "2026-12-06T10:00:00Z", null, { category: "Market" }),
  ev("Old One-Day", "2026-12-01T10:00:00Z", null, { category: "Market" }),
  ev("Started Today No End", "2026-12-05T09:00:00Z", null, { category: "Community" }),
  ev("Legacy Gig", "2026-12-13T19:00:00Z", "2026-12-13T22:00:00Z", { category: "Music & Gigs" }),
  ev("Legacy Kids Party", "2026-12-14T10:00:00Z", "2026-12-14T12:00:00Z", { category: "Family & Kids" }),
  ev("Odd Category", "2026-12-15T10:00:00Z", "2026-12-15T12:00:00Z", { category: "Zzz Mystery" }),
  ev("No Category", "2026-12-16T10:00:00Z", "2026-12-16T12:00:00Z", { category: null }),
  // Never public:
  ev("Draft Ongoing", "2026-12-04T19:00:00Z", "2026-12-06T23:59:00Z", { status: "draft", is_hidden: true }),
  ev("Draft Future", "2026-12-20T19:00:00Z", "2026-12-20T22:00:00Z", { status: "draft", is_hidden: true, organiser_business_id: "biz-1" }),
  ev("Cancelled Ongoing", "2026-12-05T10:00:00Z", "2026-12-05T20:00:00Z", { status: "cancelled", is_hidden: true }),
  ev("Unapproved Hub Event", "2026-12-18T19:00:00Z", "2026-12-18T22:00:00Z", { organiser_hub_id: "hub-1", calendar_approved: false }),
  // A business's own published event that is running now:
  ev("Gallery Show", "2026-12-01T10:00:00Z", "2026-12-24T17:00:00Z", { organiser_business_id: "biz-1", category: "Arts & Culture" }),
  // A hub's approved, running event:
  ev("Hub Winter Fair", "2026-12-04T10:00:00Z", "2026-12-07T17:00:00Z", { organiser_hub_id: "hub-1", calendar_approved: true, hub_visibility: "islands" }),
];
const DRAFT_TITLES = ["Draft Ongoing", "Draft Future", "Cancelled Ongoing"];

const titles = (rows) => rows.map((r) => r.title);

let events, home, local, hubs, planner;
before(async () => {
  mock.timers.enable({ apis: ["Date"], now: NOW });
  setDb({ events: FIXTURE });
  events = await import("../lib/events-data.ts");
  home = await import("../lib/home-data.ts");
  local = await import("../lib/local-data.ts");
  hubs = await import("../lib/hubs-data.ts");
  planner = await import("../lib/planner-data.ts");
});
after(() => mock.timers.reset());

describe("What's On list — current means not finished", () => {
  test("future, in-progress, multi-day (RIFFMAS day 2) and long-running exhibition are listed", async () => {
    setViewer("anon");
    const t = titles(await events.getUpcomingEvents({ limit: 100 }));
    for (const want of ["Future Gig", "Tonight's Show", "RIFFMAS 2026", "Art in Nature", "Legacy Gig"]) assert.ok(t.includes(want), `${want} should be listed: ${t}`);
  });
  test("a finished event is not listed, and an old no-end event never comes back", async () => {
    const t = titles(await events.getUpcomingEvents({ limit: 100 }));
    assert.ok(!t.includes("Last Week"));
    assert.ok(!t.includes("Old One-Day"));
  });
  test("no end time: keeps the point-in-time rule (future listed, already-started not)", async () => {
    const t = titles(await events.getUpcomingEvents({ limit: 100 }));
    assert.ok(t.includes("Pop-up Market"), "starts tomorrow, no end -> listed");
    assert.ok(!t.includes("Started Today No End"), "started 3h ago, no end -> not invented as ongoing");
  });
  test("order: what is on now first (earliest start), then what is coming, soonest first", async () => {
    const t = titles(await events.getUpcomingEvents({ limit: 100 }));
    const running = ["Art in Nature", "Gallery Show", "Hub Winter Fair", "RIFFMAS 2026", "Tonight's Show"];
    const lastRunning = Math.max(...running.map((x) => t.indexOf(x)));
    const firstComing = Math.min(...["Pop-up Market", "Future Gig", "Legacy Gig"].map((x) => t.indexOf(x)));
    assert.ok(lastRunning < firstComing, `running events come first: ${t}`);
    const starts = (await events.getUpcomingEvents({ limit: 100 })).map((r) => Date.parse(r.starts_at));
    assert.deepEqual(starts, [...starts].sort((a, b) => a - b), "strictly start-time order");
  });
  test("'Today' means on today in Shetland time — includes a festival that began earlier", async () => {
    const t = titles(await events.getUpcomingEvents({ range: "today", limit: 100 }));
    for (const want of ["Tonight's Show", "RIFFMAS 2026", "Art in Nature"]) assert.ok(t.includes(want), want);
    for (const no of ["Future Gig", "Pop-up Market", "Legacy Gig"]) assert.ok(!t.includes(no), no);
  });
});

describe("Drafts, hidden and unapproved events stay private", () => {
  test("none of the real queries returns a draft / cancelled (hidden) event", async () => {
    for (const viewer of ["anon", "authenticated"]) {
      setViewer(viewer);
      const islandsWide = [
        ...titles(await events.getUpcomingEvents({ limit: 100 })),
        ...titles((await home.getHomeData()).events),
        ...titles((await local.getLocalFeed()).events),
      ];
      const all = [
        ...islandsWide,
        ...titles((await local.getBusinessEventsAndJobs("biz-1")).events),
        ...titles(await hubs.getHubEvents("hub-1")),
        ...titles(await events.getUpcomingEvents({ limit: 100, upcomingOnly: true })),
      ];
      for (const d of DRAFT_TITLES) assert.ok(!all.includes(d), `${viewer}: ${d} leaked`);
      assert.ok(!islandsWide.includes("Unapproved Hub Event"), "a hub event not calendar-approved stays off islands-wide lists");
    }
  });
  test("RLS: a raw read of the table by a visitor or ordinary user returns no draft; an admin can read them", async () => {
    const { publicClient } = await import("../lib/supabase/public.ts");
    for (const viewer of ["anon", "authenticated"]) {
      setViewer(viewer);
      const { data } = await publicClient().from("events").select("*");
      assert.deepEqual(titles(data).filter((x) => DRAFT_TITLES.includes(x)), []);
    }
    setViewer("admin");
    const { data } = await publicClient().from("events").select("*");
    for (const d of DRAFT_TITLES) assert.ok(titles(data).includes(d), `admin should see ${d}`);
    setViewer("anon");
  });
});

describe("Upcoming-only lists (Home, Local, business, hub) start today or later; the planner keeps running events", () => {
  test("Home strip: today's and future events, but not an exhibition or festival that began on an earlier day", async () => {
    setViewer("anon");
    const t = titles((await home.getHomeData()).events);
    assert.ok(t.includes("Tonight's Show"), "started earlier today and still running: still today's event");
    assert.ok(t.includes("Future Gig"));
    for (const old of ["Art in Nature", "RIFFMAS 2026", "Gallery Show", "Hub Winter Fair"]) assert.ok(!t.includes(old), `${old} began on an earlier day`);
    assert.ok(!t.includes("Last Week") && !t.includes("Old One-Day"));
    const { isOnToday } = await import("../lib/event-currency.ts");
    assert.equal(isOnToday({ starts_at: "2026-12-04T19:00:00Z", ends_at: "2026-12-06T23:59:00Z" }), true, "festival day 2 is on today");
    assert.equal(isOnToday({ starts_at: "2026-12-06T10:00:00Z", ends_at: null }), false, "tomorrow is not today");
  });
  test("Local feed: upcoming-only", async () => {
    const t = titles((await local.getLocalFeed()).events);
    assert.ok(t.includes("Future Gig") && t.includes("Tonight's Show"));
    assert.ok(!t.includes("RIFFMAS 2026") && !t.includes("Art in Nature") && !t.includes("Gallery Show"));
    assert.ok(!t.includes("Last Week") && !t.includes("Started Today No End"));
  });
  test("a business's coming events: upcoming-only (a running gallery show is not 'coming'), never its draft", async () => {
    assert.deepEqual(titles((await local.getBusinessEventsAndJobs("biz-1")).events), []);
  });
  test("a hub's coming events: upcoming-only, and no drafts", async () => {
    const t = titles(await hubs.getHubEvents("hub-1"));
    assert.ok(!t.includes("Hub Winter Fair"));
    assert.ok(!DRAFT_TITLES.some((d) => t.includes(d)));
  });
  test("planner: a multi-day event running when the window opens is still a (flexible) candidate; a finished one is not", async () => {
    const c = await planner.getPlannerCandidates("2026-12-05T09:00:00Z", "2026-12-05T18:00:00Z");
    const names = c.filter((x) => x.kind === "event").map((x) => x.name);
    assert.ok(names.includes("RIFFMAS 2026") && names.includes("Art in Nature") && names.includes("Tonight's Show"), names.join());
    assert.ok(!names.includes("Last Week") && !names.includes("Draft Ongoing"));
  });
});

describe("One logical category", () => {
  test("chips: Music appears once, with no legacy duplicates; unknown value keeps its own chip", async () => {
    const chips = await events.getEventCategories();
    assert.equal(chips.filter((c) => c === "Music").length, 1);
    for (const legacy of ["Music & Gigs", "Family & Kids"]) assert.ok(!chips.includes(legacy), legacy);
    for (const want of ["Music", "Family", "Arts & Culture", "Market", "Zzz Mystery"]) assert.ok(chips.includes(want), `${want} in ${chips}`);
  });
  test("choosing the current category returns the legacy-stored events too", async () => {
    const t = titles(await events.getUpcomingEvents({ category: "Music", limit: 100 }));
    assert.ok(t.includes("Legacy Gig") && t.includes("Future Gig") && t.includes("RIFFMAS 2026"));
    assert.ok(!t.includes("Legacy Kids Party") && !t.includes("Art in Nature"), "unrelated categories stay separate");
  });
  test("an old link using the legacy name behaves the same", async () => {
    const a = titles(await events.getUpcomingEvents({ category: "Music & Gigs", limit: 100 }));
    const b = titles(await events.getUpcomingEvents({ category: "Music", limit: 100 }));
    assert.deepEqual(a, b);
  });
  test("an unknown category does not crash and matches only itself", async () => {
    assert.deepEqual(titles(await events.getUpcomingEvents({ category: "Zzz Mystery", limit: 100 })), ["Odd Category"]);
    assert.deepEqual(await events.getUpcomingEvents({ category: "Never Heard Of It", limit: 100 }), []);
  });
});
