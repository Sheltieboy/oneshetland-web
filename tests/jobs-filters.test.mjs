/**
 * Jobs Stage 3 — the Filters experience (search, category, one "Filters" control, URL state, sorting, urgency).
 *
 * Runs the REAL lib/job-filters.ts over fixture jobs, the REAL getActiveJobs over an in-memory Supabase fake (so expired/hidden
 * exclusion is the page's own query), and scans the page/panel sources for the structure the brief asks for (desktop dropdown,
 * mobile bottom sheet, results count, active chips, Clear all, zero-results state).
 *
 * SAFETY: no network, no Supabase project, no production access. Fixtures only.
 * Run: node --test --import ./tests/support/register.mjs tests/jobs-filters.test.mjs
 */
import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDb, setViewer } from "./support/fake-supabase.mjs";
import * as F from "../lib/job-filters.ts";
import * as T from "../lib/job-taxonomy.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = Date.parse("2026-10-30T12:00:00Z");
const day = (d) => new Date(NOW + d * 86400_000).toISOString();

let n = 0;
const job = (title, x = {}) => ({
  id: `j${++n}`, title, description: null, category: null, location: null, locality: null, contract_type: "full-time",
  pay_min: null, pay_max: null, pay_period: null, remote_mode: "on_site", source_meta: null, expires_at: day(20), listed_at: day(-5), posted_at: day(-5),
  is_featured: false, is_hidden: false, status: "open", external_employer_name: null, business: null, source: null, ...x,
});
const nhs = (t, x = {}) => job(t, { external_employer_name: "NHS Shetland", category: "Health", locality: "Lerwick", source: "nhs-scotland-jobs", source_meta: { contract_label: "Permanent", hours_label: "Full Time" }, ...x });

const FIX = [
  nhs("Consultant Surgeon", { pay_min: 111430, pay_max: 148064, pay_period: "year", expires_at: day(2), listed_at: day(-1) }),
  nhs("Receptionist", { category: "Office & admin", contract_type: "part-time", source_meta: { contract_label: "Permanent", hours_label: "Part Time" }, expires_at: day(40) }),
  nhs("Domestic Support Worker", { contract_type: "temporary", source_meta: { contract_label: "Fixed-term" }, expires_at: day(1) }),
  nhs("Bank Pharmacy Worker", { contract_type: "casual", locality: null, source_meta: { contract_label: "Staff Bank" } }),
  job("Ramp Agent", { external_employer_name: "Loganair", category: "Transport", locality: "South Mainland", pay_min: 36275, pay_max: 36275, pay_period: "year", expires_at: day(12) }),
  job("Operations Engineer", { external_employer_name: "px Group", category: "Energy", contract_type: "temporary", source_meta: { workplace: "on_site" }, expires_at: day(5), listed_at: day(-9) }),
  job("Smart Meter Hybrid Role", { external_employer_name: "Acme", remote_mode: "hybrid", category: "Energy", pay_min: 30000, pay_max: 40000, pay_period: "year" }),
  job("Remote Analyst", { external_employer_name: "Beta", remote_mode: "remote", category: null }),
  job("Marine Painter", { external_employer_name: "Scottish Sea Farms", category: "Aquaculture", locality: "Lerwick", description: "Paint boats." }),
  job("Hourly Cleaner", { external_employer_name: "Gamma", pay_min: 12, pay_max: 12, pay_period: "hour", locality: "Yell" }),
  job("Council Teacher", { external_employer_name: "Shetland Islands Council", category: "Education", locality: "Whalsay", expires_at: null }),
  job("Apprentice Electrician", { external_employer_name: "Delta", contract_type: "apprenticeship", category: "Trades", locality: "Lerwick", pay_min: 20000, pay_max: 22000, pay_period: "year" }),
];
const P = (s) => F.parseFilters(new URLSearchParams(s));
const ids = (jobs) => jobs.map((j) => j.title);
const run = (s) => ids(F.sortJobs(F.applyFilters(FIX, P(s)), P(s).sort));

