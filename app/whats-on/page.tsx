import Image from "next/image";
import Link from "next/link";
import { getUpcomingEvents, getEventCategories } from "@/lib/events-data";
import { CategoryChips, FeaturedEvent, EventListings } from "@/components/events/EventsListing";

export const dynamic = "force-dynamic";
export const metadata = { title: "What's On" };

const EVENTS = "#d4921a";

export default async function WhatsOnPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [events, categories] = await Promise.all([
    getUpcomingEvents({ category }),
    getEventCategories(),
  ]);
  const featured = events.find((e) => e.is_featured) ?? events[0];
  const rest = featured ? events.filter((e) => e.id !== featured.id) : events;

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

      {/* Sticky category filter */}
      <div className="sticky top-16 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryChips categories={categories} active={category} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-14">
        {events.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper p-12 text-center shadow-soft">
            <h2 className="font-display text-2xl font-bold">Nothing listed{category ? ` in ${category}` : ""} just now</h2>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">
              Check back soon — new events are added all the time. Organising something?
              It&apos;ll appear here automatically once it&apos;s published in the app.
            </p>
            {category && (
              <Link href="/whats-on" className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper" style={{ background: EVENTS }}>
                See all events
              </Link>
            )}
          </div>
        ) : (
          <>
            {featured && (
              <div className="mb-14">
                <FeaturedEvent e={featured} />
              </div>
            )}
            {rest.length > 0 && (
              <>
                <div className="mb-8 flex items-baseline justify-between">
                  <h2 className="font-display text-2xl font-bold">Upcoming</h2>
                  <p className="text-sm text-ink-muted">
                    {rest.length} event{rest.length === 1 ? "" : "s"}
                  </p>
                </div>
                <EventListings events={rest} />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
