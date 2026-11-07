import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAccount } from "@/lib/auth";
import { isAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { getLaunch50Status, getLaunch50Showcase } from "@/lib/launch50";
import {
  LAUNCH50_STATEMENT, LAUNCH50_SHOWCASE_NOTE, LAUNCH50_NAME, LAUNCH50_DISCOUNT_MONTHS, LAUNCH50_RESERVATION_MINUTES,
  launch50Price, standardPrice, fmtLaunchDate, type Launch50Tier,
} from "@/lib/launch50-core";
import { TIER_PITCH, PLAN_COMPARISON } from "@/lib/listing-tiers";
import { tierMeets } from "@/lib/business-data";
import { nfcPitch, nfcRowLabel } from "@/lib/nfc-wording";
import { FINDER_ANCHOR } from "@/lib/plan-cta";
import { ShowcaseGrid } from "@/components/launch50/ShowcaseCard";

export const dynamic = "force-dynamic";

const ACCENT = "#7c3aed";
const TIERS: Launch50Tier[] = ["pro", "premium"];

export async function generateMetadata(): Promise<Metadata> {
  const status = await getLaunch50Status();
  return {
    title: "OneShetland Launch 50",
    description: "A personal invitation to 50 Shetland businesses: OneShetland Pro or Premium at a special Launch 50 price for your first 12 months.",
    ...(status.phase === "closed" ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Where "Reserve your place" goes for this visitor. */
async function reserveHref(): Promise<string> {
  try {
    const account = await getAccount();
    if (!account) return FINDER_ANCHOR;
    const sb = await createClient();
    const { data } = await sb.from("local_businesses").select("id").eq("owner_id", account.id).eq("is_active", true).order("name").limit(25);
    const mine = (data ?? []) as { id: string }[];
    if (mine.length === 1) return `/business/${mine[0].id}/manage/billing#launch-50`;
    if (mine.length > 1) return "/account";
  } catch { /* fall through */ }
  return FINDER_ANCHOR;
}

export default async function Launch50Page() {
  const status = await getLaunch50Status();
  const closed = status.phase === "closed";
  if (closed && !(await isAdmin())) notFound();
  const [members, href] = await Promise.all([getLaunch50Showcase(), reserveHref()]);
  const opens = closed ? null : fmtLaunchDate(status.opens_at);
  const publicOpens = closed ? null : fmtLaunchDate(status.public_opens_at);

  return (
    <>
      {closed && (
        <div role="note" className="bg-amber-100 px-5 py-3 text-center text-sm font-semibold text-amber-950">
          Preview: Launch 50 is not open to the public
        </div>
      )}

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy text-paper">
        <div className="absolute inset-0 opacity-90" style={{ background: `radial-gradient(120% 90% at 15% 0%, ${ACCENT}55, transparent 55%)` }} />
        <div className="relative mx-auto max-w-4xl px-5 py-16 lg:py-20">
          <p className="eyebrow text-paper/80">For Shetland businesses</p>
          <h1 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.05] sm:text-5xl lg:text-6xl">OneShetland Launch 50</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper/85">
            A personal invitation to 50 Shetland businesses: OneShetland Pro or Premium at a special Launch 50 price for your first {LAUNCH50_DISCOUNT_MONTHS} months.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={href} className="rounded-pill bg-paper px-6 py-3 text-base font-bold text-navy shadow-soft transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2">
              Reserve your place
            </Link>
            <Link href={FINDER_ANCHOR} className="text-sm font-semibold text-paper underline underline-offset-4">Not a business owner yet? Claim or add your business</Link>
          </div>
          {!closed && (
            <p className="mt-6 text-paper/90" data-launch50-places>
              <strong className="font-display text-2xl">{status.places_left}</strong> of {status.places_total} places left
              {opens && publicOpens && (
                <span className="mt-1 block text-sm text-paper/75">
                  First access for businesses with a claimed listing from {opens}. Open to every business from {publicOpens}.
                </span>
              )}
            </p>
          )}
        </div>
      </section>

      {/* A personal note */}
      <section className="mx-auto max-w-3xl px-5 pt-14" aria-labelledby="l50-note" data-launch50-note>
        <h2 id="l50-note" className="font-display text-3xl font-bold text-ink sm:text-4xl">A note from me</h2>
        <div className="mt-5 space-y-4 text-lg leading-relaxed text-ink-soft">
          <p>I&apos;m Darren, and I run OneShetland. It&apos;s a new platform, and I&apos;d rather be upfront about that: it&apos;s early, and there is still a lot to build.</p>
          <p>I&apos;m inviting 50 Shetland businesses to join me at a special price for your first {LAUNCH50_DISCOUNT_MONTHS} months, to help grow OneShetland together. Launch 50 is my way of saying thank you for getting involved while it&apos;s new.</p>
          <p>My aim is simple: to make OneShetland genuinely useful to local businesses. I can&apos;t promise customers or enquiries. What I can promise is that I&apos;ll keep building, listen to what you need, and tell you honestly how it&apos;s going.</p>
          <p>If that sounds like a good fit, I&apos;d love to have you with me.</p>
          <p className="font-display text-xl font-bold text-ink">Darren</p>
        </div>
      </section>

      {/* Why I'm doing this */}
      <section className="mx-auto max-w-3xl px-5 pt-10" aria-labelledby="l50-why" data-launch50-why>
        <h2 id="l50-why" className="font-display text-3xl font-bold text-ink sm:text-4xl">Why I&apos;m doing this</h2>
        <div className="mt-5 space-y-4 text-lg leading-relaxed text-ink-soft">
          <p>OneShetland is a new platform that I&apos;ve built, and I want it to last. For that to happen it needs to pay for itself, so I can keep improving it for Shetland instead of letting it stand still. Launch 50 is part of that: the businesses that join will help make OneShetland sustainable, and I&apos;ll be listening closely to what they need.</p>
          <p>Your Free listing stays free, and there is no obligation to upgrade. If you&apos;d rather not, nothing changes for you.</p>
          <p>Once I&apos;m financially ready, I hope to introduce OneShetland Gives Back, a monthly charity wheel that involves the community. It&apos;s an idea I care about, but it isn&apos;t something I can promise yet: I can&apos;t say how much it would give, or when it would start. I&apos;ll tell you honestly when I know more.</p>
        </div>
      </section>

      {/* Plain statement */}
      <section className="mx-auto max-w-3xl px-5 pt-10">
        <p className="rounded-2xl border border-line-strong bg-sand/50 p-5 text-base font-semibold leading-relaxed text-ink" data-launch50-statement>
          {LAUNCH50_STATEMENT}
        </p>
      </section>

      {/* Offers */}
      <section className="mx-auto max-w-5xl px-5 py-14" aria-labelledby="l50-offers">
        <h2 id="l50-offers" className="font-display text-3xl font-bold text-ink sm:text-4xl">Choose your Launch 50 plan</h2>
        <p className="mt-2 text-ink-soft">Monthly billing only. The price you see is the price you pay.</p>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {TIERS.map((tier) => {
            const blurb = tier === "pro" ? nfcPitch(TIER_PITCH.pro.blurb) : TIER_PITCH.premium.blurb;
            const plus = PLAN_COMPARISON.filter((f) => f.tier === tier);
            return (
              <article key={tier} className="flex flex-col overflow-hidden rounded-3xl border-2 bg-paper shadow-soft" style={{ borderColor: `${ACCENT}33` }} data-launch50-offer={tier}>
                <div className="px-7 pb-6 pt-7 text-paper" style={{ background: `linear-gradient(135deg, ${ACCENT}, #4c1d95)` }}>
                  <p className="text-xs font-bold uppercase tracking-widest text-paper/80">Launch 50 price</p>
                  <h3 className="mt-2 font-display text-2xl font-bold">{LAUNCH50_NAME[tier]}</h3>
                  <p className="mt-4 font-display text-6xl font-bold leading-none">{launch50Price(tier)}<span className="text-xl font-semibold text-paper/85">/month</span></p>
                  <p className="mt-3 text-sm font-semibold text-paper/90">for {LAUNCH50_DISCOUNT_MONTHS} months, then {standardPrice(tier)}/month</p>
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <p className="text-sm font-semibold text-ink-muted">{TIER_PITCH[tier].headline}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{blurb}</p>
                  <p className="mt-6 text-xs font-bold uppercase tracking-widest text-ink-muted">{tier === "pro" ? "Your free listing, plus" : "Everything in Pro, plus"}</p>
                  <ul className="mt-3 flex-1 space-y-2.5">
                    {plus.map((f) => (
                      <li key={f.label} className="flex items-start gap-2.5 text-sm text-ink">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
                        {nfcRowLabel(f.label)}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-8">
          <Link href={href} className="inline-flex rounded-pill px-6 py-3 text-base font-bold text-paper shadow-soft transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{ background: ACCENT }}>
            Reserve your place
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-sand/40" aria-labelledby="l50-how">
        <div className="mx-auto max-w-4xl px-5 py-14">
          <h2 id="l50-how" className="font-display text-3xl font-bold text-ink sm:text-4xl">How it works</h2>
          <ul className="mt-6 space-y-3 text-ink-soft">
            <li>Businesses that already had a claimed listing get 14 days of exclusive first access. Places are never reserved for anyone automatically.</li>
            <li>One place per business, 50 places in total.</li>
            <li>Reserve your place, then pay. Your place is held for {LAUNCH50_RESERVATION_MINUTES} minutes while you do.</li>
            <li>Monthly billing only.</li>
            <li>After {LAUNCH50_DISCOUNT_MONTHS} months the standard price starts automatically, and I will email you a reminder before it does.</li>
            <li>Cancel any time.</li>
            <li>Plan changes are not available during Launch 50.</li>
            <li>Appearing in the showcase below is optional.</li>
          </ul>
          <p className="mt-6 text-sm text-ink-muted">I can&apos;t promise customers or enquiries. Launch 50 is a plan price, not a guarantee of results.</p>
        </div>
      </section>

      {/* Showcase */}
      <section className="mx-auto max-w-6xl px-5 py-14" aria-labelledby="l50-showcase">
        <h2 id="l50-showcase" className="font-display text-3xl font-bold text-ink sm:text-4xl">Meet the Launch 50</h2>
        <p className="mt-2 text-ink-soft">Every Launch 50 business is shown the same way. {LAUNCH50_SHOWCASE_NOTE}</p>
        <ShowcaseGrid members={members} />
      </section>
    </>
  );
}
