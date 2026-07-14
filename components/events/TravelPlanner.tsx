"use client";
/**
 * TravelPlanner — pick your exact home stop; see how to get TO the event
 * (arriving before it starts) and BACK home (last feasible connection). Runs the
 * transit engine client-side so it recomputes instantly. Parity with the app.
 * Published timetable data, not a live feed.
 */
import { useEffect, useMemo, useState } from "react";
import { STOP_OPTIONS, DEFAULT_STOP, planThere, planHomeTo, type TravelResult } from "@/lib/transit-data";
import type { TransitArea } from "@/lib/transit";
import { FERRY_MORE_INFO } from "@/lib/ferry-timetable";

const STORAGE_KEY = "os_home_stop";

// Stops grouped by area label, for the <optgroup> picker.
const GROUPS: { label: string; stops: { id: string; name: string }[] }[] = (() => {
  const out: { label: string; stops: { id: string; name: string }[] }[] = [];
  for (const s of STOP_OPTIONS) {
    let g = out.find((x) => x.label === s.areaLabel);
    if (!g) { g = { label: s.areaLabel, stops: [] }; out.push(g); }
    g.stops.push({ id: s.id, name: s.name });
  }
  return out;
})();

export function TravelPlanner({
  eventArea,
  eventStop,
  startsAt,
  endsAt,
  defaultStop,
}: {
  eventArea: TransitArea;
  eventStop: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Initial stop from the user's profile home area; localStorage overrides it. */
  defaultStop?: string;
}) {
  const [home, setHome] = useState<string>(defaultStop || DEFAULT_STOP);
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && STOP_OPTIONS.some((s) => s.id === saved)) setHome(saved);
  }, []);
  const choose = (id: string) => {
    setHome(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  };

  const there = useMemo(() => planThere(home, eventArea, eventStop, startsAt), [home, eventArea, eventStop, startsAt]);
  const back = useMemo(() => planHomeTo(eventArea, eventStop, home, startsAt, endsAt), [home, eventArea, eventStop, startsAt, endsAt]);
  const homeLabel = STOP_OPTIONS.find((s) => s.id === home)?.name ?? "your stop";

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Plan your journey</h2>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">My stop</span>
          <select
            value={home}
            onChange={(e) => choose(e.target.value)}
            className="max-w-[16rem] rounded-lg border border-line bg-paper px-3 py-1.5 font-semibold text-ink"
          >
            {GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.stops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TripCard title="Getting there" result={there} homeLabel={homeLabel} dir="there" />
        <TripCard title="Getting home" result={back} homeLabel={homeLabel} dir="home" />
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Timetabled connections — no live feed yet. Times can change; check before you travel. {FERRY_MORE_INFO}
      </p>
    </section>
  );
}

function TripCard({ title, result, homeLabel, dir }: { title: string; result: TravelResult; homeLabel: string; dir: "there" | "home" }) {
  const journey = result.journey;
  const leaveBy = journey ? journey.legs[0].depart : null;
  const badge = result.departsBeforeStart ? `⚠ Leave by ${leaveBy}` : result.leavesBeforeEnd ? "⚠ Before event ends" : null;
  return (
    <div className="rounded-xl border border-line bg-paper p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">{title}</p>
        {badge && (
          <span className="rounded-pill bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{badge}</span>
        )}
      </div>
      {result.local ? (
        <p className="mt-2 text-sm text-ink-soft">You&apos;re at the event — no ferry or bus needed.</p>
      ) : !journey ? (
        <p className="mt-2 text-sm text-ink-soft">
          {dir === "there"
            ? `No bus or ferry from ${homeLabel} arrives before the start — you'll need to drive or arrange a lift.`
            : `No bus or ferry back to ${homeLabel} at all that day — plan a lift or an overnight stay.`}
        </p>
      ) : (
        <>
          <ol className="mt-2 space-y-2">
            {journey.legs.map((leg, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-soft">
                <span aria-hidden className="mt-0.5 shrink-0">{leg.mode === "ferry" ? "⛴" : "🚌"}</span>
                <span className="min-w-0">
                  <span className="font-mono text-xs text-ink-muted">{leg.depart}</span> <span className="font-medium text-ink">{leg.fromName}</span>
                  <span className="text-ink-muted"> → </span>
                  <span className="font-mono text-xs text-ink-muted">{leg.arrive}</span> <span className="font-medium text-ink">{leg.toName}</span>
                  <span className="block text-xs text-ink-muted">
                    {leg.mode === "ferry" ? leg.service : `Service ${leg.service}`}
                    {leg.bookable ? " · booking needed" : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {result.departsBeforeStart && (
            <p className="mt-2 text-xs font-medium text-amber-800">
              This is the last connection home — it leaves before the event, so you&apos;d need to head off early, get a lift, or stay over.
            </p>
          )}
        </>
      )}
    </div>
  );
}
