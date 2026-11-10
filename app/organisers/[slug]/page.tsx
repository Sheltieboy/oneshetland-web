import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicOrganiser, getEditionsEnabled } from "@/lib/editions/data.server";
import { phaseOf } from "@/lib/editions/rules";
import { deriveBrand, resolveBrand } from "@/lib/editions/brand";
import { getPublicTiers } from "@/lib/editions/commerce.server";
import { tierPriceText } from "@/lib/editions/commerce";
import { organiserSchema, stripMarkup } from "@/lib/editions/seo";
import { breadcrumbSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { Prose } from "@/components/editions/Prose";
import { ArchiveRow, EditionCard } from "@/components/editions/EditionCard";
import { DemoBanner } from "@/components/editions/DemoBanner";
import { BrandScope } from "@/components/editions/editorial/BrandScope";
import { Masthead, Plate } from "@/components/editions/editorial/Masthead";
import { EditionFooter } from "@/components/editions/editorial/EditionFooter";
import { PreviewBanner } from "@/components/editions/PreviewBanner";

export const dynamic = "force-dynamic";
const load = cache(getPublicOrganiser);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const r = await load((await params).slug);
  if (!r) return { title: "Organiser not found" };
  const { organiser: o } = r;
  const description = stripMarkup(o.tagline) || stripMarkup(o.description).slice(0, 200) || `Editions run by ${o.name} on OneShetland.`;
  const indexable = o.status === "verified" && !o.is_test && (await getEditionsEnabled());   // pilot pages are direct-link only
  return {
    title: o.name, description, alternates: { canonical: `/organisers/${o.slug}` },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: { title: o.name, description, url: `/organisers/${o.slug}`, siteName: "OneShetland", type: "website" },
  };
}

export default async function OrganiserPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await load(slug);
  if (!r) notFound();
  const { organiser: o, editions, parent } = r;
  const rb = resolveBrand(null, o);
  const brand = deriveBrand(rb.color);
  const tiers = await getPublicTiers(o.slug);
  const upcoming = editions.filter((e) => phaseOf(e) !== "ended").sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const past = editions.filter((e) => phaseOf(e) === "ended");
  const preview = o.status !== "verified" ? "This organiser is not verified yet." : o.is_test ? "This is a test organiser and is never shown to the public." : null;
  const listed = { name: o.name, slug: o.slug, logo_url: o.logo_url, brand_color: o.brand_color, cover_url: o.cover_url, cover_focus: o.cover_focus };
  const lowest = tiers.filter((t) => !t.full).slice(0, 3);
  return (
    <BrandScope brand={brand}>
      <DemoBanner />
      <JsonLd data={[organiserSchema(o, editions), breadcrumbSchema([{ name: "Editions", path: "/editions" }, { name: o.name, path: `/organisers/${o.slug}` }])]} />
      <PreviewBanner reason={preview ? { text: preview } : null} subject="organiser page" />
      <Masthead
        title={o.name}
        eyebrow={o.status === "verified" ? "Verified organiser" : "Organiser"}
        line={o.tagline}
        ghost={o.name.trim().slice(0, 1).toUpperCase()}
        cover={rb.cover}
        focus={rb.focus}
        backHref="/editions"
        plate={<Plate name={o.name} logo={rb.logo} label="Organiser" textless />}
        cta={tiers.length > 0 ? <Link href={`/organisers/${o.slug}/membership`} className="ed-btn ed-btn--light">Membership for businesses</Link> : undefined}
        short={upcoming.length === 0 && !o.cover_url}
      />

      {(o.description || o.website) && (
        <section aria-labelledby="about-h" className="ed-section">
          <div className="ed-wrap ed-intro">
            <div className="ed-intro__side">
              <h2 id="about-h" className="ed-eyebrow ed-eyebrow--accent" style={{ margin: 0 }}>About</h2>
              {o.website?.startsWith("https://") && (
                <a href={o.website} target="_blank" rel="noopener noreferrer" className="ed-arrow">
                  Website<span className="sr-only"> of {o.name} (opens in a new tab)</span> <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
            <div style={{ minWidth: 0 }}><Prose source={o.description} level={3} dropcap /></div>
          </div>
        </section>
      )}

      <section aria-labelledby="eds-h" className={`ed-section ${o.description || o.website ? "ed-section--band" : ""}`.trim()}>
        <div className="ed-wrap" style={{ display: "grid", gap: "var(--ed-section)" }}>
          <div>
            <div className="ed-head"><div><p className="ed-eyebrow" aria-hidden="true">What we run</p><h2 id="eds-h" className="ed-display ed-h2" style={{ margin: 0 }}>Editions</h2></div></div>
            {editions.length === 0 && <p className="ed-muted">No Editions are published at the moment.</p>}
            {upcoming.length > 0 && (
              <ul className="ed-front" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {upcoming.map((e, i) => <li key={e.id} className={`ed-cell${i === 0 ? " ed-cell--lead" : ""} ed-rise`}><EditionCard edition={e} organiser={listed} lead={i === 0} /></li>)}
              </ul>
            )}
          </div>
          {past.length > 0 && (
            <div>
              <div className="ed-head"><div><p className="ed-eyebrow" aria-hidden="true">The archive</p><h3 className="ed-display ed-h3" style={{ margin: 0 }}>Past Editions</h3></div></div>
              <ul className="ed-archive">{past.map((e) => <ArchiveRow key={e.id} edition={e} organiser={listed} />)}</ul>
            </div>
          )}
        </div>
      </section>

      {lowest.length > 0 && (
        <section aria-labelledby="mem-h" className="ed-section ed-section--deep">
          <div className="ed-wrap ed-intro">
            <div className="ed-intro__side">
              <p className="ed-eyebrow" style={{ margin: 0 }}>For local businesses</p>
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 id="mem-h" className="ed-display ed-h1" style={{ margin: 0 }}>Join {o.name}</h2>
              <p className="ed-lede ed-display" style={{ margin: "1.25rem 0 0", maxWidth: "26ch", color: "color-mix(in srgb, var(--ed-on-deep) 88%, transparent)" }}>Be part of every Edition, and stay in full control of your own listing.</p>
              <ul className="ed-checks" style={{ margin: "2rem 0", maxWidth: "34rem" }}>
                {lowest.map((t) => <li key={t.tier_id} style={{ color: "var(--ed-on-deep)" }}><strong>{t.name}</strong>, {tierPriceText(t).toLowerCase()}</li>)}
              </ul>
              <Link href={`/organisers/${o.slug}/membership`} className="ed-btn ed-btn--light">See memberships</Link>
            </div>
          </div>
        </section>
      )}

      <EditionFooter organiser={o} hub={parent ? { name: parent.name, href: parent.href } : null} links={[{ href: "/editions", label: "All Editions" }, ...(o.website?.startsWith("https://") ? [{ href: o.website, label: "Website" }] : [])]} />
    </BrandScope>
  );
}
