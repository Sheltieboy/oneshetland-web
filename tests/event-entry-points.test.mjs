/**
 * "Add an Event or Activity" entry points: hidden unless EVENT_FRONT_DOOR === "on"; when hidden, nothing is added anywhere; when on, each surface
 * carries exactly one link to /whats-on/add. Pages and components are RENDERED (react-dom/server) with the in-memory fake supabase; nothing touches a network.
 * Run: node --test --import ./tests/support/register-jsx.mjs tests/event-entry-points.test.mjs
 */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import fake, { setDb, setViewer } from "./support/fake-supabase.mjs";
import { ADD_EVENT_HREF, ADD_EVENT_LABEL, ADD_EVENT_MENU_LABEL, ADD_EVENT_EMPTY_PROMPT, entryPointsEnabled, entryPointProps } from "../lib/event-entry-points.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ORIGINAL = process.env.EVENT_FRONT_DOOR;
const flag = (v) => { if (v === undefined) delete process.env.EVENT_FRONT_DOOR; else process.env.EVENT_FRONT_DOOR = v; };
after(() => flag(ORIGINAL));
beforeEach(() => { flag(undefined); setViewer("anon"); setDb({ events: [] }); });
const count = (html, needle) => html.split(needle).length - 1;
const hrefCount = (html) => count(html, `href="${ADD_EVENT_HREF}"`);

const OLD_EMPTY = "New events are added all the time and appear here";
const OLD_FOOTER = "Run a class or group? Businesses and hubs can list regular activities free from their Manage screen";

