import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import { getEffectiveTier } from "@/lib/entitlement.server";
import { BatchResultView } from "@/components/business/product-import/BatchResultView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import result" };

export default async function ImportResultPage({ params }: { params: Promise<{ id: string; batch: string }> }) {
  const { id, batch } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(batch)) notFound();
  const { business } = await requireBusinessOwner(id, { returnPath: `/business/${id}/manage/products/import/${batch}` });
  const gate = await commercialTermsGate(business, "Products");
  if (gate) return gate;
  const { premium } = await getEffectiveTier(business.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage/products`} className="text-sm font-semibold text-ink-soft hover:text-ink">← Products</Link>
      <div className="mt-3 mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Import result</h1>
        <Link href={`/business/${business.id}/manage/products/import/history`} className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-soft hover:bg-sand">Import history →</Link>
      </div>
      <BatchResultView businessId={business.id} batchId={batch} canPublish={premium} />
    </div>
  );
}
