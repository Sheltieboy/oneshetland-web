import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listCampaigns } from "@/lib/launch-partners/campaigns.server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * From a business to ITS launch-partner campaign — so a screen that only knows the business (the approved claim on Business claims)
 * can continue in the launch workflow without anyone searching. Under /admin (the layout requires an administrator) and the lookup
 * is the admin-only campaign list. Read-only: it only redirects.
 */
export default async function Page({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!UUID.test(businessId)) notFound();
  const campaign = (await listCampaigns()).find((c) => c.business_id === businessId);
  if (campaign) redirect(`/admin/launch-partners/${campaign.id}#grant`);
  return (
    <div className="rounded-card border border-line bg-paper p-6">
      <p className="font-display text-lg font-bold text-ink">There is no launch-partner campaign for this business.</p>
      <p className="mt-1 text-sm text-ink-soft">You can still manage its launch-partner access directly.</p>
      <Link href={`/admin/claims?status=launch&business=${businessId}`} className="mt-3 inline-block rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Open Launch partner access →</Link>
    </div>
  );
}
