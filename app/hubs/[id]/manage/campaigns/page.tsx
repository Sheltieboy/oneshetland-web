import Link from "next/link";
import { requireHubAdmin } from "@/lib/hubs-server";
import { getHubCampaigns } from "@/lib/hubs-data";
import { CampaignsManager } from "@/components/hubs/admin/CampaignsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fundraising" };

export default async function CampaignsAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hub, accent } = await requireHubAdmin(id);
  const campaigns = await getHubCampaigns(hub.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Back to management</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Fundraising</h1>
        <Link
          href={`/hubs/${hub.slug || hub.id}/manage/donations`}
          className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand"
        >
          Donations
        </Link>
      </div>
      <div className="mt-8"><CampaignsManager hubId={hub.id} campaigns={campaigns} accent={accent} /></div>
    </div>
  );
}
