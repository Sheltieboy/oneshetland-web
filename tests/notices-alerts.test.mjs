/**
 * Notices & Alerts (website): mappers, area semantics, homepage composition, /notices query model, funeral view-model and payload,
 * publisher-form validation mirror, and the server-action authorisation paths. Fixtures + the in-memory Supabase fake only: no network, no service role.
 * Run: node --test --import ./tests/support/register.mjs tests/notices-alerts.test.mjs
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as A from "../lib/notices-alerts.ts";
import * as R from "../lib/notices-rpc.ts";
import * as C from "../lib/notices-actions-core.ts";

const rd = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const pub = (kind, extra = {}) => ({ kind, label: kind === "official" ? "Council" : "Name", byline: undefined, is_official_source: kind === "official", source_label: null, source_url: null, ...extra });
let k = 0;
const row = (o = {}) => ({ id: `n${++k}`, title: "A notice title", body: "Body text", action_text: null, category: "community", category_label: "Community", published_at: "2026-10-31T09:00:00Z",
  expires_at: null, review_at: null, link_url: null, level: 3, is_essential_active: false, publisher: pub("hub", { label: "Voe Hall" }), area_ids: [], area_names: [],
  publisher_hub_id: null, publisher_business_id: null, event_id: null, campaign_id: null, publisher_logo_url: null, publisher_brand_color: null, hub_slug: null, business_slug: null, ...o });

describe("attribution adapter (RPC publisher object)", () => {
  test("every kind", () => {
    const a = (kind, extra, r) => A.adaptPublisher({ publisher: pub(kind, extra), ...r });
    assert.deepEqual([a("hub", { label: "Voe Hall" }).byline, a("hub", { label: "Voe Hall" }).kind], ["Posted by Voe Hall", "hub"]);
    assert.equal(a("business", { label: "Bea Bakery" }).byline, "Posted by Bea Bakery");
    assert.equal(a("person", { label: "A OneShetland member" }).byline, "Posted by A OneShetland member");
    assert.equal(a("platform", { label: "OneShetland" }).byline, "Posted by OneShetland");
    const o = a("official", { label: "Council", byline: "Issued by Council", source_url: "https://c.example/x" });
    assert.deepEqual([o.byline, o.isOfficialSource, o.sourceUrl], ["Issued by Council", true, "https://c.example/x"]);
    assert.equal(a("platform", { label: "NHS", is_official_source: true }).byline, "Source: NHS");
  });
  test("database byline wins; missing/odd publisher falls back to approved labels, never 'Member'", () => {
    assert.equal(A.adaptPublisher({ publisher: pub("official", { byline: "Issued by X" }) }).byline, "Issued by X");
    for (const p of [null, undefined, {}, { kind: "weird" }]) { const x = A.adaptPublisher({ publisher: p }); assert.equal(x.label, "OneShetland"); assert.notEqual(x.label, "Member"); }
    assert.equal(A.adaptPublisher({ publisher: { kind: "hub" } }).label, "Community hub");
  });
  test("source links are https only (http, javascript, data, credentials refused)", () => {
    for (const u of ["http://a.example", "javascript:alert(1)", "data:text/html,x", "https://u:p@a.example", "ftp://a", "", null, "not a url"]) assert.equal(A.safeHttpsUrl(u), null, String(u));
    assert.equal(A.adaptPublisher({ publisher: pub("official", { source_url: "http://a.example" }) }).sourceUrl, null);
    assert.equal(A.toNoticeCard(row({ link_url: "javascript:x" })).linkUrl, null);
  });
  test("logo/brand only for hub and business", () => {
    assert.equal(A.adaptPublisher({ publisher: pub("hub"), publisher_logo_url: "https://l/x.png" }).logoUrl, "https://l/x.png");
    assert.equal(A.adaptPublisher({ publisher: pub("official"), publisher_logo_url: "https://l/x.png" }).logoUrl, null);
  });
});

describe("destination precedence and card model", () => {
  test("campaign -> event -> hub -> business -> none", () => {
    const hub = { publisher: pub("hub"), publisher_hub_id: "h1", hub_slug: "voe-hall" };
    assert.equal(A.toNoticeCard(row({ ...hub, campaign_id: "c1", event_id: "e1" })).destination.href, "/hubs/campaign/c1");
    assert.equal(A.toNoticeCard(row({ ...hub, event_id: "e1" })).destination.href, "/whats-on/e1");
    assert.equal(A.toNoticeCard(row(hub)).destination.href, "/hubs/voe-hall");
    assert.equal(A.toNoticeCard(row({ publisher: pub("business"), publisher_business_id: "b1", business_slug: "bea" })).destination.href, "/directory/bea");
    assert.equal(A.toNoticeCard(row({ publisher: pub("official") })).destination, null);
    assert.equal(A.toNoticeCard(row({ publisher: pub("person"), publisher_hub_id: "h1" })).destination, null, "a stray hub id never links a person notice");
  });
  test("area names: none = NO label (unspecified is never presented as Shetland-wide), an explicit Shetland-wide notice says so, two shown, then +N", () => {
    assert.equal(A.areaSummary([]), ""); assert.equal(A.toNoticeCard(row({ area_ids: [], area_names: [] })).areaSummary, "", "unspecified: no geography claimed"); assert.equal(A.toNoticeCard(row({ area_ids: ["shetland_wide"], area_names: ["Shetland-wide"] })).areaSummary, "Shetland-wide"); assert.equal(A.areaSummary(["Voe", "Brae"]), "Voe, Brae"); assert.equal(A.areaSummary(["Voe", "Brae", "Delting", "Lerwick"]), "Voe, Brae +2");
    assert.equal(A.toNoticeCard(row({ area_names: ["Voe", "Brae", "Delting"] })).areaSummary, "Voe, Brae +1");
  });
  test("very long titles and bodies are carried whole (clamping is CSS)", () => {
    const t = "W".repeat(500); assert.equal(A.toNoticeCard(row({ title: t })).title.length, 500);
  });
  test("toNoticeCards tolerates garbage", () => { assert.deepEqual(A.toNoticeCards(null), []); assert.deepEqual(A.toNoticeCards([{}, null, 3]), []); });
});

describe("homepage composition", () => {
  const ess = [row({ is_essential_active: true, level: 1 }), row({ is_essential_active: true, level: 1 })].map(A.toNoticeCard);
  const rest = Array.from({ length: 9 }, () => A.toNoticeCard(row()));
  test("essential never duplicated in the grid; max six; order kept", () => {
    const got = A.composeHomeNotices([...ess, ...rest], ess.map((e) => e.id));
    assert.equal(got.length, 6); assert.ok(got.every((n) => !ess.some((e) => e.id === n.id))); assert.deepEqual(got.map((n) => n.id), rest.slice(0, 6).map((n) => n.id));
  });
  test("an alert the slot shows is excluded even if the row flag were missing", () => {
    const sneaky = A.toNoticeCard(row()); assert.ok(!A.composeHomeNotices([sneaky, ...rest], [sneaky.id]).some((n) => n.id === sneaky.id));
  });
  test("slot hidden when none; partner alerts independent of the slot", () => {
    assert.deepEqual(A.homeTopOfPage({ essentialCount: 0, partnerAlertCount: 2 }), { showEssentialSlot: false, showPartnerStrip: true });
    assert.equal(A.homeTopOfPage({ essentialCount: 1, partnerAlertCount: 0 }).showEssentialSlot, true);
  });
  test("components: slot collapses to null, red only in the slot, partner strip is calm, old banner gone", () => {
    assert.match(rd("components/notices/EssentialAlertSlot.tsx"), /if \(!plan\.lead\) return null/);
    assert.match(rd("components/notices/PartnerUpdateStrip.tsx"), /if \(!alerts\.length\) return null/);
    for (const f of ["components/notices/PartnerUpdateStrip.tsx", "components/notices/NoticeCard.tsx", "components/preview/v2/HomeV2.tsx"]) assert.doesNotMatch(strip(rd(f)), /9b1c1c|c53b2f|rose-600|role="alert"/, f);
    const page = rd("app/page.tsx");
    assert.ok(page.indexOf("<EssentialAlertSlot") < page.indexOf("<section className=\"relative isolate")); assert.doesNotMatch(page, /UrgentAlertBanner/);
    assert.match(rd("components/preview/v2/HomeV2.tsx"), /View all notices/); assert.match(rd("components/preview/v2/HomeV2.tsx"), /auto-rows-fr/);
  });
  test("a notice with no destination is a plain block (no link) in the compact card", () => {
    const src = rd("components/notices/NoticeCard.tsx"); assert.match(src, /n\.destination\s*\?\s*<Link/); assert.match(src, /<article className=\{cls\}>/);
  });
});

describe("area argument semantics: null vs [] vs list", () => {
  test("rpcAreaArg", () => {
    assert.equal(A.rpcAreaArg({ mode: "all" }), null); assert.deepEqual(A.rpcAreaArg({ mode: "wide" }), []); assert.deepEqual(A.rpcAreaArg({ mode: "areas", ids: ["voe", "brae"] }), ["voe", "brae"]);
    assert.equal(A.rpcAreaArg({ mode: "areas", ids: [] }), null, "an empty id list is never silently Shetland-wide-only");
  });
  test("member browsing: signed out, no areas and areas are not the same", () => {
    assert.equal(A.rpcAreaArg(A.memberBrowseScope(null)), null); assert.equal(A.rpcAreaArg(A.memberBrowseScope([])), null);
    assert.deepEqual(A.rpcAreaArg(A.memberBrowseScope(["voe", "voe", "BAD id"])), ["voe"]);
  });
  test("areaArgForQuery: wide is [], my without areas is null", () => {
    assert.deepEqual(A.areaArgForQuery({ mode: "wide" }, ["voe"]), []); assert.equal(A.areaArgForQuery({ mode: "my" }, []), null); assert.equal(A.areaArgForQuery({ mode: "my" }, null), null);
    assert.deepEqual(A.areaArgForQuery({ mode: "my" }, ["voe"]), ["voe"]); assert.equal(A.areaArgForQuery({ mode: "all" }, ["voe"]), null);
  });
  test("the data layer passes the argument through unchanged (null stays null, [] stays [])", async () => {
    const calls = []; globalThis.__FAKE_RPC__ = async (fn, args) => { calls.push({ fn, args }); return { data: [], error: null }; };
    const D = await import("../lib/notices-data.ts");
    await D.getEssentialAlerts(null); await D.getEssentialAlerts([]); await D.getEssentialAlerts(["voe"]);
    assert.deepEqual(calls.map((c) => c.args.p_area_ids), [null, [], ["voe"]]); delete globalThis.__FAKE_RPC__;
  });
});

describe("/notices query model and pagination", () => {
  test("parsing: defaults, valid values, junk ignored", () => {
    assert.deepEqual(A.parseNoticesQuery({}), { tab: "all", area: { mode: "all" }, category: null, page: 1 });
    assert.deepEqual(A.parseNoticesQuery({ tab: "essential", area: "voe,brae", cat: "health", page: "3" }), { tab: "essential", area: { mode: "ids", ids: ["voe", "brae"] }, category: "health", page: 3 });
    assert.equal(A.parseNoticesQuery({ tab: "<script>" }).tab, "all"); assert.equal(A.parseNoticesQuery({ cat: "x" }).category, null);
    assert.equal(A.parseNoticesQuery({ page: "-4" }).page, 1); assert.equal(A.parseNoticesQuery({ page: "9999" }).page, A.MAX_PAGES); assert.equal(A.parseNoticesQuery({ page: "abc" }).page, 1);
    assert.deepEqual(A.parseNoticesQuery({ area: "wide" }).area, { mode: "wide" }); assert.deepEqual(A.parseNoticesQuery({ area: "my" }).area, { mode: "my" });
    assert.deepEqual(A.parseNoticesQuery({ area: "voe';drop" }).area, { mode: "all" });
  });
  test("href round-trips and omits defaults", () => {
    assert.equal(A.noticesHref({}), "/notices"); const q = { tab: "official", area: { mode: "ids", ids: ["voe"] }, category: "health", page: 2 };
    assert.equal(A.noticesHref(q), "/notices?tab=official&area=voe&cat=health&page=2"); assert.deepEqual(A.parseNoticesQuery(Object.fromEntries(new URL("http://x" + A.noticesHref(q)).searchParams)), q);
  });
  test("chunks respect the RPC's 50-row clamp and ask for one extra row", () => {
    assert.deepEqual(A.planChunks(1), [{ offset: 0, limit: 21 }]); assert.deepEqual(A.planChunks(3), [{ offset: 0, limit: 50 }, { offset: 50, limit: 11 }]);
    assert.equal(A.planChunks(10).reduce((s, c) => s + c.limit, 0), 201);
    const rows = Array.from({ length: 21 }, (_, i) => i); assert.deepEqual([A.sliceForPage(rows, 1).rows.length, A.sliceForPage(rows, 1).hasMore], [20, true]); assert.equal(A.sliceForPage(rows.slice(0, 20), 1).hasMore, false);
  });
  test("getNoticesPage fetches in chunks and reports hasMore; an RPC error is returned, not swallowed", async () => {
    const calls = []; const all = Array.from({ length: 70 }, () => row());
    globalThis.__FAKE_RPC__ = async (fn, a) => { calls.push(a); return { data: all.slice(a.p_offset, a.p_offset + a.p_limit), error: null }; };
    const D = await import("../lib/notices-data.ts");
    const r = await D.getNoticesPage({ level: "all", areaIds: null, category: null, page: 3 });
    assert.ok(r.ok); assert.equal(r.data.rows.length, 60); assert.equal(r.data.hasMore, true); assert.ok(calls.every((c) => c.p_limit <= 50));
    globalThis.__FAKE_RPC__ = async () => ({ data: null, error: { message: "boom" } });
    const e = await D.getNoticesPage({ level: "all", areaIds: null, category: null, page: 1 }); assert.deepEqual([e.ok, e.error], [false, "boom"]);
    delete globalThis.__FAKE_RPC__;
  });
  test("derived area options when the areas table is empty", async () => {
    const D = await import("../lib/notices-data.ts");
    const o = D.deriveAreaOptions([A.toNoticeCard(row({ area_ids: ["voe", "shetland_wide"], area_names: ["Voe", "Shetland"] }))]); assert.deepEqual(o.map((x) => x.id), ["voe"]);
  });
});

describe("funeral view-model", () => {
  const full = { id: "f1", full_name: "Isobel Demoson", preferred_name: "Isa", photo_url: "https://p/x.jpg", born_on: "1941-02-14", died_on: "2026-10-27", announcement: "Peacefully.",
    service_kind: "funeral", service_venue: "Voe Kirk", service_at: "2026-11-05T11:00:00Z", service_notes: "Tea after.", family_requests: "Flowers or donations", donation_info: "Hall fund", donation_url: "https://d/x", area_name: "Voe", published_at: "2026-10-31T09:00:00Z" };
  test("full row", () => {
    const v = A.funeralView(full); assert.equal(v.knownAs, "Isa"); assert.equal(v.lifeSpan, "14 February 1941 – 27 October 2026"); assert.equal(v.arrangements.kindLabel, "Funeral service"); assert.match(v.arrangements.when, /Thursday,? 5 November 2026 at 11:00/); assert.equal(v.donationUrl, "https://d/x");
  });
  test("arrangements omitted when absent; optional fields omitted cleanly", () => {
    const v = A.funeralView({ id: "f2", full_name: "Jessie Demoson", died_on: "2026-10-30", announcement: "Suddenly at home.", service_kind: null, service_venue: null, service_at: null, service_notes: null, preferred_name: null, photo_url: null, born_on: null });
    assert.equal(v.arrangements, null); assert.equal(v.knownAs, null); assert.equal(v.photoUrl, null); assert.equal(v.lifeSpan, "Died 30 October 2026"); assert.equal(v.familyRequests, null); assert.equal(v.donationUrl, null);
  });
  test("known-as hidden when same as the name; unsafe urls dropped", () => {
    assert.equal(A.funeralView({ ...full, preferred_name: "isobel demoson" }).knownAs, null); const v = A.funeralView({ ...full, photo_url: "http://x", donation_url: "javascript:1" }); assert.deepEqual([v.photoUrl, v.donationUrl], [null, null]);
  });
  test("a whitelist: private fields never pass through, and the display files never mention them", () => {
    const v = A.funeralView({ ...full, submitter_phone: "0123", submitter_email: "a@b", verification_note: "secret", review_note: "x", submitter_name: "N" });
    assert.doesNotMatch(JSON.stringify(v), /0123|a@b|secret|submitter|verification/);
    for (const f of ["components/notices/FuneralNotice.tsx", "app/notices/funeral/page.tsx", "app/notices/funeral/[id]/page.tsx"]) assert.doesNotMatch(rd(f), /submitter_|verification_|review_note|funeral_notices\b.*from\(/, f);
    assert.doesNotMatch(strip(rd("components/notices/FuneralNotice.tsx")), /animate|transition|motion/);
  });
});

describe("funeral submission", () => {
  const ok = { ...A.EMPTY_FUNERAL_FORM, fullName: "Isobel Demoson", submitterName: "Ann", submitterPhone: "07", familyAuthorised: true };
  test("minimum valid form; blanks are left out of the payload", () => {
    assert.deepEqual(A.validateFuneralForm(ok), {}); const p = A.buildFuneralPayload(ok);
    assert.deepEqual(Object.keys(p).sort(), ["announce_in_notifications", "announce_name_in_preview", "family_authorised", "full_name", "service_public", "submitter_name", "submitter_phone", "submitter_role"].sort());
  });
  test("arrangements only on the explicit choice, even if typed", () => {
    const typed = { ...ok, serviceVenue: "Kirk", serviceKind: "funeral", serviceAt: "2026-11-05T11:00", serviceNotes: "n" };
    const off = A.buildFuneralPayload(typed); assert.equal(off.service_public, false); for (const k of ["service_venue", "service_kind", "service_at", "service_notes"]) assert.ok(!(k in off), k);
    const on = A.buildFuneralPayload({ ...typed, publishArrangements: true }); assert.equal(on.service_public, true); assert.equal(on.service_venue, "Kirk"); assert.match(on.service_at, /^2026-11-05T/);
  });
  test("notification consent defaults off; name preview needs notification consent", () => {
    const p = A.buildFuneralPayload(ok); assert.deepEqual([p.announce_in_notifications, p.announce_name_in_preview], [false, false]);
    assert.equal(A.buildFuneralPayload({ ...ok, announceNameInPreview: true }).announce_name_in_preview, false);
    assert.equal(A.buildFuneralPayload({ ...ok, announceInNotifications: true, announceNameInPreview: true }).announce_name_in_preview, true);
  });
  test("validation mirror", () => {
    const e = A.validateFuneralForm({ ...A.EMPTY_FUNERAL_FORM, announcement: "see www.x.com", donationUrl: "http://x", bornOn: "2000-01-02", diedOn: "1999-01-01" });
    for (const f of ["fullName", "submitterName", "contact", "familyAuthorised", "announcement", "donationUrl", "bornOn"]) assert.ok(e[f], f);
    assert.ok(A.validateFuneralForm({ ...ok, diedOn: "2999-01-01" }).diedOn);
  });
  test("the form says notices are checked and signed-out state exists", () => {
    assert.match(rd("components/notices/FuneralForms.tsx"), /checked before they are published, and we may telephone you/); assert.match(rd("app/notices/funeral/submit/page.tsx"), /Sign in to submit/);
  });
});

describe("official publisher form validation mirror", () => {
  const now = new Date("2026-11-01T12:00:00Z"); const h = 3_600_000;
  const base = { title: "Road closed", body: "x".repeat(30), actionText: "", category: "travel_transport", areaIds: ["voe"], startsAt: null, expiresAt: new Date(+now + 48 * h), reviewAt: null, linkUrl: "", essential: false };
  const v = (o, ctx = { canEssential: true }) => A.validateOfficialNotice({ ...base, ...o }, { ...ctx, now });
  test("valid ordinary and essential", () => { assert.deepEqual(v({}), {}); assert.deepEqual(v({ essential: true, actionText: "Use the other road", reviewAt: new Date(+now + 24 * h) }), {}); });
  test("ordinary rules", () => {
    assert.ok(v({ title: "abc" }).title); assert.ok(v({ body: "short" }).body); assert.ok(v({ category: "" }).category); assert.ok(v({ areaIds: [] }).areaIds);
    assert.ok(v({ areaIds: ["shetland_wide", "voe"] }).areaIds); assert.deepEqual(v({ areaIds: ["shetland_wide"] }), {}); assert.ok(v({ linkUrl: "http://x" }).linkUrl);
    assert.ok(v({ expiresAt: null }).expiresAt); assert.ok(v({ expiresAt: new Date(+now - h) }).expiresAt); assert.ok(v({ expiresAt: new Date(+now + 181 * 24 * h) }).expiresAt);
    assert.ok(v({ startsAt: new Date(+now + 40 * 24 * h) }).startsAt);
  });
  test("essential rules: 7 days, review window, action text, entitlement", () => {
    const e = { essential: true, actionText: "Use the other road", reviewAt: new Date(+now + 24 * h) };
    assert.ok(v({ ...e, expiresAt: new Date(+now + 8 * 24 * h) }).expiresAt); assert.ok(v({ ...e, reviewAt: null }).reviewAt); assert.ok(v({ ...e, reviewAt: new Date(+now + 72 * h) }).reviewAt);
    assert.ok(v({ ...e, actionText: "short" }).actionText); assert.ok(v(e, { canEssential: false }).essential);
  });
  test("publish args: essential-only fields; areas cleaned", () => {
    const a = A.officialPublishArgs("p1", { ...base, essential: false, reviewAt: new Date(+now + h) }); assert.equal(a.p_review_at, null); assert.equal(a.p_is_essential, false); assert.deepEqual(a.p_area_ids, ["voe"]);
  });
  test("console shows the essential checkbox only when can_essential", () => { assert.match(rd("components/notices/PublisherConsole.tsx"), /\{pub\.can_essential && \(/); assert.match(rd("app/notices/publish/page.tsx"), /This page is not available/); });
});

describe("member preferences", () => {
  test("defaults off; args make 'all categories' explicit", () => {
    assert.deepEqual(A.toNoticePrefs(null), A.DEFAULT_NOTICE_PREFS);
    assert.deepEqual(A.prefsArgs(A.DEFAULT_NOTICE_PREFS), { p_essential: false, p_official: false, p_community: false, p_funeral: false, p_categories: null, p_all_community_categories: true });
    assert.deepEqual(A.prefsArgs({ ...A.DEFAULT_NOTICE_PREFS, community_categories: ["health"] }), { p_essential: false, p_official: false, p_community: false, p_funeral: false, p_categories: ["health"], p_all_community_categories: false });
    assert.equal(A.prefsArgs({ ...A.DEFAULT_NOTICE_PREFS, community_categories: [] }).p_all_community_categories, true);
  });
  test("panel says areas do not turn notifications on, and the no-areas rule", () => {
    const s = rd("components/notices/NoticePrefsPanel.tsx"); assert.match(s, /does not turn any notifications on/); assert.match(s, /only be told about Shetland-wide notices/); assert.match(s, /quiet hours/);
  });
});

describe("server-action authorisation paths", () => {
  const mk = (res) => { const calls = []; return { calls, rpc: async (fn, args) => { calls.push({ fn, args }); return res; } }; };
  test("database refusals are returned verbatim, never swallowed", async () => {
    const sb = mk({ data: null, error: { message: "Platform administrators only", code: "42501" } });
    const r = await C.runWrite(sb, "admin_grant_essential_alert", { p_publisher: "p", p_reason: "r" }); assert.deepEqual([r.ok, r.error], [false, "Platform administrators only"]);
    const t = await R.callRpc({ rpc: async () => { throw new Error("network down"); } }, "x"); assert.deepEqual([t.ok, t.error], [false, "network down"]);
  });
  test("unknown functions and unknown arguments are refused before any call", async () => {
    const sb = mk({ data: 1, error: null });
    assert.equal((await C.runWrite(sb, "drop_everything", {})).ok, false); assert.equal((await C.runWrite(sb, "set_my_notice_areas", { p_areas: [], p_user: "other" })).ok, false);
    assert.equal((await C.runRead(sb, "admin_import_status", {})).ok, false); assert.equal(sb.calls.length, 0);
  });
  test("revoke needs a reason; approve needs a method (a note is optional but may not hold a phone number or email); enabling an import needs a reuse note", async () => {
    const sb = mk({ data: 1, error: null });
    assert.equal((await C.revokeEssential(sb, "p", "  ")).ok, false); assert.equal((await C.approveFuneral(sb, "f", "", "note")).ok, false); assert.equal((await C.approveFuneral(sb, "f", "in_person", "Rang 01595 123456")).ok, false); assert.equal((await C.approveFuneral(sb, "f", "in_person", "mail jo@family.example")).ok, false);
    assert.equal((await C.enableImportSource(sb, "s", "short")).ok, false); assert.equal(sb.calls.length, 0);
    assert.equal((await C.approveFuneral(sb, "f", "in_person", "rang family")).ok, true); assert.deepEqual(sb.calls[0].args, { p_id: "f", p_action: "approve", p_note: "rang family", p_verification_method: "in_person", p_verification_outcome: "confirmed", p_followup: "none" });
    assert.equal((await C.enableImportSource(sb, "s", "Open Government Licence confirmed")).ok, true);
  });
  test("every write the UI uses is on the allow-list and no service role is referenced", () => {
    const used = new Set(); for (const f of ["components/notices/FuneralForms.tsx", "components/notices/PublisherConsole.tsx", "components/notices/NoticePrefsPanel.tsx", "components/admin/NoticesAdmin.tsx", "components/notices/FuneralForms.tsx"]) for (const m of rd(f).matchAll(/noticeWrite\("([a-z_]+)"/g)) used.add(m[1]);
    assert.ok(used.size >= 10); for (const fn of used) assert.ok(C.WRITE_RPCS[fn], fn);
    for (const f of ["app/notices/actions.ts", "lib/notices-actions-core.ts", "lib/notices-rpc.ts", "lib/notices-data.ts"]) assert.doesNotMatch(strip(rd(f)), /service_role|SERVICE_ROLE|service_key/i, f);
    assert.match(rd("app/notices/actions.ts"), /^"use server"/);
  });
  test("notify call: user's token, correct body, graceful errors (function not deployed)", async () => {
    const id = "11111111-1111-1111-1111-111111111111"; let seen;
    const ok = await R.callNotifyAudience({ baseUrl: "https://x.supabase.co/", accessToken: "tok", noticeId: id, kind: "essential", fetchImpl: async (u, i) => { seen = { u, i }; return { ok: true, status: 200, json: async () => ({ message: "queued" }) }; } });
    assert.equal(ok.ok, true); assert.equal(seen.u, "https://x.supabase.co/functions/v1/notify-notice-audience"); assert.equal(seen.i.headers.authorization, "Bearer tok"); assert.deepEqual(JSON.parse(seen.i.body), { notice_id: id, kind: "essential" });
    const nf = await R.callNotifyAudience({ baseUrl: "https://x", accessToken: "t", noticeId: id, kind: "official", fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) }); assert.equal(nf.ok, false); assert.match(nf.error, /not switched on yet/);
    const net = await R.callNotifyAudience({ baseUrl: "https://x", accessToken: "t", noticeId: id, kind: "official", fetchImpl: async () => { throw new Error("x"); } }); assert.equal(net.ok, false);
    assert.equal((await R.callNotifyAudience({ baseUrl: "https://x", accessToken: null, noticeId: id, kind: "official" })).ok, false);
    assert.equal((await R.callNotifyAudience({ baseUrl: "https://x", accessToken: "t", noticeId: "bad", kind: "official" })).ok, false);
  });
});

describe("follow-up: essential slot with several alerts (pure plan)", () => {
  const al = (id, at) => ({ id, publishedAt: at });
  test("none -> no lead; one -> singular heading", () => {
    assert.deepEqual(A.planEssentialSlot([]), { lead: null, others: [], count: 0, heading: "Essential alert" });
    const one = A.planEssentialSlot([al("a", "2026-10-31T09:00:00Z")]); assert.deepEqual([one.lead.id, one.others.length, one.heading], ["a", 0, "Essential alert"]);
  });
  test("three: most recent in full, the others compact, count heading, stable order on ties", () => {
    const p = A.planEssentialSlot([al("old", "2026-10-31T08:00:00Z"), al("new", "2026-10-31T10:00:00Z"), al("mid", "2026-10-31T09:00:00Z")]);
    assert.equal(p.lead.id, "new"); assert.deepEqual(p.others.map((x) => x.id), ["mid", "old"]); assert.equal(p.heading, "3 essential alerts"); assert.equal(p.count, 3);
    assert.deepEqual(A.planEssentialSlot([al("x", null), al("y", null)]).others.map((o) => o.id), ["y"]);
  });
  test("component: ONE LINE always - fixed height, nowrap, truncation, no wrapping utilities, no body / what-to-do / source detail", () => {
    const src = rd("components/notices/EssentialAlertSlot.tsx"); const code = strip(src);
    assert.match(code, /className="mx-auto flex h-11 /, "fixed 44px height");
    assert.match(code, /whitespace-nowrap/); assert.match(code, /min-w-0 flex-1 truncate/, "the headline truncates with an ellipsis");
    assert.doesNotMatch(code, /line-clamp|flex-col|flex-wrap|whitespace-normal|break-words|whitespace-pre|min-h-\[|\bpy-\d/, "nothing that lets the strip wrap or grow");
    assert.doesNotMatch(code, /a\.body|actionText|attribution|plan\.others\.map/);
    assert.doesNotMatch(code, /Essential alert<|>Alert<|uppercase|tracking-wider/, "no visible label text: the headline gets the space");
    assert.match(code, /many \? `Essential alert, \$\{plan\.count\} active` : "Essential alert"/, "'Essential alert' stays in the accessible name");
    assert.match(code, /hidden max-w-\[28%\] shrink truncate[^"]*md:block/, "the area drops out below md");
    assert.match(code, /\/notices\?tab=essential/); assert.match(code, /\/notices\/\$\{a\.id\}/);
  });
  test("component: the icon is one self-contained SVG with explicit fills (a red mark inside a white disc), never currentColor or a hairline stroke", () => {
    const code = strip(rd("components/notices/EssentialAlertSlot.tsx"));
    const icon = code.match(/<svg aria-hidden focusable="false" width="24"[\s\S]*?<\/svg>/)[0];
    assert.match(icon, /<circle cx="12" cy="12" r="12" fill="#ffffff"/); assert.match(icon, /<rect [^>]*fill=\{RED\}/); assert.match(icon, /<circle cx="12" cy="18\.2"[^>]*fill=\{RED\}/);
    assert.doesNotMatch(icon, /currentColor|stroke=/); assert.match(code, /const RED = "#9b1c1c"/);
  });
  test("component: link and dismiss are SIBLINGS (the x can never navigate); accessible names; keyboard focus ring", () => {
    const code = strip(rd("components/notices/EssentialAlertSlot.tsx"));
    const link = code.slice(code.indexOf("<Link "), code.indexOf("</Link>"));
    assert.doesNotMatch(link, /<button|onClick=\{dismiss\}/, "no button inside the link");
    assert.match(code, /<button type="button" onClick=\{dismiss\} aria-label="Dismiss Essential Alert"/); assert.match(code, /h-11 w-11/, "a 44px target");
    assert.match(code, /aria-label=\{name\}/); assert.match(code, /Opens all essential alerts/); assert.match(code, /Opens the full alert/);
    assert.ok((code.match(/focus-visible:outline-white/g) ?? []).length >= 2, "link and button both show a focus ring");
    assert.equal((code.match(/<Link /g) ?? []).length, 1);
  });
  test("members: the form mirrors the server rules (title 5-120, text 10-2000, a listed category, a choice of place, expiry in the future within 90 days) and never offers 'no place'", () => {
    const now = new Date("2026-11-01T10:00:00Z"); const ok = { title: "Lost: grey cat", body: "A grey tabby has gone missing near the Co-op.", category: "lost_found", scope: "wide", areaIds: [], expires: "" };
    assert.deepEqual(A.validateMemberNotice(ok, now), {});
    assert.deepEqual(Object.keys(A.validateMemberNotice(A.EMPTY_MEMBER_NOTICE_FORM, now)).sort(), ["areas", "body", "category", "title"], "everything required is flagged; 'areas' because the default scope is specific places with none chosen");
    assert.ok(A.validateMemberNotice({ ...ok, title: "Hi" }, now).title); assert.ok(A.validateMemberNotice({ ...ok, body: "x".repeat(2001) }, now).body); assert.ok(A.validateMemberNotice({ ...ok, category: "made_up" }, now).category);
    assert.ok(A.validateMemberNotice({ ...ok, scope: "areas", areaIds: [] }, now).areas); assert.deepEqual(A.validateMemberNotice({ ...ok, scope: "areas", areaIds: ["voe"] }, now), {});
    assert.ok(A.validateMemberNotice({ ...ok, scope: "areas", areaIds: Array.from({ length: 9 }, (_, i) => "a" + i) }, now).areas);
    assert.ok(A.validateMemberNotice({ ...ok, expires: "2026-10-01T10:00" }, now).expires); assert.ok(A.validateMemberNotice({ ...ok, expires: "2027-03-01T10:00" }, now).expires); assert.deepEqual(A.validateMemberNotice({ ...ok, expires: "2026-11-20T10:00" }, now), {});
  });
  test("members: the RPC arguments - explicit Shetland-wide is the single 'shetland_wide' area, specific areas are de-duplicated, a blank expiry is null, nothing else (no severity / publisher) is ever sent", () => {
    const f = { title: "  Title here  ", body: "  The body text here.  ", category: "other", scope: "wide", areaIds: ["voe"], expires: "" };
    assert.deepEqual(A.buildMemberNoticeArgs(f), { p_title: "Title here", p_body: "The body text here.", p_category: "other", p_area_ids: ["shetland_wide"], p_expires_at: null });
    assert.deepEqual(A.buildMemberNoticeArgs({ ...f, scope: "areas", areaIds: ["voe", "brae", "voe"], expires: "2026-11-20T10:00" }).p_area_ids, ["voe", "brae"]);
    assert.match(A.buildMemberNoticeArgs({ ...f, expires: "2026-11-20T10:00" }).p_expires_at, /^2026-11-20T/);
    assert.deepEqual(Object.keys(A.buildMemberNoticeArgs(f)).sort(), ["p_area_ids", "p_body", "p_category", "p_expires_at", "p_title"]);
  });
  test("members: area scope keeps THREE states and the labels never invent a place", () => {
    assert.equal(A.areaScopeOf([]), "unspecified"); assert.equal(A.areaScopeOf(null), "unspecified"); assert.equal(A.areaScopeOf(["shetland_wide"]), "shetland_wide"); assert.equal(A.areaScopeOf(["voe"]), "specific"); assert.equal(A.areaScopeOf(["shetland_wide", "voe"]), "specific");
    assert.equal(A.myNoticeAreaLabel({ area_ids: [], area_names: [] }), "", "unspecified: no label at all"); assert.equal(A.myNoticeAreaLabel({ area_ids: ["shetland_wide"], area_names: ["Shetland-wide"] }), "Shetland-wide");
    assert.equal(A.myNoticeAreaLabel({ area_ids: ["voe", "brae", "delting"], area_names: ["Brae", "Delting", "Voe"] }), "Brae, Delting +1");
    const wide = A.memberFormFromRow({ id: "1", title: "T title", body: "Body text here", category: "other", category_label: "Other", state: "pending", created_at: "2026-11-01T10:00:00Z", published_at: null, expires_at: "2026-11-20T10:00:00Z", area_ids: ["shetland_wide"], area_names: ["Shetland-wide"], decline_reason: null, can_edit: true, can_withdraw: true });
    assert.equal(wide.scope, "wide"); assert.deepEqual(wide.areaIds, []); const spec = A.memberFormFromRow({ ...{ id: "1", title: "T title", body: "Body text here", category: null, category_label: null, state: "published", created_at: "", published_at: null, expires_at: null, decline_reason: null, can_edit: true, can_withdraw: true }, area_ids: ["voe"], area_names: ["Voe"] });
    assert.equal(spec.scope, "areas"); assert.deepEqual(spec.areaIds, ["voe"]); assert.equal(spec.expires, "");
    for (const st of ["pending", "published", "expired", "withdrawn", "declined", "resolved"]) assert.ok(A.MY_NOTICE_STATE[st].label && A.MY_NOTICE_STATE[st].help, st);
  });
  test("members: only the five member actions are allow-listed with their own parameters; the pages and the staff queue exist and are wired to them", async () => {
    const C = await import("../lib/notices-actions-core.ts");
    for (const [fn, args] of [["submit_person_notice", ["p_title", "p_body", "p_category", "p_area_ids", "p_expires_at"]], ["edit_my_person_notice", ["p_notice", "p_title"]], ["withdraw_my_person_notice", ["p_notice"]], ["staff_approve_person_notice", ["p_notice"]], ["staff_decline_person_notice", ["p_notice", "p_reason"]]])
      assert.equal(C.isAllowedWrite(fn, Object.fromEntries(args.map((a) => [a, 1]))), null, fn);
    assert.ok(C.isAllowedWrite("submit_person_notice", { p_title: "x", severity: "urgent" }), "a smuggled field (severity) is refused"); assert.ok(C.isAllowedWrite("submit_person_notice", { p_publisher: "x" }));
    const post = rd("app/notices/post/page.tsx"), mine = rd("app/notices/mine/page.tsx"), mod = rd("app/notices/moderate/page.tsx"), list = rd("app/notices/page.tsx"), form = rd("components/notices/MemberNotice.tsx");
    assert.match(post, /\/sign-in\?next=\$\{encodeURIComponent\(here\)\}/, "signed-out visitors are sent to sign in and brought back"); assert.match(post, /robots: \{ index: false \}/); assert.match(mine, /my_person_notices/);
    assert.match(mod, /staff_pending_person_notices/); assert.match(list, /href="\/notices\/post"/); assert.match(list, /href="\/notices\/mine"/);
    assert.doesNotMatch(form, /severity|p_is_essential|publisher_hub_id|publisher_business_id|event_id|is_platform/, "the member form can never send an urgent / essential / publisher / event field");
    assert.match(form, /submit_person_notice/); assert.match(form, /edit_my_person_notice/); assert.match(form, /withdraw_my_person_notice/); assert.match(form, /window\.confirm\("Withdraw this notice\?/);
  });
  test("admin console: the typed reason / note is cleared after every success (a grant reason must not sit pre-filled in the revoke box)", () => {
    const src = rd("components/admin/NoticesAdmin.tsx"); assert.match(src, /const done = \(ok: boolean\) => \{ if \(ok\) \{ setReason\(""\); setNote\(""\); router\.refresh\(\); \} \};/);
  });
  test("dismissal: ids, not a global switch; the whole active set is dismissed; a NEW id brings the strip back; dismissed ids never return", async () => {
    const D = await import("../lib/essential-dismiss.ts");
    const three = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(D.undismissed(three, []), three);
    const afterDismiss = D.dismissAll([], three);
    assert.deepEqual(afterDismiss, ["a", "b", "c"]); assert.deepEqual(D.undismissed(three, afterDismiss), [], "all three leave the strip; the second is NOT promoted");
    const withNew = [...three, { id: "d" }];
    assert.deepEqual(D.undismissed(withNew, afterDismiss).map((x) => x.id), ["d"], "only the genuinely new alert shows");
    const again = D.dismissAll(afterDismiss, [{ id: "d" }]); assert.deepEqual(again, ["a", "b", "c", "d"]); assert.deepEqual(D.undismissed(withNew, again), []);
    assert.deepEqual(D.undismissed([{ id: "a" }, { id: "e" }], again).map((x) => x.id), ["e"], "a dismissed alert returning later is still dismissed");
    assert.deepEqual(D.undismissed(null, []), []);
    assert.deepEqual(D.dismissAll(["x"], [{ id: "x" }, { id: "y" }]), ["x", "y"], "no duplicates");
    for (const bad of [null, undefined, "", "not json", "{}", "[1,2]", '["ok",""]']) assert.ok(Array.isArray(D.parseDismissed(bad)), String(bad));
    assert.deepEqual(D.parseDismissed('["ok",""]'), ["ok"]); assert.deepEqual(D.parseDismissed("{}"), []);
    assert.equal(D.dismissAll([], Array.from({ length: 500 }, (_, i) => ({ id: "n" + i }))).length, 200, "bounded");
  });
  test("pre-paint script: hides the strip only when EVERY active id is already dismissed (no flash); safe if storage throws", () => {
    const src = rd("components/notices/EssentialAlertSlot.tsx");
    assert.match(src, /document\.currentScript\.parentElement\.hidden=true/); assert.match(src, /\{!hydrated && <script dangerouslySetInnerHTML/);
    const mk = (src) => { const m = src.match(/function hideIfDismissedScript\(ids: string\[\]\) \{\s*return `([\s\S]*?)`;/)[1]; return (ids, stored, throws) => { const parent = { hidden: false }; const f = new Function("localStorage", "document", "JSON", m.replace("${JSON.stringify(DISMISSED_KEY)}", JSON.stringify("k")).replace("${JSON.stringify(ids)}", JSON.stringify(ids))); f({ getItem: () => { if (throws) throw new Error("blocked"); return stored; } }, { currentScript: { parentElement: parent } }, JSON); return parent.hidden; }; };
    const run = mk(src);
    assert.equal(run(["a", "b"], '["a","b","z"]'), true); assert.equal(run(["a", "b"], '["a"]'), false, "a new alert keeps it visible");
    assert.equal(run(["a"], null), false); assert.equal(run(["a"], "garbage"), false); assert.equal(run(["a"], "[]", true), false); assert.equal(run([], '["a"]'), false, "no alerts: nothing to hide");
  });

});

describe("follow-up: single-notice read, areas, publisher notices", () => {
  test("getPublicNotice uses get_public_notice; empty = not public; bad id never calls", async () => {
    const calls = []; globalThis.__FAKE_RPC__ = async (fn, a) => { calls.push([fn, a]); return { data: a.p_id.startsWith("1") ? [row({ id: a.p_id })] : [], error: null }; };
    const D = await import("../lib/notices-data.ts"); const id = "11111111-1111-1111-1111-111111111111";
    assert.equal((await D.getPublicNotice(id)).data.id, id); assert.equal((await D.getPublicNotice("22222222-2222-2222-2222-222222222222")).data, null); assert.equal((await D.getPublicNotice("x")).data, null);
    assert.deepEqual(calls.map((c) => c[0]), ["get_public_notice", "get_public_notice"]); delete globalThis.__FAKE_RPC__;
  });
  test("areas: the table is used (even when it has rows), the derived list is only for a failed read", async () => {
    const { setDb } = await import("./support/fake-supabase.mjs"); const D = await import("../lib/notices-data.ts");
    setDb({ areas: [{ id: "voe", name_display: "Voe", type: "settlement", parent_id: "x", sort_order: 1, is_active: true, is_physical: true }] });
    const o = await D.getAreaOptions([A.toNoticeCard(row({ area_ids: ["brae"], area_names: ["Brae"] }))]); assert.deepEqual(o.map((x) => x.id), ["voe"]); setDb({});
  });
  test("official notice states and the notify rule", () => {
    const now = new Date("2026-11-01T12:00:00Z"); const n = (o) => ({ id: "n", title: "t", body: "b", status: "published", is_essential: true, category: "other", starts_at: null, expires_at: "2026-11-02T00:00:00Z", review_at: null, published_at: null, action_text: null, link_url: null, area_ids: [], announced: false, ...o });
    assert.equal(A.officialNoticeState(n({}), now), "live"); assert.equal(A.officialNoticeState(n({ starts_at: "2026-11-01T18:00:00Z" }), now), "scheduled");
    assert.equal(A.officialNoticeState(n({ expires_at: "2026-11-01T12:00:00Z" }), now), "expired"); for (const st of ["resolved", "withdrawn"]) assert.equal(A.officialNoticeState(n({ status: st }), now), st);
    assert.equal(A.canOfferNotify(n({}), now), true); assert.equal(A.canOfferNotify(n({ announced: true }), now), false); assert.equal(A.canOfferNotify(n({ starts_at: "2026-11-01T18:00:00Z" }), now), false); assert.equal(A.canOfferNotify(n({ status: "withdrawn" }), now), false);
    assert.equal(A.canManageOfficial(n({})), true); assert.equal(A.canManageOfficial(n({ status: "resolved" })), false);
    assert.match(rd("app/notices/publish/page.tsx"), /my_official_notices/); assert.match(rd("components/notices/PublisherConsole.tsx"), /canOfferNotify\(n\)/);
  });
});

describe("follow-up: funeral edit flow and staff corrections", () => {
  const sub = { id: "f", status: "needs_info", review_message: "Please confirm the date", full_name: "Isobel", preferred_name: null, photo_url: null, born_on: "1941-02-14", died_on: "2026-10-27", announcement: "Peacefully", service_public: false,
    service_kind: "funeral", service_venue: "Kirk", service_at: null, service_notes: null, family_requests: null, donation_info: null, donation_url: null, area_id: "voe", announce_in_notifications: false, announce_name_in_preview: false,
    submitter_name: "Ann", submitter_relationship: null, submitter_phone: "07", submitter_email: null };
  test("pre-fill maps every editable field; blanks are empty strings", () => {
    const f = A.formFromSubmission(sub); assert.deepEqual([f.fullName, f.bornOn, f.diedOn, f.serviceVenue, f.publishArrangements, f.areaId, f.preferredName], ["Isobel", "1941-02-14", "2026-10-27", "Kirk", false, "voe", ""]);
    assert.deepEqual(A.validateFuneralEdit(f), {});
  });
  test("update payload clears blanks (\"\" not omitted) and drops arrangements unless published", () => {
    const f = A.formFromSubmission(sub); const p = A.buildFuneralUpdatePayload(f);
    assert.equal(p.preferred_name, ""); assert.equal(p.service_public, false); assert.equal(p.service_venue, "", "unpublished arrangements are cleared, not retained"); assert.equal(p.announce_name_in_preview, false);
    assert.ok(!("submitter_name" in p) && !("area_id" in p) && !("submitter_phone" in p));
    const on = A.buildFuneralUpdatePayload({ ...f, publishArrangements: true }); assert.equal(on.service_venue, "Kirk");
  });
  test("edit validation still enforces the rules that apply", () => { assert.ok(A.validateFuneralEdit({ ...A.formFromSubmission(sub), fullName: "" }).fullName); });
  test("pages and components: edit route, message for rejected, uses the RPCs", () => {
    assert.match(rd("app/notices/funeral/mine/[id]/page.tsx"), /my_funeral_submission/); assert.match(rd("components/notices/FuneralForms.tsx"), /update_my_funeral_submission/);
    assert.match(rd("components/notices/FuneralForms.tsx"), /needs_info" \|\| s\.status === "rejected"/); assert.ok(C.WRITE_RPCS.update_my_funeral_submission);
  });
  test("staff correction: only filled fields, service_at as an instant, null when empty", () => {
    assert.equal(A.buildCorrection({}), null); assert.equal(A.buildCorrection({ announcement: "  " }), null);
    const c = A.buildCorrection({ announcement: " New ", service_at: "2026-11-05T11:00", junk: "x", donation_info: "" }); assert.deepEqual(Object.keys(c).sort(), ["announcement", "service_at"]); assert.equal(c.announcement, "New"); assert.match(c.service_at, /^2026-11-05T/);
    assert.match(rd("components/admin/NoticesAdmin.tsx"), /p_correction: outcome === "actioned" && c\.kind === "correction" \? buildCorrection\(corr\)/);
  });
});

describe("funeral privacy: no-account contact, structured moderation, privacy tab", () => {
  const fake = () => { const calls = []; return { calls, rpc: async (fn, args) => { calls.push({ fn, args }); return { data: "req-1", error: null }; } }; };
  test("the enquiry client sends nothing until local checks and a security token are present, then posts ONLY to the Edge Function endpoint (never the database)", async () => {
    const F = await import("../lib/funeral-enquiry-client.ts");
    const calls = []; const ok = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
    const base = { id: "f", kind: "takedown", message: " Please remove this ", contact: " rel@family.example ", name: " R ", relationship: "", token: "tok" };
    assert.equal((await F.sendFuneralEnquiry({ ...base, message: "no" }, ok, "https://x.test/f")).code, "invalid_input");
    assert.equal((await F.sendFuneralEnquiry({ ...base, contact: "" }, ok, "https://x.test/f")).code, "invalid_input");
    assert.equal((await F.sendFuneralEnquiry({ ...base, token: null }, ok, "https://x.test/f")).code, "verification_required");
    assert.equal(calls.length, 0, "no request without a valid form and a token");
    const r = await F.sendFuneralEnquiry(base, ok, "https://x.test/functions/v1/submit-funeral-enquiry");
    assert.equal(r.ok, true); assert.equal(calls[0].url, "https://x.test/functions/v1/submit-funeral-enquiry");
    assert.deepEqual(JSON.parse(calls[0].init.body), { announcement_id: "f", kind: "takedown", message: "Please remove this", contact: "rel@family.example", contact_name: "R", turnstile_token: "tok" });
    assert.equal(F.enquiryEndpoint("https://abc.supabase.co/"), "https://abc.supabase.co/functions/v1/submit-funeral-enquiry");
  });
  test("every server refusal keeps the form, shows a safe message, and asks for the security check to be redone (the token is single use)", async () => {
    const F = await import("../lib/funeral-enquiry-client.ts");
    const base = { id: "f", kind: "enquiry", message: "A genuine question here", contact: "rel@family.example", token: "tok" };
    for (const [status, code] of [[400, "verification_failed"], [400, "verification_expired"], [429, "rate_limited"], [503, "verification_unavailable"], [404, "unknown_notice"]]) {
      const r = await F.sendFuneralEnquiry(base, async () => new Response(JSON.stringify({ ok: false, error: code, message: "Safe words.", retry_after: 60 }), { status }), "https://x.test/f");
      assert.deepEqual([r.ok, r.code, r.message, r.resetCheck, r.keepForm], [false, code, "Safe words.", true, true], code);
    }
    const net = await F.sendFuneralEnquiry(base, async () => { throw new TypeError("offline"); }, "https://x.test/f");
    assert.deepEqual([net.ok, net.code, net.resetCheck], [false, "network", true]);
    const junk = await F.sendFuneralEnquiry(base, async () => new Response("<html>", { status: 502 }), "https://x.test/f");
    assert.match(junk.message, /try again in a few minutes/);
  });
  test("the Turnstile script is Cloudflare's unless a LOOPBACK test address is given; any other override is ignored", async () => {
    const T = await import("../lib/turnstile.ts");
    const CF = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    assert.equal(T.turnstileScriptUrl(undefined), CF);
    for (const bad of ["https://evil.example/api.js", "http://evil.example/api.js", "http://127.0.0.1.evil.example/x.js", "javascript:alert(1)", "not a url", "https://localhost/x.js"]) assert.equal(T.turnstileScriptUrl(bad), CF, bad);
    assert.equal(T.turnstileScriptUrl("http://127.0.0.1:54800/__mock/turnstile.js"), "http://127.0.0.1:54800/__mock/turnstile.js");
  });
  test("the visitor can no longer reach the database function from the website: not in the allow-list, no server action, and the form uses the Edge Function client with Turnstile", () => {
    assert.ok(!("submit_funeral_enquiry" in C.WRITE_RPCS) && !("admin_log_funeral_enquiry" in C.READ_RPCS));
    assert.ok(!/sendFuneralEnquiry/.test(rd("app/notices/actions.ts")), "the old server action is gone");
    assert.ok(!/submit_funeral_enquiry/.test(strip(rd("components/notices/FuneralEnquiryForm.tsx"))) && !/submit_funeral_enquiry/.test(strip(rd("lib/funeral-enquiry-client.ts"))), "no website code names the database function");
    const form = rd("components/notices/FuneralEnquiryForm.tsx");
    assert.match(form, /<Turnstile[^>]*action=\{ENQUIRY_ACTION\}[^>]*cData=\{id\}/); assert.match(form, /disabled=\{busy \|\| !!problem \|\| !token\}/);
    assert.match(form, /check\.current\?\.reset\(\)/); assert.doesNotMatch(form, /setMessage\(""\)|setContact\(""\)/, "failures never clear what was typed");
    assert.doesNotMatch(strip(rd("lib/funeral-enquiry-client.ts")) + strip(form), /TURNSTILE_SECRET|siteverify/i, "no secret and no verification in the browser");
  });
  test("a moderation note cannot carry a telephone number or email address (mirrors the database)", () => {
    for (const t of ["Rang 01595 123456", "call +44 1595 123456", "email jo@family.example"]) assert.equal(C.noteHasContact(t), true, t);
    for (const t of ["Confirmed by the funeral director (ref 2026-17)", "", null, "Service on 12 November at 2pm"]) assert.equal(C.noteHasContact(t), false, String(t));
  });
  test("the structured moderation, resolve-with-authority, hold and redaction calls are allow-listed with exactly their parameters", () => {
    assert.deepEqual(C.WRITE_RPCS.admin_funeral_review, ["p_id", "p_action", "p_note", "p_verification_method", "p_verification_outcome", "p_followup", "p_rejection_code"]);
    assert.ok(C.WRITE_RPCS.admin_funeral_resolve_change.includes("p_authority_check"));
    for (const fn of ["admin_log_funeral_enquiry", "admin_set_funeral_retention_hold", "admin_redact_audit_text"]) assert.ok(C.WRITE_RPCS[fn], fn);
    assert.ok(!("delete_member_funeral_data" in C.WRITE_RPCS) && !("funeral_retention_run" in C.WRITE_RPCS) && !("delete_member_memberships" in C.WRITE_RPCS), "the service-role-only functions are never reachable from the website");
    assert.ok(C.READ_RPCS.admin_funeral_retention_report && C.READ_RPCS.admin_audit_redaction_candidates);
  });
  test("the contact page works signed out, links from the announcement, offers the existing support route, and the form is wired to the no-account action", () => {
    const page = rd("app/notices/funeral/[id]/contact/page.tsx"), detail = rd("app/notices/funeral/[id]/page.tsx"), form = rd("components/notices/FuneralEnquiryForm.tsx");
    assert.doesNotMatch(strip(page), /getAccount|sign-in/, "no account is required");
    assert.match(page, /Contact us about this announcement/); assert.match(page, /href="\/support"/); assert.doesNotMatch(strip(page), /@[a-z0-9-]+\.(com|co\.uk)/i, "no new address is invented");
    assert.match(detail, /\/contact`/); assert.match(detail, /Contact us about this announcement/);
    assert.match(form, /sendFuneralEnquiry/); assert.match(form, /honey|Leave this empty/); assert.match(form, /aria-hidden="true"/);
    assert.match(form, /Nothing has been changed yet/);
  });
  test("the moderation screen records the structured fields, guards notes, and requires an authority check for no-account requests; the privacy tab is read-only for retention", () => {
    const ui = strip(rd("components/admin/NoticesAdmin.tsx"));
    for (const t of ["p_verification_outcome", "p_followup", "p_rejection_code", "p_authority_check", "admin_log_funeral_enquiry", "admin_redact_audit_text"]) assert.ok(ui.includes(t), t);
    assert.match(ui, /noteHasContact/); assert.match(ui, /Nothing changes until you have checked who is asking/);
    assert.doesNotMatch(ui, /funeral_retention_run|admin_set_funeral_retention_enabled/, "the website cannot run or enable the retention job");
    assert.match(rd("app/admin/notices/page.tsx"), /\["privacy", "Privacy"\]/);
  });
  test("the privacy information states the funeral retention periods as ours (not statutory) and the funeral form links to it", () => {
    const priv = rd("app/privacy/page.tsx").replace(/\s+/g, " ");
    assert.match(priv, /id="funeral-announcements"/); assert.match(priv, /not set by law/); assert.match(priv, /90 days/); assert.match(priv, /30 days/); assert.match(priv, /12 months/);
    assert.doesNotMatch(priv, /UK GDPR (requires|mandates)[^.]*(90|30) days/);
    assert.match(rd("components/notices/FuneralForms.tsx"), /\/privacy#funeral-announcements/);
  });
});

describe("moderator-controlled member notice notifications (website)", () => {
  test("the notify call accepts the member kind, sends only the notice id and kind with the staff member's OWN token, and reports each outcome honestly", async () => {
    const calls = [];
    const f = (body, status = 200) => async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status }); };
    const ok = await R.callNotifyAudience({ baseUrl: "https://x.test/", accessToken: "tok", noticeId: "11111111-2222-4333-8444-555555555555", kind: "member", fetchImpl: f({ ok: true, sent: 5, held: 1, skipped: 2, failed: 1 }) });
    assert.equal(ok.ok, true); assert.match(ok.data.message, /5 sent, 1 held for quiet hours, 2 skipped.*1 failed/);
    assert.equal(calls[0].url, "https://x.test/functions/v1/notify-notice-audience"); assert.equal(calls[0].init.headers.authorization, "Bearer tok");
    assert.deepEqual(JSON.parse(calls[0].init.body), { notice_id: "11111111-2222-4333-8444-555555555555", kind: "member" }, "no recipient list, no text, no urgency is ever sent");
    assert.equal((await R.callNotifyAudience({ baseUrl: "https://x.test", accessToken: null, noticeId: "11111111-2222-4333-8444-555555555555", kind: "member", fetchImpl: f({}) })).ok, false);
    assert.equal((await R.callNotifyAudience({ baseUrl: "https://x.test", accessToken: "t", noticeId: "11111111-2222-4333-8444-555555555555", kind: "bogus", fetchImpl: f({}) })).ok, false);
    const forbidden = await R.callNotifyAudience({ baseUrl: "https://x.test", accessToken: "t", noticeId: "11111111-2222-4333-8444-555555555555", kind: "member", fetchImpl: f({ error: "Not allowed" }, 403) });
    assert.deepEqual([forbidden.ok, forbidden.error], [false, "Not allowed"]);
    const conflict = await R.callNotifyAudience({ baseUrl: "https://x.test", accessToken: "t", noticeId: "11111111-2222-4333-8444-555555555555", kind: "member", fetchImpl: f({ error: "Already announced" }, 409) });
    assert.equal(conflict.error, "Already announced");
  });
  test("approving and notifying are separate in the interface: approve never calls the notify action; notifying always goes through a preview with an explicit confirmation", () => {
    const ui = strip(rd("components/notices/MemberNotice.tsx"));
    const approve = ui.slice(ui.indexOf("export function PersonNoticeQueueRow"), ui.indexOf("export type PublishedRow"));
    assert.ok(!/notifyNoticeAudience/.test(approve), "the approve/decline row has no notify call");
    const pub = ui.slice(ui.indexOf("export function PublishedNoticeRow"));
    assert.match(pub, /noticeRead\("staff_member_notice_preview"/); assert.match(pub, /Check before sending/); assert.match(pub, /Estimated recipients/); assert.match(pub, /Only members who opted in to Community Notices/);
    assert.equal((pub.match(/notifyNoticeAudience\(/g) ?? []).length, 1, "exactly one call site: the confirm button");
    assert.match(pub, /disabled=\{send\.state\.busy \|\| !preview\.can_notify \|\| preview\.estimate < 1\}/); assert.match(pub, /Cancel/);
    assert.match(pub, /disabled=\{!r\.can_notify \|\| load\.state\.busy\}/, "the entry button is disabled for ineligible notices");
    assert.doesNotMatch(pub, /display_name|author|ExponentPushToken|user_id/, "no recipient or personal data is rendered");
    assert.match(rd("components/notices/MemberNotice.tsx"), /It never sends a notification/);
    assert.ok(C.READ_RPCS.staff_member_notice_preview && !("notify_notice_member" in C.WRITE_RPCS) && !Object.keys(C.WRITE_RPCS).some((k) => /notice_claim_dispatch|notice_member_reserve|notice_push_gate|notice_record_delivery/.test(k)), "no privileged dispatch function is reachable from the browser");
  });
  test("the moderation page lists published member notices from the staff-only database function", () => {
    const page = rd("app/notices/moderate/page.tsx");
    assert.match(page, /staff_published_person_notices/); assert.match(page, /Publishing never notifies anyone/); assert.match(page, /PublishedNoticeRow/);
  });
});
