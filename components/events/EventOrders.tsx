"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  pounds, purchaserLabel, ticketSummary, orderStatusBadge, checkedInLabel,
  ticketStatusLabel, paymentMethodLabel, refundConfirmation,
} from "@/lib/event-orders-utils";

/**
 * Organiser ticket orders for one event: who bought tickets, each order's
 * detail, and — for the people allowed to move the money — refunding an order.
 *
 * Nothing sensitive is decided here. The list comes from get_event_orders,
 * which refuses anyone who may not manage the event; whether Refund appears is
 * the server's `refundable` flag for this viewer and this order; and the refund
 * itself is the existing refund-payment function addressed by the ORDER id,
 * which re-checks authority, refunds the customer, reverses the merchant
 * transfer, refunds the platform fee and voids the tickets. This component
 * never sees or sends a Stripe reference.
 */

interface Ticket {
  id: string; ticket_type: string | null; status: string; price_pence: number;
  checked_in_at: string | null; attendee_name: string | null; attendee_email: string | null;
}
interface Order {
  id: string; status: string; payment_method: string; created_at: string; paid_at: string | null; refunded_at: string | null;
  total_pence: number; booking_fee_pence: number; ticket_subtotal_pence: number; tickets_count: number;
  purchaser: { id: string; name: string | null; email: string | null };
  tickets: Ticket[]; checked_in_count: number; refundable: boolean;
  payment_intent_id: string | null; reconciliation_state: string | null;
}
interface Orders { can_refund: boolean; is_admin: boolean; total_orders: number; orders: Order[] }

