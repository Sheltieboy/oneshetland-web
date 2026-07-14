import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { BIZ } from "@/lib/business-data";
import { getBusinessEvents } from "@/lib/events-manage";

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
  const events = await getBusinessEvents(business.id);
  const base = `/business/${business.id}/manage/events`;

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now - 6 * 3600_000);
  const past = events.filter((e) => new Date(e.starts_at).getTime() < now - 6 * 3600_000);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Events</h1>
        <Link href={`${base}/new`} className="rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: BIZ }}>+ New event</Link>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-line bg-paper p-8 text-center text-ink-muted shadow-soft">No events yet. Create your first one.</p>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && <EventList title="Upcoming" events={upcoming} base={base} />}
          {past.length > 0 && <EventList title="Past" events={past} base={base} />}
        </div>
      )}
    </div>
  );
}

function EventList({ title, events, base }: { title: string; events: Awaited<ReturnType<typeof getBusinessEvents>>; base: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</p>
      <ul className="space-y-2">
        {events.map((ev) => {
          const b = STATUS_BADGE[ev.status] ?? STATUS_BADGE.draft;
          return (
            <li key={ev.id}>
              <Link href={`${base}/${ev.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-ink">{ev.title}</span>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {new Date(ev.starts_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {ev.venue ? ` · ${ev.venue}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: b.bg, color: b.color }}>{b.label}</span>
                    {ev.has_tickets && <span className="text-xs font-semibold text-ink-muted">{ev.tickets_sold} sold</span>}
                  </div>
                </div>
                <span className="shrink-0 text-ink-faint">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
