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
test("a plain platform-owned event makes NO organiser claim (the 120 curated events)", () => {
  for (const e of [{ is_platform_event: true, source: null, business: null, hub: null }, { is_platform_event: true }, { is_platform_event: true, source: undefined, organiser_name: null }])
    assert.equal(eventOrganiser(e), null);
});
test("official only by the explicit marker", () => {
  assert.deepEqual(eventOrganiser({ is_platform_event: true, source: "oneshetland", business: null, hub: null }), { kind: "official", name: "OneShetland" });
  assert.deepEqual(eventOrganiser({ source: "oneshetland" }), { kind: "official", name: "OneShetland" });
});
test("a curated listing with an organiser_name is credited to that organiser", () => {
  assert.deepEqual(eventOrganiser({ is_platform_event: true, source: null, organiser_name: " Islesburgh Drama Group ", business: null, hub: null }), { kind: "named", name: "Islesburgh Drama Group" });
  assert.equal(eventOrganiser({ is_platform_event: true, source: null, organiser_name: "   " }), null);
});
test("an owning business or hub is never overridden by an organiser_name", () => {
  assert.equal(eventOrganiser({ business: biz, organiser_name: "Someone else" }).name, "Harry's");
  assert.equal(eventOrganiser({ hub, organiser_name: "Someone else" }).name, "Hillswick Hall");
});
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
test("platform event with an unknown source is never labelled, even with a name", () => {
  assert.equal(eventOrganiser({ is_platform_event: true, source: "something_else" }), null);
  assert.equal(eventOrganiser({ is_platform_event: true, source: "something_else", organiser_name: "X" }), null);
});
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
test("JSON-LD organizer: community names the contributor; OneShetland only with the explicit marker", () => {
  assert.equal(eventSchema({ ...base, business: null, hub: null, is_platform_event: true, source: "community_submission", organiser_name: "Unst Quilters" }).organizer.name, "Unst Quilters");
  assert.equal(eventSchema({ ...base, business: null, hub: null, is_platform_event: true, source: "community_submission" }).organizer.name, "Community organiser");
  assert.equal("organizer" in eventSchema({ ...base, business: null, hub: null, is_platform_event: true, source: null }), false, "a curated platform event names no organizer");
  assert.equal(eventSchema({ ...base, business: null, hub: null, is_platform_event: true, source: "oneshetland" }).organizer.name, "OneShetland");
  assert.equal(eventSchema({ ...base, business: null, hub: null, is_platform_event: true, source: null, organiser_name: "Mareel" }).organizer.name, "Mareel");
});

test("the page and listing route through eventOrganiser", () => {
  assert.match(read("app/whats-on/[id]/page.tsx"), /eventOrganiser\(e\)/);
  assert.match(read("components/events/EventsListing.tsx"), /eventOrganiser\(e\)/);
});
test("no select list asks for columns that are not in production yet", () => {
  // Phase 2A: the new columns are requested ONLY through the capability-tolerant helper (lib/events-schema.ts NEW_EXTRA, with a legacy fallback),
  // never written into a select literal.
  for (const f of ["lib/events-data.ts", "app/api/social-image/route.tsx", "lib/home-data.ts", "lib/local-data.ts"]) assert.doesNotMatch(read(f), /\.select\([^)]*(organiser_name|submission_id|is_dated_run|\bsource\b,)/, f);
  assert.match(read("lib/events-schema.ts"), /organiser_name, source, is_dated_run/);
});

test("contributor wording: warm, plain, no jargon, no 'wee'", () => {
  const all = [C.AFTER_APPROVAL_NOTE, C.cancelledReportedLine("performance"), C.cancelledReportedLine("event"), C.changeRouteLine("automatic"), C.changeRouteLine("after_approval"), C.CHANGE_PENDING_LINE, C.CHANGE_APPLIED_LINE, C.changeDeclinedLine(), C.changeDeclinedLine("The date was in the past."), C.CANCEL_CONFIRM_PROMPT];
  for (const s of all) { assert.doesNotMatch(s, /\bwee\b|moderat|queue|payload|\bAPI\b|trusted organiser|whitelist/i, s); assert.ok(s.length > 20, s); }
  assert.match(C.AFTER_APPROVAL_NOTE, /straight away/);
  assert.match(C.cancelledReportedLine("performance"), /performance/);
  assert.match(C.cancelledReportedLine("event"), /clearly marked Cancelled/);
  assert.match(C.changeRouteLine("automatic"), /straight away/);
  assert.match(C.changeRouteLine("after_approval"), /before this change goes live/);
  assert.match(C.changeDeclinedLine("The date was in the past."), /The date was in the past\./);
});

// ── exhaustive regression matrix: no combination may ever label an event OneShetland-organised by accident ──────────────────────────────────────────
test("matrix: every combination of owner x source x platform flag x organiser_name keeps its true attribution", () => {
  const owners = { none: {}, business: { business: biz }, hub: { hub }, both: { business: biz, hub } };
  const sources = [undefined, null, "", "community_submission", "oneshetland", "something_else"];
  const flags = [undefined, null, false, true];
  const names = [undefined, null, "", "  ", "Unst Quilters"];
  let n = 0;
  for (const [ok, o] of Object.entries(owners)) for (const source of sources) for (const is_platform_event of flags) for (const organiser_name of names) {
    const r = eventOrganiser({ ...o, source, is_platform_event, organiser_name }); n++;
    const label = JSON.stringify({ ok, source, is_platform_event, organiser_name, r });
    // (a) OneShetland appears only for kind official, and official needs the explicit marker and nothing else
    if (r && r.name === "OneShetland") { assert.equal(r.kind, "official", label); assert.equal(source, "oneshetland", label); }
    if (r && r.kind === "official") assert.equal(source, "oneshetland", label);
    // (b) a community event is always community and never carries OneShetland or an owner's name
    if (source === "community_submission") { assert.equal(r.kind, "community", label); assert.notEqual(r.name, "OneShetland", label); }
    // (c) an owning business/hub keeps its attribution unless the row is a community or explicitly official event
    if (ok !== "none" && source !== "community_submission" && source !== "oneshetland") assert.ok(r && (r.kind === "business" || r.kind === "hub"), label);
    // (d) platform ownership alone never produces a label
    if (ok === "none" && (source === undefined || source === null || source === "") && !String(organiser_name ?? "").trim()) assert.equal(r, null, label);
  }
  assert.equal(n, 4 * 6 * 4 * 5);
});
