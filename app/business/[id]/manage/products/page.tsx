import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { tierMeets } from "@/lib/business-data";
import { createClient } from "@/lib/supabase/server";
import { ProductsManager } from "@/components/business/ProductsManager";
import type { Product, ProductVariant, BusinessShipping } from "@/lib/shop-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

export default async function ProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  if (!tierMeets(business.subscription_tier, "premium")) redirect(`/business/${business.id}/manage/billing`);

  const sb = await createClient(); // owner session — RLS shows hidden products too
  const [{ data: products }, { data: shipping }] = await Promise.all([
    sb.from("products").select("*").eq("business_id", business.id).order("created_at", { ascending: false }),
    sb.from("business_shipping").select("*").eq("business_id", business.id).maybeSingle(),
  ]);
  const ids = (products ?? []).map((p) => p.id);
  const { data: variants } = ids.length
    ? await sb.from("product_variants").select("*").in("product_id", ids).order("position")
    : { data: [] };
  const variantsByProduct: Record<string, ProductVariant[]> = {};
  for (const v of (variants ?? []) as ProductVariant[]) {
    (variantsByProduct[v.product_id] ??= []).push(v);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <div className="mt-3 mb-1 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Products</h1>
        <Link href={`/business/${business.id}/manage/orders`} className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-soft hover:bg-sand">Orders →</Link>
      </div>
      <p className="mb-6 text-sm text-ink-soft">Sell where Shetland already is — your products appear on your listing and across OneShetland. 5% per sale, and we promote your shop.</p>
      <ProductsManager
        businessId={business.id}
        products={(products ?? []) as Product[]}
        variantsByProduct={variantsByProduct}
        shipping={(shipping ?? null) as BusinessShipping | null}
      />
    </div>
  );
}
