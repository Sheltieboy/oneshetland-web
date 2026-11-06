"use client";

import { useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import type { ForYouItem } from "@/lib/for-you.server";
import type { HomePin } from "@/lib/home-pin";
import { forYouLayout, MAX_RECS } from "@/lib/for-you-layout";

/**
 * ForYou — the compact, personalised strip near the top of the homepage (signed-in members only).
 *
 *   - One short heading, no subtitle. 64 px cards: icon tile, one-line title and subtitle, a "now / today" cue or a chevron.
 *   - Desktop: four slots in a row. A pinned launch card takes two of them. Anything beyond the first row folds into "+N more", which expands in place.
 *   - Phone: one or two recommendations stack; three or more become a swipe row where the next card peeks in. The pinned card is a banner above.
 *   - The pinned card's wording, link and last day are set in Admin -> Homepage (lib/home-pin.ts). Dismissing it is remembered for that card, on this device.
 *   - Reduced motion: the live-dot ping and the hover lift are switched off.
 * Every recommendation, its priority order and its link come from lib/for-you.server.ts, unchanged.
 */
export function ForYou({ name, items, pin }: { name: string; items: ForYouItem[]; pin?: HomePin | null }) {
  const [expanded, setExpanded] = useState(false);
  const dismissed = useDismissedPins();
  const listId = useId();
  const recs = items.slice(0, MAX_RECS);
  const showPin = !!pin && !dismissed.includes(pin.key);
  if (!recs.length && !showPin) return null;

  const L = forYouLayout(recs.length, showPin, expanded);

  return (
    <section aria-labelledby={`${listId}-h`} className="mx-auto max-w-6xl px-5 pt-5 sm:pt-6">
      <h2 id={`${listId}-h`} className="mb-2.5 font-display text-[1.05rem] font-bold leading-6 text-navy">
        For you{name ? `, ${name}` : ""}
      </h2>

      <div className={`grid gap-2.5 ${L.gridClass}`}>
        {showPin && pin && <PinnedCard pin={pin} />}

        {recs.length > 0 && (
          <ul
            id={listId}
            className={
              "md:contents " +
              (L.mobile === "stack"
                ? "grid gap-2 md:gap-0"
                : "-mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-pl-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:pb-0")
            }
          >
            {recs.map((item, i) => {
              const folded = !expanded && i >= L.capacity;
              return (
                <li
                  key={item.id}
                  className={
                    "min-w-0 " +
                    (L.mobile === "swipe" ? "w-[15.5rem] shrink-0 snap-start md:w-auto" : "") +
                    (folded ? " md:hidden" : "")
                  }
                >
                  <Card item={item} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {L.hidden > 0 || (expanded && recs.length > L.capacity) ? (
        <div className="mt-2 hidden md:block">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls={listId}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-pill border border-line-strong px-3.5 text-sm font-semibold text-ink-soft transition hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy motion-reduce:transition-none"
          >
            {expanded ? "Show fewer" : `+${L.hidden} more`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/* ── a recommendation ──────────────────────────────────────────────────────────────────────────────────────────────────── */

function Card({ item }: { item: ForYouItem }) {
  const accent = item.accent ?? "#032f4c";
  const style = {
    "--accent": accent,
    "--tint": `color-mix(in srgb, ${accent} 7%, transparent)`,
    "--tint-strong": `color-mix(in srgb, ${accent} 30%, transparent)`,
  } as React.CSSProperties;

  return (
    <Link
      href={item.href}
      style={style}
      className="group relative flex h-16 w-full items-center gap-3 overflow-hidden rounded-[14px] border border-line bg-paper pl-3.5 pr-3 transition hover:border-[var(--tint-strong)] hover:bg-[var(--tint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy motion-reduce:transition-none"
    >
      <span aria-hidden className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r-[3px]" style={{ background: accent }} />
      <span
        className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px]"
        style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
      >
        {item.image ? (
          <SafeImage src={item.image} alt="" className="h-full w-full object-cover" fallback={<Icon name={item.icon} />} />
        ) : (
          <Icon name={item.icon} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9rem] font-semibold leading-5 text-ink">{item.title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[0.8rem] leading-5 text-ink-muted">
          {item.cue && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-pill px-1.5 text-[9.5px] font-bold uppercase leading-4 tracking-wide"
              style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
            >
              {isLiveCue(item.cue) && (
                <span aria-hidden className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-70 motion-safe:animate-ping" style={{ background: accent }} />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                </span>
              )}
              {item.cue}
            </span>
          )}
          <span className="truncate">{item.subtitle}</span>
        </span>
      </span>
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-muted transition group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </Link>
  );
}

function isLiveCue(cue: string): boolean {
  return ["in progress", "today", "ready", "accepted"].includes(cue);
}

/* ── the pinned launch card ────────────────────────────────────────────────────────────────────────────────────────────── */

const DISMISS_KEY = "os_dismissed_pins";
const PINS_EVENT = "os:pins";
let memoryDismissed: string[] = [];   // used when storage is blocked (private windows): hidden for this visit at least

function readRaw(): string {
  try { return window.localStorage.getItem(DISMISS_KEY) ?? ""; } catch { return ""; }
}
function parseKeys(raw: string): string[] {
  try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb); window.addEventListener(PINS_EVENT, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(PINS_EVENT, cb); };
}
/** The dismissed card keys on this device. Empty on the server and during hydration, so the card is part of the server HTML. */
function useDismissedPins(): string[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  return [...parseKeys(raw), ...memoryDismissed];
}
const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** Runs while the HTML is parsed, before paint: a card already dismissed on this device never flashes. */
const hideIfDismissedScript = (key: string) =>
  `(function(){try{var d=JSON.parse(localStorage.getItem(${JSON.stringify(DISMISS_KEY)})||"[]");if(Array.isArray(d)&&d.indexOf(${JSON.stringify(key)})>-1){document.currentScript.parentElement.hidden=true}}catch(e){}})()`;

function PinnedCard({ pin }: { pin: HomePin }) {
  const hydrated = useHydrated();

  const dismiss = () => {
    memoryDismissed = [...memoryDismissed, pin.key];
    try { window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...parseKeys(readRaw()).filter((k) => k !== pin.key), pin.key].slice(-30))); } catch { /* hidden for this visit at least */ }
    window.dispatchEvent(new Event(PINS_EVENT));
  };
  const external = /^https:/i.test(pin.href);

  return (
    <div data-pin={pin.key} className="relative flex min-h-[4.5rem] items-center overflow-hidden rounded-[14px] border border-navy bg-navy text-white md:col-span-2 md:h-16 md:min-h-0">
      {!hydrated && <script dangerouslySetInnerHTML={{ __html: hideIfDismissedScript(pin.key) }} />}
      <span aria-hidden className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r-[3px] bg-[#d4921a]" />
      <Link
        href={pin.href}
        {...(external ? { rel: "noopener" } : {})}
        className="flex h-full min-w-0 flex-1 items-center gap-3 py-2 pl-3.5 pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
      >
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/15 text-[#f3d28a]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3Z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" /></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9rem] font-semibold leading-5">{pin.title}</span>
          {pin.body && <span className="block truncate text-[0.8rem] leading-5 text-white/75">{pin.body}</span>}
        </span>
        <span className="hidden shrink-0 rounded-pill bg-white/15 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/25 motion-reduce:transition-none sm:inline-block">{pin.cta}</span>
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/80 sm:hidden"><path d="m9 6 6 6-6 6" /></svg>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={`Dismiss: ${pin.title}`}
        className="grid h-11 w-10 shrink-0 place-items-center text-white/70 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white motion-reduce:transition-none"
      >
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
      </button>
    </div>
  );
}

/* ── Inline icons (currentColor) ───────────────────────────────────────────────────────────────────────────────────────── */
function Icon({ name }: { name: string }) {
  const p = ICONS[name] ?? ICONS.play;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p}
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  fetch: <><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M5 18H3V6h11v12M14 9h4l3 4v5h-2" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  ticket: <><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" /><path d="M13 6v12" strokeDasharray="2 2" /></>,
  stamp: <><path d="M5 22h14M12 3a3 3 0 0 0-3 3c0 1 .5 1.5 1 2.5.4.8-.2 1.5-1 1.5H8a2 2 0 0 0-2 2v2h12v-2a2 2 0 0 0-2-2h-1c-.8 0-1.4-.7-1-1.5.5-1 1-1.5 1-2.5a3 3 0 0 0-3-3Z" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><circle cx="17.5" cy="13.5" r="1" fill="currentColor" stroke="none" /></>,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10 8l6 4-6 4V8Z" fill="currentColor" stroke="none" /></>,
  hub: <><path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6" /></>,
  story: <><path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5 9 5 12 8 12 8s3-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.65 12 21 12 21Z" /></>,
  boat: <><path d="M3 14h18l-2 5a3 3 0 0 1-2.8 2H7.8A3 3 0 0 1 5 19l-2-5ZM6 14V6l6-3 6 3v8" /></>,
};
