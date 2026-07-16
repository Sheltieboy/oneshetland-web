"use client";

/**
 * Compact "what's on" calendar sized for a double-height bento tile
 * (lg:col-span-2 lg:row-span-2). Each day that has an event shows a small round
 * picture (event cover, else organiser logo) and the event name right in the
 * cell; the cell links straight to the event (busy days link to the full
 * calendar). Arrows page months, fetched client-side from /whats-on/calendar.
 */

import { useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { type EventListItem, fmtTime, priceLabel } from "@/lib/events-data";

const EVENTS = "#d4921a";
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function eventPic(e: EventListItem): string | null {
  return e.cover_url || e.business?.logo_url || e.hub?.logo_url || null;
}

export function BentoCalendarTile({
  monthEvents,
  className = "",
}: {
  monthEvents: EventListItem[];
  className?: string;
}) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [loaded, setLoaded] = useState<Record<string, EventListItem[]>>({});

  const monthId = `${view.year}-${view.month}`;
  const initialId = `${now.getFullYear()}-${now.getMonth()}`;
  const events = monthId === initialId ? monthEvents : (loaded[monthId] ?? []);

  async function changeMonth(delta: number) {
    let { year, month } = view;
    month += delta;
    if (month < 0) { month = 11; year -= 1; }
    else if (month > 11) { month = 0; year += 1; }
    const id = `${year}-${month}`;
    setView({ year, month });
    if (id !== initialId && !loaded[id]) {
      try {
        const res = await fetch(`/whats-on/calendar?year=${year}&month=${month}`);
        const json = (await res.json()) as { events: EventListItem[] };
        setLoaded((prev) => ({ ...prev, [id]: json.events ?? [] }));
      } catch {
        setLoaded((prev) => ({ ...prev, [id]: [] }));
      }
    }
  }

  const byDay: Record<string, EventListItem[]> = {};
  for (const e of events) {
    const k = dayKey(new Date(e.starts_at));
    (byDay[k] ??= []).push(e);
  }

  const first = new Date(view.year, view.month, 1);
  const startPad = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.year, view.month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const todayKey = dayKey(now);

  return (
    <div className={"relative flex flex-col rounded-2xl border border-events/25 bg-paper shadow-soft " + className}>
      {/* Header band — What's On amber */}
      <div className="flex items-start justify-between rounded-t-2xl px-4 py-3 text-white" style={{ background: EVENTS }}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/85">What&apos;s on</p>
          <p className="font-display text-lg font-bold leading-tight">{monthLabel}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => changeMonth(-1)} aria-label="Previous month" className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-sm text-white transition hover:bg-white/30">‹</button>
          <button onClick={() => changeMonth(1)} aria-label="Next month" className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-sm text-white transition hover:bg-white/30">›</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col rounded-b-2xl bg-gradient-to-b from-events/10 to-transparent px-4 pb-4 pt-3">
      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-ink-muted">
        {WEEKDAYS.map((w, i) => <div key={i}>{w}</div>)}
      </div>

      {/* Grid — event days show a round pic + name */}
      <div className="mt-1 grid flex-1 auto-rows-fr grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const k = dayKey(c);
          const dayEvents = byDay[k] ?? [];
          const count = dayEvents.length;
          const isToday = k === todayKey;
          const ev = dayEvents[0];
          const pic = ev ? eventPic(ev) : null;

          const number = (
            <span
              className={
                "grid h-4 w-4 place-items-center rounded-full text-[10px] font-semibold " +
                (isToday ? "text-paper" : count > 0 ? "text-ink" : "text-ink-faint")
              }
              style={isToday ? { background: EVENTS } : undefined}
            >
              {c.getDate()}
            </span>
          );

          if (count === 0) {
            return (
              <div key={i} className="flex flex-col items-center rounded-md p-0.5">
                {number}
              </div>
            );
          }

          const inner = (
            <>
              <div className="flex w-full items-center justify-between">
                {number}
                {count > 1 && (
                  <span className="rounded-full px-1 text-[8px] font-bold text-paper" style={{ background: EVENTS }}>
                    +{count - 1}
                  </span>
                )}
              </div>
              <span className="mt-0.5 h-4 w-4 overflow-hidden rounded-full bg-events/15">
                {pic
                  ? <SafeImage src={pic} className="h-full w-full object-cover" fallback={<span className="block h-full w-full" style={{ background: "rgba(212,146,26,0.25)" }} />} />
                  : <span className="grid h-full w-full place-items-center text-[8px]" style={{ color: EVENTS }}>◆</span>}
              </span>
              <span className="mt-0.5 line-clamp-1 w-full text-center text-[8px] font-semibold leading-tight text-ink">
                {ev.title}
              </span>
            </>
          );

          const dateLabel = c.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
          const primaryHref = count === 1 ? `/whats-on/${ev.id}` : "/whats-on?view=calendar";
          // Interactive hover card: sits flush under the cell (no gap) so the
          // pointer can move straight down into it; each event is its own link.
          const preview = (
            <div className="absolute left-1/2 top-full z-50 hidden w-52 -translate-x-1/2 pt-1 group-hover:block">
              <div className="rounded-xl border border-line bg-paper p-2 text-left shadow-lift">
                <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: EVENTS }}>{dateLabel}</p>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 4).map((pe) => {
                    const lbl = priceLabel(pe);
                    const isFree = lbl === "Free";
                    const tk = pe.has_tickets && !!lbl && !isFree;
                    const sp = tk ? lbl!.replace(/^From /, "").replace(/\.00$/, "") : null;
                    const ppic = eventPic(pe);
                    return (
                      <Link key={pe.id} href={`/whats-on/${pe.id}`} className="flex gap-2 rounded-lg p-1 transition hover:bg-sand">
                        <span className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-md bg-events/15">
                          {ppic
                            ? <SafeImage src={ppic} className="h-full w-full object-cover" fallback={<span className="block h-full w-full" style={{ background: "rgba(212,146,26,0.25)" }} />} />
                            : <span className="grid h-full w-full place-items-center text-[10px]" style={{ color: EVENTS }}>◆</span>}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-[11px] font-bold leading-tight text-ink">{pe.title}</span>
                          <span className="mt-0.5 block text-[10px] text-ink-muted">
                            {fmtTime(pe.starts_at)}{isFree ? " · Free" : tk ? ` · 🎟 ${sp}` : ""}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                  {count > 4 && (
                    <Link href="/whats-on?view=calendar" className="block px-1 pt-0.5 text-[10px] font-semibold text-ink-muted transition hover:text-ink">
                      +{count - 4} more →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );

          return (
            <div key={i} className="group relative flex flex-col items-center rounded-md bg-events/10 p-0.5 transition hover:bg-events/20">
              <Link href={primaryHref} title={ev.title} className="flex w-full flex-col items-center">
                {inner}
              </Link>
              {preview}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <Link
        href="/whats-on?view=calendar"
        className="mt-3 inline-flex items-center gap-1 text-xs font-bold transition hover:gap-1.5"
        style={{ color: EVENTS }}
      >
        Full calendar <span aria-hidden>→</span>
      </Link>
      </div>
    </div>
  );
}
