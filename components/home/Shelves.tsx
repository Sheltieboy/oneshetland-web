import Link from "next/link";
import { tierUnlocks } from "@/lib/listing-tiers";
import { SafeImage } from "@/components/ui/SafeImage";
import type { HomeOffer, HomeSpik } from "@/lib/home-data";
import { offerBadge } from "@/lib/home-data";
import type { HomeShelves, ShelfBusiness } from "@/lib/home-shelves";

/**
 * The homepage shelf bands — the paid-placement ladder plus the island-life
 * photo band. Each shelf self-hides when it has nothing real to show.
 *
 *   FeaturedShelf  — premium businesses, 1 big + 2 stacked (asymmetric bento)
 *   OffersShelf    — live offers with photos (pro+), ends on a pitch card
 *   ShopRails      — eat & drink / shops & services, paid tiers sort first
 *   IslandLifeBand — Da Boats photo · Aald Memory · Spik wird, in section colours
 *   HiringShelf    — newest jobs with employer logos
 */

const LOCAL = "#7c3aed";
const OFFERS = "#2a8b5c";
const DIRECTORY = "#4f46e5";
const BOATS = "#1e3a8a";
const MEMORIES = "#9f1239";
const WORK = "#2a8b5c";

const TSHADOW = "[text-shadow:_0_1px_8px_rgb(0_0_0_/_50%)]";

function ShelfHeader({ eyebrow, title, href, cta, accent }: { eyebrow: string; title: string; href: string; cta: string; accent: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow" style={{ color: accent }}>{eyebrow}</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
      </div>
      <Link href={href} className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-soft transition hover:bg-sand">
        {cta} →
      </Link>
    </div>
  );
}

const bizHref = (b: ShelfBusiness) => `/directory/${b.slug || b.id}`;
/**
 * "★ Featured" is sold as a Premium benefit, so only Premium may wear it.
 * This previously returned true for Pro as well, which gave every Pro business
 * a badge the plans page charges £29 for. Appearing in the shelf at all is a
 * separate thing — paid businesses are still surfaced first by home-data.
 */
const isFeatured = (b: ShelfBusiness) => tierUnlocks(b.subscription_tier, "featuredBadge");

function BizInitial({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`grid h-full w-full place-items-center font-display text-lg font-bold text-ink-soft ${className}`}>{name.slice(0, 1)}</span>;
}

/* ── Featured this week — the premium shelf ──────────────────────────────── */

