"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * The welcome mat — a one-time hello for first-time visitors.
 *
 * WHAT THIS IS FOR, because it's easy to get wrong:
 * A first-time visitor has three questions — what is this, is it for me, and
 * what do I do next. It answers those and gets out of the way.
 *
 * WHAT IT IS DELIBERATELY NOT FOR: reassurance about cards, banks or data.
 * Reassurance only works at the moment of risk. Someone who has just arrived
 * has no card in play, so raising it here plants a worry instead of settling
 * one — it reads as "why are we talking about my card already?". That proof
 * lives where the risk actually is: the card and business steps of the join
 * wizard, and /soft-launch for anyone who wants the full detail. There is a
 * quiet link to it below for exactly those people.
 *
 * Shows once per visitor (localStorage), and never to someone already signed
 * in — inviting an existing member to "join" is just noise. SSR-safe: renders
 * null until the effect has run.
 */
const SEEN_KEY = "os_softlaunch_notice_seen";

export function PrelaunchNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (localStorage.getItem(SEEN_KEY) !== null) return;

    // Don't greet a member who's already signed in.
    void (async () => {
      try {
        const { data } = await createClient().auth.getUser();
        if (!cancelled && !data.user) setShow(true);
      } catch {
        if (!cancelled) setShow(true); // auth blip shouldn't hide the welcome
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to OneShetland"
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
          <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-teal">
            Welcome
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-paper">
            Everything Shetland, in one place 🌱
          </h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-ink-soft">
            What&apos;s on, local businesses, jobs and shifts, community groups, the fleet,
            da spik and more — all in one place, for folk who live here and folk who&apos;re
            visiting.
          </p>
          <p className="mt-3 text-ink-soft">
            Joining is <b>free</b>, takes a minute, and lets you save things, collect loyalty
            stamps and follow the places you care about. Or just have a look first — most of
            OneShetland is open to everybody.
          </p>

          <Link
            href="/sign-up"
            onClick={dismiss}
            className="mt-5 block rounded-pill bg-teal px-5 py-3 text-center font-semibold text-navy transition hover:brightness-105"
          >
            Join OneShetland — it&apos;s free
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="mt-2 block w-full rounded-pill border border-line-strong px-5 py-3 text-center font-semibold text-ink transition hover:bg-sand"
          >
            I&apos;ll have a look around first
          </button>

          <p className="mt-4 text-center text-sm text-ink-muted">
            We&apos;re newly open, with more arriving every week.{" "}
            <Link
              href="/soft-launch"
              onClick={dismiss}
              className="font-semibold text-navy underline underline-offset-2"
            >
              What that means
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
