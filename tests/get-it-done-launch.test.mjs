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

describe("Business Suite invitation", () => {
  const props = { businessId: "b1", base: "/business/b1/manage", availabilityLabel: null, availabilityFresh: false };
  test("eligible and not joined: invitation with the right link, nothing automatic", () => {
    const html = renderToStaticMarkup(h(GetItDoneInvite, { ...props, eligible: true, isTrade: false }));
    assert.match(html, /Get more job enquiries through OneShetland/);
    assert.match(html, /href="\/business\/b1\/manage\/leads"[^>]*>Set up job enquiries</);
    assert.match(html, /Not now/);
    assert.match(html, /free to join/i);
  });
  test("not eligible and not joined: nothing", () => {
    assert.equal(renderToStaticMarkup(h(GetItDoneInvite, { ...props, eligible: false, isTrade: false })), "");
  });
  test("joined: status and management link instead of a repeated invitation", () => {
    const html = renderToStaticMarkup(h(GetItDoneInvite, { ...props, eligible: true, isTrade: true, availabilityLabel: "Taking work on now", availabilityFresh: true }));
    assert.match(html, /Joined: Taking work on now/);
    assert.match(html, /Manage job enquiries/);
    assert.ok(!/Get more job enquiries|Not now/.test(html));
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
