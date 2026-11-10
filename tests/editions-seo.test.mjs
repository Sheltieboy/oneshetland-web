/**
 * Editions search visibility: while Editions is not open to everyone, every Edition page is noindex and the sitemap leaves Editions out. (Ported from the retired pilot tests: the
 * behaviour stays, the pilot does not.) Pure rules plus source guards; no network.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SEO = await import("../lib/editions/seo.ts");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const BUNDLE = { edition: { slug: "zz-edition", title: "ZZ Edition", summary: "x", description: null, status: "published", is_test: false }, organiser: { name: "ZZ Org" } };

describe("search engines: Edition pages are direct-link only until Editions is open", () => {
  test("while Editions is not open to everyone, every Edition page says noindex,nofollow", () => {
    for (const open of [undefined, false]) assert.deepEqual(SEO.editionMetadata(BUNDLE, { openToEveryone: open }).robots, { index: false, follow: false });
    assert.deepEqual(SEO.editionMetadata(BUNDLE, {}).robots, { index: false, follow: false }, "fails closed when the flag is not supplied");
  });
  test("once Editions is open, a published non-test Edition is indexable again; drafts and tests never are", () => {
    assert.equal(SEO.editionMetadata(BUNDLE, { openToEveryone: true }).robots, undefined);
    assert.deepEqual(SEO.editionMetadata({ ...BUNDLE, edition: { ...BUNDLE.edition, status: "draft" } }, { openToEveryone: true }).robots, { index: false, follow: false });
    assert.deepEqual(SEO.editionMetadata({ ...BUNDLE, edition: { ...BUNDLE.edition, is_test: true } }, { openToEveryone: true }).robots, { index: false, follow: false });
  });
  test("every public Edition page and the organiser page read the flag for their robots", () => {
    for (const f of ["app/editions/[slug]/page.tsx", "app/editions/[slug]/programme/page.tsx", "app/editions/[slug]/programme/[item]/page.tsx", "app/editions/[slug]/partners/page.tsx", "app/editions/[slug]/updates/page.tsx", "app/editions/[slug]/[page]/page.tsx"]) {
      const s = read(f);
      const calls = s.match(/editionMetadata\(/g)?.length ?? 0;
      assert.ok(calls >= 1, f);
      assert.equal((s.match(/openToEveryone: await getEditionsEnabled\(\)/g) ?? []).length, calls, `${f}: every editionMetadata call passes the flag`);
    }
    assert.match(read("app/organisers/[slug]/page.tsx"), /\(await getEditionsEnabled\(\)\)/);
  });
  test("the calendar files carry X-Robots-Tag while Editions is not open", () => {
    for (const f of ["app/editions/[slug]/calendar.ics/route.ts", "app/editions/[slug]/programme/[item]/calendar.ics/route.ts"]) assert.match(read(f), /X-Robots-Tag": "noindex, nofollow"/, f);
  });
});

describe("the sitemap leaves Editions out until they are open", () => {
  const s = read("app/sitemap.ts");
  test("Editions, organisers and sessions are only fetched when editions.enabled is on, and the flag read fails closed", () => {
    assert.match(s, /const editionsOpen = await \(async \(\) => \{ try \{ const \{ data, error \} = await publicClient\(\)\.rpc\("editions_enabled"\); return !error && data === true; \} catch \{ return false; \} \}\)\(\);/);
    for (const t of ["editions", "edition_organisers", "edition_sessions"]) assert.match(s, new RegExp(`editionsOpen \\? rowsFiltered\\("${t}"`), t);
    assert.doesNotMatch(s, /editions_pilot|edition_pilot/, "the sitemap never consults retired switches");
  });
});
