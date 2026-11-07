/**
 * OneShetland Launch 50 (website): action error mapping, page gating, showcase cards, static copy, billing card states and the checkout flag.
 * Run: node --test --import ./tests/support/register.mjs tests/launch50.test.mjs
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
await import("./support/register-jsx.mjs");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement: h } = await import("react");
const fakeMod = await import("./support/fake-supabase.mjs");
const fake = fakeMod.default; const { setDb } = fakeMod;
const core = await import("../lib/launch50-core.ts");
const actions = await import("../lib/launch50-actions.ts");
const { getLaunch50Status, getLaunch50Showcase, getMyLaunch50Place } = await import("../lib/launch50.ts");
const { default: Launch50Page } = await import("../app/launch-50/page.tsx");
const { ShowcaseCard } = await import("../components/launch50/ShowcaseCard.tsx");
const { Launch50Card } = await import("../components/business/Launch50Card.tsx");

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const BIZ = "11111111-1111-4111-8111-111111111111";
const ADMIN = { id: "a-1", email: "a@example.org" }, OWNER = { id: "o-1", email: "o@example.org" };
const status = (o = {}) => ({ phase: "open", places_total: 50, places_left: 37, opens_at: "2027-01-05T09:00:00Z", public_opens_at: "2027-01-19T09:00:00Z", ...o });
let rpc;
function setup({ st = status(), user = null, members = [], mine = [] } = {}) {
  setDb({ profiles: [{ id: ADMIN.id, role: "admin" }, { id: OWNER.id, role: "customer" }], local_businesses: mine });
  fake.auth.getUser = async () => ({ data: { user } });
  rpc = [];
  globalThis.__FAKE_RPC__ = async (fn, args) => {
    rpc.push([fn, args]);
    if (fn === "launch50_status") return st instanceof Error ? { data: null, error: { message: "boom" } } : { data: st, error: null };
    if (fn === "launch50_showcase") return { data: members, error: null };
    return { data: null, error: null };
  };
}
after(() => { delete globalThis.__FAKE_RPC__; fake.auth.getUser = async () => ({ data: { user: null } }); });
const html = async () => renderToStaticMarkup(await Launch50Page());
const threw = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

describe("server actions map every database hint to a friendly message", () => {
  const cases = [
    ["closed", "closed", /not open/i], ["not_eligible", "not_eligible", /not eligible/i], ["has_subscription", "has_subscription", /paid subscription/i],
    ["claimed_only", "claimed_only", "For the first 14 days, places are for businesses that already had a claimed listing."],
    ["already_has_place", "already_has_place", /already has a Launch 50 place/], ["full", "full", "All 50 places have been taken."],
  ];
  for (const [hint, code, msg] of cases) test(`hint ${hint}`, async () => {
    setup(); globalThis.__FAKE_RPC__ = async () => ({ data: null, error: { hint, code: "P0001", message: "raw database words" } });
    const r = await actions.reservePlace(BIZ, "pro", false);
    assert.equal(r.ok, false); assert.equal(r.code, code);
    if (typeof msg === "string") assert.equal(r.error, msg); else assert.match(r.error, msg);
    assert.doesNotMatch(r.error, /raw database words/);
  });
  test("42501 is 'not the owner' (or signed out); an unknown failure is generic and never leaks the raw message", async () => {
    setup(); globalThis.__FAKE_RPC__ = async () => ({ data: null, error: { code: "42501", message: "You can only reserve a place for a business you manage." } });
    assert.equal((await actions.reservePlace(BIZ, "pro", true)).code, "not_owner");
    globalThis.__FAKE_RPC__ = async () => ({ data: null, error: { code: "42501", message: "Please sign in." } });
    assert.equal((await actions.releasePlace(BIZ)).code, "signed_out");
    globalThis.__FAKE_RPC__ = async () => ({ data: null, error: { code: "XX000", message: "relation secret_table" } });
    const r = await actions.setShowcase(BIZ, true); assert.equal(r.code, "generic"); assert.doesNotMatch(r.error, /secret_table/);
    globalThis.__FAKE_RPC__ = async () => { throw new Error("network"); };
    assert.equal((await actions.reservePlace(BIZ, "pro", false)).ok, false);
  });
  test("success passes the right arguments; bad input never reaches the database", async () => {
    setup(); globalThis.__FAKE_RPC__ = async (fn, args) => { rpc.push([fn, args]); return { data: { status: "reserved", expires_at: "2027-01-20T10:30:00Z" }, error: null }; };
    const r = await actions.reservePlace(BIZ, "premium", true);
    assert.deepEqual(r, { ok: true, expiresAt: "2027-01-20T10:30:00Z" });
    assert.deepEqual(rpc[0], ["launch50_reserve", { p_business: BIZ, p_tier: "premium", p_showcase: true }]);
    await actions.releasePlace(BIZ); await actions.setShowcase(BIZ, false);
    assert.deepEqual(rpc.slice(1).map((c) => c[0]), ["launch50_release", "launch50_set_showcase"]);
    rpc = []; assert.equal((await actions.reservePlace("not an id!", "pro", false)).ok, false); assert.equal((await actions.reservePlace(BIZ, "free", false)).ok, false); assert.deepEqual(rpc, []);
  });
});

describe("reads are tolerant", () => {
  test("a failed or malformed status read is 'closed'; a failed showcase is empty; a missing place is null", async () => {
    setup({ st: new Error("x") }); assert.equal((await getLaunch50Status()).phase, "closed");
    setup({ st: { phase: "weird" } }); assert.equal((await getLaunch50Status()).phase, "closed");
    globalThis.__FAKE_RPC__ = async () => { throw new Error("down"); };
    assert.equal((await getLaunch50Status()).phase, "closed"); assert.deepEqual(await getLaunch50Showcase(), []);
    setup(); setDb({ launch50_places: [] }); assert.equal(await getMyLaunch50Place(BIZ), null);
  });
  test("the showcase keeps the order the database returned", async () => {
    setup({ members: [{ id: "z", name: "Zed" }, { id: "a", name: "Alpha" }, { id: "m", name: "Mid" }] });
    assert.deepEqual((await getLaunch50Showcase()).map((m) => m.id), ["z", "a", "m"]);
  });
});

describe("page gating", () => {
  test("closed + signed out: notFound", async () => { setup({ st: status({ phase: "closed" }) }); assert.equal(await threw(html), "notFound"); });
  test("closed + ordinary member: notFound", async () => { setup({ st: status({ phase: "closed" }), user: OWNER }); assert.equal(await threw(html), "notFound"); });
  test("closed + admin: the page with a clear preview banner, and no counts or dates", async () => {
    setup({ st: status({ phase: "closed", places_left: 50 }), user: ADMIN });
    const out = await html();
    assert.match(out, /Preview: Launch 50 is not open to the public/);
    assert.doesNotMatch(out, /places left|data-launch50-places/); assert.doesNotMatch(out, /January|2027/);
  });
  test("open: offers, how it works, showcase heading, places left and both dates; no preview banner", async () => {
    setup({ st: status(), members: [{ id: "m1", name: "Anderson Bakery", slug: "anderson-bakery", category: "food_drink", description: "Bread." }] });
    const out = await html();
    assert.doesNotMatch(out, /Preview: Launch 50/);
    assert.match(out, /Founding Pro/); assert.match(out, /Founding Premium/); assert.match(out, /How it works/); assert.match(out, /Meet the Launch 50/);
    assert.match(out, /<strong[^>]*>37<\/strong> of 50 places left/); assert.match(out, /5 January 2027/); assert.match(out, /19 January 2027/);
    assert.match(out, /Anderson Bakery/);
  });
  test("claimed-only phase also shows the page", async () => { setup({ st: status({ phase: "claimed_only" }) }); assert.match(await html(), /OneShetland Launch 50/); });
  test("empty showcase shows the empty state", async () => { setup(); assert.match(await html(), /The first Launch 50 members will appear here\./); });
  test("the page is noindex while closed (metadata)", () => {
    const src = read("app/launch-50/page.tsx"); assert.match(src, /status\.phase === "closed" \? \{ robots: \{ index: false, follow: false \} \}/);
  });
  test("CTA: signed out -> finder; one business -> billing#launch-50; several -> /account", async () => {
    setup(); assert.match(await html(), /href="\/business#find-your-business"[^>]*>Reserve your place/);
    setup({ user: OWNER, mine: [{ id: BIZ, owner_id: OWNER.id, is_active: true, name: "A" }] });
    assert.match(await html(), new RegExp(`href="/business/${BIZ}/manage/billing#launch-50"[^>]*>Reserve your place`));
    setup({ user: OWNER, mine: [{ id: BIZ, owner_id: OWNER.id, is_active: true, name: "A" }, { id: "22222222-2222-4222-8222-222222222222", owner_id: OWNER.id, is_active: true, name: "B" }] });
    assert.match(await html(), /href="\/account"[^>]*>Reserve your place/);
    assert.match(await html(), /Not a business owner yet\? Claim or add your business/);
  });
});

describe("static copy", () => {
  test("the page says plainly that it is a paid programme and not a ranking, with the right prices", async () => {
    setup(); const out = await html();
    assert.match(out, /Launch 50 is a paid commercial programme\. It is not a ranking of which businesses supported OneShetland first\./);
    for (const t of ["£9", "£22", "£12", "£29", "12 months", "Monthly billing only", "30 minutes", "reminder", "Plan changes are not available during Launch 50", "In the order shown today, nobody ranks first."]) assert.ok(out.includes(t), t);
    assert.match(out, /£9<span[^>]*>\/month<\/span>/); assert.match(out, /then £12\/month/); assert.match(out, /then £29\/month/);
  });
  test("no VAT, no invented counts, testimonials or promises of customers anywhere in the new sources", async () => {
    setup(); const out = await html();
    const files = ["lib/launch50-core.ts", "app/launch-50/page.tsx", "components/launch50/ShowcaseCard.tsx", "components/business/Launch50Card.tsx"].map(read).join("\n") + out;
    assert.doesNotMatch(files, /\bVAT\b/i);
    assert.doesNotMatch(out, /testimonial|"[^"]{20,}" —|guarantee[sd]? (customers|enquiries|sales)/i);
    // Every standalone number visible on the page is one the owner decided: 50, 9, 22, 12, 29, 14, 30, or the live places-left figure.
    const text = out.replace(/<[^>]+>/g, " ");
    const allowed = new Set(["50", "9", "22", "12", "29", "14", "30", "37", "5", "19", "2027", "1", "2"]);
    for (const n of text.match(/\b\d+\b/g) ?? []) assert.ok(allowed.has(n), `unexpected number ${n}`);
  });
  test("standard prices come from the shared constants, not retyped", () => {
    const { TIER_PRICE_PENCE } = { TIER_PRICE_PENCE: { pro: 1200, premium: 2900 } };
    assert.equal(core.standardPrice("pro"), "£12"); assert.equal(core.standardPrice("premium"), "£29");
    assert.match(read("lib/launch50-core.ts"), /TIER_PRICE_PENCE\[tier\]/); void TIER_PRICE_PENCE;
    assert.equal(core.launch50PriceLine("pro"), "£9/month for 12 months, then £12/month"); assert.equal(core.launch50PriceLine("premium"), "£22/month for 12 months, then £29/month");
  });
});

describe("showcase cards", () => {
  const long = "Word ".repeat(100).trim();
  const A = { id: "a", name: "Alpha Ltd", slug: "alpha", category: "retail", description: "Short.", logo_url: "https://x.test/l.png", cover_url: "https://x.test/c.jpg", website: "https://alpha.example/shop", address: "Lerwick" };
  const B = { id: "b", name: "Bravo Ltd", slug: null, category: null, description: long, logo_url: null, cover_url: null, website: "javascript:alert(1)", address: null };
  const card = (m) => renderToStaticMarkup(h(ShowcaseCard, { m }));
  const shape = (s) => s.replace(/>[^<]*</g, "><").replace(/(src|href|alt|style)="[^"]*"/g, "$1").replace(/\s+/g, " ");
  test("identical treatment: same structure for any member, and no tier or ranking cue", () => {
    const a = card({ ...A, tier: "premium" }), b = card({ ...A, id: "c", name: "Charlie", tier: "pro" });
    assert.equal(shape(a), shape(b));
    for (const s of [a, b, card(B)]) assert.doesNotMatch(s, /\b(pro|premium|founding|featured|top|first|#\d|rank)\b/i);
  });
  test("description is clamped at a word boundary, ellipsis added", () => {
    const d = core.clampDescription(long, 220); assert.ok(d.length <= 221); assert.ok(d.endsWith("…")); assert.match(d, /Word…$/);
    assert.equal(core.clampDescription("Short.", 220), "Short.");
    assert.match(card(B), /Word…/); assert.doesNotMatch(card(B), new RegExp(long));
  });
  test("website links: http(s) only, noopener; everything else dropped", () => {
    assert.match(card(A), /href="https:\/\/alpha\.example\/shop" target="_blank" rel="noopener noreferrer"/);
    assert.doesNotMatch(card(B), /javascript:/i);
    for (const bad of ["ftp://x.test", "data:text/html,hi", "mailto:a@b.c", "not a url", "", null]) assert.equal(core.safeWebsite(bad), null);
    assert.ok(core.safeWebsite("http://ok.test"));
  });
  test("fallbacks and links: category colour block, view listing by slug or id, alt text on images, category label", () => {
    const a = card(A), b = card(B);
    assert.match(a, /alt="Alpha Ltd logo"/); assert.match(a, /alt="Alpha Ltd cover photo"/); assert.match(a, /href="\/directory\/alpha"/); assert.match(a, />Retail|Shopping|Retail/i);
    assert.match(b, /href="\/directory\/b"/); assert.match(b, /background:#4f46e5/); assert.doesNotMatch(b, /<img/);
  });
});

describe("billing card states", () => {
  const FUT = new Date(Date.now() + 20 * 60000).toISOString(), PAST = new Date(Date.now() - 60000).toISOString();
  const place = (o) => ({ business_id: BIZ, tier: "pro", status: "reserved", reservation_expires_at: FUT, activated_at: null, discount_ends_at: null, showcase_opt_in: false, ...o });
  const st = (o) => core.launch50CardState({ phase: "open", tier: "free", subscriptionConnected: false, place: null, nowMs: Date.now(), ...o });
  test("state machine", () => {
    assert.equal(st({}), "choose"); assert.equal(st({ phase: "claimed_only" }), "choose"); assert.equal(st({ phase: "closed" }), "hidden");
    assert.equal(st({ tier: "pro" }), "hidden"); assert.equal(st({ subscriptionConnected: true }), "hidden"); assert.equal(st({ hasLaunchGrant: true }), "hidden");
    assert.equal(st({ place: place({}) }), "held"); assert.equal(st({ place: place({ reservation_expires_at: PAST }) }), "choose");
    assert.equal(st({ place: place({ status: "released" }) }), "choose");
    assert.equal(st({ phase: "closed", tier: "pro", place: place({ status: "active" }) }), "active", "an existing place is described whatever the phase");
    assert.equal(st({ phase: "closed", place: place({ status: "ended" }) }), "ended"); assert.equal(st({ place: place({ status: "pending_payment" }) }), "pending");
    assert.equal(core.launch50PlanLocked(place({ status: "active" })), true); assert.equal(core.launch50PlanLocked(place({ status: "pending_payment" })), true);
    assert.equal(core.launch50PlanLocked(place({ status: "reserved" })), false); assert.equal(core.launch50PlanLocked(place({ status: "ended" })), false); assert.equal(core.launch50PlanLocked(null), false);
  });
  const render = (props) => renderToStaticMarkup(h(Launch50Card, { businessId: BIZ, phase: "open", tier: "free", subscriptionConnected: false, place: null, busy: false, onSubscribe() {}, ...props }));
  test("(a) choose: both plans, unticked optional showcase box, Reserve button", () => {
    const o = render({}); assert.match(o, /id="launch-50"/); assert.match(o, /£9\/month/); assert.match(o, /£22\/month/); assert.match(o, /for 12 months, then £12\/month/); assert.match(o, /for 12 months, then £29\/month/);
    assert.match(o, /<input type="checkbox"(?![^>]*checked)[^>]*>\s*<span>Show my business on the Launch 50 page \(optional\)/); assert.match(o, /Reserve my place/);
    assert.doesNotMatch(o, /Subscribe at the Launch 50 price/);
  });
  test("(a) held: held-for-30-minutes, subscribe at the Launch 50 price and release", () => {
    const o = render({ place: place({}) }); assert.match(o, /Place held for 30 minutes/); assert.match(o, /Subscribe at the Launch 50 price/); assert.match(o, /Release my place/);
  });
  test("the showcase preference can be changed in EVERY state after reserving: held, pending and active, reflecting the saved choice", () => {
    for (const status of ["reserved", "pending_payment", "active"]) {
      const on = render({ place: place({ status, showcase_opt_in: true, discount_ends_at: status === "active" ? FUT : null }) });
      assert.match(on, /<input type="checkbox"[^>]*checked[^>]*>\s*<span>Show my business on the Launch 50 page \(optional\)\. You can change this at any time\./, status);
      const off = render({ place: place({ status, showcase_opt_in: false, discount_ends_at: status === "active" ? FUT : null }) });
      assert.match(off, /<input type="checkbox"(?![^>]*checked)[^>]*>\s*<span>Show my business on the Launch 50 page/, status);
    }
  });
  test("(a) a refused checkout shows the friendly message and points at the separate standard-price buttons", () => {
    const o = render({ message: core.launch50CheckoutMessage("LAUNCH50_NO_PLACE") }); assert.match(o, /no longer held/); assert.match(o, /standard price, separately/);
    for (const c of ["LAUNCH50_UNAVAILABLE", "LAUNCH50_NO_PLACE", "LAUNCH50_MONTHLY_ONLY", "LAUNCH50_PLAN_LOCKED"]) assert.ok(core.isLaunch50Code(c) && core.launch50CheckoutMessage(c).length > 20, c);
    assert.equal(core.launch50CheckoutMessage("LAUNCH50_PLAN_LOCKED"), "Plan changes are not available during Launch 50. You can cancel any time below.");
  });
  test("(b) active: founding price until the date, showcase toggle, locked note", () => {
    const o = render({ tier: "pro", subscriptionConnected: true, place: place({ status: "active", tier: "premium", discount_ends_at: "2028-01-20T10:00:00Z", showcase_opt_in: true }) });
    assert.match(o, /Launch 50 member: founding price £22\/month until 20 January 2028, then £29\/month/); assert.match(o, /checked/); assert.match(o, /Plan changes are not available during Launch 50\. You can cancel any time below\./);
  });
  test("(c) ended", () => { assert.match(render({ phase: "closed", place: place({ status: "ended" }) }), /Your Launch 50 place is complete\. Standard prices apply\./); });
  test("not shown when closed, paid, or subscribed", () => {
    assert.equal(render({ phase: "closed" }), ""); assert.equal(render({ tier: "pro" }), ""); assert.equal(render({ subscriptionConnected: true }), "");
  });
});

describe("checkout wiring", () => {
  const bm = read("components/business/BillingManager.tsx");
  test("launch50:true is in the request only for the Launch 50 flow", () => {
    const base = { businessId: BIZ, tier: "pro", period: "monthly", clientRequestId: "r1", useSavedCard: true };
    assert.deepEqual(core.subscriptionIntentBody(base), { business_id: BIZ, tier: "pro", period: "monthly", client_request_id: "r1", use_saved_card: true });
    assert.equal("launch50" in core.subscriptionIntentBody({ ...base, launch50: false }), false);
    assert.equal(core.subscriptionIntentBody({ ...base, launch50: true }).launch50, true);
    assert.match(read("lib/business-client.ts"), /subscriptionIntentBody\(\{ businessId, tier, period, clientRequestId, useSavedCard, launch50 \}\)/);
  });
  test("only the Launch 50 button passes the flag; every standard button is unchanged; the same attempt code path is used", () => {
    assert.equal((bm.match(/upgrade\([^)]*, true, true\)/g) ?? []).length, 1, "one Launch 50 call site");
    assert.match(bm, /onSubscribe=\{\(t: Launch50Tier\) => upgrade\(t, "monthly", true, true\)\}/);
    for (const m of bm.match(/upgrade\("(pro|premium)"(, "(annual|monthly)")?\)/g) ?? []) assert.doesNotMatch(m, /true/);
    assert.match(bm, /createSubscriptionIntent\(\s*b\.id, target, period, subAttemptId\(target, period, launch50Attempt\), useSavedCard, launch50Attempt,/);
    assert.equal((bm.match(/createSubscriptionIntent\(/g) ?? []).length, 1, "one checkout call, not a duplicate");
    assert.match(bm, /if \(isLaunch50Code\(code\)\)/); assert.match(bm, /never retried at the standard price|Nothing is ever retried at the standard price/);
  });
  test("change-plan controls are hidden while a place is active or pending, and the locked note is shown", () => {
    assert.match(bm, /const l50Locked = launch50PlanLocked\(launch50\?\.place\)/);
    assert.match(bm, /tier === "free" && !l50Locked/); assert.match(bm, /tier === "pro" && !l50Locked/);
    assert.match(bm, /!annualSubscriber && !l50Locked/); assert.match(bm, /annualSubscriber && !l50Locked/); assert.match(bm, /\{!l50Locked && \(\s*<>\s*<button onClick=\{\(\) => upgrade\("pro"\)\}/);
    assert.match(bm, /data-launch50-locked/); assert.match(bm, /LAUNCH50_PLAN_LOCKED/);
  });
  test("the billing page supplies phase and place, tolerantly", () => {
    const p = read("app/business/[id]/manage/billing/page.tsx"); assert.match(p, /getLaunch50Status\(\), getMyLaunch50Place\(business\.id\)/); assert.match(p, /launch50=\{\{ phase: l50Status\.phase, place: l50Place \}\}/);
  });
  test("confirmation names the founding price, the 12 months, the standard price and the reminder", () => {
    const c = core.launch50ConfirmCopy("premium"); assert.equal(c.confirmLabel, "Subscribe for £22/month"); assert.match(c.recurrence, /£29 a month starts automatically/); assert.match(c.recurrence, /reminder/); assert.equal(c.amountPence, 2200);
    assert.doesNotMatch(JSON.stringify(c), /VAT/);
  });
});
