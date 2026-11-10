/** Editions R6: the editorial design system as RENDERED, the Brand studio, validation of the focus point, inheritance. Run: node --test --import ./tests/support/register.mjs tests/editions-branding-ui.test.mjs */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { setDb } from "./support/fake-supabase.mjs";

await import("./support/register-jsx.mjs");
const V = await import("../lib/editions/validate.ts");
const { Prose } = await import("../components/editions/Prose.tsx");
const { PartnersSection } = await import("../components/editions/PartnersSection.tsx");
const { SponsorStrip } = await import("../components/editions/SponsorStrip.tsx");
const { EditionCard } = await import("../components/editions/EditionCard.tsx");
const { HeroFrame } = await import("../components/editions/editorial/HeroFrame.tsx");
const { BrandStudio } = await import("../components/editions-manage/BrandStudio.tsx");
const { ColourField, FocusPicker, BrandPreview, BrandReport } = await import("../components/editions-manage/brand-kit.tsx");
const { ApplyPanel } = await import("../components/editions-commerce/ApplyPanel.tsx");
const Layout = (await import("../app/editions/[slug]/layout.tsx")).default;
const Home = (await import("../app/editions/[slug]/page.tsx")).default;
const OrganiserPage = (await import("../app/organisers/[slug]/page.tsx")).default;
const Index = (await import("../app/editions/page.tsx")).default;

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const count = (html, needle) => html.split(needle).length - 1;
const P = (o) => Promise.resolve(o);
const ORG = { id: "o1", slug: "zz-org", name: "ZZ Org", tagline: "ZZ tagline", description: "About.", logo_url: "https://example.test/org-logo.svg", cover_url: "https://example.test/org-cover.jpg", cover_focus: "20% 30%", brand_color: "#5b6b4d", website: null, contact_email: null, status: "verified", verified_at: null, reserved_name_flag: false, is_test: false, hub_id: null, created_at: "2026-01-01T00:00:00Z" };
const ED = (o = {}) => ({ id: "e1", organiser_id: "o1", series_id: null, slug: "zz-fest", title: "ZZ Fest", summary: "Summary.", description: "", kind: "multi_day", starts_on: "2099-06-10", ends_on: "2099-06-12", timezone: "Europe/London", year_label: "2099", brand_color: null, logo_url: null, cover_url: null, cover_focus: null, theme: {}, status: "published", published_at: "2026-01-01T00:00:00Z", suspended_reason: null, is_test: false, created_at: "2026-01-01T00:00:00Z", ...o });
const set = (ed = ED(), over = {}) => setDb({ editions: [ed], edition_organisers: [ORG], edition_pages: [], edition_sessions: [], edition_venues: [], edition_updates: [], edition_sponsors: [], edition_series: [], ...over });
const rpc = (over = {}) => { globalThis.__FAKE_RPC__ = async (fn) => ({ data: { editions_enabled: true, edition_entitled: true, ...over }[fn] ?? null, error: null }); };
const frame = async (el) => renderToStaticMarkup(await Layout({ params: P({ slug: "zz-fest" }), children: el }));
const BIZ = (o = {}) => ({ link_id: "l", business_id: "b", name: "ZZ Biz", slug: null, category: "food_drink", description: null, address: null, logo_url: null, cover_url: null, label: null, position: 0, offers: [], ...o });
beforeEach(() => { set(); rpc(); globalThis.__PATH__ = "/editions/zz-fest"; });

describe("the focus point is validated like the database does", () => {
  const base = { name: "ZZ Org", tagline: "", description: "", website: "", contact_email: "", logo_url: "", cover_url: "https://example.test/c.jpg", brand_color: "#8a3b12" };
  test("organiser: kept with a cover; dropped when it is the default, malformed, or there is no cover", () => {
    assert.equal(V.organiserProfile({ ...base, cover_focus: "20% 70%" }).value.cover_focus, "20% 70%");
    assert.equal(V.organiserProfile({ ...base, cover_focus: "50% 50%" }).value.cover_focus, null);
    for (const bad of ["101% 5%", "center", "5px 5px", "50%; x", "", undefined]) assert.equal(V.organiserProfile({ ...base, cover_focus: bad }).value.cover_focus, null, String(bad));
    assert.equal(V.organiserProfile({ ...base, cover_url: "", cover_focus: "20% 70%" }).value.cover_focus, null);
  });
  test("Edition: same rules", () => {
    const e = { title: "ZZ Fest", kind: "multi_day", starts_on: "2099-06-10", ends_on: "2099-06-12", cover_url: "https://example.test/c.jpg" };
    assert.equal(V.editionFields({ ...e, cover_focus: "5% 95%" }).value.cover_focus, "5% 95%");
    assert.equal(V.editionFields({ ...e, cover_focus: "nope" }).value.cover_focus, null);
    assert.equal(V.editionFields({ ...e, cover_url: "", cover_focus: "5% 95%" }).value.cover_focus, null);
  });
});

