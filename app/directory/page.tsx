import Image from "next/image";
import Link from "next/link";
import { getAllBusinesses, getDirectoryFeatured, searchHubs, CATEGORIES, CATEGORY_LABEL, SHETLAND_AREAS } from "@/lib/local-data";
import { BusinessCard } from "@/components/local/LocalUI";
import { HUB_TYPE_LABELS } from "@/lib/hubs-data";
import { TrackSearch } from "@/components/analytics/TrackSearch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Directory" };

const DIR = "#4f46e5";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; area?: string; bookable?: string }>;
}) {
  const { category, q, area, bookable } = await searchParams;
  const bookableOnly = bookable === "1";
  const all = await getAllBusinesses({ category, q, area, bookableOnly });
  // Featured row only on the default (unfiltered, unsearched) view.
  const showFeatured = !category && !q && !area && !bookableOnly;
  const featured = showFeatured ? await getDirectoryFeatured(6) : [];
  const featuredIds = new Set(featured.map((b) => b.id));
  // Exclude featured from the main grid so they aren't shown twice.
  const businesses = featured.length ? all.filter((b) => !featuredIds.has(b.id)) : all;
  const hubs = q && all.length === 0 ? await searchHubs(q) : [];

  // Build a /directory URL preserving current filters, overriding the given keys.
  // A null value removes that param.
  const buildHref = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      category,
      q,
      area,
      bookable: bookableOnly ? "1" : undefined,
    };
    for (const [k, v] of Object.entries(base)) {
      if (v) params.set(k, v);
    }
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/directory?${qs}` : "/directory";
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
      {q && <TrackSearch section="local" query={q} resultsCount={all.length + hubs.length} />}
      {/* Header */}
      <section className="relative isolate overflow-hidden text-paper" style={{ background: DIR }}>
        <Image src="/heroes/directory.jpg" alt="" fill priority className="object-cover opacity-25" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${DIR}f2, ${DIR}c0 60%, ${DIR}99)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-16">
          <p className="eyebrow text-paper/85">OneShetland</p>
          <h1 className="mt-2 font-display text-5xl font-bold leading-none sm:text-6xl">Directory</h1>
          <p className="mt-4 max-w-xl text-lg text-paper/90">
            Every Shetland business in one place — from cafés and crofters to joiners, hairdressers and hotels.
          </p>
        </div>
      </section>

      {/* Sticky search + filter */}
      <div className="sticky top-16 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <form action="/directory" method="get" className="mb-3 flex flex-wrap gap-2">
            {category ? <input type="hidden" name="category" value={category} /> : null}
            {area ? <input type="hidden" name="area" value={area} /> : null}
            {bookableOnly ? <input type="hidden" name="bookable" value="1" /> : null}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name, type, place or tag…"
              className="min-w-0 flex-1 rounded-pill border border-line bg-paper px-5 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint focus:border-local"
            />
            <button type="submit" className="rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: DIR }}>
              Search
            </button>
          </form>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chip("All", buildHref({ category: null }), !category)}
            {CATEGORIES.map((c) => chip(c.label, buildHref({ category: c.key }), category === c.key))}
          </div>
          <div className="-mx-5 mt-2 flex items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Bookable-only toggle */}
            {chip(
              "📅 Bookable only",
              buildHref({ bookable: bookableOnly ? null : "1" }),
              bookableOnly,
            )}
            {/* Area filter — chips mirror the app's locality filter */}
            <span className="ml-1 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-faint">Area</span>
            {chip("All Shetland", buildHref({ area: null }), !area)}
            {SHETLAND_AREAS.map((a) => chip(a.label, buildHref({ area: a.key }), area === a.key))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-14">
        {/* Featured row — promoted (pro/premium) businesses on the default view */}
        {featured.length > 0 && (
          <section className="mb-12">
            <div className="mb-6 flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold">Featured</h2>
              <span className="rounded-pill px-2.5 py-1 text-xs font-bold text-paper shadow-soft" style={{ background: DIR }}>
                ★ Promoted
              </span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((b) => (
                <BusinessCard key={b.id} b={b} />
              ))}
            </div>
          </section>
        )}

        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">
            {q ? `Results for "${q}"` : category ? CATEGORY_LABEL[category] ?? "Businesses" : "All businesses"}
          </h2>
          <div className="flex items-center gap-4">
            <p className="text-sm text-ink-muted">
              {all.length} listing{all.length === 1 ? "" : "s"}
            </p>
            <Link
              href="/directory/bookable"
              className="hidden rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand sm:inline-block"
            >
              📅 Book in Shetland
            </Link>
            <Link
              href="/directory/new"
              className="rounded-pill px-4 py-2 text-sm font-semibold text-paper shadow-soft transition hover:brightness-95"
              style={{ background: DIR }}
            >
              + Add yours
            </Link>
          </div>
        </div>

        {businesses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => (
              <BusinessCard key={b.id} b={b} />
            ))}
          </div>
        ) : featured.length > 0 ? null : (
          <div className="space-y-10">
            <div className="rounded-xl border border-line bg-paper p-10 text-center shadow-soft">
              <p className="font-display text-xl font-bold">No businesses found{q ? ` for "${q}"` : ""}</p>
              <p className="mx-auto mt-2 max-w-md text-ink-soft">
                {q ? "Try a different search or browse by category." : "Try a different category."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href="/directory" className="rounded-pill border border-line-strong px-5 py-2.5 font-semibold text-ink transition hover:bg-sand">
                  Show all
                </Link>
                <Link href="/directory/new" className="rounded-pill px-5 py-2.5 font-semibold text-paper transition hover:brightness-95" style={{ background: DIR }}>
                  Add your business
                </Link>
              </div>
            </div>

            {/* Hub fallback */}
            {hubs.length > 0 && (
              <div>
                <p className="mb-4 text-sm font-semibold text-ink-muted">
                  No businesses matched — but we found {hubs.length === 1 ? "a community hub" : "community hubs"} matching <span className="text-ink">&ldquo;{q}&rdquo;</span>:
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {hubs.map(h => (
                    <Link
                      key={h.id}
                      href={`/hubs/${h.slug ?? h.id}`}
                      className="flex items-center gap-4 rounded-xl border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-line bg-sand">
                        {h.logo_url
                          ? <img src={h.logo_url} alt="" className="h-full w-full object-cover" />
                          : <div className="grid h-full w-full place-items-center font-display text-lg font-bold text-ink-faint">{h.name.slice(0, 1)}</div>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{h.name}</p>
                        <p className="text-sm text-ink-muted">
                          {HUB_TYPE_LABELS[h.type as keyof typeof HUB_TYPE_LABELS] ?? h.type}
                          {h.area ? ` · ${h.area}` : ""}
                        </p>
                        {typeof h.member_count === "number" && h.member_count > 0 && (
                          <p className="text-xs text-ink-faint">{h.member_count} member{h.member_count === 1 ? "" : "s"}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
