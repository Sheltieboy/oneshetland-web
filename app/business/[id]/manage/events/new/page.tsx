import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { BIZ } from "@/lib/business-data";
import { BusinessEventForm } from "@/components/business/BusinessEventForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New event" };

export default async function NewBusinessEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage/events`} className="text-sm font-semibold text-ink-soft hover:text-ink">← Events</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">New event</h1>
      <BusinessEventForm businessId={business.id} accent={BIZ} />
    </div>
  );
}
