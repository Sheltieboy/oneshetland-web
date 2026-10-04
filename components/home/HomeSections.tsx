import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { CruiseTodayCard } from "@/components/cruise/CruiseTodayCard";
import { offerBadge, formatEventDate, formatEventTime, type HomeEvent, type HomeOffer, type HomeNotice, type HomeCampaign } from "@/lib/home-data";
import type { HomeShelves, ShelfProduct } from "@/lib/home-shelves";
import type { CuratedBusiness } from "@/lib/curated-businesses";
import { CATEGORY_LABEL } from "@/lib/local-data";
import { SECTIONS } from "@/lib/sections";
import { tierUnlocks } from "@/lib/listing-tiers";
import type { GamePrompt } from "@/lib/home-extras";
import { IslandCards } from "@/components/home/Shelves";

/**
 * The Home page's curated modules. Home answers "what matters across Shetland right now" — it curates, it does
 * not catalogue. Every module here hides itself when it has nothing genuine to say, so the page is never padded
 * with promises it cannot keep.
 *
 *   HeroActions        What's On · Find a business · search
 *   WhatsHappening     one events module (+ ship content only when a ship is actually about)
 *   FindLocal          a short shelf of genuine businesses
 *   LocalCommerce      offers and products — only when real ones exist
 *   IslandAndCommunity culture + community in one module
 *   ExploreMore        a compact strip replacing the thirteen full-size section tiles
 */

const EVENTS = "#d4921a";
const DIRECTORY = "#4f46e5";
const COMMERCE = "#2a8b5c";

function Header({ eyebrow, title, href, cta, accent }: { eyebrow: string; title: string; href?: string; cta?: string; accent: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow" style={{ color: accent }}>{eyebrow}</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
      </div>
      {href && cta && (
        <Link href={href} className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-soft transition hover:bg-sand">
          {cta} →
        </Link>
      )}
    </div>
  );
}

const initial = (name: string) => name.trim().slice(0, 1).toUpperCase();

/* ── Hero actions ─────────────────────────────────────────────────────────── */

export function HeroActions() {
  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap gap-2.5">
        <Link href="/whats-on" className="rounded-pill bg-paper px-5 py-2.5 text-sm font-bold text-navy shadow-soft transition hover:bg-white">
          What&apos;s On
        </Link>
        <Link href="/directory" className="rounded-pill border border-paper/60 bg-paper/10 px-5 py-2.5 text-sm font-bold text-paper backdrop-blur-sm transition hover:bg-paper/20">
          Find a business
        </Link>
      </div>
      {/* The Directory's own search: a plain GET to /directory?q=…, nothing new behind it. */}
      <form action="/directory" method="get" role="search" className="flex max-w-md overflow-hidden rounded-pill bg-paper shadow-soft">
        <label htmlFor="home-search" className="sr-only">Search Shetland businesses</label>
        <input
          id="home-search"
          name="q"
          type="search"
          placeholder="Search businesses…"
          className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button type="submit" className="px-4 text-sm font-bold text-navy hover:bg-sand">Search</button>
      </form>
    </div>
  );
}

/* ── What's happening ─────────────────────────────────────────────────────── */

