import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { JobLink, JobStatus, LoadError, PriorityPill, when } from "@/components/admin/fetch/FetchUI";
import { getFetchQueues } from "@/lib/fetch-admin/data.server";
import { byUrgency } from "@/lib/fetch-admin/queues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fetch issues" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Open Fetch issues. What was written is never shown in this list (it may hold personal details) — open the job for that. */
export default async function Page() {
  const r = await getFetchQueues();
  if (!r.ok) return (<><AdminHeader title="Open issues" /><LoadError error={r.error} /></>);
  const rows = byUrgency(r.data.queues.issues as Row[]);
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/fetch" className="text-ink-muted underline">← Fetch operations</Link></p>
      <AdminHeader title="Open issues" sub={`${rows.length} open. Open the job to read the report, the messages and the photos.`} />
      {rows.length === 0 ? <Empty>No open issues.</Empty> : (
        <div className="overflow-x-auto rounded-card border border-line bg-paper"><table className="w-full text-sm">
          <thead className="bg-sand text-left text-xs text-ink-muted"><tr><th className="p-2">Job</th><th className="p-2">Issue</th><th className="p-2">Reported by</th><th className="p-2">Opened</th><th className="p-2">Job state</th><th className="p-2">Evidence</th><th className="p-2">Money or return affected</th></tr></thead>
          <tbody>{rows.map((i) => (
            <tr key={i.issue_id} className="border-t border-line">
              <td className="p-2"><JobLink id={i.request_id} /> <PriorityPill priority={i.priority} /></td>
              <td className="p-2">{String(i.kind).replace(/_/g, " ")}</td><td className="p-2">{i.reporter_role}</td><td className="p-2 text-xs">{when(i.opened_at)}</td>
              <td className="p-2"><JobStatus status={i.job_status} /></td><td className="p-2">{i.has_evidence ? "Photos" : "—"}</td><td className="p-2">{i.affects_payment ? "Yes" : "—"}</td>
            </tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}
