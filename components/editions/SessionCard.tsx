import { dayParts, timeLabel } from "@/lib/editions/rules";
import Link from "next/link";
import { mapsUrl } from "@/lib/editions/seo";
import { itemPath } from "@/lib/editions/session-url";
import { SESSION_KIND_LABEL, type EditionSession, type EditionVenue } from "@/lib/editions/types";
import { SessionTicketLink } from "./SessionTicketLink";
import { PlanToggle } from "./SaveButtons";
import type { PlanCtx } from "./plan-ctx";

const isHttps = (u: string | null | undefined): u is string => !!u && /^https:\/\/[^\s<>"']+$/.test(u);

/**
 * One programme entry, set as a typographic row (time, title, place) rather than a box. Cancelled sessions stay visible, struck through, so nobody travels for
 * nothing. `showDate` adds the day above the time (used where days are not grouped, e.g. the overview's "Next up").
 */
export function SessionCard({ session: s, venue, editionId, editionSlug, showDate = false, plan }: {
  session: EditionSession; venue?: EditionVenue | null; editionId: string; editionSlug?: string; showDate?: boolean; plan?: PlanCtx;
}) {
  const href = editionSlug ? itemPath(editionSlug, s) : null;
  const cancelled = s.status === "cancelled";
  const map = venue ? mapsUrl(venue) : null;
  const dp = dayParts(s.starts_at);
  return (
    <article className={`ed-row${cancelled ? " ed-row--off" : ""}`}>
      <div className="ed-row__when">
        {showDate && <span className="ed-row__day">{dp.weekday} {dp.day} {dp.monthShort}</span>}
        <time dateTime={s.starts_at} className="ed-row__time">{timeLabel(s.starts_at)}</time>
        {s.ends_at && <span className="ed-small ed-muted ed-num">to {timeLabel(s.ends_at)}</span>}
      </div>
      <div style={{ minWidth: 0 }}>
        <p className="ed-row__kind">
          <span className="ed-eyebrow">{SESSION_KIND_LABEL[s.kind]}</span>
          {cancelled && <span className="ed-note ed-note--bad">Cancelled</span>}
          {s.status === "changed" && <span className="ed-note ed-note--warn">Changed: check the details</span>}
        </p>
        <h3 className="ed-row__title">{href ? <Link href={href}>{s.title}</Link> : s.title}</h3>
        {s.description && <p className="ed-row__desc" style={{ whiteSpace: "pre-line" }}>{s.description}</p>}
        {(venue || s.price_text) && (
          <p className="ed-row__foot">
            {venue && (
              <span>
                <strong>{venue.name}</strong>{venue.address ? `, ${venue.address}` : ""}
                {map && (
                  <>
                    {" "}
                    <a href={map} target="_blank" rel="noopener noreferrer" className="ed-link">Map<span className="sr-only"> for {venue.name} (opens in a new tab)</span></a>
                  </>
                )}
              </span>
            )}
            {s.price_text && <strong>{s.price_text}</strong>}
          </p>
        )}
        {(href || (!cancelled && s.ticket_mode === "external" && isHttps(s.ticket_url)) || (plan && !cancelled)) && (
          <div className="ed-row__act">
            {href && <Link href={href} className="ed-arrow">Details<span className="sr-only"> for {s.title}</span> <span aria-hidden="true">→</span></Link>}
            {!cancelled && s.ticket_mode === "external" && isHttps(s.ticket_url) && (
              <SessionTicketLink href={s.ticket_url} editionId={editionId} sessionId={s.id}>
                Tickets <span aria-hidden="true">↗</span><span className="sr-only"> for {s.title} (the organiser&rsquo;s site, opens in a new tab)</span>
              </SessionTicketLink>
            )}
            {plan && !cancelled && <PlanToggle editionId={plan.editionId} kind="session" itemId={s.id} title={s.title} initial={plan.sessions.has(s.id)} signedIn={plan.signedIn} nextPath={plan.nextPath} />}
          </div>
        )}
      </div>
    </article>
  );
}
