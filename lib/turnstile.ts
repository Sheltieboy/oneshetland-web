/**
 * turnstile.ts — lazy loader for the Cloudflare Turnstile widget script, so we
 * depend on no npm package. Reads NEXT_PUBLIC_TURNSTILE_SITE_KEY. Client-only.
 *
 * Mirrors lib/google-maps.ts's loader shape exactly — same singleton-promise,
 * same "existing <script> tag" guard against a double-mount re-triggering a
 * second load.
 *
 * The SITE key is not secret (Cloudflare's own model: it's meant to ship in
 * the page). The SECRET key never appears anywhere in this file, this repo,
 * or any client bundle — it is only ever used server-side, by Supabase Auth
 * itself when verifying the token this widget produces.
 */

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  /**
   * "always"           — the widget is permanently visible (Cloudflare's default).
   * "interaction-only" — invisible unless Cloudflare actually needs the visitor
   *                      to do something. The token still arrives through the
   *                      normal `callback`, so nothing about the flow changes.
   * "execute"          — render now, run the check later via turnstile.execute().
   */
  appearance?: "always" | "execute" | "interaction-only";
  /** "flexible" fills the container width (min 300px) instead of a fixed 300px box. */
  size?: "normal" | "flexible" | "compact";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

let promise: Promise<void> | null = null;

export function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve();
  if (promise) return promise;
  promise = new Promise<void>((resolve, reject) => {
    const done = () => (window.turnstile ? resolve() : fail());
    const fail = () => { promise = null; reject(new Error("load-failed")); };
    const existing = document.getElementById("os-turnstile") as HTMLScriptElement | null;
    if (existing) {
      if (window.turnstile) return resolve();
      existing.addEventListener("load", done);
      existing.addEventListener("error", fail);
      return;
    }
    const s = document.createElement("script");
    s.id = "os-turnstile";
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.onload = done;
    s.onerror = fail;
    document.head.appendChild(s);
  });
  return promise;
}
