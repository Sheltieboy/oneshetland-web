import Link from "next/link";
import {
  displayHeadline, freshnessText, homeLocationText, isSample, photoUrl, wantsText, wantBedroomsText, wantTypesText, type PublicListing,
} from "@/lib/house-swaps";
import { FeatureChips, HomeChips, SampleBadge } from "./Chips";

/** What someone is looking for, as short lines (used on cards, the detail page and the live preview). */
export function WantLines({ areas, beds, types, features }: { areas: string; beds: string; types: string | null; features: string[] }) {
  return (
    <>
      <p className="text-base font-semibold text-ink">{beds}</p>
      <p className="text-sm text-ink-soft">{areas}</p>
      {types && <p className="text-sm text-ink-soft">{types}</p>}
      <div className="mt-2"><FeatureChips features={features} label="Wanted features" /></div>
    </>
  );
}

/** One advert on the noticeboard: a clear two-column "What I have" / "What I'm looking for" (stacked on a phone). */
export function ListingCard({ l, note }: { l: PublicListing; note?: React.ReactNode }) {
  const photo = l.photos[0];
  return (
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-paper shadow-soft transition hover:shadow-lift">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl(photo.path)} alt={photo.alt || "Photo of the home"} loading="lazy" className="aspect-[16/7] w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col p-5">
        {isSample(l) && <p className="mb-2"><SampleBadge /></p>}
        <h2 className="break-words font-display text-xl font-bold leading-snug text-ink">
          <Link href={`/house-swaps/${l.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-navy">
            {displayHeadline(l)}
          </Link>
        </h2>
        {note}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <section aria-label="What I have" className="min-w-0 rounded-xl border-l-4 border-l-navy bg-navy/5 p-3.5">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-navy">What I have</h3>
            <div className="mt-2"><HomeChips bedrooms={l.have_bedrooms} type={l.have_type} area={homeLocationText(l)} /></div>
            <div className="mt-2"><FeatureChips features={l.have_features} /></div>
          </section>
          <section aria-label="What I'm looking for" className="min-w-0 rounded-xl border-l-4 border-l-teal-dark bg-teal/10 p-3.5">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-navy">What I&apos;m looking for</h3>
            <div className="mt-2">
              <WantLines areas={wantsText(l)} beds={wantBedroomsText(l.want_min_bedrooms, l.want_max_bedrooms)} types={wantTypesText(l.want_types)} features={l.want_features} />
            </div>
          </section>
        </div>
        <p className="mt-auto pt-4 text-xs font-semibold text-ink-muted">{freshnessText(l.last_confirmed_at)}</p>
      </div>
    </article>
  );
}
