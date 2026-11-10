import { notFound } from "next/navigation";
import { getPublicOrganiser, getEditionsAccess, getEditionsEnabled } from "@/lib/editions/data.server";
import { getPublicTiers } from "@/lib/editions/commerce.server";
import { deriveBrand, resolveBrand } from "@/lib/editions/brand";
import { ApplyPanel } from "@/components/editions-commerce/ApplyPanel";
import { DemoBanner } from "@/components/editions/DemoBanner";
import { BrandScope } from "@/components/editions/editorial/BrandScope";
import { Masthead, Plate } from "@/components/editions/editorial/Masthead";
import { EditionFooter } from "@/components/editions/editorial/EditionFooter";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const o = await getPublicOrganiser((await params).slug);
  return o ? { title: `Membership · ${o.organiser.name}`, alternates: { canonical: `/organisers/${o.organiser.slug}/membership` } } : { title: "Membership" };
}

/** Public membership page: the organiser's tiers (only those a business can really join) and a plain way to apply, in the organiser's own brand. 404 unless the organiser is public. */
export default async function MembershipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getEditionsEnabled()) && !(await getEditionsAccess()).allowed) notFound();
  const o = await getPublicOrganiser(slug); if (!o) notFound();
  const tiers = await getPublicTiers(slug);
  const sb = await createClient(); const { data: { user } } = await sb.auth.getUser();
  const { data: biz } = user ? await sb.from("local_businesses").select("id, name").eq("owner_id", user.id).eq("is_active", true).order("name") : { data: [] };
  const org = o.organiser;
  const rb = resolveBrand(null, org);
  return (
    <BrandScope brand={deriveBrand(rb.color)}>
      <DemoBanner />
      <Masthead
        title={`Join ${org.name}`}
        eyebrow="Membership"
        line="Membership for local businesses. You stay in full control of your OneShetland listing and offers."
        ghost={org.name.trim().slice(0, 1).toUpperCase()}
        cover={rb.cover}
        focus={rb.focus}
        backHref={`/organisers/${org.slug}`}
        backLabel={org.name}
        plate={<Plate name={org.name} logo={rb.logo} label="Membership" textless />}
        short
      />
      <section aria-label="Membership options" className="ed-section">
        <div className="ed-wrap">
          {tiers.length === 0
            ? <p className="ed-lede ed-display" style={{ margin: 0, maxWidth: "26ch" }}>There is nothing to join online right now. Check back soon.</p>
            : <ApplyPanel tiers={tiers} businesses={(biz ?? []) as { id: string; name: string }[]} signedIn={!!user} nextPath={`/organisers/${slug}/membership`} />}
        </div>
      </section>
      <EditionFooter organiser={org} links={[{ href: `/organisers/${org.slug}`, label: `About ${org.name}` }, { href: "/editions", label: "All Editions" }]} />
    </BrandScope>
  );
}
