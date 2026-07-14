import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { BIZ } from "@/lib/business-data";
import { getBusinessEvent } from "@/lib/events-manage";
import { BusinessEventForm } from "@/components/business/BusinessEventForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit event" };

export default async function EditBusinessEventPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params;
  const { business } = await requireBusinessOwner(id);
  const event = await getBusinessEvent(business.id, eventId);
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage/events/${eventId}`} className="text-sm font-semibold text-ink-soft hover:text-ink">← Manage event</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">Edit event</h1>
      <BusinessEventForm businessId={business.id} accent={BIZ} event={event} />
    </div>
  );
}
