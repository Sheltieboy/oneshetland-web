/** Editions R11: every programme item has its own shareable, branded page. Run: node --test --import ./tests/support/register.mjs tests/editions-session-pages.test.mjs */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { setDb } from "./support/fake-supabase.mjs";

await import("./support/register-jsx.mjs");
const { itemSlug, itemKey, parseItemKey, itemPath, slugWords } = await import("../lib/editions/session-url.ts");
const { sessionFields } = await import("../lib/editions/validate.ts");
const Page = (await import("../app/editions/[slug]/programme/[item]/page.tsx")).default;
const { generateMetadata } = await import("../app/editions/[slug]/programme/[item]/page.tsx");
const { SessionCard } = await import("../components/editions/SessionCard.tsx");
const { LinkedEventCard } = await import("../components/editions/LinkedEventCard.tsx");
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const P = (o) => Promise.resolve(o);

const ORG = { id: "o1", slug: "zz-org", name: "ZZ Org", tagline: null, description: null, logo_url: null, cover_url: null, cover_focus: null, brand_color: "#1f5b5e", website: null, status: "verified", verified_at: null, is_test: false, hub_id: null, created_at: "2026-01-01T00:00:00Z" };
const ED = { id: "e1", organiser_id: "o1", series_id: null, slug: "zz-fest", title: "ZZ Fest", summary: "Summary.", description: "", kind: "multi_day", starts_on: "2099-06-10", ends_on: "2099-06-12", timezone: "Europe/London", year_label: "2099", brand_color: null, logo_url: null, cover_url: "https://example.org/cover.jpg", cover_focus: null, theme: {}, status: "published", published_at: "2026-01-01T00:00:00Z", suspended_reason: null, is_test: false, created_at: "2026-01-01T00:00:00Z" };
const VENUE = { id: "v1", organiser_id: "o1", name: "ZZ Hall", address: "Lerwick", lat: 60.15, lng: -1.14, created_at: "2026-01-01T00:00:00Z" };
const S1 = { id: "11111111-aaaa-4bbb-8ccc-000000000001", edition_id: "e1", title: "Kitchen stage: lamb, three ways!", description: "A **live** demonstration.\n\n- rack\n- stew\n\n[More](https://example.org/more)", starts_at: "2099-06-10T10:00:00Z", ends_at: "2099-06-10T11:00:00Z", venue_id: "v1", kind: "session", ticket_mode: "external", ticket_url: "https://example.org/tickets", price_text: "£12", status: "scheduled", position: 0, image_url: "https://upload.wikimedia.org/x/960px-x.jpg", presenters: "Ada and Bea" };
const S2 = { id: "22222222-aaaa-4bbb-8ccc-000000000002", edition_id: "e1", title: "Closing tea", description: null, starts_at: "2099-06-11T15:00:00Z", ends_at: null, venue_id: null, kind: "event", ticket_mode: "none", ticket_url: null, price_text: null, status: "scheduled", position: 0, image_url: null, presenters: null };
const BIZ = { link_id: "L1", business_id: "b1", name: "ZZ Smokehouse (Illustrative)", slug: null, category: "food_drink", description: "Smoked fish.", address: null, logo_url: null, cover_url: null, label: "Smokehouse", position: 0, edition_id: "e1" };
const EV = { link_id: "33333333-aaaa-4bbb-8ccc-000000000003", event_id: "ev1", title: "Fish Friday talk", description: "Canonical words.", starts_at: "2099-06-10T12:00:00Z", ends_at: null, venue: "The Quay", locality: "Lerwick", cover_url: null, price_text: "Free", ticket_url: null, has_tickets: false, status: "published", category: null, label: "Fish Friday", position: 0, edition_id: "e1" };
const set = (over = {}) => setDb({ editions: [ED], edition_organisers: [ORG], edition_pages: [], edition_sessions: [S1, S2], edition_venues: [VENUE], edition_updates: [], edition_sponsors: [], edition_series: [], edition_session_businesses: [{ session_id: S1.id, link_id: "L1", position: 1 }, { session_id: S1.id, link_id: "L-withdrawn", position: 2 }], edition_public_businesses: [BIZ], edition_public_offers: [], edition_public_events: [EV], edition_public_activities: [], ...over });
const rpc = () => { globalThis.__FAKE_RPC__ = async (fn) => ({ data: { editions_enabled: true, edition_entitled: true }[fn] ?? null, error: null }); };
const render = async (item) => renderToStaticMarkup(await Page({ params: P({ slug: "zz-fest", item }) }));
beforeEach(() => { set(); rpc(); globalThis.__PATH__ = "/editions/zz-fest"; });

