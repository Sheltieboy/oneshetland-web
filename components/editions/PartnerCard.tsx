import Link from "next/link";
import type { PublicPartnerBusiness } from "@/lib/editions/data.server";
import { businessHref, categoryLabel, offerBadge } from "@/lib/editions/partners";
import { responsiveImage } from "@/lib/editions/images";

export type TileSize = "lead" | "side" | "grid" | "wide";
const RATIO: Record<TileSize, string> = { lead: "ed-ratio-54", side: "ed-ratio-169", grid: "ed-ratio-43", wide: "ed-ratio-21" };

/**
 * One participating business, set as a magazine tile: a photograph (its cover, else its logo on a tonal ground, else a monogram), then name, category and the
 * offers it chose for this Edition. Everything shown is read live from the business's own listing; the Edition stores nothing about it.
 */
export function PartnerCard({ b, size = "grid" }: { b: PublicPartnerBusiness; size?: TileSize }) {
  const cat = categoryLabel(b.category);
  const media = b.cover_url ? (
    <div className={`ed-img ${RATIO[size]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...responsiveImage(b.cover_url, "(min-width: 62rem) 33vw, (min-width: 40rem) 50vw, 100vw")} alt="" loading="lazy" decoding="async" fetchPriority="low" />
    </div>
  ) : b.logo_url ? (
    <div className={`ed-img ed-img--logo ${RATIO[size]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b.logo_url} alt="" loading="lazy" decoding="async" fetchPriority="low" />
    </div>
  ) : (
    <div className={`ed-img ed-img--mono ${RATIO[size]}`} aria-hidden="true"><span>{b.name.trim().slice(0, 1)}</span></div>
  );
  return (
    <article className={`ed-tile ed-hover ed-rise ed-tile--${size === "lead" ? "lead" : size === "side" ? "side" : "std"}`}>
      {media}
      <div className="ed-tile__body">
        {b.label && <p className="ed-eyebrow ed-eyebrow--accent" style={{ margin: 0 }}>{b.label}</p>}
        <h3 className="ed-tile__title"><Link href={businessHref(b.business_id)}>{b.name}</Link></h3>
        {(cat || b.address) && <p className="ed-tile__meta" style={{ margin: 0 }}>{[cat, b.address].filter(Boolean).join(" · ")}</p>}
        {b.description && size === "lead" && <p className="ed-tile__desc line-clamp-3">{b.description}</p>}
        {b.offers.length > 0 && (
          <div>
            <p className="ed-eyebrow" style={{ margin: "0.6rem 0 0" }}>Offers for visitors</p>
            <ul className="ed-offers">
              {b.offers.map((o) => (
                <li key={o.offer_id}><b>{offerBadge(o)}</b><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{o.title}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
