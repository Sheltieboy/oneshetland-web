import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import {
  getBusinessServicesBrief,
  getBusinessAvailabilityRules,
  getBusinessUpcomingOverrides,
} from "@/lib/business-data.server";
import { tierMeets } from "@/lib/business-data";
import { ScheduleManager } from "@/components/business/ScheduleManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule · OneShetland" };

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  if (!tierMeets(business.subscription_tier, "premium")) redirect(`/business/${business.id}/manage/billing`);

  const [services, rules, overrides] = await Promise.all([
    getBusinessServicesBrief(business.id),
    getBusinessAvailabilityRules(business.id),
    getBusinessUpcomingOverrides(business.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-2 font-display text-3xl font-bold sm:text-4xl">Schedule</h1>
      <p className="mb-6 text-ink-muted">Set your bookable weekly hours and one-off date overrides. These drive the slots customers can pick.</p>
      <ScheduleManager businessId={business.id} services={services} rules={rules} overrides={overrides} />
    </div>
  );
}
