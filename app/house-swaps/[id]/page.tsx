import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing, getMatches, getThreads, getMyListing, getUnreadCount, currentUserId, requireHouseSwaps } from "@/lib/house-swaps-data";
import {
  HOUSE_SWAPS_INTRO, MATCH_KIND_HELP, MATCH_KIND_LABEL, SAMPLE_NO_MESSAGES, displayHeadline, freshnessText, isSample, landlordLabel, wantAreasText, wantBedroomsText, wantTypesText,
} from "@/lib/house-swaps";
import { Disclaimer, Panel, SwapsHeader, SwapsNav, btnPrimary, btnSecondary } from "@/components/house-swaps/Shell";
import { Chip, FeatureChips, HomeChips, SampleBadge } from "@/components/house-swaps/Chips";
import { Gallery } from "@/components/house-swaps/Gallery";
import { WantLines } from "@/components/house-swaps/ListingCard";
import { EnquiryForm } from "@/components/house-swaps/EnquiryForm";
import { ReportForm } from "@/components/house-swaps/ReportForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "House Swaps · Advert" };

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireHouseSwaps();
  const { id } = await params;
  const [l, userId, mine, unread] = await Promise.all([getListing(id), currentUserId(), getMyListing(), getUnreadCount()]);
  if (!l) notFound();
  const myAdvert = mine.ok ? mine.data : null;
  const isMine = !!myAdvert && myAdvert.id === l.id;
  const threads = userId ? await getThreads() : null;
  const existing = threads && threads.ok ? threads.data.find((t) => t.listing_id === l.id) : undefined;
  const matches = myAdvert && myAdvert.is_public && !isMine ? await getMatches(50) : null;
  const match = matches && matches.ok ? matches.data.find((m) => m.listing_id === l.id) : null;
  const title = displayHeadline(l);
  const landlord = landlordLabel(l.landlord_type);
  const sample = isSample(l);

  return (
    <>
      <SwapsHeader title={title} eyebrow="House Swaps advert" />
      <SwapsNav current="board" unread={unread} />
      <div className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
        <Link href="/house-swaps" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-navy-light underline">{"←"} All adverts</Link>

        {match && (
          <div role="status" className="mt-3 rounded-card border border-teal/50 bg-teal/10 p-4">
            <p className="text-sm font-black uppercase tracking-widest text-navy-light">Possible match for your advert</p>
            <p className="mt-1 font-semibold text-ink">{MATCH_KIND_LABEL[match.match_kind]}. <span className="font-normal text-ink-soft">{MATCH_KIND_HELP[match.match_kind]}</span></p>
            {match.reasons.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">{match.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            <p className="mt-2 text-xs text-ink-muted">Possible matches, not a guarantee.</p>
          </div>
        )}
        {isMine && <div role="status" className="mt-3 rounded-card border border-line bg-sand/60 p-4 text-sm text-ink-soft">This is your own advert, as others see it. <Link href="/house-swaps/my" className="font-semibold underline">Manage it</Link>.</div>}

        {sample && <p className="mt-4"><SampleBadge /></p>}
        <div className="mt-4"><Gallery photos={l.photos} title={title} /></div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Panel aria-labelledby="have">
            <h2 id="have" className="text-xs font-black uppercase tracking-widest text-ink-muted">What I have</h2>
            <p className="mt-3 font-display text-2xl font-bold text-ink">{l.have_bedrooms === 0 ? "Bedsit / studio" : `${l.have_bedrooms} bedroom${l.have_bedrooms === 1 ? "" : "s"}`}</p>
            <div className="mt-2"><HomeChips bedrooms={l.have_bedrooms} type={l.have_type} area={l.have_area_name} /></div>
            <div className="mt-3"><FeatureChips features={l.have_features} /></div>
            {landlord && <p className="mt-4 text-sm text-ink-soft">Landlord: <Chip>{landlord}</Chip></p>}
          </Panel>
          <Panel aria-labelledby="want">
            <h2 id="want" className="text-xs font-black uppercase tracking-widest text-ink-muted">What I&apos;m looking for</h2>
            <div className="mt-3"><WantLines areas={wantAreasText(l.want_area_names)} beds={wantBedroomsText(l.want_min_bedrooms, l.want_max_bedrooms)} types={wantTypesText(l.want_types)} features={l.want_features} /></div>
            {l.want_notes && <p className="mt-3 whitespace-pre-line break-words text-sm text-ink-soft">{l.want_notes}</p>}
          </Panel>
        </div>

        {l.description && (
          <Panel className="mt-4" aria-labelledby="words">
            <h2 id="words" className="font-display text-xl font-bold text-ink">In their words</h2>
            <p className="mt-2 whitespace-pre-line break-words text-base leading-relaxed text-ink-soft">{l.description}</p>
          </Panel>
        )}

        <p className="mt-4 text-sm font-semibold text-ink-muted">{freshnessText(l.last_confirmed_at)}. Adverts are only shown while the member keeps confirming they are still available.</p>
        <Disclaimer className="mt-4" />

        {sample && <Panel className="mt-6" role="note"><p className="text-base text-ink-soft">{SAMPLE_NO_MESSAGES}</p></Panel>}

        {!isMine && !sample && (
          <Panel className="mt-6" aria-labelledby="enq">
            <h2 id="enq" className="font-display text-2xl font-bold text-ink">Express interest privately</h2>
            <p className="mt-1 text-sm text-ink-muted">Your message goes to the advert&apos;s owner through OneShetland. They never see your name or contact details unless you choose to share them.</p>
            {existing ? (
              <div className="mt-4 rounded-xl bg-sand/60 p-4" role="status">
                <p className="font-semibold text-ink">You&apos;ve already sent an enquiry about this advert.</p>
                <Link href={`/house-swaps/messages/${existing.thread_id}`} className={`${btnPrimary} mt-3`}>Open the conversation</Link>
              </div>
            ) : <div className="mt-4"><EnquiryForm listingId={l.id} signedIn={!!userId} hasAdvert={!!myAdvert} /></div>}
            {userId && <p className="mt-3 text-sm"><Link href="/house-swaps/messages" className="inline-flex min-h-[44px] items-center font-semibold text-navy-light underline">See my messages</Link></p>}
          </Panel>
        )}

        <div className="mt-6 flex flex-wrap items-start gap-3">
          {!isMine && !sample && (userId ? <ReportForm kind="listing" id={l.id} /> : <Link href={`/sign-in?next=${encodeURIComponent(`/house-swaps/${l.id}`)}`} className={btnSecondary}>Sign in to report this advert</Link>)}
          <Link href="/house-swaps/about" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-navy-light underline">How it works and staying safe</Link>
        </div>
        <p className="mt-6 text-xs text-ink-muted">{HOUSE_SWAPS_INTRO}</p>
      </div>
    </>
  );
}
