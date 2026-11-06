"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SHARED_CATEGORIES, ASK_QUESTION, ASK_ANSWERS } from "@/lib/event-categories";
import { frontDoorOutcome } from "@/lib/event-front-door";
import { NOT_AVAILABLE_YET, NOT_OPEN_YET, SIGN_IN_TO_SUBMIT } from "@/lib/contributor-copy";
import { SubmissionForm } from "@/components/events/front-door/SubmissionForm";

const btn = "w-full rounded-2xl border border-line-strong bg-paper px-5 py-4 text-left text-lg font-semibold text-ink transition hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

/** What the server found out about sending an event: who the person is, whether the database can take it, whether the master switch is on. */
export type SubmitGate =
  | { kind: "signin" }
  | { kind: "ready"; staff: boolean; closedToPublic: boolean }
  | { kind: "closed" }
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

export function FrontDoor({ gate, userId, initialCategory }: { gate: SubmitGate; userId: string | null; initialCategory?: string | null }) {
  const [slug, setSlug] = useState<string | null>(initialCategory ?? null);
  const [answer, setAnswer] = useState<string | null>(null);
  const out = frontDoorOutcome(slug, answer);
  const label = SHARED_CATEGORIES.find((c) => c.slug === slug)?.label;
  const restart = () => { setSlug(null); setAnswer(null); };

  // Move keyboard and screen-reader focus to the new step's heading when the step changes
  // (the previous button disappears, which would otherwise drop focus to the page body).
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    stepHeading.current?.focus();
  }, [out.kind]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-4xl font-bold text-ink">Add an Event or Activity</h1>

      {out.kind === "choose" && (
        <section aria-labelledby="fd-step1" className="mt-6">
          <h2 id="fd-step1" ref={stepHeading} tabIndex={-1} className="text-xl font-semibold text-ink outline-none">What kind of thing are you adding?</h2>
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
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/75">{label}</p>
          <h2 id="fd-step2" ref={stepHeading} tabIndex={-1} className="mt-1 text-xl font-semibold text-ink outline-none">{ASK_QUESTION}</h2>
          <ul className="mt-5 grid gap-3">
            {ASK_ANSWERS.map((a) => (
              <li key={a.value}><button type="button" className={btn} onClick={() => setAnswer(a.value)}>{a.label}</button></li>
            ))}
          </ul>
          <button type="button" onClick={restart} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Back to the list</button>
        </section>
      )}

      {out.kind === "event" && gate.kind === "ready" && userId && (
        <SubmissionForm slug={out.slug} categoryLabel={label ?? ""} userId={userId} staff={gate.staff && gate.closedToPublic} onRestart={restart} />
      )}

      {out.kind === "event" && !(gate.kind === "ready" && userId) && (
        <section aria-live="polite" className="mt-6 rounded-2xl border border-line-strong bg-cream p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/75">{label}</p>
          <h2 ref={stepHeading} tabIndex={-1} className="mt-1 text-xl font-semibold text-ink outline-none">This is an event</h2>
          {gate.kind === "signin" ? (
            <>
              <p className="mt-3 text-lg text-ink/80">{SIGN_IN_TO_SUBMIT}</p>
              <p className="mt-4"><Link href={`/sign-in?next=${encodeURIComponent(`/whats-on/add?category=${out.slug}`)}`} className="inline-flex min-h-12 items-center rounded-pill bg-navy px-6 py-3 text-lg font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Sign in</Link></p>
            </>
          ) : gate.kind === "closed" ? (
            <p className="mt-3 text-ink/80"><strong>{NOT_OPEN_YET}</strong></p>
          ) : (
            <p className="mt-3 text-ink/80"><strong>{NOT_AVAILABLE_YET}</strong>{gate.kind === "error" ? ` (${gate.message})` : ""}</p>
          )}
          <button type="button" onClick={restart} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Start again</button>
        </section>
      )}

      {out.kind === "activity" && (
        <section aria-live="polite" className="mt-6 rounded-2xl border border-line-strong bg-cream p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/75">{label}</p>
          <h2 ref={stepHeading} tabIndex={-1} className="mt-1 text-xl font-semibold text-ink outline-none">This is a regular activity</h2>
          <p className="mt-3 text-ink/80">Regular activities are looked after from a business or a hub, so people can see who runs them. Choose where yours belongs:</p>
          <ul className="mt-4 space-y-2">
            <li><Link href="/business" className="font-semibold underline">Manage activities from a business</Link></li>
            <li><Link href="/account/hubs" className="font-semibold underline">Manage activities from a hub</Link></li>
          </ul>
          <button type="button" onClick={restart} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Start again</button>
        </section>
      )}
    </div>
  );
}
