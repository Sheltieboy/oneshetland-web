import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { LoadError, when } from "@/components/admin/fetch/FetchUI";
import { getFetchQueues } from "@/lib/fetch-admin/data.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Driver verification" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Driver verification: documents waiting for review and applications in progress. Replaces the old one-click approval screen. */
export default async function Page() {
  const r = await getFetchQueues();
  if (!r.ok) return (<><AdminHeader title="Driver verification" /><LoadError error={r.error} /></>);
  const { awaiting_review, pending_applications } = r.data.queues.driver_verification as { awaiting_review: Row[]; pending_applications: Row[] };
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/fetch" className="text-ink-muted underline">← Fetch operations</Link></p>
      <AdminHeader title="Driver verification" sub="A driver is approved only once every required document is accepted and in date. Open a driver to review." />
      <h2 className="mb-2 font-display text-xl font-bold text-ink">Documents waiting for review ({awaiting_review.length})</h2>
      {awaiting_review.length === 0 ? <Empty>No documents waiting.</Empty> : (
        <div className="mb-6 overflow-x-auto rounded-card border border-line bg-paper"><table className="w-full text-sm">
          <thead className="bg-sand text-left text-xs text-ink-muted"><tr><th className="p-2">Driver</th><th className="p-2">Document</th><th className="p-2">Version</th><th className="p-2">Submitted</th><th className="p-2">Account</th></tr></thead>
          <tbody>{awaiting_review.map((x) => (
            <tr key={x.item_id} className="border-t border-line"><td className="p-2"><Link href={`/admin/fetch/drivers/${x.driver_id}`} className="font-semibold underline">{x.driver_first_name ?? x.driver_id.slice(0, 8)}</Link></td>
              <td className="p-2">{String(x.kind).replace(/_/g, " ")}</td><td className="p-2">{x.version}</td><td className="p-2 text-xs">{when(x.submitted_at)}</td><td className="p-2">{x.driver_status}</td></tr>
          ))}</tbody></table></div>
      )}
      <h2 className="mb-2 font-display text-xl font-bold text-ink">Applications ({pending_applications.length})</h2>
      {pending_applications.length === 0 ? <Empty>No pending applications.</Empty> : (
        <div className="overflow-x-auto rounded-card border border-line bg-paper"><table className="w-full text-sm">
          <thead className="bg-sand text-left text-xs text-ink-muted"><tr><th className="p-2">Driver</th><th className="p-2">Vehicle</th><th className="p-2">Applied</th><th className="p-2">Evidence</th></tr></thead>
          <tbody>{pending_applications.map((x) => (
            <tr key={x.driver_id} className="border-t border-line"><td className="p-2"><Link href={`/admin/fetch/drivers/${x.driver_id}`} className="font-semibold underline">{x.driver_id.slice(0, 8)}</Link></td>
              <td className="p-2">{x.vehicle_class ?? "Not given yet"}</td><td className="p-2 text-xs">{when(x.applied_at)}</td>
              <td className="p-2">{x.evidence_complete ? "Complete" : `Missing: ${(x.missing as string[]).join(", ").replace(/_/g, " ") || "—"}`}</td></tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}
