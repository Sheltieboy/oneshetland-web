import Link from "next/link";
import { requireHubAdmin, getHubDonationLedger } from "@/lib/hubs-server";
import { gbp } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const metadata = { title: "Donations" };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const METHOD_LABEL: Record<string, string> = { card: "Card", wallet: "Wallet" };

/**
 * Hub → Manage → Fundraising → Donations.
 *
 * Every donation to this hub, one line each — the itemised view the campaign
 * totals could not give. Anonymous donors stay anonymous here, because that is
 * what the product already tells admins in the notification they receive.
 */
export default async function HubDonationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hub, accent } = await requireHubAdmin(id);
  const donations = await getHubDonationLedger(hub.id);
  const total = donations.reduce((sum, d) => sum + d.amount_pence, 0);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage/campaigns`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Fundraising</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Donations</h1>
      <p className="mt-2 text-ink-soft">
        {donations.length > 0
          ? `${donations.length} donation${donations.length === 1 ? "" : "s"} · ${gbp(total)} raised in total.`
          : "Donations to this hub's campaigns appear here."}
      </p>

      <div className="mt-8">
        {donations.length === 0 ? (
          <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
            <p className="font-display text-2xl font-bold">No donations yet</p>
            <p className="mt-1 text-sm text-ink-muted">Share a campaign to start receiving support.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {donations.map((d) => (
              <li key={d.id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">{d.donorName}</p>
                    {d.campaign_title && <p className="text-sm text-ink-muted">{d.campaign_title}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-bold text-ink">{gbp(d.amount_pence)}</p>
                    {d.payment_method && (
                      <p className="text-xs font-semibold text-ink-muted">{METHOD_LABEL[d.payment_method]}</p>
                    )}
                  </div>
                </div>

                {d.message && (
                  <p className="mt-2 rounded-lg bg-sand px-3 py-2 text-sm italic text-ink-soft">“{d.message}”</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <span className="rounded-pill bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Completed</span>
                  {d.gift_aid && (
                    <span className="rounded-pill px-2.5 py-1 text-xs font-bold text-paper" style={{ background: accent }}>Gift Aid</span>
                  )}
                  <span className="text-xs font-semibold text-ink-muted">{fmtDate(d.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-8 text-sm text-ink-muted">
        Gift Aid declarations — including the declarant&apos;s name and address — are in{" "}
        <Link href={`/hubs/${hub.slug || hub.id}/manage/giftaid`} className="font-semibold underline">Gift Aid</Link>.
      </p>
    </div>
  );
}
