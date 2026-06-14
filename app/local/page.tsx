import Image from "next/image";
import Link from "next/link";
import {
  getFeaturedBusinesses,
  getActiveOffers,
  getCategoryCounts,
  CATEGORIES,
} from "@/lib/local-data";
import { FeaturedCarousel } from "@/components/local/FeaturedCarousel";
import { OfferCard, CategoryTile, BusinessCard } from "@/components/local/LocalUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local" };

const LOCAL = "#7c3aed";

export default async function LocalPage() {
  const [featured, offers, counts] = await Promise.all([
    getFeaturedBusinesses(8),
    getActiveOffers(6),
    getCategoryCounts(),
  ]);

  return (
    <>
      {/* Header band */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: LOCAL }}>
        <Image src="/heroes/local.jpeg" alt="" fill priority className="object-cover opacity-25" />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to top, ${LOCAL}f2, ${LOCAL}c0 60%, ${LOCAL}99)` }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-16">
          <p className="eyebrow text-paper/85">OneShetland</p>
          <h1 className="mt-2 font-display text-5xl font-bold leading-none sm:text-6xl">Local</h1>
          <p className="mt-4 max-w-xl text-lg text-paper/90">
            Shop, eat, book and save with Shetland businesses — with offers, loyalty
            and cashback when you pay through OneShetland.
          </p>
        </div>
      </section>

      {/* Rotating featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-12 sm:pt-14">
          <FeaturedCarousel businesses={featured} />
        </section>
      )}

      {/* Latest offers */}
      {offers.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-12 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow text-local">Worth a look</p>
              <h2 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Latest offers</h2>
            </div>
            <Link
              href="/directory"
              className="inline-flex items-center gap-1.5 rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand"
            >
              See all <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => (
              <OfferCard key={o.id} o={o} />
            ))}
          </div>
        </section>
      )}

      {/* Browse by category */}
      <section className="bg-sand/40">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:py-14">
          <p className="eyebrow text-local">Browse</p>
          <h2 className="mt-1 font-display text-3xl font-bold sm:text-4xl">By category</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <CategoryTile key={c.key} cat={c} count={counts[c.key]} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured businesses grid */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow text-local">Shetland makers & shops</p>
              <h2 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Featured businesses</h2>
            </div>
            <Link
              href="/directory"
              className="inline-flex items-center gap-1.5 rounded-pill px-5 py-2.5 text-sm font-semibold text-paper shadow-soft transition hover:brightness-95"
              style={{ background: LOCAL }}
            >
              The full directory <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((b) => (
              <BusinessCard key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
