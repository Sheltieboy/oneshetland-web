import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { JobLink, LoadError, PriorityPill, when } from "@/components/admin/fetch/FetchUI";
import { getFetchQueues } from "@/lib/fetch-admin/data.server";
import { byUrgency, reasonLabel } from "@/lib/fetch-admin/queues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stuck Fetch notifications" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Diagnostic only. "Accepted" means the push provider took it, never that it was delivered; the inbox row is the durable record. */
export default async function Page() {
  const r = await getFetchQueues();
  if (!r.ok) return (<><AdminHeader title="Stuck notifications" /><LoadError error={r.error} /></>);
  const rows = byUrgency(r.data.queues.notifications as Row[]);
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/fetch" className="text-ink-muted underline">← Fetch operations</Link></p>
      <AdminHeader title="Stuck notifications" sub="Notices not yet written to the inbox, pushes being retried, and failed pushes from the last 7 days. A push the provider accepted is not proof of delivery." />
      {rows.length === 0 ? <Empty>Nothing stuck.</Empty> : (
        <div className="overflow-x-auto rounded-card border border-line bg-paper"><table className="w-full text-sm">
          <thead className="bg-sand text-left text-xs text-ink-muted"><tr><th className="p-2">Notice</th><th className="p-2">Job</th><th className="p-2">To</th><th className="p-2">Problem</th><th className="p-2">Attempts</th><th className="p-2">Created</th></tr></thead>
          <tbody>{rows.map((n) => (
            <tr key={n.notification_id} className="border-t border-line"><td className="p-2">{n.kind} <PriorityPill priority={n.priority} /></td>
              <td className="p-2">{n.request_id ? <JobLink id={n.request_id} /> : "—"}</td><td className="p-2">{n.recipient}</td>
              <td className="p-2">{reasonLabel(n.problem)}{n.last_error ? <span className="text-xs text-ink-muted"> — {n.last_error}</span> : null}</td>
              <td className="p-2">{n.attempts}</td><td className="p-2 text-xs">{when(n.created_at)}</td></tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}
