import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { LoadError, Section, when } from "@/components/admin/fetch/FetchUI";
import { FetchActionButton } from "@/components/admin/fetch/FetchActionButton";
import { ShortLinkButton } from "@/components/admin/fetch/ShortLinkButton";
import { MemberPanel } from "@/components/admin/fetch/MemberPanel";
import { getDriverRecord, getFetchMember } from "@/lib/fetch-admin/data.server";
import { driverDecisions, evidenceActions } from "@/lib/fetch-admin/job-actions";
import { reasonLabel } from "@/lib/fetch-admin/queues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fetch driver" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/**
 * One driver: account decision, every document version with its review, and the member counters. Documents open only through
 * 2-minute links fetched on click (each view recorded); no storage path or document link is ever part of this page.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [d, m] = await Promise.all([getDriverRecord(id), getFetchMember(id)]);
  if (!d.ok) return (<><AdminHeader title="Fetch driver" /><LoadError error={d.error} /></>);
  const r = d.data as Row;
  const tone = r.driver_status === "approved" ? "green" : r.driver_status === "suspended" || r.driver_status === "rejected" ? "red" : "amber";
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/fetch/drivers" className="text-ink-muted underline">← Driver verification</Link></p>
      <AdminHeader title={m.ok ? m.data.name : "Driver"} sub={`Vehicle: ${r.vehicle?.vehicle_class ?? "not given"} · up to ${r.vehicle?.max_size_class ?? "—"}${r.vehicle?.can_two_person_lift ? " · two-person lift" : ""}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusPill label={`Account: ${r.driver_status}`} tone={tone} />
        <StatusPill label={r.can_claim ? "Can take jobs" : `Cannot take jobs: ${reasonLabel(r.claim_problem ?? "")}`} tone={r.can_claim ? "green" : "red"} />
        {r.verified_until && <span className="text-xs text-ink-soft">Verified until {r.verified_until}</span>}
        {r.live_jobs > 0 && <Link href={`/admin/fetch/jobs?driver=${id}`} className="text-xs font-semibold text-navy underline">{r.live_jobs} live job(s)</Link>}
      </div>

      <Section title="Decision">
        <Card>
          <div className="flex flex-wrap gap-2">{driverDecisions(r.driver_status).map((a) => <FetchActionButton key={a} action={a} target={id} />)}</div>
          {r.decision_reason && <p className="mt-2 text-sm text-ink-soft">Last decision ({when(r.decided_at)}): {r.decision_reason}</p>}
        </Card>
      </Section>

      <Section title="Required evidence">
        {(r.requirements as Row[]).length === 0 ? <Empty>No requirements for this vehicle (or no vehicle given).</Empty> : (
          <div className="space-y-2">{(r.requirements as Row[]).map((q) => (
            <Card key={q.kind}><div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span><b>{String(q.kind).replace(/_/g, " ")}</b>{q.required ? "" : " (optional)"}{q.needs_expiry ? " · has an expiry" : ""}</span>
              <span>{q.current ? `${q.current.status}${q.current.expires_on ? ` · expires ${q.current.expires_on}` : ""}` : "Not supplied"}{q.awaiting_review ? " · a new version is waiting" : ""}</span>
            </div></Card>
          ))}</div>
        )}
      </Section>

      <Section title="Documents (every version)">
        {(r.items as Row[]).length === 0 ? <Empty>No documents.</Empty> : (
          <div className="space-y-2">{(r.items as Row[]).map((it) => (
            <Card key={it.item_id}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span><b>{String(it.kind).replace(/_/g, " ")}</b> v{it.version} · {it.status} · submitted {when(it.submitted_at)}
                  {it.reviewed_at ? ` · reviewed ${when(it.reviewed_at)}` : ""}{it.expires_at ? ` · expires ${when(it.expires_at)}` : ""}</span>
                <span className="flex flex-wrap gap-2">
                  {it.file_present ? <ShortLinkButton kind="evidence" id={it.item_id} label="Open (2-minute link)" /> : <span className="text-xs text-ink-muted">File deleted {when(it.file_deleted_at)}</span>}
                  {evidenceActions(it.status).map((a) => <FetchActionButton key={a} action={a} target={it.item_id} compact />)}
                </span>
              </div>
              {it.note && <p className="mt-1 text-xs text-ink-soft">Note: {it.note}</p>}
            </Card>
          ))}</div>
        )}
      </Section>

      <Section title="History">
        {(r.history as Row[]).length === 0 ? <Empty>No history.</Empty> : (
          <ol className="space-y-1 rounded-card border border-line bg-paper p-3 text-xs">{(r.history as Row[]).map((h, i) => (
            <li key={i} className="flex flex-wrap gap-x-3"><span className="w-32 text-ink-muted">{when(h.at)}</span><b>{String(h.event).replace(/_/g, " ")}</b>
              <span className="text-ink-soft">{h.actor_role}</span>{h.reason && <span>“{h.reason}”</span>}</li>
          ))}</ol>
        )}
      </Section>

      {m.ok ? <MemberPanel member={m.data} /> : <LoadError error={m.error} />}
    </>
  );
}
