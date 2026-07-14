import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { getBusinessServicesCount } from "@/lib/business-data.server";
import { tierMeets } from "@/lib/business-data";
import { BookingsManager } from "@/components/business/BookingsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings" };

export default async function BookingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  if (!tierMeets(business.subscription_tier, "premium")) redirect(`/business/${business.id}/manage/billing`);
  const servicesCount = await getBusinessServicesCount(business.id);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">Bookings</h1>
      <BookingsManager business={business} servicesCount={servicesCount} />
    </div>
  );
}