describe("search + category", () => {
  test("keyword search matches title, employer, location text and description; all words must match", () => {
    assert.deepEqual(run("q=ramp").sort(), ["Ramp Agent"]);
    assert.ok(run("q=loganair").includes("Ramp Agent"));
    assert.deepEqual(run("q=paint boats"), ["Marine Painter"], "description words count");
    assert.deepEqual(run("q=zzz"), []);
  });
  test("category filter is exact; unknown category in a link is ignored", () => {
    assert.deepEqual(run("category=Aquaculture"), ["Marine Painter"]);
    assert.equal(run("category=Astronaut").length, FIX.length);
  });
  test("a null-category job is listed unfiltered and never breaks facets", () => {
    assert.ok(run("").includes("Remote Analyst"));
    const f = F.buildFacets(FIX);
    assert.ok(f.categories.every((c) => T.JOB_CATEGORIES.includes(c)));
    assert.ok(!f.categories.includes(null));
  });
});

describe("Filters: location, employment, workplace, salary, employer", () => {
  test("location facet is generated from live data: only areas that have a job, in canonical order, with counts", () => {
    const f = F.buildFacets(FIX).locations;
    assert.deepEqual(f.map((x) => x.value), ["Lerwick", "South Mainland", "Whalsay", "Yell"]);
    assert.equal(f.find((x) => x.value === "Lerwick").count, 5);
  });
  test("location filter (multi = OR); null-locality jobs only appear when no location is chosen", () => {
    assert.deepEqual(run("loc=Yell"), ["Hourly Cleaner"]);
    assert.equal(run("loc=Yell&loc=Whalsay").length, 2);
    assert.ok(!run("loc=Lerwick").includes("Bank Pharmacy Worker"));
    assert.ok(run("").includes("Bank Pharmacy Worker"));
  });
  test("employment: Full-time / Part-time / Permanent / Temporary+Fixed-term / Casual+Relief / Apprenticeship", () => {
    assert.ok(run("emp=part-time").includes("Receptionist"));
    assert.ok(run("emp=permanent").includes("Receptionist") && run("emp=permanent").includes("Consultant Surgeon"), "a permanent part-time post is both");
    assert.deepEqual(run("emp=temporary").sort(), ["Domestic Support Worker", "Operations Engineer"]);
    assert.ok(run("emp=casual").includes("Bank Pharmacy Worker"));
    assert.deepEqual(run("emp=apprenticeship"), ["Apprentice Electrician"]);
    assert.ok(!run("emp=casual").includes("Operations Engineer"), "Temporary is never collapsed into Casual");
  });
  test("employment facet only lists options live jobs have", () => {
    const keys = F.buildFacets(FIX.filter((j) => j.contract_type === "full-time")).employment.map((o) => o.key);
    assert.ok(keys.includes("full-time") && !keys.includes("apprenticeship"));
  });
  test("workplace uses explicit evidence only: hybrid/remote columns or source_meta.workplace; the default on_site is not evidence", () => {
    assert.equal(F.workplaceOf(FIX[0]), null);
    assert.equal(F.workplaceOf(FIX[5]), "on_site");
    assert.deepEqual(F.buildFacets(FIX).workplace.map((o) => o.key), ["on_site", "hybrid", "remote"]);
    assert.deepEqual(run("work=remote"), ["Remote Analyst"]);
    assert.deepEqual(run("work=hybrid"), ["Smart Meter Hybrid Role"]);
    assert.deepEqual(F.buildFacets(FIX.slice(0, 4)).workplace, [], "no facet when no job states a workplace");
  });
  test("salary bands use structured ANNUAL pay; hourly is never annualised; jobs without salary are never excluded", () => {
    assert.deepEqual(F.salaryBands(FIX[9]), [], "£12/hour is not turned into a salary");
    assert.deepEqual(F.salaryBands(FIX[4]), ["35-50"]);
    assert.deepEqual(F.salaryBands(FIX[6]), ["25-35", "35-50"], "a range overlapping two bands matches both");
    const r = run("sal=75p");
    assert.ok(r.includes("Consultant Surgeon"));
    assert.ok(!r.includes("Ramp Agent"), "a job whose structured salary is outside the band is excluded");
    assert.ok(r.includes("Hourly Cleaner") && r.includes("Remote Analyst"), "no structured salary -> still shown");
  });
  test("employer facet appears only at 3+ live jobs (dynamic)", () => {
    assert.deepEqual(F.buildFacets(FIX).employers, [{ value: "NHS Shetland", count: 4 }]);
    assert.deepEqual(F.buildFacets(FIX.slice(0, 2)).employers, [], "2 jobs is below the threshold");
    assert.equal(F.EMPLOYER_MIN_JOBS, 3);
    assert.equal(run("employer=NHS Shetland").length, 4);
  });
  test("filters combine (AND across kinds) and with keyword", () => {
    assert.deepEqual(run("employer=NHS Shetland&emp=part-time"), ["Receptionist"]);
    assert.deepEqual(run("q=nhs&loc=Lerwick&emp=temporary"), ["Domestic Support Worker"]);
    assert.deepEqual(run("category=Energy&work=hybrid"), ["Smart Meter Hybrid Role"]);
  });
});