describe("shareable addresses", () => {
  test("words for people, a short key for the machine; renaming never breaks an old link", () => {
    assert.equal(slugWords("Kitchen stage: lamb, three ways!"), "kitchen-stage-lamb-three-ways");
    assert.equal(slugWords("Café & crème"), "cafe-creme");
    assert.equal(slugWords("???"), "item");
    assert.equal(itemKey(S1.id), "11111111");
    assert.equal(itemSlug(S1.title, S1.id), "kitchen-stage-lamb-three-ways-11111111");
    assert.equal(parseItemKey("a-totally-different-title-11111111"), "11111111");
    assert.equal(parseItemKey("nonsense"), null);
    assert.equal(itemPath("zz-fest", S1), "/editions/zz-fest/programme/kitchen-stage-lamb-three-ways-11111111");
    assert.ok(slugWords("x".repeat(300)).length <= 60);
  });
});

describe("the programme links to the page", () => {
  test("a session's title and a Details link lead to its own page; a linked event's title leads to the Edition's page for it, and its tickets stay on OneShetland", () => {
    const sess = renderToStaticMarkup(SessionCard({ session: S1, venue: VENUE, editionId: "e1", editionSlug: "zz-fest" }));
    assert.ok(sess.includes('href="/editions/zz-fest/programme/kitchen-stage-lamb-three-ways-11111111"'));
    assert.match(sess, /Details<span class="sr-only"> for Kitchen stage/);
    const ev = renderToStaticMarkup(LinkedEventCard({ e: EV, editionSlug: "zz-fest" }));
    assert.ok(ev.includes('href="/editions/zz-fest/programme/fish-friday-talk-33333333"'));
    assert.ok(ev.includes('href="/whats-on/ev1"'), "the canonical OneShetland event page is still one click away");
    assert.ok(!renderToStaticMarkup(SessionCard({ session: S1, editionId: "e1" })).includes("/programme/"), "no slug, no link (embedded previews)");
  });
});

