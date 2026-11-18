/**
 * Featuring an Edition from the admin interface.
 *
 * THE DEFECT. Everything needed to put an Edition on the homepage already existed — rights, bookings, capacity,
 * fairness, a calendar, move and cancel — but no administrator could reach it. `edition_promo_book` requires
 * `edition_org_can(organiser, 'admin')`: ORGANISER authority, which a platform administrator does not have for a
 * Business or Hub they do not run. So the Promotions screen could only grant days and wait, exactly as its own help
 * text said: "The organiser then schedules them."
 *
 * Featuring an Edition therefore meant granting days here, leaving the admin area, finding the organiser, opening
 * the Edition and booking the dates as that organiser — impossible for somebody else's festival.
 *
 * What this pins: one action does both; the form refuses what the database would refuse, and says why BEFORE the
 * round trip; the candidate list carries what an administrator needs so no second screen is required; and the
 * organiser's own route is untouched.
 *
 * Run: node --test --import ./tests/support/register-jsx.mjs tests/editions-admin-feature.test.mjs
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
const page = read("app/admin/editions/promotions/page.tsx");
const panel = read("components/admin/EditionsPromoCalendar.tsx");

/** The paired backend migration, found by searching the sibling checkouts rather than naming a directory. */
const BACKEND_MIGRATION = "20270305000000_editions_admin_feature.sql";
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

const CANDIDATE = {
  edition_id: "11111111-1111-4111-8111-111111111111", title: "Christmas & New Year in Shetland 2026/27", slug: "christmas",
  organiser_name: "OneShetland", starts_on: "2026-11-28", ends_on: "2027-01-05",
  entitlement_ends_at: "2027-11-18T00:00:00Z", is_public: true,
};
const dayRow = (day, kind, booked, capacity = 3) => ({ day, kind, capacity, booked, bookings: [] });

/* ── the one action ──────────────────────────────────────────────────────────────────────────────────────────── */

