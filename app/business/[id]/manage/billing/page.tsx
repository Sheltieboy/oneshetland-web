import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { BillingManager } from "@/components/business/BillingManager";
import { HelpTip } from "@/components/help/HelpTip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan, payments & payouts" };

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { id } = await params;
  const { plan } = await searchParams;
  const intentTier = plan === "pro" || plan === "premium" ? plan : undefined;
  const { business } = await requireBusinessOwner(id);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl flex items-center gap-2.5">
          Plan, payments &amp; payouts
          <HelpTip topic="plans-tier" />
        </h1>
      <BillingManager business={business} intentTier={intentTier} />
    </div>
  );
}
