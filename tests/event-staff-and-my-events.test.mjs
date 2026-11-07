/**
 * Staff event navigation + Community events screen rules + member "My events & submissions" entry.
 * Pure rules, the REAL gate helper against every kind of viewer, and rendered markup (react-dom/server) with the in-memory fake supabase.
 * Run: node --test --import ./tests/support/register.mjs tests/event-staff-and-my-events.test.mjs   (the JSX loader is registered by the file itself)
 */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import fake, { setDb, setViewer } from "./support/fake-supabase.mjs";
import {
  STAFF_EVENT_NAV, eventQueueBadges, adminNavActive, parseCommunityTab, tabStatus, cleanSearch, statusChip, shapeCommunityEvent, titleMatches,
  performanceStatusCall, eventStatusUpdate, performanceConfirm, eventConfirm, communityEventHref, submissionHref, STAFF_NO_NOTIFY_LINE, COMMUNITY_TABS,
} from "../lib/event-community-admin.ts";
import { myEventsEntryVisible, myEventsProps } from "../lib/event-front-door.ts";
import { MY_EVENTS_HREF, MY_EVENTS_LABEL, ADD_EVENT_HREF, ADD_EVENT_LABEL } from "../lib/event-entry-points.ts";
import { adminSetOccurrenceStatus, adminSetEventStatus } from "../lib/event-submissions-client.ts";
import { myEventsEntry, gateFeature } from "../lib/event-submissions-access.server.ts";

await import("./support/register-jsx.mjs");

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ORIGINAL = process.env.EVENT_FRONT_DOOR;
const flag = (v) => { if (v === undefined) delete process.env.EVENT_FRONT_DOOR; else process.env.EVENT_FRONT_DOOR = v; };
after(() => { flag(ORIGINAL); fake.auth.getUser = async () => ({ data: { user: null } }); delete globalThis.__FAKE_RPC__; delete globalThis.__PATH__; });
beforeEach(() => { flag(undefined); setViewer("anon"); setDb({ events: [] }); });
const count = (html, needle) => html.split(needle).length - 1;

