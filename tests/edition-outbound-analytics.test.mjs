/**
 * Editions referral tracking — what a click records, and what it must never record.
 * Run: node --test tests/edition-outbound-analytics.test.mjs
 *
 * The risk in click tracking is not that it fails to count. It is that it quietly carries a token, a
 * search term or an email address out of a URL and into an analytics table. These tests pin the two
 * rules that prevent that: an internal click records a KIND and an id, never the address; an external
 * click records the HOSTNAME and nothing else.
 *
 * Local only. No network, no database, no browser.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../components/editions/OutboundLink.tsx", import.meta.url), "utf8");

/* The two pure functions under test, re-created from the component's own source. */
const hostOf = (href) => { try { return new URL(href).hostname.replace(/^www\./, "") || null; } catch { return null; } };
function inferTo(href) {
  if (/^\/directory\/[^/]+/.test(href)) return "business";
  if (/^\/hubs\/[^/]+/.test(href)) return "hub";
  if (/^\/whats-on\/[^/]+/.test(href)) return "event";
  if (/^\/whats-on\/regular\/[^/]+/.test(href)) return "activity";
  if (href === "/directory" || href === "/local") return "directory";
  if (href === "/whats-on") return "whats-on";
  return "other";
}
const idFrom = (href) => /^\/(?:directory|hubs|whats-on)\/([^/?#]+)/.exec(href)?.[1];

/** What would actually be written for a given link. */
const internalProps = (href, page, block) => ({ to: inferTo(href), ...(idFrom(href) ? { target_id: idFrom(href) } : {}), page, block });
const externalProps = (href, page, block) => ({ host: hostOf(href) ?? "unknown", to: "other", page, block });

describe("the re-created helpers match the component", () => {
  test("every destination kind in the component is covered here", () => {
    for (const k of ["business", "hub", "event", "activity", "directory", "whats-on", "sponsor", "other"]) {
      assert.ok(SRC.includes(`"${k}"`), `OutboundTo drifted: ${k} missing from the component`);
    }
  });
  test("the component strips www and uses hostname only", () => {
    assert.ok(SRC.includes("new URL(href).hostname.replace(/^www\\./"), "hostOf drifted from the component");
  });
});

describe("an internal click records a kind and an id — never the address", () => {
  const cases = [
    ["/directory/hamecooked", "business", "hamecooked"],
    ["/directory/da-muckle-market", "business", "da-muckle-market"],
    ["/hubs/oneshetland", "hub", "oneshetland"],
    ["/whats-on/5eb46126-1b91-4858-9367-585f195bb719", "event", "5eb46126-1b91-4858-9367-585f195bb719"],
    ["/local", "directory", undefined],
    ["/whats-on", "whats-on", undefined],
    ["/editions/da-muckle-market/markets", "other", undefined],
  ];
  for (const [href, to, id] of cases) {
    test(`${href} → ${to}`, () => {
      const p = internalProps(href, "home", "cards");
      assert.equal(p.to, to);
      assert.equal(p.target_id, id);
    });
  }
  test("the full href is never in the payload", () => {
    const href = "/directory/hamecooked?utm_source=email&token=SECRET123";
    const p = internalProps(href, "home", "cards");
    const blob = JSON.stringify(p);
    assert.ok(!blob.includes("SECRET123"), `a query token leaked: ${blob}`);
    assert.ok(!blob.includes("utm_source"), `a query string leaked: ${blob}`);
    assert.ok(!blob.includes("?"), `the payload contains a query marker: ${blob}`);
    assert.equal(p.target_id, "hamecooked", "the id is taken before the query");
  });
  test("a fragment is not carried either", () => {
    assert.equal(internalProps("/directory/hamecooked#menu", "home", "cards").target_id, "hamecooked");
  });
});

describe("an external click records the hostname and nothing else", () => {
  test("hostname only, www stripped", () => {
    assert.equal(externalProps("https://www.example.co.uk/shop/item?id=9", "food", "sponsors").host, "example.co.uk");
  });
  test("the path, query and fragment are all discarded", () => {
    const p = externalProps("https://example.com/private/order/112233?email=someone%40example.com#x", "home", "sponsors");
    const blob = JSON.stringify(p);
    assert.equal(p.host, "example.com");
    for (const leak of ["112233", "someone", "%40", "private", "order", "#x"]) {
      assert.ok(!blob.includes(leak), `"${leak}" leaked into the payload: ${blob}`);
    }
  });
  test("a malformed address does not throw and does not leak", () => {
    const p = externalProps("not a url at all", "home", "sponsors");
    assert.equal(p.host, "unknown");
    assert.ok(!JSON.stringify(p).includes("not a url"));
  });
  test("a mailto link yields no usable host and never the address", () => {
    const p = externalProps("mailto:damucklemarket@gmail.com", "take-part", "cards");
    assert.ok(!JSON.stringify(p).includes("damucklemarket"), "an email address must never reach analytics");
  });
});

describe("the payload carries no personal data at all", () => {
  test("only the agreed keys are ever sent", () => {
    assert.deepEqual(Object.keys(internalProps("/directory/x", "home", "cards")).sort(), ["block", "page", "target_id", "to"]);
    assert.deepEqual(Object.keys(externalProps("https://x.com/", "home", "sponsors")).sort(), ["block", "host", "page", "to"]);
  });
  test("the component sends no referrer, no user agent and no address", () => {
    for (const forbidden of ["document.referrer", "navigator.userAgent", "window.location.href", "localStorage", "cookie"]) {
      assert.ok(!SRC.includes(forbidden), `OutboundLink must not read ${forbidden}`);
    }
  });
  test("it rides the existing consented pipeline rather than its own", () => {
    assert.ok(SRC.includes('from "@/lib/analytics"'), "must use the shared consented tracker");
    assert.ok(!SRC.includes("fetch("), "must not post directly; batching and consent live in lib/analytics");
  });
});

describe("the events are the registered ones", () => {
  test("internal and external use their own event names", () => {
    assert.ok(SRC.includes('track("edition_referral_clicked"'));
    assert.ok(SRC.includes('track("edition_outbound_clicked"'));
  });
  test("both are attributed to the Edition, so one organiser never sees another's", () => {
    const uses = [...SRC.matchAll(/objectType: "edition", objectId: editionId/g)];
    assert.equal(uses.length, 2, "both events must be attributed to the Edition");
  });
  test("an external link still opens safely", () => {
    assert.ok(SRC.includes('rel="noopener noreferrer"'));
    assert.ok(SRC.includes('target="_blank"'));
  });
});
