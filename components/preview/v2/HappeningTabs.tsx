"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";

const GOLD = "#d4921a";
const TEAL = "#0f766e";

/**
 * Two tabs over the "What's happening" mosaic: Events (default) and Regular activities. BOTH panels are rendered by the server and stay in
 * the page, so switching is instant (no request, no layout fetch): the inactive one is simply hidden. Keyboard: Left/Right/Home/End move
 * between tabs and activate them (automatic activation, the pattern for two quick, already-loaded panels); Tab moves into the panel.
 * The link to the full listing follows the active tab.
 */
export function HappeningTabs({ events, activities, eventsCta, activitiesCta }: { events: ReactNode; activities: ReactNode; eventsCta: { label: string; href: string }; activitiesCta: { label: string; href: string } }) {
  const [tab, setTab] = useState<"events" | "regular">("events");
  const uid = useId();
  const refs = { events: useRef<HTMLButtonElement>(null), regular: useRef<HTMLButtonElement>(null) };
  const order = ["events", "regular"] as const;
  const go = (t: (typeof order)[number]) => { setTab(t); refs[t].current?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    const i = order.indexOf(tab);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(order[(i + 1) % 2]); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(order[(i + 1) % 2]); }
    else if (e.key === "Home") { e.preventDefault(); go("events"); }
    else if (e.key === "End") { e.preventDefault(); go("regular"); }
  };
  const cta = tab === "events" ? eventsCta : activitiesCta;
  const btn = (t: (typeof order)[number], label: string, colour: string) => {
    const on = tab === t;
    return (
      <button ref={refs[t]} type="button" role="tab" id={`${uid}-tab-${t}`} aria-selected={on} aria-controls={`${uid}-panel-${t}`} tabIndex={on ? 0 : -1} onClick={() => setTab(t)}
        className={"min-h-11 rounded-pill px-5 text-sm font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-amber-400 sm:px-6 sm:text-base " + (on ? "text-white shadow-soft" : "text-ink-soft hover:text-ink")}
        style={on ? { background: colour } : undefined}>
        {label}
      </button>
    );
  };
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="What's happening" onKeyDown={onKey} className="inline-flex rounded-pill border border-line-strong bg-sand p-1">
          {btn("events", "Events", GOLD)}
          {btn("regular", "Regular activities", TEAL)}
        </div>
        <Link href={cta.href} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-sand">{cta.label} →</Link>
      </div>
      <div role="tabpanel" id={`${uid}-panel-events`} aria-labelledby={`${uid}-tab-events`} hidden={tab !== "events"} className="happening-fade">{events}</div>
      <div role="tabpanel" id={`${uid}-panel-regular`} aria-labelledby={`${uid}-tab-regular`} hidden={tab !== "regular"} className="happening-fade">{activities}</div>
    </div>
  );
}
