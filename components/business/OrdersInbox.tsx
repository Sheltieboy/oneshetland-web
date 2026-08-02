"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { gbp, ORDER_STATUS_LABEL } from "@/lib/shop-data";

/**
 * OrdersInbox — the merchant's order pipeline. One-tap state moves:
 *   paid → accepted → ready (collect) | posted (+tracking) → completed
 * Buyers get pushes on each move via the DB → notify path (Phase 1: the
 * status change itself; richer notifications ride the existing spine).
 */

type OrderRow = {
  id: string;
  status: string;
  fulfilment: string;
  items_pence: number;
  shipping_pence: number;
  total_pence: number;
  delivery_name: string | null;
  delivery_address: string | null;
  delivery_postcode: string | null;
  contact_phone: string | null;
  buyer_note: string | null;
  tracking_ref: string | null;
  created_at: string;
  paid_at: string | null;
  items: { title: string; variant_name: string | null; qty: number; unit_pence: number }[];
};

const ACTIVE = ["paid", "accepted", "ready", "handed_over", "posted"];
const NEXT: Record<string, { label: string; to: string; forFulfilment?: string }[]> = {
  paid: [{ label: "Accept order", to: "accepted" }],
  accepted: [
    { label: "Ready to collect", to: "ready", forFulfilment: "collect" },
    { label: "Ready for the driver", to: "ready", forFulfilment: "fetch" },
    { label: "Mark as posted", to: "posted", forFulfilment: "post" },
  ],
  // fetch orders leave 'ready' via the driver (collected → delivered syncs the
  // order automatically), so no merchant button for that lane.
  ready: [{ label: "Collected — complete", to: "completed", forFulfilment: "collect" }],
  posted: [{ label: "Complete", to: "completed" }],
  handed_over: [{ label: "Complete", to: "completed" }],
};

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-amber-100 text-amber-700",
  accepted: "bg-sky-100 text-sky-700",
  ready: "bg-emerald-100 text-emerald-700",
  posted: "bg-emerald-100 text-emerald-700",
  handed_over: "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-rose-100 text-rose-700",
  refunded: "bg-rose-100 text-rose-700",
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

function OrderCard({ o }: { o: OrderRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(o.tracking_ref ?? "");
  const [err, setErr] = useState<string | null>(null);

  async function move(to: string) {
    setBusy(true); setErr(null);
    try {
      const sb = createClient();
      const patch: Record<string, unknown> = { status: to };
      const stamp = new Date().toISOString();
      if (to === "accepted") patch.accepted_at = stamp;
      if (to === "ready") patch.ready_at = stamp;
      if (to === "posted") { patch.posted_at = stamp; if (tracking.trim()) patch.tracking_ref = tracking.trim(); }
      if (to === "completed") patch.completed_at = stamp;
      const { error } = await sb.from("product_orders").update(patch).eq("id", o.id);
      if (error) throw error;
      // Tell the buyer their order moved — fire-and-forget.
      sb.functions.invoke("notify-product-order", { body: { order_id: o.id } }).catch(() => {});
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't update"); }
    finally { setBusy(false); }
  }

  const actions = (NEXT[o.status] ?? []).filter((a) => !a.forFulfilment || a.forFulfilment === o.fulfilment);

  return (
    <li className="rounded-card border border-line bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-600"}`}>
          {ORDER_STATUS_LABEL[o.status] ?? o.status}
        </span>
        <span className="rounded-pill border border-line px-2.5 py-0.5 text-xs font-bold capitalize text-ink-soft">{o.fulfilment}</span>
        <span className="text-xs text-ink-muted">{fmt(o.paid_at ?? o.created_at)}</span>
        <span className="ml-auto font-display text-lg font-bold text-navy">{gbp(o.total_pence)}</span>
      </div>

      <ul className="mt-2 space-y-0.5 text-sm text-ink">
        {o.items.map((it, i) => (
          <li key={i}>{it.qty} × {it.title}{it.variant_name ? ` (${it.variant_name})` : ""} — {gbp(it.unit_pence * it.qty)}</li>
        ))}
        {o.shipping_pence > 0 && <li className="text-ink-muted">Postage — {gbp(o.shipping_pence)}</li>}
      </ul>

      {(o.fulfilment === "post" || o.fulfilment === "fetch") && o.delivery_address && (
        <p className="mt-2 rounded-xl bg-cream/70 p-2.5 text-sm text-ink-soft">
          {o.fulfilment === "fetch" ? "🚗" : "📮"} {o.delivery_name} · {o.delivery_address}, {o.delivery_postcode}{o.contact_phone ? ` · ${o.contact_phone}` : ""}
        </p>
      )}
      {o.fulfilment === "fetch" && o.status === "ready" && (
        <p className="mt-2 text-sm text-ink-muted">Waiting for a Fetch driver to collect — the order updates itself from here.</p>
      )}
      {o.buyer_note && <p className="mt-2 text-sm italic text-ink-soft">“{o.buyer_note}”</p>}
      {o.tracking_ref && <p className="mt-1 text-xs text-ink-muted">Tracking: {o.tracking_ref}</p>}

      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {o.status === "accepted" && o.fulfilment === "post" && (
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking ref (optional)"
              className="min-w-40 flex-1 rounded-lg border border-line px-2 py-1.5 text-sm" aria-label="Tracking reference" />
          )}
          {actions.map((a) => (
            <button key={a.to} onClick={() => move(a.to)} disabled={busy}
              className="rounded-pill bg-navy px-4 py-1.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50">
              {a.label}
            </button>
          ))}
        </div>
      )}
      {err && <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}
    </li>
  );
}

export function OrdersInbox({ orders }: { orders: OrderRow[] }) {
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const past = orders.filter((o) => !ACTIVE.includes(o.status) && o.status !== "pending" && o.status !== "expired");

  return (
    <div className="space-y-8">
      {active.length === 0 ? (
        <div className="rounded-card border border-line bg-white p-10 text-center">
          <p className="font-display font-bold text-navy">No orders on the go</p>
          <p className="mt-1 text-sm text-ink-soft">New orders land here the moment they&rsquo;re paid — you&rsquo;ll get a notification too.</p>
        </div>
      ) : (
        <ul className="space-y-3">{active.map((o) => <OrderCard key={o.id} o={o} />)}</ul>
      )}
      {past.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-lg font-bold text-navy">Done &amp; dusted</h2>
          <ul className="space-y-3">{past.slice(0, 20).map((o) => <OrderCard key={o.id} o={o} />)}</ul>
        </div>
      )}
    </div>
  );
}
