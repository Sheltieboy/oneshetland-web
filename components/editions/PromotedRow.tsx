import { PromoLink } from "@/components/editions/PromoTrack";
import { dateRangeLabel } from "@/lib/editions/rules";
import { KIND_LABEL } from "@/lib/editions/types";
import { DISCOVERY_ROW_CAP, type FeaturedEdition } from "@/lib/editions/promo-public";
import { responsiveImage } from "@/lib/editions/images";

/** The "Promoted" row at the top of the Editions list: up to four featured Editions, clearly labelled, taps counted for the discovery surface. Collapses when empty. */
export function PromotedRow({ items }: { items: FeaturedEdition[] }) {
  const list = items.slice(0, DISCOVERY_ROW_CAP);
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="promoted-h">
      <div className="ed-head"><div><p className="ed-eyebrow" aria-hidden="true">Promoted</p><h2 id="promoted-h" className="ed-display ed-h2" style={{ margin: 0 }}>Featured Editions</h2></div></div>
      <ul className="ed-front" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {list.map((e) => (
          <li key={e.edition_id} className="ed-cell ed-rise">
            <PromoLink href={`/editions/${e.slug}`} editionId={e.edition_id} surface="discovery" className="ed-card ed-hover">
              <div className="ed-card__media">
                <div className="ed-img ed-ratio-54">
                  {e.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img {...responsiveImage(e.cover_url, "(min-width: 62rem) 25vw, (min-width: 40rem) 50vw, 100vw")} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <div className="ed-card__field" aria-hidden="true"><b>{e.starts_on.slice(8, 10)}</b></div>
                  )}
                </div>
                <span className="ed-card__tag">Promoted</span>
              </div>
              <div>
                <p className="ed-eyebrow" style={{ margin: 0 }}>{KIND_LABEL[e.kind]}</p>
                <h3 className="ed-card__title" style={{ margin: "0.5rem 0 0" }}><span>{e.title}</span></h3>
                <p className="ed-card__sub" style={{ margin: "0.5rem 0 0" }}>
                  <span className="ed-num" style={{ color: "var(--ed-ink)", fontWeight: 600 }}>{dateRangeLabel(e.starts_on, e.ends_on)}</span>
                  {e.organiser_name && <> · {e.organiser_name}</>}
                </p>
              </div>
            </PromoLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
