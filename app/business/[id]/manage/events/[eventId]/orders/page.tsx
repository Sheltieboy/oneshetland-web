import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business-server";
import { getBusinessEvent } from "@/lib/events-manage";
import { EventOrders } from "@/components/events/EventOrders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ticket orders" };

/**
 * Who bought tickets for this event, and refunding an order. The business
 * owner is the person whose connected account the ticket money was paid to,
 * so they are exactly who the server lets refund. The list and the refund are
 * both re-authorised server-side; this page only chooses what to render.
 */
export default async function BusinessEventOrdersPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params;
  const { business } = await requireBusinessOwner(id);
  const event = await getBusinessEvent(business.id, eventId);
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage/events/${event.id}`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {event.title}</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">Ticket orders</h1>
      <EventOrders eventId={event.id} />
    </div>
  );
}
