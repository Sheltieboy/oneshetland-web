/** Editions R8: one footer, the discovery navigation, the Journal on the home page, update photographs, and the authenticity rules for demonstration imagery. Run: node --test --import ./tests/support/register.mjs tests/editions-journal-nav.test.mjs */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { setDb } from "./support/fake-supabase.mjs";

await import("./support/register-jsx.mjs");
const { Journal, excerpt } = await import("../components/editions/Journal.tsx");
const { UpdatesList } = await import("../components/editions/UpdatesList.tsx");
const { EDITION_OWN_FOOTER } = await import("../components/editions/editorial/HideOnEditionPages.tsx");
const { updateFields } = await import("../lib/editions/validate.ts");
const Layout = (await import("../app/editions/[slug]/layout.tsx")).default;
const Home = (await import("../app/editions/[slug]/page.tsx")).default;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const count = (html, needle) => html.split(needle).length - 1;
const P = (o) => Promise.resolve(o);
const U = (i, o = {}) => ({ id: `u${i}`, edition_id: "e1", title: `ZZ Story ${i}`, body: `Body **${i}** with a [link](https://x.test) and more words to read.`, pinned: false, published_at: `2026-01-0${i}T10:00:00Z`, image_url: null, ...o });
const ORG = { id: "o1", slug: "zz-org", name: "ZZ Org", tagline: null, description: null, logo_url: null, cover_url: null, cover_focus: null, brand_color: "#1f5b5e", website: null, status: "verified", verified_at: null, is_test: false, hub_id: null, created_at: "2026-01-01T00:00:00Z" };
const ED = { id: "e1", organiser_id: "o1", series_id: null, slug: "zz-fest", title: "ZZ Fest", summary: "Summary.", description: "", kind: "multi_day", starts_on: "2099-06-10", ends_on: "2099-06-12", timezone: "Europe/London", year_label: "2099", brand_color: null, logo_url: null, cover_url: null, cover_focus: null, theme: {}, status: "published", published_at: "2026-01-01T00:00:00Z", suspended_reason: null, is_test: false, created_at: "2026-01-01T00:00:00Z" };
const PAGE = (o) => ({ id: o.slug, edition_id: "e1", body: "Body.", position: 0, in_nav: true, is_home: false, nav_label: o.slug, title: o.slug, ...o });
const SESS = [{ id: "s1", edition_id: "e1", title: "ZZ Opening", description: null, starts_at: "2099-06-10T10:00:00Z", ends_at: null, venue_id: null, kind: "event", ticket_mode: "none", ticket_url: null, price_text: null, status: "scheduled", position: 0 }];
const SP = [{ id: "sp1", edition_id: "e1", name: "ZZ Sponsor", level: null, logo_url: null, url: null, position: 0 }];
const set = (over = {}) => setDb({ editions: [ED], edition_organisers: [ORG], edition_pages: [], edition_sessions: SESS, edition_venues: [], edition_updates: [U(1)], edition_sponsors: SP, edition_series: [], ...over });
const rpc = (over = {}) => { globalThis.__FAKE_RPC__ = async (fn) => ({ data: { editions_enabled: true, edition_entitled: true, ...over }[fn] ?? null, error: null }); };
const frame = async (el) => renderToStaticMarkup(await Layout({ params: P({ slug: "zz-fest" }), children: el }));
beforeEach(() => { set(); rpc(); globalThis.__PATH__ = "/editions/zz-fest"; });

describe("one footer, everywhere on an Edition", () => {
  test("the OneShetland site footer is hidden on Edition and organiser pages only", () => {
    for (const p of ["/editions/zz-fest", "/editions/zz-fest/programme", "/editions/zz-fest/about", "/organisers/zz-org", "/organisers/zz-org/membership"]) assert.ok(EDITION_OWN_FOOTER.test(p), p);
    for (const p of ["/", "/editions", "/editions/", "/whats-on", "/directory/x", "/organise/zz-org", "/account/editions", "/admin/editions", "/organisersx"]) assert.ok(!EDITION_OWN_FOOTER.test(p), `${p} keeps the site footer`);
    assert.match(read("app/layout.tsx"), /<HideOnEditionPages><HideOnPrivateRoutes><SiteFooter \/><\/HideOnPrivateRoutes><\/HideOnEditionPages>/);
  });
  test("the Edition's own footer leads with the organiser, is understated about OneShetland, and keeps the legal links", async () => {
    const html = await frame(await Home({ params: P({ slug: "zz-fest" }) }));
    assert.equal(count(html, "<footer"), 1);
    assert.ok(html.indexOf("Presented by") < html.indexOf("Powered by"), "the organiser first");
    for (const l of ['href="/terms"', 'href="/privacy"', 'href="/support"', 'href="/editions"']) assert.ok(html.includes(l), l);
  });
  test("secondary pages (not in the navigation) and the Journal archive live in the footer, and the demo disclosure is repeated there in demo mode", async () => {
    set({ edition_pages: [PAGE({ slug: "about", nav_label: "About this concept", in_nav: false, position: 1 }), PAGE({ slug: "credits", nav_label: "Image credits", in_nav: false, position: 2 })] });
    process.env.EDITIONS_DEMO_MODE = "1";
    try {
      const html = await frame(await Home({ params: P({ slug: "zz-fest" }) }));
      const foot = html.slice(html.indexOf("<footer"));
      for (const l of ['href="/editions/zz-fest/about"', 'href="/editions/zz-fest/credits"', 'href="/editions/zz-fest/updates"']) assert.ok(foot.includes(l), l);
      assert.ok(foot.includes("An unofficial concept with demonstration data"), "disclosure in the footer");
      assert.ok(html.indexOf("An unofficial concept with demonstration data") < html.indexOf("Skip to Edition content") || html.includes('role="note"'), "and a banner at the top");
    } finally { delete process.env.EDITIONS_DEMO_MODE; }
  });
});

