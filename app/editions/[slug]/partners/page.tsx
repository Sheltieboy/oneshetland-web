import { notFound } from "next/navigation";
import { getEditionBundle } from "@/lib/editions/data.server";
import { editionMetadata, editionPath } from "@/lib/editions/seo";
import { breadcrumbSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackView } from "@/components/analytics/TrackView";
import { PartnersSection } from "@/components/editions/PartnersSection";
import { SponsorStrip } from "@/components/editions/SponsorStrip";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getEditionBundle((await params).slug);
  return b ? editionMetadata(b, { title: "Partners", sub: "partners", description: `The businesses, Hubs and sponsors taking part in ${b.edition.title}.` }) : { title: "Partners" };
}

export default async function PartnersPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getEditionBundle((await params).slug);
  if (!b) notFound();
  const { edition, partners, sponsors } = b;
  const empty = partners.businesses.length + partners.activities.length + partners.hubs.length + sponsors.length === 0;
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Editions", path: "/editions" }, { name: edition.title, path: editionPath(edition.slug) }, { name: "Partners", path: editionPath(edition.slug, "partners") }])} />
      <TrackView event="edition_viewed" objectType="edition" objectId={edition.id} extra={{ page: "partners" }} />
      {empty && (
        <section aria-labelledby="partners-h" className="ed-section">
          <div className="ed-wrap">
            <h2 id="partners-h" className="ed-display ed-h1" style={{ margin: 0 }}>Partners</h2>
            <p className="ed-muted" style={{ maxWidth: "56ch" }}>Businesses, Hubs and sponsors will appear here as they join this Edition.</p>
          </div>
        </section>
      )}
      {!empty && (
        <div className="ed-section">
          <div className="ed-wrap" style={{ display: "grid", gap: "var(--ed-section)" }}>
            <PartnersSection partners={partners} />
            <SponsorStrip sponsors={sponsors} />
          </div>
        </div>
      )}
    </>
  );
}
