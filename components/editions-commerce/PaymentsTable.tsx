"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestRefund } from "@/app/organise/commerce-actions";
import { PAY_STATUS_LABEL, SOURCE_LABEL, METHOD_LABEL, pounds, type OrgPayment, type StatementRow } from "@/lib/editions/commerce";
import { Field, Notice, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

const TONE = { succeeded: "green", pending: "amber", failed: "red", refunded: "gray", partially_refunded: "amber", disputed: "red", voided: "gray" } as const;

/** The organiser's ledger: gross, platform fee, VAT, net, refunds, for card and offline payments alike, with a refund action for card payments. */
export function PaymentsTable({ slug, rows, statement, canRefund, csvAllowed }: { slug: string; rows: OrgPayment[]; statement: StatementRow[]; canRefund: boolean; csvAllowed: boolean }) {
  const router = useRouter(); const act = useAction();
  const [open, setOpen] = useState<string | null>(null); const [amount, setAmount] = useState(""); const [reason, setReason] = useState("");
  const totals = rows.filter((r) => r.source === "stripe" && r.status !== "failed").reduce((a, r) => ({ gross: a.gross + r.charge_pence, fee: a.fee + r.platform_fee_pence, net: a.net + r.net_to_organiser_pence }), { gross: 0, fee: 0, net: 0 });
  return (
    <div className="space-y-6">
      {statement.length > 0 && (
        <section aria-labelledby="st-h"><h2 id="st-h" className="font-display text-xl font-bold text-ink">By month</h2>
          <div className="mt-3 overflow-x-auto rounded-card border border-line bg-paper"><table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink-soft"><tr><th className="px-3 py-2">Month</th><th className="px-3 py-2">Payments</th><th className="px-3 py-2">Card total</th><th className="px-3 py-2">Platform fee</th><th className="px-3 py-2">Paid to you</th><th className="px-3 py-2">Outside OneShetland</th><th className="px-3 py-2">Refunded</th></tr></thead>
            <tbody>{statement.map((s) => (<tr key={s.month} className="border-t border-line"><td className="px-3 py-2 font-semibold">{s.month}</td><td className="px-3 py-2">{s.payments}</td><td className="px-3 py-2">{pounds(s.gross_pence ?? 0)}</td><td className="px-3 py-2">{pounds(s.platform_fee_pence ?? 0)}</td><td className="px-3 py-2">{pounds(s.net_to_organiser_pence ?? 0)}</td><td className="px-3 py-2">{pounds(s.offline_pence ?? 0)}</td><td className="px-3 py-2">{pounds(s.refunded_pence ?? 0)}</td></tr>))}</tbody>
          </table></div></section>
      )}
      <section aria-labelledby="pay-h">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="pay-h" className="font-display text-xl font-bold text-ink">Payments ({rows.length})</h2>
          {csvAllowed ? <a href={`/organise/${slug}/payments/export.csv`} download className={btnSecondary}>Download CSV</a> : <span className="text-sm text-ink-muted">CSV export is part of larger packages.</span>}</div>
        <p className="mt-1 text-sm text-ink-soft">Card payments total {pounds(totals.gross)}: {pounds(totals.fee)} platform fee, {pounds(totals.net)} paid to you.</p>
        {rows.length === 0 ? <p className="mt-3 rounded-card border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">No payments yet.</p> : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
            {rows.map((r) => (
              <li key={r.payment_id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><p className="font-semibold text-ink">{r.business_name} <span className="font-normal text-ink-muted">· {r.kind === "membership" ? "Membership" : "Edition"}{r.ref_label ? `: ${r.ref_label}` : ""}</span></p>
                    <p className="text-sm text-ink-soft">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" })} · {SOURCE_LABEL[r.source] ?? r.source}{r.method ? ` (${METHOD_LABEL[r.method] ?? r.method})` : ""}{r.note ? ` · ${r.note}` : ""}</p></div>
                  <div className="text-right"><p className="font-bold tabular-nums text-ink">{pounds(r.charge_pence)}</p><Pill label={PAY_STATUS_LABEL[r.status]} tone={TONE[r.status]} /></div>
                </div>
                {r.source === "stripe" && <p className="mt-1 text-xs text-ink-muted">Fee {pounds(r.platform_fee_pence)} · VAT {pounds(r.vat_pence)} · to you {pounds(r.net_to_organiser_pence)}{r.refunded_pence ? ` · refunded ${pounds(r.refunded_pence)}` : ""}</p>}
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
