import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getEditionBundle, getMyEditionFlags, type PublicEditionBundle, type PublicPartnerEvent, getEditionsEnabled } from "@/lib/editions/data.server";
import { planCtx } from "@/components/editions/plan-ctx";
import { editionMetadata, editionPath, itemEventSchema, mapsUrl, stripMarkup } from "@/lib/editions/seo";
import { breadcrumbSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackView } from "@/components/analytics/TrackView";
import { PlanToggle } from "@/components/editions/SaveButtons";
import { SessionTicketLink } from "@/components/editions/SessionTicketLink";
import { ShareLink } from "@/components/editions/ShareLink";
import { Prose } from "@/components/editions/Prose";
import { dayParts, timeLabel } from "@/lib/editions/rules";
import { businessHref, categoryLabel, eventHref } from "@/lib/editions/partners";
import { itemKey, itemPath, itemSlug, parseItemKey } from "@/lib/editions/session-url";
import { SESSION_KIND_LABEL, type EditionSession, type EditionVenue } from "@/lib/editions/types";

export const dynamic = "force-dynamic";

const isHttps = (u: string | null | undefined): u is string => !!u && /^https:\/\/[^\s<>"']+$/.test(u);
/** Photographs: https only (the database enforces the same); a loopback address is also accepted so the local review stack's own storage shows its uploads. */
const isPhoto = (u: string | null | undefined): u is string => isHttps(u) || (!!u && /^http:\/\/127\.0\.0\.1:\d+\/[^\s<>"']+$/.test(u));

/** One programme item, whichever kind it is: a native session, or an independently owned OneShetland event the owner has agreed to show here. */
type Item = {
  kind: "session" | "event"; id: string; title: string; description: string | null; starts_at: string; ends_at: string | null; status: "scheduled" | "cancelled" | "changed";
  image: string | null; venue: EditionVenue | null; where: string | null; price: string | null; ticket: string | null; presenters: string | null; label: string | null;
  businesses: string[]; session?: EditionSession; event?: PublicPartnerEvent;
};

function buildItems(b: PublicEditionBundle): Item[] {
  const venueById = new Map(b.venues.map((v) => [v.id, v]));
  const sessions: Item[] = b.sessions.map((s) => {
    const v = s.venue_id ? venueById.get(s.venue_id) ?? null : null;
    return {
      kind: "session", id: s.id, title: s.title, description: s.description, starts_at: s.starts_at, ends_at: s.ends_at, status: s.status, image: isPhoto(s.image_url) ? s.image_url : null,
      venue: v, where: v ? [v.name, v.address].filter(Boolean).join(", ") : null, price: s.price_text, ticket: s.ticket_mode === "external" && isHttps(s.ticket_url) ? s.ticket_url : null,
      presenters: s.presenters ?? null, label: SESSION_KIND_LABEL[s.kind], businesses: b.sessionBusinesses[s.id] ?? [], session: s,
    };
  });
  const events: Item[] = b.partners.events.map((e) => ({
    kind: "event", id: e.link_id, title: e.title, description: e.description, starts_at: e.starts_at, ends_at: e.ends_at,
    status: e.status === "cancelled" ? "cancelled" : e.status === "postponed" ? "changed" : "scheduled", image: isPhoto(e.cover_url) ? e.cover_url : null, venue: null,
    where: [e.venue, e.locality].filter(Boolean).join(", ") || null, price: e.price_text, ticket: null, presenters: null, label: e.label ?? "Event", businesses: [], event: e,
  }));
  return [...sessions, ...events].sort((a, z) => a.starts_at.localeCompare(z.starts_at) || a.title.localeCompare(z.title));
}

async function load(slug: string, param: string) {
  const b = await getEditionBundle(slug);
  if (!b) return null;
  const key = parseItemKey(param);
  if (!key) return null;
  const items = buildItems(b);
  const idx = items.findIndex((i) => itemKey(i.id) === key);
  if (idx < 0) return null;
  return { b, items, idx, item: items[idx] };
}

const describe = (it: Item) => {
  const dp = dayParts(it.starts_at);
  const lead = `${dp.weekdayLong} ${dp.day} ${dp.month} ${dp.year}, ${timeLabel(it.starts_at)}${it.where ? `, ${it.where}` : ""}.`;
  const text = `${lead} ${stripMarkup(it.description)}`.trim();
  return text.length <= 200 ? text : `${text.slice(0, 199).trimEnd()}…`;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string; item: string }> }) {
  const { slug, item } = await params;
  const r = await load(slug, item);
  if (!r) return { title: "Programme" };
  return editionMetadata(r.b, { openToEveryone: await getEditionsEnabled(), title: r.item.title, sub: `programme/${itemSlug(r.item.title, r.item.id)}`, description: describe(r.item), image: r.item.image ?? r.b.edition.cover_url });
}

export default async function ProgrammeItemPage({ params }: { params: Promise<{ slug: string; item: string }> }) {
  const { slug, item: param } = await params;
  const r = await load(slug, param);
  if (!r) notFound();
  const { b, items, idx, item: it } = r;
  const { edition } = b;
  const canonical = itemSlug(it.title, it.id);
  if (param !== canonical) permanentRedirect(`/editions/${slug}/programme/${canonical}`);   // a renamed session keeps working from its old link
  const path = itemPath(slug, it);
  const plan = planCtx(edition.id, await getMyEditionFlags(edition.id), path);
  const cancelled = it.status === "cancelled";
  const dp = dayParts(it.starts_at);
  const sameDayEnd = !!it.ends_at && dayParts(it.ends_at).day === dp.day;
  const endParts = it.ends_at ? dayParts(it.ends_at) : null;
  const named = new Set(it.businesses);
  const businesses = b.partners.businesses.filter((x) => named.has(x.link_id));   // shown only while the business's own link is public (its owner's consent)
  const map = it.venue ? mapsUrl(it.venue) : null;
  const osm = it.venue && typeof it.venue.lat === "number" && typeof it.venue.lng === "number" ? `https://www.openstreetmap.org/?mlat=${it.venue.lat}&mlon=${it.venue.lng}#map=17/${it.venue.lat}/${it.venue.lng}` : null;
  const prev = idx > 0 ? items[idx - 1] : null, next = idx < items.length - 1 ? items[idx + 1] : null;
  const performers = it.presenters ? it.presenters.split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean).slice(0, 6) : [];
  const planKind = it.kind;
  const planId = it.kind === "event" ? it.event!.event_id : it.id;
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Editions", path: "/editions" }, { name: edition.title, path: editionPath(slug) }, { name: "Programme", path: editionPath(slug, "programme") }, { name: it.title, path }])} />
      <JsonLd data={itemEventSchema(b, {
        title: it.title, description: it.description, starts_at: it.starts_at, ends_at: it.ends_at, status: it.status, image: it.image, venue: it.venue, locationText: it.venue ? null : it.where,
        ticketUrl: it.ticket ?? (it.kind === "event" ? `https://oneshetland.com${eventHref(it.event!.event_id)}` : null), url: path, performers,
      })} />
      <TrackView event="edition_session_viewed" objectType="edition" objectId={edition.id} extra={{ item: it.id, kind: it.kind }} />
      <article aria-labelledby="item-title" className="ed-section">
        <div className="ed-wrap ed-ev">
          <p className="ed-ev__back"><Link href={editionPath(slug, "programme")} className="ed-arrow"><span aria-hidden="true">←</span> Programme</Link></p>
          <header className="ed-ev__head">
            <p className="ed-row__kind">
              <span className="ed-eyebrow">{it.label}</span>
              {cancelled && <span className="ed-note ed-note--bad">Cancelled</span>}
              {it.status === "changed" && <span className="ed-note ed-note--warn">{it.kind === "event" ? "Postponed" : "Changed: check the details"}</span>}
            </p>
            <h2 id="item-title" className="ed-display ed-h1" style={{ margin: 0 }}>{it.title}</h2>
            <p className="ed-ev__when ed-num">
              <time dateTime={it.starts_at}>{dp.weekdayLong} {dp.day} {dp.month} {dp.year}, {timeLabel(it.starts_at)}</time>
              {it.ends_at && endParts && <> to <time dateTime={it.ends_at}>{sameDayEnd ? timeLabel(it.ends_at) : `${endParts.weekdayLong} ${endParts.day} ${endParts.month}, ${timeLabel(it.ends_at)}`}</time></>}
            </p>
          </header>

          {it.image && (
            <figure className="ed-ev__hero">
              <div className="ed-img"><img src={it.image} alt="" loading="eager" decoding="async" fetchPriority="high" /></div>
            </figure>
          )}

          <div className="ed-ev__grid">
            <div className="ed-ev__main">
              {it.description ? (
                it.kind === "session"
                  ? <div className="ed-prose"><Prose source={it.description} level={3} /></div>
                  : <p className="ed-prose" style={{ whiteSpace: "pre-line" }}>{it.description}</p>
              ) : <p className="ed-muted">More details will be added by the organiser.</p>}
              {it.kind === "event" && (
                <p className="ed-small ed-muted" style={{ maxWidth: "56ch" }}>
                  This event is run by its own organiser on OneShetland, who keeps its details up to date. What you read here is taken from that page.
                </p>
              )}

              {businesses.length > 0 && (
                <section aria-labelledby="item-biz" className="ed-ev__block">
                  <p className="ed-eyebrow" aria-hidden="true">Taking part</p>
                  <h3 id="item-biz" className="ed-display" style={{ margin: "0 0 1rem", fontSize: "var(--t-h3)" }}>Participating businesses</h3>
                  <ul className="ed-ev__biz">
                    {businesses.map((x) => (
                      <li key={x.link_id}>
                        <Link href={businessHref(x.business_id)} className="ed-ev__bizlink">
                          <span className="ed-ev__bizname">{x.name}</span>
                          <span className="ed-small ed-muted">{[x.label, categoryLabel(x.category)].filter(Boolean).join(" · ")}</span>
                          {x.description && <span className="ed-small line-clamp-2">{x.description}</span>}
                          <span className="ed-arrow" aria-hidden="true">View business <span aria-hidden="true">→</span></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <aside aria-label="Details" className="ed-ev__side">
              <dl className="ed-ev__facts">
                <div><dt>When</dt><dd><span className="ed-num">{dp.weekday} {dp.day} {dp.monthShort}, {timeLabel(it.starts_at)}{it.ends_at && sameDayEnd ? ` to ${timeLabel(it.ends_at)}` : ""}</span></dd></div>
                {it.where && (
                  <div>
                    <dt>Where</dt>
                    <dd>
                      <strong>{it.venue?.name ?? it.where}</strong>{it.venue?.address ? <><br />{it.venue.address}</> : null}
                      {(map || osm) && (
                        <span className="ed-ev__maps">
                          {map && <a href={map} target="_blank" rel="noopener noreferrer" className="ed-link">Google Maps<span className="sr-only"> for {it.venue?.name} (opens in a new tab)</span></a>}
                          {osm && <a href={osm} target="_blank" rel="noopener noreferrer" className="ed-link">OpenStreetMap<span className="sr-only"> for {it.venue?.name} (opens in a new tab)</span></a>}
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {it.price && <div><dt>Price</dt><dd><strong>{it.price}</strong></dd></div>}
                {it.presenters && <div><dt>Presented by</dt><dd>{it.presenters}</dd></div>}
              </dl>
              {!cancelled ? (
                <div className="ed-ev__actions">
                  {it.kind === "session" && it.ticket && (
                    <SessionTicketLink href={it.ticket} editionId={edition.id} sessionId={it.id}>
                      Tickets <span aria-hidden="true">↗</span><span className="sr-only"> for {it.title} (the organiser&rsquo;s site, opens in a new tab)</span>
                    </SessionTicketLink>
                  )}
                  {it.kind === "event" && (
                    <Link href={eventHref(it.event!.event_id)} className="ed-btn ed-btn--solid ed-btn--small">
                      {it.event?.has_tickets ? "Details and tickets" : "Event page"} <span aria-hidden="true">→</span><span className="sr-only"> for {it.title} on OneShetland</span>
                    </Link>
                  )}
                  <PlanToggle editionId={plan.editionId} kind={planKind} itemId={planId} title={it.title}
                    initial={it.kind === "event" ? plan.events.has(planId) : plan.sessions.has(planId)} signedIn={plan.signedIn} nextPath={plan.nextPath} />
                  <a href={`${path}/calendar.ics`} className="ed-plan" download>Add to calendar<span className="sr-only"> : {it.title} (downloads a calendar file)</span></a>
                  <ShareLink title={`${it.title} · ${edition.title}`} path={path} />
                </div>
              ) : <p className="ed-small ed-muted">This session has been cancelled.</p>}
            </aside>
          </div>

          <nav aria-label="More of the programme" className="ed-ev__pager">
            {prev ? <Link href={itemPath(slug, prev)} rel="prev" className="ed-ev__pg"><span className="ed-eyebrow">Previous</span><span className="ed-ev__pgt">{prev.title}</span></Link> : <span />}
            {next ? <Link href={itemPath(slug, next)} rel="next" className="ed-ev__pg ed-ev__pg--next"><span className="ed-eyebrow">Next</span><span className="ed-ev__pgt">{next.title}</span></Link> : <span />}
          </nav>
        </div>
      </article>
    </>
  );
}
