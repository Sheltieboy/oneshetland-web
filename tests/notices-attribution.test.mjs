/**
 * Notices Stage 3A.2 (website) - the right publisher on every notice, and no public reader trusts RLS alone.
 *
 * The REAL readers (getHomeData -> notices, getLocalFeed -> notices, getHubNotices) run over fixture notices in the in-memory Supabase fake,
 * which EXECUTES the filters they build. The fake deliberately does NOT mimic the notices RLS policy, so a non-public fixture can only
 * be missing from the output because the READER filtered it: that is what these tests prove. A person's name comes only from the fake
 * notice_publisher_display RPC, which (like the database) releases it for approved, public notices only.
 *
 * SAFETY: no network, no Supabase project, no notification. Fixtures only.
 * Run: node --test --import ./tests/support/register.mjs tests/notices-attribution.test.mjs
 */
import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { setDb } from "./support/fake-supabase.mjs";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const rd = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const sha = (p) => createHash("sha256").update(rd(p)).digest("hex");

// The shared helper files are byte-pinned: the app repo (and the edge copy) hold the identical files, and its tests pin the same hashes.
const PINNED = {
  "lib/notice-publisher.ts": "21ce1afc4438948ce6e529b161180871ccee74f51e12afe5a5d9904b3376120c",
  "lib/notice-feed.ts": "40859ef8e8a0d0b326652efa189cb3364e11f28e4c00cda4d31d3e9b4d9388f7",
};

const HUB = { id: "hub-1", name: "Voe Hall", logo_url: "https://img/hub.png", brand_color: "#336699", slug: "voe-hall" };
const BIZ = { id: "biz-1", name: "Bea Bakery", logo_url: "https://img/biz.png", brand_color: "#aa5500", slug: "bea-bakery" };
let k = 0;
const n = (title, extra = {}) => ({
  id: `n-${++k}`, title, body: "body", severity: "community", locality: null, visibility: "public", is_hidden: false, is_pinned: false,
  status: "published", starts_at: null, expires_at: null, published_at: `2026-10-${String(10 + k).padStart(2, "0")}T10:00:00Z`,
  publisher_kind: "hub", publisher_hub_id: "hub-1", publisher_business_id: null, publisher_user_id: null, is_platform_notice: false, is_person_notice: false,
  source: null, source_label: null, source_url: null, campaign_id: null, event_id: null, hub: HUB, business: null, ...extra,
});
// public + eligible
const E = {
  hub: n("Hall closed", { published_at: "2026-10-30T10:00:00Z" }),
  biz: n("Bakery sale", { publisher_kind: "business", publisher_hub_id: null, publisher_business_id: "biz-1", hub: null, business: BIZ, published_at: "2026-10-29T10:00:00Z" }),
  person: n("Lost cat", { publisher_kind: "person", is_person_notice: true, publisher_hub_id: null, publisher_user_id: "u-ann", hub: null, published_at: "2026-10-28T10:00:00Z" }),
  noname: n("Found keys", { publisher_kind: "person", is_person_notice: true, publisher_hub_id: null, publisher_user_id: "u-x", hub: null, published_at: "2026-10-27T10:00:00Z" }),
  former: n("Old notice", { publisher_kind: "person", is_person_notice: true, publisher_hub_id: null, publisher_user_id: null, hub: null, published_at: "2026-10-26T10:00:00Z" }),
  plat: n("Welcome", { publisher_kind: "platform", is_platform_notice: true, publisher_hub_id: null, hub: null, severity: "info", published_at: "2026-10-25T10:00:00Z" }),
  nhs: n("Prescription system", { publisher_kind: "platform", is_platform_notice: true, publisher_hub_id: null, hub: null, source: "nhs_shetland", source_label: "NHS Shetland", source_url: "https://nhs.example/a", severity: "urgent", expires_at: "2026-11-05T00:00:00Z", published_at: "2026-10-31T10:00:00Z" }),
  event: n("New event", { event_id: "ev1", published_at: "2026-10-24T10:00:00Z" }),
  fund: n("Fundraiser", { campaign_id: "camp1", published_at: "2026-10-23T10:00:00Z" }),
};
// public rows that must NEVER be shown (all newer than the eligible ones, so they would dominate an unfiltered feed)
const NP = {
  pending: n("pending", { status: "pending", published_at: "2026-10-31T11:00:00Z" }),
  withdrawn: n("withdrawn", { status: "withdrawn", published_at: "2026-10-31T11:01:00Z" }),
  resolved: n("resolved", { status: "resolved", published_at: "2026-10-31T11:02:00Z" }),
  scheduled: n("scheduled", { starts_at: "2026-11-03T00:00:00Z", published_at: "2026-10-31T11:03:00Z" }),
  notStarted: n("not started", { starts_at: "2026-11-01T12:00:00.001Z", published_at: "2026-10-31T11:04:00Z" }),
  hidden: n("hidden", { is_hidden: true, published_at: "2026-10-31T11:05:00Z" }),
  expired: n("expired", { expires_at: "2026-11-01T12:00:00Z", published_at: "2026-10-31T11:06:00Z" }),   // expires AT now = no longer live
  personPending: n("person pending", { publisher_kind: "person", is_person_notice: true, publisher_hub_id: null, publisher_user_id: "u-ann", hub: null, status: "pending", published_at: "2026-10-31T11:07:00Z" }),
};
const ALL = [...Object.values(NP), ...Object.values(E)];

