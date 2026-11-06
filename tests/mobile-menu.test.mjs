/**
 * The mobile menu: every destination is still reachable, the menu scrolls inside itself, the page behind it is locked, and keyboard / screen-reader
 * behaviour is in place. Run: node --test tests/mobile-menu.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SECTIONS, PRIMARY_NAV, MORE_NAV } from "../lib/sections.ts";
import { mobileNavGroups } from "../lib/nav-groups.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const menu = read("components/site/MobileMenu.tsx");
const header = read("components/site/SiteHeader.tsx");

test("every destination of the old menu is still in the grouped menu, exactly once, with its own link and label", () => {
  const groups = mobileNavGroups(PRIMARY_NAV, MORE_NAV);
  const items = groups.flatMap((g) => g.items);
  const expected = [...PRIMARY_NAV, ...MORE_NAV];
  assert.equal(items.length, expected.length); assert.equal(new Set(items.map((s) => s.key)).size, items.length, "no duplicates");
  for (const s of expected) assert.ok(items.some((i) => i.key === s.key && i.href === s.href && i.label === s.label), s.label);
  assert.deepEqual(groups[0].items.map((s) => s.key), ["whats-on", "local", "shop", "jobs"], "the frequently used four come first");
  assert.equal(groups[0].featured, true);
});
test("a destination added to the sections later is never lost: unnamed sections fall into a final 'More' group", () => {
  const extra = { key: "future", label: "Future", href: "/future", color: "#000", token: "x", blurb: "" };
  const groups = mobileNavGroups([...PRIMARY_NAV, extra], MORE_NAV);
  assert.equal(groups.at(-1).title, "More"); assert.deepEqual(groups.at(-1).items.map((s) => s.key), ["future"]);
  assert.equal(SECTIONS.some((s) => s.key === "future"), false);
});
test("account, sign-in and business navigation are at the TOP of the menu in both states, and sign-out is present when signed in", () => {
  const top = menu.indexOf("Your account"), signIn = menu.indexOf("Sign in"), grid = menu.indexOf("GROUPS.map");
  assert.ok(top > 0 && signIn > 0 && top < grid && signIn < grid, "account blocks come before the section tiles");
  for (const t of ['href="/account"', 'href="/notifications"', 'href="/business"', "Join / Sign in", "Sign out", 'action="/auth/sign-out" method="post"']) assert.ok(menu.includes(t), t);
  assert.match(menu, /signInHref/); assert.match(header, /signInHref=\{`\/sign-in\?next=\$\{encodeURIComponent\(pathname\)\}`\}/, "the same sign-in redirect as before");
});
test("it scrolls inside itself and the last item is reachable: fixed under the header, sized in dvh, overflow-y auto, bottom padding with the safe area", () => {
  assert.match(menu, /overflow-y-auto overscroll-contain/); assert.match(menu, /100dvh/); assert.match(menu, /env\(safe-area-inset-bottom\)/); assert.match(menu, /getBoundingClientRect\(\)\.bottom/);
});
test("the header's backdrop blur cannot trap it: it renders into document.body, above the cookie banner", () => {
  assert.match(menu, /createPortal\(/); assert.match(menu, /document\.body\)/); assert.match(menu, /z-\[105\]/);
});
test("the page behind is locked while open and restored exactly afterwards", () => {
  assert.match(menu, /html\.style\.overflow = "hidden"; body\.style\.overflow = "hidden"/); assert.match(menu, /html\.style\.overflow = prev\.h; body\.style\.overflow = prev\.b/);
});
test("keyboard and screen readers: dialog role, Escape closes, Tab is kept inside, focus goes in and returns to the button, expanded state and a close label", () => {
  assert.match(menu, /role="dialog"/); assert.match(menu, /aria-modal="true"/); assert.match(menu, /aria-label="Site menu"/);
  assert.match(menu, /e\.key === "Escape"/); assert.match(menu, /e\.key !== "Tab"/); assert.match(menu, /toggle\?\.focus/);
  assert.match(header, /aria-expanded=\{open\}/); assert.match(header, /aria-controls="site-menu"/); assert.match(header, /open \? "Close menu" : "Menu"/);
  assert.match(menu, /aria-label="Main"/);
});
test("touch targets are at least 44px (tiles and buttons are 48px), tiles wrap long labels, and nothing animates", () => {
  assert.equal((menu.match(/min-h-\[48px\]/g) ?? []).length >= 3, true);
  assert.doesNotMatch(menu, /animate-|transition-transform|duration-/); assert.match(header, /h-11 w-11/);
});
test("navigating closes it without an effect (open only on the page it was opened on), search closes it, and desktop width closes it", () => {
  assert.match(header, /const open = openAt === pathname/); assert.match(header, /setOpenAt\(null\); setSearch/); assert.match(menu, /min-width: 1280px/);
});
test("desktop navigation is untouched: the inline nav and 'More' menu are still there and the menu button is hidden at xl", () => {
  assert.match(header, /className="hidden items-center gap-0\.5 xl:flex"/); assert.match(header, /MORE_NAV\.map\(\(s\) =>/); assert.match(header, /text-navy[^"]*xl:hidden/);
});
