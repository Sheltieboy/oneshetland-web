import { notFound } from "next/navigation";
import { getEditionBundle, getMyEditionFlags, getEditionsEnabled } from "@/lib/editions/data.server";
import { planCtx } from "@/components/editions/plan-ctx";
import { editionMetadata, editionPath } from "@/lib/editions/seo";
import { breadcrumbSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackView } from "@/components/analytics/TrackView";
import { ProgrammeByDay } from "@/components/editions/ProgrammeByDay";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getEditionBundle((await params).slug);
  return b ? editionMetadata(b, { openToEveryone: await getEditionsEnabled(), title: "Programme", sub: "programme", description: `The full programme for ${b.edition.title}.` }) : { title: "Programme" };
}

export default async function ProgrammePage({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getEditionBundle((await params).slug);
  if (!b) notFound();
  const { edition, sessions, venues, partners } = b;
  const total = sessions.length + partners.events.length;
  const plan = planCtx(edition.id, await getMyEditionFlags(edition.id), editionPath(edition.slug, "programme"));
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Editions", path: "/editions" }, { name: edition.title, path: editionPath(edition.slug) }, { name: "Programme", path: editionPath(edition.slug, "programme") }])} />
      <TrackView event="edition_session_viewed" objectType="edition" objectId={edition.id} extra={{ sessions: total }} />
      <section aria-labelledby="prog-intro" className="ed-section">
        <div className="ed-wrap">
          <div className="ed-head">
            <div><p className="ed-eyebrow" aria-hidden="true">Day by day</p><h2 id="prog-intro" className="ed-display ed-h1" style={{ margin: 0 }}>Programme</h2></div>
          </div>
          {total === 0 ? (
            <p className="ed-muted" style={{ maxWidth: "56ch" }}>The programme has not been published yet. Check back, or watch the updates for this Edition.</p>
          ) : (
            <ProgrammeByDay sessions={sessions} events={partners.events} venues={venues} editionId={edition.id} editionSlug={edition.slug} plan={plan} />
          )}
        </div>
      </section>
    </>
  );
}
