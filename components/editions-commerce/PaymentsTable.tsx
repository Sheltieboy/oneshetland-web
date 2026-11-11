"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestRefund } from "@/app/organise/commerce-actions";
import { PAY_STATUS_LABEL, SOURCE_LABEL, METHOD_LABEL, feeExplanation, monthlyRetained, paymentBreakdown, type CommissionRates, pounds, type OrgPayment, type StatementRow } from "@/lib/editions/commerce";
import { Field, Notice, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

const TONE = { succeeded: "green", pending: "amber", failed: "red", refunded: "gray", partially_refunded: "amber", disputed: "red", voided: "gray" } as const;

/** The organiser's ledger: price paid, commission, estimated card processing fee, VAT, net, refunds, for card and offline payments alike, with a refund action for card payments. */
export function PaymentsTable({ slug, rows, statement, canRefund, csvAllowed, rates }: { slug: string; rows: OrgPayment[]; statement: StatementRow[]; canRefund: boolean; csvAllowed: boolean; rates?: CommissionRates }) {
  const router = useRouter(); const act = useAction();
  const [open, setOpen] = useState<string | null>(null); const [amount, setAmount] = useState(""); const [reason, setReason] = useState("");
  const retainedByMonth = monthlyRetained(rows);
  const totals = rows.filter((r) => r.source === "stripe" && r.status !== "failed").reduce((a, r) => { const b = paymentBreakdown(r); return { gross: a.gross + b.paid, commission: a.commission + b.commission, estimate: a.estimate + b.estimate, net: a.net + b.net, netAfter: a.netAfter + b.netAfter }; }, { gross: 0, commission: 0, estimate: 0, net: 0, netAfter: 0 });
  return (
    <div className="space-y-6">
      {statement.length > 0 && (
        <section aria-labelledby="st-h"><h2 id="st-h" className="font-display text-xl font-bold text-ink">By month</h2>
          <div className="mt-3 overflow-x-auto rounded-card border border-line bg-paper"><table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink-soft"><tr><th className="px-3 py-2">Month</th><th className="px-3 py-2">Payments</th><th className="px-3 py-2">Card total</th><th className="px-3 py-2">Commission</th><th className="px-3 py-2">Estimated card processing fee</th><th className="px-3 py-2">Net before refunds</th><th className="px-3 py-2">Processing cost retained on refunds</th><th className="px-3 py-2">What you received (after refunds)</th><th className="px-3 py-2">Outside OneShetland</th><th className="px-3 py-2">Refunded</th></tr></thead>
            <tbody>{statement.map((s) => (<tr key={s.month} className="border-t border-line"><td className="px-3 py-2 font-semibold">{s.month}</td><td className="px-3 py-2">{s.payments}</td><td className="px-3 py-2">{pounds(s.gross_pence ?? 0)}</td><td className="px-3 py-2">{pounds(s.commission_pence ?? s.platform_fee_pence ?? 0)}</td><td className="px-3 py-2">{pounds(s.processing_fee_estimate_pence ?? 0)}</td><td className="px-3 py-2">{pounds(s.net_to_organiser_pence ?? 0)}</td><td className="px-3 py-2">{pounds(retainedByMonth[s.month] ?? 0)}</td><td className="px-3 py-2 font-semibold">{pounds(s.net_after_refunds_pence ?? s.net_to_organiser_pence ?? 0)}</td><td className="px-3 py-2">{pounds(s.offline_pence ?? 0)}</td><td className="px-3 py-2">{pounds(s.refunded_pence ?? 0)}</td></tr>))}</tbody>
          </table></div></section>
      )}
      <section aria-labelledby="pay-h">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="pay-h" className="font-display text-xl font-bold text-ink">Payments ({rows.length})</h2>
          {csvAllowed ? <a href={`/organise/${slug}/payments/export.csv`} download className={btnSecondary}>Download CSV</a> : <span className="text-sm text-ink-muted">CSV export is part of larger packages.</span>}</div>
        <p id="fee-explainer" role="note" className="mt-2 max-w-2xl rounded-card border border-line bg-sand/50 px-4 py-3 text-sm text-ink-soft">{feeExplanation(rates ?? { participation: null, membership: null })}</p>
        <p className="mt-2 text-sm text-ink-soft">Card payments total {pounds(totals.gross)}: {pounds(totals.commission)} commission, {pounds(totals.estimate)} estimated card processing fee, {pounds(totals.net)} net before refunds, {pounds(totals.netAfter)} received after refunds.</p>
        {rows.length === 0 ? <p className="mt-3 rounded-card border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">No payments yet.</p> : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
            {rows.map((r) => (
              <li key={r.payment_id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><p className="font-semibold text-ink">{r.business_name} <span className="font-normal text-ink-muted">· {r.kind === "membership" ? "Membership" : "Edition"}{r.ref_label ? `: ${r.ref_label}` : ""}</span></p>
                    <p className="text-sm text-ink-soft">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" })} · {SOURCE_LABEL[r.source] ?? r.source}{r.method ? ` (${METHOD_LABEL[r.method] ?? r.method})` : ""}{r.note ? ` · ${r.note}` : ""}</p></div>
                  <div className="text-right"><p className="font-bold tabular-nums text-ink">{pounds(r.charge_pence)}</p><Pill label={PAY_STATUS_LABEL[r.status]} tone={TONE[r.status]} /></div>
                </div>
                {r.source === "stripe" && (() => { const b = paymentBreakdown(r); return (
                  <dl className="mt-2 grid gap-x-6 gap-y-0.5 text-xs text-ink-muted sm:grid-cols-2">
                    <div className="flex justify-between"><dt>Customer paid</dt><dd className="tabular-nums">{pounds(b.paid)}</dd></div>
                    <div className="flex justify-between"><dt>OneShetland commission</dt><dd className="tabular-nums">{pounds(b.commission)}</dd></div>
                    <div className="flex justify-between"><dt>Estimated card processing fee</dt><dd className="tabular-nums">{pounds(b.estimate)}</dd></div>
                    {r.vat_pence ? <div className="flex justify-between"><dt>VAT</dt><dd className="tabular-nums">{pounds(r.vat_pence)}</dd></div> : null}
                    <div className="flex justify-between"><dt>Net before refunds</dt><dd className="tabular-nums">{pounds(b.net)}</dd></div>
                    {b.refunded > 0 && <div className="flex justify-between"><dt>Refunded to customer</dt><dd className="tabular-nums">{pounds(b.refunded)}</dd></div>}
                    {b.refunded > 0 && <div className="flex justify-between"><dt>Commission returned to you</dt><dd className="tabular-nums">{pounds(b.commissionReturned)}</dd></div>}
                    {b.refunded > 0 && <div className="flex justify-between"><dt>Processing cost kept (not returned by Stripe)</dt><dd className="tabular-nums">{pounds(b.retained)}</dd></div>}
                    {b.disputeRecovered > 0 && <div className="flex justify-between"><dt>Recovered for a lost dispute</dt><dd className="tabular-nums">{pounds(b.disputeRecovered)}</dd></div>}
                    <div className="flex justify-between font-semibold text-ink"><dt>Net to you after refunds</dt><dd className="tabular-nums">{pounds(b.netAfter)}</dd></div>
                  </dl>); })()}
                {canRefund && r.source === "stripe" && ["succeeded", "partially_refunded"].includes(r.status) && r.charge_pence > r.refunded_pence && (
                  open === r.payment_id ? (
                    <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); act.run(() => requestRefund(slug, r.payment_id, amount, reason), { success: "Refund requested.", onOk: () => { setOpen(null); router.refresh(); } }); }}>
                      <Field label="Refund amount (£)" htmlFor={`ra-${r.payment_id}`}><input id={`ra-${r.payment_id}`} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={((r.charge_pence - r.refunded_pence) / 100).toFixed(2)} /></Field>
                      <Field label="Reason" htmlFor={`rr-${r.payment_id}`}><input id={`rr-${r.payment_id}`} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
                      <button type="submit" className={btnPrimary} disabled={act.pending}>Refund</button><button type="button" className={btnSecondary} onClick={() => setOpen(null)}>Cancel</button>
                    </form>
                  ) : <button type="button" className={`${btnQuiet} mt-1`} onClick={() => { setOpen(r.payment_id); setAmount(""); setReason(""); }}>Refund…</button>
                )}
              </li>
            ))}
          </ul>
        )}
        <Notice msg={act.msg} />
      </section>
    </div>
  );
}
