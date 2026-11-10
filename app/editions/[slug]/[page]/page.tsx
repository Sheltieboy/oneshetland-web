import { notFound, redirect } from "next/navigation";
import { getEditionBundle } from "@/lib/editions/data.server";
import { editionMetadata, editionPath } from "@/lib/editions/seo";
import { breadcrumbSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackView } from "@/components/analytics/TrackView";
import { Prose } from "@/components/editions/Prose";
import { SponsorStrip } from "@/components/editions/SponsorStrip";

export const dynamic = "force-dynamic";

/** "partners" (also "sponsors") is a built-in page: the sponsor list. Every other reserved slug is not an organiser page, so it is a 404 here. */
const PARTNER_SLUGS = ["partners", "sponsors"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string; page: string }> }) {
  const { slug, page } = await params;
  const b = await getEditionBundle(slug);
  if (!b) return { title: "Edition not found" };
  if (PARTNER_SLUGS.includes(page)) return editionMetadata(b, { title: "Partners", sub: page, description: `Partners and sponsors of ${b.edition.title}.` });
  const p = b.pages.find((x) => x.slug === page);
  return p ? editionMetadata(b, { title: p.title, sub: p.slug }) : { title: "Page not found" };
}

export default async function EditionPageRoute({ params }: { params: Promise<{ slug: string; page: string }> }) {
  const { slug, page } = await params;
  const b = await getEditionBundle(slug);
  if (!b) notFound();
  const { edition, pages, sponsors } = b;
  const crumbs = [{ name: "Editions", path: "/editions" }, { name: edition.title, path: editionPath(edition.slug) }];

  if (PARTNER_SLUGS.includes(page)) {
    if (sponsors.length === 0) notFound();
    return (
      <>
        <JsonLd data={breadcrumbSchema([...crumbs, { name: "Partners", path: editionPath(edition.slug, page) }])} />
        <TrackView event="edition_viewed" objectType="edition" objectId={edition.id} extra={{ page: "partners" }} />
        <div className="ed-section"><div className="ed-wrap"><SponsorStrip sponsors={sponsors} /></div></div>
      </>
    );
  }

  const p = pages.find((x) => x.slug === page);
  if (!p) notFound();
  if (p.is_home) redirect(editionPath(edition.slug));
  return (
    <>
      <JsonLd data={breadcrumbSchema([...crumbs, { name: p.title, path: editionPath(edition.slug, p.slug) }])} />
      <TrackView event="edition_viewed" objectType="edition" objectId={edition.id} extra={{ page: "page" }} />
      <article aria-labelledby="page-h" className="ed-section">
        <div className="ed-wrap ed-intro">
          <div className="ed-intro__side"><p className="ed-eyebrow ed-eyebrow--accent" style={{ margin: 0 }}>{p.nav_label}</p></div>
          <div style={{ minWidth: 0 }}>
            <h2 id="page-h" className="ed-display ed-h1" style={{ margin: 0 }}>{p.title}</h2>
            <Prose source={p.body} level={3} dropcap className="mt-8" />
          </div>
        </div>
      </article>
    </>
  );
}
