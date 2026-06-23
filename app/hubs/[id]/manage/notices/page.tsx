import Link from "next/link";
import { requireHubAdmin } from "@/lib/hubs-server";
import { getHubNotices } from "@/lib/hubs-data";
import { NoticesManager } from "@/components/hubs/admin/NoticesManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notices" };

export default async function NoticesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hub, accent } = await requireHubAdmin(id);
  const notices = await getHubNotices(hub.id, 50);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Back to management</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Notices</h1>
      <div className="mt-8"><NoticesManager hubId={hub.id} notices={notices} accent={accent} /></div>
    </div>
  );
}
