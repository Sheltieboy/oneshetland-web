"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import { PROMPTS, SHOW_DELAY_MS, createPromptController, decidePrompt, isExcludedRoute, type PromptPlatform } from "@/lib/app-prompt";

/**
 * AppInstallPrompt — a slim, dismissible "get the app" bar for eligible phones (today: Android phones only; see lib/app-prompt.ts).
 *
 * Client-only: it renders nothing on the server and nothing until ~4s after the page is ready, so it never changes server-rendered content or causes
 * layout shift on load. It is NOT a modal: no overlay, no focus trap, no focus stealing — it is an ordinary landmark you can Tab past.
 * It waits for the analytics-consent banner to be answered first (both are fixed to the bottom edge and must not stack).
 */
const CONSENT_KEY = "os_analytics_consent";
const BAR_HEIGHT = 96;

const noopSubscribe = () => () => {};
const readUa = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

export function AppInstallPrompt() {
  const pathname = usePathname() ?? "/";
  const ua = useSyncExternalStore(noopSubscribe, readUa, () => "");
  const [active, setActive] = useState<PromptPlatform | null>(null);
  const [entered, setEntered] = useState(false);
  const controller = useRef<ReturnType<typeof createPromptController> | null>(null);
  const closed = useRef(false);   // closed in this page session, even if storage is unavailable

  // Once per page session: decide eligibility, wait the delay (and for the consent banner to be answered), then show. After it has appeared it stays
  // put while the visitor browses ordinary pages (no repeat "shown" events); it is simply not drawn on excluded routes.
  useEffect(() => {
    if (controller.current || closed.current) return;
    const store = (() => { try { return window.localStorage; } catch { return null; } })();
    if (!decidePrompt({ ua, pathname, store, now: Date.now() }).platform) return;
    let cancelled = false; let poll: ReturnType<typeof setInterval> | undefined; let raf = 0;
    const consentAnswered = () => { try { return window.localStorage.getItem(CONSENT_KEY) !== null; } catch { return true; } };
    const reveal = () => {
      if (cancelled) return;
      // Re-check at the moment of showing: the visitor may have moved to an excluded page, or dismissed in another tab, during the delay.
      const d = decidePrompt({ ua, pathname: window.location.pathname, store, now: Date.now() });
      if (!d.platform) return;
      const ctl = createPromptController({ platform: d.platform, store, track: (e, props) => track(e, { props }), now: () => Date.now(), route: window.location.pathname });
      if (ctl.appear()) { controller.current = ctl; setActive(d.platform); raf = requestAnimationFrame(() => setEntered(true)); }
    };
    const delay = setTimeout(() => {
      if (consentAnswered()) reveal();
      else poll = setInterval(() => { if (consentAnswered()) { clearInterval(poll); reveal(); } }, 1500);
    }, SHOW_DELAY_MS);
    return () => { cancelled = true; clearTimeout(delay); clearInterval(poll); cancelAnimationFrame(raf); };
  }, [ua, pathname]);

  const platform = active && !isExcludedRoute(pathname) ? active : null;
  const cfg = platform ? PROMPTS[platform] : null;
  if (!platform || !cfg || !cfg.storeUrl) return null;

  function close() { closed.current = true; controller.current?.dismiss(); controller.current = null; setEntered(false); setActive(null); }

  return (
    <>
      {/* In-flow spacer at the very end of the page: lets the footer scroll clear of the fixed bar. No effect on content above it. */}
      <div aria-hidden style={{ height: BAR_HEIGHT }} />
      <section
        aria-label={`Get the OneShetland ${platform === "android" ? "Android" : "iPhone"} app`}
        className={
          "fixed inset-x-0 bottom-0 z-40 px-3 transition-transform duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:transition-none " +
          (entered ? "translate-y-0" : "translate-y-full")
        }
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-md items-center gap-2.5 rounded-card border border-line-strong bg-paper py-2 pl-3 pr-1 shadow-lift">
          <Image src="/brand/logo-mark-keyed.png" alt="" width={36} height={36} unoptimized className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight text-ink">{cfg.headline}</p>
            <p className="mt-0.5 text-xs leading-tight text-ink-soft">{cfg.subline}</p>
          </div>
          <a
            href={cfg.storeUrl}
            rel="noopener"
            onClick={() => controller.current?.clickStore()}
            className="shrink-0 rounded-pill bg-navy px-3.5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            {cfg.cta}
          </a>
          <button
            type="button"
            onClick={close}
            aria-label="Close — don't show this again for 14 days"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>
      </section>
    </>
  );
}
