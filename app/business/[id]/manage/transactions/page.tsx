import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { TransactionsLedger } from "@/components/business/TransactionsLedger";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money & transactions" };

export default async function TransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Money &amp; transactions</h1>
      <p className="mt-1 mb-6 text-ink-soft">Every payment in and cost out, in one place. Filter by period and export for your accounts.</p>
      <TransactionsLedger businessId={business.id} businessName={business.name} />
    </div>
  );
}
