/**
 * app-prompt.ts — the rules behind the slim "get the app" bar. Pure (no browser APIs, no React), so every rule is testable under plain node.
 *
 * One prompt shape, configured per platform. ONLY Android is switched on. iPhone is deliberately configured but disabled until Apple approves the
 * app: enabling it later means setting `enabled: true` and filling in `storeUrl` below — the bar, the 14-day dismissal and the analytics shape are shared.
 */

export type PromptPlatform = "android" | "ios";

export interface PromptConfig {
  enabled: boolean;
  /** The PUBLIC store listing (never an internal-testing, EAS, staging or console URL). null until the platform is live. */
  storeUrl: string | null;
  headline: string;
  subline: string;
  cta: string;
  storageKey: string;
  /** Analytics event names, one set per platform. */
  events: { shown: string; dismissed: string; clicked: string };
}

export const ANDROID_PACKAGE = "com.oneshetland.app";
export const GOOGLE_PLAY_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export const PROMPTS: Record<PromptPlatform, PromptConfig> = {
  android: {
    enabled: true,
    storeUrl: GOOGLE_PLAY_URL,
    headline: "OneShetland is on Android",
    subline: "Take Shetland with you",
    cta: "Get the app",
    storageKey: "os_app_prompt_dismissed_android",
    events: { shown: "android_app_prompt_shown", dismissed: "android_app_prompt_dismissed", clicked: "android_app_prompt_play_store_clicked" },
  },
  // Apple approval is still pending: NOT enabled. Set enabled + storeUrl (and the copy, if different) when OneShetland is live on the App Store.
  ios: {
    enabled: false,
    storeUrl: null,
    headline: "OneShetland is on iPhone",
    subline: "Take Shetland with you",
    cta: "Get the app",
    storageKey: "os_app_prompt_dismissed_ios",
    events: { shown: "ios_app_prompt_shown", dismissed: "ios_app_prompt_dismissed", clicked: "ios_app_prompt_app_store_clicked" },
  },
};

export const SHOW_DELAY_MS = 4000;
export const DISMISS_DAYS = 14;
export const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;

export type DeviceKind = "android-phone" | "android-tablet" | "ios" | "desktop" | "bot" | "in-app";

const BOT = /bot|crawl|spider|slurp|lighthouse|headless|prerender|facebookexternalhit|preview|monitor|pingdom|uptime|curl|wget|python-requests/i;
/** Browsers embedded inside other apps, including OneShetland's own WebView: an install prompt makes no sense there. */
const IN_APP = /; wv\)|\bwv\b|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly/i;

/** Android phones identify as "Android … Mobile"; Android tablets omit "Mobile". Desktop-site mode (no "Android") is treated as desktop. */
export function classifyDevice(ua: string | null | undefined): DeviceKind {
  const s = ua ?? "";
  if (!s || BOT.test(s)) return "bot";
  if (/iPhone|iPad|iPod/i.test(s)) return "ios";
  if (/Android/i.test(s)) {
    if (IN_APP.test(s)) return "in-app";
    return /Mobile/i.test(s) ? "android-phone" : "android-tablet";
  }
  return "desktop";
}

/** Which platform's prompt (if any) this device may see. Only Android phones, and only while that platform's prompt is enabled. */
export function promptPlatformFor(kind: DeviceKind): PromptPlatform | null {
  if (kind === "android-phone" && PROMPTS.android.enabled) return "android";
  if (kind === "ios" && PROMPTS.ios.enabled) return "ios";   // dormant: ios.enabled is false
  return null;
}

/**
 * Routes where a fixed bar would be a distraction or could sit on top of an action: admin, the private Test Centre, sign-in / sign-up / account
 * recovery, account management, business management, checkout / payment / Wallet / basket, one-time ticket & gift links, event check-in and the
 * product page (which carries the buy action). Normal public discovery pages are NOT listed, so they stay eligible.
 */
const EXCLUDED_PREFIXES = [
  "/admin", "/launch-testing", "/launch", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth", "/welcome", "/delete-account",
  "/account", "/basket", "/product", "/t", "/g", "/go", "/work-profile", "/notifications",
];
const EXCLUDED_SEGMENTS = /(^|\/)(checkout|pay|payment|payments|wallet|topup|top-up|cart|check-in|manage|approve)(\/|$)/i;

export function isExcludedRoute(pathname: string | null | undefined): boolean {
  const p = (pathname ?? "").split("?")[0].split("#")[0].toLowerCase() || "/";
  if (EXCLUDED_PREFIXES.some((x) => p === x || p.startsWith(x + "/"))) return true;
  return EXCLUDED_SEGMENTS.test(p);
}

// ── dismissal (local only — nothing is stored on the server) ─────────────────────────────────────────────────────────────────
export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

/** Dismissed within the last 14 days? Unreadable or corrupt values count as "not dismissed"; storage failures never throw. */
export function isDismissed(store: KeyValueStore | null | undefined, key: string, now: number): boolean {
  try {
    const raw = store?.getItem(key);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || at <= 0) return false;
    const age = now - at;
    return age >= 0 ? age < DISMISS_MS : -age < DISMISS_MS;     // a clock set in the past still counts as recently dismissed, but not forever
  } catch { return false; }
}

export function recordDismissal(store: KeyValueStore | null | undefined, key: string, now: number): void {
  try { store?.setItem(key, String(now)); } catch { /* storage unavailable: fail quietly */ }
}

export interface PromptDecision { platform: PromptPlatform | null; reason: "ok" | "device" | "route" | "dismissed" | "disabled" }

/** The full eligibility rule, in one place. */
export function decidePrompt(input: { ua: string | null | undefined; pathname: string | null | undefined; store: KeyValueStore | null | undefined; now: number }): PromptDecision {
  const platform = promptPlatformFor(classifyDevice(input.ua));
  if (!platform) return { platform: null, reason: "device" };
  const cfg = PROMPTS[platform];
  if (!cfg.enabled || !cfg.storeUrl) return { platform: null, reason: "disabled" };
  if (isExcludedRoute(input.pathname)) return { platform: null, reason: "route" };
  if (isDismissed(input.store, cfg.storageKey, input.now)) return { platform: null, reason: "dismissed" };
  return { platform, reason: "ok" };
}

/**
 * The prompt's behaviour with the browser pieces injected (storage, analytics, clock), so the exact event rules are testable:
 * `shown` fires only when the bar actually appears (once), `dismissed` on close (and records the dismissal), `clicked` on the CTA.
 */
export function createPromptController(deps: {
  platform: PromptPlatform; store: KeyValueStore | null | undefined; track: (event: string, props: Record<string, unknown>) => void; now: () => number; route: string;
}) {
  const cfg = PROMPTS[deps.platform];
  let shown = false;
  return {
    config: cfg,
    shown: () => shown,
    appear() { if (shown) return false; shown = true; deps.track(cfg.events.shown, { route: deps.route }); return true; },
    dismiss() { if (!shown) return; recordDismissal(deps.store, cfg.storageKey, deps.now()); deps.track(cfg.events.dismissed, { route: deps.route }); },
    clickStore() { if (!shown) return; deps.track(cfg.events.clicked, { route: deps.route }); },
  };
}
