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
 * Admin-only review of Business Page V2 in either render mode:
 *   (default)   prepared — the private draft, with clearly-marked examples;
 *   ?mode=live  live     — a SIMULATION of the customer-facing page from the business's genuine data only. The draft is
 *               not even loaded, so nothing prepared can appear. This route is still admin-only; it does not make
 *               anything public.
 * Reads the draft through the admin function and the facts from the public listing; writes nothing.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const live = (await searchParams).mode === "live";
  const c = await getCampaign(id);
  if (!c) notFound();
  const parsed = live ? null : parsePageDraft(c.page_config);
  const model = await loadBusinessPageModel({ businessId: c.business_id, mode: live ? "live" : "prepared", draft: parsed?.ok ? parsed.value : null, fallback: { name: c.name, locality: c.locality } });
  const base = `/admin-preview/launch-partners/${c.id}/business-page`;
  return (
    <>
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-2 text-sm">
          <Link href={`/admin/launch-partners/${c.id}`} className="font-semibold text-ink-soft hover:text-ink">← Back to {c.name} in Admin</Link>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted">
            {live ? <>Live-mode simulation · genuine data only · <strong className="text-ink">Admin only, not public</strong></> : <>Prepared draft</>}
            <Link href={live ? base : `${base}?mode=live`} className="rounded-pill border border-line-strong px-3 py-1 font-semibold text-ink-soft hover:bg-sand">{live ? "Show prepared draft" : "Show live-mode simulation"}</Link>
          </span>
        </div>
      </div>
      <BusinessPageV2 model={model} draftNote={`Private draft · Not public · Admin preview of ${c.name}`} />
    </>
  );
}
