/**
 * The integrated homepage: My Saved in For you, Tomorrow, the contribution cards (destinations, flag, offers), and the page wiring
 * (section order, no preview leftovers, paid placement untouched, no invented routes).
 * Run: node --test --import ./tests/support/register.mjs tests/home-integration.test.mjs
 */
process.env.HOME_RESILIENCE = "off";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { savedToForYou } from "../lib/saved-for-you.ts";
import { tomorrowWindow, tomorrowItems } from "../lib/home-tomorrow.ts";
import { offersContribution, OWNER_OFFERS_HREF } from "../lib/home-contribute.ts";
import { entryPointsEnabled, ADD_EVENT_HREF } from "../lib/event-entry-points.ts";

const read = (p) => readFileSync(p, "utf8");
const page = read("app/page.tsx");
const NOW = Date.parse("2026-11-09T12:00:00Z");
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const item = (n, o = {}) => ({ item_type: "event", item_id: U(n), occurrence_key: null, saved_at: iso(NOW - DAY), state: "upcoming", bucket: 1, sort_at: null, title: `E${n}`, place: null, starts_at: iso(NOW + DAY), ends_at: null, note: null, from_snapshot: false, slug: null, parent_readable: true, ...o });

describe("My Saved inside For you: only what is genuinely coming up", () => {
  test("upcoming events within 7 days and jobs closing within 14 days are included, soonest first, at most two", () => {
    const out = savedToForYou([
      item(1, { starts_at: iso(NOW + 5 * DAY) }), item(2, { starts_at: iso(NOW + DAY) }), item(3, { starts_at: iso(NOW + 2 * DAY) }),
      item(4, { item_type: "job", starts_at: null, ends_at: iso(NOW + 3 * DAY) }),
    ], NOW);
    assert.equal(out.length, 2);
    assert.deepEqual(out.map((x) => x.title), ["E2", "E3"].slice(0, 2));
    assert.ok(out.every((x) => x.kind === "saved" && x.icon === "saved" && /^From your saved/.test(x.subtitle)));
  });
  test("never cancelled, closed, past, snapshot or unavailable items; never businesses; never far-future events", () => {
    const bad = [
      item(1, { state: "cancelled" }), item(2, { state: "past" }), item(3, { state: "unavailable" }), item(4, { from_snapshot: true }),
      item(5, { starts_at: iso(NOW - 2 * DAY), ends_at: iso(NOW - DAY) }), item(6, { starts_at: iso(NOW + 30 * DAY) }),
      item(7, { item_type: "business", starts_at: null }), item(8, { item_type: "job", starts_at: null, ends_at: iso(NOW + 40 * DAY) }),
      item(9, { item_type: "job", starts_at: null, ends_at: iso(NOW - DAY) }), item(10, { title: null }),
    ];
    assert.deepEqual(savedToForYou(bad, NOW), []);
  });
  test("the cue and link are the ones My Saved uses; an activity needs a valid slug", () => {
    const today = savedToForYou([item(1, { starts_at: iso(NOW + 3_600_000) })], NOW)[0];
    assert.equal(today.cue, "Today");
    assert.match(today.href, /^\/whats-on\//);
    assert.deepEqual(savedToForYou([item(2, { item_type: "activity", slug: null })], NOW), []);
    assert.match(savedToForYou([item(3, { item_type: "activity", slug: "knitting" })], NOW)[0].href, /^\/whats-on\/regular\/knitting/);
  });
  test("it is gated by the same switch My Saved obeys, and reads only the member's own list", () => {
    const fy = read("lib/for-you.server.ts");
    assert.match(fy, /rpc\("saved_enabled"\)/);
    assert.match(fy, /on\.data !== true\) return \[\]/);
    assert.match(fy, /rpc\("my_saved_list"\)/);
  });
});

describe("Tomorrow", () => {
  test("the window is the Shetland day after today, DST-safe", () => {
    const w = tomorrowWindow(new Date("2026-11-09T12:00:00Z"));
    assert.equal(w.startIso, "2026-11-10T00:00:00.000Z");
    assert.equal(w.endIso, "2026-11-11T00:00:00.000Z");
    assert.match(w.label, /Tuesday 10 November/);
    const clocks = tomorrowWindow(new Date("2026-10-24T12:00:00Z"));   // clocks go back on Sunday 25 Oct 2026: that day is 25 hours long
    assert.equal(Date.parse(clocks.endIso) - Date.parse(clocks.startIso), 25 * 3_600_000);
  });
  test("only real things starting tomorrow, soonest first; empty means no strip", () => {
    const ev = [{ id: "e1", title: "Late", starts_at: "2026-11-10T19:30:00Z", venue: "Hall" }, { id: "e2", title: "Today", starts_at: "2026-11-09T19:30:00Z" }, { id: "e3", title: "Next week", starts_at: "2026-11-17T10:00:00Z" }];
    const act = [{ id: "a1", slug: "swim", title: "Swim", next_starts_at: "2026-11-10T10:00:00Z", venue: "Pool" }, { id: "a2", slug: "x", title: "No session", next_starts_at: null }];
    const out = tomorrowItems(ev, act, new Date("2026-11-09T12:00:00Z"));
    assert.deepEqual(out.map((o) => [o.time, o.title]), [["10:00", "Swim"], ["19:30", "Late"]]);
    assert.deepEqual(tomorrowItems([], [], new Date("2026-11-09T12:00:00Z")), []);
    assert.match(read("components/home/TomorrowStrip.tsx"), /items\.length === 0\) return null/);
  });
});

