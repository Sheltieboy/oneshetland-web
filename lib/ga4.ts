/**
 * lib/ga4.ts — Google Analytics 4, loaded ONLY after the visitor opts in.
 *
 * Consent comes from the existing OneShetland analytics choice
 * (localStorage `os_analytics_consent`, see lib/analytics.ts). Until it is
 * "true" nothing here runs: no script is requested, no cookie is written, no
 * request reaches Google. Withdrawing consent disables measurement at once and
 * removes the GA cookies.
 *
 * Page views are sent manually (send_page_view:false) so Next.js client-side
 * navigation is counted exactly once per path — see GoogleAnalytics.tsx.
 * Only the pathname is sent, never the query string (it can carry tokens or
 * personal data).
 */

export const GA4_ID = "G-93SK16QP7V";
export const GA4_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;

type Win = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [k: string]: unknown;
};

const w = (): Win | null => (typeof window === "undefined" ? null : (window as unknown as Win));
const disableKey = `ga-disable-${GA4_ID}`;

let loaded = false;
let lastSent: string | null = null;
let active = false;

/** Create dataLayer + gtag, with consent DENIED by default. Idempotent. */
function ensureGtag(win: Win) {
  win.dataLayer = win.dataLayer || [];
  if (!win.gtag) {
    win.gtag = function () {
      // gtag.js requires the real `arguments` object, not an array.
      // eslint-disable-next-line prefer-rest-params
      (win.dataLayer as unknown[]).push(arguments);
    };
  }
}

/** Load gtag.js once. Call only when consent is granted. */
export function enableGa4(path: string): void {
  const win = w();
  if (!win) return;
  if (active) return; // already measuring: GA records later navigations itself
  active = true;
  win[disableKey] = false;
  ensureGtag(win);
  if (!loaded) {
    loaded = true;
    win.gtag!("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    win.gtag!("js", new Date());
    win.gtag!("config", GA4_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const s = document.createElement("script");
    s.async = true;
    s.src = GA4_SRC;
    document.head.appendChild(s);
  }
  win.gtag!("consent", "update", { analytics_storage: "granted" });
  sendPageView(path);
}

/** Consent withdrawn: stop measuring and clear GA cookies. */
export function disableGa4(): void {
  const win = w();
  if (!win) return;
  win[disableKey] = true;
  active = false;
  lastSent = null;
  if (win.gtag) win.gtag("consent", "update", { analytics_storage: "denied" });
  clearGaCookies();
}

/** Send one page_view for `path`; a repeat for the same path is ignored. */
export function sendPageView(path: string): void {
  const win = w();
  if (!win || !win.gtag || win[disableKey] === true) return;
  if (lastSent === path) return;
  lastSent = path;
  win.gtag("event", "page_view", {
    page_path: path,
    page_location: `${win.location.origin}${path}`,
    page_title: document.title,
  });
}

function clearGaCookies() {
  const host = location.hostname;
  const parts = host.split(".");
  const domains = new Set<string | undefined>([undefined, host]);
  for (let i = 0; i < parts.length - 1; i++) domains.add("." + parts.slice(i).join("."));
  for (const name of document.cookie.split(";").map((c) => c.split("=")[0].trim())) {
    if (name === "_ga" || name.startsWith("_ga_") || name === "_gid" || name.startsWith("_gat")) {
      for (const d of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ""}`;
      }
    }
  }
}
