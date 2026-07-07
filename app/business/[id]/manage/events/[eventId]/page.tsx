import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { BIZ } from "@/lib/business-data";
import { getBusinessEvent, getEventSalesStats } from "@/lib/events-manage";
import { BusinessEventManage } from "@/components/business/BusinessEventManage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage event · OneShetland" };

export default async function ManageBusinessEventPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params;
  const { business } = await requireBusinessOwner(id);
  const event = await getBusinessEvent(business.id, eventId);
  if (!event) notFound();
  const stats = await getEventSalesStats(eventId);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage/events`} className="text-sm font-semibold text-ink-soft hover:text-ink">← Events</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">{event.title}</h1>
      <BusinessEventManage businessId={business.id} accent={BIZ} event={event} stats={stats} />
    </div>
  );
}