describe("contribution cards: every link is an existing journey", () => {
  const routes = [
    ["/whats-on/add", "app/whats-on/add/page.tsx"], ["/jobs/new", "app/jobs/new/page.tsx"], ["/shifts/new", "app/shifts/new/page.tsx"], ["/notices/post", "app/notices/post/page.tsx"],
    ["/directory/new", "app/directory/new/page.tsx"], ["/business", "app/business/page.tsx"], ["/account", "app/account/page.tsx"],
  ];
  test("each destination exists in the app", () => {
    for (const [href, file] of routes) assert.ok(existsSync(file), `${href} -> ${file}`);
    assert.ok(existsSync("app/business/[id]/manage/offers/page.tsx"));
    assert.equal(ADD_EVENT_HREF, "/whats-on/add");
  });
  test("the page links only to those routes and invents no /news or preview route", () => {
    assert.ok(page.includes("ADD_EVENT_HREF"));
    for (const href of ["/jobs/new", "/shifts/new", "/notices/post"]) assert.ok(page.includes(href), href);
    assert.match(page, /JOIN_CLAIM_HREF/); assert.match(page, /JOIN_ADD_HREF/);
    assert.doesNotMatch(page + read("components/home/LatestEditorial.tsx"), /"\/news|"\/preview\/home|home-v3|home-v4/);
  });
  test("the add-event card appears only when the front door is on", () => {
    assert.equal(entryPointsEnabled({ EVENT_FRONT_DOOR: "on" }), true);
    for (const v of [undefined, "", "ON", "true", "1", " on"]) assert.equal(entryPointsEnabled({ EVENT_FRONT_DOOR: v }), false);
    assert.match(page, /entryPointsEnabled\(\) && \(/);
  });
  test("the offers card goes to the owner's own offer manager, and is not shown to anyone who cannot act on it", () => {
    const B = "11111111-1111-4111-8111-111111111111", C = "22222222-2222-4222-8222-222222222222";
    assert.equal(offersContribution([]), null);
    assert.equal(offersContribution(null), null);
    assert.equal(offersContribution([{ id: "not-a-uuid" }]), null);
    assert.equal(offersContribution([{ id: B }]).href, OWNER_OFFERS_HREF(B));
    assert.equal(OWNER_OFFERS_HREF(B), `/business/${B}/manage/offers`);
    assert.equal(offersContribution([{ id: B }, { id: C }]).href, "/account", "several businesses: the member picks theirs");
    assert.match(offersContribution([{ id: B }]).note, /Pro plan/);
  });
  test("there is exactly one business invitation, and the old band is gone", () => {
    assert.doesNotMatch(page, /<JoinBusinessCta/);
    assert.equal((page.match(/id="c-business"/g) ?? []).length, 1);
    assert.equal((page.match(/<ContributeCard/g) ?? []).length, 5);
  });
  test("no contribution card in Latest from OneShetland or For you / My Saved", () => {
    assert.doesNotMatch(read("components/home/LatestEditorial.tsx"), /ContributeCard/);
    assert.doesNotMatch(read("components/home/ForYou.tsx"), /ContributeCard/);
  });
});

describe("homepage wiring", () => {
  test("sections appear in the approved order", () => {
    const order = ["<ForYou", "<NewThisWeek", "<RightNow", "<LatestEditorial", "<DiscoverLocal", 'id="c-business"', "<CommerceGateway", "<HomeWork", "<GetItDoneHome", "<IslandMosaic", "<CommunityV2", "<ExploreV2"];
    const pos = order.map((t) => page.indexOf(t));
    assert.ok(pos.every((p) => p > 0), JSON.stringify(order.filter((t, i) => pos[i] < 0)));
    assert.deepEqual([...pos].sort((a, b) => a - b), pos);
  });
  test("the hero, paid placement and rotation are untouched", () => {
    assert.match(page, /getBusinessShowcase\(\{ surface: "home" \}\)/);
    assert.match(page, /<DiscoverLocal businesses=\{businesses\.main\} recent=\{businesses\.recent\}/);
    assert.match(page, /Shop Shetland\./);
  });
  test("New this week skips businesses already on the shelf and uses real candidates, not samples", () => {
    assert.match(page, /shelfIds = new Set\(\[\.\.\.businesses\.main, \.\.\.businesses\.recent\]/);
    assert.match(page, /planNewThisWeek\(newCandidates, now\.getTime\(\), shelfIds\)/);
    assert.match(page, /getHomeNewCandidates/);
  });
  test("no preview or development leftovers anywhere in the production homepage code", () => {
    const files = ["app/page.tsx", ...readdirSync("components/home").map((f) => `components/home/${f}`), "lib/home-new.server.ts", "lib/home-announcements.ts", "lib/home-tomorrow.server.ts", "lib/home-contribute.ts"];
    for (const f of files.filter((f) => /\.(ts|tsx)$/.test(f) && statSync(f).isFile())) {
      const t = read(f);
      assert.doesNotMatch(t, /design preview|sample content|not live|PreviewBar|home-v3-preview-data|Design preview/i, f);
    }
    assert.ok(!existsSync("app/preview/home-v3") && !existsSync("app/preview/home-v4"));
  });
  test("the real-data loaders read only through the anonymous client and carry the publication-date rules", () => {
    const t = read("lib/home-new.server.ts");
    assert.match(t, /publicClient\(\)/);
    assert.doesNotMatch(t, /createClient|service_role/);
    for (const col of ["calendar_approved_at", "listed_at", "owner_activated_at", "valid_from"]) assert.ok(t.includes(col), col);
    assert.match(t, /\.eq\("status", "published"\)\.eq\("is_hidden", false\)/);
    assert.match(t, /\.eq\("status", "open"\)\.eq\("is_hidden", false\)/);
    assert.match(read("lib/curated-businesses.ts"), /getNewBusinessCandidates/);
  });
});
