import Link from "next/link";
import { PromoLink } from "@/components/editions/PromoTrack";
import { dateRangeLabel } from "@/lib/editions/rules";
import { KIND_LABEL } from "@/lib/editions/types";
import { HOME_STRIP_CAP, type FeaturedEdition } from "@/lib/editions/promo-public";
import { responsiveImage } from "@/lib/editions/images";

/**
 * Festivals and Editions: a small, labelled strip on the home page. It shows a share of the featured Editions the database returns (never more than three), each marked
 * "Promoted", and collapses completely when there are none (Editions off, nobody booked, or the call failed). It has its own data and shares nothing with the business shelf,
 * the Premium reserved slots, the directory ranking or any paid business placement.
 */
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy";

export function EditionsStrip({ items }: { items: FeaturedEdition[] }) {
  const list = items.slice(0, HOME_STRIP_CAP);
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="editions-strip-h" className="bg-[#fbf8f2]">
      <div className="mx-auto max-w-6xl px-5 pb-6 pt-8 sm:pb-10 sm:pt-12">
        <div className="mb-4 flex items-end justify-between gap-3 sm:mb-6">
          <div>
            <p className="eyebrow" style={{ color: "#0e7490" }}>Promoted</p>
            <h2 id="editions-strip-h" className="mt-1 font-display text-2xl font-bold leading-tight text-ink sm:text-4xl">Festivals and Editions</h2>
          </div>
          <Link href="/editions" className={`shrink-0 text-sm font-bold text-navy underline-offset-4 hover:underline ${FOCUS}`}>All Editions</Link>
        </div>
        <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {list.map((e) => (
            <li key={e.edition_id} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <PromoLink href={`/editions/${e.slug}`} editionId={e.edition_id} surface="home" className={`group flex h-full overflow-hidden rounded-3xl bg-paper shadow-soft ring-1 ring-black/5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift sm:flex-col ${FOCUS}`}>
                <span className="relative block aspect-[16/10] w-28 shrink-0 overflow-hidden bg-gradient-to-br from-[#0e7490] to-[#1f2937] sm:aspect-[16/9] sm:w-full">
                  {e.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img {...responsiveImage(e.cover_url, "(min-width: 64rem) 33vw, (min-width: 40rem) 50vw, 78vw")} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center p-3.5 sm:p-4">
                  <span className="text-[11px] font-black uppercase tracking-wider text-ink-soft">
                    <span className="mr-2 rounded-pill bg-amber-100 px-2 py-0.5 text-amber-900">Promoted</span>{KIND_LABEL[e.kind]}
                  </span>
                  <span className="mt-1.5 line-clamp-2 font-display text-[1.05rem] font-bold leading-snug text-ink sm:text-lg">{e.title}</span>
                  <span className="mt-1 text-[13px] text-ink-soft sm:text-sm">{dateRangeLabel(e.starts_on, e.ends_on)}{e.organiser_name ? ` · ${e.organiser_name}` : ""}</span>
                </span>
              </PromoLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
