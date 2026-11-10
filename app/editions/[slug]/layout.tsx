import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEditionBundle, getEditionsEnabled, getMyEditionFlags } from "@/lib/editions/data.server";
import { SaveEditionButton } from "@/components/editions/SaveButtons";
import { CalendarLink } from "@/components/editions/CalendarLink";
import { navFor, phaseOf } from "@/lib/editions/rules";
import { getPublicTiers } from "@/lib/editions/commerce.server";
import { deriveBrand, resolveBrand } from "@/lib/editions/brand";
import { BrandScope } from "@/components/editions/editorial/BrandScope";
import { EditionFooter } from "@/components/editions/editorial/EditionFooter";
import { DemoBanner } from "@/components/editions/DemoBanner";
import { HeroFrame } from "@/components/editions/editorial/HeroFrame";
import { EditionHero } from "@/components/editions/EditionHero";
import { EditionNav, type NavItem } from "@/components/editions/EditionNav";
import { PreviewBanner, previewReason } from "@/components/editions/PreviewBanner";

export const dynamic = "force-dynamic";

/**
 * Shared frame for every Edition page: skip link, preview banner (members and staff only; the database hides non-public Editions from everyone else),
 * the branded hero (the page's single h1), section navigation and the attribution footer. The pages below supply the content.
 */
export default async function EditionLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getEditionBundle(slug);
  if (!b) notFound();
  const { edition, organiser, pages, sessions, updates, sponsors, partners } = b;

  let entitled = true;
  if (edition.status === "published") {
    const sb = await createClient();
    const { data } = await sb.rpc("edition_entitled", { p_edition: edition.id, p_feature: "publish" });
    entitled = data === true;
  }
  // "Switched on for the public" means open to everyone OR this organiser is currently visible through an administrator's pilot approval (the database decides, live).
  let publiclyOn = await getEditionsEnabled();
  if (!publiclyOn) { const sbp = await createClient(); const { data: pv } = await sbp.rpc("edition_pilot_visible", { p_org: organiser.id }); publiclyOn = pv === true; }
  const reason = previewReason({ edition, enabled: publiclyOn, entitled });

  const base = `/editions/${edition.slug}`;
  const nav = navFor(pages);
  const home = nav.find((n) => n.isHome);
  const hasProgramme = sessions.length + partners.events.length > 0;
  const hasPartners = sponsors.length + partners.businesses.length + partners.activities.length + partners.hubs.length > 0;
  const tiers = await getPublicTiers(organiser.slug);
  // The main navigation follows how a visitor discovers an Edition: where it is, what is on, who is taking part, how to visit, how to join. Pages the organiser puts in the
  // navigation sit after "Taking part"; pages they leave out of it (about, credits, anything secondary) live in the footer, so nothing is lost and nothing is crowded.
  const items: NavItem[] = [
    { href: base, label: home?.label ?? "Overview" },
    ...(hasProgramme ? [{ href: `${base}/programme`, label: "Programme" }] : []),
    ...(hasPartners ? [{ href: `${base}/partners`, label: "Taking part" }] : []),
    ...nav.filter((n) => !n.isHome).map((n) => ({ href: `${base}/${n.slug}`, label: n.label })),
    ...(tiers.length > 0 ? [{ href: `/organisers/${organiser.slug}/membership`, label: "Membership" }] : []),
  ];
  const secondary = pages.filter((p) => !p.is_home && !p.in_nav).sort((a, b) => a.position - b.position).map((p) => ({ href: `${base}/${p.slug}`, label: p.nav_label || p.title }));
  // The Edition's own colour, logo and cover win; anything it leaves empty comes from its organiser. One colour in, a whole palette out.
  const rb = resolveBrand(edition, organiser);
  const brand = deriveBrand(rb.color);
  const flags = await getMyEditionFlags(edition.id);
  const canSave = edition.status === "published" && !edition.is_test;
  const actions = canSave ? (
    <>
      <SaveEditionButton editionId={edition.id} initial={flags?.saved ?? false} signedIn={flags !== null} nextPath={base} />
      {hasProgramme && (
        <CalendarLink href={`${base}/calendar.ics`} editionId={edition.id} className="ed-btn ed-btn--small">Add all to calendar<span className="sr-only"> (downloads a calendar file)</span></CalendarLink>
      )}
      {flags !== null && <Link href="/account/editions/plan" className="ed-arrow">My plan</Link>}
    </>
  ) : undefined;

  return (
    <BrandScope brand={brand}>
      <DemoBanner />
      <a href="#edition-content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-ink focus:shadow-lift">
        Skip to Edition content
      </a>
      <PreviewBanner reason={reason} />
      <HeroFrame><EditionHero edition={edition} organiser={organiser} logo={rb.logo} cover={rb.cover} focus={rb.focus} phase={phaseOf(edition)} seriesName={b.seriesName} programmeHref={hasProgramme ? `${base}/programme` : undefined} /></HeroFrame>
      <EditionNav items={items} actions={actions} />
      <div id="edition-content" tabIndex={-1} className="outline-none">{children}</div>
      <EditionFooter
        organiser={organiser}
        hub={b.hub ? { name: b.hub.name, href: `/hubs/${b.hub.slug || b.hub.id}` } : null}
        about={[...(updates.length > 0 ? [{ href: `${base}/updates`, label: "Journal" }] : []), ...secondary]}
        links={[
          { href: "/editions", label: "All Editions" },
          { href: `/organisers/${organiser.slug}`, label: `More from ${organiser.name}` },
          ...(tiers.length > 0 ? [{ href: `/organisers/${organiser.slug}/membership`, label: "Membership" }] : []),
        ]}
      />
    </BrandScope>
  );
}
