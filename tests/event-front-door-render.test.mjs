/**
 * Regression checks found during the rendered verification of the hidden front door (source-level; no network).
 * Run: node --test --import ./tests/support/register.mjs tests/event-front-door-render.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fd = readFileSync(new URL("../components/events/front-door/FrontDoor.tsx", import.meta.url), "utf8");
const pageOnly = readFileSync(new URL("../app/whats-on/add/page.tsx", import.meta.url), "utf8");
const page = pageOnly + readFileSync(new URL("../lib/event-submissions-access.server.ts", import.meta.url), "utf8");

test("every step heading can take focus, so keyboard and screen-reader users are not dropped to the page body", () => {
  assert.match(fd, /useRef<HTMLHeadingElement>/);
  assert.match(fd, /stepHeading\.current\?\.focus\(\)/);
  // One helper draws every step heading (organiser, category, ask, and the three outcomes), so none can forget its ref.
  const helper = fd.match(/const H = \(id: string[^\n]*\n\s*<h2[^>]*>/)?.[0] ?? "";
  assert.ok(helper.includes("ref={stepHeading}") && helper.includes("tabIndex={-1}"));
  assert.equal((fd.match(/\{H\("/g) ?? []).length, 6, "organiser, category, ask and the three outcome headings");
  assert.equal((fd.match(/<h2[^>]*>/g) ?? []).length, 2, "only the helper and the sign-in panel draw an h2 directly");
});

test("the first render does not steal focus", () => {
  assert.match(fd, /first\.current\) \{ first\.current = false; return; \}/);
});

test("the hidden page is noindex and carries its own canonical, not the homepage's", () => {
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /canonical: "\/whats-on\/add"/);
});

test("the front door makes no network, storage or cookie calls and the flag is server-only", () => {
  assert.doesNotMatch(fd, /fetch\(|localStorage|sessionStorage|document\.cookie|supabase/);
  assert.doesNotMatch(page, /NEXT_PUBLIC_EVENT_FRONT_DOOR/);
  assert.match(page, /process\.env\.EVENT_FRONT_DOOR/);
});
