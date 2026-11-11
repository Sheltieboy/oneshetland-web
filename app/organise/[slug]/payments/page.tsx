import Link from "next/link";
import { PayoutsPanel } from "@/components/editions-commerce/PayoutsPanel";
import { PaymentsTable } from "@/components/editions-commerce/PaymentsTable";
import { getCollectBlocker, getCommissionRates, getOrgEntitlements, getOrgPayments, getOrgStatement, getPayoutStatus, getTermsAccepted } from "@/lib/editions/commerce.server";
import { paymentsMode } from "@/lib/editions/payments.server";
import { can } from "@/lib/editions/rules";
import { organiserPage } from "../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

export default async function PaymentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organiser, role } = await organiserPage(slug, `/organise/${slug}/payments`, "admin");
  const [blocker, payout, terms, ents, rows, statement, rates] = await Promise.all([getCollectBlocker(organiser.id), getPayoutStatus(organiser.id), getTermsAccepted(organiser.id), getOrgEntitlements(organiser.id), getOrgPayments(organiser.id), getOrgStatement(organiser.id), getCommissionRates(organiser.id)]);
  return (
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted"><Link href="/organise" className="hover:underline">Festivals and Editions</Link> / <Link href={`/organise/${slug}`} className="hover:underline">{organiser.name}</Link></nav>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Payments</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">Get paid by the businesses that join you, see every payment, and refund when you need to. Memberships and Edition fees are set up on the Members page and each Edition&rsquo;s Participation tab.</p>
      <div className="mt-6 space-y-10">
        <PayoutsPanel slug={slug} blocker={blocker} payout={payout} termsAccepted={terms.accepted} termsVersion={terms.version} isOwner={can(role, "owner")} simulated={paymentsMode() === "simulated"} />
        <PaymentsTable slug={slug} rows={rows} statement={statement} canRefund={can(role, "admin")} csvAllowed={ents.some((e) => e.feature === "csv_export")} rates={rates} />
      </div>
    </div>
  );
}
