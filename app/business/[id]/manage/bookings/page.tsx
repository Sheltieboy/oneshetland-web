import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import {
  getBusinessServicesCount,
  getBusinessServicesBrief,
  getBusinessAvailabilityRules,
  getBusinessUpcomingOverrides,
} from "@/lib/business-data.server";
import { tierUnlocks } from "@/lib/business-data";
import { BookingsManager } from "@/components/business/BookingsManager";
import { HelpTip } from "@/components/help/HelpTip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings" };

/**
 * Taking bookings used to be three separate screens — Services, Availability,
 * and a "go live" toggle buried on a fourth — with only the last one mentioning
 * the other two. The obvious path (add a service, set your hours) left you
 * invisible, because nothing told you a switch existed.
 *
 * It is one page now, in the order you'd actually do it, with going live gated
 * on the two steps before it. /manage/services and /manage/schedule redirect
 * here so existing links and bookmarks keep working.
 */
export default async function BookingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  // One acceptance per business covers every commercial screen. Directory
  // management is deliberately not gated — see lib/commercial-terms.server.
  const gate = await commercialTermsGate(business, "Bookings");
  if (gate) return gate;
  if (!tierUnlocks(business.subscription_tier, "bookings")) redirect(`/business/${business.id}/manage/billing`);

  const [servicesCount, services, rules, overrides] = await Promise.all([
    getBusinessServicesCount(business.id),
    getBusinessServicesBrief(business.id),
    getBusinessAvailabilityRules(business.id),
    getBusinessUpcomingOverrides(business.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-2 flex items-center gap-2.5 font-display text-3xl font-bold sm:text-4xl">
        Bookings
        <HelpTip topic="booking-setup" />
      </h1>
      <p className="mb-6 text-sm text-ink-muted">
        What people can book, when you&apos;re free, and the switch that puts you live.
      </p>
      <BookingsManager
        business={business}
        servicesCount={servicesCount}
        services={services}
        rules={rules}
        overrides={overrides}
      />
    </div>
  );
}
