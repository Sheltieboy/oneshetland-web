import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-data.server";
import { getCampaign } from "@/lib/launch-partners/campaigns.server";
import { parsePageDraft } from "@/lib/launch-partners/validate";
import { loadBusinessPageModel } from "@/lib/business-page/load.server";
import { slotHintsFromDraft } from "@/lib/business-page/profile";
import { BusinessPageV2 } from "@/components/business-page/BusinessPageV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business page draft", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Admin-only review of Business Page V2, in the two states Darren needs to judge:
 *   (default)            PREPARED — the whole private draft, with clearly-marked examples.
 *   ?view=future-live    FUTURE LIVE PREVIEW — the same design, but only the PROFILE layer of the draft (hero, story,
 *                        labels, place, order) with every example removed, and genuine OneShetland commerce inserted
 *                        where it exists. Empty commerce sections show a review note saying where real content will
 *                        appear. Not public, not customer-facing, writes nothing.
 * (There is deliberately no "live from today's sparse Directory fields" view: that is not what a partner's page becomes.)
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const future = (await searchParams).view === "future-live";
  const c = await getCampaign(id);
  if (!c) notFound();
  const parsed = parsePageDraft(c.page_config);
  const draft = parsed.ok ? parsed.value : null;
  const model = await loadBusinessPageModel({ businessId: c.business_id, mode: future ? "live" : "prepared", draft, fallback: { name: c.name, locality: c.locality } });
  const base = `/admin-preview/launch-partners/${c.id}/business-page`;
  return (
    <>
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-2 text-sm">
          <Link href={`/admin/launch-partners/${c.id}`} className="font-semibold text-ink-soft hover:text-ink">← Back to {c.name} in Admin</Link>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={base} aria-current={!future ? "page" : undefined} className={"rounded-pill px-3 py-1 font-semibold " + (!future ? "bg-ink text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>Prepared</Link>
            <Link href={`${base}?view=future-live`} aria-current={future ? "page" : undefined} className={"rounded-pill px-3 py-1 font-semibold " + (future ? "bg-ink text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>Future live preview</Link>
          </span>
        </div>
      </div>
      <BusinessPageV2 model={model} review={future} slotHints={future ? slotHintsFromDraft(draft) : []}
        draftNote={future ? undefined : `Private draft · Not public · Admin preview of ${c.name}`} />
    </>
  );
}
