/**
 * Phase 2A loaders against the in-memory fake: old schema (columns / table absent) and new schema, runs, paging, calendar, homepage,
 * organiser rule. Run: node --test --import ./tests/support/register.mjs tests/events-phase2a-loaders.test.mjs
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setDb, setViewer } from "./support/fake-supabase.mjs";
import { getUpcomingEvents, getEventsInMonth, getEvent, getEventCategories } from "../lib/events-data.ts";
import { getHomeData } from "../lib/home-data.ts";
import { selectTolerant, isSchemaMissing } from "../lib/events-schema.ts";
import { eventOrganiser } from "../lib/event-organiser.ts";

const H = 3600_000, D = 24 * H;
const iso = (ms) => new Date(ms).toISOString();
const NOW = Date.now();
const OLD_SCHEMA = (_t, cols) => (/occurrences|organiser_name|is_dated_run/.test(cols) ? { code: "42703", message: "column events.organiser_name does not exist" } : null);

let seq = 0;
const ev = (o = {}) => ({
  id: o.id ?? `e${++seq}`, title: o.title ?? `Event ${seq}`, category: "Music", status: "published", is_hidden: false, venue: "Mareel", locality: "Lerwick",
  starts_at: iso(NOW + 5 * D), ends_at: null, cover_url: null, price_text: null, has_tickets: false, is_featured: false,
  organiser_hub_id: null, organiser_business_id: null, calendar_approved: true, business: null, hub: null, ticket_types: [],
  ...o,
});
// A month in the future so every performance is in one calendar month: the 5th to the 19th of NEXT month at 19:00 UTC (20:00 BST / 19:00 GMT: same London day).
const nm = new Date(NOW); nm.setUTCDate(1); nm.setUTCMonth(nm.getUTCMonth() + 1);
const Y = nm.getUTCFullYear(), M0 = nm.getUTCMonth();
const perf = (day, extra = {}) => ({ id: `o${day}`, starts_at: iso(Date.UTC(Y, M0, day, 19)), ends_at: iso(Date.UTC(Y, M0, day, 21)), status: "scheduled", venue: null, locality: null, note: null, ...extra });
const panto = (extra = {}, perfs) => {
  const occ = perfs ?? Array.from({ length: 15 }, (_, i) => perf(5 + i));
  return ev({ id: "panto", title: "Cinderella", category: "Theatre & Performing Arts", starts_at: occ[0].starts_at, ends_at: occ[occ.length - 1].ends_at, is_dated_run: true,
    organiser_name: "Lerwick Drama Club", source: "community_submission", occurrences: occ, ...extra });
};
const ids = (l) => l.map((e) => e.id);

beforeEach(() => { setViewer("anon"); globalThis.__FAKE_SELECT_GUARD__ = undefined; globalThis.__FAKE_RPC__ = undefined; });

describe("schema tolerance", () => {
  test("which errors mean 'schema missing'", () => {
    for (const code of ["42703", "42P01", "PGRST204", "PGRST205", "PGRST200"]) assert.ok(isSchemaMissing({ code }), code);
    assert.ok(isSchemaMissing({ message: "Could not find a relationship between 'events' and 'event_occurrences'" }));
    assert.ok(!isSchemaMissing({ code: "42501", message: "permission denied" }));
    assert.ok(!isSchemaMissing(null));
  });
  test("a permission error is NOT retried as an old schema", async () => {
    let calls = 0;
    const r = await selectTolerant(async () => { calls++; return { data: null, error: { code: "42501", message: "permission denied" } }; });
    assert.equal(calls, 1); assert.equal(r.modern, true); assert.equal(r.data, null);
  });
  test("missing column: legacy select runs once, modern=false", async () => {
    const seen = [];
    const r = await selectTolerant(async (extra) => { seen.push(extra); return extra ? { data: null, error: { code: "42703" } } : { data: [{ id: 1 }], error: null }; });
    assert.equal(r.modern, false); assert.deepEqual(r.data, [{ id: 1 }]); assert.equal(seen.length, 2); assert.equal(seen[1], "");
  });
  test("nothing is remembered: the same loader sees the migration the moment it happens", async () => {
    setDb({ events: [ev({ id: "a" })] });
    globalThis.__FAKE_SELECT_GUARD__ = OLD_SCHEMA;
    assert.deepEqual(ids(await getUpcomingEvents()), ["a"]);
    globalThis.__FAKE_SELECT_GUARD__ = undefined;
    setDb({ events: [ev({ id: "a" }), panto()] });
    assert.ok(ids(await getUpcomingEvents()).includes("panto"));
  });
});

describe("What's On list", () => {
  const ordinary = () => [
    ev({ id: "a", starts_at: iso(NOW + 1 * D) }), ev({ id: "b", starts_at: iso(NOW + 2 * D), category: "Music & Gigs" }),
    ev({ id: "c", starts_at: iso(NOW + 3 * D), category: "Sport" }),
    ev({ id: "expo", title: "Exhibition", starts_at: iso(NOW - 20 * D), ends_at: iso(NOW + 20 * D), category: "Arts & Culture" }),
  ];
  test("events without performances: new schema gives the same rows, order, filters and pages as the old schema", async () => {
    setDb({ events: ordinary() });
    const queries = [{}, { category: "Music" }, { range: "week" }, { upcomingOnly: true }, { limit: 2 }, { limit: 2, offset: 2 }, { category: "Sport", range: "all" }];
    for (const q of queries) {
      globalThis.__FAKE_SELECT_GUARD__ = OLD_SCHEMA; const old = await getUpcomingEvents(q);
      globalThis.__FAKE_SELECT_GUARD__ = undefined; const neu = await getUpcomingEvents(q);
      assert.deepEqual(ids(neu), ids(old), JSON.stringify(q));
      for (let i = 0; i < old.length; i++) { assert.equal(neu[i].starts_at, old[i].starts_at); assert.equal(neu[i].title, old[i].title); assert.ok(!neu[i].run); }
    }
  });
  test("an ongoing exhibition is unchanged: listed in the full list, kept out of upcoming-only strips, on both schemas", async () => {
    setDb({ events: ordinary() });
    for (const g of [OLD_SCHEMA, undefined]) {
      globalThis.__FAKE_SELECT_GUARD__ = g;
      assert.ok(ids(await getUpcomingEvents()).includes("expo"));
      assert.ok(!ids(await getUpcomingEvents({ upcomingOnly: true })).includes("expo"));
    }
  });
  test("a 15-performance run is ONE card dated by its next performance, with the label", async () => {
    setDb({ events: [...ordinary(), panto()] });
    const list = await getUpcomingEvents();
    assert.equal(list.filter((e) => e.id === "panto").length, 1);
    const p = list.find((e) => e.id === "panto");
    assert.equal(p.starts_at, perf(5).starts_at); assert.equal(p.ends_at, perf(5).ends_at);
    assert.match(p.run.label, /^Next: .* · 15 performances$/);
    assert.equal(p.occurrences, undefined);
    assert.equal(p.run.state, "upcoming");
  });
  test("between performances it is dated by the NEXT one, never 'ongoing'", async () => {
    const occ = [perf(5, { starts_at: iso(NOW - 3 * D), ends_at: iso(NOW - 3 * D + 2 * H) }), perf(6, { starts_at: iso(NOW + 2 * D), ends_at: iso(NOW + 2 * D + 2 * H) })];
    setDb({ events: [panto({ starts_at: occ[0].starts_at, ends_at: occ[1].ends_at }, occ)] });
    const [p] = await getUpcomingEvents();
    assert.equal(p.starts_at, occ[1].starts_at); assert.equal(p.run.state, "between");
    assert.equal(p.run.live, false);
  });
  test("date filter matches performances, not the parent span", async () => {
    const occ = [perf(5), perf(19)];   // next month: far outside 'today' and 'week'
    setDb({ events: [panto({}, occ)] });
    assert.deepEqual(ids(await getUpcomingEvents({ range: "today" })), []);
    assert.deepEqual(ids(await getUpcomingEvents({ range: "week" })), []);
    assert.deepEqual(ids(await getUpcomingEvents({ range: "all" })), ["panto"]);
    // a run that began earlier and has a performance within the next hours is in 'month'/'all' by that performance
    const soon = [{ ...perf(5), id: "s1", starts_at: iso(NOW - 2 * D), ends_at: iso(NOW - 2 * D + 2 * H) }, { ...perf(6), id: "s2", starts_at: iso(NOW + 30 * 60_000), ends_at: iso(NOW + 3 * H) }];
    setDb({ events: [panto({ starts_at: soon[0].starts_at, ends_at: soon[1].ends_at }, soon)] });
    assert.deepEqual(ids(await getUpcomingEvents({ range: "all" })), ["panto"]);
    assert.deepEqual(ids(await getUpcomingEvents({ upcomingOnly: true })), ["panto"], "a run between performances still belongs on upcoming strips");
  });
  test("a finished run and an all-cancelled run leave the list", async () => {
    const past = [perf(5, { starts_at: iso(NOW - 5 * D), ends_at: iso(NOW - 5 * D + 2 * H) }), perf(6, { starts_at: iso(NOW - 4 * D), ends_at: iso(NOW + 1 * H) })];
    const allCancelled = [perf(5, { status: "cancelled" }), perf(6, { status: "cancelled" })];
    setDb({ events: [panto({ id: "fin", starts_at: past[0].starts_at, ends_at: iso(NOW + H) }, past), panto({ id: "cx" }, allCancelled)] });
    assert.deepEqual(ids(await getUpcomingEvents()).filter((i) => i === "cx"), []);
  });
  test("one cancelled performance does not cancel the others; the next date skips it", async () => {
    const occ = [perf(5, { status: "cancelled" }), perf(6), perf(7)];
    setDb({ events: [panto({}, occ)] });
    const [p] = await getUpcomingEvents();
    assert.equal(p.starts_at, perf(6).starts_at); assert.match(p.run.label, /2 performances/);
  });
  test("performance venue overrides the parent's", async () => {
    setDb({ events: [panto({}, [perf(5, { venue: "Brae Hall", locality: "Brae" }), perf(6)])] });
    const [p] = await getUpcomingEvents();
    assert.equal(p.venue, "Brae Hall"); assert.equal(p.locality, "Brae");
  });
  test("PAGING: filtering happens before the 20-row page is cut, a run is never repeated or split, offsets stay contiguous", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ev({ id: `m${String(i).padStart(2, "0")}`, starts_at: iso(NOW + (i + 1) * 6 * H) }));
    // The run's PARENT starts first (tomorrow) but its next performance is next month: by parent start it would be on page 1.
    const run = panto({ id: "run", starts_at: iso(NOW + 1 * H) }, [perf(5), perf(6)]);
    setDb({ events: [...many, run] });
    const p1 = await getUpcomingEvents({ limit: 20 });
    const p2 = await getUpcomingEvents({ limit: 20, offset: 20 });
    assert.equal(p1.length, 20); assert.equal(p2.length, 6);
    const all = [...p1, ...p2];
    assert.equal(new Set(ids(all)).size, 26, "no duplicates, none lost");
    assert.equal(ids(p2).at(-1), "run", "the run sorts by its next performance, so it is last");
    const starts = all.map((e) => Date.parse(e.starts_at));
    assert.deepEqual(starts, [...starts].sort((a, b) => a - b), "chronological across pages");
    // a date range shortens the filtered list BEFORE paging: 'week' pages are full pages of week events
    const w1 = await getUpcomingEvents({ range: "week", limit: 3 }); const w2 = await getUpcomingEvents({ range: "week", limit: 3, offset: 3 });
    assert.equal(w1.length, 3); assert.ok(!ids([...w1, ...w2]).includes("run"));
  });
  test("category filter: ?category=Music still works, legacy Music & Gigs still included", async () => {
    setDb({ events: [ev({ id: "x", category: "Music" }), ev({ id: "y", category: "Music & Gigs" }), ev({ id: "z", category: "Sport" })] });
    for (const g of [OLD_SCHEMA, undefined]) {
      globalThis.__FAKE_SELECT_GUARD__ = g;
      assert.deepEqual(ids(await getUpcomingEvents({ category: "Music" })).sort(), ["x", "y"]);
      assert.deepEqual(ids(await getUpcomingEvents({ category: "Music & Gigs" })).sort(), ["x", "y"]);
    }
  });
  test("Theatre & Performing Arts chip: new events and legacy 'Theatre' share it; Arts & Culture no longer includes legacy Theatre", async () => {
    setDb({ events: [ev({ id: "t1", category: "Theatre & Performing Arts" }), ev({ id: "t2", category: "Theatre" }), ev({ id: "a1", category: "Arts & Culture" })] });
    assert.deepEqual(ids(await getUpcomingEvents({ category: "Theatre & Performing Arts" })).sort(), ["t1", "t2"]);
    assert.deepEqual(ids(await getUpcomingEvents({ category: "Theatre" })).sort(), ["t1", "t2"]);
    assert.deepEqual(ids(await getUpcomingEvents({ category: "Arts & Culture" })), ["a1"]);
    assert.deepEqual(await getEventCategories(), ["Arts & Culture", "Theatre & Performing Arts"]);
  });
});

describe("calendar", () => {
  test("a 15-performance run gives 15 entries, each on its own day; a cancelled one is flagged; ordinary events appear once on their start day", async () => {
    const occ = Array.from({ length: 15 }, (_, i) => perf(5 + i, i === 3 ? { status: "cancelled" } : {}));
    const other = ev({ id: "one", starts_at: iso(Date.UTC(Y, M0, 8, 12)) });
    setDb({ events: [panto({}, occ), other] });
    const items = await getEventsInMonth(Y, M0);
    const mine = items.filter((e) => e.id === "panto");
    assert.equal(mine.length, 15);
    assert.deepEqual(mine.map((e) => e.starts_at.slice(0, 10)), occ.map((o) => o.starts_at.slice(0, 10)));
    assert.deepEqual(mine.filter((e) => e.cancelled).map((e) => e.occurrence_id), ["o8"]);
    assert.equal(items.filter((e) => e.id === "one").length, 1);
    assert.ok(items.every((e) => e.occurrences === undefined));
  });
  test("a run that began last month but has performances this month appears, only for this month's performances", async () => {
    const prev = Date.UTC(Y, M0 - 1, 25, 19);
    const occ = [perf(5, { id: "p0", starts_at: iso(prev), ends_at: iso(prev + 2 * H) }), perf(6), perf(7)];
    setDb({ events: [panto({ starts_at: occ[0].starts_at, ends_at: occ[2].ends_at }, occ)] });
    const items = await getEventsInMonth(Y, M0);
    assert.deepEqual(items.map((e) => e.occurrence_id), ["o6", "o7"]);
  });
  test("old schema: unchanged (events by their own start only)", async () => {
    globalThis.__FAKE_SELECT_GUARD__ = OLD_SCHEMA;
    setDb({ events: [ev({ id: "one", starts_at: iso(Date.UTC(Y, M0, 8, 12)) })] });
    assert.deepEqual(ids(await getEventsInMonth(Y, M0)), ["one"]);
  });
  test("a multi-day ordinary event is still ONE entry on its start day (not spanned)", async () => {
    setDb({ events: [ev({ id: "fest", starts_at: iso(Date.UTC(Y, M0, 8, 12)), ends_at: iso(Date.UTC(Y, M0, 12, 12)) })] });
    assert.equal((await getEventsInMonth(Y, M0)).length, 1);
  });
});

describe("homepage", () => {
  const homeEvents = async () => (await getHomeData({ homepageOnly: true })).events;
  test("old schema: the original query (no per-organiser cap, database order)", async () => {
    globalThis.__FAKE_SELECT_GUARD__ = OLD_SCHEMA;
    setDb({ events: Array.from({ length: 4 }, (_, i) => ev({ id: `h${i}`, starts_at: iso(NOW + (i + 1) * D), organiser_hub_id: "hub1" })) });
    assert.equal((await homeEvents()).length, 4);
  });
  test("new schema: a 15-performance run takes ONE slot dated by its next performance; max 7; organiser capped at 2", async () => {
    const same = Array.from({ length: 4 }, (_, i) => ev({ id: `s${i}`, starts_at: iso(NOW + (i + 1) * D), organiser_name: "Same Club" }));
    const others = Array.from({ length: 8 }, (_, i) => ev({ id: `o${i}`, starts_at: iso(NOW + (i + 1) * D + H), organiser_business_id: `b${i}` }));
    setDb({ events: [...same, ...others, panto()] });
    const out = await homeEvents();
    assert.ok(out.length <= 7);
    assert.equal(out.filter((e) => e.id === "panto").length <= 1, true);
    assert.equal(out.filter((e) => e.id.startsWith("s")).length, 2);
  });
  test("new schema: the run is dated by its next performance and listed once", async () => {
    setDb({ events: [panto()] });
    const out = await homeEvents();
    assert.deepEqual(ids(out), ["panto"]); assert.equal(out[0].starts_at, perf(5).starts_at); assert.ok(out[0].run);
  });
  test("an ordinary event in progress today and finishing today still belongs; an exhibition that began long ago does not", async () => {
    setDb({ events: [ev({ id: "expo", starts_at: iso(NOW - 20 * D), ends_at: iso(NOW + 20 * D) }), ev({ id: "soon", starts_at: iso(NOW + D) })] });
    assert.deepEqual(ids(await homeEvents()), ["soon"]);
  });
  test("featured first", async () => {
    setDb({ events: [ev({ id: "a", starts_at: iso(NOW + D) }), ev({ id: "f", starts_at: iso(NOW + 9 * D), is_featured: true })] });
    assert.deepEqual(ids(await homeEvents()), ["f", "a"]);
  });
});

describe("event detail and organiser rule", () => {
  const detail = async (e) => { setDb({ events: [e] }); return getEvent(e.id); };
  test("old schema: no occurrences, original shape", async () => {
    globalThis.__FAKE_SELECT_GUARD__ = OLD_SCHEMA;
    const d = await detail(ev({ id: "x" }));
    assert.deepEqual(d.occurrences, []);
  });
  test("new schema: performances sorted soonest first, cancelled kept", async () => {
    const d = await detail(panto({}, [perf(7), perf(5, { status: "cancelled" }), perf(6)]));
    assert.deepEqual(d.occurrences.map((o) => o.id), ["o5", "o6", "o7"]); assert.equal(d.occurrences[0].status, "cancelled");
  });
  test("organiser: curated platform event shows none; business shows the business; community shows the group; the explicit marker shows OneShetland", async () => {
    const curated = await detail(ev({ id: "c1", is_platform_event: true }));
    assert.equal(eventOrganiser(curated), null);
    const biz = await detail(ev({ id: "b1", organiser_business_id: "bz", business: { id: "bz", name: "Harry's", logo_url: null } }));
    assert.equal(eventOrganiser(biz).name, "Harry's");
    const com = await detail(ev({ id: "k1", is_platform_event: true, source: "community_submission", organiser_name: "Lerwick Drama Club" }));
    assert.deepEqual([eventOrganiser(com).kind, eventOrganiser(com).name], ["community", "Lerwick Drama Club"]);
    const official = await detail(ev({ id: "o1", is_platform_event: true, source: "oneshetland" }));
    assert.equal(eventOrganiser(official).name, "OneShetland");
  });
  test("list rows carry source and organiser_name so rows follow the same rule; is_platform_event is never selected", async () => {
    setDb({ events: [ev({ id: "k1", is_platform_event: true, source: "community_submission", organiser_name: "Lerwick Drama Club" }), ev({ id: "c1", is_platform_event: true })] });
    const rows = await getUpcomingEvents();
    assert.equal(eventOrganiser(rows.find((r) => r.id === "k1")).name, "Lerwick Drama Club");
    assert.equal(eventOrganiser(rows.find((r) => r.id === "c1")), null);
  });
});

describe("source guard", () => {
  test("no new loader selects or reads is_platform_event", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["lib/events-data.ts", "lib/events-schema.ts", "lib/event-runs.ts", "lib/home-data.ts", "lib/local-data.ts", "app/whats-on/[id]/page.tsx", "components/events/EventsListing.tsx", "components/events/PerformancesList.tsx", "app/api/social-image/route.tsx"])
      assert.ok(!/is_platform_event/.test(readFileSync(new URL(`../${f}`, import.meta.url), "utf8")), f);
  });
});
