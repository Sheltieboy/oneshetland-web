import Link from "next/link";
import { requireHubAdmin } from "@/lib/hubs-server";
import { BroadcastManager } from "@/components/hubs/admin/BroadcastManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Message members" };

export default async function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hub, accent } = await requireHubAdmin(id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Back to management</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Message members</h1>
      <div className="mt-8"><BroadcastManager hubId={hub.id} accent={accent} /></div>
    </div>
  );
}