describe("the main navigation follows how a visitor discovers an Edition", () => {
  const nav = (html) => [...html.slice(html.indexOf("Edition sections"), html.indexOf("</nav>", html.indexOf("Edition sections"))).matchAll(/>([^<>]+)<\/a>/g)].map((m) => m[1]);
  test("Overview, Programme, Taking part, the organiser's own navigation pages, then Membership; secondary pages are not in it", async () => {
    set({ edition_pages: [PAGE({ slug: "visit", nav_label: "Visiting", position: 0 }), PAGE({ slug: "about", nav_label: "About this concept", in_nav: false, position: 1 })] });
    rpc({ edition_public_tiers: [{ tier_id: "t1", organiser_id: "o1", organiser_name: "ZZ", name: "Member", description: null, benefits: [], price_monthly_pence: null, price_annual_pence: null, is_free: true, vat_mode: "none", join_mode: "open", edition_benefit: "none", discount_percent: null, full: false }] });
    const html = await frame(await Home({ params: P({ slug: "zz-fest" }) }));
    assert.deepEqual(nav(html), ["Overview", "Programme", "Taking part", "Visiting", "Membership"]);
    assert.ok(html.includes('href="/organisers/zz-org/membership"'));
  });
  test("an item only appears when there is something behind it", async () => {
    setDb({ editions: [ED], edition_organisers: [ORG], edition_pages: [], edition_sessions: [], edition_venues: [], edition_updates: [], edition_sponsors: [], edition_series: [] });
    const html = await frame(await Home({ params: P({ slug: "zz-fest" }) }));
    assert.ok(!html.includes("Edition sections"), "a single-entry navigation is not drawn");
  });
});

describe("the Journal on the home page", () => {
  test("three updates: the newest leads with its photograph, two sit beside it, with dates, excerpts and a link to the archive", () => {
    const html = renderToStaticMarkup(h(Journal, { updates: [U(3, { image_url: "https://x.test/a.jpg" }), U(2, { image_url: "https://x.test/b.jpg" }), U(1)], base: "/editions/zz-fest", total: 5 }));
    assert.ok(html.includes("ed-jgrid--n3") && html.includes("ed-jitem--lead") && html.includes("ed-jside"));
    assert.ok(html.includes('href="/editions/zz-fest/updates#u-u3"') && html.includes("All updates (5)"));
    assert.ok(html.includes('src="https://x.test/a.jpg"') && html.includes("dateTime="));
    assert.equal(count(html, "<h2"), 1); assert.equal(count(html, "<h3"), 3, "headings stay in order under the page's h2");
    assert.ok(!html.includes("**") && !html.includes("](https"), "excerpts are plain text, never raw markup");
  });
  test("a single announcement (a one-off event) and a year-round archive both work; nothing renders when there are no updates", () => {
    assert.ok(renderToStaticMarkup(h(Journal, { updates: [U(1)], base: "/e", total: 1 })).includes("ed-jgrid--n1"));
    assert.ok(renderToStaticMarkup(h(Journal, { updates: [U(2), U(1)], base: "/e", total: 2 })).includes("ed-jgrid--n2"));
    assert.ok(renderToStaticMarkup(h(Journal, { updates: [U(1)], base: "/e", total: 1 })).includes("Open the journal"));
    assert.equal(renderToStaticMarkup(h(Journal, { updates: [], base: "/e", total: 0 })), "");
  });
  test("an update without a photograph is typographic and nothing is broken", () => {
    const html = renderToStaticMarkup(h(Journal, { updates: [U(1)], base: "/e", total: 1 }));
    assert.ok(!html.includes("<img"));
  });
  test("the home page shows it, and the archive keeps anchors and photographs", async () => {
    set({ edition_updates: [U(2, { image_url: "https://x.test/p.jpg" }), U(1)] });
    const home = await frame(await Home({ params: P({ slug: "zz-fest" }) }));
    assert.ok(home.includes('id="edition-journal"') && home.includes("ZZ Story 2") && !home.includes("Latest update"));
    const arch = renderToStaticMarkup(h(UpdatesList, { updates: [U(2, { image_url: "https://x.test/p.jpg" })], lead: true }));
    assert.ok(arch.includes('id="u-u2"') && arch.includes('src="https://x.test/p.jpg"'));
  });
  test("excerpts cut at a word boundary and strip markup", () => {
    assert.equal(excerpt("## Head\n\nSome **bold** [link](https://x.test) text", 200), "Head Some bold link text");
    assert.ok(excerpt("word ".repeat(100), 50).endsWith("…") && excerpt("word ".repeat(100), 50).length <= 52);
  });
});

describe("update photographs are validated like every other image", () => {
  test("https (or this stack's own storage) only; empty is fine; the value is carried through", () => {
    const base = { title: "T", body: "b", publish: true };
    assert.equal(updateFields({ ...base, image_url: "https://x.test/a.jpg" }, null).value.image_url, "https://x.test/a.jpg");
    assert.equal(updateFields({ ...base, image_url: "" }, null).value.image_url, null);
    for (const bad of ["http://x.test/a.jpg", "javascript:alert(1)", "https://x.test/a b.jpg"]) assert.equal(updateFields({ ...base, image_url: bad }, null).ok, false, bad);
    assert.match(read("components/editions-manage/UpdatesManager.tsx"), /ImageUpload label="Photograph \(optional\)"/);
    assert.match(read("lib/editions/types.ts"), /UPDATE_PUBLIC_COLUMNS = "[^"]*image_url/);
  });
});
