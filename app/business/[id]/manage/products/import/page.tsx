import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import { getEffectiveTier } from "@/lib/entitlement.server";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/components/business/product-import/ImportWizard";
import type { HistoryEntry } from "@/components/business/product-import/shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import products" };

export default async function ImportProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A signed-out owner comes back to THIS page, not the manage dashboard.
  const { business } = await requireBusinessOwner(id, { returnPath: `/business/${id}/manage/products/import` });
  const gate = await commercialTermsGate(business, "Products");
  if (gate) return gate;
  // Below Premium an owner can still import everything as drafts; Premium is asked for when something would go on sale.
  const { premium } = await getEffectiveTier(business.id);

  const sb = await createClient();
  const { data } = await sb.from("import_batches")
    .select("id, status, filename, created_at, counts, total_items, undo_expires_at")
    .eq("business_id", business.id).order("created_at", { ascending: false }).limit(8);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage/products`} className="text-sm font-semibold text-ink-soft hover:text-ink">← Products</Link>
      <h1 className="mt-3 mb-1 font-display text-3xl font-bold sm:text-4xl">Import products</h1>
      <p className="mb-6 text-sm text-ink-soft">Add lots of products at once from a CSV file. You&rsquo;ll see exactly what will happen before anything is saved, and everything arrives as a draft.</p>
      <ImportWizard businessId={business.id} canPublish={premium} history={(data ?? []) as HistoryEntry[]} />
    </div>
  );
}