describe("state: count, remove, clear, URL round-trip, zero results", () => {
  test("filter count excludes search, category and sort", () => {
    const f = P("q=a&category=Care&loc=Lerwick&loc=Yell&emp=part-time&work=remote&sal=u25&employer=X&sort=closing");
    assert.equal(F.filterCount(f), 6);
    assert.equal(F.filterCount(P("q=a&category=Care")), 0);
  });
  test("each active filter can be removed on its own; Clear all keeps only the sort", () => {
    const f = P("loc=Lerwick&loc=Yell&emp=part-time&sort=closing");
    assert.deepEqual(F.without(f, "locations", "Yell").locations, ["Lerwick"]);
    assert.deepEqual(F.without(f, "employment", "part-time").employment, []);
    assert.equal(F.filterCount(F.clearAll(f)), 0);
    assert.equal(F.clearAll(f).sort, "closing");
    assert.equal(F.toQuery(F.clearAll(f)), "sort=closing");
  });
  test("URL state round-trips exactly (shareable / bookmarkable) and junk values are ignored", () => {
    const s = "q=engineer&category=Energy&loc=Lerwick&loc=Yell&emp=temporary&work=hybrid&sal=25-35&employer=NHS+Shetland&sort=closing";
    const f = P(s);
    assert.deepEqual(P(F.toQuery(f)), f);
    assert.deepEqual(P("loc=Atlantis&emp=zzz&work=moon&sal=free&sort=sideways"), F.EMPTY_FILTERS);
  });
  test("results label: 'N jobs found', singular, and zero", () => {
    assert.equal(F.resultsLabel(47), "47 jobs found");
    assert.equal(F.resultsLabel(1), "1 job found");
    assert.equal(F.resultsLabel(0), "0 jobs");
    assert.equal(run("loc=Yell&emp=apprenticeship").length, 0, "an impossible combination yields no jobs");
  });
});

