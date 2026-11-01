/**
 * Owner analytics dashboard (/admin/analytics) — Phase 0 accuracy. The pure helpers and the page's wiring.
 * Run: node --test --import ./tests/support/register.mjs tests/analytics-dashboard.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gbp, num, salesTotals, streamNet, isWalletFloat, KPI_DEFINITIONS, excludedTotal } from "../lib/analytics-format.ts";

const page = readFileSync("app/admin/analytics/page.tsx", "utf8");

describe("money formatting", () => {
  test("pence are shown as pounds, with the £ sign", () => { assert.equal(gbp(12345), "£123.45"); assert.equal(gbp(0), "£0.00"); assert.equal(gbp(null), "£0.00"); assert.equal(gbp(5), "£0.05"); });
  test("counts are grouped", () => { assert.equal(num(1234567), "1,234,567"); assert.equal(num(undefined), "0"); });
});

describe("sales arithmetic", () => {
  const streams = [
    { stream: "Event tickets", orders: 2, gross_pence: 1500, refunded_pence: 500, net_pence: 1000, platform_pence: 100 },
    { stream: "Shop orders", orders: 1, gross_pence: 2000, refunded_pence: 0, net_pence: 2000, platform_pence: 200 },
    { stream: "Passes & units", orders: 1, gross_pence: 900, refunded_pence: 0, net_pence: 900, platform_pence: null },
    { stream: "Wallet top-ups (float)", orders: 5, gross_pence: 50000, fees_pence: 0 },
  ];
  test("wallet funds are never part of sales, even if an older database still returns them as a stream", () => {
    assert.equal(isWalletFloat(streams[3]), true); const t = salesTotals(streams);
    assert.deepEqual([t.orders, t.gross, t.refunded, t.net, t.platform], [4, 4400, 500, 3900, 300]);
  });
  test("a stream that does not record OneShetland's share is flagged, not counted as zero", () => { assert.equal(salesTotals(streams).platformUnknown, true); assert.equal(salesTotals(streams.slice(0, 2)).platformUnknown, false); });
  test("net falls back to gross minus refunded for an older database", () => { assert.equal(streamNet({ stream: "x", orders: 1, gross_pence: 1000, refunded_pence: 300 }), 700); assert.equal(streamNet({ stream: "x", orders: 1, gross_pence: 1000 }), 1000); });
  test("excluded counts add up", () => { assert.equal(excludedTotal({ internal_or_test: 4, unmatched_ledger: 2, duplicate_ledger: 1 }), 7); assert.equal(excludedTotal(undefined), 0); });
});

describe("the existing page, corrected", () => {
  test("it is still the one analytics page: same route, admin gate, same sections", () => {
    assert.match(page, /await requireAdmin\(\)/); for (const h of ["Activity by day", "Conversions by category", "Content views", "Top events", "Top searches"]) assert.ok(page.includes(h), h);
  });
  test("misleading labels are gone: no 'Revenue (gross)' card, no bare 'Visitors', no 'Sign-ups' reading an event nobody sends", () => {
    assert.ok(!page.includes('label="Revenue (gross)"')); assert.ok(!/label="Visitors"/.test(page)); assert.ok(!page.includes('label="Sign-ups"'));
    assert.match(page, /New registrations/); assert.match(page, /Anonymous visitors/); assert.match(page, /Signed-in members/); assert.match(page, /Gross sales/);
  });
  test("the gross card is formatted as pounds, not a bare number", () => { assert.match(page, /display=\{gbp\(sales\.gross\)\}/); });
  test("wallet funds are a separate section, labelled as not revenue, and never summed into the sales total", () => {
    assert.match(page, /customer money — not sales, not revenue/); assert.ok(!/wallet.*sales\.gross|sales\.gross.*wallet/i.test(page.replace(/\{KPI_DEFINITIONS\.wallet\}/g, "")));
    assert.match(page, /isWalletFloat/);
  });
  test("every headline figure has a written definition on the page", () => {
    assert.match(page, /How these figures are measured/);
    for (const k of ["events", "conversions", "registrations", "confirmed", "signedIn", "anonymous", "gross", "net", "platform"]) { assert.ok(KPI_DEFINITIONS[k] && KPI_DEFINITIONS[k].length > 20, k); assert.ok(page.includes(`"${k}"`), `page lists ${k}`); }
  });
  test("exclusions are disclosed: how many events were left out and why; nothing says they were deleted", () => {
    assert.match(page, /internal\/test activity/); assert.match(page, /They remain stored/); assert.match(page, /nothing is deleted/);
  });
  test("it reads only the admin RPCs (no direct table reads, no new database load)", () => {
    const loader = readFileSync("lib/analytics-admin.server.ts", "utf8");
    assert.deepEqual([...loader.matchAll(/rpc<[^>]*>\("([a-z_]+)"/g)].map((m) => m[1]).sort(), ["analytics_overview", "analytics_revenue", "analytics_top_searches"]);
    assert.ok(!/\.from\(/.test(loader));
  });
  test("browser-verified fixes: the activity chart bars are anchored to the baseline and have a height to fill; the sales table scrolls rather than collides on a phone; zero-order streams are hidden", () => {
    assert.match(page, /className="group relative h-full flex-1"/);
    assert.match(page, /className="absolute bottom-0 w-full rounded-t bg-navy\/15"/);
    assert.match(page, /min-w-\[36rem\]/); assert.match(page, /\(r\.orders \?\? 0\) > 0/);
  });
  test("StatCard stays backward compatible: the new props are optional", () => {
    const ui = readFileSync("components/admin/AdminUI.tsx", "utf8"); assert.match(ui, /display\?: string; hint\?: string/);
  });
});
