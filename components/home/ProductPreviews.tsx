"use client";

import { useState, type ReactNode } from "react";

/**
 * Miniature, working ILLUSTRATIONS of real OneShetland screens, used by Latest from OneShetland. The markup, classes and wording come from the
 * product (components/saved/SavedList.tsx, SaveButton.tsx, lib/saved-copy.ts), so visitors see what they will get. They show no real listing,
 * business, date or person: every example is generic and labelled "Example" so none can be mistaken for live information.
 */
const ExampleTag = ({ className = "" }: { className?: string }) => (
  <span className={`rounded-pill bg-ink/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${className}`}>Example</span>
);

/**
 * A contemporary smartphone, drawn from published 6.1-inch flagship geometry rather than eyeballed:
 *   body 70.6 x 146.6 mm (1 : 2.077), slim even bezel (about 2% of the width), body corner radius about 15.5% of the width, screen radius
 *   about 12.5% (concentric with the body), a pill-shaped Dynamic Island (about 32% of the screen width) 3% from the top, a status bar at the
 *   safe-area line, a home indicator, and the side buttons (action, two volume, power). Everything is sized from one variable, --w, so it can
 *   never be stretched: set the width and the height, radii and bezel follow. Cropping is done by the parent, never by changing the device.
 */
export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative mx-auto h-[calc(var(--w)*2.077)] w-[var(--w)] [--w:252px] lg:[--w:264px] ${className}`}>
      <span aria-hidden className="absolute -left-[2.5px] top-[17.5%] h-[3.6%] w-[3px] rounded-l-sm bg-[#7d858f]" />
      <span aria-hidden className="absolute -left-[2.5px] top-[23.5%] h-[6.5%] w-[3px] rounded-l-sm bg-[#7d858f]" />
      <span aria-hidden className="absolute -left-[2.5px] top-[31.5%] h-[6.5%] w-[3px] rounded-l-sm bg-[#7d858f]" />
      <span aria-hidden className="absolute -right-[2.5px] top-[27%] h-[10%] w-[3px] rounded-r-sm bg-[#7d858f]" />
      {/* titanium band, then the black bezel, then the glass */}
      <div className="absolute inset-0 rounded-[calc(var(--w)*.155)] bg-gradient-to-b from-[#d5dae0] via-[#8f969f] to-[#d5dae0] p-[2px] shadow-[0_34px_60px_-22px_rgba(0,0,0,.7),0_10px_24px_-10px_rgba(0,0,0,.5)]">
        <div className="relative h-full w-full rounded-[calc(var(--w)*.15)] bg-black p-[calc(var(--w)*.02)]">
          <div className="relative h-full w-full overflow-hidden rounded-[calc(var(--w)*.13)] bg-cream">
            {/* Dynamic Island */}
            <span aria-hidden className="absolute left-1/2 top-[calc(var(--w)*.03)] z-20 h-[calc(var(--w)*.092)] w-[32%] -translate-x-1/2 rounded-full bg-black" />
            {/* Status bar */}
            <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex h-[calc(var(--w)*.15)] items-center justify-between px-[8%] pt-[calc(var(--w)*.02)] text-ink">
              <span className="text-[11px] font-semibold tracking-tight">9:41</span>
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 17 11" width="15" height="10" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx=".8" /><rect x="4.7" y="5" width="3" height="6" rx=".8" /><rect x="9.4" y="2.5" width="3" height="8.5" rx=".8" /><rect x="14" y="0" width="3" height="11" rx=".8" /></svg>
                <svg viewBox="0 0 16 11" width="14" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1.2 4.2a10 10 0 0 1 13.6 0M3.6 6.7a6.4 6.4 0 0 1 8.8 0" /><circle cx="8" cy="9.2" r="1" fill="currentColor" stroke="none" /></svg>
                <svg viewBox="0 0 26 12" width="23" height="11" fill="none"><rect x=".6" y=".6" width="21.8" height="10.8" rx="3.2" stroke="currentColor" strokeOpacity=".45" /><rect x="2" y="2" width="16.5" height="8" rx="2" fill="currentColor" /><path d="M24 4v4c.8-.3 1.4-1.1 1.4-2S24.800 4.300 24 4Z" fill="currentColor" fillOpacity=".5" /></svg>
              </span>
            </div>
            <div className="h-full overflow-hidden pt-[calc(var(--w)*.17)]">{children}</div>
            {/* Soft fade where the list runs off the screen, then the home indicator */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[12%] bg-gradient-to-t from-cream to-transparent" />
            <span aria-hidden className="absolute bottom-[1.4%] left-1/2 z-20 h-[4px] w-[34%] -translate-x-1/2 rounded-full bg-ink/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

const Bookmark = ({ filled }: { filled: boolean }) => (
  <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4.2L6 21z" /></svg>
);

type Row = { type: string; title: string; when: string; saved: string };
const ROWS: Row[] = [
  { type: "Event", title: "Fiddle night", when: "Saturday, 19:30 · Village hall", saved: "Saved this week" },
  { type: "Job", title: "Support worker", when: "The closing date shows here", saved: "Saved last week" },
  { type: "Business", title: "A local shop", when: "Gifts and knitwear", saved: "Saved last week" },
];

/** The real save-and-find loop: tap the bookmark on an event and it appears in My Saved. */
export function SavePreview() {
  const [saved, setSaved] = useState(false);
  const [touched, setTouched] = useState(false);
  const rows: Row[] = saved ? [{ type: "Event", title: "Concert night", when: "Friday, 19:30 · Local hall", saved: "Saved today" }, ...ROWS] : ROWS;
  return (
    <PhoneFrame>
      <div className="flex items-baseline justify-between px-3.5 pb-1.5">
        <span className="font-display text-[19px] font-bold text-ink">My Saved</span>
        <ExampleTag />
      </div>

      <div className="relative mx-3 overflow-hidden rounded-2xl bg-navy shadow-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/preview-v2/concert.jpg" alt="" className="h-[120px] w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute bottom-2 left-3 right-12 text-white">
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-300">Friday</p>
          <p className="font-display text-[16px] font-bold leading-tight">Concert night</p>
        </div>
        <button
          type="button" aria-pressed={saved} aria-label={saved ? "Saved. Tap to remove." : "Try it: save this event"}
          onClick={() => { setSaved((v) => !v); setTouched(true); }}
          className={`absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-white shadow transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${saved ? "text-[#d4921a]" : "text-ink"}`}
        >
          {!touched && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-amber-300/70 motion-reduce:hidden" />}
          <span className="relative"><Bookmark filled={saved} /></span>
        </button>
      </div>
      <p role="status" className="mx-3.5 mt-1.5 h-4 text-[10.5px] font-semibold text-[#8a5a0b]">{touched ? (saved ? "Saved. It is in your list below." : "Removed from My Saved.") : "Tap the bookmark to try it"}</p>

      <ul className="mx-3 mt-1 rounded-xl border border-line bg-paper shadow-soft">
        {rows.map((r) => (
          <li key={r.title} className="flex items-start gap-2 border-b border-line px-2.5 py-2 last:border-0">
            <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sand text-ink-soft"><Bookmark filled /></span>
            <div className="min-w-0">
              <p className="text-[8.5px] font-bold uppercase tracking-widest text-ink-muted">{r.type}</p>
              <p className="font-display text-[13px] font-bold leading-snug text-ink">{r.title}</p>
              <p className="text-[10.5px] text-ink-soft">{r.when}</p>
              <p className="text-[9.5px] text-ink-muted">{r.saved}</p>
            </div>
          </li>
        ))}
      </ul>
    </PhoneFrame>
  );
}

function JobRow({ title, org, cue, tone, dim }: { title: string; org: string; cue: string; tone: string; dim?: boolean }): ReactNode {
  return (
    <div className={`rounded-2xl border border-line bg-paper p-3.5 shadow-soft ${dim ? "opacity-60" : ""}`}>
      <p className="font-display text-[17px] font-bold leading-snug text-ink">{title}</p>
      <p className="text-[13px] text-ink-soft">{org}</p>
      <span className={`mt-2 inline-block rounded-pill px-2.5 py-1 text-[11px] font-bold ${tone}`}>{cue}</span>
    </div>
  );
}

/** A vacancy as the Work pages show it: closing date on every job, closed ones dimmed. */
export function JobsPreview() {
  return (
    <div className="relative flex flex-col gap-2.5 p-4">
      <ExampleTag className="absolute right-3 top-3 z-10" />
      <JobRow title="Support worker" org="Example employer" cue="Closes in 19 days" tone="bg-emerald-100 text-emerald-900" />
      <JobRow title="Kitchen assistant" org="Example employer" cue="Closes tomorrow" tone="bg-amber-100 text-amber-950" />
      <JobRow title="Café assistant" org="Example employer" cue="Closed" tone="bg-sand text-ink-soft" dim />
    </div>
  );
}

/** The claim checklist a business owner works through. */
export function ClaimPreview() {
  const items: [string, boolean][] = [["Opening hours", true], ["Logo and cover photo", true], ["A short description", true], ["Your first event", false]];
  return (
    <div className="relative p-4">
      <ExampleTag className="absolute right-6 top-6 z-10" />
      <div className="rounded-2xl border border-line bg-paper p-4 shadow-soft">
        <p className="font-display text-[17px] font-bold text-ink">Your listing is 75% complete</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand"><div className="h-full w-3/4 rounded-full bg-[#7c3aed]" /></div>
        <ul className="mt-3 space-y-1.5 text-[13px]">
          {items.map(([t, ok]) => (
            <li key={t} className="flex items-center gap-2 text-ink-soft"><span aria-hidden className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-black ${ok ? "bg-emerald-100 text-emerald-800" : "border border-line-strong text-ink-muted"}`}>{ok ? "✓" : ""}</span>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A regular activity's own page: the next dates, where, and who runs it. */
export function ActivityPreview() {
  const next = ["Monday, 10:00", "Thursday, 10:00"];
  return (
    <div className="relative p-4">
      <div className="rounded-2xl border border-line bg-paper p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#0f766e]">Sport &amp; fitness</p>
            <p className="font-display text-[19px] font-bold leading-tight text-ink">Swim session</p>
            <p className="text-[13px] text-ink-soft">Mondays and Thursdays · Local pool</p>
          </div>
          <ExampleTag className="shrink-0" />
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {next.map((d, i) => <li key={d} className={`rounded-pill px-2.5 py-1 text-[12px] font-bold ${i === 0 ? "bg-[#0f766e] text-white" : "bg-sand text-ink-soft"}`}>{d}</li>)}
        </ul>
      </div>
    </div>
  );
}
