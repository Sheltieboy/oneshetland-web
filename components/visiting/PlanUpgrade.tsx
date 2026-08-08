"use client";

import { useEffect, useState } from "react";
import { AiGlow } from "@/components/ai/AiGlow";
import { PeerieBadge } from "@/components/ai/PeerieBadge";
import { Itinerary, type StopView } from "@/components/visiting/Itinerary";
import { PlanMap } from "@/components/visiting/PlanMap";
import { PEERIE } from "@/lib/peerie";

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
              {PEERIE.name} is putting your day together…
            </p>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Working out what&apos;s worth seeing, in an order that makes sense. Usually about ten seconds.
          </p>

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
