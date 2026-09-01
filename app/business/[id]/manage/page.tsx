import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { getMyManagedBusinesses } from "@/lib/business-data.server";
import { BIZ, TIER_LABELS } from "@/lib/business-data";
import { getDashboardData } from "@/lib/business-dashboard.server";
import { nextAction, hasOperationalAttention } from "@/lib/business-next-action";
import { beFound } from "@/lib/be-found";
import { businessOutcomes } from "@/lib/business-outcomes";
import { OutcomeRow, UtilityRow } from "@/components/business/OutcomeRow";
import { DashboardTop, AvailabilityChip } from "@/components/business/DashboardTop";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage business" };


export default async function ManageBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business, account } = await requireBusinessOwner(id);
  const dashboard = await getDashboardData(business.id);
  const mine = await getMyManagedBusinesses(account.id);
  const base = `/business/${business.id}/manage`;
  // Be Found is derived from the business record on every load — nothing about
  // it is stored, so it can never go stale or disagree with the listing.
  const next = nextAction(dashboard, business, base);
  const listingDone = !hasOperationalAttention(dashboard) && beFound(business).state === "good";
  const reads = dashboard.outcomes;
  const outcomes = businessOutcomes(business, reads, base);
  // Omitted entirely rather than guessed: an unreadable payout state must not
  // become "not set up" on a business that has set it up.
  const payoutStatus =
    reads.payoutReady === null ? null : reads.payoutReady ? "Payouts ready" : "Payouts not set up";
  // The same effective answer the directory and the browse list read.
  const walletLive =
    business.accepts_wallet === true && business.is_active === true && reads.meetsPro === true;


  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
      <Link href="/account" className="text-sm font-semibold text-ink-soft hover:text-ink">← Account</Link>

      {mine.length > 1 && (
        <div className="mt-4 -mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mine.map((b) => (
            <Link key={b.id} href={`/business/${b.id}/manage`} className={"shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition " + (b.id === business.id ? "text-white" : "border border-line-strong text-ink-soft hover:bg-sand")} style={b.id === business.id ? { background: BIZ } : undefined}>{b.name}</Link>
          ))}
        </div>
      )}

      <div className="mt-4 mb-8 flex items-center gap-4">
        {business.logo_url
          ? <img src={business.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
          : <span className="grid h-14 w-14 place-items-center rounded-xl text-2xl text-white" style={{ background: BIZ }}>{business.name[0]}</span>}
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{business.name}</h1>
          <p className="mt-0.5 text-sm font-semibold" style={{ color: BIZ }}>{TIER_LABELS[business.subscription_tier]} plan{business.is_verified ? " · Verified ✓" : ""}</p>
        </div>
        <div className="ml-auto"><AvailabilityChip data={dashboard} base={base} /></div>
      </div>

      {/* The dashboard proper: what needs you, how the week went, the code. */}
      <div className="mb-8"><DashboardTop data={dashboard} base={base} next={next} listingDone={listingDone} /></div>

      {/* ── Your business ──────────────────────────────────────────────
           Five outcomes in a fixed order. Not eighteen tiles, and not sorted
           by state: an owner learns where things are, and a Home that
           rearranges itself has to be read from scratch every visit. */}
      <section className="mb-8">
        <h2 className="eyebrow mb-2 text-ink-muted">Your business</h2>
        <div className="space-y-3">
          {outcomes.map((o) => <OutcomeRow key={o.key} outcome={o} accent={BIZ} />)}
        </div>
      </section>

      {/* ── Money ──────────────────────────────────────────────────────
           A utility strip, not an outcome. Counter is deliberately absent —
           it already has the prominent position it has earned at the top. */}
      <section className="mb-8">
        <h2 className="eyebrow mb-2 text-ink-muted">Money</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <UtilityRow label="Plan &amp; payouts" href={`${base}/billing`}
            status={payoutStatus} />
          <UtilityRow label="Local Wallet" href={`${base}/wallet`}
            status={walletLive ? "On" : null} />
          <UtilityRow label="Money &amp; transactions" href={`${base}/transactions`} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="eyebrow mb-2 text-ink-muted">Grow</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <UtilityRow label="Analytics" href={`${base}/analytics`} />
          {/* Boost is bought on the billing screen, so that is its real home. */}
          <UtilityRow label="Boost" href={`${base}/billing`}
            status={reads.boostActive === null ? null : reads.boostActive ? "Active" : null} />
          <UtilityRow label="Urgent alerts" href={`${base}/alerts`} />
        </div>
      </section>

    </div>
  );
}
