import Link from "next/link";
import { requireHubAdmin, getHubEventsAdmin } from "@/lib/hubs-server";
import { EventsManager } from "@/components/hubs/admin/EventsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Events" };

export default async function EventsAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hub, accent } = await requireHubAdmin(id);
  const events = (await getHubEventsAdmin(hub.id)) as unknown as {
    id: string; title: string; starts_at: string; ends_at?: string | null;
    venue?: string | null; locality?: string | null; category?: string | null; price_text?: string | null;
    hub_visibility?: string | null; calendar_approved?: boolean | null; status?: string | null;
    has_tickets?: boolean; ticket_url?: string | null;
    ticket_types?: { id: string; name: string; price_pence: number; quantity_available?: number | null; display_order?: number }[];
  }[];

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Back to management</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Events</h1>
      <p className="mt-1 text-ink-soft">Add events for your hub. Verified hubs&apos; islands-wide events appear on the main What&apos;s On calendar automatically.</p>
      <div className="mt-8"><EventsManager hubId={hub.id} events={events} accent={accent} hubVerified={!!hub.is_verified} /></div>
    </div>
  );
}
