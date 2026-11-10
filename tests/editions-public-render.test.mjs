/**
 * Public Editions surface: components and pages are RENDERED (react-dom/server) against the in-memory fake supabase; nothing touches a network.
 * Run: node --test --import ./tests/support/register.mjs tests/editions-public-render.test.mjs
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { setDb } from "./support/fake-supabase.mjs";

await import("./support/register-jsx.mjs");
const { Prose } = await import("../components/editions/Prose.tsx");
const { EditionHero } = await import("../components/editions/EditionHero.tsx");
const { previewReason } = await import("../components/editions/PreviewBanner.tsx");
const Layout = (await import("../app/editions/[slug]/layout.tsx")).default;
const Home = (await import("../app/editions/[slug]/page.tsx")).default;
const Programme = (await import("../app/editions/[slug]/programme/page.tsx")).default;
const Updates = (await import("../app/editions/[slug]/updates/page.tsx")).default;
const PageRoute = (await import("../app/editions/[slug]/[page]/page.tsx")).default;
const Index = (await import("../app/editions/page.tsx")).default;
const OrganiserPage = (await import("../app/organisers/[slug]/page.tsx")).default;
const { editionSchema, organiserSchema } = await import("../lib/editions/seo.ts");

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const count = (html, needle) => html.split(needle).length - 1;
const P = (o) => Promise.resolve(o);

const ORG = { id: "o1", slug: "zz-test-organiser", name: "ZZ TEST Organiser", tagline: "ZZ tagline", description: "About ZZ.", logo_url: null, cover_url: null, cover_focus: null, brand_color: "#0b5a73", website: "https://example.test", contact_email: null, status: "verified", verified_at: null, reserved_name_flag: false, is_test: false, hub_id: null, created_at: "2026-01-01T00:00:00Z" };
const ED = { id: "e1", organiser_id: "o1", series_id: null, slug: "zz-test-edition", title: "ZZ TEST Edition", summary: "A ZZ summary.", description: "Long **ZZ** text.", kind: "multi_day", starts_on: "2099-06-10", ends_on: "2099-06-12", timezone: "Europe/London", year_label: "2099", brand_color: "#e0e0e0", logo_url: null, cover_url: "https://example.test/cover.jpg", cover_focus: null, theme: {}, status: "published", published_at: "2026-01-01T00:00:00Z", suspended_reason: null, is_test: false, created_at: "2026-01-01T00:00:00Z" };
const S = (o) => ({ edition_id: "e1", description: null, ends_at: null, venue_id: null, kind: "event", ticket_mode: "none", ticket_url: null, price_text: null, status: "scheduled", position: 0, ...o });
const SESSIONS = [
  S({ id: "s1", title: "ZZ Opening", starts_at: "2099-06-10T10:00:00Z", venue_id: "v1", price_text: "Free" }),
  S({ id: "s2", title: "ZZ Concert", starts_at: "2099-06-11T19:30:00Z", venue_id: "v2", ticket_mode: "external", ticket_url: "https://tickets.example.test/x", price_text: "£10" }),
  S({ id: "s3", title: "ZZ Walk", starts_at: "2099-06-11T09:00:00Z", status: "cancelled", ticket_mode: "external", ticket_url: "https://tickets.example.test/y" }),
];
const VENUES = [{ id: "v1", organiser_id: "o1", name: "ZZ Hall", address: "1 Test Road", lat: 60.15, lng: -1.14, notes: null }, { id: "v2", organiser_id: "o1", name: "ZZ Barn", address: "2 Test Road", lat: null, lng: null, notes: null }];
const db = (over = {}) => ({
  editions: [ED], edition_organisers: [ORG], edition_pages: [], edition_sessions: SESSIONS, edition_venues: VENUES,
  edition_updates: [{ id: "u1", edition_id: "e1", title: "ZZ Update", body: "Doors <b>open</b> early.", pinned: false, published_at: "2026-01-02T00:00:00Z" }],
  edition_sponsors: [{ id: "sp1", edition_id: "e1", name: "ZZ Sponsor", level: "Gold", logo_url: null, url: "https://sponsor.example.test", position: 0 }, { id: "sp2", edition_id: "e1", name: "ZZ Plain", level: null, logo_url: null, url: "javascript:alert(1)", position: 1 }],
  edition_series: [], ...over,
});
const rpcOn = (over = {}) => { globalThis.__FAKE_RPC__ = async (fn) => ({ data: { editions_enabled: true, edition_entitled: true, ...over }[fn] ?? null, error: null }); };
const params = (slug = "zz-test-edition", page) => ({ params: P(page ? { slug, page } : { slug }) });
const frame = async (el, slug = "zz-test-edition") => renderToStaticMarkup(await Layout({ params: P({ slug }), children: el }));

beforeEach(() => { setDb(db()); rpcOn(); globalThis.__PATH__ = "/editions/zz-test-edition"; });

describe("Prose", () => {
  test("never injects HTML: raw tags and unsafe links come out as text", () => {
    const html = renderToStaticMarkup(h(Prose, { source: "Hello <script>alert(1)</script> [x](javascript:alert(1)) [ok](https://example.test)\n\n- a\n- b\n\n## Head" }));
    assert.ok(!html.includes("<script"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes('href="javascript:'));
    assert.match(html, /href="https:\/\/example\.test"[^>]*rel="noopener noreferrer nofollow ugc"/);
    assert.equal(count(html, "<li"), 2);
    assert.match(html, /<h3[^>]*><span>Head<\/span><\/h3>/);
  });
  test("heading level is relative so the page outline stays intact", () => {
    assert.match(renderToStaticMarkup(h(Prose, { source: "## A\n### B", level: 4 })), /<h4[^>]*><span>A<\/span><\/h4>.*<h5[^>]*><span>B<\/span><\/h5>/);
  });
});

describe("hero", () => {
  const props = { edition: ED, organiser: ORG, logo: null, cover: "https://example.test/cover.jpg", focus: "30% 40%", phase: "upcoming", seriesName: "ZZ Series" };
  test("one h1, organiser link on a logo plate, phase, dates, and a cover photograph set at its focus point", () => {
    const html = renderToStaticMarkup(h(EditionHero, props));
    assert.equal(count(html, "<h1"), 1);
    assert.ok(html.includes('href="/organisers/zz-test-organiser"') && html.includes("Presented by") && html.includes("ZZ TEST Organiser"));
    assert.ok(html.includes("Coming up") && html.includes("10 to 12 Jun 2099") && html.includes("2099 · ZZ Series"));
    assert.match(html, /<img src="https:\/\/example\.test\/cover\.jpg" alt=""[^>]*object-position:30% 40%/);
    assert.match(html, /ed-mast__scrim/, "a scrim keeps the type legible over the photograph");
  });
  test("an Edition with no cover gets a tonal field with the start day as a large numeral; a missing logo becomes a monogram", () => {
    const html = renderToStaticMarkup(h(EditionHero, { ...props, cover: null }));
    assert.ok(html.includes("ed-mast__field") && html.includes('class="ed-mast__ghost"') && html.includes(">10<") && !html.includes("cover.jpg"));
    assert.match(html, /ed-plate__mono[^>]*>Z</);
  });
  test("a logo is drawn on the paper plate, decorative (the organiser's name is text beside it)", () => {
    const html = renderToStaticMarkup(h(EditionHero, { ...props, logo: "https://example.test/logo.svg" }));
    assert.match(html, /<img src="https:\/\/example\.test\/logo\.svg" alt=""/);
  });
  test("theme.hero plain drops the photograph; an unknown value is ignored", () => {
    assert.ok(!renderToStaticMarkup(h(EditionHero, { ...props, edition: { ...ED, theme: { hero: "plain" } } })).includes("cover.jpg"));
    assert.ok(renderToStaticMarkup(h(EditionHero, { ...props, edition: { ...ED, theme: { hero: "sparkle", density: "huge" } } })).includes("cover.jpg"));
  });
});

describe("previewReason", () => {
  const e = (o) => ({ status: "published", is_test: false, suspended_reason: null, ...o });
  test("public Editions have no reason; every other state names one", () => {
    assert.equal(previewReason({ edition: e(), enabled: true, entitled: true }), null);
    assert.equal(previewReason({ edition: e({ status: "draft" }), enabled: true, entitled: true }).key, "draft");
    assert.equal(previewReason({ edition: e(), enabled: true, entitled: false }).key, "unentitled");
    assert.equal(previewReason({ edition: e(), enabled: false, entitled: true }).key, "disabled");
    assert.equal(previewReason({ edition: e({ is_test: true }), enabled: true, entitled: true }).key, "test");
    assert.match(previewReason({ edition: e({ status: "suspended", suspended_reason: "ZZ reason" }), enabled: true, entitled: true }).text, /ZZ reason/);
  });
});

describe("Edition pages", () => {
  test("home: one h1, a landmark per section, next up, update, sponsors, neutral footer, tracking", async () => {
    const html = await frame(await Home(params()));
    assert.equal(count(html, "<h1"), 1);
    assert.ok(html.includes("Skip to Edition content") && html.includes('id="edition-content"'));
    assert.ok(html.includes("Next up") && html.includes("ZZ Opening") && html.includes("Journal") && html.includes("ZZ Update"));
    assert.ok(/Powered by <b>OneShetland<\/b>/.test(html) && html.includes("Presented by") && html.includes("/terms") && html.includes("/privacy"), "one footer: organiser first, OneShetland understated, legal links kept");
    assert.equal(count(html, "<footer"), 1, "a single footer");
    assert.ok(!/not affiliated/i.test(html));
    assert.ok(!html.includes("Preview: only your team"), "a public Edition shows no preview banner");
    assert.match(html, /application\/ld\+json/);
    assert.ok(html.includes("&lt;b&gt;open&lt;/b&gt;"), "markup in an update is text");
  });
  test("brand: a too-light colour keeps its exact fill with dark text on it, and every derived pair passes AA", async () => {
    const html = await frame(await Home(params()));
    const v = (n) => new RegExp(`--${n}:(#[0-9a-f]{6})`).exec(html)?.[1];
    const { contrast } = await import("../lib/editions/rules.ts");
    assert.equal(v("ed-brand"), "#e0e0e0", "the organiser's colour is never darkened to make white text work");
    assert.notEqual(v("ed-on-brand"), "#ffffff");
    for (const [fg, bg] of [["ed-on-brand", "ed-brand"], ["ed-accent", "ed-ground"], ["ed-ink", "ed-ground"], ["ed-ink-2", "ed-ground"], ["ed-ink-3", "ed-ground"], ["ed-on-deep", "ed-deep"], ["ed-glow", "ed-deep"]])
      assert.ok(contrast(v(fg), v(bg)) >= 4.5, `${fg} on ${bg}`);
    assert.ok(!html.includes("data-voice"), "no per-colour typeface or shape logic");
  });
  test("sponsors: https only, with rel sponsored; unsafe links are not links", async () => {
    const html = await frame(await Home(params()));
    assert.match(html, /href="https:\/\/sponsor\.example\.test"[^>]*rel="noopener noreferrer sponsored"/);
    assert.ok(!html.includes("javascript:"));
  });
  test("navigation: Programme/Updates/Partners only when there is something; current item is marked", async () => {
    let html = await frame(await Home(params()));
    assert.ok(html.includes('href="/editions/zz-test-edition/programme"') && html.includes("Taking part") && html.includes('href="/editions/zz-test-edition/updates"'), "the journal archive is reachable from the footer");
    assert.match(html, /aria-current="page"[^>]*>Overview/);
    setDb(db({ edition_sessions: [], edition_updates: [], edition_sponsors: [] }));
    html = await frame(await Home(params()));
    assert.ok(!html.includes("Edition sections"), "a single-entry nav is not drawn");
    assert.ok(!html.includes("/programme"));
    globalThis.__PATH__ = "/editions/zz-test-edition/programme";
    setDb(db());
    assert.match(await frame(await Programme(params())), /aria-current="page"[^>]*>Programme/);
  });
  test("an organiser home page replaces the default; other pages render and appear in the nav", async () => {
    setDb(db({ edition_pages: [
      { id: "p1", edition_id: "e1", slug: "welcome", nav_label: "Welcome", title: "ZZ Welcome", body: "Hello ZZ.", position: 0, in_nav: true, is_home: true },
      { id: "p2", edition_id: "e1", slug: "getting-here", nav_label: "Getting here", title: "ZZ Getting here", body: "By bus.", position: 1, in_nav: true, is_home: false },
    ] }));
    const home = await frame(await Home(params()));
    assert.ok(home.includes("ZZ Welcome") && home.includes("Hello ZZ.") && home.includes("Getting here"));
    const pg = await frame(await PageRoute(params("zz-test-edition", "getting-here")));
    assert.ok(pg.includes("By bus.") && count(pg, "<h1") === 1);
    await assert.rejects(PageRoute(params("zz-test-edition", "welcome")), /redirect/);
    await assert.rejects(PageRoute(params("zz-test-edition", "nope")), /notFound/);
    await assert.rejects(PageRoute(params("zz-test-edition", "organiser")), /notFound/);
  });
  test("partners built-in lists sponsors", async () => {
    assert.ok((await frame(await PageRoute(params("zz-test-edition", "partners")))).includes("ZZ Sponsor"));
    setDb(db({ edition_sponsors: [] }));
    await assert.rejects(PageRoute(params("zz-test-edition", "partners")), /notFound/);
  });
  test("programme: real h2 per London day, cancelled struck through, ticket link rel, maps only with coordinates", async () => {
    const html = renderToStaticMarkup(await Programme(params()));
    assert.equal(count(html, "<h2"), 3, "the page heading plus one real h2 per London day");
    assert.equal(count(html, 'class="ed-day__label"'), 2);
    assert.ok(/10 June/.test(html) && /11 June/.test(html));
    assert.match(html, /ed-row ed-row--off[\s\S]*?<h3 class="ed-row__title">(?:<a [^>]*>)?ZZ Walk/, "cancelled stays visible, marked off");
    assert.ok(html.includes("Cancelled"));
    assert.equal(count(html, 'href="https://tickets.example.test/'), 1, "no ticket button on a cancelled session");
    assert.match(html, /href="https:\/\/tickets\.example\.test\/x"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*href="https:\/\/tickets\.example\.test\/x"/);
    assert.equal(count(html, "google.com/maps/search"), 1, "only the venue with lat/lng gets a map link");
    assert.ok(html.includes("ZZ Hall") && html.includes("£10"));
    assert.ok(html.includes("20:30"), "19:30 UTC in June is 20:30 in Shetland (BST)");
  });
  test("updates page", async () => {
    const html = renderToStaticMarkup(await Updates(params()));
    assert.ok(html.includes("ZZ Update") && html.includes("<time"));
  });
  test("a future-dated update is not shown (loader filters it)", async () => {
    setDb(db({ edition_updates: [{ id: "u2", edition_id: "e1", title: "ZZ Later", body: "x", pinned: false, published_at: "2999-01-01T00:00:00Z" }] }));
    assert.ok(!renderToStaticMarkup(await Updates(params())).includes("ZZ Later"));
  });
  test("not visible = 404 on every route", async () => {
    setDb(db({ editions: [] }));
    for (const run of [() => Layout({ params: P({ slug: "zz-test-edition" }), children: null }), () => Home(params()), () => Programme(params()), () => Updates(params()), () => PageRoute(params("zz-test-edition", "x"))])
      await assert.rejects(run(), /notFound/);
  });
});

describe("preview banner for the team", () => {
  test("draft shows the banner and the reason", async () => {
    setDb(db({ editions: [{ ...ED, status: "draft" }] }));
    const html = await frame(await Home(params()));
    assert.ok(html.includes("Preview: only your team can see this Edition") && html.includes("draft"));
  });
  test("suspended shows the reason; unentitled and flag-off are explained", async () => {
    setDb(db({ editions: [{ ...ED, status: "suspended", suspended_reason: "ZZ policy breach" }] }));
    assert.ok((await frame(await Home(params()))).includes("ZZ policy breach"));
    setDb(db()); rpcOn({ edition_entitled: false });
    assert.ok((await frame(await Home(params()))).includes("not yet entitled"));
    rpcOn({ editions_enabled: false });
    assert.ok((await frame(await Home(params()))).includes("not switched on"));
  });
  test("test Editions are noindex", async () => {
    setDb(db({ editions: [{ ...ED, is_test: true }] }));
    const { generateMetadata } = await import("../app/editions/[slug]/page.tsx");
    assert.deepEqual((await generateMetadata(params())).robots, { index: false, follow: false });
    setDb(db());
    assert.equal((await generateMetadata(params())).robots, undefined);
  });
});

describe("index and organiser pages", () => {
  test("index: On now and Coming up groups, kind filter, past collapsed", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
    setDb(db({ editions: [
      { ...ED, id: "a", slug: "zz-now", title: "ZZ Now", starts_on: today, ends_on: today, kind: "single_day" },
      { ...ED, id: "b", slug: "zz-soon", title: "ZZ Soon" },
      { ...ED, id: "c", slug: "zz-old", title: "ZZ Old", starts_on: "2020-01-01", ends_on: "2020-01-02" },
    ] }));
    const html = renderToStaticMarkup(await Index({ searchParams: P({}) }));
    assert.ok(html.includes("On now") && html.includes("Coming up") && html.includes("ZZ Now") && html.includes("ZZ Soon"));
    assert.match(html, /Past Editions \(1\)[\s\S]*ed-archive[\s\S]*ZZ Old/, "past Editions are a quiet archive list");
    assert.ok(!html.includes("<details"));
    assert.equal(count(html, "<h1"), 1);
    const filtered = renderToStaticMarkup(await Index({ searchParams: P({ kind: "single_day" }) }));
    assert.ok(filtered.includes("ZZ Now") && !filtered.includes("ZZ Soon"));
    assert.match(filtered, /aria-current="page"[^>]*>Single day/);
  });
  test("index: honest empty state; an unknown kind is ignored; dark = 404", async () => {
    setDb(db({ editions: [] }));
    const html = renderToStaticMarkup(await Index({ searchParams: P({ kind: "bogus" }) }));
    assert.ok(html.includes("No Editions listed right now") && html.includes("Nothing is scheduled"));
    rpcOn({ editions_enabled: false });
    await assert.rejects(Index({ searchParams: P({}) }), /notFound/);
  });
  test("organiser profile lists its published Editions and carries JSON-LD; unknown = 404", async () => {
    const html = renderToStaticMarkup(await OrganiserPage(params("zz-test-organiser")));
    assert.equal(count(html, "<h1"), 1);
    assert.ok(html.includes("ZZ TEST Organiser") && html.includes("ZZ TEST Edition") && html.includes("application/ld+json"));
    await assert.rejects(OrganiserPage(params("missing")), /notFound/);
  });
});

describe("structured data", () => {
  test("editionSchema: dates, organiser, location and subEvents; cancelled sessions say so; only https offers", () => {
    const s = editionSchema({ edition: ED, organiser: ORG, sessions: SESSIONS, venues: VENUES });
    assert.equal(s["@type"], "Event");
    assert.equal(s.startDate, "2099-06-10"); assert.equal(s.endDate, "2099-06-12");
    assert.equal(s.organizer.name, "ZZ TEST Organiser");
    assert.equal(s.location.length, 2);
    assert.equal(s.subEvent.length, 3);
    assert.equal(s.subEvent.find((x) => x.name === "ZZ Walk").eventStatus, "https://schema.org/EventCancelled");
    assert.equal(s.subEvent.find((x) => x.name === "ZZ Concert").offers.url, "https://tickets.example.test/x");
    assert.equal(editionSchema({ edition: { ...ED, kind: "season" }, organiser: ORG, sessions: [], venues: [] })["@type"], "EventSeries");
    assert.ok(!("subEvent" in editionSchema({ edition: ED, organiser: ORG, sessions: [], venues: [] })), "empty fields are dropped");
  });
  test("organiserSchema", () => {
    const s = organiserSchema(ORG, [ED]);
    assert.equal(s["@type"], "Organization"); assert.equal(s.event.length, 1); assert.deepEqual(s.sameAs, ["https://example.test"]);
  });
});

describe("source guards", () => {
  const files = ["components/editions/Prose.tsx", "components/editions/EditionHero.tsx", "components/editions/EditionNav.tsx", "components/editions/SessionCard.tsx", "components/editions/ProgrammeByDay.tsx", "components/editions/UpdatesList.tsx", "components/editions/SponsorStrip.tsx", "components/editions/EditionCard.tsx", "components/editions/SessionTicketLink.tsx", "components/editions/PreviewBanner.tsx", "components/editions/PartnerCard.tsx", "components/editions/PartnersSection.tsx", "components/editions/editorial/Masthead.tsx", "components/editions/editorial/BrandScope.tsx", "components/editions/editorial/EditionFooter.tsx", "components/editions/editorial/HeroFrame.tsx", "lib/editions/brand.ts",
    "app/editions/page.tsx", "app/editions/[slug]/layout.tsx", "app/editions/[slug]/page.tsx", "app/editions/[slug]/[page]/page.tsx", "app/editions/[slug]/programme/page.tsx", "app/editions/[slug]/updates/page.tsx", "app/editions/[slug]/opengraph-image.tsx", "app/organisers/[slug]/page.tsx", "lib/editions/seo.ts"];
  test("no raw HTML injection, no service key, no real organisation names", () => {
    for (const f of files) {
      const src = read(f);
      assert.ok(!/dangerouslySetInnerHTML/.test(src), f);
      assert.ok(!/service_key|SERVICE_ROLE/i.test(src), f);
      assert.ok(!/Taste of Shetland|Wool Week|Up Helly|Folk Festival/i.test(src), f);
    }
  });
  test("every page is force-dynamic and reads only through the loaders", () => {
    for (const f of files.filter((x) => x.startsWith("app/") && x.endsWith("page.tsx"))) assert.match(read(f), /export const dynamic = "force-dynamic"/, f);
    for (const f of files.filter((x) => x.endsWith("page.tsx") && x.startsWith("app/"))) assert.ok(!/\.from\(/.test(read(f)), `${f} must not query tables directly`);
  });
  test("external links carry rel=noopener noreferrer", () => {
    for (const f of ["components/editions/SessionCard.tsx", "components/editions/SessionTicketLink.tsx", "components/editions/SponsorStrip.tsx"]) assert.match(read(f), /noopener noreferrer/, f);
    assert.match(read("components/editions/SponsorStrip.tsx"), /noopener noreferrer sponsored/);
  });
  test("sitemap lists published Editions and organisers; robots hides the organiser dashboard", () => {
    const sm = read("app/sitemap.ts");
    assert.match(sm, /"editions"/); assert.match(sm, /\/editions\/\$\{e\.slug\}/); assert.match(sm, /\/organisers\/\$\{o\.slug\}/);
    assert.match(read("app/robots.ts"), /"\/organise\/"/);
  });
});
