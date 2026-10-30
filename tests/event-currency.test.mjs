/**
 * Stage 4A.5A — the pure rules: what counts as a current event, Shetland-time boundaries, the category
 * mapping, and the planner treating a running event as a flexible stop.
 *
 * Run: node --test --import ./tests/support/register.mjs tests/event-currency.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isCurrentEvent, isOngoingEvent, currentEventsFilter, overlapsWindow, overlapsWindowFilter,
  compareCurrentEvents, londonRangeEnd, isOnToday, londonDayKey,
} from "../lib/event-currency.ts";
import {
  normaliseCategory, storedValuesFor, sameCategory, uniqueCategories, LEGACY_CATEGORY_MAP, CURRENT_EVENT_CATEGORIES,
} from "../lib/event-categories.ts";
import { buildPlan, LERWICK } from "../lib/planner.ts";

const at = (s) => Date.parse(s);

describe("current = not finished", () => {
  const NOW = at("2026-12-05T12:00:00Z");
  test("the nine scenarios", () => {
    assert.equal(isCurrentEvent({ starts_at: "2026-12-12T19:00:00Z", ends_at: "2026-12-12T22:00:00Z" }, NOW), true, "future");
    assert.equal(isCurrentEvent({ starts_at: "2026-12-05T11:00:00Z", ends_at: "2026-12-05T14:00:00Z" }, NOW), true, "in progress");
    assert.equal(isCurrentEvent({ starts_at: "2026-11-28T19:00:00Z", ends_at: "2026-11-28T22:00:00Z" }, NOW), false, "finished");
    assert.equal(isCurrentEvent({ starts_at: "2026-12-04T19:00:00Z", ends_at: "2026-12-06T23:59:00Z" }, NOW), true, "RIFFMAS day 2");
    assert.equal(isCurrentEvent({ starts_at: "2026-10-24T09:00:00Z", ends_at: "2026-12-20T17:00:00Z" }, NOW), true, "six-week exhibition");
    assert.equal(isCurrentEvent({ starts_at: "2026-12-06T10:00:00Z", ends_at: null }, NOW), true, "no end, still to come");
    assert.equal(isCurrentEvent({ starts_at: "2026-12-05T09:00:00Z", ends_at: null }, NOW), false, "no end, already started -> not invented as ongoing");
    assert.equal(isCurrentEvent({ starts_at: "2026-12-01T10:00:00Z" }, NOW), false, "old one-day event never returns");
  });
  test("boundaries are inclusive at the end instant and exclusive of the past", () => {
    const e = { starts_at: "2026-12-05T10:00:00Z", ends_at: "2026-12-05T12:00:00Z" };
    assert.equal(isCurrentEvent(e, at("2026-12-05T12:00:00Z")), true);
    assert.equal(isCurrentEvent(e, at("2026-12-05T12:00:00.001Z")), false);
  });
  test("RIFFMAS: on day 1, 2 and 3; gone on day 4 (end 23:59 on the 6th)", () => {
    const r = { starts_at: "2026-12-04T19:00:00Z", ends_at: "2026-12-06T23:59:00Z" };
    for (const t of ["2026-12-04T20:00:00Z", "2026-12-05T12:00:00Z", "2026-12-06T23:30:00Z"]) assert.equal(isCurrentEvent(r, at(t)), true, t);
    assert.equal(isCurrentEvent(r, at("2026-12-07T00:00:00Z")), false);
    assert.equal(isOngoingEvent(r, at("2026-12-05T12:00:00Z")), true);
    assert.equal(isOngoingEvent(r, at("2026-12-03T12:00:00Z")), false, "not started yet is upcoming, not ongoing");
  });
  test("junk dates never throw or leak in", () => {
    assert.equal(isCurrentEvent({ starts_at: "not a date", ends_at: null }, NOW), false);
    assert.equal(isCurrentEvent({ starts_at: "", ends_at: "" }, NOW), false);
  });
  test("the PostgREST filter is the same rule", () => {
    assert.equal(currentEventsFilter("T"), "ends_at.gte.T,and(ends_at.is.null,starts_at.gte.T)");
  });
  test("ordering: start time, ties on id", () => {
    const l = [{ id: "b", starts_at: "2026-12-06T10:00:00Z" }, { id: "a", starts_at: "2026-12-06T10:00:00Z" }, { id: "z", starts_at: "2026-10-01T10:00:00Z" }];
    assert.deepEqual(l.sort(compareCurrentEvents).map((x) => x.id), ["z", "a", "b"]);
  });
});

describe("window overlap (planner)", () => {
  const from = "2026-12-05T09:00:00Z", to = "2026-12-05T18:00:00Z";
  test("began before the window and still running -> in; finished before -> out; starts inside -> in; starts after -> out", () => {
    assert.equal(overlapsWindow({ starts_at: "2026-12-04T19:00:00Z", ends_at: "2026-12-06T23:59:00Z" }, from, to), true);
    assert.equal(overlapsWindow({ starts_at: "2026-12-01T19:00:00Z", ends_at: "2026-12-02T23:59:00Z" }, from, to), false);
    assert.equal(overlapsWindow({ starts_at: "2026-12-05T11:00:00Z", ends_at: null }, from, to), true);
    assert.equal(overlapsWindow({ starts_at: "2026-12-05T07:00:00Z", ends_at: null }, from, to), false, "no end, started before window");
    assert.equal(overlapsWindow({ starts_at: "2026-12-05T19:00:00Z", ends_at: "2026-12-05T21:00:00Z" }, from, to), false);
  });
  test("filter string", () => {
    assert.match(overlapsWindowFilter("F", "T"), /^and\(starts_at\.lte\.T,ends_at\.gte\.F\),and\(ends_at\.is\.null,starts_at\.gte\.F,starts_at\.lte\.T\)$/);
  });
});

describe("Shetland time, not the server's clock", () => {
  test("'today' ends at Lerwick midnight — GMT winter", () => {
    assert.equal(londonRangeEnd("today", at("2026-12-05T12:00:00Z")), "2026-12-05T23:59:59.999Z");
  });
  test("'today' ends at Lerwick midnight — BST summer (an hour before UTC midnight)", () => {
    assert.equal(londonRangeEnd("today", at("2026-07-15T12:00:00Z")), "2026-07-15T22:59:59.999Z");
  });
  test("just after midnight BST is already the NEXT Shetland day (the case a UTC server got wrong)", () => {
    const justAfterMidnightBST = at("2026-07-15T23:30:00Z"); // 00:30 on 16 July in Lerwick
    assert.equal(londonDayKey(justAfterMidnightBST), "2026-07-16");
    assert.equal(londonRangeEnd("today", justAfterMidnightBST), "2026-07-16T22:59:59.999Z");
  });
  test("week = through Sunday; month = through the last day; clock-change days are 23/25 hours", () => {
    assert.equal(londonRangeEnd("week", at("2026-12-05T12:00:00Z")), "2026-12-06T23:59:59.999Z"); // Sat -> Sun
    assert.equal(londonRangeEnd("week", at("2026-12-06T12:00:00Z")), "2026-12-06T23:59:59.999Z"); // Sun -> same Sun
    assert.equal(londonRangeEnd("month", at("2026-12-05T12:00:00Z")), "2026-12-31T23:59:59.999Z");
    assert.equal(londonRangeEnd("month", at("2026-10-10T12:00:00Z")), "2026-10-31T23:59:59.999Z"); // BST ended 25 Oct -> GMT by 31 Oct
    assert.equal(londonRangeEnd("today", at("2026-03-29T12:00:00Z")), "2026-03-29T22:59:59.999Z"); // clocks went forward that day
    assert.equal(londonRangeEnd("today", at("2026-10-25T12:00:00Z")), "2026-10-25T23:59:59.999Z"); // and back
    assert.equal(londonRangeEnd("all", at("2026-12-05T12:00:00Z")), undefined);
  });
  test("'on today': a festival in its second day counts; tomorrow's event does not; a finished one does not", () => {
    const now = at("2026-12-05T12:00:00Z");
    assert.equal(isOnToday({ starts_at: "2026-12-04T19:00:00Z", ends_at: "2026-12-06T23:59:00Z" }, now), true);
    assert.equal(isOnToday({ starts_at: "2026-12-05T19:00:00Z", ends_at: null }, now), true);
    assert.equal(isOnToday({ starts_at: "2026-12-06T10:00:00Z", ends_at: null }, now), false);
    assert.equal(isOnToday({ starts_at: "2026-12-05T08:00:00Z", ends_at: "2026-12-05T10:00:00Z" }, now), false);
  });
  test("an event that crosses midnight stays current after midnight", () => {
    const e = { starts_at: "2026-12-05T20:00:00Z", ends_at: "2026-12-06T01:00:00Z" };
    assert.equal(isCurrentEvent(e, at("2026-12-06T00:30:00Z")), true);
    assert.equal(isOnToday(e, at("2026-12-06T00:30:00Z")), true);
  });
});

describe("categories: the exact legacy -> current mapping, derived from production", () => {
  test("the mapping table (golden)", () => {
    assert.deepEqual(LEGACY_CATEGORY_MAP, {
      "Art & Exhibitions": "Arts & Culture", "Charity & Community": "Community", "Cinema": "Arts & Culture",
      "Comedy": "Arts & Culture", "Family & Kids": "Family", "Festivals & Celebrations": "Festival",
      "Heritage & Culture": "Arts & Culture", "Literature": "Arts & Culture", "Music & Gigs": "Music",
      "Sports & Outdoors": "Sport", "Theatre": "Arts & Culture",
    });
    for (const v of Object.values(LEGACY_CATEGORY_MAP)) assert.ok(CURRENT_EVENT_CATEGORIES.includes(v), `${v} must be a current category`);
  });
  test("the 12 current categories match the event form's list", () => {
    const src = readFileSync(new URL("../lib/events-data.ts", import.meta.url), "utf8");
    const form = [...src.slice(src.indexOf("export const EVENT_CATEGORIES"), src.indexOf("] as const")).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...CURRENT_EVENT_CATEGORIES], form);
  });
  test("legacy and current equivalents are one logical category", () => {
    assert.equal(normaliseCategory("Music & Gigs"), "Music");
    assert.equal(normaliseCategory("Music"), "Music");
    assert.equal(sameCategory("Music & Gigs", "Music"), true);
    assert.equal(sameCategory("Music", "Sport"), false);
    assert.deepEqual(uniqueCategories(["Music", "Music & Gigs", "music", null, "", "Family & Kids", "Family"]), ["Family", "Music"]);
  });
  test("choosing a current category matches every stored spelling; unrelated stay apart", () => {
    assert.deepEqual(storedValuesFor("Music").sort(), ["Music", "Music & Gigs"]);
    assert.deepEqual(storedValuesFor("Arts & Culture").sort(), ["Art & Exhibitions", "Arts & Culture", "Cinema", "Comedy", "Heritage & Culture", "Literature", "Theatre"]);
    assert.deepEqual(storedValuesFor("Music & Gigs").sort(), ["Music", "Music & Gigs"], "a legacy name resolves to the same set");
    assert.ok(!storedValuesFor("Music").includes("Sports & Outdoors"));
  });
  test("unknown / empty / weird input never throws and is not silently bucketed", () => {
    assert.equal(normaliseCategory("Zzz Mystery"), "Zzz Mystery");
    assert.deepEqual(storedValuesFor("Zzz Mystery"), ["Zzz Mystery"]);
    for (const v of [null, undefined, "", "   ", 42, {}, []]) { assert.equal(normaliseCategory(v), null); assert.deepEqual(storedValuesFor(v), []); }
    assert.equal(sameCategory(null, null), false);
  });
});

describe("planner: a running event is a flexible stop, not a missing one", () => {
  const start = new Date("2026-12-05T09:00:00Z"), end = new Date("2026-12-05T17:00:00Z");
  const ev = (id, s, e, extra = {}) => ({ id, kind: "event", name: id, blurb: null, lat: 60.157, lng: -1.15, href: "/", image: null, startsAt: s, endsAt: e, interests: ["history"], ...extra });
  const names = (p) => p.stops.map((s) => s.candidate.name);
  test("an exhibition that started weeks ago and is still on is planned", () => {
    const p = buildPlan({ candidates: [ev("exhibition", "2026-10-24T09:00:00Z", "2026-12-20T17:00:00Z")], start, end, transport: "walking", interests: [] });
    assert.ok(names(p).includes("exhibition"), JSON.stringify(p.skipped));
  });
  test("a festival already in its second day is planned; a finished one is not", () => {
    const p = buildPlan({ candidates: [ev("festival", "2026-12-04T19:00:00Z", "2026-12-06T23:59:00Z"), ev("over", "2026-12-01T19:00:00Z", "2026-12-02T23:59:00Z")], start, end, transport: "walking", interests: [] });
    assert.ok(names(p).includes("festival"));
    assert.ok(!names(p).includes("over"));
  });
  test("an event that starts inside the window is still pinned at its start time", () => {
    const p = buildPlan({ candidates: [ev("gig", "2026-12-05T13:00:00Z", "2026-12-05T15:00:00Z")], start, end, transport: "walking", interests: [] });
    const s = p.stops.find((x) => x.candidate.name === "gig");
    assert.ok(s && s.arrive.getTime() >= Date.parse("2026-12-05T13:00:00Z"));
  });
  test("a running event that ends before you could get there is skipped, not scheduled", () => {
    const p = buildPlan({ candidates: [ev("ends-soon", "2026-12-01T09:00:00Z", "2026-12-05T09:05:00Z", { lat: 60.40, lng: -1.2 })], start, end, transport: "walking", interests: [] });
    assert.ok(!names(p).includes("ends-soon"));
  });
});
