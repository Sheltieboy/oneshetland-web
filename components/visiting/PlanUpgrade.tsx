"use client";

import { useEffect, useState } from "react";
import { AiGlow } from "@/components/ai/AiGlow";
import { PeerieBadge } from "@/components/ai/PeerieBadge";
import { Itinerary, type StopView } from "@/components/visiting/Itinerary";
import { PlanMap } from "@/components/visiting/PlanMap";
import { PEERIE } from "@/lib/peerie";
import { INTERESTS } from "@/lib/planner";

/**
 * Waits for Peerie Bot, then shows ONE plan.
 *
 * The first version showed the deterministic plan immediately and swapped in
 * Peerie Bot's when it arrived. Darren's verdict, and he's right: worse than
 * waiting. You read a plan, it glowed for no reason you could see, then became
 * a different plan — so you can't trust what's in front of you.
 *
 * So there's a proper wait now: a skeleton that says what's happening, then the
 * finished day. Nothing changes under the reader. If Peerie Bot can't answer,
 * the deterministic plan appears instead — the same single transition, and the
 * visitor never learns anything went wrong.
 *
 * The wait happens HERE, in the browser, and not in the page render. The server
 * used to await the model itself: a 20-second call plus a signed-in visitor's
 * layout work, and the host killed the request — an error page instead of a day
 * out. Waiting in the browser costs nothing and can't take a page down.
 */

type Upgraded = { title: string; intro: string; stops: StopView[]; skipped: { name: string; reason: string }[] };

/**
 * What to say during the wait.
 *
 * Every line is something the planner ACTUALLY does, in the order it does it:
 * it reads the interests, gathers candidates by category, checks opening hours,
 * computes travel between stops, then fits the window. Inventing steps to fill
 * the time would be theatre, and the moment one didn't match what came back
 * you'd stop believing the rest of the page.
 */
function progressSteps(q: { from: string; to: string; transport: string; interests: string[] }): string[] {
  const wanted = q.interests
    .map((k) => INTERESTS.find((i) => i.key === k)?.label.toLowerCase())
    .filter(Boolean) as string[];

  const list =
    wanted.length === 0 ? "a bit of everything"
    : wanted.length === 1 ? wanted[0]
    : `${wanted.slice(0, -1).join(", ")} and ${wanted[wanted.length - 1]}`;

  return [
    "Reading your search…",
    `Looking for ${list}…`,
    "Checking what's open while you're here…",
    q.transport === "walking"
      ? "Working out what's within walking distance…"
      : "Working out the drive between each stop…",
    `Fitting it into ${q.from} to ${q.to}…`,
    "Putting them in an order that makes sense…",
    "Nearly there…",
  ];
}

export function PlanUpgrade({
  fallbackStops,
  fallbackSkipped,
  query,
  accent,
}: {
  fallbackStops: StopView[];
  fallbackSkipped: { name: string; reason: string }[];
  query: { date: string; from: string; to: string; transport: string; interests: string[] };
  accent: string;
}) {
  const [plan, setPlan] = useState<Upgraded | null>(null);
  const [busy, setBusy] = useState(true);
  const [step, setStep] = useState(0);

  const steps = progressSteps(query);

  // Advance through the lines while waiting, holding on the last one rather
  // than looping — a loop would say the work had restarted.
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((n) => Math.min(n + 1, steps.length - 1)), 1900);
    return () => clearInterval(t);
  }, [busy, steps.length]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/ai/plan-day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(query),
          // Generous: the browser waiting is free, unlike a page render.
          signal: AbortSignal.timeout(45000),
        });
        if (!alive) return;
        if (res.ok) {
          const data = (await res.json()) as Upgraded;
          if (alive && Array.isArray(data.stops) && data.stops.length >= 2) setPlan(data);
        }
      } catch {
        /* keep the plan already on screen */
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
    // Query is fixed for a given URL; re-running on identity change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nothing is shown until we know which plan it is.
  if (busy) {
    return (
      <AiGlow active>
        <div className="rounded-card border border-line bg-paper p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ink/20 border-t-ink/60"
            />
            <p className="font-display text-lg font-bold text-ink">
              {PEERIE.name} is putting your day together
            </p>
          </div>

          {/* key= restarts the animation, so each line slides in as it lands. */}
          <p key={step} className="plan-step mt-2 text-sm font-medium text-ink-soft" aria-live="polite">
            {steps[step]}
          </p>

          {/* How far through, so a ten-second wait doesn't feel open-ended.
              Capped at 90%: watching it live, it reached 100% with the plan
              still coming, which is a small lie and the kind that makes a
              progress bar worthless. It only completes when the day does. */}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-sand">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${Math.min(90, ((step + 1) / steps.length) * 90)}%`, background: accent }}
            />
          </div>

          {/* Placeholder rows in the shape of the real thing, so the page
              doesn't jump when the plan lands. */}
          <ul className="mt-5 space-y-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-4">
                <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-sand" />
                <span className="h-12 flex-1 animate-pulse rounded-card bg-sand" style={{ animationDelay: `${i * 120}ms` }} />
              </li>
            ))}
          </ul>
        </div>
      </AiGlow>
    );
  }

  const stops = plan?.stops ?? fallbackStops;
  const skipped = plan?.skipped ?? fallbackSkipped;

  return (
    <div className="space-y-8">
      <section>
        {plan ? (
          <>
            <div className="mb-2"><PeerieBadge /></div>
            <h2 className="font-display text-2xl font-bold">{plan.title}</h2>
            <p className="mt-1 max-w-2xl text-ink-soft">{plan.intro}</p>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold">
              Your day — {stops.length} stop{stops.length === 1 ? "" : "s"}
            </h2>
          </>
        )}
        <p className="mt-1 text-sm text-ink-muted">
          {stops[0]?.arrive} to {stops[stops.length - 1]?.depart} · travel times are estimates.
        </p>
      </section>

      <PlanMap
        accent={accent}
        points={stops.map((s) => ({ lat: s.lat, lng: s.lng, label: s.name, time: s.arrive }))}
      />

      <Itinerary stops={stops} accent={accent} />

      {skipped.length > 0 && (
        <p className="text-sm text-ink-muted">
          Left out: {skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}.
        </p>
      )}
    </div>
  );
}
