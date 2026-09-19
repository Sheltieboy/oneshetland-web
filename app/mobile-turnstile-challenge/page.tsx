"use client";

import { useEffect, useRef, useState } from "react";
import { loadTurnstile, TURNSTILE_SITE_KEY } from "@/lib/turnstile";
import {
  startMobileChallenge,
  returnUrlFor,
  type ChallengeOutcome,
} from "@/lib/mobile-turnstile-challenge";

/**
 * /mobile-turnstile-challenge
 *
 * Hosted Cloudflare Turnstile challenge for the iOS/Android app. The app opens
 * this page in expo-web-browser's openAuthSessionAsync (lib/turnstile.ts in the
 * app) and waits for a redirect to oneshetland-fetch://turnstile-callback.
 *
 * ALL of the behaviour lives in lib/mobile-turnstile-challenge.ts, which
 * guarantees that redirect on every terminal condition — a token on success,
 * `?error=<reason>` on error, timeout, expiry, script-load failure, script-load
 * timeout, or a failed widget initialisation — so the app never has to guess
 * why nothing came back. This file only renders and wires it to the browser.
 *
 * This page carries the same public site key as the web sign-up form
 * (NEXT_PUBLIC_TURNSTILE_SITE_KEY) and never sees the Turnstile secret key —
 * that only ever lives server-side, inside Supabase Auth's own verification.
 * It deliberately does not use components/ui/Turnstile: that widget reports
 * expiry and timeout only as "no token", which is the very gap this page has
 * to close, and leaving it alone keeps the website's own forms untouched.
 */

export default function MobileTurnstileChallengePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [outcome, setOutcome] = useState<ChallengeOutcome | null>(null);

  useEffect(() => {
    const run = startMobileChallenge({
      siteKey: TURNSTILE_SITE_KEY,
      loadScript: loadTurnstile,
      getApi: () => window.turnstile,
      getContainer: () => containerRef.current,
      redirect: (url) => {
        window.location.href = url;
      },
      onSettled: setOutcome,
    });
    return run.stop;
  }, []);

  const failed = outcome !== null && "error" in outcome;

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-navy">One quick check</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Before you continue in the OneShetland app, please complete this quick verification.
      </p>
      <div className="mt-6">
        {outcome === null && <div ref={containerRef} />}
        {outcome !== null && !failed && (
          <p className="text-sm text-ink-soft">Verified — returning you to the app…</p>
        )}
        {failed && (
          <>
            <p className="text-sm text-rose-600">
              Couldn&apos;t complete the check. Returning you to the app — please try again.
            </p>
            <a
              href={returnUrlFor(outcome)}
              className="mt-3 inline-block text-sm font-semibold text-navy underline"
            >
              Return to OneShetland
            </a>
          </>
        )}
      </div>
    </section>
  );
}
