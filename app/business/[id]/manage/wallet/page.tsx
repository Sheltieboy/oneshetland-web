import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { getWalletReceipts } from "@/lib/business-data.server";
import { tierMeets } from "@/lib/business-data";
import { WalletManager } from "@/components/business/WalletManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local Wallet · OneShetland" };

export default async function WalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  if (!tierMeets(business.subscription_tier, "pro")) redirect(`/business/${business.id}/manage/billing`);
  const receipts = await getWalletReceipts(business.id, 10);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">Local Wallet</h1>
      <WalletManager business={business} receipts={receipts} />
    </div>
  );
}
