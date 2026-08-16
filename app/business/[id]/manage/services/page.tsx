import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { tierUnlocks } from "@/lib/business-data";
import { ServicesManager } from "@/components/business/ServicesManager";
import { HelpTip } from "@/components/help/HelpTip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services" };

export default async function ServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  if (!tierUnlocks(business.subscription_tier, "services")) redirect(`/business/${business.id}/manage/billing`);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-2 font-display text-3xl font-bold sm:text-4xl flex items-center gap-2.5">
          Services
          <HelpTip topic="booking-setup" />
        </h1>
      <p className="mb-6 text-sm text-ink-muted">The things people can book — durations, prices and deposits.</p>
      <ServicesManager businessId={business.id} />
    </div>
  );
}
