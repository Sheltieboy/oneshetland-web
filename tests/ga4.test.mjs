import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ga = readFileSync(new URL("../lib/ga4.ts", import.meta.url), "utf8");
const comp = readFileSync(new URL("../components/analytics/GoogleAnalytics.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const an = readFileSync(new URL("../lib/analytics.ts", import.meta.url), "utf8");
const cfg = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

test("measurement id is G-93SK16QP7V and appears only in lib/ga4.ts", () => {
  assert.match(ga, /GA4_ID = "G-93SK16QP7V"/);
  assert.doesNotMatch(layout, /googletagmanager/);
});
test("the script is injected only inside enableGa4 (after consent), never at module load", () => {
  assert.equal((ga.match(/createElement\("script"\)/g) || []).length, 1);
  const idx = ga.indexOf('createElement("script")');
  assert.ok(idx > ga.indexOf("export function enableGa4") && idx < ga.indexOf("export function disableGa4"));
  assert.match(comp, /getAnalyticsConsent\(\)\) enableGa4/);
});
test("consent denied by default; ads signals off; automatic page_view off", () => {
  assert.match(ga, /analytics_storage: "denied"/);
  assert.match(ga, /send_page_view: false/);
  assert.match(ga, /allow_google_signals: false/);
  assert.match(ga, /ad_storage: "denied"/);
});
test("withdrawal disables measurement and clears cookies", () => {
  assert.match(ga, /win\[disableKey\] = true/);
  assert.match(ga, /clearGaCookies\(\)/);
  assert.match(an, /dispatchEvent\(new Event\(CONSENT_EVENT\)\)/);
});
test("page views: pathname only (no query string) and duplicate-suppressed", () => {
  assert.match(ga, /if \(lastSent === path\) return/);
  assert.doesNotMatch(ga, /location\.search|useSearchParams/);
  assert.doesNotMatch(comp, /useSearchParams|location\.search/);
  // GA4 enhanced measurement already records SPA navigations; a manual hit per route doubled them (measured).
  assert.doesNotMatch(comp, /usePathname/);
});
test("mounted once, inside HideOnPrivateRoutes; CSP allows Google", () => {
  assert.equal((layout.match(/<GoogleAnalytics \/>/g) || []).length, 1);
  assert.match(layout, /<HideOnPrivateRoutes><GoogleAnalytics \/><\/HideOnPrivateRoutes>/);
  assert.match(cfg, /script-src[^\n]*googletagmanager\.com/);
  assert.match(cfg, /connect-src[^\n]*google-analytics\.com/);
});
