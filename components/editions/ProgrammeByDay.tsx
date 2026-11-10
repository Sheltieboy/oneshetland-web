import { dayParts, groupSessionsByDay } from "@/lib/editions/rules";
import type { EditionSession, EditionVenue } from "@/lib/editions/types";
import type { PublicPartnerEvent } from "@/lib/editions/data.server";
import { SessionCard } from "./SessionCard";
import { LinkedEventCard } from "./LinkedEventCard";
import type { PlanCtx } from "./plan-ctx";

const EV = "ev:";
/** An independently owned event is grouped by the same day logic as a session; it is drawn by its own card. */
const asSession = (e: PublicPartnerEvent, editionId: string): EditionSession => ({
  id: `${EV}${e.link_id}`, edition_id: editionId, title: e.title, description: null, starts_at: e.starts_at, ends_at: e.ends_at, venue_id: null, kind: "event",
  ticket_mode: "none", ticket_url: null, price_text: null, status: "scheduled", position: e.position
});

/**
 * The programme, one real <h2> per Europe/London day. Each day is set as a large numeral beside (on a wide screen: sticking beside) its rows, so a long
 * programme always shows which day you are in. With several days a row of jump links sits on top.
 */
export function ProgrammeByDay({ sessions, events = [], venues, editionId, editionSlug, plan }: { sessions: EditionSession[]; events?: PublicPartnerEvent[]; venues: EditionVenue[]; editionId: string; editionSlug?: string; plan?: PlanCtx }) {
  const evByKey = new Map(events.map((e) => [`${EV}${e.link_id}`, e]));
  const days = groupSessionsByDay([...sessions, ...events.map((e) => asSession(e, editionId))]);
  const byId = new Map(venues.map((v) => [v.id, v]));
  return (
    <div>
      {days.length > 1 && (
        <nav aria-label="Jump to a day">
          <ul className="ed-days">
            {days.map((d) => { const p = dayParts(d.day); return <li key={d.day}><a href={`#day-${d.day}`}>{p.weekday} {p.day} {p.monthShort}</a></li>; })}
          </ul>
        </nav>
      )}
      <div>
        {days.map((d) => {
          const p = dayParts(d.day);
          return (
            <section key={d.day} id={`day-${d.day}`} aria-labelledby={`h-${d.day}`} className="ed-day ed-rise">
              <h2 id={`h-${d.day}`} className="ed-day__label" style={{ margin: 0 }}>
                <span className="sr-only">{d.label}</span>
                <span className="ed-day__num" aria-hidden="true">{p.day}</span>
                <span className="ed-day__name" aria-hidden="true">{p.weekdayLong}<br />{p.month}</span>
              </h2>
              <ol className="ed-agenda">
                {d.items.map((s) => (
                  <li key={s.id}>
                    {evByKey.has(s.id) ? <LinkedEventCard e={evByKey.get(s.id)!} plan={plan} editionSlug={editionSlug} />
                      : <SessionCard session={s} venue={s.venue_id ? byId.get(s.venue_id) : null} editionId={editionId} editionSlug={editionSlug} plan={plan} />}
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
