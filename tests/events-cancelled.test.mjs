/**
 * A cancelled event keeps its public page (product decision 7 Nov 2026) but must stay out of EVERY list, feed, calendar, homepage,
 * planner, sitemap, search-adjacent and social surface. The backend policy events_cancelled_public_read lets anyone read a cancelled
 * event by id while is_hidden stays true, so no reader may rely on row security alone.
 *
 * Every loader runs over the in-memory fake with that policy switched ON (setCancelledPolicy) and, as a worst case, with the cancelled
 * rows also carrying is_hidden = false, so only an explicit status filter can keep them out.
 * Run: node --test --import ./tests/support/register.mjs tests/events-cancelled.test.mjs
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDb, setViewer, setCancelledPolicy } from "./support/fake-supabase.mjs";
import { getUpcomingEvents, getEventsInMonth, getEventCategories, getEvent } from "../lib/events-data.ts";
import { getHomeData } from "../lib/home-data.ts";
import { getLocalFeed, getBusinessEventsAndJobs } from "../lib/local-data.ts";
import { getHubEvents } from "../lib/hubs-data.ts";
import { getPlannerCandidates } from "../lib/planner-data.ts";
import { listPublishedAccessibility } from "../lib/accessibility-data.ts";
import { getSpotlightEvent } from "../lib/social-event-row.ts";
import { eventIsListable, eventPageMetadata } from "../lib/whats-on-seo.ts";
import { eventSchema, eventRunSchema } from "../lib/seo-schema.ts";

const D = 24 * 3600_000;
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const BIZ = "biz-1", HUB = "hub-1";

const base = (o) => ({
  id: o.id, title: o.title, category: "Music", status: "published", is_hidden: false, venue: "Mareel", locality: "Lerwick", lat: 60.15, lng: -1.15,
  starts_at: iso(NOW + 3 * D), ends_at: iso(NOW + 3 * D + 2 * 3600_000), cover_url: null, price_text: null, has_tickets: false, is_featured: false,
  description: "x", organiser_hub_id: null, organiser_business_id: null, calendar_approved: true, hub_visibility: null, business: null, hub: null, ticket_types: [],
  ...o,
});
const hidden = (o) => base({ is_hidden: true, ...o });
const GOOD = base({ id: "good", title: "Good Gig" });
const GOOD_BIZ = base({ id: "good-biz", title: "Good Biz Gig", organiser_business_id: BIZ });
const GOOD_HUB = base({ id: "good-hub", title: "Good Hub Gig", organiser_hub_id: HUB, hub_visibility: "islands", calendar_approved: true });
const CANCELLED = {
  community: hidden({ id: "c-comm", title: "Cancelled Community", status: "cancelled", source: "community_submission", organiser_name: "Lerwick Drama Club" }),
  business: hidden({ id: "c-biz", title: "Cancelled Business", status: "cancelled", organiser_business_id: BIZ }),
  hubIslands: hidden({ id: "c-hub", title: "Cancelled Hub", status: "cancelled", organiser_hub_id: HUB, hub_visibility: "islands", calendar_approved: true }),
  hubMembers: hidden({ id: "c-hub-m", title: "Cancelled Members Hub", status: "cancelled", organiser_hub_id: HUB, hub_visibility: "members", calendar_approved: true }),
};
const OTHER_HIDDEN = [hidden({ id: "draft", title: "Draft One", status: "draft" }), hidden({ id: "postponed", title: "Postponed One", status: "postponed" }), hidden({ id: "archived", title: "Archived One", status: "archived" })];
const CANCELLED_TITLES = Object.values(CANCELLED).map((e) => e.title);
// Worst case: the same cancelled rows, but NOT hidden - only an explicit status filter can exclude them.
const LEAKY = Object.values(CANCELLED).map((e) => ({ ...e, id: `${e.id}-leaky`, title: `${e.title} (leaky)`, is_hidden: false }));
const LEAKY_TITLES = LEAKY.map((e) => e.title);
const ALL_BAD = [...CANCELLED_TITLES, ...LEAKY_TITLES, ...OTHER_HIDDEN.map((e) => e.title)];
const names = (l) => l.map((e) => e.title ?? e.name);
const noneBad = (got, where) => { for (const b of ALL_BAD) assert.ok(!got.includes(b), `${where}: leaked "${b}" in ${got.join(" | ")}`); };

beforeEach(() => {
  setViewer("anon");
  setCancelledPolicy(true);
  globalThis.__FAKE_SELECT_GUARD__ = undefined;
  setDb({ events: [GOOD, GOOD_BIZ, GOOD_HUB, ...Object.values(CANCELLED), ...LEAKY, ...OTHER_HIDDEN], accessibility_profiles: [], accessibility_facts: [] });
});

describe("no list, feed, calendar, homepage or planner reader returns a cancelled event", () => {
  test("What's On list (all, upcoming-only, by category, by range) and Load more", async () => {
    for (const q of [{}, { upcomingOnly: true }, { category: "Music" }, { range: "all" }, { limit: 50, offset: 0 }]) {
      const got = names(await getUpcomingEvents(q));
      noneBad(got, JSON.stringify(q));
      assert.ok(got.includes("Good Gig"), `${JSON.stringify(q)}: ${got.join(" | ")}`);
    }
  });
  test("both schemas: the old-schema path filters too", async () => {
    globalThis.__FAKE_SELECT_GUARD__ = (_t, cols) => (/occurrences|organiser_name|is_dated_run/.test(cols) ? { code: "42703", message: "column events.organiser_name does not exist" } : null);
    noneBad(names(await getUpcomingEvents()), "legacy list");
    const d = new Date(NOW + 3 * D);
    noneBad(names(await getEventsInMonth(d.getFullYear(), d.getMonth())), "legacy month");
  });
  test("calendar month grid", async () => {
    const d = new Date(NOW + 3 * D);
    const got = names(await getEventsInMonth(d.getFullYear(), d.getMonth()));
    noneBad(got, "month");
    assert.ok(got.includes("Good Gig"));
  });
  test("category chips are not made from cancelled events", async () => {
    setDb({ events: [GOOD, hidden({ id: "k", title: "k", status: "cancelled", category: "Sport" }), base({ id: "k2", title: "k2", status: "cancelled", category: "Sport" })] });
    const chips = await getEventCategories();
    assert.deepEqual(chips, ["Music"]);
  });
  test("homepage What's On slots", async () => {
    const data = await getHomeData();
    const got = names(data.events);
    noneBad(got, "home");
    assert.ok(got.includes("Good Gig"));
  });
  test("homepage legacy path", async () => {
    globalThis.__FAKE_SELECT_GUARD__ = (_t, cols) => (/occurrences|organiser_name|is_dated_run/.test(cols) ? { code: "42703", message: "column events.organiser_name does not exist" } : null);
    noneBad(names((await getHomeData()).events), "home legacy");
  });
  test("Local feed and a business page", async () => {
    noneBad(names((await getLocalFeed()).events), "local feed");
    const biz = names((await getBusinessEventsAndJobs(BIZ)).events);
    noneBad(biz, "business page");
    assert.ok(biz.includes("Good Biz Gig"));
  });
  test("a hub page", async () => {
    const got = names(await getHubEvents(HUB));
    noneBad(got, "hub page");
    assert.ok(got.includes("Good Hub Gig"));
  });
  test("journey planner", async () => {
    const c = (await getPlannerCandidates(iso(NOW), iso(NOW + 10 * D))).filter((x) => x.kind === "event").map((x) => x.name);
    noneBad(c, "planner");
    assert.ok(c.includes("Good Gig"));
  });
  test("sitemap", async () => {
    const { default: sitemap } = await import("../app/sitemap.ts");
    const urls = (await sitemap()).map((u) => u.url);
    for (const e of [...Object.values(CANCELLED), ...LEAKY, ...OTHER_HIDDEN]) assert.ok(!urls.some((u) => u.endsWith(`/whats-on/${e.id}`)), `sitemap leaked ${e.id}`);
    assert.ok(urls.some((u) => u.endsWith("/whats-on/good")));
    for (const e of [...Object.values(CANCELLED), ...LEAKY]) assert.equal(eventIsListable(e), false);
  });
  test("accessibility browse never names a cancelled event", async () => {
    const all = [...Object.values(CANCELLED), ...LEAKY, GOOD];
    setDb({
      events: all,
      accessibility_profiles: all.map((e) => ({ subject_type: "event", subject_id: e.id, summary: "s", updated_at: iso(NOW), verification: "owner" })),
      accessibility_facts: [],
    });
    const got = (await listPublishedAccessibility()).map((i) => i.name);
    noneBad(got, "accessibility browse");
    assert.deepEqual(got, ["Good Gig"]);
  });
  test("social spotlight card: only a published, visible event", async () => {
    for (const e of [...Object.values(CANCELLED), ...LEAKY, ...OTHER_HIDDEN]) assert.equal(await getSpotlightEvent(e.id), null, e.id);
    assert.equal((await getSpotlightEvent("good"))?.title, "Good Gig");
    globalThis.__FAKE_SELECT_GUARD__ = (_t, cols) => (/occurrences|organiser_name|is_dated_run/.test(cols) ? { code: "42703", message: "x does not exist" } : null);
    assert.equal(await getSpotlightEvent("c-comm-leaky"), null, "old schema, same filters");
    assert.equal((await getSpotlightEvent("good"))?.title, "Good Gig");
  });
});

describe("the event page loader: cancelled is readable by its link, nothing else is", () => {
  test("community, business and public-tier hub events load with status 'cancelled'", async () => {
    for (const id of ["c-comm", "c-biz", "c-hub"]) {
      const e = await getEvent(id);
      assert.ok(e, id);
      assert.equal(e.status, "cancelled");
    }
  });
  test("a hub event on a non-public tier, draft, postponed and archived stay not found", async () => {
    for (const id of ["c-hub-m", "draft", "postponed", "archived"]) assert.equal(await getEvent(id), null, id);
  });
  test("before the migration is applied (policy off) a cancelled event is not found, exactly as today", async () => {
    setCancelledPolicy(false);
    for (const id of ["c-comm", "c-biz", "c-hub"]) assert.equal(await getEvent(id), null, id);
    assert.ok(await getEvent("good"));
  });
  test("old schema and policy on: cancelled still loads (no occurrences), and nothing breaks", async () => {
    globalThis.__FAKE_SELECT_GUARD__ = (_t, cols) => (/occurrences|organiser_name|is_dated_run/.test(cols) ? { code: "42703", message: "column events.organiser_name does not exist" } : null);
    const e = await getEvent("c-comm");
    assert.equal(e?.status, "cancelled");
    assert.deepEqual(e?.occurrences, []);
  });
});

describe("source guards", () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  test("every public events reader asks for status = published explicitly", () => {
    // each of these builds a list from `events`; none may depend on row security alone
    for (const [file, min] of [["lib/events-data.ts", 6], ["lib/local-data.ts", 4], ["lib/home-data.ts", 2], ["lib/planner-data.ts", 1], ["lib/hubs-data.ts", 1], ["lib/social-event-row.ts", 1], ["lib/accessibility-data.ts", 1]]) {
      const n = (read(file).match(/\.eq\("status", "published"\)/g) ?? []).length;
      assert.ok(n >= min, `${file}: expected >= ${min} explicit published filters, found ${n}`);
    }
    assert.match(read("app/sitemap.ts"), /\.eq\("status", "published"\)/);
    assert.doesNotMatch(read("app/api/social-image/route.tsx"), /\.from\("events"\)[\s\S]{0,200}\.eq\("id"/, "the spotlight read lives in lib/social-event-row.ts");
  });
});

describe("a cancelled event's metadata and structured data", () => {
  const cancelled = { id: "c-comm", title: "Cinderella", status: "cancelled", description: "A panto.", venue: "Garrison", locality: "Lerwick", cover_url: "https://example.org/a.jpg" };
  test("title 'Cancelled: <title>', plain description, canonical kept, NOT noindex", () => {
    const m = eventPageMetadata("c-comm", cancelled);
    assert.equal(m.title, "Cancelled: Cinderella");
    assert.equal(m.description, "This event has been cancelled.");
    assert.equal(m.alternates.canonical, "https://oneshetland.com/whats-on/c-comm");
    assert.equal(m.openGraph.title, "Cancelled: Cinderella");
    assert.equal(m.robots, undefined, "no robots directive: search engines should learn it is cancelled");
  });
  test("a published event's metadata is unchanged", () => {
    const m = eventPageMetadata("p", { ...cancelled, status: "published" });
    assert.equal(m.title, "Cinderella");
    assert.match(m.description, /A panto/);
  });
  test("a missing event is still the generic non-indexed answer", () => {
    assert.deepEqual(eventPageMetadata("x", null).robots, { index: false, follow: false });
  });
  const full = { id: "c-comm", title: "Cinderella", description: null, starts_at: iso(NOW + D), ends_at: null, venue: "Garrison", locality: "Lerwick", formatted_address: null, cover_url: null,
    status: "cancelled", business: null, hub: null, ticket_types: [{ name: "General", price_pence: 1000, is_active: true }], ticket_url: "https://example.org/t" };
  test("JSON-LD says EventCancelled and offers nothing to buy (plain event)", () => {
    const j = eventSchema(full);
    assert.equal(j.eventStatus, "https://schema.org/EventCancelled");
    assert.equal(j.offers, undefined);
    assert.equal(eventSchema({ ...full, status: "published" }).offers.length, 1, "a live event still offers its tickets");
  });
  test("JSON-LD for a run: EventCancelled on the parent and every performance, no offers; performances stay listed", () => {
    const occ = [1, 2].map((i) => ({ id: `o${i}`, starts_at: iso(NOW + i * D), ends_at: null, status: "scheduled", venue: null, locality: null, note: null }));
    const j = eventRunSchema(full, occ, NOW);
    assert.equal(j.eventStatus, "https://schema.org/EventCancelled");
    assert.equal(j.offers, undefined);
    assert.equal(j.subEvent.length, 2);
    for (const s of j.subEvent) assert.equal(s.eventStatus, "https://schema.org/EventCancelled");
    const live = eventRunSchema({ ...full, status: "published" }, occ, NOW);
    assert.equal(live.eventStatus, "https://schema.org/EventScheduled");
    assert.ok(live.offers);
  });
  test("a run with one performance cancelled and the event still published keeps per-performance status", () => {
    const occ = [{ id: "a", starts_at: iso(NOW + D), ends_at: null, status: "cancelled", venue: null, locality: null, note: null }, { id: "b", starts_at: iso(NOW + 2 * D), ends_at: null, status: "scheduled", venue: null, locality: null, note: null }];
    const j = eventRunSchema({ ...full, status: "published" }, occ, NOW);
    assert.equal(j.eventStatus, "https://schema.org/EventScheduled");
    assert.deepEqual(j.subEvent.map((s) => s.eventStatus.split("/").pop()), ["EventCancelled", "EventScheduled"]);
  });
});

describe("the page source keeps its promises for a cancelled event", () => {
  const page = readFileSync(new URL("../app/whats-on/[id]/page.tsx", import.meta.url), "utf8");
  test("no ticket link or ticket button is reachable when the event is cancelled; no share, check-in, directions or weather", () => {
    // every TicketLink / TicketButton / ShareButton / directions / conditions sits behind a condition that is false for a cancelled event
    assert.match(page, /\{multi && !isCancelled && \(/);
    assert.match(page, /!multi && \(e\.has_tickets \|\| e\.ticket_types\.length > 0 \|\| e\.price_text\) && !isCancelled/);
    assert.match(page, /wholeCancelled \? null : <ShareButton/);
    assert.match(page, /canScan && !wholeCancelled/);
    assert.match(page, /const mapHref = wholeCancelled \? null/);
    assert.match(page, /isLive && conditions/);
    assert.match(page, /isLive && eventArea/);
  });
});
