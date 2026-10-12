/**
 * platform.ts — the three launch platforms and how each is described to people. Pure (no browser or server APIs), so the rules are testable.
 * Web is first-class: it is judged on its own and is never combined with an iPhone or Android result.
 */
import type { DeviceClass, LaunchTest, Platform } from "./types.ts";

export const PLATFORMS: readonly Platform[] = ["web", "ios", "android"] as const;
export const PLATFORM_LABEL: Record<Platform, string> = { web: "Website", ios: "iPhone", android: "Android" };
/** Longer wording for the chooser. */
export const PLATFORM_BLURB: Record<Platform, string> = {
  web: "The live OneShetland website, in your browser",
  ios: "The OneShetland iPhone app",
  android: "The OneShetland Android app",
};
export const LIVE_WEBSITE_LABEL = "Live OneShetland website";

export const isPlatform = (p: unknown): p is Platform => p === "web" || p === "ios" || p === "android";

/** A tester's platforms. An empty list means every platform (how the database treats it too). */
export function platformsFor(assigned: readonly Platform[] | null | undefined): Platform[] {
  const a = (assigned ?? []).filter(isPlatform);
  return a.length ? PLATFORMS.filter((p) => a.includes(p)) : [...PLATFORMS];
}

/**
 * The number people see for a test: its position (1, 2, 3 …) in the programme's active tests ordered by sort_order — never the raw sort_order
 * (10, 20 … is only there so tests can be slotted in later). It is canonical across platforms: Website, iPhone and Android all call the
 * shared tests 1–9, and the Website-only checks keep 10 and 11 rather than being renumbered per platform. Inactive tests have no number.
 */
export function testNumbers(tests: Array<{ id: string; slug?: string; sort_order: number; active: boolean }>): Map<string, number> {
  const ordered = tests.filter((t) => t.active).sort((a, b) => a.sort_order - b.sort_order || (a.slug ?? a.id).localeCompare(b.slug ?? b.id));
  return new Map(ordered.map((t, i) => [t.id, i + 1]));
}

/** Whether a test applies on a platform ('all' = every platform; a test with its own platform applies there only). */
export const appliesTo = (test: Pick<LaunchTest, "platform">, platform: Platform) => test.platform === "all" || test.platform === platform;

/** The steps a tester should follow: the website wording on web (when there is any), otherwise the shared steps. */
export function stepsFor(test: Pick<LaunchTest, "steps" | "web_steps">, platform: Platform): string[] {
  return platform === "web" && test.web_steps?.length ? test.web_steps : test.steps;
}

/** Where to "go and do it": never mentions the mobile app on the web. */
export function whereToDoIt(platform: Platform): string {
  if (platform === "web") return "Open the OneShetland website in your browser to do this.";
  return `Open the OneShetland app on your ${platform === "ios" ? "iPhone" : "Android phone"} to do this.`;
}
export function goTryIt(platform: Platform): string {
  return platform === "web" ? "Go and try it on the OneShetland website, then come back and tell us." : "Go and try it in the OneShetland app, then come back and tell us.";
}

export interface WebContext { browser: string | null; deviceClass: DeviceClass | null; viewport: string | null }

/** Coarse, non-identifying browser facts from the user-agent string and window size. No fingerprinting: just a name, a class and a size. */
export function detectWebContext(ua: string, width?: number, height?: number, touch = false): WebContext {
  const s = ua || "";
  let browser: string | null = null;
  const m = (re: RegExp, name: string) => { const r = re.exec(s); return r ? `${name} ${r[1].split(".")[0]}` : null; };
  browser = m(/Edg(?:e|A|iOS)?\/([\d.]+)/, "Edge") ?? m(/OPR\/([\d.]+)/, "Opera") ?? m(/(?:Chrome|CriOS)\/([\d.]+)/, "Chrome")
    ?? m(/(?:Firefox|FxiOS)\/([\d.]+)/, "Firefox") ?? (/Safari\//.test(s) ? m(/Version\/([\d.]+)/, "Safari") ?? "Safari" : null);
  let deviceClass: DeviceClass | null = null;
  if (/iPad|Tablet/i.test(s) || (/Macintosh/.test(s) && touch)) deviceClass = "tablet";
  else if (/Android/i.test(s)) deviceClass = /Mobile/i.test(s) ? "mobile" : "tablet";
  else if (/iPhone|iPod|Mobile/i.test(s)) deviceClass = "mobile";
  else if (s) deviceClass = "desktop";
  const viewport = width && height && width >= 100 && height >= 100 && width <= 99999 && height <= 99999 ? `${Math.round(width)}x${Math.round(height)}` : null;
  return { browser, deviceClass, viewport };
}

export function describeWebContext(c: { browser: string | null; device_class?: DeviceClass | null; deviceClass?: DeviceClass | null; viewport: string | null }): string {
  const cls = c.deviceClass ?? c.device_class ?? null;
  return [c.browser, cls, c.viewport ? c.viewport.replace("x", "×") : null].filter(Boolean).join(" · ");
}
