"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { INTERESTS, type Interest } from "@/lib/planner";

/**
 * "Plan a day out" — the day planner's front door on the homepage.
 *
 * The planner was two clicks deep behind /visiting, so only somebody who had
 * already found the visitor pages ever saw it. On the homepage it's in front of
 * everyone, including folk who live here with family over.
 *
 * The FORM lives here; the result does not. A plan is a map and six stops and
 * takes about ten seconds to think about — rendering that inside a 200px bento
 * cell would either squash it or make the cell balloon halfway down the page.
 * So this collects the day, the hours and the interests, and hands off to
 * /visiting/plan, which keeps the plan a shareable URL.
 *
 * Colour, not the usual paper card. Everything either side of it in the mosaic
 * is a photograph or a warm neutral, so a white form with a purple button read
 * as a settings panel somebody had left lying about. Filled with the Local
 * purple it reads as an invitation, and it's the only tile of its colour, which
 * is what makes it findable on a page this long.
 *
 * Two layouts, one form:
 *   default — a 2×2 bento tile, stacked.
 *   wide    — a full-width band for somebody who has said they're VISITING,
 *             where "what shall we do today" is the whole reason they opened
 *             the page, so it sits above the mosaic rather than inside it.
 */

const DEEP = "#5b21b6";

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function PlanDayTile({
  className = "",
  wide = false,
}: {
  className?: string;
  wide?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(todayISO());
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("17:00");
  const [picked, setPicked] = useState<Interest[]>([]);

  function go(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams({ go: "1", date, from, to, transport: "driving" });
    for (const i of picked) p.append("interests", i);
    startTransition(() => router.push(`/visiting/plan?${p.toString()}`));
  }

  // Inputs stay on white: a native date/time picker on a coloured field is
  // unreadable in Safari, and this is the one part that has to be legible.
  const field =
    "w-full rounded-lg border border-white/25 bg-white/95 px-2.5 py-1.5 text-sm text-ink shadow-sm outline-none focus:border-white";

  const heading = (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-white/70">Something to do</p>
      <h3 className={`mt-0.5 font-display font-bold text-white ${wide ? "text-2xl" : "text-xl"}`}>
        Plan a day out
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-white/80">
        Tell us when you&apos;re free and what you fancy — we&apos;ll lay out a day with travel
        times and a map.
      </p>
    </div>
  );

  const times = (
    // The date needs more room than the two times — "08/08/2026" plus the
    // picker icon clips at an even third.
    <div className={`grid gap-2 ${wide ? "grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr]" : "grid-cols-3"}`}>
      <label className={wide ? "col-span-2 sm:col-span-1" : "col-span-3 sm:col-span-1"}>
        <span className="sr-only">Which day</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </label>
      <label>
        <span className="sr-only">From</span>
        <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
      </label>
      <label>
        <span className="sr-only">Until</span>
        <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
      </label>
    </div>
  );

  const chips = (
    <div className="flex flex-wrap gap-1.5">
      {INTERESTS.map((i) => {
        const on = picked.includes(i.key);
        return (
          <button
            key={i.key}
            type="button"
            aria-pressed={on}
            onClick={() => setPicked((p) => (on ? p.filter((k) => k !== i.key) : [...p, i.key]))}
            className={
              "rounded-pill border px-2.5 py-1 text-xs font-semibold transition " +
              (on
                ? "border-white bg-white shadow-sm"
                : "border-white/35 text-white/90 hover:border-white/60 hover:bg-white/15")
            }
            style={on ? { color: DEEP } : undefined}
          >
            <span aria-hidden>{i.emoji}</span> {i.label}
          </button>
        );
      })}
    </div>
  );

  const submit = (
    <button
      type="submit"
      disabled={pending}
      className={
        "flex items-center justify-center gap-2 rounded-pill bg-white px-4 py-2.5 text-sm font-bold shadow-soft transition hover:bg-white/90 disabled:opacity-70 " +
        (wide ? "w-full sm:w-auto sm:justify-self-start sm:px-7" : "w-full")
      }
      style={{ color: DEEP }}
    >
      {pending && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current"
        />
      )}
      {pending ? "Off we go…" : "Plan my day →"}
    </button>
  );

  const shell = `relative overflow-hidden rounded-2xl shadow-lift ${className}`;
  const paint: React.CSSProperties = {
    background: `linear-gradient(140deg, ${DEEP} 0%, #7c3aed 52%, #9333ea 100%)`,
  };

  /* A soft light-source in the top-right stops the gradient reading as a flat
     fill — same trick the hero uses, at a quieter volume. */
  const sheen = (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40 blur-2xl"
      style={{ background: "radial-gradient(circle, rgba(255,255,255,0.55), transparent 70%)" }}
    />
  );

  if (wide) {
    return (
      <form onSubmit={go} className={`${shell} p-5 sm:p-6`} style={paint}>
        {sheen}
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-center lg:gap-8">
          {heading}
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-start">
              {times}
              {submit}
            </div>
            {chips}
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={go} className={`flex flex-col ${shell} p-5`} style={paint}>
      {sheen}
      <div className="relative flex h-full flex-col">
        {heading}
        <div className="mt-3">{times}</div>
        <div className="mt-2">{chips}</div>
        <div className="mt-auto pt-3">{submit}</div>
      </div>
    </form>
  );
}
