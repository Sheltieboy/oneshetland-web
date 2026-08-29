import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getMyBoostPurchases } from "@/lib/jobs-data.server";
import { SHIFTS, EmptyState } from "@/components/jobs/JobsUI";
import { gbp } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const metadata = { title: "Boost history" };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const METHOD_LABEL: Record<string, string> = {
  card: "Paid by card",
  wallet: "Paid from wallet",
};

/**
 * What you have paid to promote — as opposed to what is promoted right now,
 * which is the Boosted state on the shift itself. Two different questions, and
 * a boost answers the first one for twenty-four hours and the second one for
 * ever.
 */
export default async function BoostHistoryPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/shifts/boosts");

  const purchases = await getMyBoostPurchases();
  const now = new Date().toISOString();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/shifts/manage" className="text-sm font-semibold text-ink-soft hover:text-ink">← Manage shifts</Link>
      <h1 className="mt-4 font-display text-4xl font-bold">Boost history</h1>
      <p className="mt-2 text-ink-soft">Every shift boost you have bought, and what it cost.</p>

      <div className="mt-8">
        {purchases.length === 0 ? (
          <EmptyState
            icon="⚡"
            title="No boosts yet"
            body="Boosting a shift pins it above the others and alerts matching workers for 24 hours. Anything you buy shows up here."
            cta={{ label: "My posted shifts", href: "/shifts/manage", color: SHIFTS }}
          />
        ) : (
          <ul className="space-y-3">
            {purchases.map((p) => {
              const active = p.boosted_until > now;
              return (
                <li key={p.id} className="rounded-card border border-line bg-paper p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {p.shift_id ? (
                        <Link href={`/shifts/${p.shift_id}`} className="font-display text-lg font-bold text-ink hover:underline">
                          {p.shift_title}
                        </Link>
                      ) : (
                        <p className="font-display text-lg font-bold text-ink">{p.shift_title}</p>
                      )}
                      {p.business_name && <p className="text-sm text-ink-muted">{p.business_name}</p>}
                      <p className="mt-1 text-sm text-ink-soft">
                        Shift boost · {p.duration_hours} hours
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-xl font-bold text-ink">{gbp(p.amount_pence)}</p>
                      <p className="text-xs font-semibold text-ink-muted">{METHOD_LABEL[p.method] ?? "Paid"}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <span className="rounded-pill bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      Completed
                    </span>
                    {/* The receipt outlives the boost; while it is still running,
                        say so, because that is the thing they are watching. */}
                    {active && (
                      <span className="rounded-pill px-2.5 py-1 text-xs font-bold text-paper" style={{ background: SHIFTS }}>
                        ⚡ Boost currently active
                      </span>
                    )}
                    <span className="text-xs font-semibold text-ink-muted">{fmtDate(p.purchased_at)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
