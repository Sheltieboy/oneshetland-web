"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryDisputeRecovery } from "@/app/admin/editions/commerce/actions";
import { pounds } from "@/lib/editions/commerce";
import { Notice, Panel, btnPrimary, btnSecondary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

type N = number | null;
export type StatementRow = { organiser_id: string; organiser_name: string; payments: number; gross_pence: N; refunded_pence: N; commission_pence: N; commission_refunded_pence: N; commission_earned_pence: N; processing_fee_estimate_pence: N; stripe_fee_actual_pence: N; variance_pence: N; dispute_lost_pence: N; dispute_recovered_pence: N; dispute_fees_pence: N; organiser_net_pence: N; retained_processing_costs_pence: N };
export type VarianceRow = { group_key: string; group_label: string; payments: number; estimate_pence: N; actual_pence: N; variance_pence: N; over_threshold: number; over_threshold_variance_pence: N };
export type VarianceItem = { payment_id: string; created_at: string; organiser_name: string; kind: string; charge_pence: number; estimate_pence: N; actual_pence: N; variance_pence: N };
export type DisputeRow = { dispute_id: string; amount_pence: number; fee_pence: N; reason: string | null; state: string; recovery_pence: number; status: string; blocked: boolean; attempts: number; last_error: string | null; created_at: string; resolved_at: string | null; edition_organisers?: { name: string } | { name: string }[] | null };
export type Notes = { processing_fee: string; rates_confirmed: boolean; connect_overheads: string; dispute_fees: string; variance_treatment: string; vat: string; platform_vat_registered: boolean };

const p = (v: N | undefined) => (v === null || v === undefined ? "Not known yet" : pounds(v));
const money = (v: N | undefined) => pounds(v ?? 0);
const th = "px-3 py-2 whitespace-nowrap";
const box = "overflow-x-auto rounded-card border border-line bg-paper";
const orgOf = (d: DisputeRow) => (Array.isArray(d.edition_organisers) ? d.edition_organisers[0]?.name : d.edition_organisers?.name) ?? "";
export const canRetry = (d: { state: string; recovery_pence: number; status: string; blocked: boolean }) => d.state === "lost" && d.recovery_pence > 0 && ((d.status === "pending" && d.blocked) || d.status === "failed");
const STATUS: Record<string, string> = { none: "Nothing to recover", pending: "Waiting", done: "Recovered", failed: "Failed" };

/** Admin reports for the organiser-collected fee model: fee statement, variance, disputes and the standing notes. Stripe's actual fees are shown to administrators only. */
export function EditionsFeeReports({ days, statement, byMonth, byOrganiser, items, disputes, notes }: { days: number; statement: StatementRow[]; byMonth: VarianceRow[]; byOrganiser: VarianceRow[]; items: VarianceItem[]; disputes: DisputeRow[]; notes: Notes | null }) {
  const router = useRouter(); const act = useAction();
  const [open, setOpen] = useState<string | null>(null); const [note, setNote] = useState("");
  const varianceTable = (rows: VarianceRow[], first: string) => rows.length === 0 ? <p className="text-sm text-ink-muted">No payments with a known Stripe fee yet.</p> : (
    <div className={box}><table className="w-full min-w-[40rem] text-left text-sm"><thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink-soft"><tr><th className={th}>{first}</th><th className={th}>Payments</th><th className={th}>Estimated fee</th><th className={th}>Stripe actual</th><th className={th}>Variance</th><th className={th}>Over threshold</th><th className={th}>Variance over threshold</th></tr></thead>
      <tbody>{rows.map((r) => (<tr key={r.group_key} className="border-t border-line"><td className="px-3 py-2 font-semibold">{r.group_label}</td><td className="px-3 py-2">{r.payments}</td><td className="px-3 py-2">{money(r.estimate_pence)}</td><td className="px-3 py-2">{money(r.actual_pence)}</td><td className="px-3 py-2">{money(r.variance_pence)}</td><td className="px-3 py-2">{r.over_threshold}</td><td className="px-3 py-2">{money(r.over_threshold_variance_pence)}</td></tr>))}</tbody></table></div>
  );
  return (
    <div className="space-y-10">
      <Panel title="About these figures" tone="warm">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>{notes?.processing_fee ?? "Estimated card processing fee, reconciled to Stripe's actual fee. The estimate rates are placeholders until confirmed."}</li>
          {notes && !notes.rates_confirmed && <li className="font-semibold text-amber-900">The estimate rates have not been confirmed against Stripe. They are placeholders: do not enable payments until they are.</li>}
          <li>{notes?.connect_overheads ?? "Connect account and payout overheads are absorbed by OneShetland and are not recovered per payment."}</li>
          <li>{notes?.dispute_fees ?? "Stripe's dispute fee is recorded but not passed to the organiser automatically."}</li>
          <li>{notes?.variance_treatment ?? "No automatic true-up: the treatment of material variance is a pending commercial decision."}</li>
          <li>{notes?.vat ?? "OneShetland charges no VAT while it is not VAT registered."}{notes?.platform_vat_registered ? " (The VAT setting is currently on, but nothing reads it for charging.)" : ""}</li>
        </ul>
      </Panel>

      <Panel title={`Fee statement (last ${days} days)`} sub="Card payments collected for organisers. Commission earned is after commission returned on refunds. Stripe's actual fee is shown here only; organisers never see it.">
        {statement.length === 0 ? <p className="text-sm text-ink-muted">No card payments in this period.</p> : (
          <div className={box}><table className="w-full min-w-[72rem] text-left text-sm"><thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink-soft"><tr><th className={th}>Organiser</th><th className={th}>Payments</th><th className={th}>Gross</th><th className={th}>Refunded</th><th className={th}>Commission earned</th><th className={th}>Est. processing fee recovered</th><th className={th}>Stripe actual fees</th><th className={th}>Variance</th><th className={th}>Dispute losses recovered</th><th className={th}>Dispute fees (not passed on)</th><th className={th}>Organiser net</th><th className={th}>Retained processing costs</th></tr></thead>
            <tbody>{statement.map((r) => (<tr key={r.organiser_id} className="border-t border-line"><td className="px-3 py-2 font-semibold">{r.organiser_name}</td><td className="px-3 py-2">{r.payments}</td><td className="px-3 py-2">{money(r.gross_pence)}</td><td className="px-3 py-2">{money(r.refunded_pence)}</td><td className="px-3 py-2">{money(r.commission_earned_pence)}</td><td className="px-3 py-2">{money(r.processing_fee_estimate_pence)}</td><td className="px-3 py-2">{p(r.stripe_fee_actual_pence)}</td><td className="px-3 py-2">{p(r.variance_pence)}</td><td className="px-3 py-2">{money(r.dispute_recovered_pence)}{r.dispute_lost_pence ? <span className="text-ink-muted"> of {money(r.dispute_lost_pence)}</span> : null}</td><td className="px-3 py-2">{money(r.dispute_fees_pence)}</td><td className="px-3 py-2 font-semibold">{money(r.organiser_net_pence)}</td><td className="px-3 py-2">{money(r.retained_processing_costs_pence)}</td></tr>))}</tbody></table></div>
        )}
        <p className="mt-2 text-xs text-ink-muted">Retained processing costs: the estimated processing fee on refunded amounts, kept because Stripe does not return its fee.</p>
      </Panel>

      <Panel title="Variance: estimate minus Stripe's actual fee" sub="Positive means the estimate was higher than Stripe charged. Nothing is trued up or refunded automatically.">
        <h3 className="mb-2 text-sm font-bold text-ink">By month</h3>{varianceTable(byMonth, "Month")}
        <h3 className="mb-2 mt-5 text-sm font-bold text-ink">By organiser</h3>{varianceTable(byOrganiser, "Organiser")}
        <h3 className="mb-2 mt-5 text-sm font-bold text-ink">Payments over the alert threshold ({items.length})</h3>
        {items.length === 0 ? <p className="text-sm text-ink-muted">None over the threshold.</p> : (
          <div className={box}><table className="w-full min-w-[40rem] text-left text-sm"><thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink-soft"><tr><th className={th}>Date</th><th className={th}>Organiser</th><th className={th}>Type</th><th className={th}>Charge</th><th className={th}>Estimated fee</th><th className={th}>Stripe actual</th><th className={th}>Variance</th></tr></thead>
            <tbody>{items.map((i) => (<tr key={i.payment_id} className="border-t border-line"><td className="px-3 py-2">{new Date(i.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" })}</td><td className="px-3 py-2 font-semibold">{i.organiser_name}</td><td className="px-3 py-2">{i.kind === "membership" ? "Membership" : "Participation"}</td><td className="px-3 py-2">{pounds(i.charge_pence)}</td><td className="px-3 py-2">{p(i.estimate_pence)}</td><td className="px-3 py-2">{p(i.actual_pence)}</td><td className="px-3 py-2 font-semibold">{p(i.variance_pence)}</td></tr>))}</tbody></table></div>
        )}
      </Panel>

      <Panel title="Disputes" sub="A lost dispute is recovered from the organiser by reversing the transfer. If the organiser's Stripe balance cannot cover it, the recovery stops, their collection is paused, and it waits here for an administrator. Stripe's dispute fee is recorded but not passed on.">
        {disputes.length === 0 ? <p className="text-sm text-ink-muted">No disputes recorded.</p> : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">{disputes.map((d) => (
            <li key={d.dispute_id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-semibold text-ink">{orgOf(d)} <span className="font-normal text-ink-muted">· {d.dispute_id}</span></p>
                  <p className="text-ink-soft">Disputed {pounds(d.amount_pence)} · dispute fee {p(d.fee_pence)} · state {d.state} · recovery {pounds(d.recovery_pence)}: {STATUS[d.status] ?? d.status}{d.blocked ? " (blocked: insufficient balance)" : ""}{d.reason ? ` · ${d.reason}` : ""}</p>
                  {d.last_error ? <p className="break-words text-xs text-rose-700">Last error: {d.last_error}</p> : null}</div>
                {canRetry(d) && open !== d.dispute_id && <button type="button" className={btnSecondary} onClick={() => { setOpen(d.dispute_id); setNote(""); }}>Retry recovery…</button>}
              </div>
              {open === d.dispute_id && (
                <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); act.run(() => retryDisputeRecovery(d.dispute_id, note), { success: "Recovery queued again.", onOk: () => { setOpen(null); router.refresh(); } }); }}>
                  <div className="min-w-[16rem] flex-1"><label htmlFor={`dn-${d.dispute_id}`} className="mb-1 block text-sm font-semibold text-ink">Why is it safe to retry? (at least 5 characters, audited)</label><input id={`dn-${d.dispute_id}`} className={inputCls} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></div>
                  <button type="submit" className={btnPrimary} disabled={act.pending || note.trim().length < 5}>Queue the recovery again</button><button type="button" className={btnSecondary} onClick={() => setOpen(null)}>Cancel</button>
                </form>
              )}
            </li>))}</ul>
        )}
        <Notice msg={act.msg} />
      </Panel>
    </div>
  );
}
