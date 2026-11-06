/**
 * The iOS/Android sign-in security page is minimal and privacy-safe. Run: node --test tests/mobile-turnstile-minimal.test.mjs
 * It must not carry the cookie banner or any analytics, and every other page must keep them.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const PRIVATE_PREFIXES = [...read("components/site/HideOnPrivateRoutes.tsx").match(/PRIVATE_PREFIXES = \[([\s\S]*?)\];/)[1].replace(/\/\/.*$/gm, "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const hidden = (path) => PRIVATE_PREFIXES.some((p) => path.startsWith(p));

test("the challenge page hides banner, analytics, GA4, header, footer and install prompt", () => {
  assert.ok(hidden("/mobile-turnstile-challenge"));
  assert.ok(hidden("/mobile-turnstile-challenge?x=1".split("?")[0]));
  const layout = read("app/layout.tsx");
  for (const c of ["AnalyticsProvider", "GoogleAnalytics", "ConsentBanner", "SiteHeader", "SiteFooter", "AppInstallPrompt"]) {
    assert.match(layout, new RegExp(`<HideOnPrivateRoutes><${c}[ />]`), `${c} must be wrapped`);
  }
});
test("ordinary pages keep the cookie choice and analytics", () => {
  for (const p of ["/", "/sign-in", "/sign-up", "/directory", "/whats-on", "/privacy", "/mobile-turnstile", "/account", "/accessible"]) assert.equal(hidden(p), false, p);
  assert.ok(hidden("/launch/some-partner"), "private previews still hidden");
});
test("the challenge page itself loads nothing optional", () => {
  const page = read("app/mobile-turnstile-challenge/page.tsx");
  assert.doesNotMatch(page, /analytics|ga4|gtag|track\(|ConsentBanner|setAnalyticsConsent|localStorage|document\.cookie/i);
  const lib = read("lib/mobile-turnstile-challenge.ts");
  assert.doesNotMatch(lib, /analytics|ga4|gtag|localStorage|document\.cookie/i);
});
test("GA4 stays behind consent everywhere else (nothing loads before an explicit opt-in)", () => {
  const ga = read("lib/ga4.ts");
  assert.match(ga, /ONLY after the visitor opts in/);
  assert.match(read("components/analytics/GoogleAnalytics.tsx"), /if \(getAnalyticsConsent\(\)\) enableGa4/);
});