// like notice_publisher_display: the name is released only for an approved public notice
const APPROVED = { [E.person.id]: "Ann" };
const rpcCalls = [];
let home, feed, hubs;
before(async () => {
  mock.timers.enable({ apis: ["Date"], now: NOW });
  setDb({ notices: ALL });
  globalThis.__FAKE_RPC__ = async (fn, args) => { rpcCalls.push({ fn, args }); return { data: { label: APPROVED[args.p_notice] ?? "A OneShetland member" }, error: null }; };
  home = await import("../lib/home-data.ts");
  feed = await import("../lib/local-data.ts");
  hubs = await import("../lib/hubs-data.ts");
});
after(() => { mock.timers.reset(); delete globalThis.__FAKE_RPC__; });

const idsOf = (rows) => rows.map((r) => r.id);

describe("shared helper files are the approved ones", () => {
  test("byte-pinned to the app repo's copies", () => { for (const [f, h] of Object.entries(PINNED)) assert.equal(sha(f), h, f); });
  test("when the app worktree is alongside, the files are identical to it", () => {
    for (const f of Object.keys(PINNED)) {
      const other = new URL("../../oneshetland-notices-stage2/" + f, import.meta.url);
      if (existsSync(other)) assert.equal(readFileSync(other, "utf8"), rd(f), f);
    }
  });
});

describe("home page notices (getHomeData)", () => {
  let notices;
  before(async () => { notices = (await home.getHomeData()).notices; });
  test("only published, started, unexpired notices appear - pending, withdrawn, resolved, scheduled, not-yet-started, hidden and expired never do", () => {
    const got = idsOf(notices);
    for (const [name, row] of Object.entries(NP)) assert.ok(!got.includes(row.id), name + " must not be shown");
    assert.ok(got.length > 0 && got.every((id) => Object.values(E).some((e) => e.id === id)));
  });
  test("boundaries: a notice expiring AT now is gone; one starting a millisecond from now is not shown yet", () => {
    assert.ok(!idsOf(notices).includes(NP.expired.id)); assert.ok(!idsOf(notices).includes(NP.notStarted.id));
  });
  test("every publisher kind is attributed correctly, with branding and the existing destination", () => {
    const by = Object.fromEntries(notices.map((x) => [x.id, x]));
    const h = by[E.hub.id]; assert.deepEqual([h.publisher, h.attribution.byline, h.logo_url, h.brand_color, h.href], ["Voe Hall", "Posted by Voe Hall", "https://img/hub.png", "#336699", "/hubs/voe-hall"]);
    const b = by[E.biz.id]; assert.deepEqual([b.publisher, b.attribution.byline, b.logo_url, b.href], ["Bea Bakery", "Posted by Bea Bakery", "https://img/biz.png", "/directory/bea-bakery"]);
    const p = by[E.person.id]; assert.deepEqual([p.publisher, p.attribution.byline, p.attribution.destination], ["Ann", "Posted by Ann", null]);
    if (by[E.noname.id]) assert.equal(by[E.noname.id].publisher, "A OneShetland member");
    if (by[E.former.id]) assert.equal(by[E.former.id].publisher, "Former member");
    const nhs = by[E.nhs.id]; assert.deepEqual([nhs.publisher, nhs.attribution.byline, nhs.attribution.source_url, nhs.attribution.is_official_source], ["NHS Shetland", "Source: NHS Shetland", "https://nhs.example/a", true]);
    assert.ok(notices.every((x) => x.publisher !== "Member"));
  });
  test("event-generated and fundraiser-generated notices stay attributed to their hub and keep their own destinations", () => {
    const by = Object.fromEntries(notices.map((x) => [x.id, x]));
    if (by[E.event.id]) assert.deepEqual([by[E.event.id].publisher, by[E.event.id].href], ["Voe Hall", "/whats-on/ev1"]);
    if (by[E.fund.id]) assert.deepEqual([by[E.fund.id].publisher, by[E.fund.id].href], ["Voe Hall", "/hubs/campaign/camp1"]);
  });
  test("names come only from the notice_publisher_display RPC, and only for person notices that still have an author", () => {
    const mine = rpcCalls.filter((c) => c.fn === "notice_publisher_display");   // (other home-page RPCs are unrelated)
    assert.ok(mine.length > 0, "the attribution RPC was used");
    const asked = new Set(mine.map((c) => c.args.p_notice));
    assert.ok(asked.has(E.person.id) && asked.has(E.noname.id));
    assert.ok(!asked.has(E.hub.id) && !asked.has(E.biz.id) && !asked.has(E.plat.id) && !asked.has(E.nhs.id) && !asked.has(E.former.id));
  });
});

