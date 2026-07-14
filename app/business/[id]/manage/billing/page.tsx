import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { getBusinessAddons } from "@/lib/business-data.server";
import { BillingManager } from "@/components/business/BillingManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan, payments & payouts" };

export default async function BillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  const addons = await getBusinessAddons(business.id);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">Plan, payments &amp; payouts</h1>
      <BillingManager business={business} addons={addons} />
    </div>
  );
}
