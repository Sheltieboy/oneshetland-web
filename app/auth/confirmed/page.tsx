"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/redirect";

/**
 * /auth/confirmed
 *
 * Landing page after a successful email confirmation that originated from
 * the mobile app — /auth/callback redirects here once Supabase has verified
 * the account server-side (see that route for why this works from any
 * device: token_hash verification, no browser-held PKCE verifier needed).
 *
 * This page carries no session credentials of any kind — no access_token,
 * no refresh_token, nowhere. "Open OneShetland" is a plain deep link
 * (oneshetland-fetch://auth/confirm) with, at most, a `next` path hint in
 * its query string — never anything sensitive. app/auth/confirm.tsx in the
 * mobile app already handles a token-less version of that link correctly
 * today (routes to sign-in), so opening the app from here always lands
 * somewhere safe, whether or not the app already has a live session.
 */
function ConfirmedInner() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [isMobileOS, setIsMobileOS] = useState(false);

  useEffect(() => {
    setIsMobileOS(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  const appLink = `oneshetland-fetch://auth/confirm${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center px-5 py-16 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal/15 text-2xl">✅</span>
      <h1 className="mt-5 font-display text-3xl font-bold text-navy">You&apos;re confirmed</h1>
      <p className="mt-3 text-ink-soft">
        Your OneShetland account is active. {isMobileOS ? "Open the app to sign in." : "Sign in to get started."}
      </p>

      {isMobileOS && (
        <a
          href={appLink}
          className="mt-6 inline-block w-full rounded-pill bg-navy px-6 py-3 font-semibold text-paper hover:bg-navy-dark"
        >
          Open OneShetland
        </a>
      )}

      <Link
        href="/sign-in"
        className={
          isMobileOS
            ? "mt-4 text-sm font-semibold text-ink-soft underline"
            : "mt-6 inline-block w-full rounded-pill bg-navy px-6 py-3 font-semibold text-paper hover:bg-navy-dark"
        }
      >
        {isMobileOS ? "Or continue on the web" : "Sign in"}
      </Link>
    </section>
  );
}

export default function ConfirmedPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmedInner />
    </Suspense>
  );
}
