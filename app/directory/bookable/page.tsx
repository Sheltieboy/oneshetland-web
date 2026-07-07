import Image from "next/image";
import Link from "next/link";
import {
  getBookableBusinesses,
  getServiceCounts,
  CATEGORIES,
  CATEGORY_LABEL,
  SHETLAND_AREAS,
} from "@/lib/local-data";
import { BusinessCard } from "@/components/local/LocalUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book in Shetland" };

const DIR = "#4f46e5";

export default async function BookablePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; area?: string }>;
}) {
  const { category, area } = await searchParams;
  const businesses = await getBookableBusinesses({ category, area });
  const counts = await getServiceCounts(businesses.map((b) => b.id));

  // Build a /directory/bookable URL preserving filters, overriding given keys.
  const buildHref = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = { category, area };
    for (const [k, v] of Object.entries(base)) if (v) params.set(k, v);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/directory/bookable?${qs}` : "/directory/bookable";
  };

  const chip = (label: string, href: string, on: boolean) => (
    <Link
      key={label}
      href={href}
      className={
        "shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition " +
        (on ? "text-paper shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand")
      }
      style={on ? { background: DIR } : undefined}
    >
      {label}
    </Link>
  );

  return (
    <>
      {/* Header */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: DIR }}>
        <Image src="/heroes/directory.jpg" alt="" fill priority className="object-cover opacity-25" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${DIR}f2, ${DIR}c0 60%, ${DIR}99)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-16">
          <p className="eyebrow text-paper/85">
            <Link href="/directory" className="hover:underline">Directory</Link> · Bookings
          </p>
          <h1 className="mt-2 font-display text-5xl font-bold leading-none sm:text-6xl">Book in Shetland</h1>
          <p className="mt-4 max-w-xl text-lg text-paper/90">
            Every Shetland business taking bookings — barbers and beauty, boat trips, classes and
            more. Pick a place, then book a slot.
          </p>
        </div>
      </section>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chip("All", buildHref({ category: null }), !category)}
            {CATEGORIES.map((c) => chip(c.label, buildHref({ category: c.key }), category === c.key))}
          </div>
          <div className="-mx-5 mt-2 flex items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-faint">Area</span>
            {chip("All Shetland", buildHref({ area: null }), !area)}
            {SHETLAND_AREAS.map((a) => chip(a.label, buildHref({ area: a.key }), area === a.key))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-14">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">
            {category ? CATEGORY_LABEL[category] ?? "Bookable" : "Bookable businesses"}
          </h2>
          <p className="text-sm text-ink-muted">
            {businesses.length} place{businesses.length === 1 ? "" : "s"}
          </p>
        </div>

        {businesses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => {
              const n = counts[b.id] ?? 0;
              return (
                <div key={b.id} className="flex flex-col gap-2">
                  <BusinessCard b={b} />
                  <p className="px-1 text-xs font-semibold text-ink-muted">
                    📅 {n === 0 ? "Bookings open" : `${n} service${n === 1 ? "" : "s"} to book`}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-paper p-10 text-center shadow-soft">
            <p className="font-display text-xl font-bold">Nothing bookable here yet</p>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">
              {category || area
                ? "Try a different category or area, or show all of Shetland."
                : "Shetland businesses can turn on bookings from their dashboard."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/directory/bookable" className="rounded-pill border border-line-strong px-5 py-2.5 font-semibold text-ink transition hover:bg-sand">
                Show all
              </Link>
              <Link href="/directory" className="rounded-pill px-5 py-2.5 font-semibold text-paper transition hover:brightness-95" style={{ background: DIR }}>
                Browse the Directory
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