describe("local page feed (getLocalFeed)", () => {
  let notices;
  before(async () => { notices = (await feed.getLocalFeed()).notices; });
  test("the four newest ELIGIBLE public notices, never a newer non-public one", () => {
    assert.equal(notices.length, 4);
    for (const row of Object.values(NP)) assert.ok(!idsOf(notices).includes(row.id), row.title);
    assert.deepEqual(idsOf(notices), [E.nhs.id, E.hub.id, E.biz.id, E.person.id]);
  });
  test("each carries its attribution (the urgent chip uses it)", () => {
    const by = Object.fromEntries(notices.map((x) => [x.id, x.attribution]));
    assert.deepEqual([by[E.nhs.id].byline, by[E.hub.id].label, by[E.biz.id].label, by[E.person.id].label], ["Source: NHS Shetland", "Voe Hall", "Bea Bakery", "Ann"]);
    assert.ok(notices.every((x) => x.attribution.label !== "Member"));
  });
});

describe("hub page notices (getHubNotices)", () => {
  test("published, started and unexpired only; visibility is left to row-level security (a members-only notice is not filtered out here)", async () => {
    setDb({ notices: [...ALL, n("Members only", { visibility: "members", published_at: "2026-10-22T10:00:00Z" })] });
    const rows = await hubs.getHubNotices("hub-1");
    for (const row of Object.values(NP)) assert.ok(!idsOf(rows).includes(row.id), row.title);
    assert.ok(rows.some((r) => r.visibility === "members")); assert.ok(idsOf(rows).includes(E.hub.id)); assert.ok(idsOf(rows).includes(E.event.id));
    setDb({ notices: ALL });
  });
});

describe("contract: screens use the attribution; nothing falls back to Member", () => {
  test("home, local feed and sections use the shared attribution", () => {
    assert.match(rd("lib/home-data.ts"), /attributionFor\(/); assert.match(rd("lib/local-data.ts"), /attributionFor\(/);
    assert.match(rd("components/home/HomeSections.tsx"), /n\.attribution\.is_official_source \? n\.attribution\.byline : n\.attribution\.label/);
    assert.match(rd("components/home/HomeSections.tsx"), /View at source/); assert.match(rd("app/local/page.tsx"), /n\.attribution\.is_official_source/);
  });
  test("no notice code uses the literal \"Member\" or the old join-derived chain", () => {
    for (const f of ["lib/home-data.ts", "lib/local-data.ts", "lib/notice-publisher.ts", "lib/notice-feed.ts"]) {
      const src = rd(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      assert.doesNotMatch(src, /"Member"/, f); assert.doesNotMatch(src, /hub\?\.name \?\? business\?\.name/, f);
    }
  });
  test("every public notice reader applies the shared filters", () => {
    assert.equal((rd("lib/home-data.ts").match(/applyPublicNoticeFilters\(/g) ?? []).length, 1);
    assert.equal((rd("lib/local-data.ts").match(/applyPublicNoticeFilters\(/g) ?? []).length, 1);
    assert.equal((rd("lib/hubs-data.ts").match(/applyPublicNoticeFilters\(/g) ?? []).length, 1);
  });
  test("publishing and deleting from the website are untouched", () => {
    const c = rd("lib/hubs-client.ts"); assert.match(c, /publisher_hub_id: hubId,\n    severity: "community",/); assert.match(c, /from\("notices"\)\.delete\(\)\.eq\("id", id\)/);
  });
});
