/**
 * The Christmas and New Year theme: the window, the hand-back, the surfaces that wear it, the
 * surfaces that deliberately do not, and the artwork itself.
 * Run: node --test tests/festive-branding.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { isFestive, brandMark, BRAND_MARK, FESTIVE_MARK, FESTIVE_FROM, FESTIVE_UNTIL } from "../lib/festive.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** The same file with its comments taken out, for assertions about what the code actually does. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** A UK wall-clock instant, written as the UTC instant it actually is. GMT in both months here. */
const uk = (y, m, d, h = 12) => new Date(Date.UTC(y, m - 1, d, h));

describe("the window", () => {
  test("it runs from 18 November 2026 to the end of 5 January 2027", () => {
    assert.equal(FESTIVE_FROM, "2026-11-18");
    assert.equal(FESTIVE_UNTIL, "2027-01-06");
  });

  test("the day before is ordinary, the first day is festive", () => {
    assert.equal(isFestive(uk(2026, 11, 17, 23)), false);
    assert.equal(isFestive(uk(2026, 11, 18, 0)), true);
  });

  test("Christmas Day, Hogmanay and 5 January are all festive", () => {
    for (const d of [uk(2026, 12, 25), uk(2026, 12, 31, 23), uk(2027, 1, 1), uk(2027, 1, 5, 23)]) {
      assert.equal(isFestive(d), true, d.toISOString());
    }
  });

  test("it hands itself back on 6 January, with nothing deployed", () => {
    assert.equal(isFestive(uk(2027, 1, 6, 0)), false);
    assert.equal(isFestive(uk(2027, 1, 6, 12)), false);
    assert.equal(isFestive(uk(2027, 2, 1)), false);
    assert.equal(isFestive(uk(2027, 12, 25)), false, "it is one season, not every December");
  });

  test("the boundary is the Shetland day, not the server's", () => {
    // 6 January 00:30 UK is 5 January 23:30 in New York and 6 January 09:30 in Tokyo. A server
    // reading its own clock would disagree with Shetland; this reads the timezone database.
    assert.equal(isFestive(new Date("2027-01-05T23:30:00Z")), true, "still the 5th in Shetland");
    assert.equal(isFestive(new Date("2027-01-06T00:30:00Z")), false, "the 6th in Shetland");
  });

  test("and it is a date window, not a flag anyone can leave on", () => {
    const src = read("lib/festive.ts");
    assert.ok(!/admin_config|process\.env|NEXT_PUBLIC/.test(src), "no switch, no override");
  });
});

describe("which mark", () => {
  test("ordinary out of season, festive in it", () => {
    assert.equal(brandMark(false), BRAND_MARK);
    assert.equal(brandMark(true), FESTIVE_MARK);
    assert.equal(BRAND_MARK, "/brand/logo-mark-keyed.png");
    assert.equal(FESTIVE_MARK, "/brand/festive/logo-mark-festive.png");
  });

  test("the everyday mark is still shipped, untouched", () => {
    assert.ok(statSync(new URL("../public/brand/logo-mark-keyed.png", import.meta.url)).size > 0);
  });
});

