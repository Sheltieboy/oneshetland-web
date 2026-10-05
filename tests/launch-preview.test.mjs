/**
 * Launch Partner Preview — private access, privacy headers, and "nothing is live" guarantees.
 * Run: node --test tests/launch-preview.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import nextConfig from "../next.config.ts";
import { getPreviewConfig, previewSlugs } from "../lib/launch-preview/registry.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("configuration", () => {
  test("each registered preview is self-consistent and carries nothing purchasable", () => {
    assert.ok(previewSlugs().includes("love-from-shetland"));
    for (const slug of previewSlugs()) {
      const c = getPreviewConfig(slug);
      assert.equal(c.slug, slug);
      assert.ok(c.products.length >= 4 && c.products.length <= 6, "4–6 representative products");
      for (const p of c.products) {
        assert.ok(p.price > 0 && Number.isFinite(p.price));
        assert.deepEqual(Object.keys(p).sort(), ["blurb", "id", "image", "price", "title"], "a preview product has no stock, sku, checkout or link field");
      }
    }
    assert.equal(getPreviewConfig("nope"), null);
  });
  test("no invitation secret, token or hash is in source control", () => {
    const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const root = new URL("../", import.meta.url).pathname;
    for (const dir of ["lib/launch-preview", "components/launch-preview", "app/launch"]) {
      for (const f of walk(join(root, dir))) {
        const text = readFileSync(f, "utf8");
        assert.doesNotMatch(text, /\b[0-9a-f]{64}\b/, `${f} contains a 64-hex string`);
        assert.doesNotMatch(text, /\binvite=[A-Za-z0-9_-]{30,}/, `${f} contains an invite link`);
      }
    }
    assert.doesNotMatch(read("scripts/launch-invite.mjs"), /\b[0-9a-f]{64}\b/);
  });
});

const headers = await nextConfig.headers();
describe("privacy", () => {
  const rule = headers.find((h) => h.source === "/launch/:path*");
  const val = (k) => rule?.headers.find((h) => h.key === k)?.value ?? "";

  test("/launch/* is noindex, never cached, and sends no Referer", () => {
    assert.ok(rule, "no header rule for /launch/*");
    assert.match(val("X-Robots-Tag"), /noindex/); assert.match(val("X-Robots-Tag"), /nofollow/);
    assert.equal(val("Referrer-Policy"), "no-referrer");
    assert.match(val("Cache-Control"), /no-store/);
  });
  test("the rule comes after the site-wide one, so it wins on Referrer-Policy", () => {
    assert.ok(headers.indexOf(rule) > headers.findIndex((h) => h.source === "/:path*"));
  });
  test("robots.txt disallows /launch/ and the sitemap never lists it", async () => {
    assert.match(read("app/robots.ts"), /"\/launch\/"/);
    assert.doesNotMatch(read("app/sitemap.ts"), /launch/i);
  });
  test("the page is noindex in its own metadata, dynamic, and asks the DATABASE about the invitation before reading any data", () => {
    const page = read("app/launch/[slug]/page.tsx");
    assert.match(page, /index: false/); assert.match(page, /follow: false/); assert.match(page, /dynamic = "force-dynamic"/);
    const gate = page.indexOf("notFound()");
    assert.ok(gate > 0 && gate < page.indexOf("await readDirectoryFacts"), "the notFound gate must come before any data read");
    assert.match(page, /openPrivatePreview\(slug\)/); assert.match(page, /if \(!open\) notFound\(\)/);
    assert.doesNotMatch(page, /searchParams/, "the page never reads the token from the address");
    const door = read("lib/launch-preview/invite.server.ts");
    assert.match(door, /launch_invite_resolve/); assert.match(door, /data !== cfg\.directoryBusinessId/, "the invitation must be for THIS preview's business");
  });
  test("public navigation, cookie banner and analytics are not rendered under /launch/", () => {
    const layout = read("app/layout.tsx");
    for (const c of ["AnalyticsProvider", "ConsentBanner", "SiteHeader", "SiteFooter"]) {
      assert.match(layout, new RegExp(`<HideOnPrivateRoutes><${c}`), `${c} not wrapped`);
    }
    assert.match(read("components/site/HideOnPrivateRoutes.tsx"), /"\/launch\/"/);
  });
  test("no public API exposes a preview, and nothing links to one", () => {
    const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const root = new URL("../", import.meta.url).pathname;
    for (const f of walk(join(root, "app/api"))) assert.doesNotMatch(readFileSync(f, "utf8"), /launch-preview|\/launch\//, f);
    for (const f of ["components/site/SiteHeader.tsx", "components/site/SiteFooter.tsx", "app/sitemap.ts"]) assert.doesNotMatch(read(f), /\/launch/, f);
  });
});

describe("nothing is live, nothing can be bought", () => {
  const page = read("components/launch-preview/PreviewPage.tsx");
  const cta = read("components/launch-preview/ClaimEntry.tsx");
  test("the page has no form, no outbound action and no purchase control", () => {
    assert.doesNotMatch(page, /<form|action=|onSubmit|fetch\(|sign-in|sign-up|\/checkout|\/basket|Add to basket|Buy now/i);
    assert.doesNotMatch(cta, /fetch\(|XMLHttpRequest|sendBeacon|action=|<form|supabase|mailto:/i, "the claim button sends nothing");
  });
  test("every product card says it is a preview and is not for sale", () => {
    assert.match(page, /Preview · not for sale/); assert.match(page, /Preview products — not live/);
  });
  test("the core reassurances are on the page, once and calmly", () => {
    const all = page + cta;
    for (const s of ["Private preview · Nothing is live", "Your private OneShetland preview", "only people with this invitation can see it", "nothing on it is live",
      "hasn&apos;t joined OneShetland", "nothing will be published without your approval", "Nothing will be published until you claim the business and explicitly approve it",
      "Claiming your preview does NOT publish anything", "Like what you see?", "Claiming gives you access to review and manage your business. Nothing new is published until you choose to publish it.", "does not indicate participation or endorsement",
      "Being prepared", "Coming next", "Available", "Illustration · not live", "Preview products — not live"]) {
      assert.ok(all.includes(s) || all.includes(s.replace("&apos;", "'")), `missing: ${s}`);
    }
    // calmer: the old four-card grid is gone
    assert.doesNotMatch(page, /has not joined OneShetland\.\W*<\/p>\s*<p className="mt-1 text-sm/);
    const hero = page.slice(page.indexOf("function Hero"), page.indexOf("/* ── private notice"));
    assert.doesNotMatch(hero, /Nothing is (live|published)/, "the hero no longer repeats the status");
  });
  test("the CTA reads 'Claim {business} →' with the private line beneath, and still sends nothing", () => {
    assert.match(cta, /Claim \{businessName\} →/);
    assert.match(cta, /Still private\. Nothing goes live until you approve it\./);
    assert.doesNotMatch(cta, /Claim my private preview/);
    assert.doesNotMatch(cta, /fetch\(|XMLHttpRequest|sendBeacon|<form|supabase|mailto:|localStorage|cookie|invite|token/i, "the entry component makes no request and holds no secret");
    assert.match(cta, /Continue →/); assert.match(cta, /href=\{`\/launch\/\$\{slug\}\/claim`\}/);
  });
  test("every illustration frame is labelled and no frame names another business", () => {
    assert.ok((page.match(/Illustration · not live/g) ?? []).length >= 1);
    const across = page.slice(page.indexOf("function Across"), page.indexOf("/* ── 6."));
    assert.doesNotMatch(across, /Sumburgh|Hay's|Dowry|Peerie|Café|Cafe/i);
    for (const f of ["Home", "Local", "Shop", "Search"]) assert.match(across, new RegExp(`<Frame label="${f}">`));
  });
});
