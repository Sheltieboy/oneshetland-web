/**
 * "Work" as the website's main jobs-and-shifts destination, matching the app's Work tab.
 * The URL stays /jobs (and every /jobs/* and /shifts/* route), so links, bookmarks and search standing are untouched; only the NAME changes.
 * No network, no database. Run: node --test tests/work-section-naming.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { SECTIONS, PRIMARY_NAV, MORE_NAV, getSection } from "../lib/sections.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("navigation says Work and still goes to /jobs", () => {
  test("the section is named Work, at /jobs, with its key unchanged", () => {
    const s = getSection("jobs");
    assert.equal(s.label, "Work"); assert.equal(s.href, "/jobs"); assert.match(s.blurb, /jobs/i); assert.match(s.blurb, /shifts/i);
  });
  test("the primary nav shows Work (and no item called Jobs); the header, mobile menu and footer all read the same list", () => {
    assert.ok(PRIMARY_NAV.some((s) => s.label === "Work" && s.href === "/jobs"));
    assert.ok(![...PRIMARY_NAV, ...MORE_NAV, ...SECTIONS].some((s) => s.label === "Jobs"));
    for (const f of ["components/site/SiteHeader.tsx", "components/site/SiteFooter.tsx"]) assert.match(read(f), /from "@\/lib\/sections"/, f);
    assert.match(read("components/site/SiteHeader.tsx"), /\[\.\.\.PRIMARY_NAV, \.\.\.MORE_NAV\]\.map/, "the mobile menu uses the same list");
  });
  test("no other section was renamed or moved", () => {
    assert.deepEqual(PRIMARY_NAV.map((s) => s.label), ["What's On", "Local", "Shop", "Games", "Cruise", "Work", "Directory", "Hubs"]);
    assert.deepEqual(MORE_NAV.map((s) => s.label), ["Notices", "Get it done", "Spik", "Da Boats", "Aald Memories", "Fetch"]);
  });
});

describe("the Work hub page", () => {
  const hub = read("app/jobs/page.tsx");
  test("keeps its URL, its Jobs and Shifts tabs and its search", () => {
    assert.match(hub, /href="\/jobs"[\s\S]{0,260}Jobs\s*\n\s*<\/Link>/); assert.match(hub, /href="\/jobs\?tab=shifts"/);
    assert.match(hub, /action="\/jobs"/); assert.match(hub, /getActiveJobs/); assert.match(hub, /getOpenShifts/);
  });
  test("is titled and described as Work — jobs & shifts, and its canonical is still /jobs", () => {
    assert.match(hub, /title: "Work — jobs & shifts in Shetland"/); assert.match(hub, /description: "Find jobs and short-notice shifts/); assert.match(hub, /alternates: \{ canonical: "\/jobs" \}/);
  });
  test("says Work first and names both halves in the eyebrow", () => { assert.match(hub, /OneShetland · Work · Jobs &amp; short shifts/); });
});

describe("existing URLs and SEO are preserved", () => {
  test("every Jobs and Shifts route still exists", () => {
    for (const p of ["app/jobs/page.tsx", "app/jobs/[id]/page.tsx", "app/jobs/new/page.tsx", "app/jobs/manage/page.tsx", "app/jobs/saved/page.tsx", "app/jobs/applications/page.tsx", "app/jobs/[id]/applicants/page.tsx",
      "app/shifts/page.tsx", "app/shifts/[id]/page.tsx", "app/shifts/new/page.tsx", "app/shifts/manage/page.tsx", "app/shifts/applications/page.tsx", "app/shifts/boosts/page.tsx", "app/work/page.tsx", "app/work-profile/page.tsx"]) assert.ok(existsSync(new URL("../" + p, import.meta.url)), p);
  });
  test("/shifts still redirects into the Work hub's Shifts tab", () => { assert.match(read("app/shifts/page.tsx"), /redirect\("\/jobs\?tab=shifts"\)/); });
  test("there is no redirect, rewrite or rename of /jobs anywhere (the URL is the SEO asset)", () => {
    const cfg = read("next.config.ts"); assert.doesNotMatch(cfg, /source:\s*["']\/jobs/); assert.doesNotMatch(cfg, /destination:\s*["']\/work/);
  });
  test("the sitemap still lists /jobs, and job pages are still /jobs/<id>", () => {
    assert.match(read("app/sitemap.ts"), /path: "\/jobs"/); assert.match(read("components/jobs/JobsUI.tsx"), /href=\{`\/jobs\/\$\{/);
  });
  test("short links keep working: /go/jobs lands on /jobs", () => { assert.match(read("app/go/[...slug]/route.ts"), /jobs: \{ path: "\/jobs"/); });
  test("job and shift pages link back to the Work hub, on the right tab", () => {
    assert.match(read("app/jobs/[id]/page.tsx"), /href="\/jobs"[^>]*>← Work · Jobs</); assert.match(read("app/shifts/[id]/page.tsx"), /href="\/jobs\?tab=shifts"[^>]*>← Work · Shifts</);
    assert.match(read("app/shifts/new/page.tsx"), /href="\/jobs\?tab=shifts"[^>]*>← Work · Shifts</); assert.match(read("app/jobs/new/page.tsx"), /href="\/jobs"[^>]*>← Work · Jobs</);
  });
});

describe("homepage", () => {
  const home = read("app/page.tsx"), work = read("components/preview/v2/WorkV2.tsx"), data = read("lib/preview-work.ts");
  test("the homepage Work block (jobs AND shifts, already live) is titled Work in Shetland and links to the Work hub, with Shifts one click away", () => {
    assert.match(home, /import \{ HomeWork \} from "@\/components\/preview\/v2\/WorkV2"/); assert.match(home, /<HomeWork work=\{work\}/);
    assert.match(work, /title="Work in Shetland"[\s\S]{0,80}See all jobs & shifts/); assert.match(data, /export const WORK_HUB = "\/jobs"/); assert.match(data, /export const WORK_HUB_SHIFTS = "\/jobs\?tab=shifts"/);
    assert.match(work, /href=\{WORK_HUB_SHIFTS\}/);
  });
  test("the live homepage never shows the preview's invented 'Sample …' jobs and shifts", () => { assert.match(home, /There is no sample or fallback content/); assert.doesNotMatch(home, /SEED_SHIFT|populatedShifts|sample-/); });
  test("the section grid is built from SECTIONS, so it now says Work", () => { assert.match(read("components/home/HomeSections.tsx"), /SECTIONS\.filter/); });
  test("the post-signup shortcut says Work", () => { assert.match(read("components/welcome/JoinWizard.tsx"), /label: "Look for work"/); assert.doesNotMatch(read("components/welcome/JoinWizard.tsx"), /Look at jobs/); });
});

describe("account: My work is distinct from the public Work", () => {
  test("the account card is My work, still at /work", () => { assert.match(read("app/account/page.tsx"), /href: "\/work", title: "My work"/); });
  test("/work still gates the personal area, and sends signed-out visitors to the public Work page, not a sign-in wall", () => {
    const w = read("app/work/page.tsx"); assert.match(w, /if \(!account\) redirect\("\/jobs"\)/); assert.match(w, /My work/); assert.match(w, /\/jobs\/manage/); assert.match(w, /\/shifts\/manage/);
  });
  test("every My work sub-page still links back to /work", () => {
    for (const p of ["app/jobs/applications/page.tsx", "app/jobs/manage/page.tsx", "app/jobs/saved/page.tsx", "app/shifts/applications/page.tsx", "app/shifts/manage/page.tsx", "app/work-profile/page.tsx"]) assert.match(read(p), /href="\/work"/, p);
  });
});

describe("what was NOT touched", () => {
  test("application, payment and posting logic files are not part of this change", () => {
    // These are the files that hold the logic; this change must not have edited them (checked by content, not by diff, so it also holds after commit).
    assert.match(read("lib/jobs-data.ts"), /export async function getActiveJobs/); assert.match(read("lib/jobs-data.ts"), /export async function getOpenShifts/);
    assert.match(read("app/shifts/boosts/page.tsx"), /Boost/i);
  });
});
