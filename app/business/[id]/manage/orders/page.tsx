import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { tierMeets } from "@/lib/business-data";
import { createClient } from "@/lib/supabase/server";
import { OrdersInbox } from "@/components/business/OrdersInbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shop orders" };

export default async function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  if (!tierMeets(business.subscription_tier, "premium")) redirect(`/business/${business.id}/manage/billing`);

  const sb = await createClient();
  const { data: orders } = await sb
    .from("product_orders")
    .select("*, items:product_order_items(title, variant_name, qty, unit_pence)")
    .eq("business_id", business.id)
    .neq("status", "pending")
    .neq("status", "expired")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <div className="mt-3 mb-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Shop orders</h1>
        <Link href={`/business/${business.id}/manage/products`} className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-soft hover:bg-sand">Products →</Link>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <OrdersInbox orders={(orders ?? []) as any} />
    </div>
  );
}
