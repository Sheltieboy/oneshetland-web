import Link from "next/link";
import { getVisitingData } from "@/lib/visiting-data";
import { getUpcomingEvents } from "@/lib/events-data";
import { offerBadge } from "@/lib/local-data";
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
 * an empty page doesn't come back, and every section hides itself when empty.
 *
 * Each block borrows its section's colour from the rest of the site (events
 * amber, local violet, cruise indigo, spik teal) so the page reads as a tour
 * of OneShetland rather than one long purple list.
 */

export const dynamic = "force-dynamic";

const LOCAL = "#7c3aed";
const EVENTS = "#d4921a";
const CRUISE = "#4f46e5";
const SPIK = "#12b3d6";
const OFFERS = "#d97706";

export const metadata = {
  title: "Visiting Shetland — what's on, where to eat, what to bring home",
  description:
    "Planning a trip to Shetland, or ashore for the day? What's on this week, places to eat and stay, Shetland makers to buy from, live offers, cruise ship days, and a few words of the dialect.",
  openGraph: {
    title: "Visiting Shetland",
    description:
      "What's on this week, places to eat and stay, Shetland makers to buy from, and a few words of the dialect.",
  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Shared section heading — eyebrow in the section's colour, optional link. */
function Heading({
  eyebrow, title, blurb, href, cta, color,
}: {
  eyebrow: string; title: string; blurb?: string; href?: string; cta?: string; color: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{eyebrow}</p>
        <h2 className="mt-0.5 font-display text-3xl font-bold">{title}</h2>
        {blurb && <p className="mt-1 text-ink-muted">{blurb}</p>}
      </div>
      {href && cta && (
        <Link
          href={href}
          className="shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition hover:bg-sand"
          style={{ borderColor: color + "66", color }}
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

/** A tinted placeholder, so a card with no photo still carries its colour. */
function Tint({ color, label }: { color: string; label?: string }) {
  return (
    <span
      className="flex h-full w-full items-center justify-center text-2xl"
      style={{ background: `linear-gradient(135deg, ${color}26, ${color}0d)` }}
      aria-hidden
    >
      {label}
    </span>
  );
}

export default async function VisitingPage() {
  const [{ places, makes, cruiseDays, words, offers }, events] = await Promise.all([
    getVisitingData(),
    getUpcomingEvents({ limit: 8 }).catch(() => []),
  ]);

  return (
    <>
      <section className="relative isolate overflow-hidden text-paper" style={{ background: LOCAL }}>
        {/* A real Shetland photo behind the hero — the page is selling the place. */}
        <SafeImage
          src="/heroes/local.jpeg"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          fallback={<span />}
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${LOCAL}e6 25%, ${LOCAL}a6)` }} />
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
          <Heading eyebrow="While you're here" title="What's on" href="/whats-on" cta="All events →" color={EVENTS} />
          {events.length === 0 ? (
            <p className="text-ink-muted">Nothing listed just now — try the full What&apos;s On calendar.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {events.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <Link href={`/whats-on/${e.id}`} className="group block overflow-hidden rounded-card border border-line bg-paper shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      {e.cover_url ? (
                        <SafeImage
                          src={e.cover_url}
                          alt={e.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          fallback={<Tint color={EVENTS} label="🎪" />}
                        />
                      ) : (
                        <Tint color={EVENTS} label="🎪" />
                      )}
                      <span
                        className="absolute left-3 top-3 rounded-pill px-2.5 py-1 text-[11px] font-bold text-white shadow-soft"
                        style={{ background: EVENTS }}
                      >
                        {fmtDate(e.starts_at)}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="font-display font-bold leading-snug text-ink group-hover:underline">{e.title}</p>
                      {e.venue && <p className="mt-1 text-sm text-ink-muted">{e.venue}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Offers — a visitor can use a two-for-one the same as anyone. */}
        {offers.length > 0 && (
          <section>
            <Heading
              eyebrow="While you're in the shop"
              title="Offers on just now"
              blurb="Show your member card or just mention it at the till."
              href="/local#offers"
              cta="All offers →"
              color={OFFERS}
            />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/directory/${o.business?.slug ?? o.business_id}`}
                    className="group flex h-full overflow-hidden rounded-card border border-line bg-paper shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <div className="relative w-28 shrink-0 overflow-hidden">
                      {o.image_url ? (
                        <SafeImage src={o.image_url} alt="" className="h-full w-full object-cover" fallback={<Tint color={OFFERS} label="🏷" />} />
                      ) : (
                        <Tint color={OFFERS} label="🏷" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 p-4">
                      <span className="inline-block rounded-pill px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: OFFERS }}>
                        {offerBadge(o)}
                      </span>
                      <p className="mt-2 font-display font-bold leading-snug text-ink group-hover:underline">{o.title}</p>
                      {o.business?.name && <p className="mt-0.5 text-sm text-ink-muted">{o.business.name}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Places — tourism, food, retail, stays. Paid tiers first. */}
        {places.length > 0 && (
          <section>
            <Heading eyebrow="Where to go" title="Eat, stay and explore" href="/directory" cta="Full directory →" color={LOCAL} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {places.map((b) => (
                <li key={b.id}>
                  <Link href={`/directory/${b.slug ?? b.id}`} className="group block h-full overflow-hidden rounded-card border border-line bg-paper shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                    <div className="relative aspect-[16/9] overflow-hidden">
                      {b.cover_url ? (
                        <SafeImage src={b.cover_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" fallback={<Tint color={LOCAL} label="📍" />} />
                      ) : (
                        <Tint color={LOCAL} label="📍" />
                      )}
                      {b.logo_url && (
                        <span className="absolute -bottom-5 left-4 h-12 w-12 overflow-hidden rounded-xl border-2 border-paper bg-paper shadow-soft">
                          <SafeImage src={b.logo_url} alt="" className="h-full w-full object-cover" fallback={<span />} />
                        </span>
                      )}
                    </div>
                    <div className="p-4 pt-7">
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
            <Heading
              eyebrow="Made here"
              title="Something to take home"
              blurb="Bought direct from the maker — or posted on if you'd rather travel light."
              href="/shop"
              cta="Shop all →"
              color={LOCAL}
            />
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
              {makes.map((p) => (
                <li key={p.id}>
                  <Link href={`/product/${p.id}`} className="group block">
                    <div className="aspect-square overflow-hidden rounded-card border border-line bg-sand">
                      {p.photo ? (
                        <SafeImage src={p.photo} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" fallback={<Tint color={LOCAL} label="🧶" />} />
                      ) : (
                        <Tint color={LOCAL} label="🧶" />
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-ink group-hover:underline">{p.title}</p>
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
            <Heading
              eyebrow="Good to know"
              title="Cruise ship days"
              blurb="When the big ships are in, Lerwick is busy. Handy either way."
              href="/cruise"
              cta="Full schedule →"
              color={CRUISE}
            />
            <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {cruiseDays.map((d) => (
                <li key={d.visit_date}>
                  <Link href={`/cruise/${d.visit_date}`} className="group block overflow-hidden rounded-card border border-line bg-paper shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {d.lead_image ? (
                        <SafeImage src={d.lead_image} alt={d.lead_ship ?? ""} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" fallback={<Tint color={CRUISE} label="🚢" />} />
                      ) : (
                        <Tint color={CRUISE} label="🚢" />
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                        <span className="text-[11px] font-bold text-white">{fmtDate(d.visit_date)}</span>
                      </span>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-xs font-bold text-ink">
                        {d.ships_count} ship{d.ships_count === 1 ? "" : "s"}
                      </p>
                      {d.total_est_pax > 0 && (
                        <p className="text-xs text-ink-faint">~{d.total_est_pax.toLocaleString("en-GB")} ashore</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* A bit of dialect — the thing visitors remember. */}
        {words.length > 0 && (
          <section>
            <Heading eyebrow="The wirds" title="A bit of Shetland dialect" href="/spik" cta="The dictionary →" color={SPIK} />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {words.map((w) => (
                <li
                  key={w.word}
                  className="rounded-card border p-4 shadow-soft"
                  style={{ borderColor: SPIK + "40", background: `linear-gradient(135deg, ${SPIK}14, transparent)` }}
                >
                  <p className="font-display text-lg font-bold" style={{ color: SPIK }}>{w.word}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{w.short_meaning}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Deliberately NOT an app-store link — the app isn't published yet,
            and a dead "Get the app" button on the page visitors land on first
            is worse than no button. Swap this for the store links at launch. */}
        <section
          className="rounded-2xl border px-6 py-10 text-center shadow-soft"
          style={{ borderColor: LOCAL + "33", background: `linear-gradient(135deg, ${LOCAL}12, transparent 60%)` }}
        >
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
