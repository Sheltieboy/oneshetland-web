/**
 * My Saved: the words. The status labels are a product decision (design section 5), so the table is HARD-CODED here: changing a label in
 * lib/saved-copy.ts without changing this file fails. No database, no network.
 * Run: node --test --import ./tests/support/register.mjs tests/saved-copy.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyShadows } from "../lib/saved.ts";
import {
  STATE_LABEL, SNAPSHOT_NOTE, BUSINESS_SAVE_LINE, MSG, FILTER_LABEL, CLEAR_PAST, SAVED_MENU_LABEL, savedOn, changedLabel, labelFor, knownState, whenLine,
} from "../lib/saved-copy.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the label table is exactly the approved one", () => {
  assert.deepEqual({ ...STATE_LABEL }, {
    upcoming: null,
    ok: null,
    changed: "Changed",
    cancelled: "Cancelled",
    postponed: "Postponed. A new date will follow.",
    break: "Break: no session",
    past: "Past",
    date_gone: "This date is no longer scheduled",
    no_upcoming: "No upcoming sessions in the next 93 days",
    closed: "Closed",
    filled: "Filled",
    snapshot_expired: "Expired",
    snapshot_postponed: "Postponed. A new date will follow.",
    snapshot_ended: "Ended",
    unavailable: "No longer available",
  });
});

test("snapshot rows say so, and the saved date is short and in London time", () => {
  assert.equal(SNAPSHOT_NOTE, "As it was when you saved it");
  assert.equal(savedOn("2026-11-03T12:00:00Z"), "Saved 3 Nov");
  assert.equal(savedOn("2026-06-30T23:30:00Z"), "Saved 1 Jul", "23:30 UTC in summer is already the next day in London");
  assert.equal(savedOn("not a date"), "Saved");
});

test("a changed session reads 'Moved to ...' when it is on another day, else 'Changed: <time>', else 'Changed'", () => {
  assert.equal(changedLabel({ moved: true, starts_at: "2026-11-12T19:00:00Z" }), "Moved to Thu 12 Nov, 19:00");
  assert.equal(changedLabel({ moved: false, starts_at: "2026-07-10T18:00:00Z" }), "Changed: 19:00", "BST: 18:00 UTC is 19:00 in London");
  assert.equal(changedLabel({ moved: true, starts_at: null }), "Changed");
  assert.equal(labelFor({ state: "changed", moved: true, starts_at: "2026-11-12T19:00:00Z" }), "Moved to Thu 12 Nov, 19:00");
  assert.equal(labelFor({ state: "cancelled" }), "Cancelled");
  assert.equal(labelFor({ state: "upcoming" }), null);
});

test("a state this build does not know is shown as 'No longer available', never as raw text", () => {
  assert.equal(knownState("something_new"), "unavailable");
  assert.equal(knownState("cancelled"), "cancelled");
  assert.equal(knownState("toString"), "unavailable", "inherited object keys are not states");
  assert.equal(labelFor({ state: knownState("something_new") }), "No longer available");
});

test("the row date line is Europe/London and absent without a start", () => {
  assert.equal(whenLine({ starts_at: "2026-07-10T18:00:00Z" }), "Fri 10 Jul, 19:00");
  assert.equal(whenLine({ starts_at: null }), null);
});

test("fixed wording", () => {
  assert.equal(BUSINESS_SAVE_LINE, "Saved privately. You won't get updates. Follow for updates.");
  assert.equal(SAVED_MENU_LABEL, "My Saved");
  assert.deepEqual({ ...FILTER_LABEL }, { all: "All", events: "Events", jobs: "Jobs", businesses: "Businesses" });
  assert.equal(MSG.saved, "Saved"); assert.equal(MSG.removed, "Removed"); assert.equal(MSG.undo, "Undo");
  assert.equal(MSG.failed, "Couldn't save that. Try again.");
  assert.equal(CLEAR_PAST.button, "Clear past");
  assert.match(CLEAR_PAST.body(2), /can't be undone/);
});

test("no em dashes or emoji in the copy file (plain English house style)", () => {
  const src = read("lib/saved-copy.ts");
  assert.doesNotMatch(src, /—/);
  assert.doesNotMatch(src, /\p{Extended_Pictographic}/u);
});

test("a job's date line is its closing day (the closing time arrives in ends_at; a job has no start)", () => {
  assert.equal(whenLine({ item_type: "job", starts_at: null, ends_at: "2026-11-20T23:59:59Z" }), "Closes Fri 20 Nov");
  assert.equal(whenLine({ item_type: "job", starts_at: null, ends_at: null }), null);
  assert.equal(whenLine({ item_type: "event", starts_at: "2026-11-17T19:30:00Z", ends_at: null }), "Tue 17 Nov, 19:30");
});

test("a saved date is hidden only while the whole item is also saved (removing the whole shows the dates straight away)", () => {
  const whole = { item_type: "activity", item_id: "a", occurrence_key: null };
  const date = { item_type: "activity", item_id: "a", occurrence_key: "rule:x:2026-11-11" };
  const other = { item_type: "event", item_id: "a", occurrence_key: "k" };
  assert.deepEqual(applyShadows([whole, date, other]).map((i) => i.shadowed), [false, true, false]);
  assert.deepEqual(applyShadows([date, other]).map((i) => i.shadowed), [false, false]);
});
