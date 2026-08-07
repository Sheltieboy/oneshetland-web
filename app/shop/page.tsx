import Link from "next/link";
import { browseProducts, PRODUCT_CATEGORIES, gbp, type BrowseSort } from "@/lib/shop-data";
import { TrackSearch } from "@/components/analytics/TrackSearch";
import { SafeImage } from "@/components/ui/SafeImage";
import { ShopSearchBar } from "@/components/shop/ShopSearchBar";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shop Shetland",
  description: "Everything on sale from Shetland's shops and makers — knitwear, craft, art, food and drink, all in one place.",
};

const LOCAL = "#7c3aed";
const PAGE = 48;

const SORTS: { id: BrowseSort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "price_low", label: "Price ↑" },
  { id: "price_high", label: "Price ↓" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const { q, category, sort } = await searchParams;
  const activeSort: BrowseSort =
    sort === "price_low" || sort === "price_high" ? sort : "newest";

  const products = await browseProducts({
    category: category ?? null,
    query: q ?? "",
    sort: activeSort,
    limit: PAGE,
  });

  // Preserve the other filters when one of them changes.
  const href = (next: { q?: string; category?: string; sort?: string }) => {
    const p = new URLSearchParams();
    const merged = { q, category, sort: activeSort === "newest" ? undefined : activeSort, ...next };
    if (merged.q) p.set("q", merged.q);
    if (merged.category) p.set("category", merged.category);
    if (merged.sort) p.set("sort", merged.sort);
    const s = p.toString();
    return s ? `/shop?${s}` : "/shop";
  };

  const chip = (label: string, to: string, on: boolean) => (
    <Link
      key={label}
      href={to}
      className={
        "shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition " +
        (on ? "text-white shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand")
      }
      style={on ? { background: LOCAL } : undefined}
    >
      {label}
    </Link>
  );

  return (
    <>
      {q && <TrackSearch section="shop" query={q} resultsCount={products.length} />}

      <section className="relative isolate overflow-hidden text-paper" style={{ background: LOCAL }}>
        <div className="relative mx-auto max-w-6xl px-5 py-12 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-widest text-paper/80">OneShetland</p>
          <h1 className="mt-2 font-display text-5xl font-bold sm:text-6xl">Shop Shetland</h1>
          <p className="mt-3 max-w-xl text-lg text-paper/90">
            Everything on sale from Shetland&apos;s own shops and makers. Buy direct — the money stays with them.
          </p>
        </div>
      </section>

      <div className="sticky top-16 z-30 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <ShopSearchBar q={q ?? ""} category={category} sort={sort} accent={LOCAL} />
          <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chip("All", href({ category: undefined }), !category)}
            {PRODUCT_CATEGORIES.map((c) =>
              chip(c.label, href({ category: c.value }), category === c.value),
            )}
          </div>
          <div className="mt-2 flex gap-5">
            {SORTS.map((s) => (
              <Link
                key={s.id}
                href={href({ sort: s.id === "newest" ? undefined : s.id })}
                className={"text-sm " + (activeSort === s.id ? "font-black" : "font-semibold text-ink-muted")}
                style={activeSort === s.id ? { color: LOCAL } : undefined}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {products.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-xl font-bold text-ink">
              {q || category ? "Nothing matches that yet" : "No products yet"}
            </p>
            <p className="mt-2 text-ink-muted">
              {q || category
                ? "Try another word, or a different category."
                : "Shetland shops are still adding their first products."}
            </p>
            {(q || category) && (
              <Link href="/shop" className="mt-5 inline-block rounded-pill px-5 py-2.5 font-semibold text-white" style={{ background: LOCAL }}>
                Show everything
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-muted">
              {products.length}{products.length === PAGE ? "+" : ""} item{products.length === 1 ? "" : "s"}
            </p>
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <li key={p.id}>
                  <Link href={`/product/${p.id}`} className="group block">
                    {/* SafeImage, not next/image: product photos are merchant-
                        supplied URLs from hosts nobody has whitelisted, and
                        next/image throws a 500 for the whole page on an
                        unconfigured host rather than just dropping the image. */}
                    <div className="relative aspect-square overflow-hidden rounded-card bg-sand">
                      {p.photos?.[0] ? (
                        <SafeImage
                          src={p.photos[0]}
                          alt={p.title}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          fallback={<div className="grid h-full place-items-center text-ink-faint">No photo</div>}
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-ink-faint">No photo</div>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 font-semibold leading-snug text-ink">{p.title}</p>
                    <p className="text-sm text-ink-muted">{p.business_name}</p>
                    <p className="mt-0.5 flex items-baseline gap-2">
                      <span className="font-display text-lg font-bold" style={{ color: LOCAL }}>{gbp(p.price_pence)}</span>
                      {p.compare_at_pence ? (
                        <span className="text-sm text-ink-faint line-through">{gbp(p.compare_at_pence)}</span>
                      ) : null}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
