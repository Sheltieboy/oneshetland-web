/**
 * Admin: the package manager for the Launch / Showcase rate card, the new promotion settings, and the promotion calendar. Pure logic, static renders and source guards.
 * Run: node --test --import ./tests/support/register-jsx.mjs tests/admin-editions-promotions.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

await import("./support/register-jsx.mjs");
const K = await import("../app/admin/editions/commerce/catalogue.ts");
const cfg = await import("../app/admin/editions/commerce/config.ts");
const C = await import("../app/admin/editions/promotions/calendar.ts");
const { TABS } = await import("../app/admin/editions/helpers.ts");
const { EditionsCommerceAdmin } = await import("../components/admin/EditionsCommerceAdmin.tsx");
const { EditionsPromoCalendar } = await import("../components/admin/EditionsPromoCalendar.tsx");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const ALL5 = ["collect_payments", "memberships", "participation_fees", "offline_records", "csv_export"];
const LAUNCH = { code: "launch", name: "Launch", description: "d", price_pence: 24900, duration_days: 365, features: ALL5, max_members: null, active: false, sort: 10, is_free: false, kind: "package", grants: {}, retired_at: null };
const SHOW = { ...LAUNCH, code: "showcase", name: "Showcase", price_pence: 49900, grants: { discovery_days: 42, homepage_days: 7, grouped: true } };
const PROMO = { ...LAUNCH, code: "promo_discovery_2w", name: "Two weeks of enhanced discovery", price_pence: 7900, duration_days: null, features: [], kind: "promotion", grants: { discovery_days: 14 } };
const OLD = { ...LAUNCH, code: "publish_full", name: "Publish full", retired_at: "2027-01-04T00:00:00Z" };

describe("catalogue", () => {
  test("retired rows are hidden by default and can never be edited", () => {
    const rows = [LAUNCH, SHOW, PROMO, OLD];
    assert.deepEqual(K.visibleCatalogue(rows, false).map((r) => r.code), ["launch", "showcase", "promo_discovery_2w"]);
    assert.equal(K.visibleCatalogue(rows, true).length, 4); assert.equal(K.retiredCount(rows), 1);
    assert.equal(K.canEditRow(OLD), false); assert.equal(K.canEditRow(LAUNCH), true);
  });
  test("grants and includes are described in plain words", () => {
    assert.equal(K.describeGrants({ discovery_days: 14 }), "14 discovery days");
    assert.equal(K.describeGrants(SHOW.grants), "42 discovery days and 7 homepage days (homepage days inside the discovery period)");
    assert.equal(K.describeGrants({}), "No promotion"); assert.equal(K.describeGrants({ homepage_days: 1 }), "1 homepage day");
    assert.match(K.describeIncludes(LAUNCH, (f) => f), /365 days of publishing · all five features · no member cap/);
    assert.match(K.describeIncludes(PROMO, (f) => f), /never extends publishing/);
  });
  test("an edit may change only name, price, description, order and on-sale", () => {
    assert.deepEqual(K.validateEdit({ code: "launch", name: "Launch", price: "249", active: true }), { ok: true, code: "launch", name: "Launch", description: null, price: 24900, sort: 0, active: true });
    assert.equal(K.validateEdit({ code: "launch", name: "L", price: "249" }).ok, false); assert.equal(K.validateEdit({ code: "launch", name: "Launch", price: "abc" }).ok, false);
    assert.equal(K.validateEdit({ code: "", name: "Launch", price: "1" }).ok, false); assert.equal(K.validateEdit({ code: "launch", name: "Launch", price: "1", sort: "-2" }).ok, false);
  });
  test("the arguments always keep all five features and no cap on Launch and Showcase, and no days or features on a promotion", () => {
    const e = { name: "Launch", description: null, price: 24900, sort: 10, active: true };
    const broken = { ...LAUNCH, features: ["csv_export"], max_members: 5 };
    for (const r of [LAUNCH, SHOW, broken]) { const a = K.upsertArgs(r, e); assert.deepEqual(a.p_features, ALL5); assert.equal(a.p_max_members, null); assert.equal(a.p_days, 365); }
    const p = K.upsertArgs(PROMO, e); assert.equal(p.p_days, null); assert.deepEqual(p.p_features, []); assert.equal(p.p_max_members, null); assert.equal(p.p_kind, "promotion"); assert.deepEqual(p.p_grants, { discovery_days: 14 });
    assert.deepEqual(K.upsertArgs(SHOW, e).p_grants, SHOW.grants);
  });
  test("the action reads the stored row, refuses retired rows, and has no audience or free-package controls", () => {
    const a = read("app/admin/editions/commerce/actions.ts"); const up = a.split("export async function upsertPackage")[1].split("export async function grantOrgEntitlement")[0];
    assert.match(up, /requireAdmin\(\)/); assert.match(up, /retired_at/); assert.match(up, /upsertArgs\(/); assert.doesNotMatch(up, /audience|p_is_free: input/);
  });
  test("the manager shows kind and grants, a show-retired toggle, the no-restrictions rule, and no way to reactivate", () => {
    const html = renderToStaticMarkup(h(EditionsCommerceAdmin, { config: {}, packages: [LAUNCH, SHOW, PROMO, OLD], organisers: [], entitlements: [], exceptions: [], fees: [] }));
    assert.match(html, /Launch and Showcase include all five features/); assert.match(html, /Package/); assert.match(html, /Promotion/);
    assert.match(html, /Includes: 42 discovery days and 7 homepage days/); assert.match(html, /Show retired \(1\)/);
    assert.doesNotMatch(html, /Publish full/, "retired row hidden by default");
    assert.doesNotMatch(html, /Hub-run|Any organiser|Community|Free package/);
    assert.match(html, /£249\.00/); assert.match(html, /£499\.00/);
  });
});

describe("promotion settings", () => {
  const KEYS = ["editions.promo.homepage_capacity", "editions.promo.discovery_capacity", "editions.promo.homepage_visible", "editions.promo.discovery_visible", "editions.promo.lead_days", "editions.promo.horizon_days", "editions.promo.homepage_days_per_90", "editions.promo.reschedule_notice_days", "editions.commerce.renewal_window_days", "editions.commerce.vat_note", "editions.app.handoff_ios", "editions.app.handoff_android"];
  const def = (k) => cfg.COMMERCE_KEYS.find((c) => c.key === k);
  test("all twelve keys exist with the contract defaults", () => {
    const want = ["3", "6", "3", "4", "2", "180", "14", "3", "30", "", "off", "off"];
    KEYS.forEach((k, i) => assert.equal(def(k)?.def, want[i], k));
  });
  test("validation mirrors the database ranges", () => {
    const ok = (k, v) => cfg.validateConfigValue(k, v).ok;
    assert.ok(ok("editions.promo.homepage_capacity", "1") && ok("editions.promo.homepage_capacity", "50") && !ok("editions.promo.homepage_capacity", "0") && !ok("editions.promo.homepage_capacity", "51"));
    assert.ok(ok("editions.promo.discovery_visible", "12") && !ok("editions.promo.discovery_visible", "13"));
    assert.ok(ok("editions.promo.lead_days", "0") && ok("editions.promo.lead_days", "30") && !ok("editions.promo.lead_days", "31"));
    assert.ok(ok("editions.promo.horizon_days", "730") && !ok("editions.promo.horizon_days", "731") && !ok("editions.promo.horizon_days", "0"));
    assert.ok(ok("editions.promo.homepage_days_per_90", "90") && !ok("editions.promo.homepage_days_per_90", "91"));
    assert.ok(ok("editions.promo.reschedule_notice_days", "60") && !ok("editions.promo.reschedule_notice_days", "61"));
    assert.ok(ok("editions.commerce.renewal_window_days", "365") && !ok("editions.commerce.renewal_window_days", "366") && !ok("editions.commerce.renewal_window_days", "x"));
    assert.ok(ok("editions.promo.lead_days", " 2 ") && !ok("editions.promo.lead_days", "-1") && !ok("editions.promo.lead_days", "1.5"));
    assert.ok(ok("editions.commerce.vat_note", "") && ok("editions.commerce.vat_note", "Prices shown before VAT") && !ok("editions.commerce.vat_note", "<b>x</b>") && !ok("editions.commerce.vat_note", "x".repeat(301)) && !ok("editions.commerce.vat_note", "a\nb"));
    assert.ok(ok("editions.app.handoff_ios", "on") && ok("editions.app.handoff_android", "off") && !ok("editions.app.handoff_ios", "true") && !ok("editions.app.handoff_android", "yes"));
  });
  test("the hand-off switches are labelled as agreed, default off, and carry a warning", () => {
    assert.equal(def("editions.app.handoff_ios").label, "Allow app-to-website sign-in for organisers (iPhone)");
    assert.equal(def("editions.app.handoff_android").label, "Allow app-to-website sign-in for organisers (Android)");
    for (const k of ["editions.app.handoff_ios", "editions.app.handoff_android"]) { assert.match(def(k).help, /^Off by default\. Warning:/); assert.equal(def(k).kind, "onoff"); }
  });
  test("the screen renders them as On/Off selects, and the earlier keys are unchanged", () => {
    const html = renderToStaticMarkup(h(EditionsCommerceAdmin, { config: {}, packages: [], organisers: [], entitlements: [], exceptions: [], fees: [] }));
    assert.match(html, /Promotion and app settings/); assert.match(html, /Allow app-to-website sign-in for organisers \(iPhone \/ Android\)|Allow app-to-website sign-in for organisers \(iPhone\)/);
    assert.match(html, /id="editions\.app\.handoff_ios"[^>]*>\s*<option value="off"/);
    assert.equal(cfg.validateConfigValue("editions.commerce.enabled", "true").ok, true);
  });
});

describe("promotion calendar logic", () => {
  const d = (day, kind, booked, capacity, bookings = []) => ({ day, kind, booked, capacity, bookings });
  const b = (id, s, e, t = "Spring Fest") => ({ booking_id: id, edition_id: "e", edition_title: t, organiser_name: "Org", starts_on: s, ends_on: e });
  test("the range defaults to 60 days from today in London and rejects bad or oversized ranges", () => {
    const now = new Date("2027-03-01T10:00:00Z");
    assert.deepEqual(C.parseRange(undefined, undefined, now), { from: "2027-03-01", to: "2027-04-30" });
    assert.deepEqual(C.parseRange("2027-05-01", "2027-05-10", now), { from: "2027-05-01", to: "2027-05-10" });
    assert.equal(C.parseRange("2027-05-01", "2027-04-01", now).to, "2027-06-30"); assert.equal(C.parseRange("2027-05-01", "2029-01-01", now).to, "2027-06-30");
    assert.equal(C.parseRange("2027-02-30", "x", now).from, "2027-03-01");
  });
  test("rows are cleaned, bookings collapse to one row each, and use is labelled", () => {
    const rows = C.parseCalendar([d("2027-06-01", "homepage", 2, 3, [b("1", "2027-06-01", "2027-06-07"), b("2", "2027-06-01", "2027-06-02", "Other")]), d("2027-06-02", "homepage", 3, 3, [b("1", "2027-06-01", "2027-06-07")]), d("2027-06-02", "weird", 1, 1), null, { day: "bad" }]);
    assert.equal(rows.length, 2);
    const bs = C.bookingRows(rows); assert.deepEqual(bs.map((x) => [x.booking_id, x.peak]), [["2", 2], ["1", 3]]);
    assert.equal(C.usageOf(rows[0]), "some"); assert.equal(C.usageOf(rows[1]), "full"); assert.equal(C.usageOf({ booked: 4, capacity: 3 }), "over"); assert.equal(C.usageOf({ booked: 0, capacity: 3 }), "free");
    assert.equal(C.usageLabel(rows[0]), "2 of 3 booked"); assert.deepEqual(C.summarise(rows, "homepage"), { days: 2, full: 1, booked: 5, capacity: 3 });
    assert.deepEqual(C.parseCalendar("nope"), []);
  });
  test("a reason of 5 or more characters is required; a grant needs an Edition, a kind and 1 to 120 days", () => {
    assert.equal(C.validateReason("no").ok, false); assert.equal(C.validateReason("  ok!  ").ok, false); assert.equal(C.validateReason("goodwill grant").ok, true);
    const e = "00000000-0000-4000-8000-000000000001";
    assert.equal(C.validateGrant({ edition: e, kind: "homepage", days: "7", reason: "goodwill" }).ok, true);
    for (const bad of [{ edition: "x" }, { kind: "both" }, { days: "0" }, { days: "121" }, { days: "1.5" }, { reason: "no" }]) assert.equal(C.validateGrant({ edition: e, kind: "homepage", days: "7", reason: "goodwill", ...bad }).ok, false, JSON.stringify(bad));
  });
  test("database hint codes become staff wording and nothing raw leaks", () => {
    assert.match(C.promoError("x", "full"), /already full/); assert.match(C.promoError("x", "reason_required"), /reason/); assert.match(C.promoError("admins only"), /administrators/);
    assert.doesNotMatch(C.promoError("ERROR: duplicate key value violates unique constraint abc"), /duplicate|constraint/);
  });
  test("the calendar renders bookings with Move, Cancel booking and the grant form, with no raw ids", () => {
    const days = C.parseCalendar([d("2027-06-01", "homepage", 1, 3, [b("11111111-1111-4111-8111-111111111111", "2027-06-01", "2027-06-07")])]);
    const html = renderToStaticMarkup(h(EditionsPromoCalendar, { range: { from: "2027-06-01", to: "2027-06-30" }, days, bookings: C.bookingRows(days), editions: [{ id: "22222222-2222-4222-8222-222222222222", label: "Spring Fest (Org)" }], error: null }));
    for (const t of ["Spring Fest", "1 of 3 booked", "Move", "Cancel booking", "Grant a promotion right", "Reason", "Enhanced discovery"]) assert.ok(html.includes(t), t);
    assert.doesNotMatch(html, /11111111-1111|>22222222/); assert.doesNotMatch(html, /Community/);
  });
});

describe("source guards", () => {
  test("every promotion action starts with requireAdmin, takes a reason, and uses no service key", () => {
    const a = read("app/admin/editions/promotions/actions.ts");
    for (const blk of a.split(/^export async function /m).slice(1)) { assert.match(blk, /await requireAdmin\(\)/, blk.slice(0, 30)); assert.match(blk, /reason|validateGrant/); }
    assert.ok(!/service[_-]?role|SERVICE_KEY|createAdminClient/i.test(a));
    for (const fn of ["admin_promo_cancel", "admin_promo_reschedule", "admin_grant_promo_right"]) assert.match(a, new RegExp(`rpc\\("${fn}"`));
    assert.match(read("app/admin/editions/promotions/page.tsx"), /rpc\("admin_edition_promo_calendar"/); assert.match(read("app/admin/editions/promotions/page.tsx"), /await requireAdmin\(\)/);
  });
  test("Promotions is a tab and has its own sidebar entry that does not light up Editions", () => {
    assert.ok(TABS.some((t) => t.key === "promotions" && t.href === "/admin/editions/promotions"));
    assert.match(read("components/admin/AdminSidebar.tsx"), /"\/admin\/editions\/promotions"/);
  });
});
