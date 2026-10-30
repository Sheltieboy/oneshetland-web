/**
 * Stage 4B.1 — multi-day date presentation and venue/organiser de-duplication.
 *
 * WHAT WAS WRONG (live, after the pilot): RIFFMAS (Fri 4 to Sun 6 December) showed "Friday 4 December at 19:00 ... Until
 * 23:59" — nothing said the end was on the 6th. And Harry's and the Museum printed "Harry's Department Store · Harry's
 * Department Store", because the business is both venue and organiser.
 *
 * Run: node --test --import ./tests/support/register.mjs tests/event-display.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventWhen, isMultiDay, rowEndSuffix, sameName, venueAndOrganiser, longDateTime } from "../lib/event-display.ts";
import { fmtLongDateTime } from "../lib/events-data.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("event date presentation", () => {
  test("same-day event keeps the concise form", () => {
    const w = eventWhen("2026-11-05T19:30:00Z", "2026-11-05T21:00:00Z"); // Tailor of Inverness (GMT)
    assert.equal(w.multiDay, false);
    assert.equal(w.start, "Thursday 5 November at 19:30");
    assert.equal(w.end, "Until 21:00");
    assert.equal(w.line, w.start);
    assert.equal(rowEndSuffix("2026-11-05T19:30:00Z", "2026-11-05T21:00:00Z"), null);
  });
  test("multi-day event (RIFFMAS) names BOTH dates", () => {
    const w = eventWhen("2026-12-04T19:00:00Z", "2026-12-06T23:59:00Z");
    assert.equal(w.multiDay, true);
    assert.equal(w.start, "Friday 4 December at 19:00");
    assert.equal(w.end, "to Sunday 6 December at 23:59");
    assert.equal(w.line, "Friday 4 December at 19:00 to Sunday 6 December at 23:59");
    assert.equal(rowEndSuffix("2026-12-04T19:00:00Z", "2026-12-06T23:59:00Z"), "to Sun 6 Dec");
  });
  test("works for any multi-day event, not just RIFFMAS (a months-long exhibition)", () => {
    const w = eventWhen("2026-10-02T10:30:00Z", "2027-01-18T00:30:00Z");
    assert.equal(w.multiDay, true);
    assert.equal(w.end, "to Monday 18 January at 00:30");
  });
  test("an event crossing midnight is multi-day (its end really is the next calendar day)", () => {
    const w = eventWhen("2026-12-05T20:00:00Z", "2026-12-06T01:00:00Z");
    assert.equal(w.multiDay, true);
    assert.equal(w.end, "to Sunday 6 December at 01:00");
  });
  test("BST: 23:30 UTC is already 00:30 the NEXT day in Shetland, so it crosses midnight", () => {
    assert.equal(isMultiDay("2026-07-17T19:00:00Z", "2026-07-17T23:30:00Z"), true);
    const w = eventWhen("2026-07-17T19:00:00Z", "2026-07-17T23:30:00Z");
    assert.equal(w.start, "Friday 17 July at 20:00");
    assert.equal(w.end, "to Saturday 18 July at 00:30");
  });
  test("BST: a late evening event that ends before Shetland midnight is NOT multi-day", () => {
    assert.equal(isMultiDay("2026-07-17T19:00:00Z", "2026-07-17T22:30:00Z"), false);
    assert.equal(eventWhen("2026-07-17T19:00:00Z", "2026-07-17T22:30:00Z").end, "Until 23:30");
  });
  test("GMT: the same instants fall on the same day in winter", () => {
    assert.equal(isMultiDay("2026-12-17T19:00:00Z", "2026-12-17T23:30:00Z"), false);
  });
  test("clock-change weekends read correctly", () => {
    assert.equal(isMultiDay("2026-03-28T20:00:00Z", "2026-03-29T10:00:00Z"), true);  // spans the spring-forward night
    assert.equal(isMultiDay("2026-10-24T20:00:00Z", "2026-10-25T10:00:00Z"), true);  // spans the autumn-back night
    assert.equal(eventWhen("2026-10-25T09:00:00Z", "2026-10-25T17:00:00Z").multiDay, false);
  });
  test("no end time, junk end time: just the start, never throws", () => {
    for (const e of [null, undefined, "", "not a date"]) {
      const w = eventWhen("2026-11-05T19:30:00Z", e);
      assert.equal(w.end, null); assert.equal(w.multiDay, false); assert.equal(w.line, w.start);
    }
  });
  test("the start label is exactly what the rest of the site already prints", () => {
    for (const iso of ["2026-12-04T19:00:00Z", "2026-07-17T19:00:00Z", "2026-03-29T01:30:00Z"]) assert.equal(longDateTime(iso), fmtLongDateTime(iso));
  });
});

describe("venue and organiser are not printed twice", () => {
  test("identical names collapse to one (Harry's, the Museum)", () => {
    assert.deepEqual(venueAndOrganiser("Harry's Department Store", "Harry's Department Store"), ["Harry's Department Store"]);
    assert.deepEqual(venueAndOrganiser("Shetland Museum and Archives", "Shetland Museum and Archives"), ["Shetland Museum and Archives"]);
  });
  test("case, spacing and apostrophe style do not make them 'different'", () => {
    assert.equal(venueAndOrganiser("  harry\u2019s  department store ", "Harry's Department Store").length, 1);
    assert.equal(sameName("Harry\u2019s Department Store", "harry's  department store"), true);
  });
  test("genuinely different venue and organiser keep BOTH", () => {
    assert.deepEqual(venueAndOrganiser("Mareel", "Shetland Arts"), ["Mareel", "Shetland Arts"]);
    assert.deepEqual(venueAndOrganiser("Lerwick Town Hall", "Lerwick Community Council"), ["Lerwick Town Hall", "Lerwick Community Council"]);
  });
  test("no fuzzy matching: a name that merely contains the other is kept", () => {
    assert.deepEqual(venueAndOrganiser("Mareel", "Mareel Cinema"), ["Mareel", "Mareel Cinema"]);
    assert.equal(sameName("Harry's", "Harry's Department Store"), false);
  });
  test("missing values are skipped", () => {
    assert.deepEqual(venueAndOrganiser(null, "Shetland Arts"), ["Shetland Arts"]);
    assert.deepEqual(venueAndOrganiser("Mareel", null), ["Mareel"]);
    assert.deepEqual(venueAndOrganiser("", ""), []);
    assert.equal(sameName(null, null), false);
  });
});

describe("the pages use the shared helpers", () => {
  test("detail page: When card and hero use eventWhen; no bare 'Until' remains", () => {
    const s = read("app/whats-on/[id]/page.tsx");
    assert.match(s, /eventWhen\(e\.starts_at, e\.ends_at\)\.line/);
    assert.match(s, /eventWhen\(e\.starts_at, e\.ends_at\)\.end/);
    assert.doesNotMatch(s, /Until \{fmtTime\(e\.ends_at\)\}/);
  });
  test("list row builds venue/organiser through venueAndOrganiser and adds the multi-day suffix", () => {
    const s = read("components/events/EventsListing.tsx");
    assert.match(s, /venueAndOrganiser\(e\.venue, organiser\)/);
    assert.match(s, /rowEndSuffix\(e\.starts_at, e\.ends_at\)/);
    assert.doesNotMatch(s, /\{organiser \? ` · \$\{organiser\}` : ""\}/);
  });
});
