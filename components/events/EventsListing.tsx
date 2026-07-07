"use client";

import { useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import {
  type EventListItem,
  type DateRange,
  groupByDate,
  fmtTime,
  fmtLongDateTime,
  priceLabel,
} from "@/lib/events-data";

const EVENTS = "#d4921a";

/* ── URL helpers ──────────────────────────────────────────────────────────── */
function whatsOnHref(p: { category?: string; date?: DateRange; free?: boolean }) {
  const q = new URLSearchParams();
  if (p.category) q.set("category", p.category);
  if (p.date && p.date !== "all") q.set("date", p.date);
  if (p.free) q.set("free", "1");
  const s = q.toString();
  return `/whats-on${s ? `?${s}` : ""}`;
}

/* ── Category filter ──────────────────────────────────────────────────────── */
export function CategoryChips({
  categories,
  active,
  range = "all",
  freeOnly = false,
  calendar = false,
}: {
  categories: string[];
  active?: string;
  range?: DateRange;
  freeOnly?: boolean;
  calendar?: boolean;
}) {
  const hrefFor = (cat?: string) => {
    if (calendar) {
      const q = new URLSearchParams();
      if (cat) q.set("category", cat);
      q.set("view", "calendar");
      return `/whats-on?${q}`;
    }
    return whatsOnHref({ category: cat, date: range, free: freeOnly });
  };
  const chip = (label: string, href: string, on: boolean) => (
    <Link
      key={label}
      href={href}
      className={
        "shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition " +
        (on ? "text-paper shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand")
      }
      style={on ? { background: EVENTS } : undefined}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {chip("All", hrefFor(undefined), !active)}
      {categories.map((c) => chip(c, hrefFor(c), active === c))}
    </div>
  );
}

/* ── Date-range chips ─────────────────────────────────────────────────────── */
const DATE_LABELS: { value: DateRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All" },
];

export function DateChips({
  active,
  category,
  freeOnly,
}: {
  active: DateRange;
  category?: string;
  freeOnly: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {DATE_LABELS.map((d) => {
        const on = active === d.value;
        return (
          <Link
            key={d.value}
            href={whatsOnHref({ category, date: d.value, free: freeOnly })}
            className={
              "rounded-pill px-3 py-1.5 text-sm font-semibold transition " +
              (on ? "text-paper" : "border border-line-strong text-ink-soft hover:bg-sand")
            }
            style={on ? { background: EVENTS } : undefined}
          >
            {d.label}
          </Link>
        );
      })}
    </div>
  );
}

/* ── Free-only toggle ─────────────────────────────────────────────────────── */
export function FreeToggle({
  on,
  category,
  range,
}: {
  on: boolean;
  category?: string;
  range: DateRange;
}) {
  return (
    <Link
      href={whatsOnHref({ category, date: range, free: !on })}
      className={
        "rounded-pill px-3.5 py-1.5 text-sm font-semibold transition " +
        (on ? "text-paper" : "border border-line-strong text-ink-soft hover:bg-sand")
      }
      style={on ? { background: EVENTS } : undefined}
    >
      Free only
    </Link>
  );
}

/* ── Shared fallback art ──────────────────────────────────────────────────── */
function CalFallback({ size }: { size: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-events/10 text-events/60">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    </div>
  );
}

/* ── Featured strip (multiple heroes, horizontal scroll) ──────────────────── */
export function FeaturedStrip({ events }: { events: EventListItem[] }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 font-display text-2xl font-bold">Featured</h2>
      <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/whats-on/${e.id}`}
            className="group relative block h-56 w-72 shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-events/10 shadow-soft sm:w-80"
          >
            {e.cover_url ? (
              <SafeImage
                src={e.cover_url}
                className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                fallback={<CalFallback size={48} />}
              />
            ) : (
              <CalFallback size={48} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <span
              className="absolute left-3 top-3 rounded-pill px-2.5 py-1 text-xs font-bold text-paper"
              style={{ background: EVENTS }}
            >
              ★ Featured
            </span>
            <div className="absolute inset-x-3 bottom-3 text-paper">
              <h3 className="font-display text-lg font-bold leading-tight line-clamp-2">{e.title}</h3>
              <p className="mt-1 truncate text-sm text-paper/85">
                {fmtLongDateTime(e.starts_at)}
                {e.venue ? ` · ${e.venue}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── On-sale-now strip (events with tickets) ──────────────────────────────── */
export function OnSaleStrip({ events }: { events: EventListItem[] }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={EVENTS} strokeWidth="1.6" aria-hidden>
          <path d="M3 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" />
          <path d="M13 5v14" strokeDasharray="2 2" />
        </svg>
        On sale now
      </h2>
      <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {events.map((e) => {
          const label = priceLabel(e);
          return (
            <Link
              key={e.id}
              href={`/whats-on/${e.id}`}
              className="group flex w-52 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="h-28 w-full overflow-hidden bg-events/10">
                {e.cover_url ? (
                  <SafeImage src={e.cover_url} className="h-full w-full object-cover" fallback={<CalFallback size={28} />} />
                ) : (
                  <CalFallback size={28} />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <h3 className="font-display text-sm font-bold leading-snug line-clamp-2">{e.title}</h3>
                <p className="text-xs text-ink-muted">{fmtLongDateTime(e.starts_at)}</p>
                <span
                  className="mt-auto inline-block rounded-pill px-3 py-1.5 text-center text-xs font-bold text-paper"
                  style={{ background: EVENTS }}
                >
                  {label ?? "Get tickets"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── Event row (date-grouped list) ────────────────────────────────────────── */
function EventRow({ e }: { e: EventListItem }) {
  const organiser = e.hub?.name ?? e.business?.name ?? null;
  const label = priceLabel(e);
  return (
    <Link
      href={`/whats-on/${e.id}`}
      className="group flex items-center gap-4 rounded-xl border border-line bg-paper p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-events/10 sm:w-32">
        {e.cover_url ? (
          <SafeImage src={e.cover_url} className="h-full w-full object-cover" fallback={<CalFallback size={28} />} />
        ) : (
          <CalFallback size={28} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-lg font-bold leading-snug">{e.title}</h3>
        <p className="mt-0.5 truncate text-sm text-ink-muted">
          {fmtTime(e.starts_at)}
          {e.venue ? ` · ${e.venue}` : ""}
          {organiser ? ` · ${organiser}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {e.category && (
            <span className="rounded-pill bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
              {e.category}
            </span>
          )}
          {label && (
            <span
              className={
                "rounded-pill px-2.5 py-0.5 text-xs font-semibold " +
                (label === "Free" ? "bg-emerald-100 text-emerald-700" : "")
              }
              style={label === "Free" ? undefined : { background: "rgba(212,146,26,0.15)", color: EVENTS }}
            >
              {e.has_tickets && label !== "Free" ? `Get tickets · ${label}` : label}
            </span>
          )}
        </div>
      </div>
      <span aria-hidden className="shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink">
        ›
      </span>
    </Link>
  );
}

/* ── Date-grouped listings ────────────────────────────────────────────────── */
function DateGroupedList({ events }: { events: EventListItem[] }) {
  const groups = groupByDate(events);
  return (
    <div className="space-y-12">
      {groups.map((g) => {
        const d = new Date(g.events[0].starts_at);
        const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
        const dayMonth = d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
        return (
          <div key={g.key} className="grid gap-5 md:grid-cols-[170px_1fr]">
            <div className="md:sticky md:top-24 md:self-start">
              <p className="font-display text-2xl font-bold" style={{ color: EVENTS }}>
                {weekday}
              </p>
              <p className="text-ink-muted">{dayMonth}</p>
              <div className="mt-3 hidden h-px w-10 md:block" style={{ background: EVENTS }} />
            </div>
            <div className="space-y-3">
              {g.events.map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Month calendar grid ──────────────────────────────────────────────────── */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function MonthCalendar({ monthEvents }: { monthEvents: EventListItem[] }) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [loaded, setLoaded] = useState<Record<string, EventListItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(dayKey(now));

  const monthId = `${view.year}-${view.month}`;
  const initialId = `${now.getFullYear()}-${now.getMonth()}`;
  const events = monthId === initialId ? monthEvents : (loaded[monthId] ?? []);

  async function changeMonth(delta: number) {
    let { year, month } = view;
    month += delta;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    const id = `${year}-${month}`;
    setView({ year, month });
    setSelected(null);
    if (id !== initialId && !loaded[id]) {
      setLoading(true);
      try {
        const res = await fetch(`/whats-on/calendar?year=${year}&month=${month}`);
        const json = (await res.json()) as { events: EventListItem[] };
        setLoaded((prev) => ({ ...prev, [id]: json.events ?? [] }));
      } catch {
        setLoaded((prev) => ({ ...prev, [id]: [] }));
      }
      setLoading(false);
    }
  }

  // Bucket events by day.
  const byDay: Record<string, EventListItem[]> = {};
  for (const e of events) {
    const k = dayKey(new Date(e.starts_at));
    (byDay[k] ??= []).push(e);
  }

  // Grid cells (Mon-first).
  const first = new Date(view.year, view.month, 1);
  const startPad = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.year, view.month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const selectedEvents = selected ? byDay[selected] ?? [] : [];
  const todayKey = dayKey(now);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => changeMonth(-1)}
            className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-sand"
            aria-label="Previous month"
          >
            ‹
          </button>
          <h2 className="font-display text-2xl font-bold">{monthLabel}</h2>
          <button
            onClick={() => changeMonth(1)}
            className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-sand"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-ink-muted">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1">
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1.5">
          {cells.map((c, i) => {
            if (!c) return <div key={i} className="aspect-square rounded-lg" />;
            const k = dayKey(c);
            const count = byDay[k]?.length ?? 0;
            const isSel = selected === k;
            const isToday = k === todayKey;
            return (
              <button
                key={i}
                onClick={() => setSelected(count > 0 ? k : null)}
                disabled={count === 0}
                className={
                  "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition " +
                  (isSel
                    ? "border-transparent text-paper"
                    : count > 0
                      ? "border-line bg-paper font-semibold hover:bg-sand"
                      : "border-transparent text-ink-faint") +
                  (isToday && !isSel ? " ring-1 ring-events" : "")
                }
                style={isSel ? { background: EVENTS } : undefined}
              >
                <span>{c.getDate()}</span>
                {count > 0 && (
                  <span
                    className={"mt-0.5 h-1.5 w-1.5 rounded-full " + (isSel ? "bg-paper" : "")}
                    style={isSel ? undefined : { background: EVENTS }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {loading && <p className="mt-4 text-center text-sm text-ink-muted">Loading…</p>}
      </div>

      <div className="lg:border-l lg:border-line lg:pl-8">
        <h3 className="mb-4 font-display text-lg font-bold">
          {selected
            ? `${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"}`
            : "Pick a day"}
        </h3>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {selected ? "Nothing on this day." : "Tap a highlighted date to see what's on."}
          </p>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Browser: list (with load-more) or calendar ───────────────────────────── */
type BrowserProps =
  | {
      mode: "list";
      initial: EventListItem[];
      category?: string;
      range: DateRange;
      freeOnly: boolean;
      pageSize: number;
      initialHasMore: boolean;
    }
  | {
      mode: "calendar";
      monthEvents: EventListItem[];
      initialYear: number;
      initialMonth: number;
    };

export function EventsBrowser(props: BrowserProps) {
  if (props.mode === "calendar") {
    return <MonthCalendar monthEvents={props.monthEvents} />;
  }
  return <ListWithLoadMore {...props} />;
}

function ListWithLoadMore({
  initial,
  category,
  range,
  freeOnly,
  pageSize,
  initialHasMore,
}: {
  initial: EventListItem[];
  category?: string;
  range: DateRange;
  freeOnly: boolean;
  pageSize: number;
  initialHasMore: boolean;
}) {
  const [events, setEvents] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(initial.length);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? events.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.venue?.toLowerCase().includes(q) ||
          e.locality?.toLowerCase().includes(q) ||
          e.business?.name?.toLowerCase().includes(q) ||
          e.hub?.name?.toLowerCase().includes(q),
      )
    : events;

  async function loadMore() {
    setLoading(true);
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (range !== "all") q.set("date", range);
    if (freeOnly) q.set("free", "1");
    q.set("offset", String(offset));
    try {
      const res = await fetch(`/whats-on/more?${q}`);
      const json = (await res.json()) as { events: EventListItem[]; hasMore: boolean };
      const more = json.events ?? [];
      setEvents((prev) => [...prev, ...more]);
      setOffset((prev) => prev + pageSize);
      setHasMore(json.hasMore);
    } catch {
      setHasMore(false);
    }
    setLoading(false);
  }

  return (
    <>
      {/* Keyword search — filters the loaded events client-side. */}
      <div className="mb-8">
        <div className="relative max-w-md">
          <svg
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events by name, venue or organiser…"
            aria-label="Search events"
            className="w-full rounded-pill border border-line-strong bg-paper py-2.5 pl-10 pr-10 text-sm text-ink shadow-soft outline-none transition placeholder:text-ink-muted focus:border-events"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6M9 9l6 6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {q && filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-paper p-12 text-center shadow-soft">
          <h2 className="font-display text-2xl font-bold">No events match “{query.trim()}”</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            Try a different keyword, or clear the search to see everything in this view.
          </p>
        </div>
      ) : (
        <DateGroupedList events={filtered} />
      )}

      {hasMore && !q && (
        <div className="mt-12 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="rounded-pill px-6 py-3 font-semibold text-paper shadow-soft transition hover:brightness-95 disabled:opacity-60"
            style={{ background: EVENTS }}
          >
            {loading ? "Loading…" : "Load more events"}
          </button>
        </div>
      )}
    </>
  );
}

/* FeaturedEvent kept for any external imports of the original single-hero. */
export function FeaturedEvent({ e }: { e: EventListItem }) {
  return <FeaturedStrip events={[e]} />;
}
