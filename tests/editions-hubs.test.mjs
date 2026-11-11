/**
 * Editions 1.1: Hubs as partners and Hub-run Editions (web). Rendered screens, the pure rules (filtering, branding inheritance, addresses, errors) and source guards that keep
 * every Hub read on the public column whitelist and every write behind the database functions. Nothing touches a network.
 * Run: node --test --import ./tests/support/register.mjs tests/editions-hubs.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

await import("./support/register-jsx.mjs");
const P = await import("../lib/editions/partners.ts");
const B = await import("../lib/editions/hub-brand.ts");
const { friendlyError } = await import("../lib/editions/rules.ts");
const { HubCard } = await import("../components/editions/HubCard.tsx");
const { PartnersSection } = await import("../components/editions/PartnersSection.tsx");
const { PartnershipInbox } = await import("../components/editions-manage/PartnershipInbox.tsx");
const { PartnersManager } = await import("../components/editions-manage/PartnersManager.tsx");
const { TeamManager } = await import("../components/editions-manage/TeamManager.tsx");
const { ConfirmProvider } = await import("../components/ui/ConfirmProvider.tsx");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (d, out = []) => { for (const f of readdirSync(join(ROOT, d))) { const p = join(d, f); if (statSync(join(ROOT, p)).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(f)) out.push(p); } return out; };

const HUB = (o = {}) => ({ link_id: "h1", hub_id: "hub1", name: "ZZ Slippit Hub", slug: "zz-slippit", type: "community", description: "A real Hub of Lerwick.", area: "Lerwick", website: null, logo_url: null, cover_url: null, brand_color: "#7a3b8f", is_verified: true, is_charity: false, label: null, position: 0, items: [], ...o });
const ROW = (o = {}) => ({ link_id: "k1", kind: "business", subject_id: "s1", subject_name: "ZZ Harbour Cafe", subject_slug: null, subject_logo: null, owner_claimed: true, state: "approved", initiated_by: "organiser", ended_by: null, label: null, sort_order: 0, message: null, response_note: null, created_at: "2099-01-01T00:00:00Z", decided_at: null, offers_selected: 0, in_window: true, ...o });
const MY = (o = {}) => ({ link_id: "m1", kind: "hub", subject_id: "hub1", subject_name: "ZZ Slippit Hub", subject_business_id: null, state: "pending", initiated_by: "organiser", ended_by: null, label: null, message: "Join us", response_note: null, created_at: "2099-01-01T00:00:00Z", decided_at: null, edition_id: "e1", edition_title: "ZZ Fest", edition_slug: "zz-fest", edition_summary: "A festival.", edition_starts_on: "2099-06-10", edition_ends_on: "2099-06-12", edition_cover_url: null, edition_status: "draft", edition_is_public: false, organiser_name: "ZZ Org", organiser_slug: null, offers_selected: 0, ...o });
const wrap = (el) => renderToStaticMarkup(h(ConfirmProvider, null, el));

describe("partner kinds and the one Partners list", () => {
  test("hub is a kind with its own label and noun; the guards accept it and still refuse anything else", () => {
    assert.equal(P.PARTNER_KIND_LABEL.hub, "Hub"); assert.equal(P.PARTNER_KIND_NOUN.hub, "your Hub");
    assert.ok(P.isPartnerKind("hub") && P.isPartnerKind("business") && !P.isPartnerKind("club") && !P.isPartnerKind(""));
    assert.equal(P.inviteFields({ kind: "hub", subject: "11111111-1111-4111-8111-111111111111", label: " Festival host ", message: "" }).value.kind, "hub");
    assert.equal(P.inviteFields({ kind: "club", subject: "11111111-1111-4111-8111-111111111111" }).ok, false);
  });
  test("one list: the filter splits Businesses, Hubs and Events & activities, counts them, and the search narrows by name or heading", () => {
    const rows = [ROW(), ROW({ link_id: "k2", kind: "hub", subject_name: "ZZ Slippit Hub", label: "Festival host" }), ROW({ link_id: "k3", kind: "event", subject_name: "ZZ Quiz" }), ROW({ link_id: "k4", kind: "activity", subject_name: "ZZ Choir" })];
    assert.deepEqual(P.countByFilter(rows), { all: 4, business: 1, hub: 1, programme: 2 });
    assert.deepEqual(P.filterPartnerRows(rows, "hub", "").map((r) => r.link_id), ["k2"]);
    assert.deepEqual(P.filterPartnerRows(rows, "programme", "").map((r) => r.link_id), ["k3", "k4"]);
    assert.deepEqual(P.filterPartnerRows(rows, "all", "festival host").map((r) => r.link_id), ["k2"], "heading is searched too");
    assert.deepEqual(P.filterPartnerRows(rows, "business", "slippit"), [], "filter and search combine");
    assert.equal(P.filterPartnerRows(rows, "all", "  ").length, 4);
  });
  test("the invitation starter for a Hub is specific, friendly and reassuring", () => {
    const t = P.suggestedInvite({ organiser: "ZZ Org", edition: "ZZ Fest", dateLabel: "10 to 12 Jun", kind: "hub", subject: "ZZ Slippit Hub" });
    assert.match(t, /ZZ Slippit Hub to be part of ZZ Fest/); assert.match(t, /you can say no/); assert.match(t, /ZZ Org/);
  });
  test("Hub type labels and links", () => { assert.equal(P.hubTypeLabel("hall"), "Hall"); assert.equal(P.hubTypeLabel("nonsense"), "Hub"); assert.equal(P.hubHref({ slug: "zz", id: "i" }), "/hubs/zz"); assert.equal(P.hubHref({ slug: null, id: "i" }), "/hubs/i"); });
  test("database refusals about Hubs are shown as plain sentences", () => {
    assert.match(friendlyError("ERROR: only the Hub's owner or committee can set up Editions for it"), /Only the Hub's owner or committee/);
    assert.match(friendlyError("this Hub already has an Editions organiser"), /already has Editions set up/);
    assert.match(friendlyError("Editions is not open yet"), /not open to Hubs yet/);
    assert.match(friendlyError("ERROR: this Edition is run by that Hub already"), /run by that Hub already\./i);
    assert.match(friendlyError("choose at most 12 items"), /at most 12/);
  });
});

describe("the Partners screen (organiser)", () => {
  const screen = (rows) => wrap(h(PartnersManager, { organiserSlug: "zz-org", editionSlug: "zz-fest", organiserName: "ZZ Org", editionTitle: "ZZ Fest", dateLabel: "10 to 12 Jun 2099", rows, canManage: true }));
  test("businesses and Hubs sit in one list with filter chips, counts and a search; Hub rows say what the Hub chose", () => {
    const html = screen([ROW({ offers_selected: 2 }), ROW({ link_id: "k2", kind: "hub", subject_name: "ZZ Slippit Hub", offers_selected: 3 }), ROW({ link_id: "k3", kind: "event", subject_name: "ZZ Quiz" })]);
    assert.ok(html.includes("Taking part (3)")); assert.ok(html.includes("Everyone") && html.includes("Businesses") && html.includes("Hubs") && html.includes("Events &amp; activities"));
    assert.ok(html.includes("Search your partners")); assert.ok(html.includes("ZZ Harbour Cafe") && html.includes("ZZ Slippit Hub"));
    assert.ok(html.includes("2 offers shown")); assert.ok(html.includes("3 events or activities chosen by the Hub"));
  });
  test("a Hub tab sits beside business and event tabs, with its own search label", () => {
    const html = screen([]);
    assert.ok(html.includes("A local business") && html.includes("A Hub") && html.includes("An event or activity")); assert.ok(!html.includes('role="search"'), "no filter bar until there is something to filter");
  });
  test("a Hub with nothing chosen is described honestly", () => { assert.ok(screen([ROW({ kind: "hub", subject_name: "ZZ Slippit Hub" })]).includes("The Hub has not chosen anything to show yet")); });
  test("the copy promises control to Hubs as well as owners", () => { assert.match(screen([]), /Hubs, events and regular activities/); assert.match(screen([]), /Hub committee/); });
});

describe("the Hub's own side (invitations, choosing what to show)", () => {
  test("a Hub invitation reads as an invitation to the Hub, with the control promise; accepting offers the chooser, never a business offers panel", () => {
    const html = wrap(h(PartnershipInbox, { partnerships: [MY()], hub: { id: "hub1", name: "ZZ Slippit Hub" } }));
    assert.ok(html.includes("Hub: ZZ Slippit Hub") && html.includes("ZZ Fest") && html.includes("Join us")); assert.ok(html.includes("Yes, take part") && html.includes("No thanks"));
    assert.ok(html.includes("You choose what is shown") && html.includes("step back at any time")); assert.ok(!html.includes("Choose offers") && !html.includes("Add an event or activity"));
  });
  test("a taking-part Hub gets 'Choose what to show' with the count, and a join panel for the Hub; a business gets neither Hub control", () => {
    const hubHtml = wrap(h(PartnershipInbox, { partnerships: [MY({ state: "approved", offers_selected: 2 })], hub: { id: "hub1", name: "ZZ Slippit Hub" } }));
    assert.ok(hubHtml.includes("Showing 2 items")); assert.ok(hubHtml.includes("Find an Edition for ZZ Slippit Hub to join"));
    const bizHtml = wrap(h(PartnershipInbox, { partnerships: [MY({ kind: "business", subject_name: "ZZ Cafe", subject_business_id: "b1", state: "approved" })], businessId: "b1", businessName: "ZZ Cafe" }));
    assert.ok(!bizHtml.includes("Choose what to show") && !bizHtml.includes("Find an Edition for"));
  });
  test("the chooser is limited to the Hub's own public items and never mentions copying data it does not hold", () => {
    const src = read("components/editions-manage/PartnershipInbox.tsx");
    assert.match(src, /getHubItemOptions/); assert.match(src, /saveHubItems/); assert.match(src, /Members-only events never appear/); assert.match(src, /MAX_HUB_ITEMS/);
  });
});

describe("the public Edition shows Hubs in its own editorial language", () => {
  test("a Hub card: its cover, else logo, else monogram; kind and place; only what the Hub chose; a fine rule in the Hub's colour; verified", () => {
    const html = renderToStaticMarkup(h(HubCard, { h: HUB({ cover_url: "https://x.example/c.jpg", items: [{ kind: "event", title: "ZZ Open Concert", href: "/whats-on/ev1", when: "2099-06-11T19:00:00Z", venue: "ZZ Hall" }, { kind: "activity", title: "ZZ Choir", href: "/whats-on/regular/zz-choir", when: null, venue: null }] }), size: "lead" }));
    assert.ok(html.includes("Community Hub") && html.includes("Verified")); assert.ok(html.includes('href="/hubs/zz-slippit"') && html.includes("ZZ Slippit Hub")); assert.ok(html.includes("Community · Lerwick"));
    assert.ok(html.includes("From this Hub") && html.includes("ZZ Open Concert") && html.includes("/whats-on/ev1") && html.includes("Regular")); assert.ok(html.includes("border-top:3px solid #7a3b8f"));
    assert.ok(html.includes("c.jpg"));
    const mono = renderToStaticMarkup(h(HubCard, { h: HUB(), size: "grid" })); assert.ok(mono.includes("ed-img--mono") && mono.includes(">Z<"));
    const logo = renderToStaticMarkup(h(HubCard, { h: HUB({ logo_url: "https://x.example/l.png" }), size: "grid" })); assert.ok(logo.includes("ed-img--logo"));
  });
  test("a bad Hub colour is ignored; no private field is ever rendered", () => {
    const html = renderToStaticMarkup(h(HubCard, { h: HUB({ brand_color: "red; background:url(x)", owner_id: "SECRET-OWNER", contact_email: "secret@x.invalid", stripe_account_id: "acct_SECRET" }), size: "grid" }));
    assert.ok(!html.includes("border-top")); for (const s of ["SECRET-OWNER", "secret@x.invalid", "acct_SECRET"]) assert.ok(!html.includes(s), s);
  });
  test("Taking part lists businesses and Hubs together; Hubs get their own heading under a business spread; a Hub-only Edition still shows a section; nothing = no section", () => {
    const base = { businesses: [{ link_id: "b1", business_id: "bz", name: "ZZ Cafe", slug: "zz", category: "food_drink", description: null, address: "1 Quay", logo_url: null, cover_url: null, label: null, position: 0, offers: [] }], events: [], activities: [], hubs: [HUB()] };
    const both = renderToStaticMarkup(h(PartnersSection, { partners: base })); assert.ok(both.includes("Local businesses and community Hubs") && both.includes("Community Hubs") && both.includes("ZZ Cafe") && both.includes("ZZ Slippit Hub"));
    const hubOnly = renderToStaticMarkup(h(PartnersSection, { partners: { ...base, businesses: [] } })); assert.ok(hubOnly.includes("Taking part") && hubOnly.includes("ZZ Slippit Hub") && !hubOnly.includes("Community Hubs</h"));
    assert.equal(renderToStaticMarkup(h(PartnersSection, { partners: { businesses: [], events: [], activities: [], hubs: [] } })), "");
    const teaser = renderToStaticMarkup(h(PartnersSection, { partners: base, limit: 1, moreHref: "/editions/zz/partners" })); assert.ok(teaser.includes("See everyone taking part (2)"));
  });
});

describe("branding inheritance (pure)", () => {
  const ORG = (o = {}) => ({ logo_url: null, cover_url: null, cover_focus: null, brand_color: null, description: null, website: null, ...o });
  const HUBI = { id: "h", name: "Hub", slug: "hub", type: "community", description: "Hub words", area: "Lerwick", website: "https://hub.example", logo_url: "https://hub.example/l.png", cover_url: "https://hub.example/c.jpg", brand_color: "#7a3b8f", is_verified: true, is_charity: false };
  test("an empty organiser takes the Hub's logo, cover, colour, description and website; an Edition-level choice still wins because the organiser's own values are never overwritten", () => {
    const o = B.inheritFromHub(ORG(), HUBI); assert.equal(o.logo_url, HUBI.logo_url); assert.equal(o.cover_url, HUBI.cover_url); assert.equal(o.brand_color, "#7a3b8f"); assert.equal(o.description, "Hub words"); assert.equal(o.website, "https://hub.example");
    const own = B.inheritFromHub(ORG({ logo_url: "https://own.example/l.png", brand_color: "#112233", cover_url: "https://own.example/c.jpg", cover_focus: "20% 30%" }), HUBI);
    assert.equal(own.logo_url, "https://own.example/l.png"); assert.equal(own.brand_color, "#112233"); assert.equal(own.cover_url, "https://own.example/c.jpg"); assert.equal(own.cover_focus, "20% 30%", "a focus point stays with the photograph it was set on");
  });
  test("a Hub photograph is centred (no focus borrowed), unsafe or malformed Hub values are ignored, no Hub means no change", () => {
    assert.equal(B.inheritFromHub(ORG({ cover_focus: "10% 10%" }), HUBI).cover_focus, null, "the Hub's cover has no focus of its own");
    const bad = B.inheritFromHub(ORG(), { ...HUBI, logo_url: "http://insecure.example/l.png", cover_url: "javascript:alert(1)", brand_color: "red", website: "ftp://x" });
    assert.equal(bad.logo_url, null); assert.equal(bad.cover_url, null); assert.equal(bad.brand_color, null); assert.equal(bad.website, null);
    const o = ORG({ logo_url: "https://a.example/l.png" }); assert.equal(B.inheritFromHub(o, null), o); assert.equal(B.inheritFromHub(o, undefined), o);
  });
  test("inheritedFields says which of the organiser's fields are on loan from the Hub (for the Brand screen hints)", () => {
    assert.deepEqual(B.inheritedFields(ORG({ logo_url: "https://a.example/l.png" }), HUBI), { logo: false, cover: true, color: true, description: true, website: true });
    assert.deepEqual(B.inheritedFields(ORG(), null), { logo: false, cover: false, color: false, description: false, website: false });
  });
  test("a Business is a parent too: its public logo, cover, description and website fill what the Editions profile left empty", () => {
    const biz = B.businessParent({ id: "b1", name: "ZZ Harbour Cafe", description: "A cafe.", website: "https://cafe.example", logo_url: "https://cafe.example/l.png", cover_url: "https://cafe.example/c.png", brand_color: "#123456" });
    assert.equal(biz.kind, "business"); assert.equal(biz.href, "/directory/b1"); assert.equal(biz.manageHref, "/business/b1/manage/profile");
    const got = B.inheritFromParent(ORG(), biz); assert.equal(got.logo_url, "https://cafe.example/l.png"); assert.equal(got.brand_color, "#123456"); assert.equal(got.cover_focus, null);
    assert.equal(B.inheritFromParent(ORG({ logo_url: "https://own.example/l.png" }), biz).logo_url, "https://own.example/l.png", "the Edition's own choice still wins");
    const hub = B.hubParent(HUBI); assert.equal(hub.kind, "hub"); assert.match(hub.href, /^\/hubs\//); assert.match(hub.manageHref, /\/manage\/settings$/);
    assert.equal(B.inheritFromHub, B.inheritFromParent, "the Hub name stays as an alias");
  });
  test("the address is generated by the database: the web has no address suggester or validator any more", () => {
    assert.equal(B.suggestOrganiserSlug, undefined); assert.equal(B.isValidOrganiserSlug, undefined);
  });
});

describe("the team separates what comes with the Hub from invited helpers", () => {
  test("a member who comes with the Hub has no role picker and no Remove button, and is explained", () => {
    const html = wrap(h(TeamManager, { slug: "zz", role: "owner", selfId: "me", members: [{ user_id: "u1", role: "owner", full_name: "Hana Hub", joined_at: "2099-01-01T00:00:00Z", via_hub: true }, { user_id: "u2", role: "editor", full_name: "Tess Team", joined_at: "2099-01-01T00:00:00Z" }], invites: [] }));
    assert.ok(html.includes("Comes with your Hub")); assert.ok(html.includes("Invited helpers")); assert.ok(html.includes("Owner · Hub"));
    assert.equal((html.match(/>Remove</g) ?? []).length, 1, "only the explicit member can be removed");
  });
});

describe("source guards: Hub reads stay on the public whitelist and every write goes through the database", () => {
  const SRC = [...walk("app"), ...walk("lib"), ...walk("components")];
  test("the Hub columns the Edition reads are exactly the public whitelist (no owner, member, payout, contact or charity-number field)", () => {
    const cols = B.HUB_PUBLIC_COLUMNS.split(",").map((c) => c.trim());
    for (const bad of ["owner_id", "stripe_account_id", "payout_enabled", "contact_email", "contact_phone", "charity_number", "memberships_enabled", "join_mode"]) assert.ok(!cols.includes(bad), bad);
    for (const f of SRC) { const s = read(f); if (/from\("hubs"\)/.test(s) && f.startsWith("lib/editions")) assert.match(s, /select\(HUB_PUBLIC_COLUMNS\)/, f); }
    const dsrc = read("lib/editions/data.server.ts"); for (const t of ["edition_public_hubs", "edition_public_hub_items"]) assert.match(dsrc, new RegExp(t));
    assert.ok(!/hub_members/.test(SRC.filter((f) => f.startsWith("lib/editions") || f.startsWith("components/editions")).map(read).join("\n")), "no Editions web code reads hub_members");
  });
  test("every Hub write calls a database function: no direct insert or update on links, items, organisers or packages", () => {
    const writers = ["app/organise/actions.ts", "app/account/editions/actions.ts", "app/admin/editions/commerce/actions.ts"].map(read).join("\n");
    for (const rpc of ["edition_find_hubs", "edition_hub_item_options", "edition_set_hub_items"]) assert.match(writers, new RegExp(rpc), rpc);
    assert.ok(!/from\("edition_links"\)\s*\.(insert|update|delete)|from\("edition_link_hub_items"\)\s*\.(insert|update|delete)/.test(SRC.map(read).join("\n")));
  });
  test("the Hub's Festivals page exists only for the Hub's administrators, and is not indexed", () => {
    const page = read("app/hubs/[id]/manage/editions/page.tsx");
    assert.match(page, /isHubAdmin\(hub\.id\)/); assert.match(page, /redirect\(/); assert.match(page, /getHubEditionsEntry/); assert.match(page, /if \(!entry\.show\) notFound\(\)/); assert.match(page, /index: false/);
    const entry = read("lib/editions/data.server.ts"); assert.match(entry, /show: !!row/);
    assert.match(read("app/hubs/[id]/manage/page.tsx"), /festivals\.show/);
  });
  test("starting a Hub's Editions asks for no address or name: it calls the one entry function with the Hub id only", () => {
    const a = read("app/hubs/[id]/manage/editions/actions.ts"); assert.match(a, /ensureEditionsFor\("hub", hubId\)/); assert.doesNotMatch(a, /slug|p_name/);
    const e = read("lib/editions/ensure-organiser.server.ts"); assert.match(e, /isUuid\(parentId\)/); assert.match(e, /rpc\("edition_ensure_organiser", \{ p_kind: kind, p_parent: parentId \}\)/); assert.doesNotMatch(e, /service_role|createAdmin|SERVICE_KEY/i);
  });
  test("packages come from edition_available_packages (the database decides); the page asks per organiser", () => {
    assert.match(read("lib/editions/commerce.server.ts"), /edition_available_packages/); assert.match(read("app/organise/[slug]/packages/page.tsx"), /getCatalogue\(organiser\.id\)/);
  });
  test("an organiser's own pages inherit from the Hub through one function, and the raw organiser is what the forms edit", () => {
    const d = read("lib/editions/data.server.ts"); assert.match(d, /inheritFromParent\(org\.data as Organiser, parent\)/); assert.match(d, /inheritFromParent\(raw, parent\)/);
    assert.match(read("app/organise/[slug]/brand/page.tsx"), /inheritedFields\(organiser, parent\)/);
  });
});

// ── Organiser dashboard and publish checklist fixes ──
import { readFileSync as __rf } from "node:fs";
test("the checklist links each unmet item to where it is fixed", () => {
  const s = __rf("components/editions-manage/StatusPanels.tsx", "utf8");
  for (const k of ["summary", "dates", "cover", "page", "programme"]) assert.match(s, new RegExp(`${k}:`));
  const page = __rf("app/organise/[slug]/editions/[edition]/page.tsx", "utf8");
  assert.match(page, /edRoot=/); assert.match(page, /id="package"/);
});
test("organiser dashboard hides admin-only links from editors", () => {
  const s = __rf("app/organise/[slug]/page.tsx", "utf8");
  assert.match(s, /isAdmin && <Link href=\{`\/organise\/\$\{organiser\.slug\}\/payments`\}/);
  assert.match(s, /isAdmin && <Link href=\{`\/organise\/\$\{organiser\.slug\}\/packages`\}/);
});

// ── Add from your Hub ──
import { splitHubOwnItems, isHubOwnItem } from "../lib/editions/partners.ts";
describe("Add from your Hub (web)", () => {
  const items = [
    { kind: "event", id: "e1", title: "Fiddle workshop", starts_at: "2026-11-21T11:00:00Z", venue: "Hall", link_id: null },
    { kind: "activity", id: "a1", title: "Choir", starts_at: null, venue: null, link_id: "l1" },
    { kind: "event", id: "e2", title: "Concert", starts_at: "2026-11-21T19:00:00Z", venue: "Hall", link_id: "l2" },
  ];
  test("items split into events and activities and count what is already added", () => {
    const s = splitHubOwnItems(items);
    assert.equal(s.events.length, 2); assert.equal(s.activities.length, 1); assert.equal(s.added, 2);
  });
  test("only well-formed database rows are accepted", () => {
    assert.ok(isHubOwnItem(items[0])); assert.ok(!isHubOwnItem({ kind: "hub", id: "x", title: "y" })); assert.ok(!isHubOwnItem(null)); assert.ok(!isHubOwnItem({ kind: "event", id: 1, title: "y" }));
  });
  test("the Programme tab offers it to Hub-run Editions only, reuses invite/remove, and never invents an invitation message", () => {
    const page = readFileSync("app/organise/[slug]/editions/[edition]/programme/page.tsx", "utf8");
    assert.match(page, /hub \? await getHubOwnItems/); assert.match(page, /AddFromHubPanel/); assert.match(page, /forbidden/);
    const panel = readFileSync("components/editions-manage/AddFromHubPanel.tsx", "utf8");
    assert.match(panel, /invitePartner\(/); assert.match(panel, /partnerAction\([^)]*"remove"\)/); assert.match(panel, /message: ""/);
    assert.doesNotMatch(panel, /deleteEvent|deleteActivity|\.delete\(|from\("events"\)|from\("regular_activities"\)/, "the original is never deleted or edited from here");
  });
  test("the data helper calls the read-only chooser function and treats a refusal as 'forbidden', not an error page", () => {
    const d = readFileSync("lib/editions/data.server.ts", "utf8");
    assert.match(d, /rpc\("edition_hub_own_items"/); assert.match(d, /state: "forbidden"/);
  });
});
