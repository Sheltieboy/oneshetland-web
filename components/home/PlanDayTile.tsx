"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { INTERESTS, type Interest } from "@/lib/planner";

/**
 * "Plan a day out" — the day planner's front door, on the homepage.
 *
 * The planner was two clicks deep behind /visiting, so only somebody who had
 * already found the visitor pages ever saw it. On the homepage it's in front
 * of everyone, including folk who live here with family over.
 *
 * The FORM lives here; the result does not. A plan is a map and six stops and
 * takes about ten seconds to think about — rendering that inside a 200px
 * bento cell would either squash it or make the cell balloon halfway down the
 * page. So this collects the day, the hours and the interests, and hands off
 * to /visiting/plan, which keeps the shareable URL intact.
 */

const LOCAL = "#7c3aed";

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function PlanDayTile({ className = "" }: { className?: string }) {
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
    "w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none";

  return (
    <form
      onSubmit={go}
      className={`flex flex-col rounded-2xl border border-line bg-paper p-5 shadow-soft ${className}`}
      style={{ background: `linear-gradient(150deg, ${LOCAL}0f, transparent 60%)` }}
    >
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: LOCAL }}>
        Something to do
      </p>
      <h3 className="mt-0.5 font-display text-xl font-bold text-ink">Plan a day out</h3>
      <p className="mt-1 text-sm text-ink-muted">
        Tell us when you&apos;re free and what you fancy — we&apos;ll lay out a day with travel times and a map.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="col-span-3 sm:col-span-1">
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

      <div className="mt-2 flex flex-wrap gap-1.5">
        {INTERESTS.map((i) => {
          const on = picked.includes(i.key);
          return (
            <button
              key={i.key}
              type="button"
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

      <button
        type="submit"
        disabled={pending}
        className="mt-auto flex items-center justify-center gap-2 rounded-pill px-4 py-2.5 pt-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-95 disabled:opacity-70"
        style={{ background: LOCAL, marginTop: "0.75rem" }}
      >
        {pending && (
          <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {pending ? "Off we go…" : "Plan my day →"}
      </button>
    </form>
  );
}
