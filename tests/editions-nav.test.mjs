/**
 * The site navigation at the Editions launch.
 *
 * Two things had to happen together. Editions needed a place in the top bar, immediately after What's On — but the bar only appears at 1280px and
 * already held eight destinations plus "More", the wordmark, search, the basket, "For businesses" and the account button. So Cruise moved to the
 * "More" menu, which keeps the count the same. Nothing was removed: Cruise keeps its URL, its place in the mobile menu's "Island life" group, and
 * every other destination it had.
 *
 * And none of it may reach the public before the switch. Editions is gated on `editions_enabled()`, read once per request in app/layout.tsx and
 * passed down; with the switch off the navigation is exactly what it was, minus Cruise's position. Fails closed, like My Saved and House Swaps.
 *
 * Run: node --test tests/editions-nav.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SECTIONS, PRIMARY_NAV, MORE_NAV, EDITIONS_NAV, primaryNav } from "../lib/sections.ts";
import { mobileNavGroups } from "../lib/nav-groups.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const header = read("components/site/SiteHeader.tsx");
const menu = read("components/site/MobileMenu.tsx");
const layout = read("app/layout.tsx");

/* ── the switch decides, and it fails closed ──────────────────────────────────────────────────────────────────── */

test("off: Editions is in no navigation list at all", () => {
  assert.deepEqual(primaryNav(false), PRIMARY_NAV);
  assert.equal(primaryNav(false).some((s) => s.key === "editions"), false);
  assert.equal(MORE_NAV.some((s) => s.key === "editions"), false);
  const items = mobileNavGroups(primaryNav(false), MORE_NAV).flatMap((g) => g.items);
  assert.equal(items.some((s) => s.key === "editions"), false);
});

test("off: the mobile menu is byte-for-byte the menu it was, group for group", () => {
  const groups = mobileNavGroups(primaryNav(false), MORE_NAV);
  assert.deepEqual(groups[0].items.map((s) => s.key), ["whats-on", "local", "shop", "jobs"]);
  assert.deepEqual(groups.map((g) => g.title), [null, "Find & get things done", "Island life"]);
});

test("Editions is NOT a section: the footer and the home grid read SECTIONS, which must never carry it", () => {
  assert.equal(SECTIONS.some((s) => s.key === "editions"), false);
  assert.equal(SECTIONS.some((s) => s.href === "/editions"), false);
});

test("the flag is the public switch, read once per request in the layout and passed to the header", () => {
  assert.match(layout, /import \{ getEditionsEnabled \} from "@\/lib\/editions\/data\.server"/);
  assert.match(layout, /const editionsEnabled = await getEditionsEnabled\(\)/);
  assert.match(layout, /<SiteHeader [^>]*editionsEnabled=\{editionsEnabled\}/);
  // editions_enabled() alone: the header must not grant itself access by role, and must not use the per-caller organiser/staff routes.
  const flag = read("lib/editions/data.server.ts").slice(read("lib/editions/data.server.ts").indexOf("getEditionsEnabled"));
  assert.match(flag.slice(0, 400), /sb\.rpc\("editions_enabled"\)/);
  assert.match(flag.slice(0, 400), /!error && data === true/, "fails closed: only an explicit true counts");
  assert.doesNotMatch(header, /edition_staff|edition_has_organiser_access|is_admin/);
});

test("the default is off, in the function and in both components, so a caller that forgets the prop shows nothing", () => {
  // Allow further props after it (the seasonal brand flag is one); the default itself is what matters.
  assert.match(header, /editionsEnabled = false\s*[,}]/);
  assert.match(menu, /editionsEnabled = false\s*[,}]/);
  assert.equal(primaryNav(undefined).some((s) => s.key === "editions"), false);
});

/* ── on: where it goes ────────────────────────────────────────────────────────────────────────────────────────── */

test("on: Editions sits immediately after What's On in the bar, and nowhere else", () => {
  const keys = primaryNav(true).map((s) => s.key);
  assert.deepEqual(keys, ["whats-on", "editions", "local", "shop", "games", "jobs", "directory", "hubs"]);
  assert.equal(keys.filter((k) => k === "editions").length, 1);
});

test("on: it links to /editions and is labelled Editions", () => {
  assert.equal(EDITIONS_NAV.href, "/editions");
  assert.equal(EDITIONS_NAV.label, "Editions");
});

test("on: the mobile menu gives it a prominent place — second in the featured group, straight after What's On", () => {
  const groups = mobileNavGroups(primaryNav(true), MORE_NAV);
  assert.equal(groups[0].featured, true);
  assert.deepEqual(groups[0].items.map((s) => s.key), ["whats-on", "editions", "local", "shop", "jobs"]);
});

test("on: nothing else moved, and no destination is lost or duplicated", () => {
  const items = mobileNavGroups(primaryNav(true), MORE_NAV).flatMap((g) => g.items);
  const expected = [...primaryNav(true), ...MORE_NAV];
  assert.equal(items.length, expected.length);
  assert.equal(new Set(items.map((s) => s.key)).size, items.length);
  for (const s of expected) assert.ok(items.some((i) => i.key === s.key && i.href === s.href), s.label);
});

/* ── Cruise: moved, not removed ───────────────────────────────────────────────────────────────────────────────── */

