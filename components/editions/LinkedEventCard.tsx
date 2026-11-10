import Link from "next/link";
import type { PublicPartnerEvent } from "@/lib/editions/data.server";
import { dayParts, timeLabel } from "@/lib/editions/rules";
import { eventHref } from "@/lib/editions/partners";
import { itemPath } from "@/lib/editions/session-url";
import { PlanToggle } from "./SaveButtons";
import type { PlanCtx } from "./plan-ctx";

/** An independently owned event that its owner has agreed to show in this Edition, set as a programme row. Details and tickets stay on the event's own page. */
export function LinkedEventCard({ e, plan, showDate = false, editionSlug }: { e: PublicPartnerEvent; plan?: PlanCtx; showDate?: boolean; editionSlug?: string }) {
  const page = editionSlug ? itemPath(editionSlug, { title: e.title, id: e.link_id }) : null;
  const cancelled = e.status === "cancelled";
  const off = cancelled ? "Cancelled" : e.status === "postponed" ? "Postponed" : null;
  const dp = dayParts(e.starts_at);
  return (
    <article className={`ed-row${cancelled ? " ed-row--off" : ""}`}>
      <div className="ed-row__when">
        {showDate && <span className="ed-row__day">{dp.weekday} {dp.day} {dp.monthShort}</span>}
        <time dateTime={e.starts_at} className="ed-row__time">{timeLabel(e.starts_at)}</time>
        {e.ends_at && <span className="ed-small ed-muted ed-num">to {timeLabel(e.ends_at)}</span>}
      </div>
      <div style={{ minWidth: 0 }}>
        <p className="ed-row__kind">
          <span className="ed-eyebrow">Event</span>
          {e.label && <span className="ed-eyebrow ed-eyebrow--accent">{e.label}</span>}
          {off && <span className="ed-note ed-note--bad">{off}</span>}
        </p>
        <h3 className="ed-row__title"><Link href={page ?? eventHref(e.event_id)}>{e.title}</Link></h3>
        {e.description && <p className="ed-row__desc line-clamp-3">{e.description}</p>}
        <p className="ed-row__foot">
          {[e.venue, e.locality].filter(Boolean).length > 0 && <span><strong>{[e.venue, e.locality].filter(Boolean).join(", ")}</strong></span>}
          {e.price_text && <strong>{e.price_text}</strong>}
        </p>
        {!cancelled && (
          <div className="ed-row__act">
            {page && <Link href={page} className="ed-arrow">Details<span className="sr-only"> for {e.title} in this Edition</span> <span aria-hidden="true">→</span></Link>}
            <Link href={eventHref(e.event_id)} className="ed-arrow">
              {e.has_tickets ? "Details and tickets" : "Event details"}<span className="sr-only"> for {e.title}</span> <span aria-hidden="true">→</span>
            </Link>
            {plan && <PlanToggle editionId={plan.editionId} kind="event" itemId={e.event_id} title={e.title} initial={plan.events.has(e.event_id)} signedIn={plan.signedIn} nextPath={plan.nextPath} />}
          </div>
        )}
      </div>
    </article>
  );
}
