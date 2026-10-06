/**
 * Logo vs photograph — a logo is shown whole, a photograph keeps its crop. Deterministic: file name, alt text, the business's
 * own logo field, or an explicit role. Never an AI guess, and never a change to stored content.
 * Run: node --test tests/image-role.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { imageRole, fitClasses, LOGO_FIT } from "../lib/business-page/image-role.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const AVRIL_LOGO = "https://avrilthomsonsmith.com/cdn/shop/files/AvrilThomsonSmith-logo_7c1b8cb5-f2db-4241-b81d-c8ea42af572e.png?v=1758186000";
const AVRIL_PAINTING = "https://avrilthomsonsmith.com/cdn/shop/files/original_3ae2b3c3-abf6-47aa-87c8-41d1322a3805.png?v=1791045857";
const COVER = "absolute inset-0 h-full w-full object-cover";

describe("How an image's role is decided", () => {
  test("the real Avril logo is a logo, from its FILE NAME alone (alt text 'Avril Thomson Smith' says nothing)", () => {
    assert.equal(imageRole(AVRIL_LOGO, "Avril Thomson Smith"), "logo");
    assert.equal(imageRole(AVRIL_PAINTING, "Sandness at Dawn – Avril Thomson Smith"), "photo");
  });
  test("file-name words are whole words; camelCase is split; extensions and queries are ignored", () => {
    for (const logo of ["https://a.example/img/Acme-Logo.png", "https://a.example/AcmeLogo.webp", "https://a.example/acme_logo_2x.jpg?v=3", "https://a.example/wordmark.png", "https://a.example/brand-lockup.png", "https://a.example/a/monogram.svg", "https://a.example/BrandMark.png", "https://a.example/favicon.png", "https://a.example/my%20logo.png"]) assert.equal(imageRole(logo), "logo", logo);
    for (const photo of ["https://a.example/catalogue.jpg", "https://a.example/technology.png", "https://a.example/logistics-van.jpg", "https://a.example/shop.jpg?name=logo", "https://a.example/sunset.jpg", "https://a.example/blogpost.jpg", ""]) assert.equal(imageRole(photo), "photo", photo);
  });
  test("a directory called logos is NOT evidence (our own /business-logos/ folder also holds shopfront photographs)", () => {
    assert.equal(imageRole("/business-logos/shetland-with-love.jpeg", "Love From Shetland shopfront"), "photo");
    assert.equal(imageRole("https://oneshetland.com/business-logos/avril-thomson-smith-art.jpg", "x", {}), "photo");
    assert.equal(imageRole("https://oneshetland.com/business-logos/avril-thomson-smith-art.jpg", "x", { knownLogos: ["https://oneshetland.com/business-logos/avril-thomson-smith-art.jpg"] }), "logo", "…unless it IS the business's logo field");
  });
  test("the business's own logo field counts (same file, query ignored); another file does not", () => {
    assert.equal(imageRole("https://cdn.example/a/b.jpg?w=200", "", { knownLogos: ["https://cdn.example/a/b.jpg?w=900"] }), "logo");
    assert.equal(imageRole("https://cdn.example/a/c.jpg", "", { knownLogos: ["https://cdn.example/a/b.jpg", null, undefined] }), "photo");
  });
  test("alt text saying 'logo' counts; 'catalogue' does not", () => {
    assert.equal(imageRole("https://a.example/x1.png", "Avril Thomson Smith logo"), "logo");
    assert.equal(imageRole("https://a.example/x2.png", "Our Logo"), "logo");
    assert.equal(imageRole("https://a.example/x3.png", "Spring catalogue cover"), "photo");
  });
  test("an explicit role beats every inference, both ways", () => {
    assert.equal(imageRole(AVRIL_LOGO, "", { role: "photo" }), "photo");
    assert.equal(imageRole("https://a.example/sunset.jpg", "", { role: "logo" }), "logo");
  });
});

describe("What a logo and a photograph look like in the frame", () => {
  test("a logo (wide or square) loses the cover crop: contained, padded, on white — nothing is cropped", () => {
    for (const shape of ["wide", "square"]) {
      const out = fitClasses(COVER, imageRole(`https://a.example/${shape}-logo.png`));
      assert.ok(!/\bobject-cover\b/.test(out), shape); assert.ok(out.includes("object-contain") && out.includes("bg-white") && out.includes("p-[9%]"), shape);
      assert.ok(out.includes("absolute inset-0 h-full w-full"), "frame sizing is kept");
    }
    assert.equal(LOGO_FIT, "object-contain bg-white p-[9%]");
  });
  test("product and photographic images keep the normal crop, byte for byte", () => {
    for (const src of [AVRIL_PAINTING, "https://a.example/shop.jpg", "/business-logos/shetland-with-love.jpeg"]) assert.equal(fitClasses(COVER, imageRole(src)), COVER);
    assert.equal(fitClasses("h-full w-full object-contain p-1", "logo"), "h-full w-full object-contain p-1", "something already contained is left alone");
    assert.equal(fitClasses("w-full", "logo"), "w-full");
  });
  test("every picture rendered by the preview and the business page goes through the one Img primitive that applies this", () => {
    const prim = read("components/design-v2/primitives.tsx");
    assert.match(prim, /imageRole\(src, alt, \{ role, knownLogos \}\)/); assert.match(prim, /fitClasses\(className, r\)/);
    assert.match(prim, /if \(r === "logo" && decorative/, "a logo is never used as a background texture");
    const preview = read("components/launch-preview/PreviewPage.tsx"), page = read("components/business-page/BusinessPageV2.tsx");
    for (const f of [preview, page]) assert.doesNotMatch(f.replace(/\/\/.*$/gm, ""), /<img\b/, "no raw <img> bypassing the primitive");
    assert.match(preview, /knownLogos=\{\[cfg\.business\.logo\]\}/); assert.match(page, /knownLogos=\{\[id\.logo\]\}/);
    assert.equal((page.match(/decorative/g) ?? []).length, 1); assert.equal((preview.match(/decorative/g) ?? []).length, 2);
  });
});

describe("It is a rendering fix only: stored content, provenance and live data are untouched", () => {
  test("the role code reads no database, writes nothing, and the enrichment/provenance code does not use it", () => {
    const code = read("lib/business-page/image-role.ts").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(code, /supabase|\.from\(|\.rpc\(|fetch\(|process\.env|import /);
    for (const f of ["enrich-core", "enrich-run", "enrich.server", "source-fetch", "source-extract"]) assert.doesNotMatch(read(`lib/launch-partners/${f}.ts`), /image-role|imageRole/, f);
    assert.doesNotMatch(read("lib/launch-partners/campaigns.server.ts"), /image-role|imageRole/);
  });
  test("the validators still accept a stored picture exactly as before (role is optional, nothing is required or rewritten)", async () => {
    const { parsePreviewConfig, parsePageDraft } = await import("../lib/launch-partners/validate.ts");
    const { buildPreviewSkeleton, buildPageSkeleton } = await import("../lib/launch-partners/draft.ts");
    const rec = { id: "b1", name: "Avril", category: "retail", description: "d", address: "Shetland", locality: "Shetland", logo_url: null, cover_url: AVRIL_LOGO, website: null, tags: [] };
    const pv = parsePreviewConfig(buildPreviewSkeleton(rec, "avril"), "avril"), pg = parsePageDraft(buildPageSkeleton(rec));
    assert.ok(pv.ok && pg.ok); assert.equal(pv.value.business.image.src, AVRIL_LOGO); assert.ok(!("role" in pv.value.business.image), "nothing adds a role to stored content");
    const withRole = JSON.parse(JSON.stringify(pv.value)); withRole.business.image.role = "logo";
    assert.ok(parsePreviewConfig(withRole, "avril").ok, "an explicit role is accepted if someone sets one");
  });
});
