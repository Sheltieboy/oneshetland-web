import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const cta = read("components/business/JoinBusinessCta.tsx");

test("exact copy: heading, description and the two action labels", () => {
  assert.match(cta, /Is your business on OneShetland\?/);
  assert.match(cta, /Already listed\? Claim your business and take control of your details\. Not listed yet\? Add your business for free and help folk across Shetland find you\./);
  assert.match(cta, /Claim your business\s*\n/); assert.match(cta, /Add your business — free/);
});
test("the two actions use the EXISTING journeys, and those routes exist", () => {
  assert.match(cta, /JOIN_CLAIM_HREF = "\/business#find-your-business"/); assert.match(cta, /JOIN_ADD_HREF = "\/directory\/new"/);
  assert.ok(existsSync(new URL("../app/directory/new/page.tsx", import.meta.url)));
  assert.match(read("app/business/page.tsx"), /id="find-your-business"/);
});
test("free is the offer: no paid plans, prices or subscriptions are mentioned", () => {
  assert.doesNotMatch(cta, /£|\bPro\b|Premium|subscription|upgrade|per month|\/month/i);
});
test("a searched-for name pre-fills the add form, URL-encoded and capped", () => {
  assert.match(cta, /\?name=\$\{encodeURIComponent\(name\.slice\(0, 80\)\)\}/);
});
test("accessible: labelled section, real headings and links, 44px targets, visible focus", () => {
  assert.match(cta, /<section aria-labelledby=\{id\}/); assert.match(cta, /<h2 id=\{id\}/);
  assert.match(cta, /min-h-\[44px\]/); assert.match(cta, /focus-visible:outline/);
});
test("placement: homepage (after Discover local), Directory banner, Directory zero-results card", () => {
  const home = read("app/page.tsx");
  // The homepage invitation is now the shared ContributeCard (same two journeys, same links, same words), directly after Discover local; the old band is gone.
  assert.ok(home.indexOf("<DiscoverLocal") < home.indexOf('id="c-business"'));
  assert.doesNotMatch(home, /<JoinBusinessCta/);
  assert.match(home, /JOIN_CLAIM_HREF/); assert.match(home, /JOIN_ADD_HREF/);
  assert.match(home, /Is your business on OneShetland\?/);
  const dir = read("app/directory/page.tsx");
  assert.match(dir, /!\(q && all\.length === 0\) && <JoinBusinessCta variant="banner"/);
  assert.match(dir, /<JoinBusinessCta variant="empty" name=\{q\}/);
  assert.doesNotMatch(dir, /\n\s+Add your business\n/); // the old lone button was folded into the card
});
test("search, filters and sticky bar are untouched by the banner", () => {
  const dir = read("app/directory/page.tsx");
  assert.match(dir, /scope="business"/); assert.match(dir, /submit=\{\{ path: "\/directory"/);
});