export function WhatsHappening({ events, showCruise }: { events: HomeEvent[]; showCruise: boolean }) {
  const [featured, ...rest] = events;
  if (!featured && !showCruise) return null;
  const next = rest.slice(0, 3);
  return (
    <section className="mx-auto max-w-6xl px-5 pt-10">
      <Header eyebrow="What's On" title="What's happening" href="/whats-on" cta="Full calendar" accent={EVENTS} />
      {featured && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Link
            href={`/whats-on/${featured.id}`}
            className="group relative flex min-h-[260px] overflow-hidden rounded-2xl border border-line shadow-soft transition hover:shadow-lift lg:col-span-3 lg:min-h-[300px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <SafeImage src={featured.cover_url || "/heroes/events.jpg"} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" fallback={<img src="/heroes/events.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="relative mt-auto p-5 text-paper">
              <span className="inline-block rounded-pill bg-paper/95 px-3 py-1 text-xs font-bold" style={{ color: EVENTS }}>{formatEventDate(featured.starts_at)}</span>
              <h3 className="mt-2 font-display text-2xl font-bold leading-tight [text-shadow:_0_1px_8px_rgb(0_0_0_/_60%)]">{featured.title}</h3>
              <p className="mt-1 text-sm text-white/90">{formatEventTime(featured.starts_at)}{featured.venue ? ` · ${featured.venue}` : ""}</p>
            </div>
          </Link>
          {next.length > 0 && (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-white shadow-soft lg:col-span-2">
              {next.map((e) => (
                <li key={e.id}>
                  <Link href={`/whats-on/${e.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-sand">
                    <span className="w-16 shrink-0 text-center">
                      <span className="block text-[11px] font-bold uppercase leading-none" style={{ color: EVENTS }}>{new Date(e.starts_at).toLocaleDateString("en-GB", { month: "short" })}</span>
                      <span className="block font-display text-2xl font-bold leading-tight text-ink">{new Date(e.starts_at).getDate()}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{e.title}</span>
                      <span className="block truncate text-sm text-ink-muted">{formatEventTime(e.starts_at)}{e.venue ? ` · ${e.venue}` : ""}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {showCruise && <div className="mt-4"><CruiseTodayCard /></div>}
    </section>
  );
}

/* ── Find local ───────────────────────────────────────────────────────────── */

export function FindLocal({ businesses, eyebrow = "Directory", title = "Find a local business" }: { businesses: CuratedBusiness[]; eyebrow?: string; title?: string }) {
  if (businesses.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-12">
      <Header eyebrow={eyebrow} title={title} href="/directory" cta="Directory" accent={DIRECTORY} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {businesses.slice(0, 8).map((b) => (
          <Link key={b.id} href={`/directory/${b.slug || b.id}`} className="group overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition hover:shadow-lift">
            <div className="relative h-24 overflow-hidden bg-cream sm:h-28">
              {b.cover_url ? (
                <SafeImage src={b.cover_url} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" fallback={<Tile name={b.name} />} />
              ) : b.logo_url ? (
                <SafeImage src={b.logo_url} className="h-full w-full object-contain p-4" fallback={<Tile name={b.name} />} />
              ) : (
                <Tile name={b.name} />
              )}
              {tierUnlocks(b.subscription_tier, "featuredBadge") && (
                <span className="absolute left-2 top-2 rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: DIRECTORY }}>★ Featured</span>
              )}
            </div>
            <div className="p-3">
              <p className="line-clamp-1 font-semibold text-ink">{b.name}</p>
              <p className="line-clamp-1 text-xs text-ink-muted">{CATEGORY_LABEL[b.category ?? ""] ?? "Business"}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Tile({ name }: { name: string }) {
  return (
    <span className="grid h-full w-full place-items-center font-display text-3xl font-bold text-white" style={{ background: `linear-gradient(135deg, ${DIRECTORY}, #7c3aed)` }}>
      {initial(name)}
    </span>
  );
}

/* ── Local commerce — only when there is something genuine ─────────────────── */

export function LocalCommerce({ offers, products }: { offers: HomeOffer[]; products: ShelfProduct[] }) {
  if (offers.length === 0 && products.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-12">
      <Header
        eyebrow={offers.length ? "Shop & save" : "Shop"}
        title="From Shetland's shops"
        href={products.length ? "/shop" : "/local"}
        cta={products.length ? "Shop" : "Offers"}
        accent={COMMERCE}
      />
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
        {offers.slice(0, 3).map((o) => (
          <Link key={o.id} href={o.business ? `/directory/${o.business.id}` : "/local"} className="group w-56 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition hover:shadow-lift">
            <div className="grid h-24 place-items-center" style={{ background: `color-mix(in srgb, ${COMMERCE} 12%, white)` }}>
              <span className="rounded-pill px-3 py-1 text-sm font-bold text-white" style={{ background: COMMERCE }}>{offerBadge(o)}</span>
            </div>
            <div className="p-3">
              <p className="line-clamp-1 font-semibold text-ink">{o.title}</p>
              {o.business?.name && <p className="line-clamp-1 text-sm text-ink-muted">{o.business.name}</p>}
            </div>
          </Link>
        ))}
        {products.slice(0, 6).map((p) => (
          <Link key={p.id} href={`/product/${p.id}`} className="group w-40 shrink-0 snap-start">
            <div className="relative h-40 overflow-hidden rounded-xl border border-line bg-white">
              <SafeImage src={p.photo ?? ""} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" fallback={<span className="grid h-full w-full place-items-center text-2xl">🛍️</span>} />
              <span className="absolute bottom-2 left-2 rounded-pill bg-white/95 px-2 py-0.5 text-xs font-bold text-ink">£{(p.price_pence / 100).toFixed(2)}</span>
            </div>
            <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-ink">{p.title}</p>
            <p className="line-clamp-1 text-xs text-ink-muted">{p.business_name}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Island life & community ──────────────────────────────────────────────── */

export function IslandAndCommunity({
  shelves, game, notices, campaigns,
}: {
  shelves: HomeShelves; game: GamePrompt; notices: HomeNotice[]; campaigns: HomeCampaign[];
}) {
  const campaignTitles = campaigns.map((c) => c.title.toLowerCase());
  const visibleNotices = notices.filter((n) => !campaignTitles.some((t) => n.title.toLowerCase().includes(t))).slice(0, 2);
  const live = campaigns.slice(0, 2);
  const anyCulture = Boolean(shelves.boat || shelves.story || shelves.spik);
  if (!anyCulture && visibleNotices.length === 0 && live.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-12">
      <Header eyebrow="Island life" title="Island life & community" href="/hubs" cta="Hubs" accent="#1e3a8a" />
      {anyCulture && <IslandCards shelves={shelves} spik={shelves.spik} game={game} />}
      {(visibleNotices.length > 0 || live.length > 0) && (
        <ul className={"divide-y divide-line rounded-2xl border border-line bg-white shadow-soft " + (anyCulture ? "mt-4" : "")}>
          {live.map((c) => {
            const pct = Math.min(100, Math.round((c.raised_pence / Math.max(1, c.goal_pence)) * 100));
            return (
              <li key={c.id}>
                <Link href={`/hubs/campaign/${c.id}`} className="block px-4 py-3.5 transition hover:bg-sand">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold text-ink">{c.title}</span>
                    <span className="shrink-0 text-xs font-bold text-ink-muted">{pct}% raised</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-muted">{c.hub}</span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sand"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></span>
                </Link>
              </li>
            );
          })}
          {visibleNotices.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className="block px-4 py-3.5 transition hover:bg-sand">
                <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-ink-faint">{n.publisher}</span>
                <span className="block truncate font-semibold text-ink">{n.title}</span>
                <span className="line-clamp-1 text-sm text-ink-muted">{n.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── Explore: the rest of OneShetland, compactly ──────────────────────────── */

// Sections already given a module above (or the nav's own primary pair) are not repeated here.
const ALREADY_ON_PAGE = new Set(["whats-on", "directory", "jobs"]);

export function ExploreMore() {
  const items = SECTIONS.filter((s) => !ALREADY_ON_PAGE.has(s.key));
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:pb-20">
      <h2 className="font-display text-xl font-bold text-ink">More from OneShetland</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((s) => (
          <Link key={s.key} href={s.href} title={s.blurb} className="inline-flex items-center gap-2 rounded-pill border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft transition hover:bg-sand">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
