/**
 * Dates builder: carry-forward of times on "Add another day" and the 10-minute TimeSelect.
 * Run: node --test --import ./tests/support/register.mjs tests/event-dates-time-select.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import {
  MAX_DATES, blankRow, nextBlankRow, appendNextBlankRow, copyRowToNextDay, minuteOptions, splitTime, timeAfterHour, timeAfterMinute,
  rowsFromOccurrences, buildOccurrences, HOUR_OPTIONS,
} from "../lib/event-dates-builder.ts";

await import("./support/register-jsx.mjs");
const { TimeSelect } = await import("../components/events/TimeSelect.tsx");
const { DatesBuilder } = await import("../components/events/DatesBuilder.tsx");

const row = (p) => blankRow(p);

describe("nextBlankRow / appendNextBlankRow", () => {
  test("copies start and end from the last row; date and note stay empty", () => {
    const rows = [row({ date: "2027-01-01", start: "19:30", end: "21:00", note: "Opening" })];
    const n = nextBlankRow(rows);
    assert.equal(n.start, "19:30"); assert.equal(n.end, "21:00"); assert.equal(n.date, ""); assert.equal(n.note, "");
    assert.equal(n.endDate, undefined); assert.notEqual(n.id, rows[0].id);
  });
  test("uses the LAST row only", () => {
    const rows = [row({ start: "10:00", end: "11:00" }), row({ start: "20:10", end: "" })];
    assert.deepEqual([nextBlankRow(rows).start, nextBlankRow(rows).end], ["20:10", ""]);
  });
  test("blank / start-only / end-only / odd minute", () => {
    assert.deepEqual([nextBlankRow([row()]).start, nextBlankRow([row()]).end], ["", ""]);
    assert.deepEqual([nextBlankRow([row({ start: "18:00" })]).start, nextBlankRow([row({ start: "18:00" })]).end], ["18:00", ""]);
    assert.deepEqual([nextBlankRow([row({ end: "22:00" })]).start, nextBlankRow([row({ end: "22:00" })]).end], ["", "22:00"]);
    const odd = nextBlankRow([row({ start: "19:05", end: "20:07" })]);
    assert.deepEqual([odd.start, odd.end], ["19:05", "20:07"]);
  });
  test("empty list gives a fully blank row", () => {
    const n = nextBlankRow([]); assert.deepEqual([n.date, n.start, n.end, n.note], ["", "", "", ""]);
  });
  test("existing rows are untouched (deep equal, same objects)", () => {
    const rows = [row({ date: "2027-03-27", start: "19:00", end: "21:00", note: "a" }), row({ date: "2027-03-28", start: "01:30", end: "", note: "b" })];
    const before = structuredClone(rows);
    const out = appendNextBlankRow(rows);
    assert.equal(out.length, 3); assert.deepEqual(out.slice(0, 2), before); assert.equal(out[0], rows[0]); assert.deepEqual(rows, before);
    assert.equal(out[2].date, ""); // DST-adjacent dates are not invented or shifted
  });
  test("60-row cap: nothing added", () => {
    const rows = Array.from({ length: MAX_DATES }, () => row({ start: "19:00" }));
    assert.equal(nextBlankRow(rows), null);
    const out = appendNextBlankRow(rows); assert.equal(out.length, MAX_DATES); assert.deepEqual(out, rows);
    assert.notEqual(nextBlankRow(rows.slice(1)), null);
  });
  test("copyRowToNextDay still works", () => {
    const r = row({ date: "2027-03-27", start: "19:05", end: "21:00", note: "x" });
    const out = copyRowToNextDay([r], 0);
    assert.equal(out[1].date, "2027-03-28"); assert.equal(out[1].start, "19:05"); assert.equal(out[1].note, "x");
  });
  test("a carried row with a date picked builds across the clock change", () => {
    const rows = appendNextBlankRow([row({ date: "2027-03-27", start: "19:00", end: "21:00" })]);
    rows[1].date = "2027-03-28";
    const res = buildOccurrences(rows, Date.UTC(2027, 0, 1));
    assert.equal(res.ok, true);
    assert.deepEqual(res.occurrences.map((o) => o.starts_at), ["2027-03-27T19:00:00Z", "2027-03-28T18:00:00Z"]);
  });
});

describe("minute options and time helpers", () => {
  test("multiples of 10 give exactly six options, no duplicates", () => {
    for (const m of ["00", "10", "20", "30", "40", "50"]) {
      const o = minuteOptions(`07:${m}`); assert.deepEqual(o.map((x) => x.value), ["00", "10", "20", "30", "40", "50"]); assert.ok(o.every((x) => !x.current));
    }
    assert.equal(minuteOptions("").length, 6);
  });
  test("every odd minute 00-59 adds exactly one correctly ordered current option", () => {
    for (let m = 0; m < 60; m++) {
      const mm = String(m).padStart(2, "0"); const o = minuteOptions(`12:${mm}`); const vals = o.map((x) => x.value);
      assert.equal(new Set(vals).size, vals.length);
      assert.deepEqual(vals, [...vals].sort((a, b) => Number(a) - Number(b)));
      if (m % 10 === 0) assert.equal(o.length, 6);
      else { assert.equal(o.length, 7); const c = o.find((x) => x.current); assert.equal(c.value, mm); assert.equal(c.label, `${mm} (current)`); }
    }
  });
  test("split / join", () => {
    assert.deepEqual(splitTime("19:05"), { hour: "19", minute: "05" }); assert.deepEqual(splitTime(""), { hour: "", minute: "" }); assert.deepEqual(splitTime("25:00"), { hour: "", minute: "" });
    assert.equal(timeAfterHour("", "07"), "07:00"); assert.equal(timeAfterHour("19:05", "20"), "20:05"); assert.equal(timeAfterHour("19:05", ""), "");
    assert.equal(timeAfterMinute("19:00", "30"), "19:30"); assert.equal(timeAfterMinute("", "30"), "");
    assert.equal(HOUR_OPTIONS.length, 24); assert.equal(HOUR_OPTIONS[0], "00"); assert.equal(HOUR_OPTIONS[23], "23");
  });
  test("stored times with odd minutes survive rowsFromOccurrences", () => {
    const r = rowsFromOccurrences([{ starts_at: "2027-06-01T18:05:00Z", ends_at: "2027-06-01T19:07:00Z" }]);
    assert.deepEqual([r[0].start, r[0].end], ["19:05", "20:07"]);
  });
});

describe("TimeSelect render", () => {
  const render = (props) => renderToStaticMarkup(h(TimeSelect, { idBase: "t", legend: "Starts", value: "", onChange() {}, ...props }));
  test("fieldset legend and two accessibly named selects", () => {
    const html = render({ value: "19:30" });
    assert.match(html, /<fieldset[^>]*>\s*<legend[^>]*>Starts<\/legend>/);
    assert.match(html, /<label[^>]*for="t-hour"[^>]*>Starts, hour<\/label>/); assert.match(html, /<label[^>]*for="t-minute"[^>]*>Starts, minute<\/label>/);
    assert.equal((html.match(/<select/g) || []).length, 2);
    assert.match(html, /<option value="19" selected="">19<\/option>/); assert.match(html, /<option value="30" selected="">30<\/option>/);
  });
  test("odd stored time shows its extra option, selected, ordered", () => {
    const html = render({ value: "19:05" });
    assert.match(html, /<option value="05" selected="">05 \(current\)<\/option>/);
    assert.ok(html.indexOf('value="00"') < html.indexOf('value="05"') && html.indexOf('value="05"') < html.indexOf('value="10"'));
  });
  test("error wiring", () => {
    const html = render({ errorId: "e1" });
    assert.equal((html.match(/aria-invalid="true"/g) || []).length, 2); assert.equal((html.match(/aria-describedby="e1"/g) || []).length, 2);
    assert.doesNotMatch(render({}), /aria-invalid|aria-describedby/);
  });
  test("optional end label, empty value disables minutes", () => {
    const html = render({ legend: "Ends (optional)", optional: true });
    assert.match(html, /No end time/); assert.match(html, /<select[^>]*id="t-minute"[^>]*disabled/);
  });
  test("onChange values via element tree", () => {
    const calls = []; const tree = TimeSelect({ idBase: "t", legend: "Starts", value: "", onChange: (v) => calls.push(v) });
    const sels = []; (function walk(n) { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(walk); if (n.type === "select") sels.push(n); walk(n.props?.children); })(tree);
    assert.equal(sels.length, 2);
    sels[0].props.onChange({ target: { value: "07" } }); assert.deepEqual(calls, ["07:00"]);
    const t2 = TimeSelect({ idBase: "t", legend: "Ends (optional)", optional: true, value: "21:05", onChange: (v) => calls.push(v) });
    const s2 = []; (function walk(n) { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(walk); if (n.type === "select") s2.push(n); walk(n.props?.children); })(t2);
    s2[0].props.onChange({ target: { value: "" } }); s2[1].props.onChange({ target: { value: "30" } });
    assert.deepEqual(calls, ["07:00", "", "21:30"]);
  });
});

describe("DatesBuilder render", () => {
  test("no native time inputs; four selects per row; stored odd time displayed", () => {
    const rows = [row({ date: "2027-06-01", start: "19:05", end: "20:07" })];
    const html = renderToStaticMarkup(h(DatesBuilder, { rows, onChange() {}, issues: [], today: "2026-11-01" }));
    assert.doesNotMatch(html, /type="time"/); assert.equal((html.match(/<select/g) || []).length, 4);
    assert.match(html, /05 \(current\)/); assert.match(html, /07 \(current\)/); assert.match(html, /Ends \(optional\)/);
  });
});