describe("a session's own page", () => {
  test("hero photograph, date and time, venue with map links, price, tickets, presenters, plan, calendar and share", async () => {
    const html = await render("kitchen-stage-lamb-three-ways-11111111");
    assert.match(html, /<h2 id="item-title"[^>]*>Kitchen stage: lamb, three ways!<\/h2>/);
    assert.ok(html.includes('src="https://upload.wikimedia.org/x/960px-x.jpg"'), "hero photograph");
    assert.match(html, /<time dateTime="2099-06-10T10:00:00Z">/);
    assert.ok(html.includes("ZZ Hall") && html.includes("Lerwick"));
    assert.ok(html.includes("https://www.google.com/maps/search/?api=1&amp;query=60.15,-1.14") && html.includes("https://www.openstreetmap.org/?mlat=60.15"), "map links");
    assert.ok(html.includes("£12") && html.includes("Ada and Bea"));
    assert.ok(html.includes('href="https://example.org/tickets"') && html.includes('rel="noopener noreferrer"'), "external ticket link");
    assert.ok(html.includes("+ Add to my plan") && html.includes("/sign-in?next=%2Feditions%2Fzz-fest%2Fprogramme%2Fkitchen-stage-lamb-three-ways-11111111"), "signed-out visitors are sent to sign in and back");
    assert.ok(html.includes('href="/editions/zz-fest/programme/kitchen-stage-lamb-three-ways-11111111/calendar.ics"'), "per-session calendar file");
    assert.ok(html.includes("Share") && html.includes("<strong>live</strong>") && html.includes('href="https://example.org/more"'), "share control and the description's safe markdown");
    assert.ok(!/<script[^>]*>[^<]*alert/.test(html));
  });
  test("participating businesses show only while their own partner link is public (consent); a withdrawn link shows nothing", async () => {
    const html = await render("kitchen-stage-lamb-three-ways-11111111");
    assert.ok(html.includes("Participating businesses") && html.includes("ZZ Smokehouse (Illustrative)") && html.includes('href="/directory/b1"'));
    assert.equal(html.split('class="ed-ev__bizlink"').length - 1, 1, "L-withdrawn is not in the public partner list, so it is not shown");
    set({ edition_public_businesses: [] });
    assert.ok(!(await render("kitchen-stage-lamb-three-ways-11111111")).includes("Participating businesses"), "no public partner, no section");
  });
  test("a session without a photograph or extras still reads well; there is no empty hero and no empty fact", async () => {
    const html = await render("closing-tea-22222222");
    assert.ok(!html.includes("ed-ev__hero") && !html.includes("Presented by") && !html.includes("Price<"));
    assert.ok(html.includes("More details will be added by the organiser."));
    assert.ok(html.includes("Previous") && html.includes("rel=\"prev\""), "the pager links to the neighbouring programme items");
  });
  test("an old or misspelt title redirects to the current spelling; an unknown key is a 404", async () => {
    await assert.rejects(() => render("old-name-11111111"), (e) => /^redirect:\/editions\/zz-fest\/programme\/kitchen-stage-lamb-three-ways-11111111$/.test(String(e?.message)));
    await assert.rejects(() => render("nothing-ffffffff"), (e) => /notFound/.test(String(e?.message)));
    await assert.rejects(() => render("no-key"), (e) => /notFound/.test(String(e?.message)));
  });
  test("search metadata: its own title, description with the date, canonical address and the session photograph as the share image; the Edition's indexing rules apply", async () => {
    const m = await generateMetadata({ params: P({ slug: "zz-fest", item: "kitchen-stage-lamb-three-ways-11111111" }) });
    assert.equal(m.title, "Kitchen stage: lamb, three ways! · ZZ Fest");
    assert.match(m.description, /^Wednesday 10 June 2099, \d\d:\d\d, ZZ Hall, Lerwick\. A live demonstration/);
    assert.equal(m.alternates.canonical, "/editions/zz-fest/programme/kitchen-stage-lamb-three-ways-11111111");
    assert.equal(m.openGraph.images[0].url, "https://upload.wikimedia.org/x/960px-x.jpg");
    assert.equal(m.robots, undefined, "a published, non-test Edition is indexable");
    set({ editions: [{ ...ED, is_test: true }] });
    assert.deepEqual((await generateMetadata({ params: P({ slug: "zz-fest", item: "closing-tea-22222222" }) })).robots, { index: false, follow: false });
    const withoutPhoto = await generateMetadata({ params: P({ slug: "zz-fest", item: "closing-tea-22222222" }) });
    assert.equal(withoutPhoto.openGraph.images[0].url, "https://example.org/cover.jpg", "falls back to the Edition cover");
  });
  test("structured data: an Event with its place, offer and presenters, inside the Edition", async () => {
    const html = await render("kitchen-stage-lamb-three-ways-11111111");
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"')));
    const ev = ld.find((x) => x["@type"] === "Event");
    assert.equal(ev.name, "Kitchen stage: lamb, three ways!");
    assert.equal(ev.location.name, "ZZ Hall"); assert.equal(ev.offers.url, "https://example.org/tickets");
    assert.deepEqual(ev.performer.map((p) => p.name), ["Ada", "Bea"]);
    assert.equal(ev.superEvent.name, "ZZ Fest");
  });
});

