import Link from "next/link";
import { getBrowse, getMatches, getMyListing, getUnreadCount, requireHouseSwaps } from "@/lib/house-swaps-data";
import { HOUSE_SWAPS_INTRO, INTRODUCTIONS_ONLY, MATCH_DISCLAIMER, activeFilterCount, browseHref, parseBrowseQuery } from "@/lib/house-swaps";
import { Disclaimer, SwapsHeader, SwapsNav, btnPrimary, btnSecondary } from "@/components/house-swaps/Shell";
import { BrowseFilters } from "@/components/house-swaps/BrowseFilters";
import { ListingCard } from "@/components/house-swaps/ListingCard";
import { MatchCard } from "@/components/house-swaps/MatchCard";
import { Notice } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "House Swaps · Noticeboard" };

type SP = Promise<Record<string, string | string[] | undefined>>;

/** The public House Swaps noticeboard. URL state drives the filters (?area=&place=&beds=&type=&feat=&want=&page=), newest-confirmed first. Works signed out. */
export default async function HouseSwapsPage({ searchParams }: { searchParams: SP }) {
  await requireHouseSwaps();
  const q = parseBrowseQuery(await searchParams);
  const [browse, mine, unread] = await Promise.all([getBrowse(q), getMyListing(), getUnreadCount()]);
  const myAdvert = mine.ok ? mine.data : null;
  const matches = myAdvert && myAdvert.is_public ? await getMatches(3) : null;
  const filters = activeFilterCount(q);
  const rows = browse.ok ? browse.data.rows : [];

  return (
    <>
      <SwapsHeader
        title="House Swaps"
        intro={<><p>{HOUSE_SWAPS_INTRO}</p><p className="mt-2 font-semibold">{INTRODUCTIONS_ONLY}</p></>}
      />
      <SwapsNav current="board" unread={unread} />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/house-swaps/my" className={btnPrimary}>{myAdvert ? "Manage my advert" : "Add your advert"}</Link>
          <Link href="/house-swaps/about" className={btnSecondary}>How it works and staying safe</Link>
        </div>
        <Disclaimer compact className="mt-5" />

        {matches && matches.ok && matches.data.length > 0 && (
          <section aria-labelledby="pm" className="mt-8">
            <h2 id="pm" className="font-display text-2xl font-bold text-ink">Possible matches for you</h2>
            <p className="mt-1 text-sm text-ink-muted">Possible matches, not a guarantee.</p>
            <ul className="mt-4 grid gap-4 md:grid-cols-3">{matches.data.map((m) => <li key={m.listing_id} className="min-w-0"><MatchCard m={m} /></li>)}</ul>
            <p className="mt-3 text-sm"><Link href="/house-swaps/matches" className="inline-flex min-h-[44px] items-center font-semibold text-navy-light underline">See all possible matches</Link> <span className="text-ink-muted">· {MATCH_DISCLAIMER}</span></p>
          </section>
        )}

        <section aria-labelledby="all" className="mt-8">
          <h2 id="all" className="font-display text-2xl font-bold text-ink">All adverts</h2>
          <div className="mt-4"><BrowseFilters q={q} /></div>

          <div className="mt-6" aria-live="polite">
            {!browse.ok && <Notice tone="error">The adverts could not be loaded just now ({browse.error}). Please try again in a moment.</Notice>}
            {browse.ok && rows.length === 0 && (
              <div className="rounded-card border border-dashed border-line-strong bg-paper p-8 text-center">
                <h3 className="font-display text-xl font-bold text-ink">{filters > 0 ? "No adverts match those filters" : "There are no adverts yet"}</h3>
                <p className="mx-auto mt-2 max-w-md text-ink-soft">
                  {filters > 0
                    ? "Try widening them: choose a different area, fewer features, or any number of bedrooms. New adverts are added all the time."
                    : "Be the first to add one. It's free, and nobody sees your name or address."}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {filters > 0 && <Link href="/house-swaps" className={btnSecondary}>Clear all filters</Link>}
                  <Link href="/house-swaps/my" className={btnPrimary}>Create your own advert</Link>
                </div>
              </div>
            )}
            {rows.length > 0 && (
              <>
                <p className="mb-4 text-sm text-ink-muted">{browse.ok && browse.data.hasMore ? "Showing the most recently confirmed adverts first." : `${rows.length} advert${rows.length === 1 ? "" : "s"}${q.page > 1 ? " on this page" : ""}, most recently confirmed first.`}</p>
                <ul className="grid gap-4 md:grid-cols-2">
                  {rows.map((l) => <li key={l.id} className="min-w-0"><ListingCard l={l} /></li>)}
                </ul>
              </>
            )}
          </div>

          {browse.ok && (q.page > 1 || browse.data.hasMore) && (
            <nav aria-label="More adverts" className="mt-6 flex justify-center gap-3">
              {q.page > 1 && <Link href={browseHref({ ...q, page: q.page - 1 })} className={btnSecondary}>Newer adverts</Link>}
              {browse.data.hasMore && <Link href={browseHref({ ...q, page: q.page + 1 })} className={btnSecondary}>Show more</Link>}
            </nav>
          )}
        </section>

        <section aria-labelledby="how" className="mt-12 grid gap-4 rounded-card bg-sand/60 p-6 sm:grid-cols-3">
          <h2 id="how" className="sr-only">How it works</h2>
          {[
            ["1. Add an advert", "Tell us the area, size and type of your home and what you are looking for. No address, no name."],
            ["2. Meet privately", "Browse adverts or check your possible matches, then send a private message through OneShetland."],
            ["3. Talk to your landlord", "Any swap needs both landlords' written consent. Speak to yours before you agree anything."],
          ].map(([t, b]) => <div key={t}><h3 className="font-display text-lg font-bold text-ink">{t}</h3><p className="mt-1 text-sm text-ink-soft">{b}</p></div>)}
        </section>
      </div>
    </>
  );
}
