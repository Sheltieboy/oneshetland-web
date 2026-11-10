import { notFound } from "next/navigation";
import { getEditionBundle, getEditionsEnabled } from "@/lib/editions/data.server";
import { editionMetadata, editionPath } from "@/lib/editions/seo";
import { breadcrumbSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackView } from "@/components/analytics/TrackView";
import { UpdatesList } from "@/components/editions/UpdatesList";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getEditionBundle((await params).slug);
  return b ? editionMetadata(b, { openToEveryone: await getEditionsEnabled(), title: "Updates", sub: "updates", description: `News and updates from ${b.edition.title}.` }) : { title: "Updates" };
}

export default async function UpdatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getEditionBundle((await params).slug);
  if (!b) notFound();
  const { edition, updates } = b;
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Editions", path: "/editions" }, { name: edition.title, path: editionPath(edition.slug) }, { name: "Updates", path: editionPath(edition.slug, "updates") }])} />
      <TrackView event="edition_viewed" objectType="edition" objectId={edition.id} extra={{ page: "updates" }} />
      <section aria-labelledby="upd-h" className="ed-section">
        <div className="ed-wrap">
          <div className="ed-head"><div><p className="ed-eyebrow" aria-hidden="true">From the organisers</p><h2 id="upd-h" className="ed-display ed-h1" style={{ margin: 0 }}>Updates</h2></div></div>
          {updates.length === 0 ? <p className="ed-muted">No updates yet.</p> : <UpdatesList updates={updates} lead />}
        </div>
      </section>
    </>
  );
}
