/**
 * Jobs Stage 2 — structural readiness (web).
 *
 * WHAT THIS EXERCISES
 * The REAL query code (getJobs, getJobCategoriesInUse, getBusinessEventsAndJobs, getDashboardData) over fixture jobs in the in-memory Supabase
 * fake, with fixtures shaped like production: a job's business is `posted_as_business_id` — there is NO `business_id` column on jobs.
 * Plus the real shared vocabulary (lib/job-taxonomy.ts) and wiring assertions on the page/form sources.
 *
 * WHAT WAS WRONG (Stage 1 audit, 30 Oct 2026)
 *   · the business page's jobs list, the owner dashboard's application count and the app's business home all filtered jobs on `business_id`,
 *     a column that does not exist, so a business's own jobs never appeared there;
 *   · every one of 30 jobs had a NULL category, so all 16 category chips led to "No jobs match";
 *   · "Temporary" was stored as "casual"; cards never said when a job closes; the post form computed a closing date and never sent it.
 *
 * SAFETY: no network, no Supabase project, no production access of any kind. Fixtures only.
 * Run: node --test --import ./tests/support/register.mjs tests/jobs-stage2.test.mjs
 */
import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDb, setViewer } from "./support/fake-supabase.mjs";
import * as T from "../lib/job-taxonomy.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = Date.parse("2026-10-30T12:00:00Z");
const day = (d) => new Date(NOW + d * 86400_000).toISOString();

let n = 0;
const job = (title, extra = {}) => ({
  id: `job-${++n}`, employer_id: "user-1", posted_as_business_id: null, title, description: null, category: null, location: null, locality: null,
  contract_type: "full-time", pay_text: null, pay_min: null, pay_max: null, pay_period: null, pay_hidden: false, remote_mode: "on_site",
  relocation_support: false, housing_available: false, is_seasonal: false, season_label: null, apply_url: null, apply_email: null,
  is_featured: false, is_hidden: false, status: "open", expires_at: day(10), posted_at: day(-3), listed_at: day(-3),
  source: null, source_ref: null, source_label: null, source_url: null, source_reference: null, source_published_at: null, source_meta: null,
  external_employer_name: null, external_employer_logo_url: null, ...extra,
});

const FIXTURE = {
  jobs: [
    job("Owned by Biz One", { posted_as_business_id: "biz-1" }),
    job("Owned by Biz One (hidden)", { posted_as_business_id: "biz-1", is_hidden: true }),
    job("Owned by Biz One (expired)", { posted_as_business_id: "biz-1", expires_at: day(-1) }),
    job("Owned by Biz Two", { posted_as_business_id: "biz-2" }),
    job("Care Job", { category: "Care" }),
    job("Teaching Job", { category: "Education" }),
    job("Uncategorised Job"),
    job("Odd Category Job", { category: "Astronaut" }),
    job("Temp Teacher", { contract_type: "temporary", source: "myjobscotland", source_ref: "1", source_label: "via myjobscotland", external_employer_name: "Shetland Islands Council" }),
    job("Expired Care Job", { category: "Care", expires_at: day(-2) }),
    job("Older first-seen, newer published", { posted_at: day(-20), source_published_at: day(-1), listed_at: day(-1), source: "myjobscotland", source_ref: "2", source_reference: "SIC09073" }),
    job("Newer first-seen, older published", { posted_at: day(-1), source_published_at: day(-30), listed_at: day(-30), source: "myjobscotland", source_ref: "3", source_reference: "SIC09000" }),
  ],
  job_applications: [
    { id: "a1", job_id: "job-1", status: "applied" }, { id: "a2", job_id: "job-1", status: "applied" },
    { id: "a3", job_id: "job-1", status: "viewed" }, { id: "a4", job_id: "job-4", status: "applied" },
  ],
};

