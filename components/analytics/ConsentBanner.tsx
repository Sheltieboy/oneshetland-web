"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { setAnalyticsConsent } from "@/lib/analytics";

/**
 * ConsentBanner — GDPR-style opt-in analytics consent.
 *
 * Web analytics is OPT-IN: nothing is sent until the visitor accepts. On mount
 * we read the stored choice. If no choice has been made (key is null) we show a
 * compact bottom banner; once a choice exists ('true' or 'false') we render
 * nothing. Both Accept and Decline persist the choice via setAnalyticsConsent,
 * so the banner won't reappear.
 */
const CONSENT_KEY = "os_analytics_consent";

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  // Only touch localStorage in an effect (SSR-safe). Until this runs we render
  // null, which also avoids a hydration mismatch.
  useEffect(() => {
    if (localStorage.getItem(CONSENT_KEY) === null) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function choose(on: boolean) {
    setAnalyticsConsent(on);
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-4"
    >
      <div className="w-full max-w-2xl rounded-card border border-line-strong bg-paper p-4 shadow-2xl sm:flex sm:items-center sm:gap-5">
        <p className="text-sm leading-relaxed text-ink-soft">
          We use privacy-friendly, first-party analytics to improve OneShetland.
          No ads, no third-party tracking, never sold.{" "}
          <Link
            href="/privacy"
            className="font-medium text-navy underline underline-offset-2 hover:text-navy-dark"
          >
            Privacy
          </Link>
        </p>
        <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
          <button
            type="button"
            onClick={() => choose(false)}
            className="flex-1 rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sand sm:flex-none"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose(true)}
            className="flex-1 rounded-pill bg-navy px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-navy-dark sm:flex-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
