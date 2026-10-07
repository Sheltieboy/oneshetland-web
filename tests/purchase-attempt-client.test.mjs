/**
 * Shop-basket and gift checkouts send ONE attempt id per deliberate purchase.
 * Run: node --test tests/purchase-attempt-client.test.mjs
 *
 * The server (create-product-order-intent / create-gift-intent) now keys an order or gift on (buyer, client_request_id), so a
 * repeat of the same purchase resolves to the order it already made. That only works if the client sends the SAME id on every
 * repeat and a NEW one for a genuinely different purchase. This pins both halves, and that the id is never minted per HTTP call.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAttemptHolder, isFinalRefusal } from "../lib/checkout-attempt.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the same purchase keeps one id across clicks, retries and a cancelled-then-resumed payment", () => {
  const h = createAttemptHolder();
  const a = h.idFor("basket-1|card");
  assert.ok(a.length >= 8 && a.length <= 100, "a valid id (the server accepts 8-100 characters)");
  assert.equal(h.idFor("basket-1|card"), a);
  assert.equal(h.idFor("basket-1|card"), a);
});

test("a different purchase — different items, address, recipient or payment method — gets a different id", () => {
  const h = createAttemptHolder();
  const a = h.idFor("basket-1|card");
  const b = h.idFor("basket-1|wallet");
  const c = h.idFor("basket-2|wallet");
  assert.notEqual(b, a); assert.notEqual(c, b);
});

test("a spent attempt is forgotten: the next click is a NEW purchase, even with an identical fingerprint", () => {
  const h = createAttemptHolder();
  const a = h.idFor("basket-1|card");
  h.spend();
  const b = h.idFor("basket-1|card");
  assert.notEqual(b, a);
  assert.equal(h.idFor("basket-1|card"), b, "and it is then held again");
});

test("ids are unguessable and independent", () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) { const h = createAttemptHolder(); seen.add(h.idFor("x")); }
  assert.equal(seen.size, 500);
});

test("isFinalRefusal: a definitive 4xx ends the attempt; in_progress, 5xx and network failures do not", () => {
  const e = (status, code) => Object.assign(new Error("x"), { status, code });
  for (const [status, code] of [[402, "failed"], [409, "checkout_expired"], [409, "idempotency_conflict"], [409, "sold_out"], [400, undefined], [403, "self_payment"], [429, undefined]])
    assert.equal(isFinalRefusal(e(status, code)), true, `${status} ${code}`);
  assert.equal(isFinalRefusal(e(409, "in_progress")), false, "another request for this attempt is mid-payment: retry with the SAME id");
  for (const status of [500, 502, 503, 504]) assert.equal(isFinalRefusal(e(status, undefined)), false, String(status));
  assert.equal(isFinalRefusal(new Error("Failed to send a request")), false, "no status = the request never completed");
  assert.equal(isFinalRefusal(null), false); assert.equal(isFinalRefusal(undefined), false);
});

test("the basket checkout sends the attempt id, mints it once per purchase (not per request), and spends it on a final outcome", () => {
  const src = read("app/basket/page.tsx");
  assert.match(src, /client_request_id:\s*attempt\.idFor\(/, "the request carries the held id");
  assert.match(src, /createAttemptHolder\(\)/);
  assert.doesNotMatch(src, /newCheckoutAttemptId\(/, "the page must not mint an id per click");
  assert.match(src, /isFinalRefusal\(e\)\)\s*attempt\.spend\(\)/);
  assert.ok((src.match(/attempt\.spend\(\)/g) ?? []).length >= 4, "spent on success, on a failed authentication, on card-sheet success and on a final refusal");
  // everything that makes it THIS purchase is in the fingerprint
  const fp = src.slice(src.indexOf("client_request_id:"), src.indexOf("business_id: basket!.business_id"));
  for (const part of ["business_id", "lines", "effFulfilment", "address", "postcode", "regionSlug", "note", "payWith", "cardOnFile"])
    assert.ok(fp.includes(part), `fingerprint is missing ${part}`);
});

test("the gift modal sends the attempt id through startGift, and startGift sends it to the server without minting one", () => {
  const modal = read("components/local/GiftModal.tsx");
  assert.match(modal, /clientRequestId:\s*attempt\.idFor\(/);
  assert.match(modal, /createAttemptHolder\(\)/);
  assert.doesNotMatch(modal, /newCheckoutAttemptId\(/);
  assert.match(modal, /isFinalRefusal\(e\)\)\s*attempt\.spend\(\)/);
  const client = read("lib/local-commerce-client.ts");
  const start = client.slice(client.indexOf("export async function startGift"), client.indexOf("export async function confirmGift"));
  assert.match(start, /client_request_id:\s*input\.clientRequestId/);
  assert.doesNotMatch(start, /newCheckoutAttemptId\(/, "startGift must not mint its own id: that would give every retry a new key and remove the protection");
});

test("purchase errors carry the HTTP status and code so the checkout can tell a final refusal from a transient failure", () => {
  const client = read("lib/local-commerce-client.ts");
  assert.match(client, /err\.status\s*=\s*error\.context\?\.status/);
  assert.match(client, /err\.code\s*=\s*code/);
});
