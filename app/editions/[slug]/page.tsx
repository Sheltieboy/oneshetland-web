import Link from "next/link";
import { notFound } from "next/navigation";
import { getEditionBundle, getMyEditionFlags, getEditionsEnabled } from "@/lib/editions/data.server";
import { planCtx } from "@/components/editions/plan-ctx";
import { dateRangeLabel, dayParts } from "@/lib/editions/rules";
import { editionMetadata, editionPath, editionSchema, mapsUrl } from "@/lib/editions/seo";
import { breadcrumbSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackView } from "@/components/analytics/TrackView";
import { Prose } from "@/components/editions/Prose";
import { SessionCard } from "@/components/editions/SessionCard";
import { Journal } from "@/components/editions/Journal";
import { SponsorStrip } from "@/components/editions/SponsorStrip";
import { PartnersSection } from "@/components/editions/PartnersSection";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getEditionBundle((await params).slug);
  return b ? editionMetadata(b, { openToEveryone: await getEditionsEnabled() }) : { title: "Edition not found" };
}

export default async function EditionHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getEditionBundle(slug);
  if (!b) notFound();
  const { edition, pages, sessions, venues, updates, sponsors, partners } = b;
  const home = pages.find((p) => p.is_home);
  const now = Date.now();
  const nextUp = sessions.filter((s) => s.status !== "cancelled" && Date.parse(s.ends_at ?? s.starts_at) >= now).slice(0, 3);
  const venueById = new Map(venues.map((v) => [v.id, v]));
  const plan = planCtx(edition.id, await getMyEditionFlags(edition.id), editionPath(edition.slug));
  const base = editionPath(edition.slug);
  const programmeCount = sessions.length + partners.events.length;
  const takingPart = partners.businesses.length + partners.activities.length + partners.hubs.length;

  // "At a glance": only the facts this Edition actually has.
  const s0 = dayParts(edition.starts_on), s1 = dayParts(edition.ends_on);
  const single = edition.starts_on === edition.ends_on;
  const facts: { label: string; value: string; note?: string }[] = [
    { label: "When", value: single ? s0.day : `${s0.day}\u2013${s1.day}`, note: single ? `${s0.weekdayLong} ${s0.month} ${s0.year}` : s0.month === s1.month ? `${s0.month} ${s0.year}` : `${s0.monthShort} to ${s1.monthShort} ${s1.year}` },
    ...(venues.length > 0 ? [{ label: "Where", value: String(venues.length), note: venues.slice(0, 2).map((v) => v.name).join(" · ") }] : []),
    ...(programmeCount > 0 ? [{ label: "Programme", value: String(programmeCount), note: programmeCount === 1 ? "event" : "events, talks and sessions" }] : []),
    ...(takingPart > 0 ? [{ label: "Taking part", value: String(takingPart), note: partners.hubs.length > 0 ? "local businesses, Hubs and activities" : "local businesses and activities" }] : []),
  ];

  return (
    <>
      <JsonLd data={[editionSchema(b), breadcrumbSchema([{ name: "Editions", path: "/editions" }, { name: edition.title, path: base }])]} />
      <TrackView event="edition_viewed" objectType="edition" objectId={edition.id} extra={{ page: "home" }} />

      <section aria-labelledby="edition-about" className="ed-section">
        <div className="ed-wrap ed-intro">
          <div className="ed-intro__side">
            <h2 id="edition-about" className="ed-eyebrow ed-eyebrow--accent" style={{ margin: 0 }}>{home ? "The Edition" : "About this Edition"}</h2>
            <p className="ed-intro__dates" style={{ margin: 0 }}>{dateRangeLabel(edition.starts_on, edition.ends_on)}</p>
          </div>
          <div style={{ minWidth: 0 }}>
            {home ? (
              <>
                <p className="ed-display ed-lede" style={{ margin: 0 }}>{home.title}</p>
                <Prose source={home.body} level={3} dropcap className="mt-8" />
              </>
            ) : (
              <>
                {edition.summary && <p className="ed-display ed-lede" style={{ margin: 0 }}>{edition.summary}</p>}
                <Prose source={edition.description} level={3} dropcap={!!edition.summary} className={edition.summary ? "mt-8" : ""} />
                {!edition.summary && !edition.description && <p className="ed-muted">The organiser has not added a description yet.</p>}
              </>
            )}
          </div>
        </div>
      </section>

      <div className="ed-wrap ed-rise" style={{ paddingBottom: "var(--ed-section)" }}>
        <h2 className="sr-only">At a glance</h2>
        <dl className="ed-facts" style={{ ["--cols" as string]: facts.length }}>
          {facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}{f.note && <small>{f.note}</small>}</dd></div>)}
        </dl>
      </div>

      {nextUp.length > 0 && (
        <section aria-labelledby="edition-next" className="ed-section ed-section--band">
          <div className="ed-wrap">
            <div className="ed-head">
              <div><p className="ed-eyebrow" aria-hidden="true">Coming up</p><h2 id="edition-next" className="ed-display ed-h2" style={{ margin: 0 }}>Next up</h2></div>
              <Link href={`${base}/programme`} className="ed-arrow">See the full programme <span aria-hidden="true">→</span></Link>
            </div>
            <ol className="ed-agenda">
              {nextUp.map((s) => (
                <li key={s.id}><SessionCard session={s} venue={s.venue_id ? venueById.get(s.venue_id) : null} editionId={edition.id} editionSlug={edition.slug} showDate plan={plan} /></li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {takingPart > 0 && (
        <div className="ed-section"><div className="ed-wrap"><PartnersSection partners={partners} limit={3} moreHref={`${base}/partners`} /></div></div>
      )}

      <Journal updates={updates} base={base} total={updates.length} />

      {sponsors.length > 0 && <div className="ed-section"><div className="ed-wrap"><SponsorStrip sponsors={sponsors} /></div></div>}

      <section aria-labelledby="edition-where" className="ed-section ed-section--deep">
        <div className="ed-wrap">
          <div className="ed-head">
            <div><p className="ed-eyebrow" aria-hidden="true">Finding your way</p><h2 id="edition-where" className="ed-display ed-h2" style={{ margin: 0 }}>Where</h2></div>
            {programmeCount > 0 && <Link href={`${base}/programme`} className="ed-arrow" style={{ color: "var(--ed-on-deep)" }}>Programme ({programmeCount}) <span aria-hidden="true">→</span></Link>}
          </div>
          {venues.length > 0 ? (
            <ul className="ed-venues">
              {venues.map((v) => (
                <li key={v.id}>
                  <strong>{v.name}</strong>
                  {v.address && <span style={{ display: "block", marginTop: "0.35rem", opacity: 0.85 }}>{v.address}</span>}
                  {mapsUrl(v) && (
                    <a href={mapsUrl(v)!} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: "2.75rem" }}>
                      Open in maps<span className="sr-only"> for {v.name} (opens in a new tab)</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, opacity: 0.9 }}>Venues will be listed with the programme.</p>
          )}
        </div>
      </section>
    </>
  );
}
