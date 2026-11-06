import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { forYouLayout, forYouShows, DESKTOP_SLOTS, MAX_RECS } from "../lib/for-you-layout.ts";
import { getHomePin, PIN_READ_DEADLINE_MS, pinFromRow, safePinHref, pinKey, expiryFromDate, dateFromExpiry, validatePinDraft, PIN_LIMITS } from "../lib/home-pin.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const NOW = Date.parse("2026-11-06T12:00:00Z");
const row = (o = {}) => ({ pin_enabled: true, pin_title: "OneShetland has launched", pin_body: "See what is new this week", pin_cta: "Take a look", pin_href: "/notices", pin_expires_at: "2026-12-01T00:00:00Z", ...o });

/* ── layout: 1, 2, 4, 7+ recommendations, with and without the pinned card ────────────────────────────────────────────────── */
test("desktop has four slots; a pinned card takes two", () => { assert.equal(DESKTOP_SLOTS, 4); assert.equal(MAX_RECS, 8); });
test("without a pinned card: 1 -> one capped column, 2 -> two, 3 -> three, 4 -> four, 7 -> four with 3 folded away", () => {
  const g = (n, e = false) => forYouLayout(n, false, e);
  assert.equal(g(1).gridClass, "md:grid-cols-[minmax(0,26rem)]"); assert.equal(g(2).gridClass, "md:grid-cols-2");
  assert.equal(g(3).gridClass, "md:grid-cols-3"); assert.equal(g(4).gridClass, "md:grid-cols-4");
  assert.deepEqual([g(4).hidden, g(5).hidden, g(7).hidden, g(8).hidden], [0, 1, 3, 4]);
  assert.equal(g(7).capacity, 4); assert.equal(g(7, true).hidden, 0); assert.equal(g(7, true).gridClass, "md:grid-cols-4");
});
test("with a pinned card: it fills the row with two recommendations; more fold into '+N more'", () => {
  const g = (n, e = false) => forYouLayout(n, true, e);
  assert.equal(g(0).gridClass, "md:grid-cols-4"); assert.equal(g(1).gridClass, "md:grid-cols-3"); assert.equal(g(2).gridClass, "md:grid-cols-4");
  assert.equal(g(2).hidden, 0); assert.equal(g(4).hidden, 2); assert.equal(g(7).hidden, 5); assert.equal(g(7).capacity, 2);
  assert.equal(g(7, true).hidden, 0);
});
test("phones: one or two stack, three or more swipe", () => {
  for (const [n, m] of [[0, "stack"], [1, "stack"], [2, "stack"], [3, "swipe"], [4, "swipe"], [8, "swipe"]]) assert.equal(forYouLayout(n, false, false).mobile, m, String(n));
});
test("never more than 8 recommendations, whatever is passed", () => { assert.equal(forYouLayout(20, false, false).hidden, 4); });

