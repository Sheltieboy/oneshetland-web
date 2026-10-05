import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireBusinessOwner } from "@/lib/business-server";
import { readPageDraft } from "@/lib/launch-partners/campaigns.server";
import { loadBusinessPageModel } from "@/lib/business-page/load.server";
import { slotHintsFromDraft } from "@/lib/business-page/profile";
import { BusinessPageV2 } from "@/components/business-page/BusinessPageV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your business page — draft", robots: { index: false, follow: false, nocache: true } };

/**
 * The owner's private look at the Business Page prepared for them. Two locks, both in the database: they must own
 * the business, AND have an APPROVED launch-partner claim for it (launch_partner_page_draft returns nothing
 * otherwise — the page is then an ordinary 404, indistinguishable from "no draft"). Viewing publishes nothing.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id, { returnPath: `/business/${id}/manage/page-draft` });
  const d = await readPageDraft(business.id);
  if (!d) notFound();
  const future = (await searchParams).view === "future-live";
  const model = await loadBusinessPageModel({ businessId: business.id, mode: future ? "live" : "prepared", draft: d.draft, fallback: { name: business.name } });
  return (
    <>
      <div className="border-b border-line bg-white"><div className="mx-auto max-w-6xl px-5 py-2 text-sm"><Link href={`/business/${business.id}/manage`} className="font-semibold text-ink-soft hover:text-ink">← Back to your dashboard</Link></div></div>
      <BusinessPageV2 model={model} review={future} slotHints={future ? slotHintsFromDraft(d.draft) : []} draftNote={future ? undefined : "Your private draft · Not public · Nothing goes live until you approve it"} />
    </>
  );
}
