/** Get it done launch: eligibility, homepage section, Business Suite invitation, discovery. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { isGetItDoneCategory, getItDoneStatus, GET_IT_DONE_CATEGORIES } from "../lib/get-it-done-eligibility.ts";

await import("./support/register-jsx.mjs");
const { GetItDoneHome } = await import("../components/home/GetItDoneHome.tsx");
const { GetItDoneInvite } = await import("../components/business/GetItDoneInvite.tsx");
const read = (p) => readFileSync(p, "utf8");

describe("category eligibility (by identifier, not keywords)", () => {
  test("services and other are invited; the rest are not", () => {
    assert.deepEqual([...GET_IT_DONE_CATEGORIES], ["services", "other"]);
    for (const c of ["services", "other"]) assert.equal(isGetItDoneCategory(c), true);
    for (const c of ["retail", "food_drink", "tourism", "accommodation", null, undefined, "", "Services", "plumber"]) assert.equal(isGetItDoneCategory(c), false);
  });
  test("every category the database allows is either invited or deliberately not", () => {
    const allowed = ["food_drink", "retail", "services", "tourism", "accommodation", "other"]; // local_businesses_category_check
    assert.deepEqual(allowed.filter(isGetItDoneCategory).sort(), ["other", "services"]);
  });
  test("status text covers not joined / no availability / stale / live", () => {
    assert.equal(getItDoneStatus({ isTrade: false, availabilityLabel: null, availabilityFresh: false }), "Not joined");
    assert.match(getItDoneStatus({ isTrade: true, availabilityLabel: null, availabilityFresh: false }), /availability not set/);
    assert.match(getItDoneStatus({ isTrade: true, availabilityLabel: "Not taking anything on", availabilityFresh: false }), /out of date/);
    assert.equal(getItDoneStatus({ isTrade: true, availabilityLabel: "Taking work on now", availabilityFresh: true }), "Joined: Taking work on now");
  });
});

describe("homepage section", () => {
  const html = renderToStaticMarkup(h(GetItDoneHome));
  test("headline, message, two actions, reassurance", () => {
    assert.match(html, /Need a hand getting something done\?/);
    assert.match(html, /From a leaky tap to a new fence, tell local tradespeople what you need doing\./);
    assert.match(html, /href="\/get-it-done"[^>]*>Post a job</);
    assert.match(html, /href="\/get-it-done#for-trades"[^>]*>I(&#x27;|')m a tradesperson</);
    assert.match(html, /Free to post\. You choose who receives your contact details\./);
  });
  test("no fabricated numbers, testimonials or guarantees", () => {
    const text = html.replace(/<[^>]*>/g, " ").replace(/&#x?[0-9a-f]+;/gi, "'");
    assert.ok(!/\d/.test(text.replace(/\s+/g, " ")), "no digits at all in the visible copy");
    assert.ok(!/guarantee|testimonial|already|waiting|trades are/i.test(text));
  });
  test("placed on the homepage after Work, and it fetches nothing", () => {
    const page = read("app/page.tsx");
    assert.ok(page.indexOf("<GetItDoneHome />") > page.indexOf("<HomeWork"));
    assert.ok(page.indexOf("<GetItDoneHome />") < page.indexOf("<IslandMosaic"));
    assert.ok(!/await|fetch\(|supabase/i.test(read("components/home/GetItDoneHome.tsx")));
  });
});

describe("Business Suite invitation (entitlement-aware)", () => {
  const props = { businessId: "b1", base: "/business/b1/manage", availabilityLabel: null, availabilityFresh: false };
  test("eligible, FREE, not joined: explains the paid entitlement and shows the price, never claims enquiries", () => {
    const html = renderToStaticMarkup(h(GetItDoneInvite, { ...props, eligible: true, isTrade: false, entitled: false }));
    assert.match(html, /Create your business listing for free\. Get it done job enquiries are included with OneShetland Pro \(.12\/mo\) and Premium/);
    assert.match(html, /href="\/business\/b1\/manage\/billing"[^>]*>See Pro \(.12\/mo\)</);
    assert.match(html, /href="\/business\/b1\/manage\/leads"[^>]*>Set up your trade profile</);
    assert.ok(!/Job matching is active|receiving/i.test(html));
  });
  test("eligible, entitled, not joined: invitation to set up job enquiries", () => {
    const html = renderToStaticMarkup(h(GetItDoneInvite, { ...props, eligible: true, isTrade: false, entitled: true }));
    assert.match(html, /Get more job enquiries through OneShetland/);
    assert.match(html, /href="\/business\/b1\/manage\/leads"[^>]*>Set up job enquiries</);
    assert.match(html, /Not now/);
  });
  test("not eligible and not joined: nothing", () => {
    assert.equal(renderToStaticMarkup(h(GetItDoneInvite, { ...props, eligible: false, isTrade: false, entitled: true })), "");
  });
  test("joined + entitled: matching is active, with status and management link", () => {
    const html = renderToStaticMarkup(h(GetItDoneInvite, { ...props, eligible: true, isTrade: true, entitled: true, availabilityLabel: "Taking work on now", availabilityFresh: true }));
    assert.match(html, /Job matching is active/); assert.match(html, /Joined: Taking work on now/); assert.match(html, /Manage job enquiries/);
    assert.ok(!/Not now|not being matched/.test(html));
  });
  test("joined but FREE/expired: honest, not described as receiving enquiries", () => {
    const html = renderToStaticMarkup(h(GetItDoneInvite, { ...props, eligible: true, isTrade: true, entitled: false, availabilityLabel: "Taking work on now", availabilityFresh: true }));
    assert.match(html, /not being matched to new jobs/); assert.match(html, /See Pro and Premium/);
    assert.ok(!/Job matching is active|Manage job enquiries/.test(html));
  });
  test("wired into the dashboard with the real category and ownership-gated page", () => {
    const src = read("app/business/[id]/manage/page.tsx");
    assert.match(src, /eligible=\{isGetItDoneCategory\(business\.category\)\}/);
    assert.match(src, /requireBusinessOwner/);
  });
  test("the profile editor points an eligible category at job enquiries", () => {
    const src = read("components/business/ProfileManager.tsx");
    assert.match(src, /isGetItDoneCategory\(f\.category\)/);
    assert.match(src, /manage\/leads/);
  });
});

describe("discovery and honesty", () => {
  test("the Get it done page separates the two audiences and has real anchors", () => {
    const src = read("app/get-it-done/page.tsx");
    assert.match(src, /I need a job done/); assert.match(src, /I provide a trade or service/);
    assert.match(src, /href="#post-a-job"/); assert.match(src, /id="post-a-job"/);
    assert.match(src, /href="#for-trades"/); assert.match(src, /id="for-trades"/);
  });
  test("no copy claims a notification is guaranteed", () => {
    const all = read("app/get-it-done/page.tsx") + read("app/business/[id]/manage/leads/page.tsx");
    assert.ok(!/You get a notification with the job/.test(all));
    assert.match(all, /where you have the OneShetland app/);
  });
  test("every internal link in the new surfaces points to a real route", () => {
    for (const d of ["app/get-it-done", "app/business/leads", "app/directory/new", "app/business"]) assert.ok(existsSync(d), d);
  });
});

describe("paid entitlement presentation", async () => {
  const { jobMatchingActive, PRO_PRICE, GID_PLAN_LINE } = await import("../lib/get-it-done-entitlement.ts");
  test("mirrors the database rule: live pro/premium tier AND unexpired subscription_until, fail closed", () => {
    const now = Date.parse("2026-11-07T12:00:00Z"), future = "2026-12-01T00:00:00Z", past = "2026-11-01T00:00:00Z";
    assert.equal(jobMatchingActive("pro", future, now), true);
    assert.equal(jobMatchingActive("premium", future, now), true);
    assert.equal(jobMatchingActive("free", future, now), false);
    assert.equal(jobMatchingActive("pro", past, now), false);
    assert.equal(jobMatchingActive("premium", null, now), false);
    assert.equal(jobMatchingActive("pro", "not a date", now), false);
    assert.equal(jobMatchingActive(null, future, now), false);
  });
  test("one price source and plan wording shared with the plans page", () => {
    assert.equal(PRO_PRICE, "£12/mo");
    assert.match(GID_PLAN_LINE, /Pro \(£12\/mo\) and Premium/);
  });
  test("candidate pre-filter and plan comparison include the entitlement", async () => {
    const { PLAN_COMPARISON, TIER_FEATURES, TIER_PITCH } = await import("../lib/listing-tiers.ts");
    assert.equal(TIER_FEATURES.jobEnquiries, "pro");
    assert.ok(PLAN_COMPARISON.some((r) => r.label === "Get it done job enquiries" && r.tier === "pro"));
    assert.match(TIER_PITCH.pro.blurb, /Get it done job enquiries/);
    assert.match(readFileSync("lib/trades-data.ts", "utf8"), /\.in\("subscription_tier", \["pro", "premium"\]\)/);
  });
  test("leads page tells a free business the truth", () => {
    const src = readFileSync("app/business/[id]/manage/leads/page.tsx", "utf8");
    assert.match(src, /You are not being matched to new jobs/);
    assert.match(src, /Enquiries you have already received stay here/);
    assert.match(src, /New jobs are only matched to businesses on Pro or Premium/);
  });
  test("no remaining 'free to join' job-enquiry claim on the Get it done surfaces", () => {
    const all = ["app/get-it-done/page.tsx", "app/get-it-done/waiting/page.tsx", "app/business/[id]/manage/leads/page.tsx", "components/business/GetItDoneInvite.tsx"].map((f) => readFileSync(f, "utf8")).join("\n");
    assert.ok(!/free to join|It is free to join/i.test(all));
  });
});
