/**
 * Fetch is hidden while Fetch v2 is built (oneshetland-delivers docs/FETCH_V2_IMPLEMENTATION.md, Step 0a).
 *
 * Proves: the database flag is the only thing that can open Fetch, and it fails closed (an error, a missing RPC, or anything but a
 * literal true is "unavailable"); every /fetch route is covered by the proxy gate and nothing else is; Fetch is linked from no
 * navigation surface (header, More menu, footer, home grid, preview home, business page); the header chip and For You items only
 * appear when the flag admits the visitor; and the Shop never offers Fetch delivery.
 *
 * Run: node --test tests/fetch-availability.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isFetchPath, fetchEnabledFrom, fetchEnabledFor, FETCH_UNAVAILABLE_PATH, SHOP_FETCH_DELIVERY_OFFERED,
} from "../lib/fetch-availability.ts";
import { SECTIONS, LISTED_SECTIONS, PRIMARY_NAV, MORE_NAV, UNLISTED_SECTION_KEYS, getSection } from "../lib/sections.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("the gate decides from the database and fails closed", () => {
  test("only a literal true with no error is enabled", () => {
    assert.equal(fetchEnabledFrom({ data: true, error: null }), true);
    for (const r of [
      { data: false, error: null }, { data: null, error: null }, { data: "true", error: null }, { data: 1, error: null },
      { data: true, error: { message: "boom" } },
      { data: null, error: { code: "PGRST202", message: "Could not find the function public.fetch_v2_enabled" } },
      {}, null, undefined,
    ]) assert.equal(fetchEnabledFrom(r), false, JSON.stringify(r));
  });
  test("asks fetch_v2_enabled, and a throwing or rejecting client is unavailable", async () => {
    const calls = [];
    assert.equal(await fetchEnabledFor({ rpc: (fn) => { calls.push(fn); return Promise.resolve({ data: true, error: null }); } }), true);
    assert.deepEqual(calls, ["fetch_v2_enabled"]);
    assert.equal(await fetchEnabledFor({ rpc: () => { throw new Error("network"); } }), false);
    assert.equal(await fetchEnabledFor({ rpc: () => Promise.reject(new Error("network")) }), false);
  });
  test("a database without the flag migration yet (today's production) keeps Fetch hidden", async () => {
    const missing = { rpc: () => Promise.resolve({ data: null, error: { code: "PGRST202", message: "function not found" } }) };
    assert.equal(await fetchEnabledFor(missing), false);
  });
});

describe("every Fetch route is gated, and nothing else", () => {
  test("covers /fetch and everything beneath it", () => {
    for (const p of ["/fetch", "/fetch/", "/fetch/new", "/fetch/about", "/fetch/apply", "/fetch/previous", "/fetch/connect-bank",
      "/fetch/runs/new", "/fetch/0d38887b-8e0f-4aa6-b5c3-3a41abb38fd6"]) assert.equal(isFetchPath(p), true, p);
  });
  test("does not catch the coming-soon page itself, or unrelated pages", () => {
    for (const p of [FETCH_UNAVAILABLE_PATH, "/fetchy", "/", "/shop", "/driver-agreement", "/restricted-goods", "/admin/drivers",
      "/admin/operations", "/api/fetch"]) assert.equal(isFetchPath(p), false, p);
  });
  test("proxy.ts rewrites gated paths to the coming-soon page, no-store and noindex, keeping refreshed auth cookies", () => {
    const src = read("proxy.ts");
    assert.match(src, /isFetchPath\(request\.nextUrl\.pathname\) && !\(await fetchEnabledFor\(supabase\)\)/);
    assert.match(src, /NextResponse\.rewrite\(new URL\(FETCH_UNAVAILABLE_PATH, request\.url\)\)/);
    assert.match(src, /response\.cookies\.getAll\(\)\.forEach\(\(c\) => gated\.cookies\.set\(c\)\)/);
    assert.match(src, /"Cache-Control", "private, no-store"/);
    assert.match(src, /"X-Robots-Tag", "noindex"/);
    // The gate runs after the session refresh, so a signed-in tester is recognised.
    assert.ok(src.indexOf("await supabase.auth.getUser()") < src.indexOf("isFetchPath(request.nextUrl.pathname)"));
  });
  test("the proxy matcher still runs on /fetch routes (only static assets are excluded)", () => {
    const m = read("proxy.ts").match(/matcher:\s*\[\s*"([^"]+)"/);
    assert.ok(m, "matcher not found");
    assert.doesNotMatch(m[1], /fetch/);
    const re = new RegExp(`^${m[1].replace(/\\\\/g, "\\")}$`);
    for (const p of ["/fetch", "/fetch/new", "/fetch/runs/new"]) assert.match(p, re, p);
  });
  test("the coming-soon page is not indexed and invites nobody to request, drive or pay", () => {
    const src = read("app/fetch-coming-soon/page.tsx");
    assert.match(src, /robots: \{ index: false, follow: false \}/);
    assert.doesNotMatch(src, /href="\/fetch|sign-?up|apply|request a|Request a/i);
  });
});

describe("Fetch is linked from nowhere", () => {
  test("fetch is the one unlisted section, and still resolvable for its own pages", () => {
    assert.deepEqual([...UNLISTED_SECTION_KEYS], ["fetch"]);
    assert.equal(LISTED_SECTIONS.length, SECTIONS.length - 1);
    assert.ok(!LISTED_SECTIONS.some((s) => s.key === "fetch"));
    assert.ok(getSection("fetch"), "getSection('fetch') still works for the gated pages");
  });
  test("header primary and More menus exclude Fetch; everything else they listed is still there", () => {
    assert.ok(!PRIMARY_NAV.some((s) => s.key === "fetch"));
    assert.deepEqual(MORE_NAV.map((s) => s.key), ["get-it-done", "spik", "boats", "memories"]);
    assert.equal(PRIMARY_NAV.length, 8);
  });
  test("footer, home grid and preview home read the listed sections, never SECTIONS", () => {
    for (const f of ["components/site/SiteFooter.tsx", "components/home/HomeSections.tsx", "components/preview/v2/HomeV2.tsx"]) {
      const src = read(f);
      assert.match(src, /import \{ LISTED_SECTIONS \} from "@\/lib\/sections"/, f);
      assert.doesNotMatch(src, /(?<!LISTED_)\bSECTIONS\b/, f);
    }
  });
  test("the business page no longer advertises Fetch", () => {
    assert.doesNotMatch(read("app/business/page.tsx"), /Fetch|fetch-phone/);
  });
  test("account and join copy no longer present Fetch as a working service", () => {
    assert.doesNotMatch(read("app/account/payments/page.tsx"), /\bFetch\b/);
    assert.doesNotMatch(read("components/welcome/JoinWizard.tsx"), /\bFetch\b/);
  });
});

describe("Fetch content on other pages follows the flag", () => {
  test("the header delivery chip is only loaded when Fetch is available", () => {
    assert.match(read("app/layout.tsx"), /const fetchStatus = account && \(await isFetchAvailable\(\)\)/);
  });
  test("For You delivery items are only loaded when Fetch is available", () => {
    assert.match(read("lib/for-you.server.ts"), /safe\(isFetchAvailable\(\)\.then\(\(on\) => \(on \? fetchDeliveries\(sb, userId\) : \[\]\)\)\)/);
  });
  test("isFetchAvailable asks the database once per request and fails closed", () => {
    const src = read("lib/fetch-availability.server.ts");
    assert.match(src, /import "server-only"/);
    assert.match(src, /cache\(async \(\): Promise<boolean> =>/);
    assert.match(src, /fetchEnabledFor\(await createClient\(\)\)/);
    assert.match(src, /catch \{\s*return false;/);
  });
});

describe("the Shop never offers Fetch delivery", () => {
  test("switched off in one place", () => assert.equal(SHOP_FETCH_DELIVERY_OFFERED, false));
  test("the basket requires the switch as well as the business setting", () => {
    assert.match(read("app/basket/page.tsx"), /const fetchOk = SHOP_FETCH_DELIVERY_OFFERED && !!ship\?\.fetch_enabled;/);
  });
  test("sellers cannot switch it on, and their saved setting is not rewritten", () => {
    const src = read("components/business/ProductsManager.tsx");
    assert.match(src, /\{SHOP_FETCH_DELIVERY_OFFERED && \(/);
    assert.match(src, /fetch_enabled: fetchIt,/);
    assert.match(src, /useState\(initial\?\.fetch_enabled \?\? false\)/);
  });
});
