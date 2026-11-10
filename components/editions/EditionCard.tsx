import Link from "next/link";
import type { CSSProperties } from "react";
import type { ListedOrganiser } from "@/lib/editions/data.server";
import { deriveBrand, resolveBrand } from "@/lib/editions/brand";
import { dateRangeLabel, PHASE_LABEL, phaseOf } from "@/lib/editions/rules";
import { stripMarkup } from "@/lib/editions/seo";
import { KIND_LABEL, type Edition } from "@/lib/editions/types";
import { responsiveImage } from "@/lib/editions/images";

/**
 * An Edition in a listing. The artwork carries the Edition's own brand (its photograph, or a deep tonal field with the start day as an outline numeral); the words
 * stay in the page's neutral type so a row of different Editions reads as a family. The whole card is one link. `lead` sets it at feature scale.
 */
export function EditionCard({ edition: e, organiser, lead = false }: { edition: Edition; organiser?: ListedOrganiser | null; lead?: boolean }) {
  const rb = resolveBrand(e, { brand_color: organiser?.brand_color ?? null, logo_url: organiser?.logo_url ?? null, cover_url: organiser?.cover_url ?? null, cover_focus: organiser?.cover_focus ?? null });
  const brand = deriveBrand(rb.color);
  const phase = phaseOf(e);
  const blurb = stripMarkup(e.summary);
  return (
    <Link href={`/editions/${e.slug}`} className={`ed-card ed-hover ${lead ? "ed-card--lead" : ""}`.trim()}>
      <div className="ed-card__media" style={brand.vars as CSSProperties}>
        <div className={`ed-img ${lead ? "ed-ratio-169" : "ed-ratio-54"}`}>
          {rb.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...responsiveImage(rb.cover, "(min-width: 62rem) 33vw, (min-width: 40rem) 50vw, 100vw")} alt="" loading="lazy" decoding="async" fetchPriority={lead ? "auto" : "low"} style={{ objectPosition: rb.focus }} />
          ) : (
            <div className="ed-card__field" aria-hidden="true"><b>{e.starts_on.slice(8, 10)}</b></div>
          )}
        </div>
        <span className="ed-card__tag">{PHASE_LABEL[phase]}</span>
      </div>
      <div>
        <p className="ed-eyebrow" style={{ margin: 0 }}>{[e.year_label, KIND_LABEL[e.kind]].filter(Boolean).join(" · ")}</p>
        <h3 className="ed-card__title" style={{ margin: "0.5rem 0 0" }}><span>{e.title}</span></h3>
        <p className="ed-card__sub" style={{ margin: "0.5rem 0 0" }}>
          <span className="ed-num" style={{ color: "var(--ed-ink)", fontWeight: 600 }}>{dateRangeLabel(e.starts_on, e.ends_on)}</span>
          {organiser?.name && <> · {organiser.name}</>}
        </p>
        {blurb && lead && <p className="ed-card__sum line-clamp-3" style={{ margin: "0.9rem 0 0" }}>{blurb}</p>}
      </div>
    </Link>
  );
}

/** A past Edition as one quiet line in the archive. */
export function ArchiveRow({ edition: e, organiser }: { edition: Edition; organiser?: ListedOrganiser | null }) {
  return (
    <li>
      <Link href={`/editions/${e.slug}`} className="ed-hover">
        <span className="ed-eyebrow ed-num">{dateRangeLabel(e.starts_on, e.ends_on)}</span>
        <span className="ed-card__title"><span>{e.title}</span></span>
        <span className="ed-card__sub">{[e.year_label, organiser?.name].filter(Boolean).join(" · ")}</span>
      </Link>
    </li>
  );
}
