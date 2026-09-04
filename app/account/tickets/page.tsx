import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TicketsLive, type TicketGroup } from "@/components/account/TicketsLive";

export const dynamic = "force-dynamic";
export const metadata = { title: "My tickets" };

const EVENTS = "#d4921a";

type TicketRow = {
  id: string;
  backup_code: string | null;
  status: string | null;
  attendee_name: string | null;
  checked_in_at: string | null;
  event: { id: string; title: string; starts_at: string | null; venue: string | null; status: string | null } | null;
  ticket_type: { name: string | null } | null;
};

export default async function MyTicketsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/tickets");

  const sb = await createClient();
  const { data } = await sb
    .from("event_tickets")
    // Only PAID tickets belong in "My tickets". Unpaid rows are created with
    // status 'pending_payment' the moment checkout starts; without this filter a
    // customer who backs out before paying still saw the tickets as theirs.
    .select("id, backup_code, status, attendee_name, checked_in_at, event:events(id, title, starts_at, venue, status), ticket_type:event_ticket_types(name)")
    .eq("holder_id", account.id)
    .in("status", ["valid", "used"])
    .order("created_at", { ascending: false });

  const tickets = (data ?? []) as unknown as TicketRow[];

  // Group by event, most recent event first (already ordered by created_at desc).
  // This render is the starting truth; TicketsLive keeps it current from the
  // same table while the page stays open.
  const byEvent = new Map<string, TicketGroup>();
  for (const t of tickets) {
    const key = t.event?.id ?? "unknown";
    if (!byEvent.has(key)) {
      byEvent.set(key, {
        key,
        title: t.event?.title ?? "Event",
        when: t.event?.starts_at ?? "",
        venue: t.event?.venue ?? null,
        status: t.event?.status ?? null,
        items: [],
      });
    }
    byEvent.get(key)!.items.push({
      id: t.id,
      status: t.status,
      checked_in_at: t.checked_in_at,
      backup_code: t.backup_code,
      attendee_name: t.attendee_name,
      ticket_type_name: t.ticket_type?.name ?? null,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm font-semibold text-ink-soft hover:underline">← My account</Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">My tickets</h1>
        <p className="mt-1 text-sm text-ink-muted">Event tickets you&apos;ve bought. Show the code at the door.</p>
      </div>

      {byEvent.size === 0 ? (
        <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
          <p className="font-display text-lg font-bold text-ink">No tickets yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">When you buy tickets to a Shetland event, they&apos;ll appear here.</p>
          <Link href="/whats-on" className="mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-paper" style={{ background: EVENTS }}>
            Browse What&apos;s On
          </Link>
        </div>
      ) : (
        <TicketsLive userId={account.id} groups={[...byEvent.values()]} />
      )}
    </div>
  );
}