describe("one action grants and books", () => {
  test("the action calls admin_promo_feature with all five arguments", () => {
    assert.match(actions, /export async function featureEdition/);
    assert.match(actions, /rpc\("admin_promo_feature", \{[\s\S]*?p_edition: v\.edition, p_kind: v\.kind, p_start: v\.start, p_days: v\.days, p_reason: v\.reason/);
    assert.match(actions, /await requireAdmin\(\)/);
    assert.doesNotMatch(actions, /service_role|SERVICE_ROLE/);
  });

  test("it refreshes the homepage, which is where the strip is read", () => {
    const body = actions.slice(actions.indexOf("export async function featureEdition"));
    assert.match(body, /revalidatePath\("\/", "layout"\)/);
  });

  test("the screen reads the candidate list, so no second screen is needed", () => {
    assert.match(page, /rpc\("admin_edition_promo_candidates"\)/);
    assert.match(page, /candidates=\{parseCandidates\(cand\.data\)\}/);
  });

  // Rendering the component with the prop proves the component. This proves the PAGE actually passes the failure
  // on: without it, a failed read falls through to parseCandidates(undefined) -> [] and reads as "nothing to
  // feature", which is exactly how a missing migration would look like an empty catalogue.
  test("the page passes a failed candidate read through, rather than letting it fall through as an empty list", () => {
    assert.match(page, /candidatesError=\{cand\.error \?/);
    assert.match(page, /20270305000000/, "and it names the likely cause");
  });

  test("granting days and featuring are now different things, and say so", () => {
    assert.match(panel, /Feature an Edition/);
    assert.doesNotMatch(panel, /The organiser then schedules them/, "the old wording described the defect");
    assert.match(panel, /for the ORGANISER to schedule themselves/i);
  });
});

/* ── the form refuses what the database would refuse ─────────────────────────────────────────────────────────── */

describe("validateFeature", () => {
  const good = { edition: CANDIDATE.edition_id, kind: "homepage", start: "2026-12-01", days: 7, reason: "Flagship festival" };
  test("accepts a complete, sensible booking", () => {
    const r = C.validateFeature(good);
    assert.equal(r.ok, true);
    assert.equal(r.days, 7); assert.equal(r.kind, "homepage");
  });
  test("an Edition must be chosen", () => {
    assert.match(C.validateFeature({ ...good, edition: "" }).error, /Choose an Edition/);
    assert.match(C.validateFeature({ ...good, edition: "not-a-uuid" }).error, /Choose an Edition/);
  });
  test("the place must be one of the two real ones", () => {
    assert.match(C.validateFeature({ ...good, kind: "sidebar" }).error, /homepage or enhanced discovery/);
    assert.equal(C.validateFeature({ ...good, kind: "discovery" }).ok, true);
  });
  test("the first day must be a real day", () => {
    for (const start of ["", "soon", "2026-13-01", "2026-02-30"]) assert.match(C.validateFeature({ ...good, start }).error, /Choose the first day/, String(start));
  });
  test("the length must be inside the range the database allows", () => {
    assert.match(C.validateFeature({ ...good, days: 0 }).error, /1 to 120/);
    assert.match(C.validateFeature({ ...good, days: 121 }).error, /1 to 120/);
    assert.match(C.validateFeature({ ...good, days: 2.5 }).error, /1 to 120/);
  });
  test("a reason is required, as the database requires", () => {
    assert.match(C.validateFeature({ ...good, reason: "no" }).error, /5 characters/);
  });
});

/* ── saying no BEFORE the round trip ─────────────────────────────────────────────────────────────────────────── */

describe("the window preview", () => {
  const days = [dayRow("2026-12-01", "homepage", 0), dayRow("2026-12-02", "homepage", 3), dayRow("2026-12-03", "homepage", 1)];
  test("it reports each day of the chosen window", () => {
    const w = C.previewWindow(days, "homepage", "2026-12-01", 3);
    assert.deepEqual(w.map((d) => d.day), ["2026-12-01", "2026-12-02", "2026-12-03"]);
  });
  test("a full day is named, so the administrator is told which one", () => {
    assert.deepEqual(C.windowFull(C.previewWindow(days, "homepage", "2026-12-01", 3)), ["2026-12-02"]);
  });
  test("a window with room reports none full", () => {
    assert.deepEqual(C.windowFull(C.previewWindow(days, "homepage", "2026-12-03", 1)), []);
  });

  // A day the loaded calendar does not cover is UNKNOWN, never free. Reporting it as free would tell an
  // administrator "every day has a free place" about days the screen has never seen.
  test("days outside the loaded range are unknown, not available", () => {
    const w = C.previewWindow(days, "homepage", "2026-12-20", 3);
    assert.deepEqual(C.windowUnknown(w), ["2026-12-20", "2026-12-21", "2026-12-22"]);
    assert.deepEqual(C.windowFull(w), [], "and an unknown day is not reported as full either");
    assert.equal(w.every((d) => d.known === false), true);
  });
  test("a window that straddles the edge reports only the days beyond it as unknown", () => {
    const w = C.previewWindow(days, "homepage", "2026-12-03", 3);
    assert.deepEqual(C.windowUnknown(w), ["2026-12-04", "2026-12-05"]);
    assert.equal(w[0].known, true);
  });
  test("a known-full day is still reported full when the window also has unknown days", () => {
    const w = C.previewWindow(days, "homepage", "2026-12-02", 4);
    assert.deepEqual(C.windowFull(w), ["2026-12-02"]);
    assert.equal(C.windowUnknown(w).length, 2);
  });
  test("it only counts the kind being booked", () => {
    const mixed = [dayRow("2026-12-01", "discovery", 6, 6), dayRow("2026-12-01", "homepage", 0)];
    assert.deepEqual(C.windowFull(C.previewWindow(mixed, "homepage", "2026-12-01", 1)), []);
    assert.deepEqual(C.windowFull(C.previewWindow(mixed, "discovery", "2026-12-01", 1)), ["2026-12-01"]);
  });
  test("the last bookable day comes from the publishing period, not the Edition's dates", () => {
    assert.equal(C.lastBookableDay(CANDIDATE), "2027-11-17");
    assert.equal(C.lastBookableDay({ entitlement_ends_at: null }), null);
  });
});

/* ── what the administrator actually sees ────────────────────────────────────────────────────────────────────── */

describe("the panel, rendered", () => {
  const render = (props) => renderToStaticMarkup(h(EditionsPromoCalendar, {
    range: { from: "2026-11-18", to: "2027-01-17" }, days: [], bookings: [], editions: [], candidates: [], error: null, ...props,
  }));

  test("a caller that omits the candidates prop degrades instead of crashing", () => {
    const html = renderToStaticMarkup(h(EditionsPromoCalendar, { range: { from: "2026-11-18", to: "2027-01-17" }, days: [], bookings: [], editions: [], error: null }));
    assert.match(html, /Nothing can be featured yet/);
  });

  test("with nothing eligible it explains why rather than showing a dead form", () => {
    const html = render({});
    assert.match(html, /Nothing can be featured yet/);
    assert.match(html, /published and approved/);
    assert.doesNotMatch(html, /Feature it<\/button>/);
  });

  test("with a candidate it offers the Edition, the place, the dates and a reason", () => {
    const html = render({ candidates: [CANDIDATE] });
    assert.match(html, /Christmas &amp; New Year in Shetland 2026\/27 — OneShetland/);
    assert.match(html, /Homepage/); assert.match(html, /Enhanced discovery/);
    assert.match(html, /First day/); assert.match(html, /Days/); assert.match(html, /Why/);
    assert.match(html, /Feature it/);
  });

  test("it states the limit that will cap the booking, before anything is chosen", () => {
    const html = render({ candidates: [CANDIDATE] });
    assert.match(html, /publishing period covers promotion up to 2027-11-17/);
  });

  test("an Edition that is not yet visible is flagged, so featuring it is not mistaken for publishing it", () => {
    const html = render({ candidates: [{ ...CANDIDATE, is_public: false }] });
    assert.match(html, /not visible to visitors yet/);
  });

  test("a full window is refused in the form, not only by the database", () => {
    const full = Array.from({ length: 7 }, (_, i) => dayRow(C.addDays(C.londonToday(), i), "homepage", 3));
    const html = render({ candidates: [CANDIDATE], days: full });
    assert.match(html, /No place free on/);
    // match the rendered ATTRIBUTE: the button's Tailwind classes contain "disabled:cursor-not-allowed", so a bare
    // substring test for "disabled" matches whether or not the button is actually disabled.
    assert.match(html, /<button[^>]*\sdisabled=""[^>]*>Feature it<\/button>/, "the button is disabled when every day is full");
  });

  test("a window beyond the loaded range is never called free", () => {
    const loaded = Array.from({ length: 3 }, (_, i) => dayRow(C.addDays(C.londonToday(), i), "homepage", 0));
    const html = render({ candidates: [CANDIDATE], days: loaded });   // the form defaults to 7 days from today
    assert.doesNotMatch(html, /Every day in this window has a free place/, "4 of the 7 days were never loaded");
    assert.match(html, /availability has not been checked/);
    assert.match(html, /Widen the date range/);
  });

  test("a candidate-loading failure is shown, not swallowed", () => {
    const html = render({ candidatesError: "The list of Editions you can feature could not be loaded." });
    assert.match(html, /could not be loaded/);
    assert.match(html, /role="alert"/);
    assert.doesNotMatch(html, /Nothing can be featured yet/, "a failure must not read as an empty list");
  });

  test("a window with room says so and leaves the button usable", () => {
    const free = Array.from({ length: 10 }, (_, i) => dayRow(C.addDays(C.londonToday(), i), "homepage", 0));
    const html = render({ candidates: [CANDIDATE], days: free });
    assert.match(html, /Every day in this window has a free place/);
    assert.doesNotMatch(html, /<button[^>]*\sdisabled=""[^>]*>Feature it<\/button>/);
  });
});

/* ── the database half ───────────────────────────────────────────────────────────────────────────────────────── */

describe("the migration", () => {
  test("grants and books in one transaction, under the usual validation", (t) => {
    if (!migrationSql) return t.skip(`no sibling checkout carries ${BACKEND_MIGRATION}`);
    assert.match(migrationSql, /insert into public\.edition_promo_rights[\s\S]*insert into public\.edition_promo_bookings/, "both, in order");
    assert.match(migrationSql, /perform public\.edition_promo_validate\(p_edition, p_kind, p_start, p_days, null, false\)/);
    assert.match(migrationSql, /perform public\.edition_promo_lock\(\)/, "the same lock the organiser path takes");
  });
  test("administrators only, with a reason, and audited", (t) => {
    if (!migrationSql) return t.skip(`no sibling checkout carries ${BACKEND_MIGRATION}`);
    assert.match(migrationSql, /not coalesce\(public\.is_admin\(\), false\) then raise exception 'admins only'/);
    assert.match(migrationSql, /give a reason of at least 5 characters/);
    assert.match(migrationSql, /'promo_featured_by_staff'/);
  });
  test("the candidate list REFUSES a non-administrator rather than returning nothing", (t) => {
    if (!migrationSql) return t.skip(`no sibling checkout carries ${BACKEND_MIGRATION}`);
    // search forward from the definition: "admin_promo_feature" also appears in the header comment above it, and
    // anchoring on its first occurrence gives an empty slice that matches nothing and proves nothing.
    const at = migrationSql.indexOf("create or replace function public.admin_edition_promo_candidates");
    assert.ok(at > -1, "the candidates function is defined");
    const fn = migrationSql.slice(at, migrationSql.indexOf("create or replace function public.admin_promo_feature", at));
    assert.ok(fn.length > 200, "and the slice actually contains it");
    assert.match(fn, /raise exception 'admins only'/, "an empty list would read as 'nothing to feature'");
    assert.doesNotMatch(fn, /where coalesce\(public\.is_admin/, "filtering on is_admin was the first version, and it made a permissions test pass while proving nothing");
  });
  test("nothing is executable by anonymous visitors", (t) => {
    if (!migrationSql) return t.skip(`no sibling checkout carries ${BACKEND_MIGRATION}`);
    for (const fn of ["admin_promo_feature", "admin_edition_promo_candidates"]) {
      assert.match(migrationSql, new RegExp(`revoke all on function public\\.${fn}[^;]*from public, anon`), fn);
    }
  });
});
