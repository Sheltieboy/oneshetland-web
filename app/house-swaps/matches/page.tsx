import Link from "next/link";
import { currentUserId, getMatches, getMyListing, requireHouseSwaps } from "@/lib/house-swaps-data";
import { MATCH_DISCLAIMER, MATCH_KINDS, MATCH_KIND_HELP, MATCH_KIND_LABEL, signInHref } from "@/lib/house-swaps";
import { Panel, SwapsHeader, SwapsNav, btnPrimary, btnSecondary } from "@/components/house-swaps/Shell";
import { MatchCard } from "@/components/house-swaps/MatchCard";
import { Notice } from "@/components/notices/NoticesShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "House Swaps · Possible matches" };

export default async function MatchesPage() {
  await requireHouseSwaps();
  const userId = await currentUserId();
  if (!userId) {
    return (
      <>
        <SwapsHeader title="Possible matches" />
        <SwapsNav current="matches" />
        <div className="mx-auto max-w-3xl px-5 py-10"><Panel><h2 className="font-display text-2xl font-bold text-ink">Sign in to see possible matches</h2><p className="mt-2 text-ink-soft">Once you have an advert, we suggest other adverts that could suit you or that you could suit.</p><Link href={signInHref("/house-swaps/matches")} className={`${btnPrimary} mt-4`}>Sign in or join</Link></Panel></div>
      </>
    );
  }
  const [mine, res] = await Promise.all([getMyListing(), getMatches(50)]);
  const l = mine.ok ? mine.data : null;
  const rows = res.ok ? res.data : [];
  const live = !!l?.is_public;

  return (
    <>
      <SwapsHeader title="Possible matches" intro={<p>{MATCH_DISCLAIMER}</p>} />
      <SwapsNav current="matches" unread={l?.unread_enquiries ?? 0} />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        {!res.ok && <Notice tone="error">Your matches could not be loaded just now ({res.error}).</Notice>}
        {!l && (
          <Panel><h2 className="font-display text-2xl font-bold text-ink">Add an advert to see matches</h2><p className="mt-2 text-ink-soft">We compare your advert with the others, so we need to know what you have and what you are looking for.</p><Link href="/house-swaps/my" className={`${btnPrimary} mt-4`}>Add your advert</Link></Panel>
        )}
        {l && !live && (
          <Panel><h2 className="font-display text-2xl font-bold text-ink">Your advert isn&apos;t live yet</h2><p className="mt-2 text-ink-soft">Possible matches appear once your advert has been checked and is on the noticeboard. {l.status === "paused" ? "It is paused at the moment." : ""}</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/house-swaps/my" className={btnPrimary}>See my advert</Link><Link href="/house-swaps" className={btnSecondary}>Browse all adverts</Link></div></Panel>
        )}
        {live && res.ok && rows.length === 0 && (
          <div className="rounded-card border border-dashed border-line-strong bg-paper p-8 text-center">
            <h2 className="font-display text-xl font-bold text-ink">No matches yet</h2>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">Nothing fits right now. New adverts are added all the time. You could widen what you&apos;re looking for (more areas, a wider range of bedrooms) or browse every advert yourself.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/house-swaps" className={btnPrimary}>Browse all adverts</Link><Link href="/house-swaps/my" className={btnSecondary}>Change what I&apos;m looking for</Link></div>
          </div>
        )}
        {live && MATCH_KINDS.map((k) => {
          const group = rows.filter((m) => m.match_kind === k);
          if (!group.length) return null;
          return (
            <section key={k} aria-labelledby={`g-${k}`} className="mb-10">
              <h2 id={`g-${k}`} className="font-display text-2xl font-bold text-ink">{MATCH_KIND_LABEL[k]} <span className="text-base font-semibold text-ink-muted">({group.length})</span></h2>
              <p className="mt-1 text-sm text-ink-muted">{MATCH_KIND_HELP[k]}</p>
              <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{group.map((m) => <li key={m.listing_id} className="min-w-0"><MatchCard m={m} showKind={false} /></li>)}</ul>
            </section>
          );
        })}
        <p className="text-sm text-ink-muted">{MATCH_DISCLAIMER} <Link href="/house-swaps" className="inline-flex min-h-[44px] items-center font-semibold underline">Browse all adverts</Link></p>
      </div>
    </>
  );
}
