/**
 * Who an event is "by": the single rule, the JSON-LD organizer, and the contributor wording.
 * Run: node --test --import ./tests/support/register.mjs tests/event-organiser.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventOrganiser } from "../lib/event-organiser.ts";
import { eventSchema } from "../lib/seo-schema.ts";
import * as C from "../lib/contributor-copy.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const biz = { id: "b1", name: "Harry's", logo_url: "https://x/b.png" };
const hub = { id: "h1", name: "Hillswick Hall", logo_url: null };

test("business", () => assert.deepEqual(eventOrganiser({ business: biz, hub: null }), { kind: "business", name: "Harry's", logoUrl: "https://x/b.png", href: "/directory/b1" }));
test("hub", () => assert.deepEqual(eventOrganiser({ business: null, hub }), { kind: "hub", name: "Hillswick Hall", href: "/hubs/h1" }));
test("official: platform event, no source", () => assert.deepEqual(eventOrganiser({ is_platform_event: true, source: null, business: null, hub: null }), { kind: "official", name: "OneShetland" }));
test("community always shows organiser_name, never OneShetland", () => {
  assert.deepEqual(eventOrganiser({ is_platform_event: true, source: "community_submission", organiser_name: "  Unst Quilters ", business: null, hub: null }), { kind: "community", name: "Unst Quilters" });
});
test("community without a name is neutral, never official", () => {
  for (const n of [null, undefined, "", "   "]) {
    const o = eventOrganiser({ is_platform_event: true, source: "community_submission", organiser_name: n });
    assert.equal(o.kind, "community"); assert.equal(o.name, "Community organiser");
  }
});
test("community outranks a stray owner", () => assert.equal(eventOrganiser({ source: "community_submission", organiser_name: "A", business: biz }).kind, "community"));
test("platform event with an unknown source is not official", () => assert.equal(eventOrganiser({ is_platform_event: true, source: "something_else" }), null));
test("legacy rows: no new columns behave exactly as before", () => {
  assert.equal(eventOrganiser({ business: null, hub: null }), null);
  assert.equal(eventOrganiser({}), null);
  assert.equal(eventOrganiser(null), null);
  assert.equal(eventOrganiser({ is_platform_event: false, business: null, hub: null }), null);
  assert.equal(eventOrganiser({ is_platform_event: null, source: null }), null);
  assert.equal(eventOrganiser({ business: biz, hub }).kind, "hub");                        // page order: hub first
  assert.equal(eventOrganiser({ business: biz, hub }, { prefer: "business" }).kind, "business"); // JSON-LD order
  assert.equal(eventOrganiser({ business: { name: null }, hub: null }), null);
});

const base = { id: "e1", title: "T", description: null, starts_at: "2026-12-01T19:00:00Z", ends_at: null, venue: null, locality: null, formatted_address: null, cover_url: null, status: "published", ticket_types: [] };
test("JSON-LD organizer: legacy output identical", () => {
  assert.deepEqual(eventSchema({ ...base, business: { name: "Harry's" }, hub: { name: "Hall" } }).organizer, { "@type": "Organization", name: "Harry's" });
  assert.deepEqual(eventSchema({ ...base, business: null, hub: { name: "Hall" } }).organizer, { "@type": "Organization", name: "Hall" });
  assert.equal("organizer" in eventSchema({ ...base, business: null, hub: null }), false);
});
test("JSON-LD organizer: community names the contributor; official names OneShetland only when official", () => {
  assert.equal(eventSchema({ ...base, business: null, hub: null, is_platform_event: true, source: "community_submission", organiser_name: "Unst Quilters" }).organizer.name, "Unst Quilters");
  assert.equal(eventSchema({ ...base, business: null, hub: null, is_platform_event: true, source: "community_submission" }).organizer.name, "Community organiser");
  assert.equal(eventSchema({ ...base, business: null, hub: null, is_platform_event: true, source: null }).organizer.name, "OneShetland");
});

test("the page and listing route through eventOrganiser", () => {
  assert.match(read("app/whats-on/[id]/page.tsx"), /eventOrganiser\(e\)/);
  assert.match(read("components/events/EventsListing.tsx"), /eventOrganiser\(e\)/);
});
test("no select list asks for columns that are not in production yet", () => {
  for (const f of ["lib/events-data.ts", "app/api/social-image/route.tsx"]) assert.doesNotMatch(read(f), /organiser_name|submission_id|\bsource\b,/, f);
});

test("contributor wording: warm, plain, no jargon, no 'wee'", () => {
  const all = [C.AFTER_APPROVAL_NOTE, C.cancelledReportedLine("performance"), C.cancelledReportedLine("event"), C.changeRouteLine("automatic"), C.changeRouteLine("after_approval"), C.CHANGE_PENDING_LINE, C.CHANGE_APPLIED_LINE, C.changeDeclinedLine(), C.changeDeclinedLine("The date was in the past."), C.CANCEL_CONFIRM_PROMPT];
  for (const s of all) { assert.doesNotMatch(s, /\bwee\b|moderat|queue|payload|\bAPI\b|trusted organiser|whitelist/i, s); assert.ok(s.length > 20, s); }
  assert.match(C.AFTER_APPROVAL_NOTE, /straight away/);
  assert.match(C.cancelledReportedLine("performance"), /performance/);
  assert.match(C.cancelledReportedLine("event"), /whole event/);
  assert.match(C.changeRouteLine("automatic"), /straight away/);
  assert.match(C.changeRouteLine("after_approval"), /before this change goes live/);
  assert.match(C.changeDeclinedLine("The date was in the past."), /The date was in the past\./);
});
