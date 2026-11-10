import Link from "next/link";
import { MembersManager } from "@/components/editions-commerce/MembersManager";
import { getOrgEntitlements, getOrgMembers, getOrgTiers, getPayoutStatus, getRenewalsDue } from "@/lib/editions/commerce.server";
import { can } from "@/lib/editions/rules";
import { organiserPage } from "../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Members" };

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organiser, role } = await organiserPage(slug, `/organise/${slug}/members`);
  const [tiers, ents, payout] = await Promise.all([can(role, "editor") ? getOrgTiers(organiser.id) : Promise.resolve([]), getOrgEntitlements(organiser.id), getPayoutStatus(organiser.id)]);
  const [members, renewals] = await Promise.all([getOrgMembers(organiser.id), getRenewalsDue(organiser.id)]);
  const has = (f: string) => ents.some((e) => e.feature === f);
  return (
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted"><Link href="/organise" className="hover:underline">Festivals and Editions</Link> / <Link href={`/organise/${slug}`} className="hover:underline">{organiser.name}</Link></nav>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Members</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">Run your membership: set tiers and benefits, approve applications, invite businesses, record members who paid you directly, and keep track of renewals. Businesses stay in full control of their own listing and offers.</p>
      <p className="mt-2 text-sm"><Link href={`/organisers/${organiser.slug}/membership`} className="font-semibold text-navy hover:underline">See your public membership page</Link></p>
      <div className="mt-6"><MembersManager slug={slug} tiers={tiers} members={members} renewals={renewals} canManage={can(role, "admin")} hasMemberships={has("memberships")} hasOffline={has("offline_records")} vatRegistered={payout?.vat_registered ?? false} /></div>
    </div>
  );
}
