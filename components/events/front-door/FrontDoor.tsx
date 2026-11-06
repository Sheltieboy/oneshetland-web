"use client";

import { useState } from "react";
import Link from "next/link";
import { SHARED_CATEGORIES, ASK_QUESTION, ASK_ANSWERS } from "@/lib/event-categories";
import { frontDoorOutcome } from "@/lib/event-front-door";

const btn = "w-full rounded-2xl border border-line-strong bg-paper px-5 py-4 text-left text-lg font-semibold text-ink transition hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function FrontDoor({ submissionsOpen }: { submissionsOpen: boolean }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const out = frontDoorOutcome(slug, answer);
  const label = SHARED_CATEGORIES.find((c) => c.slug === slug)?.label;
  const restart = () => { setSlug(null); setAnswer(null); };

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-4xl font-bold text-ink">Add an Event or Activity</h1>

      {out.kind === "choose" && (
        <section aria-labelledby="fd-step1" className="mt-6">
          <h2 id="fd-step1" className="text-xl font-semibold text-ink">What kind of thing are you adding?</h2>
          <p className="mt-1 text-ink/70">Pick the closest match. You can change your mind on the next step.</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {SHARED_CATEGORIES.map((c) => (
              <li key={c.slug}>
                <button type="button" className={btn} onClick={() => { setSlug(c.slug); setAnswer(null); }}>{c.label}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {out.kind === "ask" && (
        <section aria-labelledby="fd-step2" className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">{label}</p>
          <h2 id="fd-step2" className="mt-1 text-xl font-semibold text-ink">{ASK_QUESTION}</h2>
          <ul className="mt-5 grid gap-3">
            {ASK_ANSWERS.map((a) => (
              <li key={a.value}><button type="button" className={btn} onClick={() => setAnswer(a.value)}>{a.label}</button></li>
            ))}
          </ul>
          <button type="button" onClick={restart} className="mt-5 text-sm font-semibold underline">Back to the list</button>
        </section>
      )}

      {out.kind === "event" && (
        <section aria-live="polite" className="mt-6 rounded-2xl border border-line-strong bg-cream p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">{label}</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">This is an event</h2>
          {submissionsOpen ? (
            <p className="mt-3 text-ink/80">Event submissions are open, but the form is not connected on this page yet.</p>
          ) : (
            <p className="mt-3 text-ink/80"><strong>Member submissions are not open yet.</strong> Thank you for your patience. Nothing has been sent or saved.</p>
          )}
          <button type="button" onClick={restart} className="mt-5 text-sm font-semibold underline">Start again</button>
        </section>
      )}

      {out.kind === "activity" && (
        <section aria-live="polite" className="mt-6 rounded-2xl border border-line-strong bg-cream p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">{label}</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">This is a regular activity</h2>
          <p className="mt-3 text-ink/80">Regular activities are looked after from a business or a hub, so people can see who runs them. Choose where yours belongs:</p>
          <ul className="mt-4 space-y-2">
            <li><Link href="/business" className="font-semibold underline">Manage activities from a business</Link></li>
            <li><Link href="/account/hubs" className="font-semibold underline">Manage activities from a hub</Link></li>
          </ul>
          <button type="button" onClick={restart} className="mt-5 text-sm font-semibold underline">Start again</button>
        </section>
      )}
    </div>
  );
}
