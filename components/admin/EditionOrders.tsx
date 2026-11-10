"use client";

import { useState } from "react";
import { requestOrderRefundAction } from "@/app/admin/editions/actions";
import { btn, btnDanger, Label, field, useRun } from "@/components/admin/EditionsAdminForms";
import type { OrderRow, RefundRow } from "@/app/admin/editions/queries";

const money = (p: number) => `£${(p / 100).toFixed(2)}`;
const STATUS_WORDS: Record<string, string> = { pending: "Pending payment", paid: "Paid", failed: "Payment failed", cancelled: "Cancelled", refunded: "Refunded", partially_refunded: "Partly refunded" };
const REFUND_WORDS: Record<RefundRow["status"], string> = { pending: "Waiting to be sent to the card company", submitted: "Sent to the card company", done: "Refunded", failed: "Failed: needs attention" };

/** One package order: what was paid, any refunds and their progress, and a refund control that asks for confirmation. */
export function OrderRefund({ order, editionId, refunds }: { order: OrderRow; editionId: string; refunds: RefundRow[] }) {
  const { pending, run, note } = useRun();
  const [open, setOpen] = useState(false), [amount, setAmount] = useState(""), [why, setWhy] = useState("");
  const left = order.amount_pence - order.refunded_pence;
  const canRefund = !order.free && order.amount_pence > 0 && left > 0 && (order.status === "paid" || order.status === "partially_refunded");
  const open_ = refunds.some((r) => r.status === "pending" || r.status === "submitted");
  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-ink">{order.package_name ?? "Package"}</span>
        <span className="rounded-pill bg-sand px-2.5 py-0.5 text-xs font-bold text-ink">{order.free ? "Free package" : STATUS_WORDS[order.status] ?? order.status}</span>
        <span className="text-sm text-ink-soft">{order.free ? "No payment" : money(order.amount_pence)}{order.refunded_pence > 0 ? `, ${money(order.refunded_pence)} refunded` : ""}</span>
        {order.buyer_name && <span className="text-xs text-ink-muted">bought by {order.buyer_name}</span>}
      </div>
      {refunds.length > 0 && <ul className="mt-2 space-y-1 text-sm text-ink-soft">{refunds.map((r) => <li key={r.request_id}>Refund of {money(r.amount_pence)}: {REFUND_WORDS[r.status]}{r.status === "failed" && r.last_error ? ` (${r.last_error})` : ""}. {r.reason}</li>)}</ul>}
      {canRefund && !open_ && (!open ? <button type="button" onClick={() => setOpen(true)} className={btn + " mt-2"}>Refund…</button> : (
        <div className="mt-2 space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="text-sm font-semibold text-rose-900">A full refund ends this package, so the Edition stops being public. A partial refund leaves it live. {money(left)} can still be refunded.</p>
          <div><Label htmlFor={`rf-a-${order.order_id}`}>Amount in pounds (leave empty to refund everything left)</Label><input id={`rf-a-${order.order_id}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={field + " max-w-48"} /></div>
          <div><Label htmlFor={`rf-r-${order.order_id}`}>Why are you refunding? (kept in the audit log)</Label><input id={`rf-r-${order.order_id}`} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={300} className={field} /></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending || why.trim().length < 5} onClick={() => run(() => requestOrderRefundAction({ orderId: order.order_id, editionId, amount, reason: why }), "Refund requested. It will be sent to the card company shortly.", () => { setOpen(false); setAmount(""); setWhy(""); })} className={btnDanger}>Yes, request the refund</button>
            <button type="button" onClick={() => setOpen(false)} className={btn}>Cancel</button>
          </div>
        </div>
      ))}
      {note}
    </li>
  );
}