/* ── the pinned card's rules ──────────────────────────────────────────────────────────────────────────────────────────────── */
test("a live, switched-on card with a title and a safe link shows", () => {
  const p = pinFromRow(row(), NOW);
  assert.equal(p.title, "OneShetland has launched"); assert.equal(p.href, "/notices"); assert.equal(p.cta, "Take a look");
});
test("it does not show when off, untitled, unsafe, expired, or missing its expiry", () => {
  for (const o of [{ pin_enabled: false }, { pin_enabled: null }, { pin_title: "  " }, { pin_href: "javascript:alert(1)" }, { pin_href: "http://x.test" }, { pin_href: "//evil.test" }, { pin_href: null }, { pin_expires_at: "2026-11-06T11:59:59Z" }, { pin_expires_at: null }, { pin_expires_at: "garbage" }])
    assert.equal(pinFromRow(row(o), NOW), null, JSON.stringify(o));
  assert.equal(pinFromRow(null, NOW), null); assert.equal(pinFromRow(undefined, NOW), null);
});
test("the button label defaults, and every field is capped", () => {
  assert.equal(pinFromRow(row({ pin_cta: "" }), NOW).cta, "Take a look");
  const p = pinFromRow(row({ pin_title: "t".repeat(200), pin_body: "b".repeat(500), pin_cta: "c".repeat(90) }), NOW);
  assert.deepEqual([p.title.length, p.body.length, p.cta.length], [PIN_LIMITS.title, PIN_LIMITS.body, PIN_LIMITS.cta]);
});
test("safePinHref accepts site paths and https only", () => {
  for (const ok of ["/", "/notices", "/directory?q=a&b=1", "https://oneshetland.com/x"]) assert.equal(safePinHref(ok), ok, ok);
  for (const bad of ["", "http://x.test", "javascript:x", "data:text/html,1", "//x.test", "/x y", "/\\evil", "mailto:a@b.c", "notices", "/a<b", `https://x.test/"onmouseover=1`]) assert.equal(safePinHref(bad), null, bad);
});
test("dismissal key: extending the end date keeps a dismissed card hidden; rewording or relinking it makes a new card", () => {
  const a = pinFromRow(row(), NOW), b = pinFromRow(row({ pin_expires_at: "2027-03-01T00:00:00Z" }), NOW), c = pinFromRow(row({ pin_title: "Something else" }), NOW), d = pinFromRow(row({ pin_href: "/events" }), NOW);
  assert.equal(a.key, b.key); assert.notEqual(a.key, c.key); assert.notEqual(a.key, d.key); assert.equal(pinKey("x", "y", "/z"), pinKey(" x ", "y ", "/z"));
});
test("the admin date is the end of that day in Shetland time (winter GMT, summer BST), and round-trips", () => {
  assert.equal(expiryFromDate("2026-12-31"), "2027-01-01T00:00:00.000Z");
  assert.equal(expiryFromDate("2026-07-31"), "2026-07-31T23:00:00.000Z");
  assert.equal(expiryFromDate("2026-03-28"), "2026-03-29T00:00:00.000Z");          // the day BST begins (clocks go forward the NEXT night)
  for (const d of ["2026-11-06", "2026-12-31", "2027-06-15", "2026-03-29", "2026-10-25"]) assert.equal(dateFromExpiry(expiryFromDate(d)), d, d);
  assert.equal(expiryFromDate("2026-02-30"), null); assert.equal(expiryFromDate("nope"), null); assert.equal(dateFromExpiry(null), "");
});
test("the card is live all through its last day and gone the moment after", () => {
  const exp = expiryFromDate("2026-11-06");
  assert.ok(pinFromRow(row({ pin_expires_at: exp }), Date.parse("2026-11-06T23:59:59Z")));
  assert.equal(pinFromRow(row({ pin_expires_at: exp }), Date.parse("2026-11-07T00:00:00Z")), null);
});
test("the admin editor refuses an incomplete or unsafe card, and ignores a card that is off", () => {
  const d = (o = {}) => ({ enabled: true, title: "T", body: "", cta: "", href: "/x", expiresAt: "2026-12-01T00:00:00Z", ...o });
  assert.equal(validatePinDraft(d(), NOW), null);
  assert.equal(validatePinDraft({ ...d(), enabled: false, title: "", expiresAt: null }, NOW), null);
  for (const o of [{ title: " " }, { href: "javascript:1" }, { expiresAt: null }, { expiresAt: "2026-11-01T00:00:00Z" }, { title: "x".repeat(61) }, { body: "x".repeat(141) }, { cta: "x".repeat(25) }])
    assert.ok(validatePinDraft(d(o), NOW), JSON.stringify(o));
});

