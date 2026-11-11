import Link from "next/link";
import { dayLabel, editionState, packageView, STATE_LABEL, STATE_TONE } from "@/lib/editions/journey";
import { pounds, type Pkg } from "@/lib/editions/commerce";
import type { ReviewState } from "@/lib/editions/types";
import { PackageCardBody } from "@/components/editions-manage/PackageStep";
import { EmptyState, Pill, btnPrimary, btnSecondary } from "@/components/editions-manage/kit";

type Ed = { slug: string; title: string; status: "draft" | "published" | "archived" | "suspended"; review_state: ReviewState; activeUntil: string | null };
type Order = { id: string; edition_id: string; status: string; amount_pence: number; created_at: string; paid_at: string | null; package_snapshot: { name?: string } };

/**
 * An overview of what is on offer and where each Edition stands. A package is chosen inside an Edition, once OneShetland has approved it; this page links there.
 * Prices come from the database; nothing here can buy anything.
 */
export function PackagesPanel({ slug, packages, editions, orders, isAdmin, commerceOn, vatNote = "" }: { slug: string; packages: Pkg[]; editions: Ed[]; orders: Order[]; isAdmin: boolean; commerceOn: boolean; vatNote?: string }) {
  return (
    <div className="space-y-8">
      {!commerceOn && <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">Online payment is not available yet. Free packages can still be chosen.</p>}

      <section aria-labelledby="pk-eds">
        <h2 id="pk-eds" className="font-display text-xl font-bold text-ink">Your Editions</h2>
        <p className="mt-1 text-sm text-ink-soft">You choose a package inside each Edition, after OneShetland has approved it.</p>
        {editions.length === 0 ? <div className="mt-3"><EmptyState>No Editions yet.</EmptyState></div> : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
            {editions.map((e) => {
              const st = editionState(e);
              const base = `/organise/${slug}/editions/${e.slug}`;
              return (
                <li key={e.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0"><span className="block truncate font-semibold text-ink">{e.title}</span>
                    <span className="text-ink-muted">{e.activeUntil ? `Package active until ${dayLabel(e.activeUntil)}` : e.review_state === "approved" ? "Approved: choose a package" : "A package can be chosen after approval"}</span></span>
                  <span className="flex items-center gap-2"><Pill label={STATE_LABEL[st]} tone={STATE_TONE[st]} />
                    {e.review_state === "approved" && !e.activeUntil && isAdmin ? <Link href={`${base}/package`} className={btnPrimary + " !px-4 !py-1.5"}>Choose a package</Link> : <Link href={base} className={btnSecondary + " !px-4 !py-1.5"}>Open</Link>}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="pk-offer">
        <h2 id="pk-offer" className="font-display text-xl font-bold text-ink">Packages on offer</h2>
        {packages.length === 0 ? <div className="mt-3"><EmptyState>No packages are available right now.</EmptyState></div> : (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">{packages.map((p) => <li key={p.id} className="rounded-card border border-line bg-paper p-5 shadow-soft"><PackageCardBody v={packageView(p, { commerceOn, vatNote })} /></li>)}</ul>
        )}
      </section>

      {orders.length > 0 && (
        <section aria-labelledby="ord-h"><h2 id="ord-h" className="font-display text-xl font-bold text-ink">Your orders</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">{orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="font-semibold text-ink">{o.package_snapshot?.name ?? "Package"} <span className="font-normal text-ink-muted">· {new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></span>
              <span className="flex items-center gap-2">{o.amount_pence === 0 ? "Free" : pounds(o.amount_pence)} <Pill label={o.status === "paid" ? (o.amount_pence === 0 ? "Chosen" : "Paid") : o.status === "pending" ? "Not paid" : o.status === "failed" ? "Failed" : o.status === "refunded" ? "Refunded" : o.status} tone={o.status === "paid" ? "green" : o.status === "failed" ? "red" : "gray"} /></span></li>))}
          </ul></section>
      )}
    </div>
  );
}
