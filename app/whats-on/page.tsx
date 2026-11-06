import Image from "next/image";
import { normaliseCategory, sameCategory } from "@/lib/event-categories";
import Link from "next/link";
import {
  getUpcomingEvents,
  getEventsInMonth,
  isFreeListEvent,
  getEventCategories,
  type DateRange,
  type EventListItem,
} from "@/lib/events-data";
import {
  CategoryChips,
  DateChips,
  FreeToggle,
  FeaturedStrip,
  OnSaleStrip,
  EventsBrowser,
} from "@/components/events/EventsListing";

import { WhatsOnTabs } from "@/components/activities/WhatsOnTabs";
import { ActivityStrip } from "@/components/activities/ActivityStrip";
import { getActivityStrip } from "@/lib/activities-data";
import { whenForEventsRange } from "@/lib/activities";
import { resilient } from "@/lib/home-resilience";

export const dynamic = "force-dynamic";
export const metadata = { title: "What's On" };

const EVENTS = "#d4921a";
const PAGE_SIZE = 20;

const RANGES: DateRange[] = ["today", "week", "month", "all"];

function parseRange(v: string | undefined): DateRange {
  return RANGES.includes(v as DateRange) ? (v as DateRange) : "all";
}

export default async function WhatsOnPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; date?: string; free?: string; view?: string; q?: string }>;
}) {
  const sp = await searchParams;
  // A legacy name in an old link (?category=Music%20%26%20Gigs) resolves to its current category.
  const category = normaliseCategory(sp.category) ?? undefined;
  const range = parseRange(sp.date);
  const freeOnly = sp.free === "1";
  const calendar = sp.view === "calendar";

  // Highlights (featured + on-sale) are independent of the active filters —
  // fetched across all upcoming events, like the app's highlights row.
  const now = new Date();
  const nowIso = now.toISOString();
  // Regular activities (classes and groups) are NOT events and never enter the list below. A compact strip points to them, for the same period
  // as the date chips. It is bounded (2.5 s, kept 60 s) and on a real failure serves its last good copy or nothing, so it can never delay or break What's On.
  // emptyGuardMs: 0 because an EMPTY answer here is genuine (the loader throws on failure), so a paused or cancelled activity leaves the strip within a minute.
  const stripWhen = whenForEventsRange(range);
  const showStrip = !calendar && !category && !freeOnly;
  const [pageEvents, highlights, monthEvents, categories, activityStrip] = await Promise.all([
    getUpcomingEvents({ category, range, limit: PAGE_SIZE }),
    // Featured / On-sale strips are upcoming-only: an exhibition that began weeks ago must not headline them.
    getUpcomingEvents({ limit: 60, upcomingOnly: true }),
    calendar ? getEventsInMonth(now.getFullYear(), now.getMonth()) : Promise.resolve([] as EventListItem[]),
    getEventCategories(),
    showStrip
      ? resilient(`whatson:activities:${stripWhen}`, { ttlMs: 60_000, deadlineMs: 2500, staleMs: 10 * 60_000, emptyGuardMs: 0, fallback: [] }, () => getActivityStrip(stripWhen, now))
      : Promise.resolve([]),
  ]);

  const visible = freeOnly ? pageEvents.filter(isFreeListEvent) : pageEvents;
  const hasMore = !freeOnly && pageEvents.length === PAGE_SIZE;

  const featured = highlights.filter((e) => e.is_featured).slice(0, 8);
  const onSale = highlights.filter((e) => e.has_tickets).slice(0, 12);

  // Only show the Featured / On-sale strips on the true default view — any active
  // filter (category, date range, free-only, calendar) hides them, otherwise the
  // all-time highlights contradict the filtered list.
  const showHighlights = !category && !freeOnly && !calendar && range === "all";

  return (
    <>
      {/* Header band */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: EVENTS }}>
        <Image src="/heroes/events.jpg" alt="" fill priority className="object-cover opacity-30" />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to top, ${EVENTS}f2, ${EVENTS}b3 60%, ${EVENTS}80)` }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-16">
          <p className="eyebrow text-paper/85">OneShetland</p>
          <h1 className="mt-2 font-display text-5xl font-bold leading-none sm:text-6xl">What&apos;s On</h1>
          <p className="mt-4 max-w-xl text-lg text-paper/90">
            Gigs, galas, markets and the Up Helly Aa — everything happening across the isles.
          </p>
        </div>
      </section>

      {/* Section switch. Deliberately NOT inside the sticky bar below: that bar is already tall on a phone and must stay exactly as it was. */}
      <div className="border-b border-line bg-cream">
        <div className="mx-auto max-w-6xl px-5 py-2.5"><WhatsOnTabs active="events" /></div>
      </div>

      {/* Sticky filters */}
      <div className="sticky top-16 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl space-y-2.5 px-5 py-3">
          {/* List ↔ calendar toggle + date range + free */}
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle calendar={calendar} sp={sp} />
            {!calendar && (
              <>
                <span className="hidden h-5 w-px bg-line-strong sm:block" />
                <DateChips active={range} category={category} freeOnly={freeOnly} />
                <span className="hidden h-5 w-px bg-line-strong sm:block" />
                <FreeToggle on={freeOnly} category={category} range={range} />
              </>
            )}
          </div>
          {/* Category — both modes */}
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryChips
              categories={categories}
              active={category}
              range={range}
              freeOnly={freeOnly}
              calendar={calendar}
            />
          </div>
        </div>
      </div>

      <div className={`mx-auto px-5 py-12 sm:py-14 ${calendar ? "max-w-7xl" : "max-w-6xl"}`}>
        {calendar ? (
          <EventsBrowser
            mode="calendar"
            monthEvents={category ? monthEvents.filter((e) => sameCategory(e.category, category)) : monthEvents}
            initialYear={now.getFullYear()}
            initialMonth={now.getMonth()}
          />
        ) : (
          <>
            {showStrip && <ActivityStrip items={activityStrip} when={stripWhen} now={now} />}
            {showHighlights && featured.length > 0 && <FeaturedStrip events={featured} nowIso={nowIso} />}
            {showHighlights && onSale.length > 0 && <OnSaleStrip events={onSale} nowIso={nowIso} />}

            {visible.length === 0 ? (
              <div className="rounded-xl border border-line bg-paper p-12 text-center shadow-soft">
                <h2 className="font-display text-2xl font-bold">
                  Nothing listed{category ? ` in ${category}` : ""} just now
                </h2>
                <p className="mx-auto mt-2 max-w-md text-ink-soft">
                  Try a different date or category. New events are added all the time and appear here
                  automatically once they&apos;re published in the app.
                </p>
                {(category || freeOnly || range !== "all") && (
                  <Link
                    href="/whats-on"
                    className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper"
                    style={{ background: EVENTS }}
                  >
                    See all events
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="mb-8 flex items-baseline justify-between">
                  <h2 className="font-display text-2xl font-bold">What&apos;s on</h2>
                  <p className="text-sm text-ink-muted">
                    {visible.length}
                    {hasMore ? "+" : ""} event{visible.length === 1 ? "" : "s"}
                  </p>
                </div>
                {/* The key is load-bearing. EventsBrowser seeds its list from
                    `initial` via useState, which React reads only on the first
                    mount — so a filter change (a client-side navigation, not a
                    remount) updated the count above but left the old rows on
                    screen. Keying on the filters forces a fresh mount, which is
                    the idiomatic way to reset component state when the inputs
                    that define it change. */}
                <EventsBrowser
                  key={`${category ?? "all"}|${range}|${freeOnly ? "free" : "any"}`}
                  mode="list"
                  initial={visible}
                  category={category}
                  range={range}
                  freeOnly={freeOnly}
                  pageSize={PAGE_SIZE}
                  initialHasMore={hasMore}
                  nowIso={nowIso}
                  initialQuery={typeof sp.q === "string" ? sp.q.slice(0, 60) : ""}
                />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* List ↔ calendar toggle — preserves the other filters in the link. */
function ViewToggle({
  calendar,
  sp,
}: {
  calendar: boolean;
  sp: { category?: string; date?: string; free?: string };
}) {
  const base = new URLSearchParams();
  if (sp.category) base.set("category", sp.category);
  if (sp.date) base.set("date", sp.date);
  if (sp.free) base.set("free", sp.free);
  const listHref = `/whats-on${base.toString() ? `?${base}` : ""}`;
  const calParams = new URLSearchParams();
  if (sp.category) calParams.set("category", sp.category);
  calParams.set("view", "calendar");
  const calHref = `/whats-on?${calParams}`;

  return (
    <div className="inline-flex rounded-pill border border-line-strong bg-paper p-0.5">
      <Link
        href={listHref}
        className={
          "rounded-pill px-3.5 py-1.5 text-sm font-semibold transition " +
          (!calendar ? "text-paper" : "text-ink-soft hover:bg-sand")
        }
        style={!calendar ? { background: EVENTS } : undefined}
      >
        List
      </Link>
      <Link
        href={calHref}
        className={
          "rounded-pill px-3.5 py-1.5 text-sm font-semibold transition " +
          (calendar ? "text-paper" : "text-ink-soft hover:bg-sand")
        }
        style={calendar ? { background: EVENTS } : undefined}
      >
        Calendar
      </Link>
    </div>
  );
}