test("Cruise is out of the bar and in the More menu, with the same URL", () => {
  assert.equal(PRIMARY_NAV.some((s) => s.key === "cruise"), false);
  assert.equal(primaryNav(true).some((s) => s.key === "cruise"), false);
  const cruise = MORE_NAV.find((s) => s.key === "cruise");
  assert.ok(cruise, "Cruise is in the More menu");
  assert.equal(cruise.href, "/cruise");
  assert.deepEqual(cruise, SECTIONS.find((s) => s.key === "cruise"), "the same section object: label, colour and blurb unchanged");
});

test("the More menu renders MORE_NAV, so Cruise is one click away on desktop", () => {
  assert.match(header, /\{MORE_NAV\.map\(\(s\) =>/);
  assert.match(header, /aria-expanded=\{more\}/);
});

test("on mobile Cruise stays where it always was: first under 'Island life'", () => {
  for (const on of [false, true]) {
    const island = mobileNavGroups(primaryNav(on), MORE_NAV).find((g) => g.title === "Island life");
    assert.ok(island, "the Island life group exists");
    assert.equal(island.items[0].key, "cruise", `Cruise leads Island life (switch ${on ? "on" : "off"})`);
  }
});

/* ── one list, two surfaces ───────────────────────────────────────────────────────────────────────────────────── */

test("the header and the mobile menu build from the same function, so they cannot drift", () => {
  assert.match(header, /const nav = primaryNav\(editionsEnabled\)/);
  assert.match(header, /\{nav\.map\(\(s\) =>/);
  assert.match(menu, /mobileNavGroups\(primaryNav\(editionsEnabled\), MORE_NAV\)/);
  assert.match(header, /editionsEnabled=\{editionsEnabled\}/, "the header passes the flag on to the sheet");
  // Neither component may splice the destination itself: lib/sections.ts is the one place that decides.
  for (const [name, src] of [["header", header], ["menu", menu]]) assert.doesNotMatch(src, /EDITIONS_NAV/, `${name} must not splice it in itself`);
});

test("the bar is not squeezed to make room: every item keeps the padding it had", () => {
  assert.match(header, /className="whitespace-nowrap rounded-pill px-3 py-2 text-\[0\.9rem\] font-medium text-ink-soft/);
  assert.doesNotMatch(header, /editionsEnabled \? "px-2"/, "the item count is unchanged, so nothing needs compressing");
});

/* ── the width at which the bar appears ───────────────────────────────────────────────────────────────────────── */

/**
 * The bar used to appear at xl (1280px) while the header row was capped at max-w-7xl (1280px) at EVERY width above it.
 * The fullest signed-in header does not fit in 1240px of content, so it overflowed its own row and gave the page a
 * horizontal scrollbar — on the live site as well as here. Raising the breakpoint alone could not fix it, because the
 * cap applied at 1536 exactly as at 1280. So the row may now reach 1440px, and the bar appears at 1440px.
 */
test("one number decides it, in all five places", () => {
  assert.equal((header.match(/min-\[1440px\]:/g) ?? []).length, 3, "the row cap, the nav, and the menu button");
  assert.match(header, /max-w-7xl[^"]*min-\[1440px\]:max-w-\[90rem\]/, "the row may grow past 1280 from the breakpoint up");
  assert.match(header, /<nav className="hidden items-center gap-0\.5 min-\[1440px\]:flex">/);
  assert.match(header, /aria-controls="site-menu"[\s\S]{0,400}min-\[1440px\]:hidden/);
  assert.match(menu, /min-\[1440px\]:hidden/, "the sheet itself");
  assert.match(menu, /matchMedia\("\(min-width: 1440px\)"\)/, "and the query that closes it");
});

test("there is always exactly one way in: the bar and the menu button swap at the same width", () => {
  // The nav is `hidden` + `min-[1440px]:flex`; the button is shown by default + `min-[1440px]:hidden`. Complementary at
  // one number. If these ever drifted apart, a band of widths would have both or — far worse — neither.
  const navShown = /className="hidden items-center gap-0\.5 (min-\[\d+px\]):flex"/.exec(header)?.[1];
  const buttonHidden = /aria-controls="site-menu"[\s\S]{0,400}(min-\[\d+px\]):hidden/.exec(header)?.[1];
  const sheetHidden = /bg-cream (min-\[\d+px\]):hidden/.exec(menu)?.[1];
  const query = /matchMedia\("\(min-width: (\d+)px\)"\)/.exec(menu)?.[1];
  assert.ok(navShown && buttonHidden && sheetHidden && query, "all four must be present");
  assert.equal(navShown, buttonHidden, "the bar appears exactly where the menu button goes");
  assert.equal(navShown, sheetHidden, "and where the sheet stops being used");
  assert.equal(navShown, `min-[${query}px]`, "the media query must match the classes, or the open sheet never closes");
});

test("the old 1280 breakpoint is gone from the header pair, so nothing is half-moved", () => {
  assert.doesNotMatch(header, /xl:flex|xl:hidden/);
  assert.doesNotMatch(menu, /xl:hidden|min-width: 1280px/);
});

test("'For businesses' deliberately stays at 1280: nobody who had it loses it", () => {
  assert.match(header, /href="\/business"[\s\S]{0,400}xl:inline-flex/);
});

test("below the breakpoint the row is capped exactly as it was", () => {
  assert.match(header, /max-w-7xl/, "max-w-7xl is still the default; the wider cap is additive");
});

test("an Edition's own navigation is not touched by any of this", () => {
  for (const f of ["components/site/SiteHeader.tsx", "components/site/MobileMenu.tsx", "lib/sections.ts", "lib/nav-groups.ts"]) {
    assert.doesNotMatch(read(f), /editions\/\[slug\]|EditionNav|edition-nav/, f);
  }
});
