import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { getMyPartnerships } from "@/lib/editions/data.server";
import { getMyMemberships, getMyParticipations, getMyPayments } from "@/lib/editions/commerce.server";
import { BusinessCommerce } from "@/components/editions-commerce/BusinessCommerce";
import { PartnershipInbox } from "@/components/editions-manage/PartnershipInbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Festivals and Editions" };

// Not behind the commercial-terms gate: taking part involves no payment and changes nothing about the listing.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id, { returnPath: `/business/${id}/manage/editions` });
  const [all, memberships, participations, payments] = await Promise.all([getMyPartnerships(), getMyMemberships(), getMyParticipations(), getMyPayments()]);
  // this business's own listing, plus the events and activities it organises
  const mine = all.filter((p) => p.subject_business_id === business.id);
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">Festivals and Editions</h1>
      <div className="mt-6">
        <PartnershipInbox partnerships={mine} businessId={business.id} businessName={business.name} billingHref={`/business/${business.id}/manage/billing`} />
      </div>
      <div className="mt-12 border-t border-line pt-10">
        <BusinessCommerce memberships={memberships.filter((m) => m.business_id === business.id)} participations={participations.filter((p) => p.business_id === business.id)} payments={payments} />
      </div>
    </div>
  );
}
