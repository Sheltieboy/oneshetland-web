import Link from "next/link";
import { requireHubAdmin } from "@/lib/hubs-server";
import { getHubDocuments } from "@/lib/hubs-data";
import { DocumentsManager } from "@/components/hubs/admin/DocumentsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hub, accent } = await requireHubAdmin(id);
  const documents = await getHubDocuments(hub.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Back to management</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Documents</h1>
      <div className="mt-8"><DocumentsManager hubId={hub.id} documents={documents} accent={accent} /></div>
    </div>
  );
}
