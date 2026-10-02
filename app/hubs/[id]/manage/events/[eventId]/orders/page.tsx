import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHubAdmin, getHubEventsAdmin } from "@/lib/hubs-server";
import { EventOrders } from "@/components/events/EventOrders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ticket orders" };

/**
 * Ticket orders for one of this hub's events. Hub admins (owner and committee)
 * can see who bought tickets; only the hub OWNER can refund — the server
 * decides both, so a committee member simply sees no Refund button.
 */
export default async function HubEventOrdersPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params;
  const { hub, accent } = await requireHubAdmin(id);
  const events = (await getHubEventsAdmin(hub.id)) as unknown as { id: string; title: string }[];
  const event = events.find((e) => e.id === eventId);
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage/events`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Events</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Ticket orders</h1>
      <p className="mt-1 text-ink-soft">{event.title}</p>
      <div className="mt-6"><EventOrders eventId={event.id} /></div>
    </div>
  );
}