let data, local, dash;
before(async () => {
  mock.timers.enable({ apis: ["Date"], now: NOW });
  setViewer("anon"); setDb(FIXTURE);
  data = await import("../lib/jobs-data.ts");
  local = await import("../lib/local-data.ts");
  dash = await import("../lib/business-dashboard.server.ts");
});
after(() => mock.timers.reset());
const titles = (rows) => rows.map((r) => r.title);

describe("business-owned jobs use posted_as_business_id", () => {
  test("CONTROL: filtering on the old non-existent column matches nothing", async () => {
    const { publicClient } = await import("../lib/supabase/public.ts");
    const { data: rows } = await publicClient().from("jobs").select("id").eq("business_id", "biz-1");
    assert.equal(rows.length, 0);
  });
  test("a business's page lists its own live jobs — not hidden, not expired, not another business's", async () => {
    const { jobs } = await local.getBusinessEventsAndJobs("biz-1");
    assert.deepEqual(titles(jobs), ["Owned by Biz One"]);
  });
  test("the owner dashboard counts applications on the business's own jobs (and only those, and only 'applied')", async () => {
    const d = await dash.getDashboardData("biz-1");
    assert.equal(d.needs.jobApplications, 2);
    const d2 = await dash.getDashboardData("biz-2");
    assert.equal(d2.needs.jobApplications, 1);
  });
  test("no remaining reader filters jobs on business_id (web source scan)", () => {
    for (const f of ["lib/local-data.ts", "lib/business-dashboard.server.ts", "lib/jobs-data.ts", "lib/jobs-data.server.ts"]) {
      const src = read(f);
      assert.doesNotMatch(src, /from\("jobs"\)[^;]{0,200}\.eq\("business_id"/s, f);
    }
  });
});

describe("categories", () => {
  test("the filter returns exactly that category; live only", async () => {
    assert.deepEqual(titles(await data.getJobs({ category: "Care" })), ["Care Job"]);
    assert.deepEqual(titles(await data.getJobs({ category: "Education" })), ["Teaching Job"]);
  });
  test("a category that is not in the vocabulary is ignored — the page never breaks or empties because of a stale link", async () => {
    const all = titles(await data.getJobs({}));
    assert.deepEqual(titles(await data.getJobs({ category: "Astronaut" })), all);
  });
  test("null-category and odd-category jobs are listed and do not break anything", async () => {
    const all = titles(await data.getJobs({}));
    assert.ok(all.includes("Uncategorised Job") && all.includes("Odd Category Job"));
  });
  test("chips come only from categories live jobs have (an expired job's category does not count)", async () => {
    assert.deepEqual(await data.getJobCategoriesInUse(), ["Care", "Education"]);
    setDb({ jobs: FIXTURE.jobs.filter((j) => !j.category || j.category === "Astronaut") });
    assert.deepEqual(await data.getJobCategoriesInUse(), []);
    setDb(FIXTURE);
  });
  test("the web vocabulary is the shared one (16 categories)", () => {
    assert.equal(data.JOB_CATEGORIES.length, 16);
    assert.deepEqual([...data.JOB_CATEGORIES], [...T.JOB_CATEGORIES]);
  });
});

describe("contract type", () => {
  test("Temporary stays Temporary: a stored 'temporary' reads back and is labelled Temporary, not Casual", async () => {
    const [t] = (await data.getJobs({})).filter((j) => j.title === "Temp Teacher");
    assert.equal(t.contract_type, "temporary");
    assert.equal(data.CONTRACT_LABELS[t.contract_type], "Temporary");
    assert.deepEqual(titles(await data.getJobs({ contract_type: "temporary" })), ["Temp Teacher"]);
    assert.equal(titles(await data.getJobs({ contract_type: "casual" })).includes("Temp Teacher"), false);
  });
});

describe("expiry and dates", () => {
  test("expired jobs are never listed", async () => {
    const all = titles(await data.getJobs({}));
    assert.ok(!all.includes("Expired Care Job") && !all.includes("Owned by Biz One (expired)") && !all.includes("Owned by Biz One (hidden)"));
  });
  test("newest first uses the source's publication date when known, not first-seen; first-seen is kept separately", async () => {
    const all = titles(await data.getJobs({}));
    assert.ok(all.indexOf("Older first-seen, newer published") < all.indexOf("Newer first-seen, older published"));
    const [a] = (await data.getJobs({})).filter((j) => j.title === "Older first-seen, newer published");
    assert.notEqual(a.posted_at, a.source_published_at);
    assert.equal(a.source_reference, "SIC09073");
  });
  test("closing date on the card: 'Closes 9 Nov'; nothing invented when absent", () => {
    assert.equal(T.closingLabel(day(10), NOW), "Closes 9 Nov");
    assert.equal(T.closingLabel(null, NOW), "");
    const ui = read("components/jobs/JobsUI.tsx");
    assert.match(ui, /closingLabel\(job\.expires_at\)/);
    assert.match(ui, /data-testid="job-closing"/);
    assert.match(ui, /\{closing && \(/, "rendered only when there is a closing date");
  });
});

describe("employer posting form", () => {
  const form = read("components/jobs/JobPostForm.tsx");
  test("every listing has a finite closing date: no 'No close date' option, default 30 days, date is actually SENT", () => {
    assert.doesNotMatch(form, /No close date/);
    assert.match(form, /ymdPlus\(EMPLOYER_DEFAULT_DAYS\)/);
    assert.match(form, /apply_email: applyEmail\.trim\(\) \|\| null,\s*expires_at,\s*\};/s, "expires_at must be in the saved row (it was computed but never sent before)");
    assert.match(form, /Your listing closes automatically/);
    assert.match(form, /closes \{EMPLOYER_DEFAULT_DAYS\} days after you post it/);
  });
  test("editing keeps the stored closing instant unless the employer changes the date; past dates are refused", () => {
    assert.match(form, /unchanged \? existing!\.expires_at/);
    assert.match(form, /must be in the future/);
    assert.match(read("app/jobs/new/page.tsx"), /expires_at: existing\.expires_at/);
  });
  test("the default and the chosen-date instant behave: 30 days ahead, end of that Shetland day", () => {
    assert.equal(T.defaultExpiryIso(NOW), "2026-11-29T12:00:00.000Z");
    assert.equal(T.closingInstantForDate("2026-11-29"), "2026-11-29T23:59:59.000Z");
  });
});

describe("external jobs", () => {
  const page = read("app/jobs/[id]/page.tsx");
  test("the primary CTA is 'Apply for this job' and goes to the ORIGINAL url; no internal application panel", () => {
    assert.match(page, /external \? \(/);
    assert.match(page, /href=\{job\.apply_url\}[^>]*>\s*Apply for this job ↗/s);
    assert.ok(page.indexOf("Apply for this job") < page.indexOf("<JobApplyPanel"), "external branch precedes the in-app panel");
  });
  test("attribution survives: employer name, 'Listed via …', reference and original listing link", () => {
    assert.match(page, /Listed \{job\.source_label\}/);
    assert.match(page, /View the original listing/);
    assert.match(page, /label: "Reference", value: job\.source_reference/);
  });
  test("isExternalJob is true for any sourced job, false for a direct posting", () => {
    assert.equal(data.isExternalJob({ source: "myjobscotland" }), true);
    assert.equal(data.isExternalJob({ source: null }), false);
  });
  test("no description renders cleanly: the About section is conditional and the card paragraph is conditional", () => {
    assert.match(page, /\{job\.description && \(\s*<section>/s);
    assert.match(read("components/jobs/JobsUI.tsx"), /\{job\.description && <p/);
  });
});

describe("locality", () => {
  test("detail page shows the Area when set, and card/detail never invent one", () => {
    assert.match(read("app/jobs/[id]/page.tsx"), /job\.locality \? \[\{ label: "Area"/);
    assert.equal(T.areaForLocation("Hendra Ferry, Shetland Islands"), null);
    assert.equal(T.areaForLocation("Whalsay School, Whalsay"), "Whalsay");
  });
});
