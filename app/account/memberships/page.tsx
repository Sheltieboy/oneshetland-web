import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import {
  getMyHubMemberships, getMyEndedMemberships, getMyMembershipPurchases,
  type MembershipPurchase,
} from "@/lib/hubs-server";
import { isMembershipActive, retainsPaidTime, type HubMember } from "@/lib/hubs-data";
import { MembershipCard } from "@/components/hubs/MembershipCard";
import { gbp } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "My memberships" };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const METHOD_LABEL: Record<string, string> = {
  card:    "Paid by card",
  wallet:  "Paid from wallet",
  unknown: "Paid",
};

/**
 * Cards for what you hold now, and — separately — what you have paid for.
 *
 * Those are not the same list and never were: a membership card disappears the
 * moment it lapses or you leave, while the payment stays a fact. Leaving used
 * to delete the row that held both, so the receipt went with the card. The
 * payment history below comes from hub_membership_purchases, which nothing in
 * the app can delete.
 */
export default async function MembershipsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/memberships");

  const [all, ended, purchases] = await Promise.all([
    getMyHubMemberships(),
    getMyEndedMemberships(),
    getMyMembershipPurchases(),
  ]);
  const memberships = all.filter(isMembershipActive);
  const spent = purchases.reduce((sum, p) => sum + (p.total_pence ?? p.face_pence), 0);

  return (
    <>
      <section className="bg-navy text-paper">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
          <Link href="/account" className="text-sm font-semibold text-paper/80 hover:text-paper">← My account</Link>
          <h1 className="mt-3 font-display text-4xl font-bold">My memberships</h1>
          <p className="mt-2 text-paper/85">Your digital membership cards — show the QR code at the door.</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
        {memberships.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper p-12 text-center shadow-soft">
            <h2 className="font-display text-xl font-bold">No memberships yet</h2>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">Join a hub to get your digital membership card.</p>
            <Link href="/hubs" className="mt-6 inline-block rounded-pill bg-navy px-5 py-3 font-semibold text-paper hover:bg-navy-dark">Browse hubs</Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {memberships.map((m) => (
              <MembershipCard key={m.id} m={m} />
            ))}
          </div>
        )}

        {ended.length > 0 && <EndedSection ended={ended} />}

        {purchases.length > 0 && <PaymentHistory purchases={purchases} spent={spent} />}
      </div>
    </>
  );
}

/* ── Memberships you no longer hold ───────────────────────────────────────── */

function EndedSection({ ended }: { ended: HubMember[] }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-bold">Memberships you have left</h2>
      <ul className="mt-4 space-y-2">
        {ended.map((m) => {
          const restorable = retainsPaidTime(m);
          const href = `/hubs/${m.hub?.id ?? m.hub_id}`;
          return (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
              <div className="min-w-0">
                <p className="font-display font-bold text-ink">{m.hub?.name ?? "A hub"}</p>
                <p className="text-sm text-ink-soft">
                  {m.membership_type?.name ? `${m.membership_type.name} · ` : ""}
                  {m.status === "removed" ? "Removed by the hub" : "You left"}
                  {m.ended_at ? ` on ${fmtDate(m.ended_at)}` : ""}
                </p>
                {restorable && (
                  <p className="mt-0.5 text-sm font-semibold text-emerald-700">
                    Still paid up{m.paid_until ? ` until ${fmtDate(m.paid_until)}` : " for life"} — rejoining costs nothing
                  </p>
                )}
              </div>
              {restorable && (
                <Link href={href} className="shrink-0 rounded-pill bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-navy-dark">
                  Rejoin
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── What you have paid ───────────────────────────────────────────────────── */

function PaymentHistory({ purchases, spent }: { purchases: MembershipPurchase[]; spent: number }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-bold">Membership payments</h2>
      <p className="mt-1 text-ink-soft">{gbp(spent)} paid to Shetland hubs. These stay here whether or not you are still a member.</p>
      <ul className="mt-4 space-y-2">
        {purchases.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
            <div className="min-w-0">
              <p className="font-display font-bold text-ink">{p.hub_name}</p>
              <p className="text-sm text-ink-soft">
                {p.tier_name} · {fmtDate(p.occurred_at)} · {METHOD_LABEL[p.payment_method] ?? "Paid"}
              </p>
              {p.paid_until_after
                ? <p className="text-xs text-ink-muted">Covered until {fmtDate(p.paid_until_after)}</p>
                : <p className="text-xs text-ink-muted">Lifetime membership</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-lg font-bold text-ink">{gbp(p.total_pence ?? p.face_pence)}</p>
              {p.fee_pence !== null
                ? <p className="text-xs text-ink-muted">{gbp(p.face_pence)} membership + {gbp(p.fee_pence)} fee</p>
                : <p className="text-xs text-ink-muted">Membership {gbp(p.face_pence)}</p>}
            </div>
          </li>
        ))}
      </ul>
      {purchases.some((p) => p.source === "backfill") && (
        <p className="mt-3 text-xs text-ink-muted">
          Older payments were recorded before itemised receipts existed, so the amount shown is the
          membership price without the fee that was charged alongside it.
        </p>
      )}
    </section>
  );
}