describe("the switch", () => {
  test("on only for exactly 'on'; everything else is off", () => {
    assert.equal(entryPointsEnabled({ EVENT_FRONT_DOOR: "on" }), true);
    for (const v of [undefined, "", "off", "ON", "On", "true", "1", " on", "on ", "yes"]) assert.equal(entryPointsEnabled({ EVENT_FRONT_DOOR: v }), false, String(v));
    flag("on"); assert.equal(entryPointsEnabled(), true); flag("true"); assert.equal(entryPointsEnabled(), false);
  });
  test("the prop spread is absent when off (so the page bytes do not change) and exactly {addEvent:true} when on", () => {
    assert.deepEqual(entryPointProps({}), {}); assert.equal("addEvent" in entryPointProps({ EVENT_FRONT_DOOR: "off" }), false);
    assert.deepEqual(entryPointProps({ EVENT_FRONT_DOOR: "on" }), { addEvent: true });
  });
  test("the destination and words", () => {
    assert.equal(ADD_EVENT_HREF, "/whats-on/add"); assert.equal(ADD_EVENT_LABEL, "Add an Event or Activity"); assert.equal(ADD_EVENT_MENU_LABEL, "Add an event or activity");
  });
  test("the switch is server-only: no NEXT_PUBLIC variable anywhere in the new code, and nothing reads the viewer's role", () => {
    for (const f of ["lib/event-entry-points.ts", "components/events/AddEventEntry.tsx", "components/site/MobileMenu.tsx", "components/site/SiteHeader.tsx", "components/account/AccountSidebar.tsx"]) {
      const src = read(f); assert.doesNotMatch(src, /NEXT_PUBLIC_EVENT|role ===|isAdmin\(/, f);
    }
    assert.doesNotMatch(read("components/events/AddEventEntry.tsx"), /"use client"/, "a server component");
    assert.match(read("lib/event-entry-points.ts"), /EVENT_FRONT_DOOR === "on"/);
  });
});

describe("AddEventEntry", async () => {
  const { AddEventEntry } = await import("../components/events/AddEventEntry.tsx");
  for (const variant of ["button", "card", "link"]) {
    test(`${variant}: nothing when off, one real text link when on`, () => {
      assert.equal(renderToStaticMarkup(h(AddEventEntry, { variant })), "");
      flag("true"); assert.equal(renderToStaticMarkup(h(AddEventEntry, { variant })), "", "'true' is not 'on'");
      flag("on"); const html = renderToStaticMarkup(h(AddEventEntry, { variant }));
      assert.equal(hrefCount(html), 1); assert.equal(count(html, ADD_EVENT_LABEL), 1); assert.doesNotMatch(html, /<svg|aria-hidden/, "words, not an icon");
      assert.match(html, /focus-visible:outline/); if (variant !== "link") assert.match(html, /min-h-\[44px\]/);
    });
  }
});

describe("What's On (events)", async () => {
  const page = (await import("../app/whats-on/page.tsx")).default;
  const render = async (sp = {}) => renderToStaticMarkup(await page({ searchParams: Promise.resolve(sp) }));
  const withEvent = () => setDb({ events: [{ id: "e1", title: "Gig", category: "Music", status: "published", is_hidden: false, venue: "Mareel", locality: "Lerwick", starts_at: new Date(Date.now() + 5 * 864e5).toISOString(), ends_at: null, cover_url: null, price_text: null, has_tickets: false, is_featured: false, organiser_hub_id: null, organiser_business_id: null, calendar_approved: true, business: null, hub: null, ticket_types: [] }] });

  test("OFF: no entry point, today's empty-state wording, and no layout wrapper change", async () => {
    for (const v of [undefined, "off", "true"]) {
      flag(v); const html = await render();
      assert.equal(hrefCount(html), 0); assert.doesNotMatch(html, /Add an Event or Activity|tell us about something/);
      assert.ok(html.includes(OLD_EMPTY)); assert.ok(html.includes('<div class="mx-auto max-w-6xl px-5 py-2.5"><nav aria-label="What&#x27;s On sections"'), "tabs row exactly as before");
    }
  });
  test("ON with events: exactly one entry point (beside the Events / Regular activities switch)", async () => {
    flag("on"); withEvent(); const html = await render(); assert.equal(hrefCount(html), 1); assert.equal(count(html, ADD_EVENT_LABEL), 1);
    assert.ok(html.indexOf(`href="${ADD_EVENT_HREF}"`) > html.indexOf("What&#x27;s On sections"), "after the tabs in the same row");
  });
  test("ON, nothing listed: the header entry plus ONE in the empty state, which replaces the old sentence", async () => {
    flag("on"); const html = await render(); assert.equal(hrefCount(html), 2, "tabs row + empty state"); assert.ok(!html.includes(OLD_EMPTY)); assert.ok(html.includes(ADD_EVENT_EMPTY_PROMPT));
  });
  test("ON, a filtered view with no results also gets the prompt, and 'See all events' is untouched", async () => {
    flag("on"); const html = await render({ date: "week" }); assert.ok(html.includes("See all events")); assert.equal(hrefCount(html), 2);
  });
  test("ON, calendar view: header entry only", async () => {
    flag("on"); const html = await render({ view: "calendar" }); assert.equal(hrefCount(html), 1);
  });
});

describe("Regular activities", async () => {
  const page = (await import("../app/whats-on/regular/page.tsx")).default;
  const render = async (sp = {}) => renderToStaticMarkup(await page({ searchParams: Promise.resolve(sp) }));
  test("OFF: no entry point and the footer sentence is exactly today's", async () => {
    for (const v of [undefined, "off"]) {
      flag(v); const html = await render(); assert.equal(hrefCount(html), 0); assert.doesNotMatch(html, /Add an Event or Activity|Not sure where to start/);
      assert.ok(html.includes(OLD_FOOTER)); assert.ok(html.includes('<div class="mx-auto max-w-6xl px-5 py-2.5"><nav aria-label="What&#x27;s On sections"'));
    }
  });
  test("ON: a header entry and a linked footer, worded accurately (a Business or a Hub); never a promise that a member can submit alone", async () => {
    flag("on"); const html = await render(); assert.equal(hrefCount(html), 2, "header + footer link"); assert.equal(count(html, ADD_EVENT_LABEL), 2);
    assert.ok(html.includes("run from a Business or a Hub")); assert.ok(!html.includes(OLD_FOOTER) || html.includes("Manage screen")); assert.doesNotMatch(html, /anyone can (list|add|submit)|you can add a regular/i);
  });
});

describe("account area", async () => {
  const { AccountSidebar } = await import("../components/account/AccountSidebar.tsx");
  const side = (props) => renderToStaticMarkup(h(AccountSidebar, { isAdmin: false, isBusiness: false, ...props }));
  test("sidebar: absent without the prop (and with false); one link when passed", () => {
    assert.equal(hrefCount(side({})), 0); assert.equal(hrefCount(side({ addEvent: false })), 0);
    const html = side({ addEvent: true }); assert.equal(hrefCount(html), 1); assert.equal(count(html, ADD_EVENT_LABEL), 1);
    assert.ok(html.indexOf("Hubs I manage") < html.indexOf(ADD_EVENT_LABEL), "after the hubs link, in 'Your OneShetland'");
  });
  test("sidebar: the rest is byte-identical with the prop off vs. the old list (same links in the same order)", () => {
    const off = side({}); const on = side({ addEvent: true });
    assert.equal(on.replace(/<a href="\/whats-on\/add"[^>]*>.*?<\/a>/, ""), off);
  });
  test("the account layout and the root layout pass the prop only through entryPointProps() (absent when off)", () => {
    assert.match(read("app/account/layout.tsx"), /<AccountSidebar isAdmin=\{isAdmin\} isBusiness=\{isBusiness\} \{\.\.\.entryPointProps\(\)\} \/>/);
    assert.match(read("app/layout.tsx"), /<SiteHeader user=\{user\} fetchStatus=\{fetchStatus\} \{\.\.\.entryPointProps\(\)\} \/>/);
  });
  test("overview page (rendered, signed in): no card when off; exactly one card when on, and the other cards are unchanged", async () => {
    fake.auth.getUser = async () => ({ data: { user: { id: "u1", email: "ann@example.com" } } });
    setDb({ profiles: [{ id: "u1", role: "member", display_name: "Ann" }] });
    const overview = (await import("../app/account/page.tsx")).default;
    const off = renderToStaticMarkup(await overview()); assert.equal(hrefCount(off), 0); assert.doesNotMatch(off, /Add an Event or Activity/);
    flag("on"); const on = renderToStaticMarkup(await overview()); assert.equal(hrefCount(on), 1); assert.equal(count(on, ADD_EVENT_LABEL), 1);
    assert.equal(on.replace(/<a href="\/whats-on\/add"[^>]*>.*?<\/a>/, ""), off, "removing the one card gives today's page exactly");
    fake.auth.getUser = async () => ({ data: { user: null } });
  });
});

describe("mobile menu", async () => {
  globalThis.document = { body: {} };
  const { MobileMenu } = await import("../components/site/MobileMenu.tsx");
  const menu = (props) => renderToStaticMarkup(h(MobileMenu, { onClose() {}, user: null, signInHref: "/sign-in?next=/", headerRef: { current: null }, toggleRef: { current: null }, ...props }));
  test("absent when not passed; one quiet item when passed, directly under the featured What's On tiles and before the next group", () => {
    assert.equal(hrefCount(menu({})), 0); assert.equal(hrefCount(menu({ addEvent: false })), 0);
    const html = menu({ addEvent: true }); assert.equal(hrefCount(html), 1); assert.equal(count(html, ADD_EVENT_MENU_LABEL), 1);
    assert.ok(html.indexOf('href="/whats-on"') < html.indexOf(ADD_EVENT_MENU_LABEL)); assert.ok(html.indexOf(ADD_EVENT_MENU_LABEL) < html.indexOf("Find &amp; get things done"));
    assert.match(html, /min-h-\[48px\][^"]*focus-visible:outline/);
  });
  test("with it off the menu is byte-identical to the old menu apart from the single link", () => {
    const off = menu({}); const on = menu({ addEvent: true });
    assert.equal(on.replace(/<a href="\/whats-on\/add"[^>]*>.*?<\/a>/, ""), off);
  });
  test("the header hands the menu only a boolean, and there is no desktop-header entry (the desktop nav is unchanged)", () => {
    const header = read("components/site/SiteHeader.tsx"); assert.match(header, /addEvent=\{addEvent\}/); assert.doesNotMatch(header, /ADD_EVENT|whats-on\/add/);
  });
});

describe("pages that must not change", () => {
  test("the event page, footer and 'Organised by' area carry no entry point", () => {
    for (const f of ["app/whats-on/[id]/page.tsx", "components/site/SiteFooter.tsx", "components/events/PerformancesList.tsx"]) { let s = ""; try { s = read(f); } catch {} assert.doesNotMatch(s, /AddEventEntry|event-entry-points|whats-on\/add/, f); }
  });
  test("no new wording anywhere suggests a member can run a Regular Activity alone", () => {
    for (const f of ["app/whats-on/regular/page.tsx", "lib/event-entry-points.ts", "app/community-guidelines/page.tsx"]) assert.doesNotMatch(read(f), /(your own|add your own) regular activit/i, f);
  });
});

describe("Community Guidelines (not gated)", async () => {
  const page = (await import("../app/community-guidelines/page.tsx")).default;
  const html = renderToStaticMarkup(h(page));
  test("present with the flag off, and the existing sections are all still there", () => {
    for (const t of ["Be kind and respectful", "Be honest", "Respect privacy", "Keep it legal and safe", "Trading fairly", "Reporting &amp; enforcement", "Sharing events and activities"]) assert.ok(html.includes(t), t);
  });
  test("covers the agreed points, in plain words, and never says 'wee'", () => {
    for (const t of ["18 or over", "responsible for it being accurate", "organiser&rsquo;s permission", "checked by our team before they appear", "ask for changes, or decline", "An adult from the organisation must submit", "do not have their own accounts", "parent&rsquo;s or guardian&rsquo;s permission", "Business or a Hub"]) assert.ok(html.includes(t) || html.includes(t.replace(/&rsquo;/g, "’")), t);
    assert.doesNotMatch(html, /\bwee\b/i);
  });
});
