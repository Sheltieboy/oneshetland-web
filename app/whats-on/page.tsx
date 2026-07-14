import Image from "next/image";
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
  searchParams: Promise<{ category?: string; date?: string; free?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const category = sp.category;
  const range = parseRange(sp.date);
  const freeOnly = sp.free === "1";
  const calendar = sp.view === "calendar";

  // Highlights (featured + on-sale) are independent of the active filters —
  // fetched across all upcoming events, like the app's highlights row.
  const now = new Date();
  const [pageEvents, highlights, monthEvents, categories] = await Promise.all([
    getUpcomingEvents({ category, range, limit: PAGE_SIZE }),
    getUpcomingEvents({ limit: 60 }),
    calendar ? getEventsInMonth(now.getFullYear(), now.getMonth()) : Promise.resolve([] as EventListItem[]),
    getEventCategories(),
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

      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-14">
        {calendar ? (
          <EventsBrowser
            mode="calendar"
            monthEvents={category ? monthEvents.filter((e) => e.category === category) : monthEvents}
            initialYear={now.getFullYear()}
            initialMonth={now.getMonth()}
          />
        ) : (
          <>
            {showHighlights && featured.length > 0 && <FeaturedStrip events={featured} />}
            {showHighlights && onSale.length > 0 && <OnSaleStrip events={onSale} />}

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
                  <h2 className="font-display text-2xl font-bold">Upcoming</h2>
                  <p className="text-sm text-ink-muted">
                    {visible.length}
                    {hasMore ? "+" : ""} event{visible.length === 1 ? "" : "s"}
                  </p>
                </div>
                <EventsBrowser
                  mode="list"
                  initial={visible}
                  category={category}
                  range={range}
                  freeOnly={freeOnly}
                  pageSize={PAGE_SIZE}
                  initialHasMore={hasMore}
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
