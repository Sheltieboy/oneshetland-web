import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import { getEffectiveTier } from "@/lib/entitlement.server";
import { createClient } from "@/lib/supabase/server";
import { ProductsManager } from "@/components/business/ProductsManager";
import type { Product, ProductVariant, BusinessShipping } from "@/lib/shop-data";
import { HelpTip } from "@/components/help/HelpTip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

export default async function ProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  // One acceptance per business covers every commercial screen. Directory
  // management is deliberately not gated — see lib/commercial-terms.server.
  const gate = await commercialTermsGate(business, "Products");
  if (gate) return gate;
  // No redirect. Below Premium an owner may build their whole shop — the
  // server allows inactive products on purpose — and Premium is asked for at
  // the moment something would go on sale, not at the door.
  const { premium } = await getEffectiveTier(business.id);

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
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold sm:text-4xl">
          Products
          <HelpTip topic="what-to-sell" />
        </h1>
        <Link href={`/business/${business.id}/manage/orders`} className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-soft hover:bg-sand">Orders →</Link>
      </div>
      <p className="mb-6 text-sm text-ink-soft">Sell where Shetland already is — your products appear on your listing and across OneShetland. 5% per sale, and we promote your shop.</p>
      <ProductsManager
        canPublish={premium}
        businessId={business.id}
        products={(products ?? []) as Product[]}
        variantsByProduct={variantsByProduct}
        shipping={(shipping ?? null) as BusinessShipping | null}
      />
    </div>
  );
}
