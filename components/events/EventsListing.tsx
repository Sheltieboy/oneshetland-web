import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import {
  type EventListItem,
  groupByDate,
  fmtTime,
  fmtLongDateTime,
} from "@/lib/events-data";

const EVENTS = "#d4921a";

/* ── Category filter ──────────────────────────────────────────────────────── */
export function CategoryChips({ categories, active }: { categories: string[]; active?: string }) {
  const chip = (label: string, href: string, on: boolean) => (
    <Link
      key={label}
      href={href}
      className={
        "shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition " +
        (on
          ? "text-paper shadow-soft"
          : "border border-line-strong text-ink-soft hover:bg-sand")
      }
      style={on ? { background: EVENTS } : undefined}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {chip("All", "/whats-on", !active)}
      {categories.map((c) =>
        chip(c, `/whats-on?category=${encodeURIComponent(c)}`, active === c),
      )}
    </div>
  );
}

/* ── Featured event ───────────────────────────────────────────────────────── */
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

export function FeaturedEvent({ e }: { e: EventListItem }) {
  return (
    <div className="grid overflow-hidden rounded-xl border border-line bg-paper shadow-soft md:grid-cols-2">
      <Link href={`/whats-on/${e.id}`} className="relative block min-h-[260px] bg-events/10 md:min-h-[380px]">
        {e.cover_url ? (
          <SafeImage src={e.cover_url} className="absolute inset-0 h-full w-full object-cover" fallback={<CalFallback size={64} />} />
        ) : (
          <CalFallback size={64} />
        )}
      </Link>
      <div className="flex flex-col justify-center p-7 sm:p-10">
        <p className="eyebrow" style={{ color: EVENTS }}>
          Featured{e.category ? ` · ${e.category}` : ""}
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-[2.5rem]">
          {e.title}
        </h2>
        <p className="mt-4 text-ink-soft">
          {fmtLongDateTime(e.starts_at)}
          {e.venue ? ` · ${e.venue}` : ""}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href={`/whats-on/${e.id}`}
            className="rounded-pill px-6 py-3 font-semibold text-paper shadow-soft transition hover:brightness-95"
            style={{ background: EVENTS }}
          >
            View event
          </Link>
          {e.has_tickets && (
            <Link
              href={`/whats-on/${e.id}`}
              className="rounded-pill border-2 px-5 py-2.5 text-sm font-semibold transition hover:brightness-95"
              style={{ borderColor: EVENTS, color: EVENTS }}
            >
              Get tickets{e.price_text ? ` · ${e.price_text}` : ""}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Date-grouped listings ────────────────────────────────────────────────── */
export function EventListings({ events }: { events: EventListItem[] }) {
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

function EventRow({ e }: { e: EventListItem }) {
  const organiser = e.hub?.name ?? e.business?.name ?? null;
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
          {e.has_tickets && (
            <span className="rounded-pill bg-events/15 px-2.5 py-0.5 text-xs font-semibold" style={{ color: EVENTS }}>
              Get tickets{e.price_text ? ` · ${e.price_text}` : ""}
            </span>
          )}
        </div>
      </div>
      <span
        aria-hidden
        className="shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink"
      >
        ›
      </span>
    </Link>
  );
}