/* ── pure: staff nav ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
describe("staff navigation rules", () => {
  test("three entries, in order, with badge keys on the two queues only", () => {
    assert.deepEqual(STAFF_EVENT_NAV.map((i) => i.label), ["Event submissions", "Change requests", "Community events"]);
    assert.deepEqual(STAFF_EVENT_NAV.map((i) => i.href), ["/admin/events/submissions", "/admin/events/changes", "/admin/events/community"]);
    assert.deepEqual(STAFF_EVENT_NAV.map((i) => i.badgeKey), ["pendingEventSubmissions", "pendingEventChanges", undefined]);
  });
  test("badge shaping is tolerant: missing / null / junk counts give no key (so no badge), real zeros stay zero", () => {
    assert.deepEqual(eventQueueBadges(null), {}); assert.deepEqual(eventQueueBadges(undefined), {}); assert.deepEqual(eventQueueBadges({ subs: null, changes: null }), {});
    assert.deepEqual(eventQueueBadges({ subs: { pending: 3 }, changes: null }), { pendingEventSubmissions: 3 });
    assert.deepEqual(eventQueueBadges({ subs: { pending: "3" }, changes: { pending: -1 } }), {});
    assert.deepEqual(eventQueueBadges({ subs: { pending: 0 }, changes: { pending: 2 } }), { pendingEventSubmissions: 0, pendingEventChanges: 2 });
    assert.equal("pendingEvents" in eventQueueBadges({ subs: { pending: 1 }, changes: { pending: 1 } }), false, "never touches the hub key");
  });
  test("the hub entry is current only on /admin/events itself; the others behave as before", () => {
    const hub = { href: "/admin/events", exact: true };
    assert.equal(adminNavActive("/admin/events", hub), true); assert.equal(adminNavActive("/admin/events/community", hub), false);
    assert.equal(adminNavActive("/admin/events/community", STAFF_EVENT_NAV[2]), true); assert.equal(adminNavActive("/admin/events/submissions", STAFF_EVENT_NAV[2]), false);
    assert.equal(adminNavActive("/admin/claims/1", { href: "/admin/claims" }), true); assert.equal(adminNavActive("/admin/x", { href: "/admin" }), false); assert.equal(adminNavActive("/admin", { href: "/admin" }), true);
  });
});

/* ── pure: community list ─────────────────────────────────────────────────────────────────────────────────────────────────── */
const NOW = Date.parse("2027-03-10T12:00:00Z");
const iso = (d, h = 19) => new Date(Date.UTC(2027, 2, d, h)).toISOString();
describe("community events shaping", () => {
  test("tabs, status filters and search cleaning", () => {
    assert.deepEqual(COMMUNITY_TABS.map((t) => t.tab), ["all", "live", "cancelled", "archived"]);
    assert.equal(parseCommunityTab("nonsense"), "all"); assert.equal(parseCommunityTab(undefined), "all"); assert.equal(parseCommunityTab("live"), "live");
    assert.deepEqual(["all", "live", "cancelled", "archived"].map(tabStatus), [null, "published", "cancelled", "archived"]);
    assert.equal(cleanSearch("  Panto %_ (x),\\ "), "Panto _ x"); assert.equal(cleanSearch(42), ""); assert.equal(cleanSearch("a".repeat(200)).length, 80);
    assert.ok(titleMatches("Cinderella Panto", "panto")); assert.ok(!titleMatches("Aladdin", "panto")); assert.ok(titleMatches("x", ""));
  });
  test("status chips", () => {
    assert.deepEqual(["published", "cancelled", "postponed", "archived", "draft", "weird", ""].map((s) => statusChip(s).label), ["Live", "Cancelled", "Postponed", "Archived", "Draft", "Weird", "Unknown"]);
    assert.equal(statusChip("cancelled").tone, "red"); assert.equal(statusChip("published").tone, "green");
  });
  const raw = (o = {}) => ({
    id: "e1", title: "Panto", status: "published", organiser_name: "Lerwick Drama Club", submission_id: "s1",
    occurrences: [{ id: "o3", starts_at: iso(20), ends_at: null, status: "scheduled" }, { id: "o1", starts_at: iso(5), status: "scheduled" }, { id: "o2", starts_at: iso(15), status: "cancelled", note: "Cast illness" }, { id: "bad", starts_at: "nope" }, null], ...o,
  });
  test("first and next live dates, performance statuses, organiser vs submitter, fallbacks", () => {
    const v = shapeCommunityEvent(raw(), "Ann Smith", NOW);
    assert.equal(v.count, 3); assert.equal(v.performances.map((p) => p.id).join(), "o1,o2,o3", "sorted, junk dropped");
    assert.match(v.first, /Fri 5 Mar 2027/); assert.match(v.next, /Sat 20 Mar 2027/, "next live skips the cancelled 15th");
    assert.equal(v.organiser, "Lerwick Drama Club"); assert.equal(v.submitter, "Ann Smith");
    assert.deepEqual(v.performances.map((p) => [p.statusLabel, p.past]), [["On", true], ["Cancelled", false], ["On", false]]);
    assert.equal(v.canCancelEvent, true); assert.equal(v.canRestoreEvent, false); assert.equal(v.publicHref, "/whats-on/e1");
    const bare = shapeCommunityEvent({ id: "e2", status: "cancelled" }, null, NOW);
    assert.equal(bare.submitter, "A member"); assert.equal(bare.next, null); assert.equal(bare.count, 0); assert.equal(bare.canRestoreEvent, true); assert.equal(bare.canCancelEvent, false);
    assert.equal(shapeCommunityEvent(null, "x", NOW), null); assert.equal(shapeCommunityEvent({}, "x", NOW), null);
  });
  test("archived / draft / postponed offer no whole-event action", () => {
    for (const s of ["archived", "draft", "postponed"]) { const v = shapeCommunityEvent(raw({ status: s }), "A", NOW); assert.equal(v.canCancelEvent || v.canRestoreEvent, false, s); }
  });
  test("action argument builders", () => {
    assert.deepEqual(performanceStatusCall("o1", "cancel"), { fn: "admin_set_occurrence_status", args: { p_occurrence: "o1", p_status: "cancelled", p_note: null } });
    assert.deepEqual(performanceStatusCall("o1", "restore").args, { p_occurrence: "o1", p_status: "scheduled", p_note: null });
    assert.deepEqual(eventStatusUpdate("cancel"), { set: { status: "cancelled" }, onlyIfStatus: "published" });
    assert.deepEqual(eventStatusUpdate("restore"), { set: { status: "published" }, onlyIfStatus: "cancelled" });
  });
  test("copy is accurate: no notification claim; whole-event cancel keeps the page up marked Cancelled", () => {
    const all = [performanceConfirm("cancel", "Sat"), performanceConfirm("restore", "Sat"), eventConfirm("cancel", "T"), eventConfirm("restore", "T")];
    for (const c of all) assert.doesNotMatch(c.body + c.success, /we('ll| will) (let|tell|notify|email)|people (are|will be) (told|notified)|refund/i);
    assert.match(STAFF_NO_NOTIFY_LINE, /does not send cancellation notifications/);
    assert.match(eventConfirm("cancel", "T").body, /stays up, clearly marked Cancelled/); assert.match(eventConfirm("cancel", "T").body, /off the lists and calendar/);
    assert.equal(eventConfirm("cancel", "T").danger, true); assert.equal(eventConfirm("restore", "T").danger, false);
  });
  test("links to a row and to the original submission", () => {
    assert.equal(communityEventHref("e1", "Cinderella Panto"), "/admin/events/community?q=Cinderella%20Panto#ev-e1");
    assert.equal(communityEventHref("e1", "%%"), "/admin/events/community#ev-e1"); assert.equal(submissionHref("s1"), "/admin/events/submissions?status=approved#sub-s1");
  });
});

/* ── client functions with a recording fake ───────────────────────────────────────────────────────────────────────────────── */
describe("staff cancel / restore calls", () => {
  const sbWith = ({ rpc, rows = [], error = null, status } = {}) => {
    const calls = { rpc: [], update: null, eq: [] };
    const chain = { update(v) { calls.update = v; return chain; }, eq(c, v) { calls.eq.push([c, v]); return chain; }, select() { return chain; }, then(res) { return Promise.resolve({ data: rows, error, status }).then(res); } };
    return { calls, sb: { rpc: async (fn, a) => { calls.rpc.push([fn, a]); return rpc ? rpc() : { data: { id: "o1", status: a.p_status }, error: null }; }, from: () => chain } };
  };
  test("performance: the exact RPC; success; missing function = calm 'unavailable'; forbidden is passed on", async () => {
    let t = sbWith(); const r = await adminSetOccurrenceStatus(t.sb, "o1", "cancelled");
    assert.deepEqual(t.calls.rpc, [["admin_set_occurrence_status", { p_occurrence: "o1", p_status: "cancelled", p_note: null }]]); assert.equal(r.ok, true);
    t = sbWith({ rpc: () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" }, status: 404 }) });
    assert.equal((await adminSetOccurrenceStatus(t.sb, "o1", "scheduled")).error.kind, "unavailable");
    t = sbWith({ rpc: () => ({ data: null, error: { code: "42501", message: "Only OneShetland staff can do this" } }) });
    const f = await adminSetOccurrenceStatus(t.sb, "o1", "cancelled"); assert.equal(f.ok, false); assert.equal(f.error.kind, "forbidden");
    t = sbWith({ rpc: () => { throw new Error("Failed to fetch"); } }); assert.equal((await adminSetOccurrenceStatus(t.sb, "o1", "cancelled")).error.kind, "network");
  });
  test("whole event: updates status only, from the state shown; zero rows is reported honestly (not success)", async () => {
    let t = sbWith({ rows: [{ id: "e1", status: "cancelled" }] }); let r = await adminSetEventStatus(t.sb, "e1", "cancelled");
    assert.deepEqual(t.calls.update, { status: "cancelled" }); assert.deepEqual(t.calls.eq, [["id", "e1"], ["status", "published"]]); assert.equal(r.ok, true);
    t = sbWith({ rows: [{ id: "e1", status: "published" }] }); r = await adminSetEventStatus(t.sb, "e1", "published"); assert.deepEqual(t.calls.eq, [["id", "e1"], ["status", "cancelled"]]); assert.equal(r.ok, true);
    t = sbWith({ rows: [] }); r = await adminSetEventStatus(t.sb, "e1", "cancelled"); assert.equal(r.ok, false); assert.match(r.error.message, /Nothing was changed/);
    t = sbWith({ error: { code: "42501", message: "permission denied for table events" } }); r = await adminSetEventStatus(t.sb, "e1", "cancelled"); assert.equal(r.ok, false);
  });
});

/* ── gate helper against every viewer ─────────────────────────────────────────────────────────────────────────────────────── */
const ADMIN = { id: "a-1", email: "darren@oneshetland.example" }, MEMBER = { id: "m-1", email: "member@example.org" }, TESTER = { id: "t-1", email: "tester@example.org" };
function as(user, { testerIds = [], rpc } = {}) {
  setDb({ profiles: [{ id: ADMIN.id, role: "admin" }, { id: MEMBER.id, role: "customer" }, { id: TESTER.id, role: "customer" }] });
  fake.auth.getUser = async () => ({ data: { user } });
  globalThis.__FAKE_RPC__ = async (fn) => (rpc ? rpc(fn) : fn === "event_submissions_tester" ? { data: testerIds.includes(user?.id), error: null } : { data: null, error: null });
}
const opens = async () => { try { await gateFeature(); return true; } catch { return false; } };

describe("My events & submissions visibility", () => {
  test("pure rule: flag x admin x tester", () => {
    assert.equal(myEventsEntryVisible({ flag: "on", isStaff: false }), true);
    assert.equal(myEventsEntryVisible({ flag: undefined, isStaff: true }), true);
    assert.equal(myEventsEntryVisible({ flag: undefined, isStaff: false, isTester: true }), true);
    for (const f of [undefined, null, "", "off", "ON", "true", "testers"]) assert.equal(myEventsEntryVisible({ flag: f, isStaff: false }), false, String(f));
    assert.deepEqual(myEventsProps(false), {}); assert.deepEqual(myEventsProps(true), { myEvents: true });
  });
  const cases = [
    ["flag off, signed out", undefined, null, {}, false], ["flag off, ordinary member", undefined, MEMBER, {}, false], ["flag off, tester", undefined, TESTER, { testerIds: [TESTER.id] }, true],
    ["flag off, admin", undefined, ADMIN, {}, true], ["flag on, member", "on", MEMBER, {}, true], ["flag on, admin", "on", ADMIN, {}, true], ["flag on, signed out", "on", null, {}, false],
    ["flag off, tester function missing", undefined, MEMBER, { rpc: () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" }, status: 404 }) }, false],
    ["flag off, tester function throws", undefined, MEMBER, { rpc: () => { throw new Error("down"); } }, false],
  ];
  for (const [name, f, user, opts, want] of cases) {
    test(`${name}: entry ${want ? "present" : "absent"}`, async () => {
      flag(f); as(user, opts); const got = await myEventsEntry();
      assert.deepEqual(got, want ? { myEvents: true } : {});
      if (user) assert.equal(await opens(), want, "the link appears exactly when the page itself opens (never a 404)");
    });
  }
});

/* ── rendering ────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
describe("account sidebar and overview", async () => {
  const { AccountSidebar } = await import("../components/account/AccountSidebar.tsx");
  const side = (props) => renderToStaticMarkup(h(AccountSidebar, { isAdmin: false, isBusiness: false, ...props }));
  const LINK = /<a href="\/account\/event-submissions"[^>]*>.*?<\/a>/;
  test("absent without the prop and with false: identical to today", () => {
    const base = side({}); assert.equal(count(base, "event-submissions"), 0); assert.equal(side({ myEvents: false }), base); assert.equal(count(base, MY_EVENTS_LABEL.replace("&", "&amp;")), 0);
  });
  test("present exactly once when passed; everything else byte-identical; sits after Hubs I manage", () => {
    const base = side({}), on = side({ myEvents: true });
    assert.equal(count(on, `href="${MY_EVENTS_HREF}"`), 1); assert.equal(on.replace(LINK, ""), base);
    assert.ok(on.indexOf("Hubs I manage") < on.indexOf("My events &amp; submissions"));
  });
  test("with the Add entry as well: Hubs, Add, then My events", () => {
    const html = side({ addEvent: true, myEvents: true });
    assert.equal(count(html, `href="${ADD_EVENT_HREF}"`), 1); assert.equal(count(html, `href="${MY_EVENTS_HREF}"`), 1);
    assert.ok(html.indexOf("Hubs I manage") < html.indexOf(ADD_EVENT_LABEL) && html.indexOf(ADD_EVENT_LABEL) < html.indexOf("My events &amp; submissions"));
    assert.equal(html.replace(LINK, ""), side({ addEvent: true }));
  });
  test("layout hands the prop through myEventsEntry() only", () => {
    const src = read("app/account/layout.tsx"); assert.match(src, /const myEvents = await myEventsEntry\(\)/); assert.match(src, /\{\.\.\.entryPointProps\(\)\} \{\.\.\.myEvents\}/);
  });
  test("overview (rendered): ordinary member + flag off = today's page; tester / admin / flag on = exactly one extra card", async () => {
    const overview = (await import("../app/account/page.tsx")).default;
    const render = async (user, opts = {}) => { as(user, opts); fake.auth.getUser = async () => ({ data: { user } }); return renderToStaticMarkup(await overview()); };
    const off = await render(MEMBER);
    assert.equal(count(off, "event-submissions"), 0); assert.doesNotMatch(off, /My events &amp; submissions/);
    for (const [label, f, u, o] of [["tester", undefined, TESTER, { testerIds: [TESTER.id] }], ["admin", undefined, ADMIN, {}]]) {
      flag(f); const on = await render(u, o);
      assert.equal(count(on, `href="${MY_EVENTS_HREF}"`), 1, label); assert.equal(count(on, "My events &amp; submissions"), 1, label);
      assert.equal(on.replace(/<a href="\/account\/event-submissions"[^>]*>.*?<\/a>/, "").replace(/\s+/g, " ").length > 0, true);
    }
    flag("on"); const onFlag = await render(MEMBER); assert.equal(count(onFlag, `href="${MY_EVENTS_HREF}"`), 1);
    assert.equal(count(onFlag, `href="${ADD_EVENT_HREF}"`), 1, "the Add card is unchanged and still flag-only");
    flag(undefined); const adminOff = await render(ADMIN); assert.equal(count(adminOff, `href="${ADD_EVENT_HREF}"`), 0, "Add card stays hidden for an admin while the flag is off");
  });
});

describe("admin sidebar", async () => {
  const { AdminSidebar } = await import("../components/admin/AdminSidebar.tsx");
  const side = (badges, path = "/admin") => { globalThis.__PATH__ = path; return renderToStaticMarkup(h(AdminSidebar, { badges })); };
  test("the three entries appear once each, after Event approvals, with the right badges; the hub badge is unchanged", () => {
    const html = side({ pendingEvents: 4, pendingEventSubmissions: 2, pendingEventChanges: 1 });
    for (const l of ["Event approvals", "Event submissions", "Change requests", "Community events"]) assert.equal(count(html, `<span>${l}</span>`), 1, l);
    const entry = (label) => new RegExp(`<a href="[^"]*"[^>]*><span>${label}</span>(<span[^>]*>(\\d+)</span>)?</a>`).exec(html);
    assert.equal(entry("Event approvals")[2], "4"); assert.equal(entry("Event submissions")[2], "2"); assert.equal(entry("Change requests")[2], "1"); assert.equal(entry("Community events")[2], undefined);
    assert.ok(html.indexOf("Event approvals") < html.indexOf("Event submissions") && html.indexOf("Event submissions") < html.indexOf("Change requests") && html.indexOf("Change requests") < html.indexOf("Community events"));
  });
  test("no counts from the community functions = no badges on the new entries, and the hub badge still shows", () => {
    const html = side({ pendingEvents: 3 }); const m = (l) => new RegExp(`<span>${l}</span>(<span[^>]*>\\d+</span>)?`).exec(html)[1];
    assert.equal(m("Event submissions"), undefined); assert.equal(m("Change requests"), undefined); assert.ok(m("Event approvals"));
  });
  test("a zero count shows no badge", () => { assert.doesNotMatch(side({ pendingEventSubmissions: 0 }), /<span>Event submissions<\/span><span/); });
  test("only the matching entry is highlighted on a community page (the hub entry is not lit as well)", () => {
    const active = (html) => [...html.matchAll(/<a href="([^"]+)" class="[^"]*bg-rose-600[^"]*"/g)].map((x) => x[1]);
    assert.deepEqual(active(side({}, "/admin/events/community")), ["/admin/events/community"]);
    assert.deepEqual(active(side({}, "/admin/events")), ["/admin/events"]);
    assert.deepEqual(active(side({}, "/admin/events/submissions")), ["/admin/events/submissions"]);
  });
  test("layout feeds the new badges through eventQueueBadgeCounts and leaves the existing keys alone", () => {
    const src = read("app/admin/layout.tsx"); assert.match(src, /pendingEvents: stats\.pendingEvents/); assert.match(src, /\.\.\.\(await eventQueueBadgeCounts\(\)\)/);
  });
});

describe("admin dashboard", async () => {
  test("lists the two queues with counts and Community events as a tool; unavailable counts show a dash, not a crash", async () => {
    const Page = (await import("../app/admin/page.tsx")).default;
    setViewer("admin"); fake.auth.getUser = async () => ({ data: { user: ADMIN } }); setDb({ profiles: [{ id: ADMIN.id, role: "admin" }] });
    globalThis.__FAKE_RPC__ = async (fn) => (fn === "admin_event_submission_counts" ? { data: { pending: 3, changes_requested: 0, oldest_pending_at: null }, error: null } : fn === "admin_event_change_counts" ? { data: { pending: 2, auto_approved_7d: 0 }, error: null } : { data: null, error: null });
    let html = renderToStaticMarkup(await Page());
    const card = (l) => new RegExp(`<span class="[^"]*">(?:<span[^>]*>)?([^<]*)(?:</span>)?</span><div class="min-w-0 flex-1"><p class="[^"]*">${l}</p>`).exec(html)?.[1];
    assert.equal(card("Event submissions"), "3"); assert.equal(card("Change requests"), "2"); assert.equal(count(html, ">Community events<"), 1); assert.ok(html.includes('href="/admin/events/community"'));
    assert.equal(count(html, "Event approvals"), 1);
    globalThis.__FAKE_RPC__ = async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" }, status: 404 });
    html = renderToStaticMarkup(await Page()); assert.equal(card("Event submissions"), "–"); assert.ok(html.includes("Event approvals"));
  });
});

describe("community events loader", async () => {
  const { loadCommunityEvents } = await import("../lib/event-submissions-admin.server.ts");
  const ev = (id, o = {}) => ({ id, title: `Event ${id}`, status: "published", is_hidden: false, source: "community_submission", organiser_name: "Club", submission_id: `s-${id}`, created_at: `2027-01-0${id}T10:00:00Z`, occurrences: [{ id: `o${id}`, starts_at: iso(20), status: "scheduled" }], ...o });
  test("source filter, tabs, search, newest first, hidden rows included, submitter names from the linked submission", async () => {
    setViewer("admin");
    setDb({
      events: [ev("1"), ev("2", { status: "cancelled", is_hidden: true }), ev("3", { status: "archived", is_hidden: true, title: "Old Panto" }), ev("4", { source: "oneshetland" }), ev("5", { source: null })],
      event_submissions: [{ id: "s-1", submitter_id: "u1" }, { id: "s-2", submitter_id: "u2" }],
      profiles: [{ id: "u1", display_name: "Ann Smith", full_name: null }],
    });
    let r = await loadCommunityEvents("all", ""); assert.equal(r.ok, true);
    assert.deepEqual(r.data.map((e) => e.id), ["3", "2", "1"], "community only, newest first, hidden ones included");
    assert.equal(r.data.find((e) => e.id === "1").submitter, "Ann Smith"); assert.equal(r.data.find((e) => e.id === "2").submitter, "A member", "no profile name -> fallback");
    assert.deepEqual((await loadCommunityEvents("live", "")).data.map((e) => e.id), ["1"]); assert.deepEqual((await loadCommunityEvents("cancelled", "")).data.map((e) => e.id), ["2"]);
    assert.deepEqual((await loadCommunityEvents("archived", "")).data.map((e) => e.id), ["3"]); assert.deepEqual((await loadCommunityEvents("all", "panto")).data.map((e) => e.id), ["3"]);
  });
  test("a read error is a calm error result, not a throw", async () => {
    setViewer("admin"); globalThis.__FAKE_SELECT_GUARD__ = () => ({ code: "42P01", message: "relation does not exist" });
    try { const r = await loadCommunityEvents("all", ""); assert.equal(r.ok, false); assert.equal(r.error.kind, "unavailable"); } finally { delete globalThis.__FAKE_SELECT_GUARD__; }
  });
});

describe("community events screen markup", async () => {
  const { CommunityEventsList } = await import("../components/admin/CommunityEventsList.tsx");
  const { ConfirmProvider } = await import("../components/ui/ConfirmProvider.tsx");
  const items = [
    shapeCommunityEvent({ id: "e1", title: "Panto", status: "published", organiser_name: "Drama Club", submission_id: "s1", occurrences: [{ id: "o1", starts_at: iso(20), status: "scheduled" }, { id: "o2", starts_at: iso(21), status: "cancelled" }] }, "Ann", NOW),
    shapeCommunityEvent({ id: "e2", title: "Choir", status: "cancelled", organiser_name: "Choir", submission_id: null, occurrences: [] }, null, NOW),
  ];
  const html = renderToStaticMarkup(h(ConfirmProvider, null, h(CommunityEventsList, { items, emptyText: "Nothing" })));
  test("each row: title, chip, public credit, submitter, dates, links and the right whole-event action", () => {
    for (const t of ["Panto", "Live", "Shown to the public as: ", "Drama Club", "Sent in by: ", "Ann", "A member", "2 dates and their status", "View public page", "View original submission", "Cancel the whole event", "Put the whole event back on"]) assert.ok(html.includes(t), t);
    assert.ok(html.includes('href="/whats-on/e1"') && html.includes('href="/admin/events/submissions?status=approved#sub-s1"'));
    assert.equal(count(html, "View original submission"), 1, "none for a row with no linked submission");
    assert.ok(html.includes('id="ev-e1"') && html.includes('id="ev-e2"')); assert.ok(html.includes("Cancel this date") && html.includes("Put this date back on"));
  });
  test("no notification promise anywhere on the screen", () => { assert.doesNotMatch(html, /notif|we('ll| will) (let|tell|email)/i); });
  test("every action control is a button with an accessible name carrying the target", () => { assert.match(html, /Cancel this date<span class="sr-only">: /); assert.match(html, /Cancel the whole event<span class="sr-only">: Panto/); });
});
