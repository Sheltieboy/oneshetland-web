/**
 * The dates builder: London local time -> UTC across the clock changes, validation, copy-to-next-day. Pure.
 * Run: node --test --import ./tests/support/register.mjs tests/event-dates-builder.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { londonToUtc, buildOccurrences, copyRowToNextDay, blankRow, addDays, isRealDate, utcToLondonParts, rowsFromOccurrences, describeOccurrence, MAX_DATES } from "../lib/event-dates-builder.ts";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const row = (date, start, end = "", note = "") => blankRow({ date, start, end, note });

describe("London to UTC", () => {
  test("winter is GMT, summer is BST", () => {
    assert.equal(londonToUtc("2026-12-05", "19:30").iso, "2026-12-05T19:30:00Z");
    assert.equal(londonToUtc("2027-07-10", "19:30").iso, "2027-07-10T18:30:00Z");
  });
  test("spring forward: 29 March 2027 - before 01:00 is GMT, from 02:00 is BST, 01:30 does not exist", () => {
    assert.equal(londonToUtc("2027-03-28", "00:30").iso, "2027-03-28T00:30:00Z");
    assert.equal(londonToUtc("2027-03-28", "02:00").iso, "2027-03-28T01:00:00Z");
    assert.deepEqual(londonToUtc("2027-03-28", "01:30"), { ok: false, reason: "gap" });
    assert.equal(londonToUtc("2027-03-27", "23:59").iso, "2027-03-27T23:59:00Z");
  });
  test("autumn back: 31 October 2027 - 01:30 happens twice; the first (BST) is used and flagged", () => {
    const r = londonToUtc("2027-10-31", "01:30");
    assert.equal(r.iso, "2027-10-30T00:30:00Z".replace("30T00", "31T00"));
    assert.equal(r.ambiguous, true);
    assert.equal(londonToUtc("2027-10-31", "02:00").iso, "2027-10-31T02:00:00Z");
    assert.equal(londonToUtc("2027-10-31", "00:30").iso, "2027-10-30T23:30:00Z");
    assert.equal(londonToUtc("2027-10-31", "00:30").ambiguous, false);
  });
  test("bad input", () => {
    for (const [d, t] of [["2026-02-30", "10:00"], ["", "10:00"], ["2026-12-05", "25:00"], ["2026-12-05", "7:30"], ["05/12/2026", "10:00"]]) assert.equal(londonToUtc(d, t).ok, false, d + t);
  });
  test("round trip", () => {
    for (const [d, t] of [["2026-12-05", "19:30"], ["2027-07-10", "07:05"], ["2027-03-28", "03:00"], ["2027-10-31", "23:00"]]) {
      assert.deepEqual(utcToLondonParts(londonToUtc(d, t).iso), { date: d, time: t });
    }
  });
});

describe("building the occurrence list", () => {
  test("sorted, UTC, notes kept, end after midnight rolls to the next day", () => {
    const r = buildOccurrences([row("2026-12-06", "14:00", "16:00", " Matinee "), row("2026-12-05", "22:00", "01:00")], NOW);
    assert.equal(r.ok, true);
    assert.deepEqual(r.occurrences, [
      { starts_at: "2026-12-05T22:00:00Z", ends_at: "2026-12-06T01:00:00Z" },
      { starts_at: "2026-12-06T14:00:00Z", ends_at: "2026-12-06T16:00:00Z", note: "Matinee" },
    ]);
  });
  test("an explicit multi-day end date is kept when editing", () => {
    const rows = rowsFromOccurrences([{ starts_at: "2026-12-05T10:00:00Z", ends_at: "2026-12-07T18:00:00Z" }]);
    assert.equal(rows[0].endDate, "2026-12-07");
    assert.equal(buildOccurrences(rows, NOW).occurrences[0].ends_at, "2026-12-07T18:00:00Z");
    const plain = rowsFromOccurrences([{ starts_at: "2026-12-05T10:00:00Z", ends_at: "2026-12-05T18:00:00Z" }]);
    assert.equal(plain[0].endDate, undefined);
    const overnight = rowsFromOccurrences([{ starts_at: "2026-12-05T22:00:00Z", ends_at: "2026-12-06T01:00:00Z" }]);
    assert.equal(overnight[0].endDate, undefined);
  });
  test("friendly problems, per row", () => {
    const bad = [row("", "10:00"), row("2026-12-05", ""), row("2020-01-01", "10:00"), row("2026-12-05", "10:00", "10:00"), row("2026-12-07", "10:00", "", "x".repeat(201))];
    const r = buildOccurrences(bad, NOW);
    assert.equal(r.ok, false);
    assert.equal(r.issues.length, 5);
    assert.match(r.issues[2].message, /already passed/);
    assert.match(r.issues[3].message, /after the start/);
  });
  test("past start, same moment twice, none, more than 60, span over 400 days", () => {
    assert.equal(buildOccurrences([], NOW).ok, false);
    const dup = buildOccurrences([row("2026-12-05", "10:00"), row("2026-12-05", "10:00")], NOW);
    assert.match(dup.issues[0].message, /already listed/);
    const many = Array.from({ length: 61 }, (_, i) => row(addDays("2026-12-01", i), "10:00"));
    assert.match(buildOccurrences(many, NOW).general[0], /up to 60/);
    assert.equal(buildOccurrences(many.slice(0, 60), NOW).ok, true);
    assert.match(buildOccurrences([row("2026-12-05", "10:00"), row("2028-02-05", "10:00")], NOW).general[0], /400 days/);
    assert.equal(buildOccurrences([row("2026-12-05", "10:00"), row("2028-01-09", "10:00")], NOW).ok, true);
    assert.equal(buildOccurrences([row("2026-12-05", "10:00"), row("2028-01-09", "10:01")], NOW).ok, false);   // 400 days + 1 minute
  });
  test("a time in the spring gap is refused, with the reason", () => {
    const r = buildOccurrences([row("2027-03-28", "01:30")], NOW);
    assert.match(r.issues[0].message, /clocks go forward/);
  });
});

describe("copy to the next day", () => {
  test("same times, next calendar day, right after, month and year ends, DST day", () => {
    const rows = [row("2026-12-31", "19:00", "21:00", "Gala"), row("2027-01-05", "10:00")];
    const out = copyRowToNextDay(rows, 0);
    assert.equal(out.length, 3);
    assert.deepEqual([out[1].date, out[1].start, out[1].end, out[1].note], ["2027-01-01", "19:00", "21:00", "Gala"]);
    assert.notEqual(out[1].id, out[0].id);
    assert.equal(copyRowToNextDay([row("2027-03-27", "20:00")], 0)[1].date, "2027-03-28");
    assert.equal(copyRowToNextDay([row("2028-02-28", "20:00")], 0)[1].date, "2028-02-29");
  });
  test("refused when full or the row has no date", () => {
    assert.equal(copyRowToNextDay(Array.from({ length: MAX_DATES }, (_, i) => row(addDays("2026-12-01", i), "10:00")), 0), null);
    assert.equal(copyRowToNextDay([row("", "10:00")], 0), null);
  });
});

test("helpers", () => {
  assert.equal(isRealDate("2028-02-29"), true); assert.equal(isRealDate("2027-02-29"), false);
  assert.match(describeOccurrence({ starts_at: "2026-12-05T19:30:00Z", ends_at: "2026-12-05T22:00:00Z" }), /Sat 5 Dec 2026, 7:30pm to 10:00pm/);
  assert.match(describeOccurrence({ starts_at: "2027-07-10T18:30:00Z" }), /7:30pm/);
});
