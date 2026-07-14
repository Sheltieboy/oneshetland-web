import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { getLoyaltyProgram, getBusinessCode } from "@/lib/business-data.server";
import { tierMeets } from "@/lib/business-data";
import { LoyaltyManager } from "@/components/business/LoyaltyManager";
import { TillCode } from "@/components/business/TillCode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Loyalty programme" };

export default async function LoyaltyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  if (!tierMeets(business.subscription_tier, "pro")) redirect(`/business/${business.id}/manage/billing`);
  const [program, code] = await Promise.all([
    getLoyaltyProgram(business.id),
    getBusinessCode(business.id),
  ]);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-2 font-display text-3xl font-bold sm:text-4xl">Loyalty programme</h1>
      <p className="mb-6 text-ink-soft">Reward regulars with stamps or points.</p>
      <LoyaltyManager businessId={business.id} program={program} />

      {/* Stamp a customer — they read this rotating code and enter it in their app
          to collect a stamp / redeem a reward. Mirrors the app's stamp scanner
          (local-stamp-scanner.tsx → local-stamp-collect), which is code-entry, not
          a camera scan: the merchant displays the code, the customer enters it. */}
      <div className="mt-8">
        <h2 className="mb-2 font-display text-xl font-bold">Stamp a customer</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Show this code at the till. Customers enter it in the OneShetland app to collect a stamp.
        </p>
        <TillCode businessId={business.id} initial={code} />
      </div>
    </div>
  );
}
