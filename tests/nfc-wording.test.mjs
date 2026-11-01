/**
 * NFC tile wording: tiles are built but not yet produced or posted, so no customer-facing screen may say one is included, available now, or will
 * arrive by a date. Wording only: the request mechanism, prices and plan permissions are unchanged.
 * Run: node --test tests/nfc-wording.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { nfcRowLabel, nfcPitch, nfcCardText, NFC_SOON, NFC_NEEDS_ADDRESS } from "../lib/nfc-wording.ts";
import { TIER_PITCH, TIER_FEATURES, TIER_PRICE, TIER_PRICE_PENCE, PREMIUM_ANNUAL_PENCE, PREMIUM_ANNUAL_PRICE, PLAN_COMPARISON } from "../lib/listing-tiers.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");

describe("the words", () => {
  test("the plan row and the Pro blurb say coming soon; other tiers' blurbs and rows are untouched", () => {
    assert.equal(nfcRowLabel("Tap-to-stamp NFC tile"), "Tap-to-stamp NFC tile (coming soon)"); assert.equal(nfcRowLabel("Your analytics"), "Your analytics");
    assert.match(nfcPitch(TIER_PITCH.pro.blurb), /Tap-to-stamp tiles are coming soon\./); assert.doesNotMatch(nfcPitch(TIER_PITCH.pro.blurb), /offers, a loyalty card, tap-to-stamp,/);
    assert.equal(nfcPitch(TIER_PITCH.free.blurb), TIER_PITCH.free.blurb); assert.equal(nfcPitch(TIER_PITCH.premium.blurb), TIER_PITCH.premium.blurb);
  });
  test("the tile card: nothing is promised before a tile exists, and no timescale is ever stated", () => {
    for (const st of ["none", null, undefined, "requested"]) { const t = nfcCardText(st).line; assert.doesNotMatch(t, /included|within|working days|ship|arrive|free\b|\d+\s*(days|hours)/i, String(st)); }
    assert.match(nfcCardText("none").line, /coming soon/i); assert.match(nfcCardText("none").line, /Nothing is posted yet/);
    assert.equal(nfcCardText("none").button, "Join the tile waiting list"); assert.match(nfcCardText("requested").line, /waiting list/); assert.match(nfcCardText("requested").line, /no delivery date/);
    assert.equal(nfcCardText("requested").button, null);
  });
  test("tiles that HAVE been posted or activated still read as they should", () => {
    assert.match(nfcCardText("dispatched").line, /Posted/); assert.match(nfcCardText("active").line, /Active/);
  });
  test("the label and the missing-address message no longer say 'request'/'ship'", () => { assert.equal(NFC_SOON, "Coming soon"); assert.match(NFC_NEEDS_ADDRESS, /waiting list/); });
});

describe("billing page", () => {
  const bm = read("components/business/BillingManager.tsx");
  test("the yearly offers no longer include a tile, in any of the three places they appear", () => {
    assert.doesNotMatch(bm, /plus an NFC tile/); assert.doesNotMatch(bm, /NFC tile is included/); assert.equal((bm.match(/two months free`/g) ?? []).length, 3);
    assert.match(bm, /You&apos;re on yearly billing — two months free\./);
  });
  test("no 'included with your subscription', no shipping timeframe, no 'Request my NFC tile'", () => { assert.doesNotMatch(bm, /included with your subscription/); assert.doesNotMatch(bm, /within 3 working days|we'll ship/i); assert.doesNotMatch(bm, /Request my NFC tile/); });
  test("the section is labelled Coming soon, and the plan rows and Pro blurb go through the wording helpers", () => {
    assert.match(bm, /NFC tap-to-stamp tile\s*\n\s*<span[^>]*>\{NFC_SOON\}<\/span>/); assert.match(bm, /nfcPitch\(TIER_PITCH\[tier\]\.blurb\)/); assert.match(bm, /nfcRowLabel\(f\.label\)/);
  });
  test("the existing mechanism is untouched: the button still calls requestNfc -> requestNfcTile, only for status 'none', and the token/URL still shows", () => {
    assert.match(bm, /await requestNfcTile\(b\.id\)/); assert.match(bm, /b\.nfc_status === "none" && <button onClick=\{requestNfc\}/); assert.match(bm, /NFC_TILE_URL_PREFIX\}\{b\.nfc_token\}/); assert.match(bm, /tierUnlocks\(tier, "nfc"\)/);
    assert.match(bm, /if \(b\.lat == null \|\| b\.lng == null\)/);
  });
});

describe("help and other customer-facing text", () => {
  test("the help topic no longer promises it is free, included, or posted within three working days", () => {
    const t = read("components/help/topics.tsx"); const nfc = t.slice(t.indexOf('"nfc-tile": {'), t.indexOf('"booking-setup": {'));
    assert.doesNotMatch(nfc, /three working days|it's free|it&apos;s free|included with your subscription/i); assert.match(nfc, /Tiles are coming soon/); assert.match(nfc, /can&apos;t give a delivery date/);
    assert.match(t, /loyalty card, tap-to-stamp tiles \(coming soon\)/); assert.doesNotMatch(t, /or they tap an NFC tile if you have one/);
  });
  test("the loyalty paywall no longer lists tapping a tile as something you get", () => { assert.match(read("app/business/[id]/manage/loyalty/page.tsx"), /till code \(tap-to-stamp tiles are coming soon\)/); });
  test("sweep: no customer-facing file says a tile is included / free / posted within a time", () => {
    const skip = /(^|\/)(admin|node_modules|\.next|tests)(\/|$)|launch-readiness/; const bad = /(NFC|tap-to-stamp)[^\n]{0,80}(included with|is included|we post it|we'll ship|ship within|within (3|three)|posted within|it's free)|(plus|and) an NFC tile/i;
    const hits = [];
    const walk = (d) => { for (const n of readdirSync(join(ROOT, d))) { const rel = join(d, n); if (skip.test(rel)) continue; const st = statSync(join(ROOT, rel)); if (st.isDirectory()) walk(rel); else if (/\.(tsx?|mdx?)$/.test(n) && bad.test(read(rel))) hits.push(rel); } };
    for (const d of ["app", "components", "lib"]) walk(d);
    assert.deepEqual(hits, []);
  });
  test("/business already said coming soon and still does", () => { const b = read("app/business/page.tsx"); assert.match(b, /Tap-to-stamp NFC tile \(coming soon\)/); assert.doesNotMatch(b, /we post you/i); });
});

describe("prices and plan permissions are untouched", () => {
  test("prices, the yearly price and the feature/permission map", () => {
    assert.deepEqual([TIER_PRICE.pro, TIER_PRICE.premium, PREMIUM_ANNUAL_PRICE], ["£12/mo", "£29/mo", "£290/yr"]); assert.deepEqual([TIER_PRICE_PENCE.pro, TIER_PRICE_PENCE.premium, PREMIUM_ANNUAL_PENCE], [1200, 2900, 29000]);
    assert.equal(TIER_FEATURES.nfc, "pro"); assert.ok(PLAN_COMPARISON.some((r) => r.label === "Tap-to-stamp NFC tile" && r.tier === "pro"));
  });
  test("the shared tier file (mirrored into the app) is not edited by this change", () => { assert.match(read("lib/listing-tiers.ts"), /tap-to-stamp, " \+/); });
});
