import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-data.server";
import { getCampaign } from "@/lib/launch-partners/campaigns.server";
import { parsePageDraft } from "@/lib/launch-partners/validate";
import { loadBusinessPageModel } from "@/lib/business-page/load.server";
import { BusinessPageV2 } from "@/components/business-page/BusinessPageV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business page draft", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Admin-only review of a prepared Business Page V2. It reads the draft from the campaign (admin RPC) and the
 * business's real facts from the public listing; it writes nothing and the public business page is unchanged.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const c = await getCampaign(id);
  if (!c) notFound();
  const parsed = parsePageDraft(c.page_config);
  const model = await loadBusinessPageModel({ businessId: c.business_id, mode: "draft", draft: parsed.ok ? parsed.value : null, fallback: { name: c.name, locality: c.locality } });
  return (
    <>
      <div className="border-b border-line bg-white"><div className="mx-auto max-w-6xl px-5 py-2 text-sm"><Link href={`/admin/launch-partners/${c.id}`} className="font-semibold text-ink-soft hover:text-ink">← Back to {c.name} in Admin</Link></div></div>
      <BusinessPageV2 model={model} draftNote={`Private draft · Not public · Admin preview of ${c.name}`} />
    </>
  );
}