describe("an independently owned OneShetland event shown in the programme reuses its canonical information", () => {
  test("title, words, time, place and price come from the event; ownership and tickets stay on its own OneShetland page; it is not copied", async () => {
    const html = await render("fish-friday-talk-33333333");
    for (const t of ["Fish Friday talk", "Canonical words.", "The Quay, Lerwick", "Free"]) assert.ok(html.includes(t), t);
    for (const t of ['href="/whats-on/ev1"', "run by its own organiser on OneShetland"]) assert.ok(html.includes(t), t);
    assert.ok(html.includes("Fish Friday"), "the organiser's label for it");
  });
  test("a cancelled item says so, offers no plan or ticket actions, and the cancellation shows in the calendar file", async () => {
    set({ edition_sessions: [{ ...S1, status: "cancelled" }, S2] });
    const html = await render("kitchen-stage-lamb-three-ways-11111111");
    assert.ok(html.includes("Cancelled") && html.includes("This session has been cancelled.") && !html.includes("Add to my plan") && !html.includes('href="https://example.org/tickets"'));
    const { GET } = await import("../app/editions/[slug]/programme/[item]/calendar.ics/route.ts");
    const res = await GET(new Request("http://localhost/x"), { params: P({ slug: "zz-fest", item: "kitchen-stage-lamb-three-ways-11111111" }) });
    const ics = await res.text();
    assert.match(ics, /STATUS:CANCELLED/); assert.match(ics, /SUMMARY:Kitchen stage/);
    assert.equal((await GET(new Request("http://localhost/x"), { params: P({ slug: "zz-fest", item: "nothing-ffffffff" }) })).status, 404);
  });
});

describe("organisers can edit the new fields, safely", () => {
  const base = { title: "T", description: "", starts_local: "2099-06-10T10:00", ends_local: "", venue_id: "", kind: "session", ticket_mode: "none", ticket_url: "", price_text: "", status: "scheduled", position: 0 };
  const ed = { starts_on: "2099-06-10", ends_on: "2099-06-12" };
  test("photograph must be https; presenters are length-limited; both optional", () => {
    assert.equal(sessionFields({ ...base }, ed).ok, true);
    const ok = sessionFields({ ...base, image_url: "https://x.example/a.jpg", presenters: " Ada " }, ed);
    assert.equal(ok.value.image_url, "https://x.example/a.jpg"); assert.equal(ok.value.presenters, "Ada");
    assert.equal(sessionFields({ ...base, image_url: "http://x.example/a.jpg" }, ed).ok, false);
    assert.equal(sessionFields({ ...base, image_url: "javascript:alert(1)" }, ed).ok, false);
    assert.equal(sessionFields({ ...base, presenters: "p".repeat(201) }, ed).ok, false);
  });
  test("the editor offers the photograph, presenters and only approved partners; the save action sends the named businesses through the database function", () => {
    const ui = read("components/editions-manage/ProgrammeManager.tsx");
    for (const t of ['kind="session-image"', "Presented by", "Participating businesses", "No businesses have joined this Edition yet."]) assert.ok(ui.includes(t), t);
    const act = read("app/organise/actions.ts");
    assert.match(act, /edition_session_set_businesses/);
    assert.ok(ui.includes("business_links") && act.includes("input.business_links"), "the form and the save action use the same key (a mismatch silently dropped the selection)");
    const page = read("app/organise/[slug]/editions/[edition]/programme/page.tsx");
    assert.match(page, /p\.state === "approved"/); assert.match(page, /p\.kind === "business"/);
  });
  test("the sitemap lists every session page and nothing cancelled", () => {
    const sm = read("app/sitemap.ts");
    assert.match(sm, /edition_sessions/); assert.match(sm, /itemSlug\(/); assert.match(sm, /neq\("status", "cancelled"\)/);
  });
});
