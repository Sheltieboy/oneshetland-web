import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import { BIZ } from "@/lib/business-data";
import { getBusinessEvents, getEventSalesStats, groupEventsForManagement, type BusinessEventRow } from "@/lib/events-manage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Events" };

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: "Draft",     bg: "#E2E8F0", color: "#475569" },
  published: { label: "Published", bg: "#DCFCE7", color: "#15803D" },
  cancelled: { label: "Cancelled", bg: "#FEE2E2", color: "#991B1B" },
  postponed: { label: "Postponed", bg: "#FEF3C7", color: "#92400E" },
  archived:  { label: "Archived",  bg: "#E2E8F0", color: "#475569" },
};

export default async function BusinessEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id);
  // One acceptance per business covers every commercial screen. Directory
  // management is deliberately not gated — see lib/commercial-terms.server.
  const gate = await commercialTermsGate(business, "Events");
  if (gate) return gate;
  const events = await getBusinessEvents(business.id);
  const base = `/business/${business.id}/manage/events`;

  // Manage events means manage ALL of this business's events — drafts
  // (especially any blocked on payout setup) surfaced first, not left
  // stranded behind whichever event happens to be published and upcoming.
  const { drafts, upcoming, past } = groupEventsForManagement(events);

  // Checked-in counts, where available: only for the upcoming/published
  // bucket — the one place this genuinely useful at a glance, and a small,
  // bounded set of calls (the same per-event RPC Event Manage itself already
  // uses), not one per event ever created.
  const checkedInByEvent = new Map<string, number>();
  await Promise.all(upcoming.filter((e) => e.has_tickets).map(async (e) => {
    try {
      const stats = await getEventSalesStats(e.id);
      checkedInByEvent.set(e.id, stats.checked_in);
    } catch { /* best-effort */ }
  }));

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Events</h1>
        <Link href={`${base}/new`} className="rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: BIZ }}>+ New event</Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft">
          <p className="text-ink-muted">No events yet. Put something on — you can add tickets if you want to sell them, or keep it free.</p>
          <Link href={`${base}/new`} className="mt-4 inline-block rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: BIZ }}>Create event</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {drafts.length > 0 && (
            <EventList title="Drafts · needs attention" events={drafts} base={base} businessId={business.id} />
          )}
          {upcoming.length > 0 && (
            <EventList title="Upcoming" events={upcoming} base={base} businessId={business.id} checkedInByEvent={checkedInByEvent} />
          )}
          {past.length > 0 && (
            <EventList title="Past" events={past} base={base} businessId={business.id} quiet />
          )}
        </div>
      )}
    </div>
  );
}

function EventList({ title, events, base, businessId, checkedInByEvent, quiet }: {
  title: string;
  events: BusinessEventRow[];
  base: string;
  businessId: string;
  checkedInByEvent?: Map<string, number>;
  quiet?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</p>
      <ul className={"space-y-2" + (quiet ? " opacity-70" : "")}>
        {events.map((ev) => {
          const b = STATUS_BADGE[ev.status] ?? STATUS_BADGE.draft;
          const notReadyPaidDraft = ev.status === "draft"
            && ev.ticket_types.some((t) => t.is_active && t.price_pence > 0)
            && !ev.payout_ready;
          const checkedIn = checkedInByEvent?.get(ev.id);
          return (
            <li key={ev.id} className="rounded-xl border border-line bg-paper shadow-soft">
              <Link href={`${base}/${ev.id}`} className="flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-ink">{ev.title}</span>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {new Date(ev.starts_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {ev.venue ? ` · ${ev.venue}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: b.bg, color: b.color }}>
                      {notReadyPaidDraft ? `${b.label} · Not published` : b.label}
                    </span>
                    {ev.has_tickets && <span className="text-xs font-semibold text-ink-muted">{ev.tickets_sold} sold</span>}
                    {checkedIn !== undefined && <span className="text-xs font-semibold text-ink-muted">{checkedIn} checked in</span>}
                  </div>
                </div>
                <span className="shrink-0 text-ink-faint">→</span>
              </Link>
              {/* Deliberately a sibling of the row Link above, not nested
                  inside it — an anchor cannot contain another anchor, and
                  this goes somewhere different (Plan & payouts, not this
                  event) than the row itself does. */}
              {notReadyPaidDraft && (
                <Link href={`/business/${businessId}/manage/billing`} className="block border-t border-line px-4 py-2 text-xs font-bold text-amber-800 hover:underline">
                  Connect Stripe to publish
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
