import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TicketsLive, type TicketItem } from "@/components/account/TicketsLive";
import { HISTORY_TICKET_STATUSES, type HistoryOrder } from "@/lib/ticket-lifecycle";

export const dynamic = "force-dynamic";
export const metadata = { title: "My tickets" };

type TicketRow = {
  id: string;
  backup_code: string | null;
  status: string | null;
  attendee_name: string | null;
  checked_in_at: string | null;
  event: {
    id: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
    venue: string | null;
    status: string | null;
  } | null;
  ticket_type: { name: string | null } | null;
  order: HistoryOrder | null;
};

export default async function MyTicketsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/tickets");

  const sb = await createClient();
  // HISTORY, not ownership: paid (valid), used and REFUNDED tickets. A refunded
  // ticket used to vanish from this page; it now lands in the Past tab as a
  // record. Unpaid rows (status 'pending_payment', created the moment checkout
  // starts) stay out — a customer who backs out before paying never held one.
  // Ownership elsewhere (For You, social stats) is unchanged: valid/used only.
  //
  // Privacy: holder_id is the signed-in customer and RLS enforces it. The
  // embedded order is theirs by ticket_orders_buyer_read; a ticket bought for
  // them by someone else has no order here, so no purchaser data comes with it.
  const BASE = "id, backup_code, status, attendee_name, checked_in_at, event:events(id, title, starts_at, ends_at, venue, status), ticket_type:event_ticket_types(name)";
  const ORDER = "order:event_ticket_orders(buyer_id, status, total_pence, tickets_count, paid_at, refunded_at, stripe_payment_intent_id)";
  const query = (select: string) =>
    sb
      .from("event_tickets")
      .select(select)
      .eq("holder_id", account.id)
      .in("status", [...HISTORY_TICKET_STATUSES])
      .order("created_at", { ascending: false });

  let { data, error } = await query(`${BASE}, ${ORDER}`);
  if (error) {
    // The money lines are an enhancement: if reading the order fails the customer
    // still sees their tickets, a refunded one included — just without the amounts.
    console.warn("[account/tickets] order embed failed, retrying without it:", error.message);
    ({ data, error } = await query(BASE));
  }

  const tickets = ((data ?? []) as unknown as TicketRow[]).map<TicketItem>((t) => ({
    id: t.id,
    status: t.status,
    checked_in_at: t.checked_in_at,
    backup_code: t.backup_code,
    attendee_name: t.attendee_name,
    ticket_type_name: t.ticket_type?.name ?? null,
    event: {
      id: t.event?.id ?? "unknown",
      title: t.event?.title ?? "Event",
      starts_at: t.event?.starts_at ?? null,
      ends_at: t.event?.ends_at ?? null,
      venue: t.event?.venue ?? null,
      status: t.event?.status ?? null,
    },
    order: t.order ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account" className="text-sm font-semibold text-ink-soft hover:underline">← My account</Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">My tickets</h1>
        <p className="mt-1 text-sm text-ink-muted">Event tickets you&apos;ve bought. Show the code at the door.</p>
      </div>

      {/* One list, two tabs: TicketsLive splits it with ticketLifecycle() so a ticket
          moves to Past the moment it stops being usable, without a reload. */}
      <TicketsLive userId={account.id} tickets={tickets} />
    </div>
  );
}
