import Image from "next/image";
import Link from "next/link";
import {
  getBookableServices,
  money,
  CATEGORIES,
  CATEGORY_LABEL,
  SHETLAND_AREAS,
} from "@/lib/local-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book in Shetland" };

const DIR = "#4f46e5";

/** "1h 30m" / "45m" / "2h" — same shape as the owner-side formatter in
 *  lib/book-manage-items.ts, kept separate because that module is
 *  "use client" and this page is a server component. */
function duration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function BookablePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; area?: string }>;
}) {
  const { category, area } = await searchParams;
  const services = await getBookableServices({ category, area });

  // Group by business — the business is still shown and still clickable for
  // context, it just is not the unit of the list any more. Order follows
  // the query's own order (verified-then-name business order, display_order
  // within a business), not re-sorted here.
  const businessOrder: string[] = [];
  const seen = new Set<string>();
  for (const s of services) {
    if (!seen.has(s.business_id)) { seen.add(s.business_id); businessOrder.push(s.business_id); }
  }
  const grouped = businessOrder.map((id) => services.filter((s) => s.business_id === id));

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
            Everything you can book right now — barbers and beauty, boat trips, classes and more.
            Pick a service, pick a slot.
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
            {category ? CATEGORY_LABEL[category] ?? "Bookable" : "Bookable services"}
          </h2>
          <p className="text-sm text-ink-muted">
            {services.length} service{services.length === 1 ? "" : "s"}
          </p>
        </div>

        {grouped.length > 0 ? (
          <div className="space-y-6">
            {grouped.map((group) => {
              const b = group[0];
              const bizHref = `/directory/${b.business_slug ?? b.business_id}`;
              return (
                <div key={b.business_id} className="overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
                  <Link href={bizHref} className="flex items-center gap-3 border-b border-line bg-sand/60 px-4 py-3 transition hover:bg-sand">
                    <span className="font-display font-bold text-ink hover:underline">{b.business_name}</span>
                    {b.business_category && (
                      <span className="text-xs font-semibold text-ink-muted">{CATEGORY_LABEL[b.business_category] ?? b.business_category}</span>
                    )}
                  </Link>
                  <div className="divide-y divide-line">
                    {group.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-4 p-4">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-ink">{s.name}</h3>
                          <p className="text-sm text-ink-muted">
                            {duration(s.duration_minutes)}{s.description ? ` · ${s.description}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-display text-lg font-bold" style={{ color: DIR }}>{money(s.price_pence)}</span>
                          <Link
                            href={`${bizHref}?book=${s.id}`}
                            className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper transition hover:brightness-95"
                            style={{ background: DIR }}
                          >
                            Book
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
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
