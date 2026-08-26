import { getMembershipPurchases, getBoostPurchases } from "@/lib/admin-data.server";
import { AdminHeader } from "@/components/admin/AdminUI";
import { MembershipRefunds } from "@/components/admin/MembershipRefunds";
import { BoostPurchases } from "@/components/admin/BoostPurchases";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments · Admin" };

/**
 * Platform payment administration.
 *
 * This exists because the equivalent screen was built in the native app and
 * was, in practice, unreachable: it ships by OTA to an installed build, and
 * the admin who needed it was working from a desktop. Financial administration
 * belongs where the administrator already is.
 *
 * The refund itself is not implemented here or anywhere else in the web app.
 * The refund-payment Edge Function remains the only thing that moves money.
 */
export default async function AdminPaymentsPage() {
  const [purchases, boosts] = await Promise.all([getMembershipPurchases(), getBoostPurchases()]);

  return (
    <>
      <AdminHeader
        title="Payments"
        sub="Membership payments and refunds. Refunds reverse the hub's payout and return the OneShetland fee."
      />
      <MembershipRefunds purchases={purchases} />
      <BoostPurchases purchases={boosts} />
    </>
  );
}
