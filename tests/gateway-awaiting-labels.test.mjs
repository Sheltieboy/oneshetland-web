/**
 * Homepage "Shop · Offers · Book · Experiences": the empty-state label says the feature is live and waiting for businesses, the live count logic is untouched.
 * Run: node --test tests/gateway-awaiting-labels.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../components/preview/v2/HomeV2.tsx", import.meta.url), "utf8");
const gate = src.slice(src.indexOf("export function CommerceGateway"), src.indexOf("/* ── Island life"));

test("each zero-count card says what it is waiting for", () => {
  const m = src.match(/export const AWAITING[^=]*= \{([^}]*)\}/)[1];
  for (const t of ['shop: "Awaiting first products"', 'offers: "Awaiting first offers"', 'book: "Awaiting first services"', 'experiences: "Awaiting first experiences"']) assert.ok(m.includes(t), t);
  assert.doesNotMatch(gate, /Opening soon/, "the gateway no longer says Opening soon");
});
test("the live count logic is unchanged: none shows the label, anything else shows the count with the right noun", () => {
  assert.match(gate, /const n = commerce\[p\]\.length;\s*const d = density\(n\);/);
  assert.match(gate, /\{d === "none" \? AWAITING\[p\] : `\$\{n\} \$\{NOUN\[p\]\[n === 1 \? 0 : 1\]\}`\}/);
  assert.match(src, /const NOUN: Record<Pillar, \[string, string\]> = \{ shop: \["product", "products"\], offers: \["offer", "offers"\], book: \["service", "services"\], experiences: \["experience", "experiences"\] \};/);
});
test("links, order and eligibility are untouched: each card still links to its own section", () => {
  assert.match(gate, /href=\{pl\.seeAll\}/); assert.match(gate, /PILLAR_ORDER\.map\(\(p\) =>/);
  const pre = readFileSync(new URL("../lib/preview-v2.ts", import.meta.url), "utf8");
  for (const h of ['seeAll: "/shop"', 'seeAll: "/local#offers"', 'seeAll: "/directory/bookable"', 'seeAll: "/local#experiences"']) assert.ok(pre.includes(h), h);
});
