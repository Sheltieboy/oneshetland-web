/**
 * Admin Intelligence dashboard + Useful Actions: the pure helpers and the page wiring (admin-only, no service role, placement, mobile affordances).
 * Run: node --test --import ./tests/support/register.mjs tests/admin-intelligence.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { trend, trendText, pct, num, ago, isStale, parsePeriod, parseView, topActions, PRIORITY_META, METRIC_DEFINITIONS, PERIODS, VIEWS } from "../lib/admin-intel.ts";

const read = (p) => readFileSync(p, "utf8");
const pageOnly = read("app/admin/intelligence/page.tsx");
const views = read("components/admin/IntelViews.tsx");
const page = pageOnly + views;
const dash = read("app/admin/page.tsx");
const actions = read("app/admin/intelligence/actions.ts");
const server = read("lib/admin-intel.server.ts");
const ua = read("components/admin/UsefulActions.tsx");
const side = read("components/admin/AdminSidebar.tsx");

describe("period comparison", () => {
  test("rises, falls, flat", () => { assert.deepEqual(trend(15, 10), { dir: "up", pct: 50 }); assert.deepEqual(trend(5, 10), { dir: "down", pct: -50 }); assert.deepEqual(trend(10, 10), { dir: "flat", pct: 0 }); });
  test("never divides by zero: nothing before is 'new', nothing in both is 'none'", () => { assert.deepEqual(trend(4, 0), { dir: "new", pct: null }); assert.deepEqual(trend(0, 0), { dir: "none", pct: null }); assert.equal(trend(0, 5).dir, "down"); });
  test("bad input is treated as zero", () => { assert.equal(trend(NaN, undefined).dir, "none"); assert.equal(trend(null, 3).pct, -100); });
  test("wording", () => {
    assert.equal(trendText(15, 10, 30), "+50% vs previous 30 days");
    assert.equal(trendText(5, 10, 7), "-50% vs previous 7 days");
    assert.equal(trendText(3, 0, 30), "new: none in the previous 30 days");
    assert.equal(trendText(0, 0, 30), "no activity in either 30-day period");
    assert.equal(trendText(2, 2, 30), "no change vs previous 30 days");
  });
});

describe("formatting", () => {
  test("percentages and counts", () => { assert.equal(pct(1, 4), "25%"); assert.equal(pct(0, 0), "–"); assert.equal(num(1234), "1,234"); assert.equal(num(null), "0"); });
  test("relative time and staleness", () => {
    const now = Date.parse("2026-11-08T12:00:00Z");
    assert.equal(ago("2026-11-08T11:59:30Z", now), "just now"); assert.equal(ago("2026-11-08T09:00:00Z", now), "3 hours ago"); assert.equal(ago("2026-11-05T12:00:00Z", now), "3 days ago"); assert.equal(ago(null, now), "never");
    assert.equal(isStale(null, 24, now), true); assert.equal(isStale("2026-11-08T11:00:00Z", 24, now), false); assert.equal(isStale("2026-11-01T11:00:00Z", 24, now), true);
  });
});

describe("filters are validated", () => {
  test("period defaults to 30 and only allows 7, 30 or 90", () => { assert.equal(parsePeriod(undefined), 30); assert.equal(parsePeriod("7"), 7); assert.equal(parsePeriod("90"), 90); assert.equal(parsePeriod("5"), 30); assert.equal(parsePeriod("'; drop"), 30); assert.deepEqual([...PERIODS], [7, 30, 90]); });
  test("view defaults to overview and rejects unknown values", () => { assert.equal(parseView(undefined), "overview"); assert.equal(parseView("business"), "business"); assert.equal(parseView("../../etc"), "overview"); assert.equal(VIEWS.length, 6); });
});

describe("actions", () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ key: "k" + i }));
  test("the top three are shown prominently", () => { assert.equal(topActions(mk(7)).length, 3); assert.equal(topActions(mk(2)).length, 2); });
  test("every priority has a label and a tone; urgent is red", () => { for (const p of ["urgent", "high", "medium", "low"]) assert.ok(PRIORITY_META[p].label && PRIORITY_META[p].tone); assert.equal(PRIORITY_META.urgent.tone, "red"); });
  test("metric definitions explain the figures that could mislead", () => { const t = METRIC_DEFINITIONS.map((d) => d.term).join("|"); for (const w of ["Signed in", "DAU", "Paid plans", "My Saved", "Not measured"]) assert.match(t, new RegExp(w)); });
});

describe("security wiring", () => {
  test("the page and the server action both require an administrator", () => { assert.match(pageOnly, /await requireAdmin\(\)/); assert.match(actions, /await requireAdmin\(\)/); });
  test("reads run as the signed-in admin through the RPCs, never the service role", () => {
    assert.match(server, /import "server-only"/); assert.match(server, /admin_intel_overview/); assert.match(server, /admin_useful_actions/);
    for (const f of [server, actions, page, ua]) assert.doesNotMatch(f, /service_role|SERVICE_ROLE|serviceRole/i);
  });
  test("the action validates its input before calling the database", () => {
    assert.match(actions, /\^\[a-z0-9_\]\{1,60\}\$/); assert.match(actions, /STATUSES\.includes\(status\)/); assert.match(actions, /Math\.min\(90/);
    assert.match(actions, /admin_action_set_state/);
  });
  test("a failed read is shown as unavailable, never as zeros", () => { assert.match(server, /return null/); assert.match(page, /not available yet/); });
  test("My Saved is shown as counts only, with no member list", () => { assert.match(page, /Counts only/); assert.doesNotMatch(page, /user_id|member_id/); });
});

describe("placement and mobile use", () => {
  test("Useful Actions sit immediately after the KPI summary on the main dashboard, before the review queues", () => {
    const kpi = dash.indexOf("Key performance summary"), ua2 = dash.indexOf("<UsefulActions"), q = dash.indexOf("Needs review");
    assert.ok(kpi > 0 && kpi < ua2 && ua2 < q, "KPI summary, then Useful Actions, then the queues");
  });
  test("the main dashboard still has the review queues, tools and operations numbers", () => { for (const s of ["Needs review", "Tools", "Operations snapshot", "Total users"]) assert.match(dash, new RegExp(s)); });
  test("the sidebar links to the new page", () => assert.match(side, /\/admin\/intelligence/));
  test("controls are touch sized and the report tabs scroll sideways on a phone", () => { assert.match(page, /overflow-x-auto/); assert.match(page, /min-h-\[44px\]/); assert.match(ua, /min-h-\[44px\]/); });
  test("each action shows what, why, benefit, priority and a link, plus done / snooze / dismiss and a history", () => {
    for (const s of ["a.what", "a.why", "a.benefit", "meta.label", "a.link", "Mark done", "Snooze 7 days", "Dismiss", "History"]) assert.ok(ua.includes(s), s);
    assert.match(ua, /Partial evidence/);
  });
  test("freshness and unmeasured metrics are disclosed on the page", () => { assert.match(page, /Updated/); assert.match(page, /Not measured yet/); assert.match(page, /How these figures are measured/); });
});
