import Link from "next/link";
import { requireHubAdmin } from "@/lib/hubs-server";
import { getMembershipTypes } from "@/lib/hubs-data";
import { TiersManager } from "@/components/hubs/admin/TiersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Membership tiers" };

export default async function TiersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hub, accent } = await requireHubAdmin(id);
  const tiers = await getMembershipTypes(hub.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Back to management</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Membership tiers</h1>
      <div className="mt-8"><TiersManager hubId={hub.id} tiers={tiers} accent={accent} /></div>
    </div>
  );
}