function FeaturedCard({ b, big = false }: { b: ShelfBusiness; big?: boolean }) {
  return (
    <Link
      href={bizHref(b)}
      className={`group relative flex overflow-hidden rounded-2xl border border-line shadow-soft transition hover:shadow-lift ${big ? "min-h-[420px]" : "min-h-[200px]"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <SafeImage
        src={b.cover_url || b.logo_url || "/heroes/local.jpeg"}
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        fallback={<img src="/heroes/local.jpeg" alt="" className="absolute inset-0 h-full w-full object-cover" />}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/5" />
      <span
        className="absolute left-4 top-4 rounded-pill px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
        style={{ background: isFeatured(b) ? LOCAL : "rgba(20,34,44,0.65)" }}
      >
        {isFeatured(b) ? "★ Featured" : "New on OneShetland"}
      </span>
      <div className="relative mt-auto flex w-full items-end gap-3 p-5 text-paper">
        {b.logo_url && (
          <span className={`shrink-0 overflow-hidden rounded-xl border border-white/40 bg-white ${big ? "h-14 w-14" : "h-11 w-11"}`}>
            <SafeImage src={b.logo_url} className="h-full w-full object-contain" fallback={<BizInitial name={b.name} />} />
          </span>
        )}
        <span className="min-w-0">
          <span className={`block truncate font-display font-bold leading-tight ${TSHADOW} ${big ? "text-3xl" : "text-xl"}`}>{b.name}</span>
          {b.category && <span className={`block truncate text-sm capitalize text-white/90 ${TSHADOW}`}>{b.category.replace(/_/g, " ")}</span>}
          {big && b.description && <span className={`mt-1 line-clamp-2 block max-w-lg text-sm text-white/85 ${TSHADOW}`}>{b.description}</span>}
        </span>
      </div>
    </Link>
  );
}

export function FeaturedShelf({ shelves }: { shelves: HomeShelves }) {
  const [first, ...rest] = shelves.featured;
  if (!first) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-12">
      <ShelfHeader
        eyebrow="Shetland spotlight"
        title="Featured this week"
        href={shelves.anyPaid ? "/directory" : "/business"}
        cta={shelves.anyPaid ? "All businesses" : "Get featured"}
        accent={LOCAL}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <FeaturedCard b={first} big />
        <div className="grid gap-4">
          {rest.map((b) => <FeaturedCard key={b.id} b={b} />)}
        </div>
      </div>
    </section>
  );
}

/* ── Offers & rewards ────────────────────────────────────────────────────── */

export function OffersShelf({ offers }: { offers: HomeOffer[] }) {
  if (offers.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-12">
      <ShelfHeader eyebrow="Save local" title="Offers &amp; rewards" href="/local" cta="All offers" accent={OFFERS} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offers.slice(0, 5).map((o) => (
          <Link
            key={o.id}
            href={o.business ? `/directory/${o.business.id}` : "/local"}
            className="group overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition hover:shadow-lift"
          >
            <div className="relative h-36 overflow-hidden" style={{ background: `color-mix(in srgb, ${OFFERS} 10%, white)` }}>
              {o.image_url ? (
                <SafeImage src={o.image_url} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" fallback={<span />} />
              ) : o.business?.logo_url ? (
                <SafeImage src={o.business.logo_url} className="mx-auto h-full object-contain p-6" fallback={<span />} />
              ) : null}
              <span className="absolute left-3 top-3 rounded-pill px-2.5 py-1 text-xs font-bold text-white" style={{ background: OFFERS }}>
                {offerBadge(o)}
              </span>
            </div>
            <div className="p-4">
              <p className="line-clamp-1 font-semibold text-ink">{o.title}</p>
              {o.business?.name && <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">{o.business.name}</p>}
              <p className="mt-1 text-xs text-ink-faint">
                until {new Date(o.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
            </div>
          </Link>
        ))}
        {/* The pitch card — every scroller sees where these slots come from. */}
        <Link
          href="/business"
          className="flex flex-col items-start justify-center rounded-2xl border-2 border-dashed p-5 transition hover:bg-sand"
          style={{ borderColor: `color-mix(in srgb, ${OFFERS} 40%, transparent)` }}
        >
          <p className="font-display text-lg font-bold text-ink">Your offer here</p>
          <p className="mt-1 text-sm text-ink-soft">Put your business in front of all of Shetland — offers, loyalty stamps and more.</p>
          <span className="mt-3 rounded-pill px-4 py-1.5 text-sm font-bold text-white" style={{ background: OFFERS }}>For businesses →</span>
        </Link>
      </div>
    </section>
  );
}

/* ── Eat, drink & shop rails ─────────────────────────────────────────────── */

function Rail({ title, href, items }: { title: string; href: string; items: ShelfBusiness[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        <Link href={href} className="text-sm font-bold hover:underline" style={{ color: DIRECTORY }}>See all →</Link>
      </div>
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
        {items.map((b) => (
          <Link key={b.id} href={bizHref(b)} className="group w-40 shrink-0 snap-start">
            <div className="relative h-28 overflow-hidden rounded-xl border border-line bg-white">
              {b.cover_url ? (
                <SafeImage src={b.cover_url} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" fallback={<BizInitial name={b.name} />} />
              ) : b.logo_url ? (
                <SafeImage src={b.logo_url} className="h-full w-full object-contain p-4" fallback={<BizInitial name={b.name} />} />
              ) : (
                <BizInitial name={b.name} />
              )}
              {isFeatured(b) && (
                <span className="absolute left-2 top-2 rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: DIRECTORY }}>★</span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-ink">{b.name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ProductRail({ items }: { items: HomeShelves["freshProducts"] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-lg font-bold text-ink">Fresh in the shops</h3>
      </div>
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
        {items.map((p) => (
          <Link key={p.id} href={`/product/${p.id}`} className="group w-40 shrink-0 snap-start">
            <div className="relative h-40 overflow-hidden rounded-xl border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <SafeImage src={p.photo ?? ""} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" fallback={<span className="grid h-full w-full place-items-center text-2xl">🛍️</span>} />
              <span className="absolute bottom-2 left-2 rounded-pill bg-white/95 px-2 py-0.5 text-xs font-bold text-ink">£{(p.price_pence / 100).toFixed(2)}</span>
            </div>
            <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-ink">{p.title}</p>
            <p className="line-clamp-1 text-xs text-ink-muted">{p.business_name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ShopRails({ shelves }: { shelves: HomeShelves }) {
  if (shelves.eatDrink.length === 0 && shelves.shops.length === 0 && shelves.freshProducts.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-12">
      <ShelfHeader eyebrow="The Directory" title="Eat, drink &amp; shop Shetland" href="/directory" cta="Full directory" accent={DIRECTORY} />
      <div className="space-y-7">
        <ProductRail items={shelves.freshProducts} />
        <Rail title="Eat &amp; drink" href="/directory?category=food_drink" items={shelves.eatDrink} />
        <Rail title="Shops &amp; services" href="/directory?category=retail" items={shelves.shops} />
      </div>
    </section>
  );
}

/* ── Island life — Da Boats · Aald Memories · Spik ────────────────────────── */

export function IslandLifeBand({ shelves, spik }: { shelves: HomeShelves; spik: HomeSpik }) {
  const { boat, story } = shelves;
  if (!boat && !story && !spik) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-12">
      <div className="mb-5">
        <p className="eyebrow text-ink-muted">Island life</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">Fae da isles</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boat && (
          <Link href={`/boats/${boat.vessel_id}`} className="group relative flex min-h-[240px] overflow-hidden rounded-2xl border border-line shadow-soft transition hover:shadow-lift">
            <SafeImage src={boat.image_url} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" fallback={<span className="absolute inset-0" style={{ background: BOATS }} />} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <span className="absolute left-4 top-4 rounded-pill px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: BOATS }}>Da Boats</span>
            <div className="relative mt-auto p-5 text-paper">
              <p className={`font-display text-2xl font-bold ${TSHADOW}`}>{boat.name}</p>
              {boat.built_year && <p className={`text-sm text-white/85 ${TSHADOW}`}>built {boat.built_year}</p>}
            </div>
          </Link>
        )}
        {story && (
          <Link href="/memories" className="group relative flex min-h-[240px] overflow-hidden rounded-2xl border border-line shadow-soft transition hover:shadow-lift">
            <SafeImage src={story.hero_url} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" fallback={<span className="absolute inset-0" style={{ background: MEMORIES }} />} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <span className="absolute left-4 top-4 rounded-pill px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: MEMORIES }}>Aald Memories</span>
            <div className="relative mt-auto p-5 text-paper">
              <p className={`line-clamp-2 font-display text-2xl font-bold ${TSHADOW}`}>{story.title || "A story fae da isles"}</p>
              <p className={`text-sm text-white/85 ${TSHADOW}`}>{[story.place_name, story.era].filter(Boolean).join(" · ")}</p>
            </div>
          </Link>
        )}
        {spik && (
          <Link href="/spik" className="group flex min-h-[240px] flex-col justify-between rounded-2xl p-5 text-white shadow-soft transition hover:shadow-lift" style={{ background: "#0e9ab8" }}>
            <span className="self-start rounded-pill bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">Spik · Wird o&apos; da day</span>
            <div>
              <p className="font-display text-4xl font-bold leading-none">{spik.word}</p>
              <p className="mt-2 line-clamp-2 text-white/90">{spik.meaning}</p>
              {spik.example && <p className="mt-2 line-clamp-2 border-l-2 border-white/40 pl-2 text-sm italic text-white/80">&ldquo;{spik.example}&rdquo;</p>}
            </div>
            <span className="text-sm font-bold">Explore the dialect →</span>
          </Link>
        )}
      </div>
    </section>
  );
}

/* ── Hiring now ──────────────────────────────────────────────────────────── */

export function HiringShelf({ shelves }: { shelves: HomeShelves }) {
  if (shelves.hiring.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-12">
      <ShelfHeader eyebrow="Work" title="Hiring now" href="/jobs" cta="All jobs &amp; shifts" accent={WORK} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shelves.hiring.map((j) => (
          <Link key={j.id} href={`/jobs/${j.id}`} className="group rounded-2xl border border-line bg-white p-4 shadow-soft transition hover:shadow-lift">
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-line bg-cream">
                {j.logo_url ? (
                  <SafeImage src={j.logo_url} className="h-full w-full object-contain p-1" fallback={<BizInitial name={j.employer || j.title} />} />
                ) : (
                  <BizInitial name={j.employer || j.title} />
                )}
              </span>
              {j.contract_type && (
                <span className="ml-auto rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: WORK }}>
                  {j.contract_type.replace(/-/g, " ")}
                </span>
              )}
            </div>
            <p className="mt-3 line-clamp-2 font-semibold leading-snug text-ink">{j.title}</p>
            <p className="mt-1 line-clamp-1 text-sm text-ink-muted">{[j.employer, j.where].filter(Boolean).join(" · ")}</p>
            {j.pay_text && <p className="mt-1 text-sm font-bold" style={{ color: WORK }}>{j.pay_text}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}