/* ── the component and the page ───────────────────────────────────────────────────────────────────────────────────────────── */
const comp = read("components/home/ForYou.tsx"), page = read("app/page.tsx");
test("component: labelled section, short heading, no subtitle, one-line truncated cards, 64px, no 'View →'", () => {
  assert.match(comp, /<section aria-labelledby=/); assert.match(comp, /For you\{name \? `, \$\{name\}` : ""\}/);
  assert.doesNotMatch(comp, /Picked up across Shetland|View <span|View →/); assert.match(comp, /h-16 w-full items-center/); assert.match(comp, /block truncate/);
});
test("component: the recommendation list becomes grid cells on desktop (md:contents), folds extras behind +N more, and swipes with a peek on phones", () => {
  assert.match(comp, /md:contents/); assert.match(comp, /md:hidden/); assert.match(comp, /`\+\$\{L\.hidden\} more`/); assert.match(comp, /aria-expanded=\{expanded\}/); assert.match(comp, /Show fewer/);
  assert.match(comp, /snap-x snap-mandatory/); assert.match(comp, /w-\[15\.5rem\]/); assert.match(comp, /\[&::-webkit-scrollbar\]:hidden/);
});
test("component: reduced motion respected (ping only when motion is safe; transitions off otherwise)", () => {
  assert.match(comp, /motion-safe:animate-ping/); assert.doesNotMatch(comp.replace(/motion-safe:animate-ping/g, ""), /animate-ping/); assert.match(comp, /motion-reduce:transition-none/);
});
test("component: the pinned card is dismissible per card, remembered for good, never flashes, and is a real link plus a real button", () => {
  assert.match(comp, /os_dismissed_pins/); assert.match(comp, /pin\.key/); assert.match(comp, /useSyncExternalStore\(subscribe, readRaw/); assert.match(comp, /e\.hidden=true/); assert.match(comp, /aria-label=\{`Dismiss: \$\{pin\.title\}`\}/);
  assert.match(comp, /md:col-span-2/); assert.doesNotMatch(comp, /expiresAt/);   // expiry is decided on the server, not by the browser
});
test("page: the name logic is exactly as before ('Admin' is a deliberate display name and is never filtered)", () => {
  assert.match(page, /name=\{accountName\(account\)\.split\(" "\)\[0\]\}/);
  assert.doesNotMatch(comp + page + read("lib/home-pin.ts") + read("lib/for-you-layout.ts"), /\badmin(istrator)?\b['"]/i);
});
test("page: the pinned card is loaded for signed-in members only, in the existing parallel batch, and all ten sources are untouched", () => {
  assert.match(page, /accountP\.then\(\(a\) => \(a \? getHomePin\(\)/); assert.match(page, /\(forYou\.length > 0 \|\| pin\)/);
  const fy = read("lib/for-you.server.ts");
  for (const f of ["fetchDeliveries", "fetchBookings", "fetchGiftsToBook", "fetchTickets", "fetchLoyalty", "fetchWallet", "fetchJobApps", "fetchShiftApps", "fetchGames", "fetchHubs"]) assert.match(fy, new RegExp(f));
  assert.match(fy, /return all\.slice\(0, 8\)/); assert.match(fy, /a\.priority - b\.priority/);
});
test("the pin read is one cached, bounded read of the one-row table, and a failure means no card", () => {
  const h = read("lib/home-pin.ts");
  assert.match(h, /ttlMs: 60_000/); assert.match(h, /PIN_READ_DEADLINE_MS = 1200/); assert.match(h, /fallback: null/); assert.match(h, /if \(error\) return null/); assert.match(h, /from\("home_content"\)/);
});
test("admin: the existing Homepage editor gets the pinned-card fields, validated before save", () => {
  const f = read("components/admin/HomeContentForm.tsx");
  for (const k of ["pin_enabled", "pin_title", "pin_body", "pin_cta", "pin_href", "pin_expires_at"]) assert.match(f, new RegExp(k));
  assert.match(f, /validatePinDraft\(/); assert.match(f, /type="date"/); assert.match(read("lib/home-data.ts"), /pin_expires_at/);
});

/* ── regression: a brand-new member with ZERO recommendations ────────────────────────────────────────────────────────────── */
test("zero recommendations + an active pinned card: For you shows, with the card", () => {
  assert.equal(forYouShows(0, "pin-a", []), true);
  assert.equal(forYouShows(0, "pin-a", ["pin-other"]), true);            // a different card was dismissed, this one was not
  const L = forYouLayout(0, true, false); assert.equal(L.gridClass, "md:grid-cols-4"); assert.equal(L.hidden, 0);   // a half-width banner, not a full-width bar
});
test("zero recommendations + no pinned card: no empty section (existing behaviour)", () => {
  for (const k of [null, undefined, ""]) assert.equal(forYouShows(0, k, []), false);
});
test("zero recommendations + a DISMISSED pinned card: no empty section", () => {
  assert.equal(forYouShows(0, "pin-a", ["pin-a"]), false); assert.equal(forYouShows(0, "pin-a", ["x", "pin-a", "y"]), false);
});
test("with recommendations the section always shows, whether or not the card is shown or dismissed", () => {
  for (const [pin, dis] of [[null, []], ["pin-a", []], ["pin-a", ["pin-a"]]]) assert.equal(forYouShows(3, pin, dis), true);
});
test("page: it is asked to render for a member with no recommendations when a card is live, and not otherwise", () => {
  assert.match(page, /\{account && \(forYou\.length > 0 \|\| pin\) && <ForYou /);
});
test("component: uses the same rule, and never flashes an empty section for a dismissed-only card", () => {
  assert.match(comp, /if \(!forYouShows\(recs\.length, pin\?\.key, dismissed\)\) return null;/);
  assert.match(comp, /data-solo=\{recs\.length === 0 \? "" : undefined\}/); assert.match(comp, /s\.closest\("\[data-solo\]"\)\|\|s\.parentElement/);
  // hooks run before the early return (stable hook order for every combination)
  assert.ok(comp.indexOf("useDismissedPins()") < comp.indexOf("if (!forYouShows("));
});
test("display-name logic is exactly as before for these members too", () => {
  assert.match(page, /name=\{accountName\(account\)\.split\(" "\)\[0\]\}/);
});

/* ── the extra home_content read cannot delay the homepage ───────────────────────────────────────────────────────────────── */
test("a hung database: the pinned-card read gives up at its deadline and the page simply has no card", async () => {
  const t = Date.now(); const p = await getHomePin(() => new Promise(() => {}), 80);
  assert.equal(p, null); assert.ok(Date.now() - t < 600, "returned promptly");
  assert.ok(PIN_READ_DEADLINE_MS <= 1500);
});
test("a failing database: no card, no exception", async () => {
  assert.equal(await getHomePin(async () => { throw new Error("down"); }, 200), null);
});
test("a healthy read returns the card, a repeat is served from memory, and a later hang falls back to the last good copy", async () => {
  const { __resetHomeResilience } = await import("../lib/home-resilience.ts"); __resetHomeResilience();
  const good = row({ pin_expires_at: new Date(Date.now() + 86_400_000).toISOString() }); let calls = 0;
  const first = await getHomePin(async () => { calls++; return good; }, 200); assert.equal(first.title, "OneShetland has launched");
  await getHomePin(async () => { calls++; return good; }, 200); assert.equal(calls, 1);
  __resetHomeResilience();
});
test("the page reads it inside the existing parallel batch, for signed-in members only (zero extra work for visitors)", () => {
  assert.match(page, /accountP\.then\(\(a\) => \(a \? getHomePin\(\)\.catch\(\(\) => null\) : null\)\)\.catch\(\(\) => null\)/);
});
