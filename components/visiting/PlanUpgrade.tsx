"use client";

import { useEffect, useState } from "react";
import { AiGlow } from "@/components/ai/AiGlow";
import { PeerieBadge } from "@/components/ai/PeerieBadge";
import { Itinerary, type StopView } from "@/components/visiting/Itinerary";
import { PlanMap } from "@/components/visiting/PlanMap";
import { PEERIE } from "@/lib/peerie";

/**
 * Shows the plain plan straight away, then upgrades to Peerie Bot's once it
 * answers.
 *
 * This exists because doing it the obvious way kept taking the page down. The
 * server used to await the model inside its own render: a 20-second call, plus
 * whatever a signed-in visitor's layout does, and the host killed the request —
 * an error page instead of a day out. The fallback was there to prevent exactly
 * that and never got the chance to run.
 *
 * Now nothing on the request path waits for a model. The visitor has a complete
 * day, with times and a map, before the browser has even asked for the better
 * one. If that request is slow, fails, or the account is out of credit, they
 * simply keep what they're looking at — the upgrade is the only thing that can
 * fail, and its failure is silence.
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
            {busy && (
              <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
                <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-ink/20 border-t-ink/60" />
                {PEERIE.name} is having a look to see if it can do better…
              </p>
            )}
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

      {/* The glow runs on the list itself — it's the thing about to change. */}
      <AiGlow active={busy && !plan}>
        <Itinerary stops={stops} accent={accent} />
      </AiGlow>

      {skipped.length > 0 && (
        <p className="text-sm text-ink-muted">
          Left out: {skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}.
        </p>
      )}
    </div>
  );
}
