import Link from "next/link";
import type { PublicPartnerHub } from "@/lib/editions/data.server";
import { hubHref, hubTypeLabel } from "@/lib/editions/partners";
import { responsiveImage } from "@/lib/editions/images";
import type { TileSize } from "./PartnerCard";

const RATIO: Record<TileSize, string> = { lead: "ed-ratio-54", side: "ed-ratio-169", grid: "ed-ratio-43", wide: "ed-ratio-21" };
const HEX = /^#[0-9a-fA-F]{6}$/;
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(new Date(iso)) : null);

/**
 * One participating Hub, set in the Edition's own editorial language (the same tile as a business): its cover, else its logo on a tonal ground, else a monogram, then its name, kind
 * and place, and the events and activities IT chose to show. Everything is read live from the Hub's public profile; the Edition stores nothing about it, and never a member,
 * owner, payout or contact detail. The Hub's own colour appears only as a fine rule above the card, so the Edition's palette stays in charge of the page.
 */
export function HubCard({ h, size = "grid" }: { h: PublicPartnerHub; size?: TileSize }) {
  const meta = [hubTypeLabel(h.type), h.area].filter(Boolean).join(" · ");
  const media = h.cover_url ? (
    <div className={`ed-img ${RATIO[size]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...responsiveImage(h.cover_url, "(min-width: 62rem) 33vw, (min-width: 40rem) 50vw, 100vw")} alt="" loading="lazy" decoding="async" fetchPriority="low" />
    </div>
  ) : h.logo_url ? (
    <div className={`ed-img ed-img--logo ${RATIO[size]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={h.logo_url} alt="" loading="lazy" decoding="async" fetchPriority="low" />
    </div>
  ) : (
    <div className={`ed-img ed-img--mono ${RATIO[size]}`} aria-hidden="true"><span>{h.name.trim().slice(0, 1)}</span></div>
  );
  return (
    <article className={`ed-tile ed-hover ed-rise ed-tile--${size === "lead" ? "lead" : size === "side" ? "side" : "std"}`} data-hub-card="" style={HEX.test(h.brand_color ?? "") ? { borderTop: `3px solid ${h.brand_color}`, paddingTop: "0.9rem" } : undefined}>
      {media}
      <div className="ed-tile__body">
        <p className="ed-eyebrow ed-eyebrow--accent" style={{ margin: 0 }}>{h.label || "Community Hub"}{h.is_verified ? " · Verified" : ""}</p>
        <h3 className="ed-tile__title"><Link href={hubHref({ slug: h.slug, id: h.hub_id })}>{h.name}</Link></h3>
        {meta && <p className="ed-tile__meta" style={{ margin: 0 }}>{meta}</p>}
        {h.description && size !== "grid" && <p className="ed-tile__desc line-clamp-3">{h.description}</p>}
        {h.items.length > 0 && (
          <div>
            <p className="ed-eyebrow" style={{ margin: "0.6rem 0 0" }}>From this Hub</p>
            <ul className="ed-offers">
              {h.items.map((i) => (
                <li key={`${i.kind}-${i.href}`}><b>{i.kind === "event" ? when(i.when) ?? "Event" : "Regular"}</b><span style={{ minWidth: 0, overflowWrap: "anywhere" }}><Link href={i.href}>{i.title}</Link>{i.venue ? `, ${i.venue}` : ""}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
