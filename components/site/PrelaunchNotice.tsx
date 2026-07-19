"use client";

import { useEffect, useState } from "react";

/**
 * PrelaunchNotice — a one-time friendly pop-up telling visitors the site is
 * still in testing, with a link for anyone who'd like to help test it.
 *
 * Shows once per visitor: on mount we check localStorage; if the key is unset we
 * show the modal, and dismissing it (any route) stores the key so it never
 * reappears. SSR-safe — renders null until the effect runs.
 */
const SEEN_KEY = "os_prelaunch_notice_seen";
const TESTER_URL = "https://darrenfullerton.com/test-portal/test-group.html";

export function PrelaunchNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY) === null) setShow(true);
  }, []);

  function dismiss() {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="OneShetland is in testing"
      className="fixed inset-0 z-[110] flex items-center justify-center px-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
      />

      {/* Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-card border border-line-strong bg-paper shadow-2xl">
        <div className="bg-navy px-6 py-5 text-center text-paper">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-teal">Sneak peek</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-paper">We&apos;re still in testing 🛠️</h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-ink-soft">
            Welcome — have a good look around! OneShetland <b>isn&apos;t fully launched yet</b>, so
            you might spot the odd rough edge while we finish things off.
          </p>
          <p className="mt-3 text-ink-soft">
            Fancy helping us make it better? You can join the tester panel and try the app &amp; website.
          </p>

          <a
            href={TESTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="mt-5 block rounded-pill bg-teal px-5 py-3 text-center font-semibold text-navy transition hover:brightness-105"
          >
            Help test it →
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="mt-2 block w-full rounded-pill border border-line-strong px-5 py-3 text-center font-semibold text-ink transition hover:bg-sand"
          >
            Just having a look
          </button>
        </div>
      </div>
    </div>
  );
}