describe("the surfaces that wear it", () => {
  const decided = "app/layout.tsx";

  test("the root layout decides once, on the server, and passes it down", () => {
    const src = read(decided);
    assert.match(src, /import \{ isFestive \} from "@\/lib\/festive"/);
    assert.match(src, /const festive = isFestive\(\);/);
    for (const c of ["SiteHeader", "SiteFooter", "AppInstallPrompt"]) {
      assert.match(src, new RegExp(`<${c}[^/]*festive=\\{festive\\}`), `${c} is told`);
    }
  });

  test("the header and footer ask for the mark rather than naming a file", () => {
    for (const p of ["components/site/SiteHeader.tsx", "components/site/SiteFooter.tsx", "components/site/AppInstallPrompt.tsx"]) {
      const src = read(p);
      assert.match(src, /brandMark\(festive\)/, p);
      assert.ok(!src.includes('"/brand/logo-mark-keyed.png"'), `${p} no longer hard-codes the everyday mark`);
      assert.ok(!src.includes(FESTIVE_MARK), `${p} does not hard-code the festive one either`);
    }
  });

  test("the wordmark stays, in the header and the footer", () => {
    for (const p of ["components/site/SiteHeader.tsx", "components/site/SiteFooter.tsx"]) {
      assert.match(read(p), /OneShetland\s*\n?\s*<\/span>|>OneShetland</, p);
    }
  });

  test("sign-in and create-account match the header above them", () => {
    for (const p of ["app/sign-in/page.tsx", "app/sign-up/page.tsx"]) {
      assert.match(read(p), /brandMark\(isFestive\(\)\)/, p);
    }
  });

  test("the social card lockup wears it; the 8% watermark does not", () => {
    const src = read("app/api/social-image/route.tsx");
    assert.match(src, /const markUrl = new URL\(brandMark\(isFestive\(\)\)/);
    assert.match(src, /const ringUrl = new URL\("\/brand\/logo-mark-keyed\.png"/, "the watermark keeps the plain ring");
    assert.match(src, /<img src=\{markUrl\} width=\{54\}/, "the 54px lockup is the festive one");
    assert.equal((src.match(/<Frame ringUrl=\{ringUrl\} markUrl=\{markUrl\}/g) ?? []).length, 5, "every card template");
  });
});

describe("the icons", () => {
  test("the apple icon and the share card are chosen at request time, not at build time", () => {
    for (const p of ["app/apple-icon.ts", "app/opengraph-image.ts"]) {
      const src = read(p);
      assert.match(src, /export const dynamic = "force-dynamic";/, `${p} must not freeze a season into a build`);
      assert.match(src, /isFestive\(\)/, p);
      assert.match(src, /Cache-Control": "public, max-age=3600, s-maxage=3600/, `${p} hands back within the hour`);
    }
  });

  test("they serve the original files, unchanged, out of season", () => {
    assert.match(read("app/apple-icon.ts"), /"apple-icon-festive\.png" : "apple-icon\.png"/);
    assert.match(read("app/opengraph-image.ts"), /"opengraph-image-festive\.png" : "opengraph-image\.png"/);
    for (const f of ["apple-icon.png", "opengraph-image.png", "apple-icon-festive.png", "opengraph-image-festive.png"]) {
      assert.ok(statSync(new URL(`../assets/brand/${f}`, import.meta.url)).size > 0, f);
    }
  });

  test("both routes keep the sizes the static files declared", () => {
    assert.match(read("app/apple-icon.ts"), /size = \{ width: 180, height: 180 \}/);
    assert.match(read("app/opengraph-image.ts"), /size = \{ width: 1200, height: 630 \}/);
  });

  test("the files they read are traced into the deployed functions", () => {
    const cfg = code("next.config.ts");
    assert.match(cfg, /"\/apple-icon": \["\.\/assets\/brand\/apple-icon\.png", "\.\/assets\/brand\/apple-icon-festive\.png"\]/);
    assert.match(cfg, /"\/opengraph-image": \["\.\/assets\/brand\/opengraph-image\.png", "\.\/assets\/brand\/opengraph-image-festive\.png"\]/);
    // A glob here swept the whole folder into both functions, the 2.2MB master with it.
    assert.ok(!/assets\/brand\/\*/.test(cfg), "name the files, do not glob the folder");
    assert.ok(!/master/.test(cfg), "and never name the master");
  });

  test("the favicon is deliberately left alone — it is unreadable at tab size", () => {
    assert.ok(statSync(new URL("../app/icon.png", import.meta.url)).size > 0);
  });
});

describe("the artwork", () => {
  const png = (p) => {
    const b = readFileSync(new URL(`../${p}`, import.meta.url));
    assert.equal(b.subarray(1, 4).toString(), "PNG", `${p} is a PNG`);
    return { bytes: b.length, w: b.readUInt32BE(16), h: b.readUInt32BE(20), colourType: b[25] };
  };

  test("the mark is square, carries alpha, and is small enough for a 40px slot", () => {
    const m = png("public/brand/festive/logo-mark-festive.png");
    assert.deepEqual([m.w, m.h], [128, 128], "3.2x the largest use");
    assert.ok(m.colourType === 6, "RGBA — it sits on cream, on navy and inside a white box");
    assert.ok(m.bytes < 60_000, `${m.bytes} bytes`);
    assert.ok(m.bytes < png("public/brand/logo-mark-keyed.png").bytes, "lighter than the mark it stands in for");
  });

  test("the derivatives keep the geometry of the files they stand in for", () => {
    const a = png("assets/brand/apple-icon.png"), af = png("assets/brand/apple-icon-festive.png");
    assert.deepEqual([af.w, af.h], [a.w, a.h]);
    const o = png("assets/brand/opengraph-image.png"), of_ = png("assets/brand/opengraph-image-festive.png");
    assert.deepEqual([of_.w, of_.h], [o.w, o.h]);
    assert.deepEqual([of_.w, of_.h], [1200, 630], "the size every scraper expects");
  });

  test("the festive master is kept, so the derivatives can be remade", () => {
    // It lives beside the derivative in public/, NOT in assets/brand/: the tracer bundles anything
    // under that path into both icon functions, and this file is 2.2MB.
    const m = png("public/brand/festive/logo-mark-festive-master-1254.png");
    assert.deepEqual([m.w, m.h], [1254, 1254]);
  });
});

describe("what it must not disturb", () => {
  test("the page watermark keeps the everyday ring", () => {
    assert.match(read("app/globals.css"), /url\(\/brand\/logo-mark-keyed\.png\)/);
  });

  test("nothing seasonal reaches the layout, the palette or the copy", () => {
    const layout = read("app/layout.tsx");
    assert.ok(!/snow|tinsel|🎄|🎅/i.test(layout), "no decorations, only the mark");
    assert.match(layout, /themeColor: "#17395B"/, "the brand navy is untouched");
    assert.match(layout, /Shop Shetland\. Discover Shetland\. OneShetland\./, "the strapline is untouched");
  });
});
