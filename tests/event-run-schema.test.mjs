/**
 * eventRunSchema + What's On SEO helpers + sitemap + front door gate. No network (the sitemap runs against the in-memory fake).
 * Run: node --test --import ./tests/support/register.mjs tests/event-run-schema.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventSchema, eventRunSchema } from "../lib/seo-schema.ts";
import { trimDescription, eventPageMetadata, whatsOnCanonical, eventIsListable, activityIsListable } from "../lib/whats-on-seo.ts";
import { frontDoorAccess, frontDoorOutcome } from "../lib/event-front-door.ts";
import { setDb } from "./support/fake-supabase.mjs";

const BASEEV = { id:"e1", title:"Up Helly Aa", description:"<p>Fire  festival</p>", starts_at:"2027-01-26T18:00:00Z", ends_at:"2027-01-27T02:00:00Z", venue:"Lerwick", locality:"Lerwick", formatted_address:null, cover_url:"https://x.test/a.jpg", status:"published", business:null, hub:{name:"Lerwick Hub"}, ticket_types:[{name:"Adult",price_pence:1500,is_active:true},{name:"Old",price_pence:100,is_active:false}] };
const GOLDEN = [{"@context":"https://schema.org","@type":"Event","name":"Up Helly Aa","startDate":"2027-01-26T18:00:00Z","endDate":"2027-01-27T02:00:00Z","description":"Fire festival","image":"https://x.test/a.jpg","url":"https://oneshetland.com/whats-on/e1","eventStatus":"https://schema.org/EventScheduled","eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode","location":{"@type":"Place","name":"Lerwick","address":"Lerwick"},"offers":[{"@type":"Offer","name":"Adult","price":"15.00","priceCurrency":"GBP","url":"https://oneshetland.com/whats-on/e1","availability":"https://schema.org/InStock"}],"organizer":{"@type":"Organization","name":"Lerwick Hub"}},{"@context":"https://schema.org","@type":"Event","name":"Up Helly Aa","startDate":"2027-01-26T18:00:00Z","description":"Fire festival","url":"https://oneshetland.com/whats-on/e1","eventStatus":"https://schema.org/EventCancelled","eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode","location":{"@type":"Place","name":"Shetland","address":"Shetland, Scotland"},"organizer":{"@type":"Organization","name":"B"}}];

describe("eventSchema is byte-identical for events without occurrences", () => {
  test("golden output captured from origin/main before this change", () => {
    const second = { ...BASEEV, status: "cancelled", ends_at: null, hub: null, business: { name: "B" }, ticket_types: [], cover_url: null, venue: null, locality: null };
    assert.equal(JSON.stringify([eventSchema(BASEEV), eventSchema(second)]), JSON.stringify(GOLDEN));
  });
  test("eventRunSchema with no occurrences returns exactly eventSchema", () => {
    assert.equal(JSON.stringify(eventRunSchema(BASEEV, [])), JSON.stringify(eventSchema(BASEEV)));
    assert.equal(JSON.stringify(eventRunSchema(BASEEV, null)), JSON.stringify(eventSchema(BASEEV)));
  });
});

describe("eventRunSchema for a dated run", () => {
  const run = { ...BASEEV, id: "panto", title: "Cinderella", ticket_types: [], hub: null, venue: "Garrison Theatre", organiser_name: "Lerwick Drama Club" };
  const occs = [
    { starts_at: "2026-12-05T19:00:00Z", ends_at: "2026-12-05T21:00:00Z", status: "scheduled" },
    { starts_at: "2026-12-12T19:00:00Z", ends_at: "2026-12-12T21:00:00Z", status: "cancelled" },
    { starts_at: "2026-12-19T19:00:00Z", ends_at: "2026-12-19T21:00:00Z", status: "scheduled", venue: "Brae Hall" },
  ];
  const NOW = Date.parse("2026-12-01T00:00:00Z");
  test("parent start is the first upcoming performance; end is the last; subEvents carry per-performance status and place", () => {
    const s = eventRunSchema(run, occs, NOW);
    assert.equal(s["@type"], "Event"); assert.equal(s.startDate, "2026-12-05T19:00:00Z"); assert.equal(s.endDate, "2026-12-19T21:00:00Z");
    assert.equal(s.url, "https://oneshetland.com/whats-on/panto");
    assert.deepEqual(s.subEvent.map((x) => x.eventStatus.split("/").pop()), ["EventScheduled", "EventCancelled", "EventScheduled"]);
    assert.equal(s.subEvent[2].location.name, "Brae Hall"); assert.equal(s.subEvent[0].location.name, "Garrison Theatre");
    assert.equal(s.eventStatus, "https://schema.org/EventScheduled");
    assert.deepEqual(s.organizer, { "@type": "Organization", name: "Lerwick Drama Club" });
  });
  test("once the first has passed, the parent start is the next upcoming one", () => assert.equal(eventRunSchema(run, occs, Date.parse("2026-12-10T00:00:00Z")).startDate, "2026-12-19T19:00:00Z"));
  test("all cancelled: parent is EventCancelled and start falls back to the first overall", () => {
    const s = eventRunSchema(run, occs.map((o) => ({ ...o, status: "cancelled" })), NOW);
    assert.equal(s.eventStatus, "https://schema.org/EventCancelled"); assert.equal(s.startDate, "2026-12-05T19:00:00Z");
  });
  test("no offers without a real https ticket link; with one, the offer carries that link", () => {
    assert.equal("offers" in eventRunSchema(run, occs, NOW), false);
    assert.equal("offers" in eventRunSchema({ ...run, ticket_url: "javascript:alert(1)" }, occs, NOW), false);
    assert.equal("offers" in eventRunSchema({ ...run, ticket_url: "http://insecure.test" }, occs, NOW), false);
    assert.equal(eventRunSchema({ ...run, ticket_url: "https://tix.test/p" }, occs, NOW).offers[0].url, "https://tix.test/p");
  });
  test("organiser falls back to the hub or business when organiser_name is blank", () => {
    assert.equal(eventRunSchema({ ...run, organiser_name: "  ", hub: { name: "A Hub" } }, occs, NOW).organizer.name, "A Hub");
  });
});

describe("What's On metadata", () => {
  test("trimDescription strips tags, collapses space, cuts near 155 at a word", () => {
    const t = trimDescription("<p>" + "word ".repeat(80) + "</p>");
    assert.ok(t.length <= 156 && t.endsWith("…") && !t.includes("<") && !t.includes("  "));
    assert.equal(trimDescription("Short one."), "Short one."); assert.equal(trimDescription(null), "");
  });
  test("a real event gets description, absolute canonical, OpenGraph and Twitter", () => {
    const m = eventPageMetadata("abc", { id: "abc", title: "Gig", description: "A night of fiddle music.", venue: "Hall", locality: "Brae", cover_url: "https://x.test/i.jpg" });
    assert.equal(m.title, "Gig"); assert.equal(m.description, "A night of fiddle music.");
    assert.equal(m.alternates.canonical, "https://oneshetland.com/whats-on/abc");
    assert.equal(m.openGraph.url, "https://oneshetland.com/whats-on/abc"); assert.equal(m.openGraph.images[0].url, "https://x.test/i.jpg");
    assert.equal(m.twitter.card, "summary_large_image");
  });
  test("no description: a sensible fallback naming the venue; no cover: summary card; non-https cover ignored", () => {
    const m = eventPageMetadata("abc", { id: "abc", title: "Gig", description: null, venue: "Hall", locality: "Brae", cover_url: "http://x.test/i.jpg" });
    assert.match(m.description, /^Gig at Hall, Brae\./); assert.equal(m.twitter.card, "summary"); assert.equal(m.openGraph.images, undefined);
  });
  test("a missing or hidden event leaks nothing and is not indexed", () => {
    const m = eventPageMetadata("secret-id", null);
    assert.deepEqual(m, { title: "Event", robots: { index: false, follow: false } });
    assert.ok(!JSON.stringify(m).includes("secret-id"));
  });
  test("listing canonical: variants collapse to the base; a category keeps its own page; legacy names normalise; junk is ignored", () => {
    assert.equal(whatsOnCanonical({}), "https://oneshetland.com/whats-on");
    assert.equal(whatsOnCanonical({ category: "" }), "https://oneshetland.com/whats-on");
    assert.equal(whatsOnCanonical({ category: "Music" }), "https://oneshetland.com/whats-on?category=Music");
    assert.equal(whatsOnCanonical({ category: "Music & Gigs" }), "https://oneshetland.com/whats-on?category=Music");
    assert.equal(whatsOnCanonical({ category: ["Food & Drink", "x"] }), "https://oneshetland.com/whats-on?category=Food%20%26%20Drink");
  });
  test("pages wire the helpers; nothing else in metadata is dropped", () => {
    const r = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
    assert.match(r("app/whats-on/[id]/page.tsx"), /return eventPageMetadata\(id, e\)/);
    assert.match(r("app/whats-on/page.tsx"), /title: "What's On", alternates: \{ canonical: whatsOnCanonical\(sp\) \}/);
    assert.match(r("app/whats-on/regular/page.tsx"), /canonical: REGULAR_CANONICAL/);
    assert.match(r("app/whats-on/regular/page.tsx"), /title: "Regular activities"/);
  });
});

describe("sitemap visibility rules", () => {
  test("events: published, not hidden, hub events only when approved", () => {
    assert.equal(eventIsListable({ id: "1", status: "published", is_hidden: false, organiser_hub_id: null }), true);
    assert.equal(eventIsListable({ id: "1", status: "published", is_hidden: false, organiser_hub_id: "h", calendar_approved: true }), true);
    assert.equal(eventIsListable({ id: "1", status: "published", is_hidden: false, organiser_hub_id: "h", calendar_approved: false }), false);
    assert.equal(eventIsListable({ id: "1", status: "published", is_hidden: true }), false);
    assert.equal(eventIsListable({ id: "1", status: "draft", is_hidden: false }), false);
    assert.equal(eventIsListable({ id: "1", status: "published" }), false);   // unknown hidden-ness fails closed
  });
  test("activities: published, unpaused, owner live; unknown fails closed", () => {
    const hubs = new Set(["h1"]), biz = new Set(["b1"]);
    const ok = { slug: "yoga", status: "published", admin_paused: false };
    assert.equal(activityIsListable({ ...ok, organiser_hub_id: "h1", calendar_approved: true }, hubs, biz), true);
    assert.equal(activityIsListable({ ...ok, organiser_hub_id: "h1", calendar_approved: false }, hubs, biz), false);
    assert.equal(activityIsListable({ ...ok, organiser_hub_id: "h2", calendar_approved: true }, hubs, biz), false);
    assert.equal(activityIsListable({ ...ok, organiser_business_id: "b1" }, hubs, biz), true);
    assert.equal(activityIsListable({ ...ok, organiser_business_id: "b2" }, hubs, biz), false);
    assert.equal(activityIsListable({ ...ok, is_platform_activity: true }, hubs, biz), true);
    assert.equal(activityIsListable({ ...ok }, hubs, biz), false);
    assert.equal(activityIsListable({ ...ok, organiser_business_id: "b1", status: "draft" }, hubs, biz), false);
    assert.equal(activityIsListable({ ...ok, organiser_business_id: "b1", admin_paused: true }, hubs, biz), false);
    assert.equal(activityIsListable({ ...ok, organiser_business_id: "b1", admin_paused: undefined }, hubs, biz), false);
    assert.equal(activityIsListable({ ...ok, organiser_business_id: "b1", slug: "" }, hubs, biz), false);
  });
});

describe("sitemap.ts end to end over the in-memory fake", () => {
  test("lists only visible events and activities, keeps existing entries, uses updated_at", async () => {
    setDb({
      local_businesses: [{ id: "b1", slug: "shop", is_active: true }, { id: "b2", slug: "closed", is_active: false }],
      hubs: [{ id: "h1", is_active: true }, { id: "h2", is_active: false }],
      events: [
        { id: "ev-ok", status: "published", is_hidden: false, organiser_hub_id: null, updated_at: "2026-11-01T10:00:00Z" },
        { id: "ev-draft", status: "draft", is_hidden: false },
        { id: "ev-hidden", status: "published", is_hidden: true },
        { id: "ev-hub-unapproved", status: "published", is_hidden: false, organiser_hub_id: "h1", calendar_approved: false },
        { id: "ev-hub-ok", status: "published", is_hidden: false, organiser_hub_id: "h1", calendar_approved: true },
      ],
      regular_activities: [
        { slug: "choir", status: "published", admin_paused: false, organiser_business_id: "b1", updated_at: "2026-10-05T09:00:00Z" },
        { slug: "draft-club", status: "draft", admin_paused: false, organiser_business_id: "b1" },
        { slug: "paused-club", status: "published", admin_paused: true, organiser_business_id: "b1" },
        { slug: "closed-biz", status: "published", admin_paused: false, organiser_business_id: "b2" },
        { slug: "dead-hub", status: "published", admin_paused: false, organiser_hub_id: "h2", calendar_approved: true },
        { slug: "hub-unapproved", status: "published", admin_paused: false, organiser_hub_id: "h1", calendar_approved: false },
        { slug: "hub-walk", status: "published", admin_paused: false, organiser_hub_id: "h1", calendar_approved: true },
      ],
      spik_dictionary: [], vessels: [], content_articles: [],
    });
    const { default: sitemap } = await import("../app/sitemap.ts");
    const out = await sitemap();
    const urls = out.map((o) => o.url);
    const evs = urls.filter((u) => u.includes("/whats-on/") && !u.includes("/regular/") && u !== "https://oneshetland.com/whats-on/regular").sort();
    assert.deepEqual(evs, ["https://oneshetland.com/whats-on/ev-hub-ok", "https://oneshetland.com/whats-on/ev-ok"]);
    assert.deepEqual(urls.filter((u) => u.includes("/whats-on/regular/")).sort(), ["https://oneshetland.com/whats-on/regular/choir", "https://oneshetland.com/whats-on/regular/hub-walk"]);
    assert.equal(out.find((o) => o.url.endsWith("/ev-ok")).lastModified.toISOString(), "2026-11-01T10:00:00.000Z");
    assert.equal(out.find((o) => o.url.endsWith("/regular/choir")).lastModified.toISOString(), "2026-10-05T09:00:00.000Z");
    for (const keep of ["https://oneshetland.com", "https://oneshetland.com/whats-on", "https://oneshetland.com/directory/shop", "https://oneshetland.com/hubs/h1"]) assert.ok(urls.includes(keep), keep);
    assert.ok(!urls.includes("https://oneshetland.com/directory/closed"));
    assert.ok(!urls.some((u) => u.includes("/whats-on/add")), "the hidden front door is never in the sitemap");
  });
});

describe("hidden front door", () => {
  test("access: only the exact server flag 'on', or staff", () => {
    assert.equal(frontDoorAccess({ flag: "on", isStaff: false }), "open");
    assert.equal(frontDoorAccess({ flag: undefined, isStaff: true }), "staff_preview");
    for (const f of [undefined, null, "", "ON", "true", "1", "off", " on"]) assert.equal(frontDoorAccess({ flag: f, isStaff: false }), "hidden", String(f));
  });
  test("outcomes: events and activities route; ask categories need the one answer", () => {
    assert.equal(frontDoorOutcome("music_gigs").kind, "event");
    assert.equal(frontDoorOutcome("fitness_exercise").kind, "activity");
    assert.equal(frontDoorOutcome("sport").kind, "ask");
    assert.equal(frontDoorOutcome("sport", "dates").kind, "event");
    assert.equal(frontDoorOutcome("family", "weekly").kind, "activity");
    assert.equal(frontDoorOutcome("other", "banana").kind, "ask");
    assert.equal(frontDoorOutcome("music_gigs", "weekly").kind, "event");   // an answer cannot override a decided category
    for (const v of [null, "", "nope", 7]) assert.equal(frontDoorOutcome(v).kind, "choose");
  });
  test("the page is gated server-side, noindex, not a NEXT_PUBLIC flag, and linked from nowhere", () => {
    const r = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
    const page = r("app/whats-on/add/page.tsx") + r("lib/event-submissions-access.server.ts");   // the gate lives in the shared access module
    assert.match(page, /process\.env\.EVENT_FRONT_DOOR/); assert.doesNotMatch(page, /NEXT_PUBLIC/);
    assert.match(page, /notFound\(\)/); assert.match(page, /index: false/);
    assert.doesNotMatch(r("app/sitemap.ts"), /whats-on\/add/);
  });
});

describe("community events in the run schema", () => {
  const run = { ...BASEEV, id: "c1", hub: null, business: null, ticket_types: [], is_platform_event: true };
  const o = [{ starts_at: "2026-12-05T19:00:00Z", status: "scheduled" }];
  test("a community run names its contributor, never OneShetland, even if organiser_name is missing", () => {
    assert.equal(eventRunSchema({ ...run, source: "community_submission", organiser_name: "Unst Quilters" }, o).organizer.name, "Unst Quilters");
    assert.equal(eventRunSchema({ ...run, source: "community_submission", organiser_name: null }, o).organizer.name, "Community organiser");
  });
  test("a plain platform-owned run names no organizer; only the explicit marker names OneShetland", () => {
    assert.equal("organizer" in eventRunSchema({ ...run, source: null }, o), false);
    assert.equal(eventRunSchema({ ...run, source: "oneshetland" }, o).organizer.name, "OneShetland");
  });
  test("a business-owned run keeps the business as organizer, and a curated run credits its organiser_name", () => {
    assert.equal(eventRunSchema({ ...run, is_platform_event: false, business: { name: "Harry's" }, organiser_name: "Other" }, o).organizer.name, "Harry's");
    assert.equal(eventRunSchema({ ...run, source: null, organiser_name: "Mareel" }, o).organizer.name, "Mareel");
  });
});
