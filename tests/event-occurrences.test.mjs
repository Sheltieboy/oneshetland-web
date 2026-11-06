/**
 * Occurrence library: run state, next performance, listing cards, homepage selection, calendar entries. Pure; no network.
 * Run: node --test --import ./tests/support/register.mjs tests/event-occurrences.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { displayOccurrences, nextOccurrence, liveOccurrence, runState, isUpcomingLike, listingCard, homepageSelect, calendarEntries, coveredDays } from "../lib/event-occurrences.ts";
import { eventState } from "../lib/event-state.ts";

const at = (s) => Date.parse(s);
const occ = (starts, ends, extra = {}) => ({ starts_at: starts, ends_at: ends ?? null, status: "scheduled", ...extra });
const EV = (id, extra = {}) => ({ id, title: `Show ${id}`, starts_at: "2026-12-01T19:00:00Z", ends_at: "2026-12-31T21:00:00Z", status: "published", is_dated_run: true, ...extra });

describe("display and next", () => {
  test("sorted soonest first, cancelled kept, unreadable dropped, input not mutated", () => {
    const input = [occ("2026-12-10T19:00:00Z"), occ("2026-12-05T19:00:00Z", null, { status: "cancelled" }), occ("garbage")];
    const out = displayOccurrences(input);
    assert.deepEqual(out.map((o) => o.starts_at), ["2026-12-05T19:00:00Z", "2026-12-10T19:00:00Z"]);
    assert.equal(input[0].starts_at, "2026-12-10T19:00:00Z");
    assert.deepEqual(displayOccurrences(null), []);
  });
  test("next ignores cancelled and past performances", () => {
    const list = [occ("2026-12-01T19:00:00Z"), occ("2026-12-08T19:00:00Z", null, { status: "cancelled" }), occ("2026-12-09T19:00:00Z")];
    assert.equal(nextOccurrence(list, at("2026-12-02T10:00:00Z")).starts_at, "2026-12-09T19:00:00Z");
    assert.equal(nextOccurrence(list, at("2026-12-10T10:00:00Z")), null);
  });
  test("a performance starting exactly now is still next", () => assert.equal(nextOccurrence([occ("2026-12-02T10:00:00Z")], at("2026-12-02T10:00:00Z")).starts_at, "2026-12-02T10:00:00Z"));
});

describe("runState", () => {
  const list = [occ("2026-12-05T19:00:00Z", "2026-12-05T21:00:00Z"), occ("2026-12-12T19:00:00Z", "2026-12-12T21:00:00Z"), occ("2026-12-19T19:00:00Z", "2026-12-19T21:00:00Z")];
  const e = EV("a");
  test("before the first performance: upcoming", () => assert.equal(runState(e, list, at("2026-12-01T10:00:00Z")), "upcoming"));
  test("inside a performance window: live", () => assert.equal(runState(e, list, at("2026-12-12T20:00:00Z")), "live"));
  test("between performances: BETWEEN, upcoming-like, never ongoing, with a next date", () => {
    const now = at("2026-12-08T12:00:00Z");
    const s = runState(e, list, now);
    assert.equal(s, "between"); assert.ok(isUpcomingLike(s)); assert.notEqual(s, "ongoing");
    assert.equal(nextOccurrence(list, now).starts_at, "2026-12-12T19:00:00Z");
    const card = listingCard(e, list, now);
    assert.equal(card.state, "between"); assert.equal(card.nextStartsAt, "2026-12-12T19:00:00Z");
  });
  test("after the last performance: finished", () => assert.equal(runState(e, list, at("2026-12-20T00:00:00Z")), "finished"));
  test("past performances do not hide future ones", () => assert.equal(runState(e, list, at("2026-12-18T00:00:00Z")), "between"));
  test("a performance with no end time is over once it starts", () => assert.equal(runState(e, [occ("2026-12-05T19:00:00Z")], at("2026-12-05T19:30:00Z")), "finished"));
  test("one cancelled performance is skipped, the run goes on", () => {
    const l = [list[0], { ...list[1], status: "cancelled" }, list[2]];
    assert.equal(nextOccurrence(l, at("2026-12-08T12:00:00Z")).starts_at, "2026-12-19T19:00:00Z");
    assert.equal(runState(e, l, at("2026-12-12T20:00:00Z")), "between");   // the cancelled one is not "live"
    assert.equal(displayOccurrences(l).length, 3);
  });
  test("all performances cancelled: the run is cancelled, with no next date", () => {
    const l = list.map((o) => ({ ...o, status: "cancelled" }));
    assert.equal(runState(e, l, at("2026-12-01T00:00:00Z")), "cancelled");
    const c = listingCard(e, l, at("2026-12-01T00:00:00Z"));
    assert.equal(c.nextStartsAt, null); assert.equal(c.label, null); assert.equal(c.performances, 0);
  });
  test("a changed performance counts as a performance", () => assert.equal(runState(e, [{ ...list[0], status: "changed" }], at("2026-12-01T00:00:00Z")), "upcoming"));
  test("NO occurrences: identical to eventState for many instants", () => {
    const ev = { id: "x", starts_at: "2026-12-04T19:00:00Z", ends_at: "2026-12-06T23:59:00Z" };
    for (const t of ["2026-12-01T00:00:00Z", "2026-12-04T19:00:00Z", "2026-12-05T12:00:00Z", "2026-12-07T00:00:00Z"]) {
      assert.equal(runState(ev, [], at(t)), eventState(ev, at(t)));
      assert.equal(runState(ev, undefined, at(t)), eventState(ev, at(t)));
    }
    assert.equal(runState(ev, [], at("2026-12-05T12:00:00Z")), "ongoing");   // an ordinary exhibition is still ongoing
  });
  test("liveOccurrence finds only the running, non-cancelled one", () => {
    assert.equal(liveOccurrence(list, at("2026-12-12T20:00:00Z")).starts_at, "2026-12-12T19:00:00Z");
    assert.equal(liveOccurrence([{ ...list[1], status: "cancelled" }], at("2026-12-12T20:00:00Z")), null);
  });
});

describe("listing card", () => {
  test("Next: date · N performances, counting non-cancelled", () => {
    const l = [occ("2026-12-05T19:00:00Z"), occ("2026-12-12T19:00:00Z"), occ("2026-12-19T19:00:00Z", null, { status: "cancelled" })];
    const c = listingCard(EV("p"), l, at("2026-12-01T00:00:00Z"));
    assert.equal(c.label, "Next: Sat 5 Dec · 2 performances"); assert.equal(c.href, "/whats-on/p"); assert.equal(c.remaining, 2);
  });
  test("a single performance has no count; an ordinary event has no label", () => {
    assert.equal(listingCard(EV("q"), [occ("2026-12-05T19:00:00Z")], at("2026-12-01T00:00:00Z")).label, "Next: Sat 5 Dec");
    const o = listingCard({ id: "z", title: "Z", starts_at: "2026-12-05T19:00:00Z" }, [], at("2026-12-01T00:00:00Z"));
    assert.equal(o.label, null); assert.equal(o.nextStartsAt, "2026-12-05T19:00:00Z");
  });
  test("the date uses Shetland time (a 00:30 BST performance is the next day)", () => {
    const c = listingCard(EV("t"), [occ("2027-06-01T23:30:00Z"), occ("2027-06-02T23:30:00Z")], at("2027-05-01T00:00:00Z"));
    assert.match(c.label, /Wed 2 Jun/);
  });
});

describe("homepageSelect", () => {
  const NOW = at("2026-12-01T00:00:00Z");
  const card = (id, start, extra = {}) => listingCard(EV(id, extra), [occ(start)], NOW);
  test("featured first, then soonest; defaults to 7", () => {
    const cards = [card("c", "2026-12-09T19:00:00Z"), card("a", "2026-12-03T19:00:00Z"), card("f", "2026-12-20T19:00:00Z", { is_featured: true }), card("b", "2026-12-04T19:00:00Z")];
    assert.deepEqual(homepageSelect(cards).map((c) => c.eventId), ["f", "a", "b", "c"]);
    const many = Array.from({ length: 12 }, (_, i) => card(`m${i}`, `2026-12-${String(2 + i).padStart(2, "0")}T19:00:00Z`));
    assert.equal(homepageSelect(many).length, 7);
  });
  test("per-organiser cap of 2, but other organisers still fill the slots", () => {
    const cards = [1, 2, 3, 4].map((i) => card(`h${i}`, `2026-12-0${i + 1}T19:00:00Z`, { organiser_name: "Lerwick Drama" })).concat([card("o", "2026-12-15T19:00:00Z", { organiser_name: "Other" })]);
    assert.deepEqual(homepageSelect(cards).map((c) => c.eventId), ["h1", "h2", "o"]);
  });
  test("a production never fills several slots, even if passed twice", () => {
    const c = card("dup", "2026-12-03T19:00:00Z");
    assert.deepEqual(homepageSelect([c, c, { ...c }]).map((x) => x.eventId), ["dup"]);
  });
  test("finished, cancelled and already-ongoing ordinary events take no slot; between does", () => {
    const fin = listingCard(EV("fin"), [occ("2026-11-01T19:00:00Z", "2026-11-01T21:00:00Z")], NOW);
    const canc = listingCard(EV("can"), [occ("2026-12-03T19:00:00Z", null, { status: "cancelled" })], NOW);
    const og = listingCard({ id: "og", title: "Expo", starts_at: "2026-10-01T10:00:00Z", ends_at: "2027-01-01T10:00:00Z" }, [], NOW);
    const btw = listingCard(EV("btw"), [occ("2026-11-20T19:00:00Z", "2026-11-20T21:00:00Z"), occ("2026-12-10T19:00:00Z")], NOW);
    assert.deepEqual(homepageSelect([fin, canc, og, btw]).map((c) => c.eventId), ["btw"]);
  });
  test("15-performance pantomime across December appears ONCE on the homepage among other events", () => {
    const days = [5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 23, 24, 27];
    const pantoOcc = days.map((d) => occ(`2026-12-${String(d).padStart(2, "0")}T19:00:00Z`, `2026-12-${String(d).padStart(2, "0")}T21:00:00Z`));
    const panto = listingCard(EV("panto", { organiser_name: "Drama Club" }), pantoOcc, NOW);
    const others = [card("x1", "2026-12-07T19:00:00Z"), card("x2", "2026-12-08T19:00:00Z")];
    const sel = homepageSelect([panto, ...others]);
    assert.equal(sel.filter((c) => c.eventId === "panto").length, 1);
    assert.equal(panto.performances, 15); assert.equal(panto.label, "Next: Sat 5 Dec · 15 performances");
  });
});

describe("calendar", () => {
  const DEC = { year: 2026, month: 12 };
  test("15-performance pantomime lands on its 15 correct dates, each linking to the parent", () => {
    const days = [5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 23, 24, 27];
    const ev = EV("panto");
    const os = days.map((d, i) => ({ id: `o${i}`, event_id: "panto", ...occ(`2026-12-${String(d).padStart(2, "0")}T19:30:00Z`, `2026-12-${String(d).padStart(2, "0")}T21:30:00Z`) }));
    const out = calendarEntries([ev], os, DEC);
    assert.deepEqual(out.map((x) => x.date), days.map((d) => `2026-12-${String(d).padStart(2, "0")}`));
    assert.ok(out.every((x) => x.href === "/whats-on/panto" && x.eventId === "panto"));
    assert.equal(calendarEntries([ev], os, { year: 2026, month: 11 }).length, 0);
  });
  test("two performances in one day give two entries on that day, in time order", () => {
    const os = [{ event_id: "a", ...occ("2026-12-12T18:00:00Z", "2026-12-12T20:00:00Z") }, { event_id: "a", ...occ("2026-12-12T13:00:00Z", "2026-12-12T15:00:00Z") }];
    const out = calendarEntries([EV("a")], os, DEC);
    assert.equal(out.length, 2); assert.deepEqual(out.map((x) => x.starts_at), ["2026-12-12T13:00:00Z", "2026-12-12T18:00:00Z"]);
  });
  test("a performance crossing midnight sits on the day it starts", () => {
    const out = calendarEntries([EV("a")], [{ event_id: "a", ...occ("2026-12-12T22:00:00Z", "2026-12-13T01:00:00Z") }], DEC);
    assert.deepEqual(out.map((x) => x.date), ["2026-12-12"]);
    assert.deepEqual(coveredDays("2026-12-12T22:00:00Z", "2026-12-13T00:00:00Z"), ["2026-12-12"]);
  });
  test("a multi-day single span is on every day it covers (event without occurrences)", () => {
    const ev = { id: "fest", title: "Fest", starts_at: "2026-12-04T19:00:00Z", ends_at: "2026-12-06T22:00:00Z" };
    assert.deepEqual(calendarEntries([ev], [], DEC).map((x) => x.date), ["2026-12-04", "2026-12-05", "2026-12-06"]);
  });
  test("a span crossing a month end only shows the days inside the asked month", () => {
    const ev = { id: "fest", title: "Fest", starts_at: "2026-11-29T10:00:00Z", ends_at: "2026-12-02T10:00:00Z" };
    assert.deepEqual(calendarEntries([ev], [], DEC).map((x) => x.date), ["2026-12-01", "2026-12-02"]);
    assert.deepEqual(calendarEntries([ev], [], { year: 2026, month: 11 }).map((x) => x.date), ["2026-11-29", "2026-11-30"]);
  });
  test("cancelled performance stays on the calendar, flagged", () => {
    const out = calendarEntries([EV("a")], [{ event_id: "a", ...occ("2026-12-12T19:00:00Z", null, { status: "cancelled" }) }, { event_id: "a", ...occ("2026-12-13T19:00:00Z") }], DEC);
    assert.deepEqual(out.map((x) => x.cancelled), [true, false]);
  });
  test("occurrences of other events do not leak in; rows with no event are ignored", () => {
    const ev = EV("a", { starts_at: "2026-12-20T19:00:00Z", ends_at: "2026-12-20T21:00:00Z" });
    const out = calendarEntries([ev], [{ event_id: "b", ...occ("2026-12-12T19:00:00Z") }, occ("2026-12-13T19:00:00Z")], DEC);
    assert.deepEqual(out.map((x) => x.date), ["2026-12-20"]);   // a has no performances of its own: its own window
  });
});

describe("Europe/London day boundaries and clock changes", () => {
  test("spring forward (28 Mar 2027): 23:30 GMT on the 27th, and 23:30Z on the 28th = 00:30 BST on the 29th", () => {
    const os = [{ event_id: "a", ...occ("2027-03-27T23:30:00Z") }, { event_id: "a", ...occ("2027-03-28T00:30:00Z") }, { event_id: "a", ...occ("2027-03-28T23:30:00Z") }];
    assert.deepEqual(calendarEntries([EV("a")], os, { year: 2027, month: 3 }).map((x) => x.date), ["2027-03-27", "2027-03-28", "2027-03-29"]);
  });
  test("autumn back (25 Oct 2026): 23:30Z on the 24th = 00:30 BST on the 25th; 23:30Z on the 25th = 23:30 GMT still the 25th", () => {
    const os = [{ event_id: "a", ...occ("2026-10-24T23:30:00Z") }, { event_id: "a", ...occ("2026-10-25T23:30:00Z") }];
    assert.deepEqual(calendarEntries([EV("a")], os, { year: 2026, month: 10 }).map((x) => x.date), ["2026-10-25", "2026-10-25"]);
  });
  test("a 25-hour day (25 Oct) span is one calendar day", () => assert.deepEqual(coveredDays("2026-10-25T00:00:00Z", "2026-10-25T23:00:00Z"), ["2026-10-25"]));
  test("summer date labels use BST", () => assert.equal(coveredDays("2027-07-01T23:30:00Z")[0], "2027-07-02"));
});