describe("the Edition inherits its organiser's brand", () => {
  test("no own colour, logo or cover: the page is drawn in the organiser's tones, logo and focused photograph", async () => {
    const html = await frame(await Home({ params: P({ slug: "zz-fest" }) }));
    assert.match(html, /--ed-brand:#5b6b4d/);
    assert.match(html, /<img src="https:\/\/example\.test\/org-logo\.svg" alt=""/);
    assert.match(html, /<img src="https:\/\/example\.test\/org-cover\.jpg"[^>]*object-position:20% 30%/);
  });
  test("an Edition's own cover brings its own focus, never the organiser's; its own colour changes the palette (and nothing else)", async () => {
    set(ED({ cover_url: "https://example.test/ed-cover.jpg", cover_focus: "70% 10%", brand_color: "#e6007e" }));
    const html = await frame(await Home({ params: P({ slug: "zz-fest" }) }));
    assert.match(html, /<img src="https:\/\/example\.test\/ed-cover\.jpg"[^>]*object-position:70% 10%/);
    assert.ok(!html.includes("org-cover.jpg"));
    assert.match(html, /--ed-brand:#e6007e/); assert.ok(!html.includes("data-voice"));
    assert.match(html, /<img src="https:\/\/example\.test\/org-logo\.svg"/, "the logo is still the organiser's");
  });
  test("an organiser with no branding at all still renders: platform default colour, monogram, a tonal field", async () => {
    setDb({ editions: [ED()], edition_organisers: [{ ...ORG, logo_url: null, cover_url: null, brand_color: null, cover_focus: null }], edition_pages: [], edition_sessions: [], edition_venues: [], edition_updates: [], edition_sponsors: [], edition_series: [] });
    const html = await frame(await Home({ params: P({ slug: "zz-fest" }) }));
    assert.ok(html.includes("ed-mast__field") && html.includes("ed-plate__mono") && html.includes("--ed-brand:#0b5a73"));
  });
  test("the organiser page and each card in a listing carry the right brand", async () => {
    const org = renderToStaticMarkup(await OrganiserPage({ params: P({ slug: "zz-org" }) }));
    assert.equal(count(org, "<h1"), 1); assert.ok(org.includes("Verified organiser") && org.includes("ZZ tagline") && /Powered by <b>OneShetland<\/b>/.test(org));
    const card = renderToStaticMarkup(h(EditionCard, { edition: ED({ brand_color: "#e6007e" }), organiser: { name: "ZZ Org", slug: "zz-org", logo_url: null, brand_color: "#5b6b4d", cover_url: "https://example.test/org-cover.jpg", cover_focus: "20% 30%" } }));
    assert.match(card, /--ed-brand:#e6007e/); assert.match(card, /org-cover\.jpg/);
  });
  test("the index is OneShetland's own page: its cream paper and navy, whatever the Editions' brands", async () => {
    const html = renderToStaticMarkup(await Index({ searchParams: P({}) }));
    assert.match(html, /--ed-brand:#0a4a70/);
  });
});

describe("the masthead is full on the Edition's home and compact on inner pages", () => {
  test("the selected segment decides it, so the right size is in the first HTML", () => {
    globalThis.__PATH__ = "/editions/zz-fest"; assert.ok(!renderToStaticMarkup(h(HeroFrame, null, "x")).includes("ed-compact"));
    globalThis.__PATH__ = "/editions/zz-fest/programme"; assert.ok(renderToStaticMarkup(h(HeroFrame, null, "x")).includes("ed-compact"));
  });
  test("the real layout applies it", async () => {
    globalThis.__PATH__ = "/editions/zz-fest/partners";
    assert.ok((await frame(h("p", null, "x"))).includes('class="ed-compact"'));
  });
});

describe("editorial components", () => {
  test("partners lead with photographs: a business with a cover comes before one with only a logo, before one with neither", () => {
    const list = [BIZ({ link_id: "1", name: "ZZ None", position: 0 }), BIZ({ link_id: "2", name: "ZZ Logo", logo_url: "https://x/l.png", position: 1 }), BIZ({ link_id: "3", name: "ZZ Cover", cover_url: "https://x/c.jpg", position: 2 })];
    const html = renderToStaticMarkup(h(PartnersSection, { partners: { businesses: list, events: [], activities: [] } }));
    assert.ok(html.indexOf("ZZ Cover") < html.indexOf("ZZ Logo") && html.indexOf("ZZ Logo") < html.indexOf("ZZ None"));
    assert.ok(html.includes("ed-tile--lead") && html.includes("ed-tile--side"), "a lead and two beside it");
    assert.match(html, /ed-img ed-img--mono/, "a business with no image gets a monogram, never a broken image");
  });
  test("a single partner stands alone, wide; two share a row", () => {
    assert.ok(renderToStaticMarkup(h(PartnersSection, { partners: { businesses: [BIZ()], events: [], activities: [] } })).includes("ed-tile--wide"));
    assert.ok(renderToStaticMarkup(h(PartnersSection, { partners: { businesses: [BIZ({ link_id: "1" }), BIZ({ link_id: "2" })], events: [], activities: [] } })).includes("ed-tile--half"));
  });
  test("an initial capital only opens a real paragraph, never a one-line summary", () => {
    assert.ok(!renderToStaticMarkup(h(Prose, { source: "A short opener.", dropcap: true })).includes("ed-dropcap"));
    assert.ok(renderToStaticMarkup(h(Prose, { source: "Long opening paragraph. ".repeat(12), dropcap: true })).includes("ed-dropcap"));
    assert.ok(!renderToStaticMarkup(h(Prose, { source: "Long opening paragraph. ".repeat(12) })).includes("ed-dropcap"));
  });
  test("sponsors are tiered by the organiser's own level names, in first-seen order; the first of several tiers is set larger", () => {
    const sp = [["A", "Headline"], ["B", "Supporters"], ["C", "Headline"], ["D", null]].map(([name, level], i) => ({ id: `s${i}`, edition_id: "e1", name, level, logo_url: null, url: null, position: i }));
    const html = renderToStaticMarkup(h(SponsorStrip, { sponsors: sp }));
    assert.ok(html.indexOf("Headline") < html.indexOf("Supporters"));
    assert.equal(count(html, "ed-tier ed-tier--lead"), 1);
    assert.ok(html.indexOf(">A<") < html.indexOf(">C<") && html.indexOf(">C<") < html.indexOf("Supporters"), "same level grouped together");
  });
  test("membership prices are set as one large figure with the period small and the alternative beneath", () => {
    const tier = { tier_id: "t1", organiser_id: "o1", organiser_name: "ZZ", name: "Full", description: null, benefits: ["Listed"], price_monthly_pence: 1500, price_annual_pence: 15000, is_free: false, vat_mode: "exclusive", join_mode: "application", edition_benefit: "free", discount_percent: null, full: false };
    const html = renderToStaticMarkup(h(ApplyPanel, { tiers: [tier, { ...tier, tier_id: "t2", name: "Free", is_free: true, price_monthly_pence: null, price_annual_pence: null, edition_benefit: "none" }], businesses: [], signedIn: false, nextPath: "/x" }));
    assert.ok(html.includes("£15") && html.includes("a month") && html.includes("or £150 a year, plus VAT") && html.includes(">Free<"));
    assert.ok(html.includes("ed-tier-card--feature"), "the tier with free participation is the featured one");
  });
});

describe("the Brand studio", () => {
  const studio = (o = {}) => renderToStaticMarkup(h(BrandStudio, { organiser: { ...ORG, ...o }, canEdit: true }));
  test("four plain steps, a save button, a live preview that is decorative to assistive technology, and a readable report", () => {
    const html = studio();
    for (const t of ["Your logo", "One colour", "One strong cover photograph", "Your name and introduction", "Save brand", "How it looks"]) assert.ok(html.includes(t), t);
    assert.match(html, /aria-hidden="true"[^>]*inert|inert[^>]*aria-hidden="true"/, "the preview is decorative");
    assert.ok(html.includes("Typeface: Editorial serif") && html.includes("Readability checks") && html.includes("easy to read"));
    assert.equal(count(html, "<h1"), 0, "the preview's title is not a second h1");
  });
  test("it carries the rest of the profile through untouched when saving (source guard)", () => {
    const src = read("components/editions-manage/BrandStudio.tsx");
    assert.match(src, /description: organiser\.description/); assert.match(src, /website: organiser\.website/); assert.match(src, /contact_email: organiser\.contact_email/);
  });
  test("viewers who cannot edit see it disabled with a plain explanation", () => {
    const html = renderToStaticMarkup(h(BrandStudio, { organiser: ORG, canEdit: false }));
    assert.ok(html.includes("disabled") && html.includes("Only administrators and owners can change the brand") && !html.includes("Save brand"));
  });
  test("the colour field offers named swatches and explains a bad colour; the focus picker has keyboard sliders", () => {
    const c = renderToStaticMarkup(h(ColourField, { value: "red", onChange() {} }));
    assert.ok(c.includes("Terracotta") && c.includes("Moss") && c.includes("Magenta") && c.includes("A colour looks like #8a3b12") && c.includes('role="alert"'));
    const f = renderToStaticMarkup(h(FocusPicker, { src: "https://x/c.jpg", value: "30% 40%", onChange() {} }));
    assert.ok(f.includes("Left to right") && f.includes("Top to bottom") && f.includes("left:30%") && f.includes("top:40%"));
    assert.ok(renderToStaticMarkup(h(ColourField, { value: "#8a3b12", onChange() {}, inherited: "#5b6b4d" })).includes("Use the organiser"));
  });
  test("a pale colour is explained, and an invalid one falls back without throwing", () => {
    assert.ok(renderToStaticMarkup(h(BrandReport, { color: "#ffee00" })).includes("dark rather than white"));
    assert.doesNotThrow(() => renderToStaticMarkup(h(BrandPreview, { name: "", logo: null, cover: null, focus: "50% 50%", color: "not a colour" })));
  });
  test("organiser profile no longer edits branding (it points to the Brand page) yet still sends the stored values", () => {
    const src = read("components/editions-manage/OrganiserForm.tsx");
    assert.match(src, /\/brand/); assert.ok(!/ImageUpload label="Logo"/.test(src)); assert.match(src, /logo_url: organiser\.logo_url/); assert.match(src, /cover_focus: organiser\.cover_focus/);
  });
});

describe("source guards for the design system", () => {
  test("no raw HTML injection, no colour typed by an organiser reaches a stylesheet, the scope sets derived hex only", () => {
    for (const f of ["components/editions/editorial/BrandScope.tsx", "components/editions/editorial/Masthead.tsx", "components/editions-manage/brand-kit.tsx", "components/editions-manage/BrandStudio.tsx"]) assert.ok(!/dangerouslySetInnerHTML/.test(read(f)), f);
    assert.match(read("components/editions/editorial/BrandScope.tsx"), /brand\.vars/);
    assert.ok(!/<style/.test(read("components/editions/editorial/BrandScope.tsx")), "no per-organiser CSS is generated");
  });
  test("motion is progressive: reduced motion switches every animation off, and no animation starts fully transparent", () => {
    const css = read("components/editions/editorial/editorial.css");
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*animation: none !important/);
    assert.match(css, /@keyframes ed-up \{ from \{ opacity: 0\.55/);
  });
  test("every interactive element has a visible focus style and a 44px target", () => {
    const css = read("components/editions/editorial/editorial.css");
    assert.match(css, /\.ed :focus-visible \{ outline: 2px solid/);
    assert.match(css, /\.ed-btn \{[^}]*min-height: 2\.9rem/); assert.match(css, /\.ed-nav__link \{[^}]*min-height: 3\.5rem/); assert.match(css, /\.ed-plan \{[^}]*min-height: 2\.75rem/);
  });
});

describe("one editorial design language for every Edition", () => {
  const css = read("components/editions/editorial/editorial.css");
  test("a vivid colour never produces pills, big radii or a different typeface: corners are square and the stylesheet has no per-colour switch", () => {
    assert.ok(!/data-voice/.test(css) && !/999px/.test(css.replace(/50%/g, "")), "no voice switch, no pill radius");
    assert.match(css, /--ed-radius: 0px; --ed-btn-radius: 0px; --ed-img-radius: 0px/);
    assert.ok(!/Fraunces|Bricolage/.test(read("lib/editions/fonts.ts")), "one display typeface");
  });
  test("the same markup is produced for a muted and a vivid brand (only colour values differ)", async () => {
    const strip = (h) => h.replace(/--ed-[a-z0-9-]+:#[0-9a-f]{6};?/g, "");
    set(ED({ brand_color: "#5b6b4d" })); const a = strip(await frame(await Home({ params: P({ slug: "zz-fest" }) })));
    set(ED({ brand_color: "#e6007e" })); const b = strip(await frame(await Home({ params: P({ slug: "zz-fest" }) })));
    assert.equal(a, b);
  });
});

describe("the featured membership card is only dark where it is drawn dark", () => {
  test("every light-on-dark rule for the featured card sits inside the wide-screen media query (below it the card is light, so light text would vanish)", () => {
    const css = read("components/editions/editorial/editorial.css");
    const outside = css.replace(/@media \(min-width: 60rem\) \{(?:[^{}]|\{[^{}]*\})*\}/g, "");
    for (const rule of [".ed-tier-card--feature .ed-link", ".ed-tier-card--feature .ed-input", ".ed-tier-card--feature .ed-field", ".ed-tier-card--feature .ed-checks li {", ".ed-tier-card--feature a:not"]) assert.ok(!outside.includes(rule), `${rule} must be inside the 60rem media query`);
  });
});
