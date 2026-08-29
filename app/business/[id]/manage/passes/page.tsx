import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import { tierUnlocks } from "@/lib/business-data";
import { UnitItemsManager } from "@/components/business/UnitItemsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Passes & packs" };

export default async function PassesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  // One acceptance per business covers every commercial screen. Directory
  // management is deliberately not gated — see lib/commercial-terms.server.
  const gate = await commercialTermsGate(business, "Passes and packs");
  if (gate) return gate;
  if (!tierUnlocks(business.subscription_tier, "passes")) redirect(`/business/${business.id}/manage/billing`);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-2 font-display text-3xl font-bold sm:text-4xl">Passes &amp; packs</h1>
      <p className="mb-6 text-sm text-ink-muted">Tickets, class packs, day passes and gift vouchers — things that aren&apos;t tied to a time slot.</p>
      <UnitItemsManager businessId={business.id} />
    </div>
  );
}
