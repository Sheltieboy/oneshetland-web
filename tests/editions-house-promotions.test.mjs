/**
 * House promotions: an official OneShetland campaign on the homepage.
 *
 * THE PROBLEM. The homepage fairness rule caps any one organiser at 14 homepage days in any rolling 90. That rule
 * is the reason paid placement cannot be monopolised and it must not move. But OneShetland's own seasonal campaigns
 * are editorial, not advertising: Christmas & New Year runs 49 days, carries no money, and is the platform
 * promoting itself. Under the commercial rule it is simply impossible to book.
 *
 * What this pins: the exemption is narrow (one rule, one kind of organiser, administrators only), house days are
 * left OUT of the fairness count so they never consume a commercial allowance, capacity is NOT waived, and nothing
 * about prices, packages or any other organiser's limits changed.
 *
 * Run: node --test --import ./tests/support/register-jsx.mjs tests/editions-house-promotions.test.mjs
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";

await import("./support/register-jsx.mjs");
const C = await import("../app/admin/editions/promotions/calendar.ts");
const { EditionsPromoCalendar } = await import("../components/admin/EditionsPromoCalendar.tsx");

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const actions = read("app/admin/editions/promotions/actions.ts");
const panel = read("components/admin/EditionsPromoCalendar.tsx");

/** The paired backend migration, found by searching the sibling checkouts rather than naming a directory. */
const BACKEND_MIGRATION = "20270306000000_editions_house_promotions.sql";
const migrationSql = (() => {
  const siblings = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  let names = [];
  try { names = readdirSync(siblings, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return null; }
  for (const n of names) {
    const c = join(siblings, n, "supabase", "migrations", BACKEND_MIGRATION);
    if (existsSync(c)) return readFileSync(c, "utf8");
  }
  return null;
})();

const HOUSE = {
  edition_id: "f56920bd-2f27-4238-aa28-f35c2444ccc0", title: "Christmas & New Year in Shetland 2026/27", slug: "christmas-new-year-shetland-2026",
  organiser_id: "11b80be5-1ebd-445f-8e1f-b44c6a6135eb", organiser_name: "OneShetland",
  starts_on: "2026-11-26", ends_on: "2027-01-05", entitlement_ends_at: "2027-11-18T00:00:00Z", is_public: true, is_house: true,
};
const ORDINARY = { ...HOUSE, edition_id: "22222222-2222-4222-8222-222222222222", title: "Harbour Gala", organiser_id: "33333333-3333-4333-8333-333333333333", organiser_name: "Harbour Gala Committee", is_house: false };
const dayRow = (day, kind, booked, capacity = 3) => ({ day, kind, capacity, booked, bookings: [] });
const render = (props) => renderToStaticMarkup(h(EditionsPromoCalendar, { range: { from: "2026-11-18", to: "2027-01-16" }, days: [], bookings: [], editions: [], error: null, ...props }));

/* ── the length a house promotion may run ────────────────────────────────────────────────────────────────────── */

describe("49 days is possible, and only this way", () => {
  test("a house promotion may run far longer than an ordinary one", () => {
    assert.equal(C.GRANT_DAYS.max, 120);
    assert.equal(C.HOUSE_DAYS.max, 400);
    assert.ok(C.HOUSE_DAYS.max > 49, "the Christmas run is 49 days");
  });
  test("the house form accepts 49 days and the ordinary one does not accept 400", () => {
    const base = { edition: HOUSE.edition_id, kind: "homepage", start: "2026-11-18", reason: "Christmas campaign" };
    const good = C.validateHouseFeature({ ...base, days: 49 });
    assert.equal(good.ok, true);
    assert.equal(good.days, 49);
    assert.equal(C.validateFeature({ ...base, days: 400 }).ok, false, "the ordinary route stays capped at 120");
  });
  test("it is still bounded: 0, 401 and nonsense are refused", () => {
    const base = { edition: HOUSE.edition_id, kind: "homepage", start: "2026-11-18", reason: "Christmas campaign" };
    for (const days of [0, -1, 401, 1000, "many", null]) assert.equal(C.validateHouseFeature({ ...base, days }).ok, false, `days=${days}`);
  });
  test("the house form still demands an Edition, a place, a date and a reason", () => {
    const ok = { edition: HOUSE.edition_id, kind: "homepage", start: "2026-11-18", days: 49, reason: "Christmas campaign" };
    assert.equal(C.validateHouseFeature(ok).ok, true);
    assert.equal(C.validateHouseFeature({ ...ok, edition: "not-a-uuid" }).ok, false);
    assert.equal(C.validateHouseFeature({ ...ok, kind: "banner" }).ok, false);
    assert.equal(C.validateHouseFeature({ ...ok, start: "18/11/2026" }).ok, false);
    assert.equal(C.validateHouseFeature({ ...ok, reason: "x" }).ok, false);
  });
});

/* ── who may, and for what ───────────────────────────────────────────────────────────────────────────────────── */

describe("administrators only, and only for OneShetland's own", () => {
  test("the action checks the administrator, then calls admin_promo_feature_house", () => {
    const fn = actions.slice(actions.indexOf("export async function featureEditionHouse"));
    assert.match(fn, /await requireAdmin\(\)/);
    assert.match(fn, /validateHouseFeature/);
    assert.match(fn, /rpc\("admin_promo_feature_house"/);
    assert.match(fn, /p_edition: v\.edition[\s\S]*p_kind: v\.kind[\s\S]*p_start: v\.start[\s\S]*p_days: v\.days[\s\S]*p_reason: v\.reason/);
  });
  test("the homepage strip is revalidated, not only the admin screen", () => {
    const fn = actions.slice(actions.indexOf("export async function featureEditionHouse"), actions.indexOf("/** Mark (or unmark)"));
    assert.match(fn, /revalidatePath\("\/", "layout"\)/);
  });
  test("marking an organiser as OneShetland's own is its own administrator action, with a reason", () => {
    const fn = actions.slice(actions.indexOf("export async function setOrganiserHouse"));
    assert.match(fn, /await requireAdmin\(\)/);
    assert.match(fn, /rpc\("admin_set_edition_organiser_house"/);
    const v = C.validateHouseFlag({ organiser: HOUSE.organiser_id, house: true, reason: "OneShetland runs this Hub" });
    assert.deepEqual(v, { ok: true, organiser: HOUSE.organiser_id, house: true, reason: "OneShetland runs this Hub" });
    assert.equal(C.validateHouseFlag({ organiser: HOUSE.organiser_id, house: true, reason: "no" }).ok, false, "a reason is required");
    assert.equal(C.validateHouseFlag({ organiser: "nope", house: true, reason: "a good reason" }).ok, false);
  });
  test("the refusal an organiser that is not OneShetland's own gets is explained, not generic", () => {
    const msg = C.promoError("a house promotion is only for a verified Edition that OneShetland runs itself", "not_house");
    assert.match(msg, /not one of OneShetland/i);
    assert.notEqual(msg, C.promoError("something else", null));
  });
});

/* ── the screen ──────────────────────────────────────────────────────────────────────────────────────────────── */

describe("the admin screen", () => {
  test("the house option is offered for OneShetland's own Edition", () => {
    const html = render({ candidates: [HOUSE] });
    assert.match(html, /House promotion/);
    assert.match(html, /OneShetland&#x27;s own|OneShetland’s own/);
  });
  test("it is NOT offered when the only Edition is an ordinary organiser's", () => {
    const html = render({ candidates: [ORDINARY] });
    assert.doesNotMatch(html, /id="f-house"/);
  });
  test("the checkbox starts unticked, so a house promotion is never the default", () => {
    const html = render({ candidates: [HOUSE] });
    const box = html.slice(html.indexOf('id="f-house"') - 120, html.indexOf('id="f-house"') + 120);
    assert.doesNotMatch(box, /checked=""/);
    assert.match(panel, /const \[house, setHouse\] = useState\(false\)/);
  });
  test("ticking it only takes effect for an Edition that is OneShetland's own", () => {
    assert.match(panel, /const asHouse = house && !!chosen\?\.is_house/);
    assert.match(panel, /asHouse \? featureEditionHouse\(/);
  });
  test("the candidate list says which Editions are OneShetland's own", () => {
    const parsed = C.parseCandidates([{ ...HOUSE }, { ...ORDINARY }]);
    assert.deepEqual(parsed.map((c) => c.is_house), [true, false]);
    assert.equal(parsed[0].organiser_id, HOUSE.organiser_id);
    const html = render({ candidates: [HOUSE, ORDINARY] });
    assert.match(html, /Christmas &amp; New Year in Shetland 2026\/27 — OneShetland \(OneShetland(&#x27;|’)s own\)/);
  });
  test("Feature an Edition comes before the date range and the day-by-day table", () => {
    const html = render({ candidates: [HOUSE], days: [dayRow("2026-11-18", "homepage", 0)] });
    const feature = html.indexOf("Feature an Edition");
    assert.ok(feature >= 0);
    assert.ok(feature < html.indexOf("Date range"), "the form is the first thing on the page");
    assert.ok(feature < html.indexOf("Day by day"));
  });
  test("the long day-by-day table is collapsible and closed to begin with", () => {
    const html = render({ candidates: [HOUSE], days: [dayRow("2026-11-18", "homepage", 1), dayRow("2026-11-18", "discovery", 0)] });
    const i = html.indexOf("Day by day");
    const before = html.slice(0, i);
    assert.match(before.slice(-220), /<details/);
    assert.doesNotMatch(html, /<details open/);
    assert.match(html, /<summary/);
  });
  test("the organiser list shows who is marked, and offers mark and unmark", () => {
    const html = render({ candidates: [HOUSE, ORDINARY] });
    assert.match(html, /Who is OneShetland(&#x27;|’)s own/);
    assert.match(html, /Ordinary organiser/);
    assert.match(html, /Mark as OneShetland(&#x27;|’)s own/);
    assert.match(html, /Unmark/);
  });
  test("the days field offers the house ceiling only while the house option applies", () => {
    assert.match(panel, /const maxDays = asHouse \? HOUSE_DAYS\.max : GRANT_DAYS\.max/);
    assert.match(render({ candidates: [ORDINARY] }), /1 to 120/);
  });
  test("an unchecked day is still never called free, and a bad length still blocks the button", () => {
    const w = C.previewWindow([dayRow("2026-11-18", "homepage", 0)], "homepage", "2026-11-18", 49);
    assert.equal(w.length, 49);
    assert.equal(C.windowUnknown(w).length, 48);
    assert.equal(C.windowFull(w).length, 0);
    assert.match(panel, /!chosen \|\| !daysOk/);
  });
});

/* ── the migration behind it ──────────────────────────────────────────────────────────────────────────────────── */

describe(`the backend migration (${BACKEND_MIGRATION})`, () => {
  test("the migration is present in a sibling checkout", (t) => {
    if (migrationSql === null) return t.skip(`${BACKEND_MIGRATION} was not found in any sibling checkout — the assertions below cannot run`);
    assert.ok(migrationSql.length > 500);
  });
  test("exactly one rule is waived, and only for a house booking", (t) => {
    if (migrationSql === null) return t.skip("migration not found");
    assert.match(migrationSql, /if p_kind = 'homepage' and not coalesce\(p_house, false\) then/);
    // capacity, the publishing window and one-per-organiser-per-day are all still there, unconditionally
    assert.match(migrationSql, /no place is free on %/);
    assert.match(migrationSql, /promotion must finish inside the Edition''s publishing period/);
    assert.match(migrationSql, /you already have this kind of promotion booked/);
  });
  test("house days are left out of the fairness count, so no commercial allowance is consumed", (t) => {
    if (migrationSql === null) return t.skip("migration not found");
    assert.match(migrationSql, /not exists \(select 1 from public\.edition_promo_rights hr where hr\.id = b\.right_id and hr\.is_house\)/);
  });
  test("every existing caller keeps the commercial rules: the six-argument validate still exists and passes false", (t) => {
    if (migrationSql === null) return t.skip("migration not found");
    assert.match(migrationSql, /create or replace function public\.edition_promo_validate\(p_edition uuid, p_kind text, p_start date, p_days integer, p_exclude uuid, p_timing boolean\)/);
    assert.match(migrationSql, /edition_promo_validate_core\(p_edition, p_kind, p_start, p_days, p_exclude, p_timing, false\)/);
  });
  test("the function refuses a non-administrator and an organiser that is not OneShetland's own", (t) => {
    if (migrationSql === null) return t.skip("migration not found");
    const fn = migrationSql.slice(migrationSql.indexOf("create or replace function public.admin_promo_feature_house"));
    assert.match(fn, /not coalesce\(public\.is_admin\(\), false\) then raise exception 'admins only'/);
    assert.match(fn, /not o\.is_house or o\.status <> 'verified' or o\.is_test/);
    assert.match(fn, /p_days not between 1 and 400/);
    assert.match(fn, /edition_promo_validate_core\(p_edition, p_kind, p_start, p_days, null, false, true\)/);
  });
  test("it is one transaction under the same lock, and audited with who, when and why", (t) => {
    if (migrationSql === null) return t.skip("migration not found");
    const fn = migrationSql.slice(migrationSql.indexOf("create or replace function public.admin_promo_feature_house"));
    assert.match(fn, /perform public\.edition_promo_lock\(\)/);
    assert.match(fn, /insert into public\.edition_promo_rights[\s\S]*insert into public\.edition_promo_bookings/);
    assert.match(fn, /'promo_house_featured'[\s\S]*'starts_on'[\s\S]*'reason'/);
    assert.match(fn, /granted_by[\s\S]*auth\.uid\(\)/);
  });
  test("marking an organiser needs an administrator, a verified organiser and a reason, and is audited", (t) => {
    if (migrationSql === null) return t.skip("migration not found");
    const fn = migrationSql.slice(migrationSql.indexOf("create or replace function public.admin_set_edition_organiser_house"), migrationSql.indexOf("-- ── 2."));
    assert.match(fn, /not coalesce\(public\.is_admin\(\), false\) then raise exception 'admins only'/);
    assert.match(fn, /p_house and \(o\.status <> 'verified' or o\.is_test\)/);
    assert.match(fn, /char_length\(btrim\(coalesce\(p_reason, ''\)\)\) < 5/);
    assert.match(fn, /'organiser_house_set'/);
  });
  test("the commercial limits are not touched, and the migration checks that itself", (t) => {
    if (migrationSql === null) return t.skip("migration not found");
    assert.doesNotMatch(migrationSql, /insert into public\.admin_config/);
    assert.doesNotMatch(migrationSql, /update public\.edition_packages/);
    assert.doesNotMatch(migrationSql, /price_pence/);
    assert.match(migrationSql, /if v_lim <> 14 then raise exception 'post-check: the homepage fairness limit changed/);
    assert.match(migrationSql, /if v_cap <> 3 then raise exception 'post-check: the homepage capacity changed/);
  });
  test("nothing is a house promotion until an administrator says so", (t) => {
    if (migrationSql === null) return t.skip("migration not found");
    assert.match(migrationSql, /add column if not exists is_house boolean not null default false/);
    assert.match(migrationSql, /post-check: an organiser is already marked as house/);
    assert.match(migrationSql, /post-check: an existing promotion right was marked as house/);
  });
  test("anon reaches none of it", (t) => {
    if (migrationSql === null) return t.skip("migration not found");
    for (const f of ["admin_promo_feature_house", "admin_set_edition_organiser_house", "admin_edition_promo_candidates"]) {
      assert.match(migrationSql, new RegExp(`revoke all on function public\\.${f}`), f);
      assert.match(migrationSql, new RegExp(`post-check: anon must not execute ${f}`), f);
    }
    assert.match(migrationSql, /has_column_privilege\('anon', 'public\.edition_organisers', 'is_house', 'select'\)/);
  });
});
