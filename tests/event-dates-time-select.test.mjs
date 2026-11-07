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
  rowsFromOccurrences, buildOccurrences, HOUR_OPTIONS, addDays,
} from "../lib/event-dates-builder.ts";

await import("./support/register-jsx.mjs");
const { TimeSelect } = await import("../components/events/TimeSelect.tsx");
const { DatesBuilder } = await import("../components/events/DatesBuilder.tsx");

const row = (p) => blankRow(p);

describe("nextBlankRow / appendNextBlankRow (Add another performance)", () => {
  test("copies date, start and end from the last row; note stays empty", () => {
    const rows = [row({ date: "2027-01-01", start: "19:30", end: "21:00", note: "Opening" })];
    const n = nextBlankRow(rows);
    assert.deepEqual([n.date, n.start, n.end, n.note], ["2027-01-01", "19:30", "21:00", ""]);
    assert.equal(n.endDate, undefined); assert.notEqual(n.id, rows[0].id);
  });
  test("a multi-day end date is carried too", () => {
    assert.equal(nextBlankRow([row({ date: "2027-01-01", start: "10:00", end: "12:00", endDate: "2027-01-03" })]).endDate, "2027-01-03");
  });
  test("uses the LAST row only and appends at the end", () => {
    const rows = [row({ date: "2027-01-01", start: "10:00", end: "11:00" }), row({ date: "2027-01-02", start: "20:10", end: "" })];
    const n = nextBlankRow(rows);
    assert.deepEqual([n.date, n.start, n.end], ["2027-01-02", "20:10", ""]);
    const out = appendNextBlankRow(rows); assert.equal(out[2].date, "2027-01-02"); assert.equal(out[0], rows[0]); assert.equal(out[1], rows[1]);
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
    assert.equal(out[2].date, "2027-03-28"); // the date is copied as is, never shifted across the clock change
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
  test("matinee + evening on one date, then another date, builds across the clock change", () => {
    let rows = [row({ date: "2027-03-27", start: "14:00", end: "16:30", note: "Matinee" })];
    rows = appendNextBlankRow(rows); rows[1].start = "19:30"; rows[1].end = ""; rows[1].note = "Evening";
    rows = appendNextBlankRow(rows); rows[2].date = "2027-03-28";   // copies 19:30; the new day is the BST Sunday
    const res = buildOccurrences(rows, Date.UTC(2027, 0, 1));
    assert.equal(res.ok, true);
    assert.deepEqual(res.occurrences.map((o) => o.starts_at), ["2027-03-27T14:00:00Z", "2027-03-27T19:30:00Z", "2027-03-28T18:30:00Z"]);
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
    assert.doesNotMatch(html, /<option[^>]*>No end time/); assert.match(html, /<option value="" selected="">Hr<\/option>/); assert.match(html, /<select[^>]*id="t-minute"[^>]*disabled/);
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
  test("one 'Add another performance' button replaces the old two; end clear button only when an end is set", () => {
    const withEnd = renderToStaticMarkup(h(DatesBuilder, { rows: [row({ date: "2027-06-01", start: "19:00", end: "20:00" })], onChange() {}, issues: [], today: "2026-11-01" }));
    assert.equal((withEnd.match(/Add another performance/g) || []).length, 1);
    assert.doesNotMatch(withEnd, /Add another day|Copy this day/); assert.match(withEnd, /Clear end time/); assert.doesNotMatch(withEnd, /No end time</);
    const noEnd = renderToStaticMarkup(h(DatesBuilder, { rows: [row({ date: "2027-06-01", start: "19:00" })], onChange() {}, issues: [], today: "2026-11-01" }));
    assert.doesNotMatch(noEnd, /Clear end time/);
  });
  test("an odd stored minute stacks Starts/Ends on phones so '05 (current)' is not clipped; normal rows stay side by side", () => {
    const odd = renderToStaticMarkup(h(DatesBuilder, { rows: [row({ date: "2027-06-01", start: "19:05" })], onChange() {}, issues: [], today: "2026-11-01" }));
    const normal = renderToStaticMarkup(h(DatesBuilder, { rows: [row({ date: "2027-06-01", start: "19:00" })], onChange() {}, issues: [], today: "2026-11-01" }));
    assert.match(odd, /grid-cols-1/); assert.doesNotMatch(normal, /grid-cols-1/); assert.match(normal, /grid-cols-2/);
  });
  test("issues render inline with aria wiring", () => {
    const r = row({ date: "2027-06-01", start: "19:00" });
    const html = renderToStaticMarkup(h(DatesBuilder, { rows: [r], onChange() {}, issues: [{ rowId: r.id, field: "row", message: "Same as Date 1" }], today: "2026-11-01" }));
    assert.match(html, /aria-invalid="true"[^>]*aria-describedby="dates-[^"]*-date-err"/); assert.match(html, /Same as Date 1/);
  });
  test("at the cap the add button is disabled with an explanation", () => {
    const rows = Array.from({ length: MAX_DATES }, (_, i) => row({ date: addDays("2027-01-01", i), start: "19:00" }));
    const html = renderToStaticMarkup(h(DatesBuilder, { rows, onChange() {}, issues: [], today: "2026-11-01" }));
    assert.match(html, /<button[^>]*disabled[^>]*>Add another performance/); assert.match(html, /reached the limit of 60/);
  });
  test("no native time inputs; four selects per row; stored odd time displayed", () => {
    const rows = [row({ date: "2027-06-01", start: "19:05", end: "20:07" })];
    const html = renderToStaticMarkup(h(DatesBuilder, { rows, onChange() {}, issues: [], today: "2026-11-01" }));
    assert.doesNotMatch(html, /type="time"/); assert.equal((html.match(/<select/g) || []).length, 4);
    assert.match(html, /05 \(current\)/); assert.match(html, /07 \(current\)/); assert.match(html, /Ends \(optional\)/);
  });
});

describe("validation: end, duplicates, overlaps, clock changes", () => {
  const NOW = Date.UTC(2026, 0, 1);
  const msgs = (res) => res.issues.map((i) => i.message);
  test("end after start is fine; end equal to start is an error", () => {
    assert.equal(buildOccurrences([row({ date: "2027-06-01", start: "19:00", end: "21:00" })], NOW).ok, true);
    const r = buildOccurrences([row({ date: "2027-06-01", start: "19:00", end: "19:00" })], NOW);
    assert.equal(r.ok, false); assert.match(r.issues[0].message, /after the start/); assert.equal(r.issues[0].field, "end");
  });
  test("RULE: an end earlier than the start means past midnight (23:00-01:00 valid, next day), but over 12 hours is an error", () => {
    const ok = buildOccurrences([row({ date: "2027-06-01", start: "23:00", end: "01:00" })], NOW);
    assert.equal(ok.ok, true); assert.deepEqual(ok.occurrences[0], { starts_at: "2027-06-01T22:00:00Z", ends_at: "2027-06-02T00:00:00Z" });
    assert.equal(buildOccurrences([row({ date: "2027-06-01", start: "22:00", end: "10:00" })], NOW).ok, true);   // exactly 12h
    const bad = buildOccurrences([row({ date: "2027-06-01", start: "14:00", end: "09:00" })], NOW);
    assert.equal(bad.ok, false); assert.equal(bad.issues[0].field, "end"); assert.match(bad.issues[0].message, /earlier than the start/);
    // a stored multi-day event keeps its real end date and is not caught by the rule
    const stored = rowsFromOccurrences([{ starts_at: "2027-06-01T10:00:00Z", ends_at: "2027-06-03T09:00:00Z" }]);
    assert.equal(buildOccurrences(stored, NOW).ok, true);
  });
  test("a start is required when a date is set", () => {
    const r = buildOccurrences([row({ date: "2027-06-01" })], NOW);
    assert.equal(r.ok, false); assert.equal(r.issues[0].field, "start"); assert.match(r.issues[0].message, /start time/);
  });
  test("duplicate performances name the other row", () => {
    const r = buildOccurrences([row({ date: "2027-06-01", start: "19:00" }), row({ date: "2027-06-02", start: "19:00" }), row({ date: "2027-06-01", start: "19:00", end: "20:00" })], NOW);
    assert.equal(r.ok, false); assert.equal(r.issues.length, 1);
    assert.match(r.issues[0].message, /already listed.*Date 1/); assert.equal(r.issues[0].rowId, r.issues[0].rowId);
  });
  test("matinee 14:00-16:30 + evening 19:30 on the same date is VALID, in either order", () => {
    const a = row({ date: "2027-06-05", start: "14:00", end: "16:30" }), b = row({ date: "2027-06-05", start: "19:30" });
    assert.equal(buildOccurrences([a, b], NOW).ok, true); assert.equal(buildOccurrences([b, a], NOW).ok, true);
    assert.equal(buildOccurrences([row({ date: "2027-06-05", start: "14:00", end: "16:30" }), row({ date: "2027-06-05", start: "16:30" })], NOW).ok, true);   // back to back
  });
  test("overlapping performances on one date are an error on the later row, naming the earlier", () => {
    const a = row({ date: "2027-06-05", start: "14:00", end: "17:00" }), b = row({ date: "2027-06-05", start: "16:30", end: "18:00" });
    const r = buildOccurrences([b, a], NOW);   // input order reversed: the later start (b) is flagged, "Date 2" is a
    assert.equal(r.ok, false); assert.equal(r.issues.length, 1); assert.equal(r.issues[0].rowId, b.id); assert.equal(r.issues[0].field, "row");
    assert.match(r.issues[0].message, /before Date 2 has finished/);
    // a row with no end time cannot overlap the next
    assert.equal(buildOccurrences([row({ date: "2027-06-05", start: "14:00" }), row({ date: "2027-06-05", start: "14:30" })], NOW).ok, true);
    // a long first performance still overlaps a third one
    const third = buildOccurrences([row({ date: "2027-06-05", start: "10:00", end: "20:00" }), row({ date: "2027-06-05", start: "11:00", end: "11:30" }), row({ date: "2027-06-05", start: "12:00" })], NOW);
    assert.equal(third.issues.length, 2);
  });
  test("same times on different dates never overlap", () => {
    assert.equal(buildOccurrences([row({ date: "2027-06-05", start: "14:00", end: "17:00" }), row({ date: "2027-06-06", start: "14:00", end: "17:00" })], NOW).ok, true);
  });
  test("October clock change: Saturday before and Sunday after at 19:00 local", () => {
    const r = buildOccurrences([row({ date: "2027-10-30", start: "19:00", end: "21:00" }), row({ date: "2027-10-31", start: "19:00", end: "21:00" })], NOW);
    assert.equal(r.ok, true);
    assert.deepEqual(r.occurrences.map((o) => [o.starts_at, o.ends_at]), [["2027-10-30T18:00:00Z", "2027-10-30T20:00:00Z"], ["2027-10-31T19:00:00Z", "2027-10-31T21:00:00Z"]]);
  });
  test("March clock change: Saturday before and Sunday after at 19:00 local", () => {
    const r = buildOccurrences([row({ date: "2027-03-27", start: "19:00" }), row({ date: "2027-03-28", start: "19:00" })], NOW);
    assert.equal(r.ok, true); assert.deepEqual(r.occurrences.map((o) => o.starts_at), ["2027-03-27T19:00:00Z", "2027-03-28T18:00:00Z"]);
  });
  test("01:30 on the March night does not exist (error, no crash); on the October night it is ambiguous (first one, warning)", () => {
    const gap = buildOccurrences([row({ date: "2027-03-28", start: "01:30" })], NOW);
    assert.equal(gap.ok, false); assert.match(gap.issues[0].message, /clocks go forward/);
    const amb = buildOccurrences([row({ date: "2027-10-31", start: "01:30" })], NOW);
    assert.equal(amb.ok, true); assert.equal(amb.occurrences[0].starts_at, "2027-10-31T00:30:00Z"); assert.equal(amb.warnings.length, 1);
    assert.doesNotThrow(() => buildOccurrences([row({ date: "2027-03-28", start: "00:30", end: "01:30" }), row({ date: "2027-10-31", start: "00:30", end: "01:30" })], NOW));
  });
  test("odd stored times round-trip unchanged: 19:05 / 20:07", () => {
    const rows = rowsFromOccurrences([{ starts_at: "2027-06-01T18:05:00Z", ends_at: "2027-06-01T19:07:00Z", note: "x" }]);
    const res = buildOccurrences(rows, NOW);
    assert.equal(res.ok, true); assert.deepEqual(res.occurrences, [{ starts_at: "2027-06-01T18:05:00Z", ends_at: "2027-06-01T19:07:00Z", note: "x" }]);
  });
});
