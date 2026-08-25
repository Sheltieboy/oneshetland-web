import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { getMyDonations } from "@/lib/hubs-server";
import { gbp } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "My donations" };

const HUBS = "#6b47bf";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const METHOD_LABEL: Record<string, string> = {
  card: "Paid by card",
  wallet: "Paid from wallet",
};

/**
 * What you have given, after you have left the campaign page.
 *
 * Every row is a completed donation: hub_donations only ever holds a payment
 * Stripe reported as succeeded, so there is no pending or failed state to show
 * and none is invented.
 */
export default async function MyDonationsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/donations");

  const donations = await getMyDonations();
  const total = donations.reduce((sum, d) => sum + d.amount_pence, 0);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <Link href="/account" className="text-sm font-semibold text-ink-soft hover:text-ink">← My account</Link>
      <h1 className="mt-4 font-display text-4xl font-bold">My donations</h1>
      <p className="mt-2 text-ink-soft">
        {donations.length > 0
          ? `${gbp(total)} given to Shetland hubs and their fundraisers.`
          : "Donations you make to Shetland hubs and their fundraisers appear here."}
      </p>

      <div className="mt-8">
        {donations.length === 0 ? (
          <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
            <p className="font-display text-2xl font-bold">Nothing yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              Hubs across Shetland raise money for kit, halls, minibuses and more.
            </p>
            <Link href="/hubs" className="mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-paper" style={{ background: HUBS }}>
              Browse hubs
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {donations.map((d) => (
              <li key={d.id} className="rounded-card border border-line bg-paper p-5 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {d.hub_id ? (
                      <Link href={`/hubs/${d.hub_id}`} className="font-display text-lg font-bold text-ink hover:underline">
                        {d.hub_name ?? "A Shetland hub"}
                      </Link>
                    ) : (
                      <p className="font-display text-lg font-bold text-ink">{d.hub_name ?? "A Shetland hub"}</p>
                    )}
                    {d.campaign_title && <p className="text-sm text-ink-muted">{d.campaign_title}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    {/* What they gave — not the hub's net after the platform's
                        processing fee, which is not the donor's business. */}
                    <p className="font-display text-xl font-bold text-ink">{gbp(d.amount_pence)}</p>
                    {d.payment_method && (
                      <p className="text-xs font-semibold text-ink-muted">{METHOD_LABEL[d.payment_method]}</p>
                    )}
                  </div>
                </div>

                {d.message && (
                  <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-sm italic text-ink-soft">“{d.message}”</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <span className="rounded-pill bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Completed</span>
                  {d.is_anonymous && (
                    <span className="rounded-pill bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Anonymous donation</span>
                  )}
                  {d.gift_aid && (
                    <span className="rounded-pill px-2.5 py-1 text-xs font-bold text-paper" style={{ background: HUBS }}>Gift Aid claimed</span>
                  )}
                  <span className="text-xs font-semibold text-ink-muted">{fmtDate(d.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
