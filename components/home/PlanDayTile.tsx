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
 * Two layouts, one form:
 *   default — a 2×2 bento tile, stacked.
 *   wide    — a full-width band for somebody who has said they're VISITING,
 *             where "what shall we do today" is the whole reason they opened
 *             the page, so it sits above the mosaic rather than inside it.
 */

const LOCAL = "#7c3aed";

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

  const field =
    "w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-[color:var(--local)]";

  const heading = (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: LOCAL }}>
        Something to do
      </p>
      <h3
        className={`mt-0.5 font-display font-bold text-ink ${wide ? "text-2xl" : "text-xl"}`}
      >
        Plan a day out
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
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
              (on ? "border-transparent text-white" : "border-line-strong text-ink-soft hover:bg-sand")
            }
            style={on ? { background: LOCAL } : undefined}
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
        "flex items-center justify-center gap-2 rounded-pill px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-95 disabled:opacity-70 " +
        (wide ? "w-full sm:w-auto sm:px-6" : "w-full")
      }
      style={{ background: LOCAL }}
    >
      {pending && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {pending ? "Off we go…" : "Plan my day →"}
    </button>
  );

  const shell = `rounded-2xl border border-line bg-paper shadow-soft ${className}`;
  const wash = { background: `linear-gradient(150deg, ${LOCAL}0f, transparent 60%)`, "--local": LOCAL } as React.CSSProperties;

  if (wide) {
    return (
      <form onSubmit={go} className={`${shell} p-5 sm:p-6`} style={wash}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-center lg:gap-8">
          {heading}
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-start">
              {times}
              <div className="sm:pt-0">{submit}</div>
            </div>
            {chips}
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={go} className={`flex flex-col ${shell} p-5`} style={wash}>
      {heading}
      <div className="mt-3">{times}</div>
      <div className="mt-2">{chips}</div>
      <div className="mt-auto pt-3">{submit}</div>
    </form>
  );
}