describe("sorting + urgency", () => {
  test("Newest: featured first, then listed_at (source publication date), not import time", () => {
    const a = job("Published recently, imported long ago", { listed_at: day(-1), posted_at: day(-60) });
    const b = job("Published long ago, imported today", { listed_at: day(-40), posted_at: day(0) });
    assert.deepEqual(ids(F.sortJobs([b, a], "newest")), [a.title, b.title]);
    const feat = job("Featured", { is_featured: true, listed_at: day(-90) });
    assert.equal(F.sortJobs([a, feat], "newest")[0].title, "Featured");
  });
  test("Closing soon: soonest closing first, undated last", () => {
    const r = ids(F.sortJobs(FIX, "closing"));
    assert.equal(r[0], "Domestic Support Worker");
    assert.equal(r[r.length - 1], "Council Teacher");
  });
  test("closing urgency wording", () => {
    assert.equal(T.closingLabel(day(0.4), NOW), "Closes today");
    assert.equal(T.closingLabel(day(1), NOW), "Closes tomorrow");
    assert.equal(T.closingLabel(day(3), NOW), "Closes in 3 days");
    assert.match(T.closingLabel(day(20), NOW), /^Closes \d+ \w+$/);
    assert.match(read("components/jobs/JobsUI.tsx"), /data-urgent=/);
  });
});

describe("live data rules", () => {
  let data;
  before(async () => {
    mock.timers.enable({ apis: ["Date"], now: NOW });
    setViewer("anon");
    setDb({ jobs: [
      job("Live", {}), job("Expired", { expires_at: day(-1) }), job("Hidden private import", { is_hidden: true }), job("Closed", { status: "closed" }),
      job("No salary no locality no category no description", {}),
    ] });
    data = await import("../lib/jobs-data.ts");
  });
  after(() => mock.timers.reset());
  test("expired, hidden (privately imported) and closed jobs never reach the page", async () => {
    const t = (await data.getActiveJobs()).map((j) => j.title);
    assert.ok(t.includes("Live"));
    assert.ok(!t.includes("Expired") && !t.includes("Hidden private import") && !t.includes("Closed"));
  });
  test("a job with null salary, locality, category and description still lists, filters nothing out, and facets cope", async () => {
    const all = await data.getActiveJobs();
    assert.ok(all.some((j) => j.title.startsWith("No salary")));
    assert.doesNotThrow(() => F.buildFacets(all));
    assert.equal(F.applyFilters(all, P("sal=u25")).length, all.length);
  });
});

describe("UI structure (desktop + mobile)", () => {
  const page = read("app/jobs/page.tsx"), panel = read("components/jobs/JobFiltersPanel.tsx"), ui = read("components/jobs/JobsUI.tsx"), detail = read("app/jobs/[id]/page.tsx");
  test("search and category stay visible; one Filters control sits beside the category chips", () => {
    assert.match(page, /placeholder=\{isShifts \? "Search shifts/);
    assert.match(page, /<JobFiltersPanel facets=\{facets\} filters=\{filters\}/);
    assert.equal((page.match(/<JobFiltersPanel/g) ?? []).length, 1);
  });
  test("Filters (n) label, Clear all, per-filter remove chips, results count, zero-results state", () => {
    assert.match(panel, /Filters \(\$\{n\}\)/);
    assert.match(panel, /Clear all/);
    assert.match(page, /data-testid="results-count"/);
    assert.match(page, /data-testid="active-filter"/);
    assert.match(page, /No jobs match those filters\./);
    assert.match(page, /Clear filters/); assert.match(page, /View all jobs/);
  });
  test("panel is a bottom sheet on phones and a dropdown on desktop; it is a GET form (URL state); empty groups are never rendered", () => {
    assert.match(panel, /fixed inset-x-0 bottom-0/);
    assert.match(panel, /md:absolute/);
    assert.match(panel, /method="get"/);
    assert.match(panel, /facets\.locations\.length > 0 && section\("Location"/);
    assert.match(panel, /if \(!has\) return null/);
    assert.match(panel, /Jobs with no stated salary are still shown\./);
  });
  test("sort control offers Newest and Closing soon", () => {
    assert.match(page, />Newest</); assert.match(page, />Closing soon</);
  });
  test("external jobs: Apply for this job -> original url; employer logo comes from the shared employer, not the vacancy", () => {
    assert.match(detail, /Apply for this job ↗/);
    assert.match(ui, /jobDisplayBusiness\(job\)/);
    assert.match(read("lib/jobs-data.ts"), /external_employer_logo_url \?\? null/);
  });
});
