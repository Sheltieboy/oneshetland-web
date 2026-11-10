/**
 * Editions R2: partnership rules, the public "Taking part" surface (rendered), the owner and organiser screens (rendered), and source guards that
 * keep every partnership write behind the database functions. Nothing touches a network.
 * Run: node --test --import ./tests/support/register.mjs tests/editions-partners.test.mjs
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setDb } from "./support/fake-supabase.mjs";

await import("./support/register-jsx.mjs");
const P = await import("../lib/editions/partners.ts");
const { friendlyError } = await import("../lib/editions/rules.ts");
const { PartnerCard } = await import("../components/editions/PartnerCard.tsx");
const { PartnersSection } = await import("../components/editions/PartnersSection.tsx");
const { ProgrammeByDay } = await import("../components/editions/ProgrammeByDay.tsx");
const { PartnershipInbox } = await import("../components/editions-manage/PartnershipInbox.tsx");
const { PartnersManager } = await import("../components/editions-manage/PartnersManager.tsx");
const { ConfirmProvider } = await import("../components/ui/ConfirmProvider.tsx");
const Layout = (await import("../app/editions/[slug]/layout.tsx")).default;
const Home = (await import("../app/editions/[slug]/page.tsx")).default;
const Programme = (await import("../app/editions/[slug]/programme/page.tsx")).default;
const PartnersPage = (await import("../app/editions/[slug]/partners/page.tsx")).default;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (dir) => readdirSync(join(ROOT, dir)).flatMap((n) => { const p = `${dir}/${n}`; return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p]; });
const Pm = (o) => Promise.resolve(o);
const UUID = "6f1c2b3a-1111-4222-8333-444455556666";

describe("validators", () => {
  test("inviteFields: needs a real kind and a uuid, trims, caps lengths", () => {
    assert.equal(P.inviteFields({ kind: "person", subject: UUID }).ok, false);
    assert.equal(P.inviteFields({ kind: "business", subject: "nope" }).ok, false);
    assert.equal(P.inviteFields({ kind: "business", subject: UUID, label: "x".repeat(61) }).ok, false);
    assert.equal(P.inviteFields({ kind: "business", subject: UUID, message: "x".repeat(501) }).ok, false);
    const ok = P.inviteFields({ kind: "event", subject: UUID, label: "  Official venue ", message: " Hello " });
    assert.deepEqual(ok.value, { kind: "event", subject: UUID, label: "Official venue", message: "Hello" });
    assert.deepEqual(P.inviteFields({ kind: "activity", subject: UUID }).value, { kind: "activity", subject: UUID, label: null, message: null });
  });
  test("noteField caps at 300 and empties to null", () => {
    assert.equal(P.noteField("x".repeat(301)).ok, false);
    assert.equal(P.noteField("   ").value, null);
    assert.equal(P.noteField(" thanks ").value, "thanks");
  });
  test("action and kind guards", () => {
    for (const a of ["approve", "decline", "cancel", "withdraw", "remove"]) assert.ok(P.isPartnerAction(a));
    for (const a of ["delete", "", null, "APPROVE"]) assert.ok(!P.isPartnerAction(a));
    assert.ok(P.isPartnerKind("business") && !P.isPartnerKind("hub"));
  });
});

describe("plain-language state text", () => {
  test("organiser view never says link, entity or consent", () => {
    const states = [["approved", "organiser", null], ["pending", "organiser", null], ["pending", "entity", null], ["declined", "organiser", "entity"], ["declined", "entity", "organiser"], ["cancelled", "organiser", "organiser"], ["withdrawn", "organiser", "entity"], ["withdrawn", "organiser", "organiser"]];
    for (const [state, initiated_by, ended_by] of states) {
      const t = P.organiserStateText({ state, initiated_by, ended_by });
      assert.ok(t.label && t.hint && !/link|entity|consent/i.test(t.label + t.hint), `${state}/${initiated_by}/${ended_by}: ${t.label}`);
    }
    assert.equal(P.organiserStateText({ state: "pending", initiated_by: "organiser", ended_by: null }).label, "Invitation sent");
    assert.equal(P.organiserStateText({ state: "withdrawn", initiated_by: "organiser", ended_by: "entity" }).label, "Stepped back");
  });
  test("owner view", () => {
    assert.equal(P.ownerStateText({ state: "pending", initiated_by: "organiser", ended_by: null }).label, "Invitation");
    assert.equal(P.ownerStateText({ state: "pending", initiated_by: "entity", ended_by: null }).label, "Waiting for the organiser");
    assert.equal(P.ownerStateText({ state: "withdrawn", initiated_by: "organiser", ended_by: "entity" }).label, "You stepped back");
  });
  test("offerBadge and hrefs", () => {
    assert.equal(P.offerBadge({ discount_type: "percent", discount_value: 10 }), "10% off");
    assert.equal(P.offerBadge({ discount_type: "fixed", discount_value: 5 }), "£5 off");
    assert.equal(P.offerBadge({ discount_type: "bogo", discount_value: null }), "Two for one");
    assert.equal(P.businessHref("b1"), "/directory/b1");
    assert.equal(P.activityHref("knit"), "/whats-on/regular/knit");
  });
  test("suggestedInvite reassures about control and names the Edition", () => {
    const t = P.suggestedInvite({ organiser: "Wool Co", edition: "Wool Week", dateLabel: "1 to 7 Oct 2027", kind: "business", subject: "Harbour Cafe" });
    assert.match(t, /Harbour Cafe/); assert.match(t, /Wool Week/); assert.match(t, /full control/); assert.match(t, /at any time/);
    assert.ok(t.length <= 500);
  });
  test("friendlyError shows the database's partnership refusals as sentences", () => {
    assert.equal(friendlyError("they declined recently; please wait before inviting again"), "They declined recently; please wait before inviting again.");
    assert.match(friendlyError("that business has not been claimed yet, so nobody can answer for it"), /^That business has not been claimed/);
    assert.equal(friendlyError("some random internal thing"), "Something went wrong. Please try again.");
  });
});

const BIZ = (o) => ({ link_id: "l1", edition_id: "e1", business_id: "b1", name: "ZZ Harbour Cafe", slug: "zz-harbour", category: "food_drink", description: null, address: "1 Quay, Lerwick", logo_url: null, cover_url: null, label: "Festival café", position: 0, offers: [{ offer_id: "o1", business_id: "b1", title: "ZZ 10% off scones", description: null, discount_type: "percent", discount_value: 10, valid_until: "2099-01-01T00:00:00Z", terms: null }], ...o });
const EVT = { link_id: "l2", edition_id: "e1", event_id: "ev1", title: "ZZ Quiz Night", description: "Teams of four.", starts_at: "2099-06-11T19:00:00Z", ends_at: null, venue: "ZZ Pub", locality: "Lerwick", cover_url: null, price_text: "£5", ticket_url: null, has_tickets: true, status: "published", category: null, label: null, position: 0 };
const ACT = { link_id: "l3", edition_id: "e1", activity_id: "a1", slug: "zz-knit", title: "ZZ Knit Circle", description: null, category: "arts_creative", venue: "ZZ Hall", locality: "Lerwick", cover_url: null, price_text: "Free", label: null, position: 0 };

describe("public Taking part", () => {
  test("a partner card links to the business's own page and shows only chosen offers", () => {
    const html = renderToStaticMarkup(h(PartnerCard, { b: BIZ(), }));
    assert.match(html, /href="\/directory\/b1"/);
    assert.ok(html.includes("ZZ Harbour Cafe") && html.includes("Festival café") && html.includes("Food &amp; drink") && html.includes("10% off") && html.includes("ZZ 10% off scones"));
    const none = renderToStaticMarkup(h(PartnerCard, { b: BIZ({ offers: [] }), }));
    assert.ok(!none.includes("Offers for visitors"));
  });
  test("the section renders nothing when nobody is taking part, and trims for the home teaser", () => {
    assert.equal(renderToStaticMarkup(h(PartnersSection, { partners: { businesses: [], events: [], activities: [] } })), "");
    const many = Array.from({ length: 6 }, (_, i) => BIZ({ link_id: `l${i}`, business_id: `b${i}`, name: `ZZ Biz ${i}` }));
    const html = renderToStaticMarkup(h(PartnersSection, { partners: { businesses: many, events: [], activities: [ACT] }, limit: 4, moreHref: "/editions/x/partners" }));
    assert.equal(html.split("ZZ Biz ").length - 1, 4);
    assert.ok(html.includes("See everyone taking part (6)") && html.includes('href="/whats-on/regular/zz-knit"'));
  });
  test("events join the programme by day, drawn by their own card, and keep their own page for tickets", () => {
    const session = { id: "s1", edition_id: "e1", title: "ZZ Opening", description: null, starts_at: "2099-06-11T09:00:00Z", ends_at: null, venue_id: null, kind: "session", ticket_mode: "none", ticket_url: null, price_text: null, status: "scheduled", position: 0 };
    const html = renderToStaticMarkup(h(ProgrammeByDay, { sessions: [session], events: [EVT], venues: [], editionId: "e1" }));
    assert.equal(html.split("<h2").length - 1, 1, "one London day");
    assert.ok(html.indexOf("ZZ Opening") < html.indexOf("ZZ Quiz Night"), "ordered by time");
    assert.match(html, /href="\/whats-on\/ev1"/);
    assert.ok(html.includes("Details and tickets") && html.includes("£5"));
    const cancelled = renderToStaticMarkup(h(ProgrammeByDay, { sessions: [], events: [{ ...EVT, status: "cancelled" }], venues: [], editionId: "e1" }));
    assert.ok(cancelled.includes("Cancelled") && !cancelled.includes("Details and tickets"));
  });
});

describe("Edition pages with partners", () => {
  const ORG = { id: "o1", slug: "zz-org", name: "ZZ Org", tagline: null, description: null, logo_url: null, cover_url: null, brand_color: "#0b5a73", website: null, contact_email: null, status: "verified", verified_at: null, reserved_name_flag: false, is_test: false, hub_id: null, created_at: "2026-01-01T00:00:00Z" };
  const ED = { id: "e1", organiser_id: "o1", series_id: null, slug: "zz-fest", title: "ZZ Fest", summary: "Summary.", description: "", kind: "multi_day", starts_on: "2099-06-10", ends_on: "2099-06-12", timezone: "Europe/London", year_label: "2099", brand_color: null, logo_url: null, cover_url: null, theme: {}, status: "published", published_at: "2026-01-01T00:00:00Z", suspended_reason: null, is_test: false, created_at: "2026-01-01T00:00:00Z" };
  const set = (over = {}) => { setDb({ editions: [ED], edition_organisers: [ORG], edition_pages: [], edition_sessions: [], edition_venues: [], edition_updates: [], edition_sponsors: [], edition_series: [], edition_public_businesses: [BIZ()], edition_public_offers: [{ ...BIZ().offers[0], edition_id: "e1", link_id: "l1" }], edition_public_events: [EVT], edition_public_activities: [ACT], ...over }); };
  beforeEach(() => { set(); globalThis.__FAKE_RPC__ = async (fn) => ({ data: { editions_enabled: true, edition_entitled: true }[fn] ?? null, error: null }); globalThis.__PATH__ = "/editions/zz-fest"; });
  const frame = async (el) => renderToStaticMarkup(await Layout({ params: Pm({ slug: "zz-fest" }), children: el }));
  test("home shows Taking part and the nav gains Partners and Programme", async () => {
    const html = await frame(await Home({ params: Pm({ slug: "zz-fest" }) }));
    for (const t of ["Taking part", "ZZ Harbour Cafe", "ZZ 10% off scones"]) assert.ok(html.includes(t), `missing ${t}`);
    assert.match(html, /href="\/editions\/zz-fest\/partners"/);
    assert.match(html, /href="\/editions\/zz-fest\/programme"/);
  });
  test("programme works with linked events and no native sessions", async () => {
    const html = await frame(await Programme({ params: Pm({ slug: "zz-fest" }) }));
    assert.ok(html.includes("ZZ Quiz Night") && !html.includes("has not been published yet"));
  });
  test("partners page lists businesses and regular activities", async () => {
    const html = await frame(await PartnersPage({ params: Pm({ slug: "zz-fest" }) }));
    assert.ok(html.includes("ZZ Harbour Cafe") && html.includes("ZZ Knit Circle") && html.includes("Regular activities"));
  });
  test("withdrawn means absent: with no rows the Taking part section and nav item disappear", async () => {
    set({ edition_public_businesses: [], edition_public_offers: [], edition_public_events: [], edition_public_activities: [] });
    const html = await frame(await Home({ params: Pm({ slug: "zz-fest" }) }));
    assert.ok(!html.includes("Taking part") && !html.includes("/partners"));
  });
});

const MY = (o) => ({ link_id: "k1", kind: "business", subject_id: "b1", subject_name: "ZZ Harbour Cafe", subject_business_id: "b1", state: "pending", initiated_by: "organiser", ended_by: null, label: "Festival café", message: "Would you like to be our festival cafe?", response_note: null, created_at: "2099-01-01T00:00:00Z", decided_at: null, edition_id: "e1", edition_title: "ZZ Fest", edition_slug: "zz-fest", edition_summary: "A festival.", edition_starts_on: "2099-06-10", edition_ends_on: "2099-06-12", edition_cover_url: null, edition_status: "published", edition_is_public: true, organiser_name: "ZZ Org", organiser_slug: "zz-org", offers_selected: 0, ...o });
const inbox = (items, extra = {}) => renderToStaticMarkup(h(ConfirmProvider, null, h(PartnershipInbox, { partnerships: items, businessId: "b1", businessName: "ZZ Harbour Cafe", billingHref: "/business/b1/manage/billing", ...extra })));

describe("owner inbox (what the business sees)", () => {
  test("an invitation is a clear yes/no decision with the control guarantees beside it", () => {
    const html = inbox([MY()]);
    assert.ok(html.includes("Invitations (1)") && html.includes("ZZ Fest") && html.includes("from ZZ Org") && html.includes("Would you like to be our festival cafe?"));
    assert.ok(html.includes("Yes, take part") && html.includes("No thanks"));
    assert.ok(html.includes("You choose what is shown") && html.includes("step back at any time") && html.includes("never changes your listing"));
    assert.ok(!/link_id|entity|consent/i.test(html.replace(/key="[^"]*"/g, "")));
  });
  test("taking part offers choose-offers, add-an-event and stop; withdrawn and declined sit under Earlier", () => {
    const html = inbox([MY({ state: "approved" }), MY({ link_id: "k2", state: "withdrawn", ended_by: "entity", edition_title: "ZZ Old" })]);
    assert.ok(html.includes("Taking part (1)") && html.includes("Choose offers to show") && html.includes("Add an event or activity") && html.includes("Stop taking part"));
    assert.ok(html.includes("Earlier (1)") && html.includes("You stepped back"));
    assert.match(html, /href="\/editions\/zz-fest"/);
  });
  test("an Edition that is not public yet says so instead of linking to a 404", () => {
    const html = inbox([MY({ state: "approved", edition_is_public: false })]);
    assert.ok(html.includes("not public yet") && !html.includes('href="/editions/zz-fest"'));
  });
  test("empty states are friendly", () => {
    const html = inbox([]);
    assert.ok(html.includes("No invitations right now") && html.includes("not part of any Edition yet") && html.includes("Find an Edition to join"));
  });
  test("an event owner without a business context sees no join panel", () => {
    const html = renderToStaticMarkup(h(ConfirmProvider, null, h(PartnershipInbox, { partnerships: [MY({ kind: "event", subject_business_id: null })] })));
    assert.ok(!html.includes("Find an Edition to join"));
  });
});

describe("organiser Partners screen", () => {
  const row = (o) => ({ link_id: "k1", kind: "business", subject_id: "b1", subject_name: "ZZ Harbour Cafe", subject_slug: "zz", subject_logo: null, owner_claimed: true, state: "pending", initiated_by: "organiser", ended_by: null, label: null, sort_order: 0, message: "hi", response_note: null, created_at: "2099-01-01T00:00:00Z", decided_at: null, offers_selected: 0, in_window: true, ...o });
  const screen = (rows, canManage = true) => renderToStaticMarkup(h(ConfirmProvider, null, h(PartnersManager, { organiserSlug: "zz-org", editionSlug: "zz-fest", organiserName: "ZZ Org", editionTitle: "ZZ Fest", dateLabel: "10 to 12 Jun 2099", rows, canManage })));
  test("explains the control promise, groups by what needs attention, offers a search", () => {
    const html = screen([row(), row({ link_id: "k2", state: "approved", subject_name: "ZZ Bakery", offers_selected: 2 }), row({ link_id: "k3", initiated_by: "entity", subject_name: "ZZ Shop", message: "pick us" }), row({ link_id: "k4", state: "declined", ended_by: "entity", subject_name: "ZZ No" })]);
    assert.ok(html.includes("stay in charge of their own listing") && html.includes("Invite someone") && html.includes("Search the OneShetland directory"));
    assert.ok(html.includes("Asking to join (1)") && html.includes("Welcome them") && html.includes("pick us"));
    assert.ok(html.includes("Taking part (1)") && html.includes("2 offers shown"));
    assert.ok(html.includes("Waiting for an answer (1)") && html.includes("Invitation sent"));
    assert.ok(html.includes("Earlier answers (1)") && html.includes("Said no"));
  });
  test("a read-only role sees the lists but no controls", () => {
    const html = screen([row(), row({ link_id: "k3", initiated_by: "entity" })], false);
    assert.ok(!html.includes("Invite someone") && !html.includes("Welcome them") && !html.includes("Cancel"));
  });
});

describe("source guards", () => {
  const org = read("app/organise/actions.ts"), own = read("app/account/editions/actions.ts");
  const files = [...walk("app/organise"), ...walk("app/account/editions"), ...walk("components/editions-manage"), ...walk("components/editions"), "lib/editions/partners.ts", "lib/editions/data.server.ts"];
  test("partnership writes only go through the database functions; no direct table writes, no service key", () => {
    for (const f of files.filter((x) => /\.(tsx?|mjs)$/.test(x))) {
      const src = read(f);
      assert.ok(!/from\("edition_(links|link_notes|link_offers)"\)\s*\.(insert|update|delete|upsert)/.test(src), `${f} writes a partnership table directly`);
      assert.ok(!/service[_-]?role|SERVICE_KEY|createAdminClient|service_key/i.test(src), `${f} mentions a service key`);
      assert.ok(!/from\("(local_businesses|local_offers|events|regular_activities|hubs)"\)\s*\.(insert|update|delete|upsert)/.test(src), `${f} writes a shared table`);
    }
    for (const r of ["edition_invite_partner", "edition_link_act", "edition_link_set_display", "edition_find_businesses", "edition_find_activities"]) assert.match(org, new RegExp(`rpc\\("${r}"`), r);
    for (const r of ["edition_link_act", "edition_offer_options", "edition_set_link_offers", "edition_request_to_join", "edition_joinable"]) assert.match(own, new RegExp(`rpc\\("${r}"`), r);
  });
  test("sides are enforced in the server action as well as the database", () => {
    const body = (src, n) => src.split(`export async function ${n}(`)[1].split(/\nexport async function /)[0];
    assert.match(body(org, "partnerAction"), /action === "withdraw"\) return bad\(NO_PERMISSION\)/);
    assert.match(body(org, "partnerAction"), /eq\("edition_id", c\.edition\.id\)/);
    assert.match(body(own, "respondToPartnership"), /action === "remove"\) return bad/);
  });
  test("every owner action requires a signed-in user and validates ids", () => {
    for (const b of own.split(/^export async function /m).slice(1)) {
      const n = b.slice(0, b.indexOf("("));
      assert.match(b, /authed\(\)/, `${n} does not check sign-in`);
    }
    assert.match(own, /offerIds\.length > 6/);
  });
  test("the organiser action file still exports only async functions", () => {
    for (const e of [...org.matchAll(/^export\s+(.*)$/gm)].map((m) => m[1])) assert.match(e, /^async function /, e);
    for (const e of [...own.matchAll(/^export\s+(.*)$/gm)].map((m) => m[1]).filter((x) => !x.startsWith("type "))) assert.match(e, /^async function /, e);
  });
});

describe("R2 stays payment-free and keeps one reading path (RF2, RF3)", () => {
  const r2 = [...walk("components/editions"), "lib/editions/partners.ts", "app/account/editions/actions.ts", "app/account/editions/page.tsx", "components/editions-manage/PartnershipInbox.tsx", "components/editions-manage/PartnersManager.tsx"];
  test("no Stripe, checkout, price or fee logic in any partnership code", () => {
    for (const f of r2.filter((x) => /\.(tsx?)$/.test(x))) {
      const src = read(f).replace(/discount_(type|value)|price_text/g, "");
      assert.ok(!/stripe|checkout|payment_?intent|application_fee|clientSecret|transfer_data|subscription/i.test(src), `${f} mentions payments`);
    }
    const org = read("app/organise/actions.ts").split("/* ── Partners (R2)")[1];
    assert.ok(!/stripe|checkout|payment|fee_|price/i.test(org));
  });
  test("public partner data is read only from the four edition_public_* views", () => {
    const src = read("lib/editions/data.server.ts");
    const body = src.split("export async function getPublicPartners")[1].split("\n}\n")[0];
    for (const v of ["edition_public_businesses", "edition_public_offers", "edition_public_events", "edition_public_activities"]) assert.match(body, new RegExp(`from\\("${v}"\\)`));
    assert.ok(!/from\("edition_links"\)|from\("edition_link_offers"\)/.test(body));
  });
});
