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
  test("area names: none = Shetland-wide, two shown, then +N", () => {
    assert.equal(A.areaSummary([]), "Shetland-wide"); assert.equal(A.areaSummary(["Voe", "Brae"]), "Voe, Brae"); assert.equal(A.areaSummary(["Voe", "Brae", "Delting", "Lerwick"]), "Voe, Brae +2");
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
  test("revoke needs a reason; approve needs method AND note; enabling an import needs a reuse note", async () => {
    const sb = mk({ data: 1, error: null });
    assert.equal((await C.revokeEssential(sb, "p", "  ")).ok, false); assert.equal((await C.approveFuneral(sb, "f", "", "note")).ok, false); assert.equal((await C.approveFuneral(sb, "f", "in_person", " ")).ok, false);
    assert.equal((await C.enableImportSource(sb, "s", "short")).ok, false); assert.equal(sb.calls.length, 0);
    assert.equal((await C.approveFuneral(sb, "f", "in_person", "rang family")).ok, true); assert.deepEqual(sb.calls[0].args, { p_id: "f", p_action: "approve", p_note: "rang family", p_verification_method: "in_person" });
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
  test("component: ONE compact strip linking to the alert (or the essential list when several); no body, what-to-do or source detail", () => {
    const src = rd("components/notices/EssentialAlertSlot.tsx");
    assert.match(src, /\/notices\?tab=essential/); assert.match(src, /\/notices\/\$\{a\.id\}/); assert.match(src, /plan\.count\} active/);
    assert.equal((src.match(/<Link /g) ?? []).length, 1, "a single strip, never a stack");
    assert.doesNotMatch(src, /a\.body|actionText|attribution|plan\.others\.map/);
  });
  test("component: the icon is a SOLID exclamation (not a hairline stroke), and the strip is one accessible link with a built name", () => {
    const src = rd("components/notices/EssentialAlertSlot.tsx");
    assert.match(src, /<svg[^>]*fill="currentColor"[^>]*><rect[^>]*\/><circle[^>]*\/><\/svg>/, "bar + dot, filled");
    assert.doesNotMatch(src, /M12 5v9M12 19v\.5/, "the old hairline glyph that read as a white disc is gone");
    assert.match(src, /aria-label=\{name\}/); assert.match(src, /Opens all essential alerts/); assert.match(src, /Opens the full alert/); assert.match(src, /Essential alert, \$\{plan\.count\} active/);
    assert.equal((src.match(/aria-hidden/g) ?? []).length, 3, "icon, text and chevron are hidden: the name covers them");
    assert.match(src, /focus-visible:outline-white/); assert.match(src, /line-clamp-2/); assert.doesNotMatch(src.match(/<Link [^>]*>/)[0], /\sh-(\d|\[)/, "no fixed height on the link");
    assert.match(src, /min-h-\[44px\]/);
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
