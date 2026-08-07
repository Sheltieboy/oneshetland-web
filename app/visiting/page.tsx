import Link from "next/link";
import { getVisitingData } from "@/lib/visiting-data";
import { getUpcomingEvents } from "@/lib/events-data";
import { SafeImage } from "@/components/ui/SafeImage";
import { gbp } from "@/lib/shop-data";

/**
 * /visiting — for someone planning a trip, or already off the ship.
 *
 * This exists mostly for people who have never heard of OneShetland: they
 * google "things to do in Shetland" and land here. That makes it the one page
 * where the search description and a real server-rendered list of what's
 * actually on matter more than any in-app polish.
 *
 * Everything here is real data. No "coming soon" panels — a visitor who finds
 * an empty page doesn't come back.
 */

export const dynamic = "force-dynamic";

const LOCAL = "#7c3aed";

export const metadata = {
  title: "Visiting Shetland — what's on, where to eat, what to bring home",
  description:
    "Planning a trip to Shetland, or ashore for the day? What's on this week, places to eat and stay, Shetland makers to buy from, cruise ship days, and a few words of the dialect.",
  openGraph: {
    title: "Visiting Shetland",
    description:
      "What's on this week, places to eat and stay, Shetland makers to buy from, and a few words of the dialect.",
  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default async function VisitingPage() {
  const [{ places, makes, cruiseDays, words }, events] = await Promise.all([
    getVisitingData(),
    getUpcomingEvents({ limit: 8 }).catch(() => []),
  ]);

  return (
    <>
      <section className="relative isolate overflow-hidden text-paper" style={{ background: LOCAL }}>
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-widest text-paper/80">OneShetland</p>
          <h1 className="mt-2 font-display text-5xl font-bold sm:text-6xl">Visiting Shetland</h1>
          <p className="mt-4 max-w-2xl text-lg text-paper/90">
            Here for a few days, or ashore for one? This is what&apos;s actually happening while you&apos;re here —
            kept up to date by the folk who live here, not a guidebook written three years ago.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-16 px-5 py-12">
        {/* What's on — the single most useful thing for someone here now. */}
        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">While you&apos;re here</p>
              <h2 className="mt-0.5 font-display text-3xl font-bold">What&apos;s on</h2>
            </div>
            <Link href="/whats-on" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
              All events →
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="text-ink-muted">Nothing listed just now — try the full What&apos;s On calendar.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {events.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <Link href={`/whats-on/${e.id}`} className="group block rounded-card border border-line bg-paper p-4 shadow-soft transition hover:shadow-lift">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: LOCAL }}>{fmtDate(e.starts_at)}</p>
                    <p className="mt-1 font-display font-bold leading-snug text-ink group-hover:underline">{e.title}</p>
                    {e.venue && <p className="mt-1 text-sm text-ink-muted">{e.venue}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Places — tourism, food, retail, places to stay. Paid tiers first. */}
        {places.length > 0 && (
          <section>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Where to go</p>
              <h2 className="mt-0.5 font-display text-3xl font-bold">Eat, stay and explore</h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {places.map((b) => (
                <li key={b.id}>
                  <Link href={`/directory/${b.slug ?? b.id}`} className="group flex h-full gap-3 rounded-card border border-line bg-paper p-4 shadow-soft transition hover:shadow-lift">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-sand">
                      {b.logo_url ? (
                        <SafeImage src={b.logo_url} className="h-full w-full object-cover" fallback={<span />} />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-bold leading-snug text-ink group-hover:underline">{b.name}</p>
                      {b.description && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{b.description}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Take something home — straight into the commerce engine. */}
        {makes.length > 0 && (
          <section>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Made here</p>
                <h2 className="mt-0.5 font-display text-3xl font-bold">Something to take home</h2>
                <p className="mt-1 text-ink-muted">Bought direct from the maker — or posted on if you&apos;d rather travel light.</p>
              </div>
              <Link href="/shop" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
                Shop all →
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
              {makes.map((p) => (
                <li key={p.id}>
                  <Link href={`/product/${p.id}`} className="group block">
                    <div className="aspect-square overflow-hidden rounded-card bg-sand">
                      {p.photo ? (
                        <SafeImage src={p.photo} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" fallback={<span />} />
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-ink">{p.title}</p>
                    <p className="text-xs text-ink-muted">{p.business_name}</p>
                    <p className="text-sm font-bold" style={{ color: LOCAL }}>{gbp(p.price_pence)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Cruise days — useful to ship passengers AND to anyone who'd rather
            not hit Commercial Street on a 4,000-passenger day. */}
        {cruiseDays.length > 0 && (
          <section>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Good to know</p>
                <h2 className="mt-0.5 font-display text-3xl font-bold">Cruise ship days</h2>
                <p className="mt-1 text-ink-muted">When the big ships are in, Lerwick is busy. Handy either way.</p>
              </div>
              <Link href="/cruise" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
                Full schedule →
              </Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {cruiseDays.map((d) => (
                <li key={d.visit_date} className="rounded-card border border-line bg-paper p-4 text-center shadow-soft">
                  <p className="text-sm font-bold text-ink">{fmtDate(d.visit_date)}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {d.ships_count} ship{d.ships_count === 1 ? "" : "s"}
                  </p>
                  {d.total_est_pax > 0 && (
                    <p className="text-xs text-ink-faint">~{d.total_est_pax.toLocaleString("en-GB")} ashore</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* A bit of dialect — the thing visitors remember. */}
        {words.length > 0 && (
          <section>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">The wirds</p>
                <h2 className="mt-0.5 font-display text-3xl font-bold">A bit of Shetland dialect</h2>
              </div>
              <Link href="/spik" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
                The dictionary →
              </Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {words.map((w) => (
                <li key={w.word} className="rounded-card border border-line bg-paper p-4 shadow-soft">
                  <p className="font-display text-lg font-bold text-ink">{w.word}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{w.short_meaning}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Deliberately NOT an app-store link — the app isn't published yet,
            and a dead "Get the app" button on the page visitors land on first
            is worse than no button. Swap this for the store links at launch. */}
        <section className="rounded-2xl border border-line bg-paper px-6 py-10 text-center shadow-soft">
          <p className="font-display text-2xl font-bold text-ink">There&apos;s a lot more of it</p>
          <p className="mx-auto mt-2 max-w-lg text-ink-soft">
            Tides, daylight and the weather where you are, the full events calendar, every shop on the islands,
            and 2,800 words of dialect.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/whats-on" className="rounded-pill px-6 py-3 font-semibold text-white shadow-soft" style={{ background: LOCAL }}>
              What&apos;s on
            </Link>
            <Link href="/directory" className="rounded-pill border border-line-strong px-6 py-3 font-semibold text-ink transition hover:bg-sand">
              Browse the directory
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
