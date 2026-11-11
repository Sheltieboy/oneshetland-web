"use client";

import { useId, useMemo, useState } from "react";
import { addDays, addMonths, dayText, eachDay, endDay, monthStart, monthText, runText, startState, weekdayIndex, type AvailMap, type BookingWindow } from "@/lib/editions/promo";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * A month calendar for choosing the first day of a run of `days` days. Each day says how many places are left (the fewest across the whole run); a day that cannot start the run
 * is disabled and says why. Everything it shows comes from the database's availability and the Edition's own window; the database checks again when you book.
 */
export function PromoDatePicker({ label, days, window: win, avail, limits, value, onChange, noun }: {
  label: string; days: number; window: BookingWindow; avail: AvailMap; limits?: { from: string; to: string }; value: string | null; onChange: (iso: string) => void; noun: string;
}) {
  const hid = useId();
  const first = win ? (limits && limits.from > win.earliest ? limits.from : win.earliest) : null;
  const last = win ? (limits && limits.to < win.latestStart ? limits.to : win.latestStart) : null;
  const [month, setMonth] = useState<string>(() => monthStart(value ?? first ?? "2000-01-01"));
  const cells = useMemo(() => {
    const start = monthStart(month); const next = addMonths(start, 1);
    const list = eachDay(start, addDays(next, -1));
    return { pad: weekdayIndex(start), list };
  }, [month]);
  if (!win || !first || !last || first > last) return <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">No start dates are open for {noun}. It has to finish inside the period your package covers.</p>;
  const canPrev = monthStart(month) > monthStart(first), canNext = addMonths(month, 1) <= last;
  return (
    <div className="rounded-xl border border-line p-3" role="group" aria-labelledby={hid}>
      <p id={hid} className="text-sm font-semibold text-ink">{label}</p>
      <p className="mb-2 text-xs text-ink-muted">Pick the first day. It runs for {days} {days === 1 ? "day" : "days"}. Numbers show places left.</p>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-navy disabled:opacity-30" disabled={!canPrev} onClick={() => setMonth(addMonths(month, -1))} aria-label="Earlier month">‹</button>
        <p aria-live="polite" className="text-sm font-bold text-ink">{monthText(month)}</p>
        <button type="button" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-navy disabled:opacity-30" disabled={!canNext} onClick={() => setMonth(addMonths(month, 1))} aria-label="Later month">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK.map((w) => <span key={w} aria-hidden className="pb-1 text-[11px] font-semibold text-ink-muted">{w}</span>)}
        {Array.from({ length: cells.pad }).map((_, i) => <span key={`p${i}`} aria-hidden />)}
        {cells.list.map((d) => {
          const st = startState(d, days, win, avail, limits);
          const sel = value === d;
          const text = st.ok ? `${st.places} left` : st.reason === "full" ? "Full" : "";
          return (
            <button key={d} type="button" disabled={!st.ok} aria-pressed={sel} onClick={() => onChange(d)}
              aria-label={`${dayText(d)}${st.ok ? `, ${st.places} ${st.places === 1 ? "place" : "places"} left` : st.reason === "full" ? ", full" : ", not available"}`}
              className={"flex min-h-[44px] flex-col items-center justify-center rounded-lg border text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal " +
                (sel ? "border-navy bg-navy text-paper" : st.ok ? "border-line-strong bg-paper text-ink hover:border-navy" : "border-transparent bg-sand/50 text-ink-muted/60")}>
              <span>{Number(d.slice(8))}</span>
              {text && <span className={"text-[10px] font-normal leading-none " + (sel ? "text-paper" : "text-ink-muted")}>{text}</span>}
            </button>
          );
        })}
      </div>
      <p role="status" className="mt-2 text-sm text-ink-soft">{value ? `Runs ${runText(value, endDay(value, days))}.` : "No start day chosen yet."}</p>
    </div>
  );
}
