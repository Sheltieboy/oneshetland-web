import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { KV, JobStatus, LoadError, PriorityPill, Reasons, Section, when } from "@/components/admin/fetch/FetchUI";
import { FetchActionButton } from "@/components/admin/fetch/FetchActionButton";
import { ShortLinkButton } from "@/components/admin/fetch/ShortLinkButton";
import { getFetchJob } from "@/lib/fetch-admin/data.server";
import { jobActions } from "@/lib/fetch-admin/job-actions";
import { formatPence, reasonLabel, timeLeft } from "@/lib/fetch-admin/queues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fetch job" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/**
 * One Fetch job for administrators. Read-only: every change is an explicit button that opens a confirmation, calls the audited
 * fetch-v2-admin action and shows the server's answer. The timeline is the immutable event history, never rebuilt here. Photos open
 * through 2-minute links fetched on click. Fetch holds no card details; only Stripe's state for the hold is shown.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getFetchJob(id);
  if (!r.ok) return (<><AdminHeader title="Fetch job" /><LoadError error={r.error} /></>);
  const { summary: s, money: m, payment: p, timeline, support, redactions, notifications, matching, parties, queues } = r.data as Row;
  const actions = jobActions(s, p);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/fetch" className="text-ink-muted underline">← Fetch operations</Link></p>
      <AdminHeader title={`Job ${s.request_id.slice(0, 8)}`} sub={`${s.route} · ${s.size_class} · created ${when(s.created_at)}`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <JobStatus status={s.status} />
        {p.payment_problem && <><PriorityPill priority={p.payment_problem.priority} /><Reasons codes={p.payment_problem.reasons} /></>}
        {queues.returns && <StatusPill label="Return decision needed" tone="red" />}
        {queues.verification_jobs && <StatusPill label={`Driver: ${reasonLabel(parties.driver_problem ?? "")}`} tone="red" />}
        {queues.cancellations && <><PriorityPill priority={queues.cancellations.priority} /><span className="text-xs text-ink-soft">Cancellation: driver to respond {timeLeft(queues.cancellations.respond_by)}</span></>}
        {parties.requester_restricted && <StatusPill label="Requester restricted" tone="purple" />}
        {parties.driver_restricted && <StatusPill label="Driver restricted" tone="purple" />}
      </div>

      <Section title="Actions">
        <Card><div className="flex flex-wrap gap-2">{actions.map((a) => <FetchActionButton key={a} action={a} target={s.request_id} />)}</div>
          <p className="mt-2 text-xs text-ink-muted">Each action explains what it will do and asks for confirmation. Nothing changes until the server confirms it.</p></Card>
      </Section>

      <Section title="Summary">
        <Card><KV rows={[
          ["Requester", <Link key="r" href={`/admin/fetch/members/${s.requester_id}`} className="underline">{s.requester}</Link>],
          ["Driver", s.driver_id ? <Link key="d" href={`/admin/fetch/drivers/${s.driver_id}`} className="underline">{s.driver}</Link> : "Not yet accepted"],
          ["Item", s.item_description], ["Category / size", `${s.category} · ${s.size_class}`],
          ["Route", `${s.route}${s.ferry_required ? " (ferry)" : ""}`], ["Timing", s.scheduling_mode],
          ["Accepted", when(s.claimed_at)], ["Collected", when(s.collected_at)], ["Delivered", when(s.delivered_at)],
          ["Could not deliver", s.undeliverable_at ? `${when(s.undeliverable_at)} — ${s.undeliverable_reason ?? ""}` : "—"],
          ["Return", s.return_outcome ? `${s.return_outcome} (fault: ${s.fault_party})` : "—"], ["Cancelled", when(s.cancelled_at)],
        ]} /></Card>
      </Section>

      <Section title="Money">
        <Card><KV rows={[
          ["Expected total", formatPence(m.expected_total_pence)], ["Maximum card hold", formatPence(m.max_hold_pence)],
          ["Owed now (if captured)", formatPence(m.capture_now_pence)], ["OneShetland fee", formatPence(m.oneshetland_fee_pence)],
          ["Driver entitlement", formatPence(m.driver_entitlement_pence)], ["Ferry / waiting / return", `${formatPence(m.ferry_supplement_pence)} / ${formatPence(m.waiting_fee_pence)} / ${formatPence(m.return_fee_pence)}`],
        ]} /></Card>
      </Section>

      <Section title="Payment">
        <Card><KV rows={[
          ["Payment state", p.payment_status], ["Stripe state of the hold", p.intent_state ?? "—"], ["Hold", `${formatPence(p.hold_pence)} (capturable ${formatPence(p.capturable_pence)})`],
          ["Capture deadline (Stripe)", p.capture_deadline ? `${when(p.capture_deadline)} — ${timeLeft(p.capture_deadline)}` : "—"],
          ["Hold state / generation", `${p.hold_state ?? "—"} / ${p.generation ?? "—"} (${p.retired_generations} earlier)`],
          ["Capture", `${p.capture_state ?? "—"} ${p.captured_pence ? formatPence(p.captured_pence) : ""}`], ["Last checked with Stripe", when(p.hold_checked_at)],
          ["Stripe PaymentIntent", p.payment_intent_id ?? "—"],
        ]} /></Card>
      </Section>

      <Section title="Timeline">
        {(timeline as Row[]).length === 0 ? <Empty>No events.</Empty> : (
          <ol className="space-y-1 rounded-card border border-line bg-paper p-3 text-sm">
            {(timeline as Row[]).map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3 border-b border-line/60 py-1">
                <span className="w-32 shrink-0 text-xs text-ink-muted">{when(e.at)}</span>
                <span className="font-semibold text-ink">{e.event.replace(/_/g, " ")}</span>
                <span className="text-xs text-ink-soft">{e.actor_role}{e.actor_role !== "system" ? ` · ${e.actor}` : ""}</span>
                {e.from && e.to && e.from !== e.to && <span className="text-xs text-ink-muted">{e.from} → {e.to}</span>}
                {e.reason && <span className="text-xs text-ink-soft">“{e.reason}”</span>}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Issues">
        {(support.issues as Row[]).length === 0 ? <Empty>No issues.</Empty> : (support.issues as Row[]).map((i) => (
          <Card key={i.id} className="mb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><StatusPill label={i.status === "open" ? "Open" : "Resolved"} tone={i.status === "open" ? "amber" : "green"} /> <b>{i.kind.replace(/_/g, " ")}</b>
                <span className="text-xs text-ink-muted"> · {i.reporter_role} · {when(i.created_at)}</span></div>
              {i.status === "open" && <FetchActionButton action="resolve_issue" target={i.id} compact />}
            </div>
            {i.detail && <p className="mt-1 text-sm text-ink-soft">{i.detail}</p>}
            {i.resolution && <p className="mt-1 text-sm text-emerald-800">Outcome: {i.resolution}</p>}
          </Card>
        ))}
        {support.evidence_held && <p className="text-xs text-ink-muted">An issue is open: this job&apos;s messages and photos are held as evidence.</p>}
      </Section>

      <Section title="Messages">
        {(support.messages as Row[]).length === 0 ? <Empty>No messages.</Empty> : (
          <div className="space-y-2">{(support.messages as Row[]).map((msg) => (
            <Card key={msg.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                <span>{msg.from} · {when(msg.created_at)}{msg.hidden_at ? ` · hidden ${when(msg.hidden_at)}: ${msg.hidden_reason}` : ""}</span>
                {!msg.hidden_at && <FetchActionButton action="hide_message" target={msg.id} compact />}
              </div>
              <p className={"mt-1 text-sm " + (msg.hidden_at ? "text-ink-muted line-through" : "text-ink")}>{msg.body}</p>
            </Card>
          ))}</div>
        )}
      </Section>

      <Section title="Photos">
        {(support.photos as Row[]).length === 0 ? <Empty>No photos.</Empty> : (
          <div className="space-y-2">{(support.photos as Row[]).map((ph) => (
            <Card key={ph.id}><div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span><b>{ph.kind}</b> · {when(ph.created_at)}{ph.matching_visible ? " · shown on the board" : ""}{ph.removed_at ? ` · removed: ${ph.removed_reason}` : ""}</span>
              <span className="flex gap-2"><ShortLinkButton kind="photo" id={ph.id} label="Open (2-minute link)" />{!ph.removed_at && <FetchActionButton action="remove_photo" target={ph.id} compact />}</span>
            </div></Card>
          ))}</div>
        )}
      </Section>

      {(redactions as Row[]).length > 0 && (
        <Section title="Description history (administrators only)">
          {(redactions as Row[]).map((x, i) => (
            <Card key={i} className="mb-2 text-sm"><p className="text-xs text-ink-muted">{when(x.at)} · {x.admin} · {x.reason}</p>
              <p>Was: <span className="text-ink-soft">{x.original}</span></p><p>Now: {x.replacement}</p></Card>
          ))}
        </Section>
      )}

      <Section title="Matching (assigned driver)">
        {matching ? <Card><KV rows={[["Driver eligibility", matching.driver], ["Capacity", matching.capacity], ["Board match", matching.board_match], ["In their area", String(matching.in_area)],
          ["Their journeys", (matching.runs as Row[]).map((x) => `${x.route} (${x.departs_on}): ${x.result}`).join("; ") || "—"]]} /></Card> : <Empty>No driver yet.</Empty>}
      </Section>

      <Section title="Notifications">
        {(notifications.notices as Row[]).length === 0 ? <Empty>No notices for this job.</Empty> : (
          <div className="overflow-x-auto rounded-card border border-line bg-paper"><table className="w-full text-xs">
            <thead className="bg-sand text-left text-ink-muted"><tr><th className="p-2">Notice</th><th className="p-2">To</th><th className="p-2">Inbox</th><th className="p-2">Push (accepted ≠ delivered)</th><th className="p-2">Attempts</th><th className="p-2">When</th></tr></thead>
            <tbody>{(notifications.notices as Row[]).map((n) => (
              <tr key={n.id} className="border-t border-line"><td className="p-2">{n.kind}{n.time_critical ? " (time-critical)" : ""}</td><td className="p-2 font-mono">{String(n.recipient_id).slice(0, 8)}</td>
                <td className="p-2">{n.inbox ?? "not written yet"}</td><td className="p-2">{n.push ?? "—"}{n.last_error ? ` — ${n.last_error}` : ""}</td><td className="p-2">{n.attempts}</td><td className="p-2">{when(n.created_at)}</td></tr>
            ))}</tbody></table></div>
        )}
      </Section>
    </>
  );
}
