import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import { createClient } from "@/lib/supabase/server";
import { HistoryList, type HistoryItem } from "@/components/business/product-import/HistoryList";
import type { HistoryEntry } from "@/components/business/product-import/shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import history" };

/** Server clock, read once per request. */
const nowMs = () => Date.now();

export default async function ImportHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id, { returnPath: `/business/${id}/manage/products/import/history` });
  const gate = await commercialTermsGate(business, "Products");
  if (gate) return gate;

  const sb = await createClient(); // owner session: RLS shows this business's imports and nobody else's
  const { data } = await sb.from("import_batches")
    .select("id, status, filename, created_at, counts, total_items, undo_expires_at")
    .eq("business_id", business.id).order("created_at", { ascending: false }).limit(50);
  const now = nowMs();
  const items: HistoryItem[] = ((data ?? []) as HistoryEntry[]).map((h) => ({
    ...h,
    canUndo: (h.status === "complete" || h.status === "complete_with_errors") && new Date(h.undo_expires_at).getTime() > now,
  }));

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage/products`} className="text-sm font-semibold text-ink-soft hover:text-ink">← Products</Link>
      <div className="mt-3 mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Import history</h1>
        <Link href={`/business/${business.id}/manage/products/import`} className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-soft hover:bg-sand">Import products →</Link>
      </div>
      <p className="mb-6 text-sm text-ink-soft">Every file you&rsquo;ve imported. Open one to see what happened, publish from it, or undo it within 7 days.</p>
      <HistoryList businessId={business.id} items={items} />
    </div>
  );
}
