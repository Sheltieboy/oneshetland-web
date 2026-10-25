import Link from "next/link";
import { Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { KV, Section, when } from "@/components/admin/fetch/FetchUI";
import { FetchActionButton } from "@/components/admin/fetch/FetchActionButton";
import { reasonLabel } from "@/lib/fetch-admin/queues";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** A member's Fetch counters (read-only diagnostics, not a public score) and their Fetch restriction, with its history. */
export function MemberPanel({ member: m }: { member: Row }) {
  const d = m.as_driver as Row | null;
  return (
    <>
      <Section title="Fetch restriction">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {m.restriction.restricted
              ? <span className="text-sm"><StatusPill label="Restricted from Fetch" tone="purple" /> since {when(m.restriction.since)} by {m.restriction.by}: {m.restriction.reason}</span>
              : <span className="text-sm text-ink-soft">Not restricted.</span>}
            <FetchActionButton action={m.restriction.restricted ? "unrestrict_member" : "restrict_member"} target={m.member_id} />
          </div>
          {(m.restriction_history as Row[]).length > 0 && (
            <ul className="mt-2 text-xs text-ink-soft">{(m.restriction_history as Row[]).map((h, i) => <li key={i}>{when(h.at)} · {h.action} by {h.admin}: {h.reason}</li>)}</ul>
          )}
        </Card>
      </Section>
      <Section title="As a requester">
        <Card><KV rows={[["Requests created", m.as_requester.requests_created], ["Delivered", m.as_requester.delivered],
          ["Cancelled before a driver accepted", m.as_requester.cancelled_before_accept], ["Asked to cancel after acceptance", m.as_requester.cancel_requests_after_accept],
          ["Returns found to be their fault", m.as_requester.requester_fault_returns], ["Open issues on their jobs", m.as_requester.open_issues_on_their_jobs]]} /></Card>
      </Section>
      <Section title="As a driver">
        {d ? <Card><KV rows={[["Account", d.driver_status], ["Can take jobs", d.verification_problem ? reasonLabel(d.verification_problem) : "Yes"],
          ["Jobs accepted", d.jobs_claimed], ["Delivered", d.delivered], ["Released after accepting", `${d.releases}${d.last_release_at ? ` (last ${when(d.last_release_at)})` : ""}`],
          ["Returns found to be their fault", d.driver_fault_returns], ["Open issues on their jobs", d.open_issues_on_their_jobs]]} /></Card> : <Empty>Not a driver.</Empty>}
      </Section>
      <Section title="Recent jobs">
        {(m.recent_jobs as Row[]).length === 0 ? <Empty>No Fetch jobs.</Empty> : (
          <ul className="text-sm">{(m.recent_jobs as Row[]).map((j) => <li key={j.request_id}><Link href={`/admin/fetch/jobs/${j.request_id}`} className="font-mono text-xs underline">{j.request_id.slice(0, 8)}</Link> · {j.role} · {j.status} · {when(j.created_at)}</li>)}</ul>
        )}
      </Section>
    </>
  );
}
