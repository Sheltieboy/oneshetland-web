"use client";
import Link from "next/link";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPackageOrder } from "@/app/organise/commerce-actions";
import { FEATURE_LABEL, pounds, type Pkg } from "@/lib/editions/commerce";
import { PayButton } from "@/components/editions-manage/PayButton";
import { useAttemptId } from "@/lib/use-attempt-id";
import { EmptyState, Field, Notice, Pill, btnPrimary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

type Ed = { slug: string; title: string };
type Order = { id: string; edition_id: string; status: string; amount_pence: number; created_at: string; paid_at: string | null; package_snapshot: { name?: string } };

/** What an organiser buys from OneShetland to publish an Edition and unlock memberships and payments. Price comes from the database; the button sends an id only. */
export function PackagesPanel({ slug, packages, editions, orders, isOwner, commerceOn }: { slug: string; packages: Pkg[]; editions: Ed[]; orders: Order[]; isOwner: boolean; commerceOn: boolean }) {
  const router = useRouter(); const [ed, setEd] = useState(editions[0]?.slug ?? ""); const [pending, setPending] = useState<{ orderId: string; pkg: Pkg } | null>(null);
  const create = useAction(); const attempt = useAttemptId(`${ed}`);
  return (
    <div className="space-y-8">
      {!commerceOn && <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">Buying packages is not switched on yet. To get one activated, <Link href="/support" className="font-semibold underline">ask OneShetland</Link> and we will set it up with you.</p>}
      {packages.length === 0 ? <EmptyState>No packages are on sale right now.</EmptyState> : (<>
        {editions.length > 0 && <Field label="Which Edition is it for?" htmlFor="pk-ed"><select id="pk-ed" className={inputCls} value={ed} onChange={(e) => setEd(e.target.value)}>{editions.map((x) => <option key={x.slug} value={x.slug}>{x.title}</option>)}</select></Field>}
        <ul className="grid gap-4 sm:grid-cols-2">{packages.map((p) => (
          <li key={p.id} className="rounded-card border border-line bg-paper p-5 shadow-soft"><h2 className="font-display text-xl font-bold text-ink">{p.name}</h2>{p.audience === "hub" && <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Community rate for Hub-run Editions</p>}<p className="mt-1 text-2xl font-bold text-ink">{pounds(p.price_pence)}</p><p className="text-sm text-ink-muted">for {Math.round(p.duration_days / 30.4)} months</p>
            {p.description && <p className="mt-2 text-sm text-ink-soft">{p.description}</p>}
            <ul className="mt-3 list-disc pl-5 text-sm text-ink-soft"><li>Publish your Edition</li>{p.features.map((f) => <li key={f}>{FEATURE_LABEL[f] ?? f}</li>)}{p.max_members ? <li>Up to {p.max_members} members</li> : null}</ul>
            {isOwner && commerceOn && editions.length > 0 && <div className="mt-4"><button type="button" className={btnPrimary} disabled={create.pending} onClick={() => create.run(() => createPackageOrder(slug, ed, p.id, attempt()), { onOk: (r) => setPending({ orderId: (r as unknown as { orderId: string }).orderId, pkg: p }) })}>Choose this package</button></div>}</li>))}</ul>
        <Notice msg={create.msg} />
        {pending && <div className="rounded-card border border-line bg-paper p-5 shadow-soft"><h2 className="font-display text-lg font-bold text-ink">Pay for {pending.pkg.name}</h2><p className="mb-3 text-sm text-ink-soft">{pounds(pending.pkg.price_pence)} for {editions.find((x) => x.slug === ed)?.title}.</p><PayButton kind="order" id={pending.orderId} label={`Pay ${pounds(pending.pkg.price_pence)}`} amountPence={pending.pkg.price_pence} /><button type="button" className="ml-3 text-sm font-semibold text-navy hover:underline" onClick={() => { setPending(null); router.refresh(); }}>Done</button></div>}
      </>)}
      {orders.length > 0 && (<section aria-labelledby="ord-h"><h2 id="ord-h" className="font-display text-xl font-bold text-ink">Your orders</h2><ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">{orders.map((o) => (
        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="font-semibold text-ink">{o.package_snapshot?.name ?? "Package"} <span className="font-normal text-ink-muted">· {new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></span><span className="flex items-center gap-2">{pounds(o.amount_pence)} <Pill label={o.status === "paid" ? "Paid" : o.status === "pending" ? "Not paid" : o.status === "failed" ? "Failed" : o.status === "refunded" ? "Refunded" : o.status} tone={o.status === "paid" ? "green" : o.status === "failed" ? "red" : "gray"} /></span></li>))}</ul></section>)}
    </div>
  );
}
