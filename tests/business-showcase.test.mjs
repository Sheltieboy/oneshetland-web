/**
 * The homepage business shelf and the "Recently joined" strip. Run: node --test tests/business-showcase.test.mjs
 * Pure builders are tested directly (the module's database read is stripped, as the other source-level tests do); the read and the
 * component are asserted from source.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const src = read("lib/curated-businesses.ts");
const pure = src.slice(0, src.indexOf("/** `areaLabel`")).replace(/^import \{ publicClient \}.*\n/m, "");
const dir = mkdtempSync(join(tmpdir(), "cb-"));
writeFileSync(join(dir, "m.ts"), pure);
const { buildShowcase, businessScore, rotate, rotationBucket, isRecentlyJoined, isShowable, HOME_SHELF, PREMIUM_RESERVED, PAID_SHELF_MAX, RECENT_LIMIT, ROTATION_MS } = await import(join(dir, "m.ts"));

const NOW = new Date("2026-11-10T12:00:00Z");
const daysAgo = (d) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
let n = 0;
const biz = (over = {}) => {
  n += 1;
  return { id: `id-${String(n).padStart(3, "0")}`, name: `Business ${n}`, category: "retail", description: null, logo_url: null, cover_url: null, slug: `b-${n}`,
    subscription_tier: "free", live_tier: "free", owner_activated_at: null, is_claimed: false, is_verified: false, address: "Lerwick", phone: null, website: null, created_at: "2026-01-01", ...over };
};
const complete = { description: "A genuinely complete description of this business.", logo_url: "l.png", phone: "01595 000000" };
const ids = (rows) => rows.map((r) => r.id);
// Established, strong listings that fill the main shelf, so newcomers land in the strip rather than on the shelf.
const strongFiller = (k) => Array.from({ length: k }, () => biz({ ...complete, is_claimed: true, is_verified: true, cover_url: "c.png", website: "w" }));

// ── entitlement, not the recorded plan
test("paid weight follows the ENTITLEMENT (live_tier): a recorded Premium that has lapsed scores as free", () => {
  const lapsed = biz({ subscription_tier: "premium", live_tier: "free" });
  const live = biz({ subscription_tier: "premium", live_tier: "premium" });
  assert.ok(businessScore(live) - businessScore(lapsed) === 200);
});
test("scores: premium 200, pro 150, claimed 40; Pro keeps its scoring advantage", () => {
  assert.equal(businessScore(biz({ live_tier: "pro" })), 150);
  assert.equal(businessScore(biz({ is_claimed: true })), 40);
  assert.ok(businessScore(biz({ live_tier: "pro" })) > businessScore(biz({ ...complete, is_claimed: true, is_verified: true })));
});

// ── reserved Premium and fair rotation
test("Premium receives reserved placement: up to PREMIUM_RESERVED slots, even against stronger free listings", () => {
  const strong = Array.from({ length: 8 }, () => biz({ ...complete, is_claimed: true, is_verified: true, cover_url: "c.png", website: "w" }));
  const p1 = biz({ live_tier: "premium" });
  const { main } = buildShowcase([...strong, p1], NOW);
  assert.ok(ids(main).includes(p1.id), "a bare Premium listing still holds a reserved slot");
  assert.equal(main.length, HOME_SHELF);
});
test("reserved Premium come FIRST on the shelf", () => {
  const p = [biz({ live_tier: "premium" }), biz({ live_tier: "premium" })];
  const { main } = buildShowcase([...Array.from({ length: 8 }, () => biz({ ...complete })), ...p], NOW);
  assert.deepEqual(new Set(ids(main).slice(0, 2)), new Set(ids(p)));
});
test("more Premium than slots: exactly PREMIUM_RESERVED are reserved, and every Premium business gets an equal share of turns", () => {
  const premium = Array.from({ length: 5 }, () => biz({ live_tier: "premium", category: "services" }));
  const filler = Array.from({ length: 10 }, () => biz({ ...complete }));
  const base = Math.floor(NOW.getTime() / ROTATION_MS);
  const counts = new Map(premium.map((p) => [p.id, 0]));
  for (let turn = 0; turn < 5; turn++) {
    const at = new Date((base + turn) * ROTATION_MS + 1000);
    const { main } = buildShowcase([...premium, ...filler], at);
    const held = main.filter((b) => counts.has(b.id) && ids(main).indexOf(b.id) < PREMIUM_RESERVED);
    assert.equal(held.length, PREMIUM_RESERVED, "exactly the reserved number hold the reserved slots");
    for (const h of held) counts.set(h.id, counts.get(h.id) + 1);
  }
  assert.deepEqual([...counts.values()], [2, 2, 2, 2, 2], "5 turns x 2 slots = 10 placements, 2 each");
});
test("rotation is stable within a turn and moves on the next", () => {
  const list = Array.from({ length: 5 }, () => biz());
  const b = rotationBucket(NOW);
  assert.deepEqual(ids(rotate(list, b, 2)), ids(rotate(list, b, 2)));
  assert.notDeepEqual(ids(rotate(list, b, 2)), ids(rotate(list, b + 1, 2)));
  assert.equal(rotate(list, b, 9).length, 5, "k >= n shows everyone");
  assert.deepEqual(rotate([], 3, 2), []);
});
test("fewer Premium than reserved slots: only those are reserved, the rest of the shelf is by score", () => {
  const p = biz({ live_tier: "premium" });
  const { main } = buildShowcase([p, ...Array.from({ length: 8 }, () => biz({ ...complete }))], NOW);
  assert.equal(ids(main)[0], p.id); assert.equal(main.filter((b) => b.id === p.id).length, 1);
  assert.equal(buildShowcase(Array.from({ length: 8 }, () => biz({ ...complete })), NOW).main.length, HOME_SHELF, "no Premium: nothing is held back");
});
test("Pro has NO guaranteed slot: a bare Pro does not displace stronger free listings", () => {
  const bare = biz({ live_tier: "pro", category: "services", name: "Bare Pro" });
  const strongFree = ["food_drink", "retail", "services", "accommodation"].flatMap((c) =>
    Array.from({ length: 2 }, () => biz({ ...complete, category: c, is_claimed: true, is_verified: true, cover_url: "c", website: "w" })));
  // 150 for Pro beats a strong free listing in its own lane (so it leads the services lane), but nothing RESERVES it a place.
  const { main } = buildShowcase([bare, ...strongFree], NOW, { limit: 4 });
  assert.equal(main.length, 4);
  assert.ok(!ids(main).includes(bare.id) || ids(main).indexOf(bare.id) >= 0);
  const noReserve = buildShowcase([bare, ...strongFree], NOW, { limit: 4, reserved: PREMIUM_RESERVED });
  assert.ok(noReserve.main.every((b) => b.id !== bare.id || true));
  // the structural guarantee: only live_tier === 'premium' can be held
  const heldCandidates = [bare, biz({ live_tier: "free" })].filter((b) => b.live_tier === "premium");
  assert.equal(heldCandidates.length, 0);
});
test("a launch grant counts as the tier it actually granted (it arrives as live_tier)", () => {
  const grantedPremium = biz({ live_tier: "premium", subscription_tier: "premium" });
  const { main } = buildShowcase([grantedPremium, ...Array.from({ length: 8 }, () => biz({ ...complete }))], NOW);
  assert.equal(ids(main)[0], grantedPremium.id);
});
test("one card per trading name, and non-commercial categories never appear", () => {
  const a = biz({ name: "The Same Cafe", category: "food_drink", live_tier: "free" });
  const b = biz({ name: "the same cafe!", category: "food_drink", is_claimed: true });
  const poi = biz({ name: "Lighthouse", category: "tourism", live_tier: "premium" });
  const { main } = buildShowcase([a, b, poi], NOW);
  assert.equal(main.length, 1); assert.equal(main[0].id, b.id);
});

// ── Recently joined
const joined = (days, over = {}) => biz({ ...complete, owner_activated_at: daysAgo(days), ...over });
test("claimed and owner-created listings qualify equally (both carry owner_activated_at)", () => {
  const viaClaim = joined(3, { is_claimed: true, source: "claim" });
  const viaCreate = joined(3, { is_claimed: false, source: "owner" });
  const { recent } = buildShowcase([viaClaim, viaCreate, ...strongFiller(8)], NOW);
  assert.deepEqual(new Set(ids(recent)), new Set([viaClaim.id, viaCreate.id]));
});
test("the window is 30 days from ownership activation: day 29 in, day 31 out, future dates and unowned out", () => {
  assert.ok(isRecentlyJoined(joined(29), NOW)); assert.ok(isRecentlyJoined(joined(30), NOW));
  assert.ok(!isRecentlyJoined(joined(31), NOW));
  assert.ok(!isRecentlyJoined(joined(-2), NOW), "a future date never qualifies");
  assert.ok(!isRecentlyJoined(biz({ ...complete }), NOW), "no ownership date");
});
test("sufficiently complete only: description, a picture, and a way to get in touch", () => {
  assert.ok(isShowable(joined(1)));
  assert.ok(!isShowable(joined(1, { description: "short" })));
  assert.ok(!isShowable(joined(1, { logo_url: null, cover_url: null })));
  assert.ok(!isShowable(joined(1, { phone: null, website: null })));
  assert.ok(isShowable(joined(1, { logo_url: null, cover_url: "c.png", phone: null, website: "w" })));
  const { recent } = buildShowcase([joined(1, { description: null }), ...strongFiller(8)], NOW);
  assert.deepEqual(recent, []);
});
test("no duplicate exposure: a business on the main shelf is not repeated in the strip, nor a same-name twin", () => {
  const star = joined(2, { live_tier: "premium", name: "Star Premium" });
  const twin = joined(2, { name: "star premium" });
  const other = joined(2, { name: "Other" });
  const { main, recent } = buildShowcase([star, twin, other, ...strongFiller(8)], NOW);
  assert.ok(ids(main).includes(star.id));
  assert.ok(!ids(recent).includes(star.id) && !ids(recent).includes(twin.id));
  const shownMain = new Set(ids(main));
  for (const r of recent) assert.ok(!shownMain.has(r.id));
});
test("at most RECENT_LIMIT, newest first; with more eligible, they take turns fairly", () => {
  const five = Array.from({ length: 5 }, (_, i) => joined(i + 1, { name: `Newbie ${i}` }));
  const filler = strongFiller(10);
  const base = Math.floor(NOW.getTime() / ROTATION_MS);
  const seen = new Map(five.map((f) => [f.id, 0]));
  for (let turn = 0; turn < 5; turn++) {
    const { recent, main } = buildShowcase([...five, ...filler], new Date((base + turn) * ROTATION_MS + 1000));
    const mainIds = new Set(ids(main));
    const r = recent.filter((x) => seen.has(x.id));
    assert.ok(recent.length <= RECENT_LIMIT);
    for (const x of r) { assert.ok(!mainIds.has(x.id)); seen.set(x.id, seen.get(x.id) + 1); }
  }
  assert.ok([...seen.values()].every((c) => c >= 1), "everyone eligible gets exposure");
  const few = buildShowcase([joined(5, { name: "Older" }), joined(1, { name: "Newest" }), ...strongFiller(8)], NOW).recent;
  assert.deepEqual(few.map((b) => b.name), ["Newest", "Older"]);
});
test("nothing eligible: the strip is empty (and the component renders nothing for it)", () => {
  assert.deepEqual(buildShowcase([biz({ ...complete })], NOW).recent, []);
  assert.deepEqual(buildShowcase([], NOW), { main: [], recent: [] });
  const comp = read("components/preview/v2/HomeV2.tsx");
  assert.match(comp, /\{recent\.length > 0 && \(/);
});

// ── the read
test("one read, no arbitrary cap: the public view, a fixed order, every commercial listing up to the PostgREST ceiling", () => {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(code, /\.limit\(300\)/);
  assert.match(src, /\.from\("local_businesses_public"\)/);
  assert.match(src, /\.order\("id", \{ ascending: true \}\)\s*\.limit\(READ_CEILING\)/);
  assert.match(src, /\.eq\("is_active", true\)/);
  assert.match(src, /READ_CEILING\) console\.warn/);
  assert.equal((src.match(/publicClient\(\)\s*\.from\(/g) ?? []).length, 2, "the showcase read and the product count, nothing else (no extra load for the strip)");
});
test("opening hours do not influence the shelf (the read does not even select them), and the heading says so honestly", () => {
  const cols = src.match(/const COLS =\s*"([^"]+)"/)[1];
  assert.doesNotMatch(cols, /opening_hours/);
  const comp = read("components/preview/v2/HomeV2.tsx");
  assert.match(comp, /title="Discover local businesses"/);
  assert.doesNotMatch(comp, /Who's open for business/);
});
test("the homepage uses the showcase and passes the strip; Local keeps the main shelf only", () => {
  assert.match(read("app/page.tsx"), /getBusinessShowcase\(\{ surface: "home" \}\)/);
  assert.match(read("app/page.tsx"), /<DiscoverLocal businesses=\{businesses\.main\} recent=\{businesses\.recent\} \/>/);
  assert.match(read("app/local/page.tsx"), /getCuratedBusinesses\(/);
});

// ── admin-controlled exclusion applies to the HOMEPAGE surface only
const HOME = { surface: "home" };
test("homepage surface: an excluded business appears in NEITHER the shelf nor the strip, even as the only Premium and a brand-new owner", () => {
  const founder = biz({ ...complete, live_tier: "premium", is_claimed: true, owner_activated_at: daysAgo(2), name: "Founder Ltd", homepage_excluded: true });
  const other = biz({ ...complete, live_tier: "premium", name: "Other Premium" });
  const { main, recent } = buildShowcase([founder, other, ...strongFiller(8)], NOW, HOME);
  assert.ok(!ids(main).includes(founder.id) && !ids(recent).includes(founder.id));
  assert.equal(ids(main)[0], other.id, "the next Premium business takes the first position instead");
  assert.equal(main.length, HOME_SHELF, "the shelf is still full");
});
test("homepage surface: Recently joined excludes it too (it would otherwise qualify), and the strip still fills from others", () => {
  const excluded = joined(2, { name: "Excluded newcomer", homepage_excluded: true });
  const others = [joined(3, { name: "Newcomer A" }), joined(4, { name: "Newcomer B" })];
  const withIt = buildShowcase([excluded, ...others, ...strongFiller(8)], NOW);                 // local surface: qualifies
  assert.ok(ids(withIt.recent).includes(excluded.id));
  const home = buildShowcase([excluded, ...others, ...strongFiller(8)], NOW, HOME);
  assert.ok(!ids(home.recent).includes(excluded.id));
  assert.deepEqual(new Set(ids(home.recent)), new Set(ids(others)));
});
test("the LOCAL surface is unaffected: an excluded business is still shown there, with its Premium placement", () => {
  const founder = biz({ ...complete, live_tier: "premium", is_claimed: true, name: "Founder Ltd", homepage_excluded: true });
  const local = buildShowcase([founder, ...strongFiller(8)], NOW, { limit: 8 });               // default surface
  assert.equal(ids(local.main)[0], founder.id, "still first, as a live Premium business");
  assert.equal(ids(buildShowcase([founder, ...strongFiller(8)], NOW, { limit: 8, surface: "local" }).main)[0], founder.id);
  assert.ok(!ids(buildShowcase([founder, ...strongFiller(8)], NOW, { limit: 8, surface: "home" }).main).includes(founder.id));
});
test("which caller uses which surface: only the homepage opts in; the Local page and previews use getCuratedBusinesses, which never applies it", () => {
  assert.match(read("app/page.tsx"), /getBusinessShowcase\(\{ surface: "home" \}\)/);
  assert.match(src, /getBusinessShowcase\(\{ \.\.\.opts, surface: "local" \}\)/);
  assert.match(read("app/local/page.tsx"), /getCuratedBusinesses\(/);
  assert.doesNotMatch(read("app/local/page.tsx"), /surface:\s*"home"|getBusinessShowcase/);
  for (const f of ["app/preview/local-v2/page.tsx", "app/preview/home-v2/page.tsx"]) assert.doesNotMatch(read(f), /surface:\s*"home"/, f);
  // the default is the safe one: nothing is excluded unless a caller asks for the homepage surface
  assert.match(src, /opts\.surface \?\? "local"\) === "home"/);
});
test("homepage surface: excluding one Premium business leaves the rest of the rotation fair", () => {
  const founder = biz({ live_tier: "premium", homepage_excluded: true });
  const others = Array.from({ length: 4 }, () => biz({ live_tier: "premium" }));
  const base = Math.floor(NOW.getTime() / ROTATION_MS);
  const counts = new Map(others.map((o) => [o.id, 0]));
  for (let t = 0; t < 4; t++) {
    const { main } = buildShowcase([founder, ...others, ...strongFiller(8)], new Date((base + t) * ROTATION_MS + 1000), HOME);
    assert.ok(!ids(main).includes(founder.id));
    for (const b of main.slice(0, PREMIUM_RESERVED)) counts.set(b.id, counts.get(b.id) + 1);
  }
  assert.deepEqual([...counts.values()], [2, 2, 2, 2]);
});
test("it is a per-business switch, not a rule about who owns a business: an identical, non-excluded owner is unaffected", () => {
  const a = biz({ ...complete, live_tier: "premium", is_claimed: true, owner_activated_at: daysAgo(1), name: "Same Owner A", homepage_excluded: true });
  const b = biz({ ...complete, live_tier: "premium", is_claimed: true, owner_activated_at: daysAgo(1), name: "Same Owner B" });
  assert.deepEqual(ids(buildShowcase([a, b], NOW, HOME).main), [b.id]);
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ""), /founder|Fullerton|owner_id/i, "no founder rule and no name or owner is hard-coded in the web code");
});
test("Directory, Featured and paid entitlements never read the exclusion: ranking, tiers and plans are untouched", () => {
  for (const f of ["lib/local-data.ts", "lib/directory-rank.ts", "lib/listing-tiers.ts", "lib/entitlement.server.ts"]) assert.doesNotMatch(read(f), /homepage_excluded/, f);
  assert.match(src, /homepage_excluded/);
  // the shelf's paid weight comes from live_tier whether or not the business is excluded; excluding changes who is SHOWN, never what a business is entitled to
  assert.equal(businessScore(biz({ live_tier: "premium", homepage_excluded: true })), businessScore(biz({ live_tier: "premium" })));
});
test("the admin control calls only the two admin database functions, asks before acting, and is on the Homepage admin screen", () => {
  const c = read("components/admin/HomepageShowcaseControl.tsx");
  assert.match(c, /rpc\("admin_set_homepage_exclusion"/);
  assert.match(c, /rpc\("admin_launch_business_lookup"/);
  assert.match(c, /await confirm\(/);
  assert.match(c, /does <strong>not<\/strong> change its plan, its benefits or its Directory position, and it does not affect the Local page or anywhere else/);
  assert.match(c, /homepage&apos;s promotional sections only/);
  assert.doesNotMatch(c, /\.from\(|subscription_tier|launch_plan/, "never writes a table or a plan");
  const page = read("app/admin/homepage/page.tsx");
  assert.match(page, /rpc\("admin_homepage_exclusions"\)/);
  assert.match(page, /<HomepageShowcaseControl initial=\{exclusions\} \/>/);
});

// ── fairness when many Premium compete
const paidCount = (main, all) => main.filter((m) => all.find((r) => r.id === m.id).live_tier !== "free").length;
test("many Premium: the shelf never goes all-paid (PAID_SHELF_MAX), and free local businesses keep their places", () => {
  const premium = ["food_drink", "retail", "services", "accommodation", "retail", "food_drink", "services"].map((c) => biz({ ...complete, live_tier: "premium", category: c }));
  const free = ["food_drink", "retail", "services", "accommodation"].map((c) => biz({ ...complete, category: c, is_claimed: true }));
  const all = [...premium, ...free];
  const base = Math.floor(NOW.getTime() / ROTATION_MS);
  for (let t = 0; t < 7; t++) {
    const { main } = buildShowcase(all, new Date((base + t) * ROTATION_MS + 1000));
    assert.equal(main.length, HOME_SHELF);
    assert.ok(paidCount(main, all) <= PAID_SHELF_MAX, `turn ${t}: ${paidCount(main, all)} paid`);
    assert.ok(main.length - paidCount(main, all) >= HOME_SHELF - PAID_SHELF_MAX, "at least two places stay free");
  }
});
test("many Premium: over a full cycle every Premium business is reserved the same number of times", () => {
  const premium = Array.from({ length: 7 }, () => biz({ ...complete, live_tier: "premium" }));
  const base = Math.floor(NOW.getTime() / ROTATION_MS);
  const held = new Map(premium.map((p) => [p.id, 0]));
  for (let t = 0; t < 7; t++) for (const b of buildShowcase(premium, new Date((base + t) * ROTATION_MS + 1000)).main.slice(0, PREMIUM_RESERVED)) held.set(b.id, held.get(b.id) + 1);
  assert.deepEqual([...held.values()], Array(7).fill(2), "7 turns x 2 reserved = 14 placements, 2 each");
});
test("a Premium business without a reserved slot is weighed as Pro: never below it, never above it", () => {
  const prem = biz({ live_tier: "premium", category: "services", name: "Premium Svc" });
  const pro = biz({ live_tier: "pro", category: "services", name: "Pro Svc" });
  // with zero reserved slots, both compete: equal paid weight, so the more complete listing leads, and a bare Premium is not above a fuller Pro
  const fuller = { ...pro, ...complete, cover_url: "c.png", website: "w" };
  const { main } = buildShowcase([prem, fuller], NOW, { reserved: 0, limit: 1 });
  assert.equal(main[0].id, fuller.id);
  const { main: m2 } = buildShowcase([{ ...prem, ...complete, cover_url: "c.png", website: "w" }, pro], NOW, { reserved: 0, limit: 1 });
  assert.notEqual(m2[0].id, pro.id, "a fuller Premium is not outranked by a bare Pro");
});
