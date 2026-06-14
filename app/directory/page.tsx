import Image from "next/image";
import Link from "next/link";
import { getAllBusinesses, CATEGORIES, CATEGORY_LABEL } from "@/lib/local-data";
import { BusinessCard } from "@/components/local/LocalUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Directory" };

const DIR = "#6b47bf";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const businesses = await getAllBusinesses({ category, q });

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
      {/* Header band */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: DIR }}>
        <Image src="/heroes/directory.jpg" alt="" fill priority className="object-cover opacity-25" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${DIR}f2, ${DIR}c0 60%, ${DIR}99)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-16">
          <p className="eyebrow text-paper/85">OneShetland</p>
          <h1 className="mt-2 font-display text-5xl font-bold leading-none sm:text-6xl">Directory</h1>
          <p className="mt-4 max-w-xl text-lg text-paper/90">
            Every Shetland business in one place — from cafés and crofters to
            joiners, hairdressers and hotels.
          </p>
        </div>
      </section>

      {/* Sticky search + filter */}
      <div className="sticky top-16 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <form action="/directory" method="get" className="mb-3 flex gap-2">
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search businesses by name…"
              className="w-full rounded-pill border border-line bg-paper px-5 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint focus:border-local"
            />
            <button type="submit" className="rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: DIR }}>
              Search
            </button>
          </form>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chip("All", "/directory", !category)}
            {CATEGORIES.map((c) => chip(c.label, `/directory?category=${c.key}`, category === c.key))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-14">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">
            {q ? `Results for "${q}"` : category ? CATEGORY_LABEL[category] ?? "Businesses" : "All businesses"}
          </h2>
          <p className="text-sm text-ink-muted">
            {businesses.length} listing{businesses.length === 1 ? "" : "s"}
          </p>
        </div>

        {businesses.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper p-12 text-center shadow-soft">
            <h3 className="font-display text-xl font-bold">No businesses found</h3>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">Try a different search or category.</p>
            <Link href="/directory" className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper" style={{ background: DIR }}>
              Show all
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => (
              <BusinessCard key={b.id} b={b} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
