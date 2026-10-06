import Link from "next/link";
import { getBusinessEventsAndJobs, getBusinessExtras, type Business } from "@/lib/local-data";
import { getAccount } from "@/lib/auth";
import { ownsBusiness } from "@/lib/business-data.server";
import { tierUnlocks } from "@/lib/listing-tiers";
import { loadBusinessPageModel } from "@/lib/business-page/load.server";
import type { PageDraft } from "@/lib/business-page/types";
import { BusinessPageV2 } from "@/components/business-page/BusinessPageV2";
import { TrackView } from "@/components/analytics/TrackView";
import { JsonLd } from "@/components/seo/JsonLd";
import { businessSchema, breadcrumbSchema } from "@/lib/seo-schema";
import { FollowButton } from "@/components/local/FollowButton";
import { OfferClaimList } from "@/components/local/OfferClaimList";
import { UnitItemsSection } from "@/components/local/UnitItemsSection";
import { ServicesSection } from "@/components/local/ServicesSection";
import { WalletTopUpButton } from "@/components/local/WalletTopUpButton";
import { LoyaltyProgress } from "@/components/local/LoyaltyProgress";

const LOCAL = "#7c3aed";

/**
 * The PUBLIC page of a launch partner that has gone live: the approved launch setup, rendered by Business Page V2 in LIVE mode — the
 * same renderer, with the same profile content, the owner reviewed as "how customers will see it". No private banner, no preview wording.
 *
 * Only the profile layer comes from the published version. Everything factual — name, contact, hours, address, logo, products, events — is read
 * live from the real business, so ordinary edits show up immediately. Real offers, bookable services, passes and loyalty keep their existing,
 * fully working widgets: they appear BELOW the page, and only when they genuinely exist (a business with none shows none). Examples never do.
 */
export async function PublishedBusinessPage({ b, draft, searchParams }: { b: Business; draft: PageDraft; searchParams: Record<string, string | string[] | undefined> }) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const [model, extras, ev, account] = await Promise.all([
    loadBusinessPageModel({ businessId: b.id, mode: "live", draft, fallback: { name: b.name } }),
    getBusinessExtras(b.id), getBusinessEventsAndJobs(b.id), getAccount(),
  ]);
  const isOwner = !!account && (await ownsBusiness(account.id, b.id));
  const isLoggedIn = !!account;
  const signInHref = `/sign-in?next=/directory/${b.id}`;
  const accent = model.identity.accent;
  const { offers, loyalty, services, unitItems } = extras;
  const tier = b.subscription_tier;
  const showOffers = tierUnlocks(tier, "offers") && offers.length > 0;
  const showLoyalty = tierUnlocks(tier, "loyalty") && !!loyalty;
  const showServices = tierUnlocks(tier, "services") && !!b.accepts_bookings && services.length > 0;
  const showPasses = tierUnlocks(tier, "passesOnListing") && unitItems.length > 0;
  const walletLive = b.wallet_live === true;
  const cashback = tierUnlocks(tier, "wallet") && walletLive && b.cashback_percent > 0 ? b.cashback_percent : 0;
  const showHiring = tierUnlocks(tier, "hiring") && ev.jobs.length > 0;

  // These interactive sections are drawn below with the existing widgets, so the page's own plain versions are left out (no doubling).
  const page = { ...model, offers: [], book: null, passes: [], rewards: null };

  return (
    <>
      <JsonLd data={[businessSchema(b), breadcrumbSchema([{ name: "Directory", path: "/directory" }, { name: b.name, path: `/directory/${b.slug || b.id}` }])]} />
      <TrackView event="content_viewed" objectType="business" objectId={b.id} businessId={b.id} />
      <BusinessPageV2
        model={page}
        slots={{
          follow: ({ businessId }) => isOwner
            ? <Link href={`/business/${businessId}/manage`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:brightness-110" style={{ background: accent }}>Manage business →</Link>
            : <FollowButton businessId={businessId} accent={accent} isLoggedIn={isLoggedIn} signInHref={signInHref} />,
        }}
      />
      {(showOffers || showPasses || showLoyalty || showServices || cashback > 0 || showHiring) && (
        <div className="bg-[#fbf8f2]" data-published-interactive>
          <div className="mx-auto max-w-5xl space-y-12 px-5 py-12">
            {showOffers && (<section><h2 className="font-display text-2xl font-bold">Current offers</h2><OfferClaimList offers={offers} accent={accent} isLoggedIn={isLoggedIn} signInHref={signInHref} /></section>)}
            {showPasses && <UnitItemsSection items={unitItems} accent={accent} isLoggedIn={isLoggedIn} signInHref={signInHref} />}
            {showLoyalty && loyalty && (
              <section>
                <h2 className="font-display text-2xl font-bold">Loyalty rewards</h2>
                <div className="mt-5 overflow-hidden rounded-xl p-6 text-paper shadow-soft" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
                  {loyalty.type === "points"
                    ? <><p className="font-display text-2xl font-bold">Earn as you spend</p><p className="mt-1 text-paper/90">{loyalty.points_per_pound ?? 1} point{loyalty.points_per_pound === 1 ? "" : "s"} per £1 spent{loyalty.points_for_pound ? ` · ${loyalty.points_for_pound} points = £1 back` : ""}.</p></>
                    : <><p className="font-display text-2xl font-bold">Collect &amp; reward</p><p className="mt-1 text-paper/90">Collect {loyalty.stamps_required ?? 0} stamps{loyalty.stamp_reward ? ` for ${loyalty.stamp_reward}` : ""}.</p></>}
                  <LoyaltyProgress businessId={b.id} loyalty={loyalty} isLoggedIn={isLoggedIn} />
                  <p className="mt-4 text-sm text-paper/80">Collect your stamps and points in the OneShetland app.</p>
                </div>
              </section>
            )}
            {showServices && <ServicesSection services={services} businessId={b.id} accent={accent} isLoggedIn={isLoggedIn} signInHref={signInHref} userId={account?.id ?? null} openServiceId={one(searchParams.book)} openGiftId={one(searchParams.gift)} />}
            {cashback > 0 && (
              <section className="rounded-xl border p-6" style={{ borderColor: `${LOCAL}4d`, background: `${LOCAL}14` }}>
                <p className="font-display text-lg font-bold" style={{ color: LOCAL }}>Pay with OneShetland</p>
                <p className="mt-1 text-ink-soft">Pay with your wallet and get <strong>{cashback}% back</strong>.</p>
                <WalletTopUpButton accent={LOCAL} isLoggedIn={isLoggedIn} signInHref={signInHref} />
              </section>
            )}
            {showHiring && (
              <section>
                <h2 className="font-display text-2xl font-bold">We&apos;re hiring</h2>
                <div className="mt-5 divide-y divide-line rounded-xl border border-line bg-paper shadow-soft">
                  {ev.jobs.map((j) => (
                    <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between gap-4 p-4 transition hover:bg-sand/30">
                      <div className="min-w-0"><p className="font-semibold text-ink">{j.title}</p>{j.location && <p className="text-sm text-ink-muted">{j.location}</p>}</div>
                      {j.pay_text && <span className="shrink-0 rounded-pill bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink-muted">{j.pay_text}</span>}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
