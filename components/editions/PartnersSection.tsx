import Link from "next/link";
import type { PublicPartnerBusiness, PublicPartners } from "@/lib/editions/data.server";
import { activityHref, categoryLabel } from "@/lib/editions/partners";
import { PartnerCard, type TileSize } from "./PartnerCard";

/** The size of tile i of n: a lead and two beside it, then an even grid. Two partners share a row; one stands alone, wide. Gives the spread its rhythm. */
function sizeOf(i: number, n: number): TileSize {
  if (n === 1) return "wide";
  if (n === 2) return "side";
  return i === 0 ? "lead" : i <= 2 ? "side" : "grid";
}

/** "Taking part": participating businesses and regular activities. Events appear in the programme instead. `limit` trims the home-page teaser. */
export function PartnersSection({ partners, limit, moreHref, headingLevel = 2 }: { partners: PublicPartners; accent?: string; limit?: number; moreHref?: string; headingLevel?: 2 | 3 }) {
  const { businesses, activities } = partners;
  if (businesses.length === 0 && activities.length === 0) return null;
  // A spread leads with photographs: businesses with a cover come first, then a logo, then neither (each group keeps the organiser's own order).
  const weight = (b: PublicPartnerBusiness) => (b.cover_url ? 2 : b.logo_url ? 1 : 0);
  const ordered = [...businesses].sort((a, b) => weight(b) - weight(a) || a.position - b.position);
  const shown = limit ? ordered.slice(0, limit) : ordered;
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby="edition-partners">
      <div className="ed-head">
        <div>
          <p className="ed-eyebrow" aria-hidden="true">The neighbourhood</p>
          <H id="edition-partners" className="ed-display ed-h2" style={{ margin: 0 }}>Taking part</H>
          <p style={{ margin: "0.9rem 0 0", maxWidth: "46ch" }} className="ed-muted">Local businesses that have chosen to be part of this Edition.</p>
        </div>
        {limit && moreHref && businesses.length > limit && <Link href={moreHref} className="ed-arrow">See everyone taking part ({businesses.length}) <span aria-hidden="true">→</span></Link>}
      </div>
      {shown.length > 0 && (
        <ul className="ed-spread" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {shown.map((b, i) => {
            const size = sizeOf(i, shown.length);
            const cls = size === "wide" ? "ed-tile--wide" : size === "lead" ? "ed-tile--lead" : size === "side" ? (shown.length === 2 ? "ed-tile--half" : "ed-tile--side") : "ed-tile";
            return <li key={b.link_id} className={cls} style={{ minWidth: 0 }}><PartnerCard b={b} size={size} /></li>;
          })}
        </ul>
      )}
      {activities.length > 0 && (
        <div style={{ marginTop: "clamp(2.5rem, 6vw, 4.5rem)" }}>
          <H className="ed-display ed-h3" style={{ margin: "0 0 1.25rem" }}>Regular activities</H>
          <ul className="ed-actlist">
            {activities.map((a) => (
              <li key={a.link_id}>
                <p className="ed-eyebrow" style={{ margin: 0 }}>{categoryLabel(a.category) || "Activity"}{a.label ? ` · ${a.label}` : ""}</p>
                <p className="ed-tile__title" style={{ margin: "0.3rem 0 0", fontSize: "1.45rem" }}><Link href={activityHref(a.slug)}>{a.title}</Link></p>
                <p className="ed-tile__meta" style={{ margin: "0.25rem 0 0" }}>{[a.venue, a.locality].filter(Boolean).join(", ")}{a.price_text ? ` · ${a.price_text}` : ""}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
