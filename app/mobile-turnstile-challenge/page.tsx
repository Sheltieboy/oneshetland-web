"use client";

import { useState } from "react";
import { Turnstile } from "@/components/ui/Turnstile";

/**
 * /mobile-turnstile-challenge
 *
 * Hosted Cloudflare Turnstile challenge for the iOS/Android app. Build #38's
 * signup screen has no first-party way to run a Turnstile widget itself — the
 * proven, OTA-safe pattern already used elsewhere in this app for exactly this
 * shape of problem (driver Connect onboarding) is to open a legitimate
 * oneshetland.com page inside expo-web-browser's openAuthSessionAsync, run the
 * web flow there, and hand a result back over the app's own oneshetland-fetch
 * URL scheme.
 *
 * On a passed check, redirects to oneshetland-fetch://turnstile-callback?token=…
 * On failure/timeout, redirects to oneshetland-fetch://turnstile-callback?error=…
 * so the app never has to guess why nothing came back — it always gets an
 * explicit outcome, never silence.
 *
 * This page carries the same public site key as the web sign-up form
 * (NEXT_PUBLIC_TURNSTILE_SITE_KEY) and never sees the Turnstile secret key —
 * that only ever lives server-side, inside Supabase Auth's own verification.
 */

const RETURN_SCHEME = "oneshetland-fetch://turnstile-callback";

export default function MobileTurnstileChallengePage() {
  const [state, setState] = useState<"pending" | "done" | "failed">("pending");

  function handleToken(token: string | null) {
    if (!token || state !== "pending") return;
    setState("done");
    window.location.href = `${RETURN_SCHEME}?token=${encodeURIComponent(token)}`;
  }

  function handleError() {
    if (state !== "pending") return;
    setState("failed");
    window.location.href = `${RETURN_SCHEME}?error=challenge_failed`;
  }

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-navy">One quick check</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Before you continue in the OneShetland app, please complete this quick verification.
      </p>
      <div className="mt-6">
        {state === "pending" && (
          <Turnstile onToken={handleToken} onError={handleError} />
        )}
        {state === "done" && (
          <p className="text-sm text-ink-soft">Verified — returning you to the app…</p>
        )}
        {state === "failed" && (
          <p className="text-sm text-rose-600">
            Couldn&apos;t complete the check. Returning you to the app — please try again.
          </p>
        )}
      </div>
    </section>
  );
}
