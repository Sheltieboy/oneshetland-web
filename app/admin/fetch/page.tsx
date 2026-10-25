import Link from "next/link";
import { AdminHeader, Card, Empty } from "@/components/admin/AdminUI";
import { JobLink, JobStatus, LoadError, PriorityPill, Reasons, when } from "@/components/admin/fetch/FetchUI";
import { getFetchQueues } from "@/lib/fetch-admin/data.server";
import { QUEUES, byUrgency, reasonLabel } from "@/lib/fetch-admin/queues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fetch operations" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Fetch operations — "what needs attention right now?" Queue cards, then everything marked Action required, most urgent first. */
export default async function Page() {
  const r = await getFetchQueues();
  if (!r.ok) return (<><AdminHeader title="Fetch operations" /><LoadError error={r.error} /></>);
  const { queues, counts, action_required: ar } = r.data;
  const attention: Row[] = byUrgency<Row>([
    ...(queues.payments as Row[]).map((x) => ({ ...x, queue: "Payment problem" })),
    ...(queues.returns as Row[]).map((x) => ({ ...x, queue: "Cannot deliver" })),
    ...(queues.verification_jobs as Row[]).map((x) => ({ ...x, queue: "Verification on a live job" })),
    ...(queues.cancellations as Row[]).map((x) => ({ ...x, queue: "Cancellation" })),
    ...(queues.issues as Row[]).map((x) => ({ ...x, queue: "Issue", reasons: [x.kind] })),
  ].filter((x: Row) => x.priority === "action_required"));

  return (
    <>
      <AdminHeader title="Fetch operations" sub="What needs attention right now. Every change here goes through the audited Fetch actions." />
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUEUES.map((q) => (
          <Link key={q.key} href={q.href} className="block">
            <Card className={(ar[q.key] ?? 0) > 0 ? "border-rose-300" : ""}>
              <div className="flex items-baseline justify-between">
                <p className="font-display text-lg font-bold text-ink">{q.title}</p>
                <p className={"font-display text-3xl font-bold " + ((ar[q.key] ?? 0) > 0 ? "text-rose-600" : "text-ink")}>{counts[q.key] ?? 0}</p>
              </div>
              <p className="mt-1 text-xs text-ink-muted">{q.blurb}</p>
              {(ar[q.key] ?? 0) > 0 && <p className="mt-2 text-xs font-bold text-rose-700">{ar[q.key]} action required</p>}
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="mb-2 font-display text-xl font-bold text-ink">Action required</h2>
      {attention.length === 0 ? <Empty>Nothing needs action right now.</Empty> : (
        <div className="overflow-x-auto rounded-card border border-line bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-sand text-left text-xs text-ink-muted"><tr><th className="p-2">Job</th><th className="p-2">Queue</th><th className="p-2">Why</th><th className="p-2">Job state</th><th className="p-2">Since</th></tr></thead>
            <tbody>
              {attention.slice(0, 25).map((x, i) => (
                <tr key={`${x.request_id}-${i}`} className="border-t border-line">
                  <td className="p-2"><JobLink id={x.request_id} /> <PriorityPill priority={x.priority} /></td>
                  <td className="p-2">{x.queue}</td>
                  <td className="p-2"><Reasons codes={x.reasons} /></td>
                  <td className="p-2"><JobStatus status={x.status ?? x.job_status} /></td>
                  <td className="p-2 text-xs text-ink-muted">{when(x.updated ?? x.opened_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-ink-muted">
        Waiting items (driver evidence to review, routine issues, failing pushes, cancellations still within the driver&apos;s time) are in their queues above.
        Driver verification: {counts.driver_verification ?? 0} to review. Notifications: {counts.notifications ?? 0} {reasonLabel("failed").toLowerCase()} or stuck.
      </p>
      <p className="mt-2 text-sm"><Link href="/admin/fetch/jobs" className="font-semibold text-navy underline">All Fetch jobs →</Link></p>
    </>
  );
}
