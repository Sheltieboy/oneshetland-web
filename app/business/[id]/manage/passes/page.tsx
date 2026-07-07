import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { tierMeets } from "@/lib/business-data";
import { UnitItemsManager } from "@/components/business/UnitItemsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Passes & packs · OneShetland" };

export default async function PassesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  if (!tierMeets(business.subscription_tier, "premium")) redirect(`/business/${business.id}/manage/billing`);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-2 font-display text-3xl font-bold sm:text-4xl">Passes &amp; packs</h1>
      <p className="mb-6 text-sm text-ink-muted">Tickets, class packs, day passes and gift vouchers — things that aren&apos;t tied to a time slot.</p>
      <UnitItemsManager businessId={business.id} />
    </div>
  );
}
