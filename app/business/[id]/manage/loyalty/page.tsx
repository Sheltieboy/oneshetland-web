import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { getLoyaltyProgram } from "@/lib/business-data.server";
import { tierMeets } from "@/lib/business-data";
import { LoyaltyManager } from "@/components/business/LoyaltyManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Loyalty programme · OneShetland" };

export default async function LoyaltyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  if (!tierMeets(business.subscription_tier, "pro")) redirect(`/business/${business.id}/manage/billing`);
  const program = await getLoyaltyProgram(business.id);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-2 font-display text-3xl font-bold sm:text-4xl">Loyalty programme</h1>
      <p className="mb-6 text-ink-soft">Reward regulars with stamps or points.</p>
      <LoyaltyManager businessId={business.id} program={program} />
    </div>
  );
}
