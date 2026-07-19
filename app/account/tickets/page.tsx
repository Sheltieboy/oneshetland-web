import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TicketsRealtime } from "@/components/account/TicketsRealtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "My tickets" };

const EVENTS = "#d4921a";

type TicketRow = {
  id: string;
  backup_code: string | null;
  status: string | null;
  attendee_name: string | null;
  checked_in_at: string | null;
  event: { id: string; title: string; starts_at: string | null; venue: string | null } | null;
  ticket_type: { name: string | null } | null;
};

function fmt(dt: string | null): string {
  if (!dt) return "";
  return new Date(dt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function MyTicketsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/tickets");

  const sb = await createClient();
  const { data } = await sb
    .from("event_tickets")
    // Only PAID tickets belong in "My tickets". Unpaid rows are created with
    // status 'pending_payment' the moment checkout starts; without this filter a
    // customer who backs out before paying still saw the tickets as theirs.
    .select("id, backup_code, status, attendee_name, checked_in_at, event:events(id, title, starts_at, venue), ticket_type:event_ticket_types(name)")
    .eq("holder_id", account.id)
    .in("status", ["valid", "used"])
    .order("created_at", { ascending: false });

  const tickets = (data ?? []) as unknown as TicketRow[];

  // Group by event, most recent event first (already ordered by created_at desc).
  const byEvent = new Map<string, { title: string; when: string; venue: string | null; items: TicketRow[] }>();
  for (const t of tickets) {
    const key = t.event?.id ?? "unknown";
    if (!byEvent.has(key)) {
      byEvent.set(key, { title: t.event?.title ?? "Event", when: t.event?.starts_at ?? "", venue: t.event?.venue ?? null, items: [] });
    }
    byEvent.get(key)!.items.push(t);
  }

  return (
    <div className="space-y-6">
      <TicketsRealtime userId={account.id} />
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
        <div className="space-y-5">
          {[...byEvent.values()].map((grp) => (
            <section key={grp.title + grp.when} className="rounded-card border border-line bg-paper p-5 shadow-soft">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-ink">{grp.title}</h2>
                <span className="shrink-0 text-sm text-ink-muted">{grp.items.length} ticket{grp.items.length === 1 ? "" : "s"}</span>
              </div>
              {grp.when && <p className="mt-0.5 text-sm text-ink-muted">{fmt(grp.when)}{grp.venue ? ` · ${grp.venue}` : ""}</p>}
              <div className="mt-4 space-y-2">
                {grp.items.map((t) => {
                  const used = !!t.checked_in_at || t.status === "used" || t.status === "checked_in";
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-sand/40 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{t.ticket_type?.name ?? "Ticket"}</p>
                        {t.attendee_name && <p className="text-xs text-ink-muted">{t.attendee_name}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        {t.backup_code && (
                          <span className="rounded-lg bg-paper px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-ink shadow-sm">{t.backup_code}</span>
                        )}
                        <span
                          className="rounded-pill px-2.5 py-1 text-xs font-bold"
                          style={used ? { background: "#E5E7EB", color: "#6B7280" } : { background: "#DCFCE7", color: "#065F46" }}
                        >
                          {used ? "Used" : "Valid"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
