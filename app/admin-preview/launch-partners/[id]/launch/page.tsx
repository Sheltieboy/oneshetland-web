import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-data.server";
import { getCampaign } from "@/lib/launch-partners/campaigns.server";
import { parsePreviewConfig } from "@/lib/launch-partners/validate";
import { readDirectoryFacts } from "@/lib/launch-preview/directory";
import { PreviewPage } from "@/components/launch-preview/PreviewPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Launch preview (admin view)", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin-only view of a campaign's Launch Preview exactly as an invited business would see it (no invitation involved, nothing recorded). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const c = await getCampaign(id);
  if (!c) notFound();
  const parsed = parsePreviewConfig(c.preview_config, c.slug);
  if (!parsed.ok) return <p className="p-8 text-sm font-semibold text-rose-700">The stored preview is not valid: {parsed.error}</p>;
  const facts = await readDirectoryFacts(parsed.value);
  return (
    <>
      <div className="border-b border-line bg-white"><div className="mx-auto max-w-6xl px-5 py-2 text-sm"><Link href={`/admin/launch-partners/${c.id}`} className="font-semibold text-ink-soft hover:text-ink">← Back to {c.name} in Admin</Link></div></div>
      <PreviewPage cfg={parsed.value} facts={facts} viewer={{ kind: "visitor" }} />
    </>
  );
}
