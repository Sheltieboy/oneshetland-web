import Link from "next/link";
import { getPendingEvents } from "@/lib/admin-data.server";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { EventApprovals } from "@/components/admin/EventApprovals";
import { queueCounts } from "@/lib/event-submissions-admin.server";
import { queueBadge } from "@/lib/event-submissions-shape";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [rows, counts] = await Promise.all([getPendingEvents(), queueCounts()]);
  const badge = queueBadge(counts.subs, counts.changes);
  return (
    <>
      <AdminHeader title="Event approvals" sub="Hub events waiting to go on the islands-wide calendar." />
      {/* Community events: shown only when the database functions exist (otherwise nothing, so this page is unchanged until they do). */}
      {!counts.unavailable && (
        <p className="mb-5 rounded-card border border-line bg-paper p-4 text-sm text-ink">
          <span className="font-bold">Community events: </span>
          <Link href="/admin/events/submissions" className="font-semibold text-navy underline">Event submissions{counts.subs ? ` (${badge.pending} waiting)` : ""}</Link>
          {" · "}
          <Link href="/admin/events/changes" className="font-semibold text-navy underline">Change requests{counts.changes ? ` (${badge.changes} waiting)` : ""}</Link>
        </p>
      )}
      {rows.length === 0 ? <Empty>No events awaiting approval.</Empty> : <EventApprovals rows={rows as never[]} />}
    </>
  );
}
