import Link from "next/link";
import { AccessibleInviteCard } from "@/components/accessibility/AccessibleInviteCard";
import { getEditableAccessibility } from "@/lib/accessibility-data";
import { inviteState, isDismissed } from "@/lib/accessibility-invite";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/business-server";
import { getMyManagedBusinesses } from "@/lib/business-data.server";
import { BIZ, TIER_LABELS } from "@/lib/business-data";
import { getDashboardData } from "@/lib/business-dashboard.server";
import { GetItDoneInvite } from "@/components/business/GetItDoneInvite";
import { Launch50Invite } from "@/components/business/Launch50Invite";
import { getLaunch50Status, getMyLaunch50Place } from "@/lib/launch50";
import { launch50InviteVisible, fmtDayMonth } from "@/lib/launch50-core";
import { isGetItDoneCategory } from "@/lib/get-it-done-eligibility";
import { jobMatchingActive } from "@/lib/get-it-done-entitlement";
import { AVAILABILITY_LABEL, availabilityIsFresh } from "@/lib/trades";
import { nextAction, hasOperationalAttention } from "@/lib/business-next-action";
import { beFound } from "@/lib/be-found";
import { businessOutcomes } from "@/lib/business-outcomes";
import { OutcomeRow, UtilityRow } from "@/components/business/OutcomeRow";
import { DashboardTop, AvailabilityChip } from "@/components/business/DashboardTop";
import { LaunchSetupCard } from "@/components/business/LaunchSetupCard";
import { getOwnerLaunchSetup } from "@/lib/launch-partners/owner-setup.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage business" };


export default async function ManageBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business, account } = await requireBusinessOwner(id);
  const dashboard = await getDashboardData(business.id);
  // OneShetland Launch 50 invitation: tolerant reads; any failure means no invitation, never an error.
  const [l50Status, l50Place, l50Row] = await Promise.all([
    getLaunch50Status(), getMyLaunch50Place(business.id),
    createServerClient().then((sb) => sb.from("local_businesses").select("owner_activated_at").eq("id", business.id).maybeSingle()).then((r) => (r.data?.owner_activated_at as string | null) ?? null).catch(() => null),
  ]);
  const showL50 = launch50InviteVisible({ phase: l50Status.phase, opensAt: l50Status.opens_at, claimedAt: l50Row, isActive: business.is_active !== false, tier: business.subscription_tier, subscriptionConnected: !!business.subscription_connected, place: l50Place });
  // Launch-partner onboarding is READ from the real campaign, claim, grant and version records (owner-only; null for anyone else).
  const launch = (await getOwnerLaunchSetup(business.id)).launch;
  const launchPrompt = launch.state === "review" || launch.state === "edited";
  const mine = await getMyManagedBusinesses(account.id);
  // Accessible Shetland invitation: the owner's own view of the record (drafts included) and their own dismissal preference. Two small reads.
  const [accessibility, authUser] = await Promise.all([getEditableAccessibility("business", business.id), createServerClient().then((sb) => sb.auth.getUser()).catch(() => null)]);
  const userMeta = (authUser?.data?.user?.user_metadata ?? null) as Record<string, unknown> | null;
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
            <Link key={b.id} href={`/business/${b.id}/manage`} className={"shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition " + (b.id === business.id ? "text-white" : "border border-line-strong text-ink-soft hover:bg-sand")} style={b.id === business.id ? { background: BIZ } : undefined}>{b.name}{!b.is_active && <span className="ml-1.5 text-xs font-bold opacity-70">· not listed</span>}</Link>
          ))}
        </div>
      )}

      <div className="mt-4 mb-8 flex items-center gap-4">
        {business.logo_url
          ? <img src={business.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
          : <span className="grid h-14 w-14 place-items-center rounded-xl text-2xl text-white" style={{ background: BIZ }}>{business.name[0]}</span>}
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{business.name}</h1>
          <p className="mt-0.5 text-sm font-semibold" style={{ color: BIZ }}>{TIER_LABELS[business.subscription_tier]} plan{business.is_verified ? " · Verified ✓" : ""}{business.is_active === false ? " · Not publicly listed" : ""}</p>
        </div>
        <div className="ml-auto"><AvailabilityChip data={dashboard} base={base} /></div>
      </div>

      {launch.showCard && <div className="mb-8"><LaunchSetupCard launch={launch} href={`${base}/launch-setup`} publicHref={`/directory/${business.id}`} /></div>}

      {/* The dashboard proper: what needs you, how the week went, the code. */}
      <div className="mb-8"><DashboardTop data={dashboard} base={base} next={next} listingDone={listingDone} launchOnboarding={launchPrompt} /></div>

      {showL50 && <div className="mb-8"><Launch50Invite businessId={business.id} base={base} firstAccessUntil={fmtDayMonth(l50Status.public_opens_at)} publicOpen={l50Status.phase === "open"} /></div>}

      <div className="mb-8">
        <GetItDoneInvite
          businessId={business.id} base={base}
          eligible={isGetItDoneCategory(business.category)}
          isTrade={dashboard.isTrade}
          entitled={jobMatchingActive(business.subscription_tier, business.subscription_until)}
          availabilityLabel={dashboard.tradeAvailability ? (AVAILABILITY_LABEL[dashboard.tradeAvailability as keyof typeof AVAILABILITY_LABEL] ?? null) : null}
          availabilityFresh={availabilityIsFresh(dashboard.tradeAvailabilitySetAt)}
        />
      </div>

      {/* Accessible Shetland: a personal invitation (not a requirement), then a small thank-you once details are published. Dismissible, per owner. */}
      <AccessibleInviteCard businessId={business.id} businessName={business.name} state={inviteState(accessibility)} dismissed={isDismissed(userMeta)} businessCount={mine.length} />

      {/* ── Your business ──────────────────────────────────────────────
           Six outcomes in a fixed order. Not eighteen tiles, and not sorted
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
          <UtilityRow label="Get it done: job leads" href={`${base}/leads`}
            status={jobMatchingActive(business.subscription_tier, business.subscription_until) ? (dashboard.isTrade ? "Matching active" : "Not set up") : (dashboard.isTrade ? "Needs Pro" : "Pro and Premium")} />
          <UtilityRow label="Urgent alerts" href={`${base}/alerts`} />
          <UtilityRow label="Accessibility information" href={`/accessible/edit/business/${business.id}`}
            status={accessibility ? (accessibility.published ? "Published" : "Draft") : null} />
        </div>
      </section>


    </div>
  );
}
