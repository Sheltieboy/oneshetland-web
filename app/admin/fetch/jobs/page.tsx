import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { JobLink, JobStatus, LoadError, PriorityPill, Reasons, when } from "@/components/admin/fetch/FetchUI";
import { getFetchJobs, getFetchQueues } from "@/lib/fetch-admin/data.server";
import { QUEUES, STATUS_LABEL, jobFilters } from "@/lib/fetch-admin/queues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fetch jobs" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** All Fetch jobs, filtered from the URL (a plain GET form — nothing on this page changes anything). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const f = jobFilters(sp);
  const [r, q] = await Promise.all([getFetchJobs(f), f.queue ? getFetchQueues() : Promise.resolve(null)]);
  const queue = QUEUES.find((x) => x.key === f.queue);
  const why = new Map<string, Row>(q?.ok && f.queue ? (q.data.queues[f.queue as string] as Row[]).map((x) => [x.request_id, x]) : []);
  const input = "rounded-xl border border-line bg-paper px-3 py-1.5 text-sm";
  return (
    <>
      <AdminHeader title={queue ? queue.title : "Fetch jobs"} sub={queue ? queue.blurb : "Search and filter every Fetch job."} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <input name="q" defaultValue={(f.q as string) ?? ""} placeholder="Job id (or its start)" className={input} />
        <select name="status" defaultValue={(f.status as string) ?? ""} className={input}>
          <option value="">Any state</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="queue" defaultValue={(f.queue as string) ?? ""} className={input}>
          <option value="">Any queue</option>{QUEUES.filter((x) => !["driver_verification", "notifications"].includes(x.key)).map((x) => <option key={x.key} value={x.key}>{x.title}</option>)}
        </select>
        <input name="requester" defaultValue={(f.requester as string) ?? ""} placeholder="Requester id" className={input} />
        <input name="driver" defaultValue={(f.driver as string) ?? ""} placeholder="Driver id" className={input} />
        <input type="date" name="from" defaultValue={(f.from as string) ?? ""} className={input} aria-label="From" />
        <input type="date" name="to" defaultValue={(f.to as string) ?? ""} className={input} aria-label="To" />
        {(["open_issue", "payment_problem", "return_state", "cancellation"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1"><input type="checkbox" name={k} value="1" defaultChecked={f[k] === true} />
            {{ open_issue: "Open issue", payment_problem: "Payment problem", return_state: "Cannot deliver / returned", cancellation: "Cancellation asked" }[k]}</label>
        ))}
        <button className="rounded-pill bg-navy px-4 py-1.5 font-semibold text-white">Filter</button>
        <Link href="/admin/fetch/jobs" className="text-ink-muted underline">Clear</Link>
      </form>
      {!r.ok ? <LoadError error={r.error} /> : (r.data.jobs as Row[]).length === 0 ? <Empty>No jobs match.</Empty> : (
        <div className="overflow-x-auto rounded-card border border-line bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-sand text-left text-xs text-ink-muted"><tr><th className="p-2">Job</th><th className="p-2">State</th><th className="p-2">Route</th><th className="p-2">Requester</th><th className="p-2">Driver</th><th className="p-2">Issues</th><th className="p-2">Created</th></tr></thead>
            <tbody>
              {(r.data.jobs as Row[]).map((j) => (
                <tr key={j.request_id} className="border-t border-line align-top">
                  <td className="p-2"><JobLink id={j.request_id} />{why.get(j.request_id) && <div className="mt-1"><PriorityPill priority={why.get(j.request_id)!.priority} /> <Reasons codes={why.get(j.request_id)!.reasons} /></div>}</td>
                  <td className="p-2"><JobStatus status={j.status} />{j.cancellation_requested && <div className="text-xs text-amber-700">Cancellation asked</div>}</td>
                  <td className="p-2">{j.route}</td>
                  <td className="p-2"><Link href={`/admin/fetch/members/${j.requester_id}`} className="underline">{j.requester}</Link></td>
                  <td className="p-2">{j.driver_id ? <Link href={`/admin/fetch/drivers/${j.driver_id}`} className="underline">{j.driver}</Link> : "—"}</td>
                  <td className="p-2">{j.open_issues || "—"}</td>
                  <td className="p-2 text-xs text-ink-muted">{when(j.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
