/**
 * Public Editions promotion surfaces: the home strip, the Promoted row on the Editions list, tracking, link files, and the shared markdown vectors.
 * Pure rules, static renders and source guards; nothing touches a network.
 * Run: node --test --import ./tests/support/register-jsx.mjs tests/editions-promo-public.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

await import("./support/register-jsx.mjs");
const P = await import("../lib/editions/promo-public.ts");
const { EditionsStrip } = await import("../components/home/EditionsStrip.tsx");
const { PromotedRow } = await import("../components/editions/PromotedRow.tsx");
const { APP_LINK_PATHS } = await import("../lib/editions/app-links.ts");
const { parseMarkdown } = await import("../lib/editions/markdown.ts");
const { trackPromo } = await import("../lib/editions/promo-track.ts");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const walk = (d, out = []) => { for (const f of readdirSync(join(ROOT, d))) { const p = join(d, f); if (statSync(join(ROOT, p)).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(f)) out.push(p); } return out; };

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (n, o = {}) => ({ edition_id: uuid(n), slug: `fest-${n}`, title: `Festival ${n}`, kind: "multi_day", starts_on: "2027-06-01", ends_on: "2027-06-03", summary: "Hello", cover_url: null, organiser_name: "Up Helly Aa Committee", parent_kind: "hub", parent_slug: "x", ...o });

describe("featured rows", () => {
  test("caps are 3 on the home page and 4 on the Editions list", () => {
    assert.equal(P.HOME_STRIP_CAP, 3); assert.equal(P.DISCOVERY_ROW_CAP, 4);
    const rows = [1, 2, 3, 4, 5, 6].map((n) => row(n));
    assert.equal(P.parseFeatured(rows, P.HOME_STRIP_CAP).length, 3);
    assert.equal(P.parseFeatured(rows, P.DISCOVERY_ROW_CAP).length, 4);
  });
  test("bad input collapses to nothing and malformed rows are dropped", () => {
    for (const bad of [null, undefined, {}, "x", 5, { message: "boom" }]) assert.deepEqual(P.parseFeatured(bad, 3), []);
    const out = P.parseFeatured([null, row(1, { slug: "BAD SLUG" }), row(2, { kind: "wedding" }), row(3, { edition_id: "nope" }), row(4, { title: "" }), row(5), row(5), row(6, { starts_on: "soon" })], 3);
    assert.deepEqual(out.map((e) => e.slug), ["fest-5"]);
  });
  test("the Promoted row is hidden while a search or a kind filter is active", () => {
    assert.equal(P.showPromotedRow({}), true); assert.equal(P.showPromotedRow({ q: "", kind: undefined }), true);
    assert.equal(P.showPromotedRow({ q: "up helly" }), false); assert.equal(P.showPromotedRow({ kind: "season" }), false);
    assert.equal(P.showPromotedRow({ q: "  " }), true);
  });
  test("tracking payloads are refused for odd arguments", () => {
    assert.deepEqual(P.trackPayload(uuid(1), "home", "tap"), { p_edition: uuid(1), p_surface: "home", p_metric: "tap" });
    assert.equal(P.trackPayload("x", "home", "tap"), null); assert.equal(P.trackPayload(uuid(1), "shelf", "tap"), null); assert.equal(P.trackPayload(uuid(1), "home", "click"), null);
  });
  test("trackPromo never throws, even with no network or a rejecting fetch", async () => {
    const real = globalThis.fetch; process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:1"; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
    let seen; globalThis.fetch = (u, o) => { seen = { u, o }; return Promise.reject(new Error("offline")); };
    try { assert.doesNotThrow(() => trackPromo(uuid(1), "home", "tap")); await new Promise((r) => setTimeout(r, 5)); assert.match(seen.u, /rpc\/edition_promo_track$/); assert.equal(seen.o.keepalive, true); assert.deepEqual(JSON.parse(seen.o.body), { p_edition: uuid(1), p_surface: "home", p_metric: "tap" });
      globalThis.fetch = () => { throw new Error("sync"); }; assert.doesNotThrow(() => trackPromo(uuid(1), "discovery", "tap")); assert.doesNotThrow(() => trackPromo("bad", "home", "tap"));
    } finally { globalThis.fetch = real; }
  });
});

describe("home strip", () => {
  test("collapses completely when empty", () => { assert.equal(renderToStaticMarkup(h(EditionsStrip, { items: [] })), ""); });
  test("shows at most three cards, each marked Promoted, linking to the Edition", () => {
    const html = renderToStaticMarkup(h(EditionsStrip, { items: [1, 2, 3, 4, 5].map((n) => row(n)) }));
    assert.equal((html.match(/<li /g) ?? []).length, 3);
    assert.equal((html.match(/>Promoted</g) ?? []).length, 3 + 1);
    assert.match(html, /href="\/editions\/fest-1"/); assert.doesNotMatch(html, /fest-4/);
    assert.match(html, /Festivals and Editions/);
  });
});

describe("Promoted row on the Editions list", () => {
  test("collapses when empty and shows at most four", () => {
    assert.equal(renderToStaticMarkup(h(PromotedRow, { items: [] })), "");
    const html = renderToStaticMarkup(h(PromotedRow, { items: [1, 2, 3, 4, 5, 6].map((n) => row(n)) }));
    assert.equal((html.match(/<li /g) ?? []).length, 4); assert.match(html, /Promoted/);
  });
});

describe("source guards", () => {
  const PUBLIC = ["components/home/EditionsStrip.tsx", "components/editions/PromotedRow.tsx", "components/editions/PromoTrack.tsx", "lib/editions/promo-public.ts", "lib/editions/promo-track.ts", "lib/editions/promo-featured.server.ts"];
  test("no price, buy or package wording and no hard-coded amounts in the public promotion code", () => {
    for (const f of PUBLIC) { const c = strip(read(f)); assert.ok(!/£\s?\d|price|pence|\bbuy\b|get featured|package/i.test(c), `${f} mentions money or purchase`); }
  });
  test("no Community wording anywhere in the new public or admin promotion code", () => {
    const files = [...PUBLIC, "app/admin/editions/commerce/catalogue.ts", "app/admin/editions/commerce/config.ts", "app/admin/editions/commerce/actions.ts", "components/admin/EditionsCommerceAdmin.tsx", ...walk("app/admin/editions/promotions"), "components/admin/EditionsPromoCalendar.tsx"];
    for (const f of files) assert.ok(!/community/i.test(strip(read(f))), `${f} says Community`);
    assert.ok(!/audience/i.test(strip(read("components/admin/EditionsCommerceAdmin.tsx"))), "audience control is gone from the package manager");
  });
  test("the home strip sits after What's happening and before Latest from OneShetland, and passes nothing to the business shelf", () => {
    const src = read("app/page.tsx");
    const a = src.indexOf("<RightNow"), b = src.indexOf("<EditionsStrip"), c = src.indexOf("<LatestEditorial");
    assert.ok(a > 0 && b > a && c > b, "order: RightNow, EditionsStrip, LatestEditorial");
    assert.match(src, /<EditionsStrip items=\{editionsFeatured\} \/>/);
  });
  test("the strip and the list read the featured function for their own surface only, anonymously", () => {
    const f = read("lib/editions/promo-featured.server.ts"); assert.match(f, /publicClient\(\)/); assert.match(f, /edition_featured/); assert.ok(!/service[_-]?role|SERVICE_KEY/i.test(f));
    assert.deepEqual(P.FEATURED_KIND, { home: "homepage", discovery: "discovery" });
    const idx = read("app/editions/page.tsx"); assert.match(idx, /getFeaturedEditions\("discovery"\)/); assert.match(idx, /showPromotedRow\(/);
  });
  test("taps are tracked with the right surface and never block navigation", () => {
    assert.match(read("components/home/EditionsStrip.tsx"), /surface="home"/); assert.match(read("components/editions/PromotedRow.tsx"), /surface="discovery"/);
    const t = read("components/editions/PromoTrack.tsx"); assert.match(t, /onClick=\{\(\) => trackPromo\(/); assert.ok(!/preventDefault|await /.test(t));
    assert.match(read("app/editions/[slug]/page.tsx"), /<PromoView editionId=\{edition\.id\} \/>/);
    assert.match(read("lib/editions/promo-track.ts"), /keepalive: true/);
  });
});

describe("link files", () => {
  test("the app-link paths keep the existing ones, add Editions, and put the exclusions first", () => {
    assert.deepEqual(APP_LINK_PATHS.slice(0, 3), ["NOT /organisers/*/membership", "NOT /editions/*/calendar.ics", "NOT /editions/*/programme/*/calendar.ics"]);
    for (const p of ["/t/*", "/g/*", "/give/*", "/editions", "/editions/*", "/organisers/*"]) assert.ok(APP_LINK_PATHS.includes(p), p);
    const firstPositive = APP_LINK_PATHS.findIndex((p) => !p.startsWith("NOT ")); assert.ok(APP_LINK_PATHS.slice(firstPositive).every((p) => !p.startsWith("NOT ")));
  });
  test("the apple-app-site-association route serves those paths and assetlinks is untouched in kind", async () => {
    assert.match(read("app/.well-known/apple-app-site-association/route.ts"), /paths: APP_LINK_PATHS/);
  });
});

describe("shared markdown vectors", () => {
  const fx = JSON.parse(read("tests/fixtures/editions-markdown-vectors.json"));
  test("there are 26 vectors", () => { assert.equal(fx.vectors.length, 26); });
  for (const v of fx.vectors) test(`the web parser reproduces: ${v.name}`, () => { assert.deepEqual(parseMarkdown(v.input), v.expected); });
});
