/**
 * The Android "get the app" bar — eligibility, route exclusions, 14-day dismissal, destination, analytics rules and the accessibility contract.
 * Run: node --test tests/app-prompt.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyDevice, promptPlatformFor, isExcludedRoute, isDismissed, recordDismissal, decidePrompt, createPromptController,
  PROMPTS, GOOGLE_PLAY_URL, DISMISS_MS, SHOW_DELAY_MS,
} from "../lib/app-prompt.ts";

const ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 14; moto g power - 2024) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 14; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const BOT = "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36";
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, v), m }; };
const NOW = Date.UTC(2026, 9, 17, 12);
const decide = (o = {}) => decidePrompt({ ua: ANDROID_PHONE, pathname: "/", store: mem(), now: NOW, ...o });

describe("eligibility", () => {
  test("an Android phone is eligible", () => { assert.equal(classifyDevice(ANDROID_PHONE), "android-phone"); assert.deepEqual(decide(), { platform: "android", reason: "ok" }); });
  test("iPhone, desktop and Android tablet are not", () => {
    assert.equal(decide({ ua: IPHONE }).platform, null); assert.equal(decide({ ua: DESKTOP }).platform, null); assert.equal(decide({ ua: ANDROID_TABLET }).platform, null);
    assert.equal(classifyDevice(ANDROID_TABLET), "android-tablet"); assert.equal(classifyDevice(IPHONE), "ios");
  });
  test("bots, in-app WebViews (incl. the app's own) and empty user agents are not", () => {
    assert.equal(decide({ ua: BOT }).platform, null); assert.equal(decide({ ua: WEBVIEW }).platform, null); assert.equal(decide({ ua: "" }).platform, null); assert.equal(decide({ ua: null }).platform, null);
  });
  test("iPhone prompting exists in the structure but is OFF until Apple approves", () => {
    assert.equal(PROMPTS.ios.enabled, false); assert.equal(PROMPTS.ios.storeUrl, null); assert.equal(promptPlatformFor("ios"), null);
    assert.equal(PROMPTS.android.enabled, true);
  });
});

describe("route exclusions", () => {
  const excluded = ["/admin", "/admin/launch-testing", "/admin/launch-readiness", "/launch-testing", "/launch-testing/web-layout", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth/callback",
    "/welcome", "/account", "/account/wallet", "/account/payments", "/basket", "/product/abc", "/t/token", "/g/code", "/whats-on/123/check-in", "/business/1/manage/products", "/checkout", "/shop/checkout", "/pay/x", "/account/payments/new"];
  const allowed = ["/", "/whats-on", "/whats-on/123", "/local", "/shop", "/shop?category=art", "/directory", "/directory/some-business", "/hubs", "/hubs/oneshetland", "/games", "/jobs", "/cruise", "/spik", "/memories", "/memories/1", "/visiting", "/boats", "/support", "/terms", "/privacy"];
  test("admin, Test Centre, auth, account, checkout/payment and one-time-link routes are excluded", () => { for (const r of excluded) assert.equal(isExcludedRoute(r), true, r); });
  test("ordinary public discovery pages stay eligible", () => { for (const r of allowed) assert.equal(isExcludedRoute(r), false, r); });
  test("an excluded route yields no prompt even for an eligible phone", () => { assert.deepEqual(decide({ pathname: "/admin" }), { platform: null, reason: "route" }); assert.equal(decide({ pathname: "/launch-testing/x" }).platform, null); });
});

describe("dismissal", () => {
  const key = PROMPTS.android.storageKey;
  test("dismissing stores a local timestamp and hides the bar for 14 days", () => {
    const s = mem(); recordDismissal(s, key, NOW);
    assert.equal(s.m.get(key), String(NOW));
    assert.equal(decide({ store: s }).reason, "dismissed");
    assert.equal(decide({ store: s, now: NOW + DISMISS_MS - 1 }).platform, null);
  });
  test("after 14 days the visitor is eligible again", () => { const s = mem({ [key]: String(NOW) }); assert.equal(decide({ store: s, now: NOW + DISMISS_MS }).platform, "android"); assert.equal(DISMISS_MS, 14 * 24 * 3600 * 1000); });
  test("corrupt values are ignored; unavailable or throwing storage fails quietly", () => {
    assert.equal(isDismissed(mem({ [key]: "banana" }), key, NOW), false);
    assert.equal(isDismissed(null, key, NOW), false);
    const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    assert.equal(isDismissed(throwing, key, NOW), false); assert.doesNotThrow(() => recordDismissal(throwing, key, NOW));
    assert.equal(decide({ store: throwing }).platform, "android");
  });
  test("a clock moved back cannot hide the bar forever", () => { assert.equal(isDismissed(mem({ [key]: String(NOW + 400 * 24 * 3600 * 1000) }), key, NOW), false); });
});

describe("destination and timing", () => {
  test("the CTA is the public Google Play listing for com.oneshetland.app, and nothing internal", () => {
    assert.equal(GOOGLE_PLAY_URL, "https://play.google.com/store/apps/details?id=com.oneshetland.app");
    assert.equal(PROMPTS.android.storeUrl, GOOGLE_PLAY_URL);
    assert.doesNotMatch(PROMPTS.android.storeUrl, /internal|testing|eas|expo|staging|console|developer/i);
  });
  test("it appears about 4 seconds after load", () => { assert.equal(SHOW_DELAY_MS, 4000); });
  test("copy is the agreed copy", () => { assert.deepEqual([PROMPTS.android.headline, PROMPTS.android.subline, PROMPTS.android.cta], ["OneShetland is on Android", "Take Shetland with you", "Get the app"]); });
});

describe("analytics", () => {
  const setup = () => { const events = []; const s = mem(); const c = createPromptController({ platform: "android", store: s, track: (e, p) => events.push([e, p]), now: () => NOW, route: "/shop" }); return { events, s, c }; };
  test("shown fires once, only when the bar actually appears", () => {
    const { events, c } = setup();
    assert.equal(events.length, 0); c.dismiss(); c.clickStore(); assert.equal(events.length, 0, "nothing fires before it appears");
    assert.equal(c.appear(), true); assert.equal(c.appear(), false);
    assert.deepEqual(events, [["android_app_prompt_shown", { route: "/shop" }]]);
  });
  test("dismissed fires on close and records the dismissal; the Play Store click fires on the CTA", () => {
    const { events, s, c } = setup(); c.appear(); c.clickStore(); c.dismiss();
    assert.deepEqual(events.map((e) => e[0]), ["android_app_prompt_shown", "android_app_prompt_play_store_clicked", "android_app_prompt_dismissed"]);
    assert.equal(s.m.get(PROMPTS.android.storageKey), String(NOW));
  });
  test("events carry only the route — no personal data", () => { const { events, c } = setup(); c.appear(); assert.deepEqual(Object.keys(events[0][1]), ["route"]); });
});

describe("UI contract (source)", () => {
  const src = readFileSync(new URL("../components/site/AppInstallPrompt.tsx", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  test("accessible close button and CTA link; real logo; decorative image has empty alt", () => {
    assert.match(src, /<button[\s\S]*type="button"[\s\S]*aria-label="Close/); assert.match(src, /<a\s[\s\S]*href=\{cfg\.storeUrl\}/);
    assert.match(src, /\/brand\/logo-mark-keyed\.png/); assert.match(src, /alt=""/);
    assert.match(src, /focus-visible:outline/);
  });
  test("not a modal: no dialog role, no aria-modal, no overlay, no focus trap or focus stealing", () => {
    assert.doesNotMatch(src, /role="dialog"|aria-modal|inset-0|\.focus\(\)|autoFocus|tabIndex=\{-1\}|onKeyDown|createPortal/);
    assert.match(src, /<section[\s\S]*aria-label=/);
  });
  test("respects reduced motion, safe areas and sits below modals (z-40) and is slim", () => {
    assert.match(src, /motion-reduce:translate-y-0/); assert.match(src, /motion-reduce:transition-none/); assert.match(src, /env\(safe-area-inset-bottom\)/);
    assert.match(src, /z-40/); assert.match(src, /max-w-md/);
  });
  test("client-only, mounted once in the root layout beside the site footer, hidden on private routes; no SSR output", () => {
    assert.match(readFileSync(new URL("../components/site/AppInstallPrompt.tsx", import.meta.url), "utf8"), /^"use client";/);
    assert.match(layout, /<HideOnPrivateRoutes><AppInstallPrompt \/><\/HideOnPrivateRoutes>/);
    assert.match(src, /useSyncExternalStore\(noopSubscribe, readUa, \(\) => ""\)/);
  });
  test("it waits for the analytics-consent banner to be answered so two bottom bars never stack", () => { assert.match(src, /os_analytics_consent/); assert.match(src, /consentAnswered/); });
  test("no new dependency, no backend call, no analytics provider", () => { assert.doesNotMatch(src, /supabase|fetch\(|gtag|segment|posthog|mixpanel/i); });
});