const TONE: Record<"ok" | "warn" | "muted" | "danger", { bg: string; fg: string }> = {
  ok: { bg: "#dcfce7", fg: "#166534" },
  warn: { bg: "#fef3c7", fg: "#92400e" },
  muted: { bg: "#f3f4f6", fg: "#374151" },
  danger: { bg: "#fee2e2", fg: "#991b1b" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function EventOrders({ eventId }: { eventId: string }) {
  const confirm = useConfirm();
  const [data, setData] = useState<Orders | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = createClient();
      const { data: d, error: e } = await sb.rpc("get_event_orders", { p_event_id: eventId });
      if (!active) return;
      if (e) { setError(e.message); return; }
      const x = (d ?? {}) as Partial<Orders>;
      setData({ can_refund: x.can_refund === true, is_admin: x.is_admin === true, total_orders: x.total_orders ?? 0, orders: x.orders ?? [] });
      setError(null);
    })();
    return () => { active = false; };
  }, [eventId, reloadKey]);

  async function refund(order: Order) {
    if (refunding) return;
    const c = refundConfirmation(order);
    const ok = await confirm({
      title: c.title,
      body: <div className="space-y-2">{c.message.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}</div>,
      confirmLabel: c.confirmLabel,
      danger: true,
    });
    if (!ok) return;
    setRefunding(true); setNotice(null);
    try {
      const sb = createClient();
      const { data: r, error: err } = await sb.functions.invoke("refund-payment", { body: { event_order_id: order.id } });
      let message = (r as { error?: string } | null)?.error ?? err?.message ?? null;
      if (err && (err as { name?: string }).name === "FunctionsHttpError") {
        const body = await ((err as unknown as { context?: Response }).context?.json?.() ?? Promise.resolve(null)).catch(() => null);
        if (body?.error) message = body.error;
      }
      if (err || (r as { error?: string } | null)?.error) {
        setError(message ?? "The refund could not be completed.");
      } else {
        setError(null);
        setNotice(order.payment_method === "wallet"
          ? `${pounds(order.total_pence)} has been returned to ${purchaserLabel(order)}'s OneShetland Wallet. Their ${order.tickets_count === 1 ? "ticket is" : "tickets are"} no longer valid.`
          : `${pounds(order.total_pence)} has been refunded to ${purchaserLabel(order)}. Their ${order.tickets_count === 1 ? "ticket is" : "tickets are"} no longer valid.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The refund could not be completed.");
    } finally {
      setRefunding(false);
      reload();
    }
  }

  if (!data && !error) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="space-y-3">
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}

      {data && data.orders.length === 0 ? (
        <div className="rounded-2xl border border-line bg-paper p-8 text-center">
          <p className="font-display text-lg font-bold text-ink">No ticket orders yet</p>
          <p className="mt-1 text-sm text-ink-muted">Orders appear here as soon as someone buys tickets.</p>
        </div>
      ) : data ? (
        <>
          <p className="text-xs font-semibold text-ink-muted">
            {data.total_orders} order{data.total_orders === 1 ? "" : "s"}
            {data.total_orders > data.orders.length ? ` · showing the latest ${data.orders.length}` : ""}
          </p>
          {data.orders.map((o) => {
            const badge = orderStatusBadge(o);
            const checked = checkedInLabel(o);
            const open = openId === o.id;
            return (
              <div key={o.id} className="rounded-2xl border border-line bg-paper p-4">
                <button type="button" className="block w-full text-left" onClick={() => setOpenId(open ? null : o.id)} aria-expanded={open}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-base font-bold text-ink">{purchaserLabel(o)}</span>
                    <span className="rounded-full px-3 py-0.5 text-xs font-bold" style={{ background: TONE[badge.tone].bg, color: TONE[badge.tone].fg }}>{badge.label}</span>
                  </div>
                  {o.purchaser.name && o.purchaser.email && <p className="text-sm text-ink-muted">{o.purchaser.email}</p>}
                  <p className="mt-1 text-sm font-semibold text-ink-soft">{ticketSummary(o)}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-display text-lg font-bold text-ink">{pounds(o.total_pence)}</span>
                    <span className="text-xs text-ink-faint">{fmt(o.paid_at ?? o.created_at)}{checked ? ` · ${checked}` : ""}</span>
                  </div>
                  {o.status === "refunded" && o.refunded_at && <p className="mt-1 text-xs font-semibold text-rose-700">Refunded {fmt(o.refunded_at)}</p>}
                </button>

                {open && (
                  <div className="mt-3 space-y-3 border-t border-line pt-3">
                    {o.purchaser.email && <p className="text-sm text-ink">{o.purchaser.email}</p>}
                    <dl className="space-y-1 text-sm">
                      <Row k="Paid" v={pounds(o.total_pence)} strong />
                      <Row k="Paid with" v={paymentMethodLabel(o)} />
                      {o.total_pence > 0 && <Row k="Tickets" v={pounds(o.ticket_subtotal_pence)} />}
                      {o.booking_fee_pence > 0 && <Row k="Booking fee" v={pounds(o.booking_fee_pence)} />}
                      <Row k="Purchased" v={fmt(o.paid_at ?? o.created_at)} />
                      {o.status === "refunded" && <Row k="Refunded" v={o.refunded_at ? `${pounds(o.total_pence)} · ${fmt(o.refunded_at)}` : pounds(o.total_pence)} />}
                      <Row k="Order" v={o.id.slice(0, 8)} />
                      {data.is_admin && o.payment_intent_id && <Row k="Payment ref" v={o.payment_intent_id} />}
                      {data.is_admin && o.reconciliation_state && <Row k="Reconciliation" v={o.reconciliation_state} />}
                    </dl>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Tickets ({o.tickets_count})</p>
                      <ul className="mt-1 divide-y divide-line">
                        {o.tickets.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <span>
                              <span className="font-semibold text-ink">{t.ticket_type ?? "Ticket"}</span>
                              {(t.attendee_name || t.attendee_email) && <span className="block text-xs text-ink-muted">{[t.attendee_name, t.attendee_email].filter(Boolean).join(" · ")}</span>}
                              {t.checked_in_at && <span className="block text-xs text-ink-muted">Checked in {fmt(t.checked_in_at)}</span>}
                            </span>
                            <span className={"text-xs font-bold " + (t.status === "refunded" ? "text-rose-700" : "text-ink-soft")}>{ticketStatusLabel(t.status)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {o.refundable ? (
                      <button
                        onClick={() => refund(o)} disabled={refunding}
                        className="rounded-pill px-5 py-2 text-sm font-bold text-paper disabled:opacity-50"
                        style={{ background: "#991b1b" }}
                      >
                        {refunding ? "Refunding…" : "Refund order"}
                      </button>
                    ) : o.status === "paid" && o.total_pence > 0 && !data.can_refund ? (
                      <p className="text-sm text-ink-muted">Only the business owner, or OneShetland, can refund this order.</p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{k}</dt>
      <dd className={"text-right text-ink " + (strong ? "font-bold" : "font-semibold")}>{v}</dd>
    </div>
  );
}
