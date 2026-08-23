import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gbp, ORDER_STATUS_LABEL } from "@/lib/shop-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your orders" };

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

/** How the goods reach the buyer, in the buyer's words. */
const FULFILMENT_LABEL: Record<string, string> = {
  collect: "Collect from the shop",
  post: "By post",
  fetch: "Delivered by a local driver",
};

/** The short reference a buyer quotes to a shop. Never the full row id. */
const orderRef = (id: string) => id.slice(0, 8).toUpperCase();

const BUYER_STATUS: Record<string, string> = {
  paid: "Order received",
  accepted: "Being prepared",
  ready: "Ready to collect 🎉",
  posted: "In the post 📮",
  handed_over: "On its way",
  completed: "Done",
};

export default async function OrdersPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/orders");

  const sb = await createClient();
  const { data: orders } = await sb
    .from("product_orders")
    .select("id, status, fulfilment, total_pence, tracking_ref, created_at, paid_at, business:local_businesses(name, slug, id), items:product_order_items(title, variant_name, qty)")
    .eq("buyer_id", account.id)
    .neq("status", "pending")
    .neq("status", "expired")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (orders ?? []) as unknown as {
    id: string; status: string; fulfilment: string; total_pence: number; tracking_ref: string | null;
    created_at: string; paid_at: string | null;
    business: { name: string; slug: string | null; id: string } | null;
    items: { title: string; variant_name: string | null; qty: number }[];
  }[];

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href="/account" className="text-sm font-semibold text-ink-soft hover:text-ink">← Account</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl">Your orders</h1>

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-white p-10 text-center">
          <p className="font-display font-bold text-navy">No orders yet</p>
          <p className="mt-1 text-sm text-ink-soft">When you buy from a Shetland shop it&rsquo;ll show up here.</p>
          <Link href="/directory" className="mt-4 inline-block rounded-pill bg-navy px-5 py-2 text-sm font-bold text-white">Browse the Directory</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => (
            <li key={o.id} className="rounded-card border border-line bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {o.fulfilment === "fetch" && o.status === "ready" ? "Waiting for a driver 🚗"
                    : o.fulfilment === "fetch" && o.status === "handed_over" ? "With your driver 🚗"
                    : BUYER_STATUS[o.status] ?? ORDER_STATUS_LABEL[o.status] ?? o.status}
                </span>
                <span className="text-xs text-ink-muted">
                  {new Date(o.paid_at ?? o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  {o.business ? <> · from <Link href={`/directory/${o.business.slug || o.business.id}`} className="font-semibold underline">{o.business.name}</Link></> : null}
                </span>
                <span className="ml-auto font-display font-bold text-navy">{gbp(o.total_pence)}</span>
              </div>
              <p className="mt-1.5 text-sm text-ink-soft">
                {o.items.map((it) => `${it.qty} × ${it.title}${it.variant_name ? ` (${it.variant_name})` : ""}`).join(" · ")}
              </p>
              {/* How it reaches you, and the reference to quote the shop. */}
              <p className="mt-1 text-xs text-ink-muted">
                {FULFILMENT_LABEL[o.fulfilment] ?? o.fulfilment} · Ref {orderRef(o.id)}
              </p>
              {o.status === "posted" && o.tracking_ref && (
                <p className="mt-1 text-xs text-ink-muted">Tracking: {o.tracking_ref}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
