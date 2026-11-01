import Link from "next/link";
import {
  TIER_LABELS,
  TIER_PRICE,
  TIER_PITCH,
  PLAN_COMPARISON,
  BOOKING_FEE_PENCE,
  BOOKING_CAP_UNITS,
  BOOKING_CAP_PENCE,
  FREE_GALLERY_LIMIT,
  tierMeets,
  type SubscriptionTier,
} from "@/lib/business-data";
import { PhoneFrame, LaptopFrame } from "@/components/business/DeviceFrame";
import { OwnerProvider, OwnerStrip } from "@/components/business/OwnerProvider";
import { BusinessFinder } from "@/components/business/BusinessFinder";
import { PlanButton } from "@/components/business/PlanButton";
import { FINDER_ANCHOR } from "@/lib/plan-cta";

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export const metadata = {
  title: "For businesses",
  description:
    "Claim your free business listing on OneShetland — the community app and website for Shetland. Add offers, loyalty, bookings, jobs and events when you're ready.",
};

/* Section accents: Local violet + Directory indigo. */
const LOCAL = "#7c3aed";
const DIR = "#4f46e5";



/* ── Where a business shows up across the ecosystem ─────────────────────────── */
type Showcase = {
  title: string;
  benefit: string;
  device: "phone" | "laptop";
  src: string;
  accent: string;
};

const SHOWCASE: Showcase[] = [
  {
    title: "Local — offers, cashback & bookable",
    benefit: "Show up in Local when people browse shops, makers and services, and filter for offers, cashback or businesses they can book. Offers, cashback and online booking are on Pro and above.",
    device: "phone",
    src: "/business/local-phone.png",
    accent: LOCAL,
  },
  {
    title: "In-app bookings",
    benefit: `Take appointments and reservations without a separate system — bookings land in your dashboard. On Pro it's ${BOOKING_FEE_PENCE}p per booking, capped at ${BOOKING_CAP_UNITS} a month (${gbp(BOOKING_CAP_PENCE)}), so Pro never costs more than Premium. On Premium there's no booking fee at all.`,
    device: "phone",
    src: "/business/bookings-phone.png",
    accent: LOCAL,
  },
  {
    title: "Jobs & shifts",
    benefit: "Post permanent roles and short-notice shifts, and take applications — free with every listing.",
    device: "laptop",
    src: "/business/jobs-desktop.png",
    accent: "#2a8b5c",
  },
  {
    title: "Events & tickets",
    benefit: "List what you’ve got on and sell tickets across What’s On and your own listing — free to list, with a small fee per ticket sold.",
    device: "phone",
    src: "/business/events-phone.png",
    accent: "#d4921a",
  },
];

/** The rest of what a listing can do. No screenshots: the old ones showed real, named businesses and invented figures. */
const ALSO: { title: string; body: string; accent: string }[] = [
  { title: "Your Directory listing", body: "Your story, photos, hours, contacts and map pin, found by anyone searching the Directory. Free.", accent: DIR },
  { title: "Offers, stamps & loyalty", body: "Run time-limited offers and a digital stamp card that customers collect and redeem from their phone. Pro and above.", accent: LOCAL },
  { title: "Analytics", body: "See views, searches and redemptions so you know what’s working. Pro and above.", accent: DIR },
  { title: "Community hubs", body: "Clubs, charities and groups get a branded hub — notices, members and fundraising in one place.", accent: "#6b47bf" },
];

/** A few plan rows are worded for the shared tier model; say exactly what the website gives. */
const ROW_LABEL: Record<string, string> = { "Featured homepage spot": "★ Featured badge and priority placement" };

/* ── Plans ──────────────────────────────────────────────────────────────────── */
const PLAN_ORDER: SubscriptionTier[] = ["free", "pro", "premium"];

/** What this tier includes — derived, so it can't under-describe a plan again. */
function includedThrough(tier: SubscriptionTier) {
  return PLAN_COMPARISON.filter((f) => tierMeets(tier, f.tier));
}

export default function BusinessLandingPage() {
  return (
    <OwnerProvider>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-navy text-paper">
        <div
          className="absolute inset-0 opacity-90"
          style={{ background: `radial-gradient(120% 90% at 15% 0%, ${LOCAL}55, transparent 55%), radial-gradient(120% 90% at 90% 20%, ${DIR}44, transparent 60%)` }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <p className="eyebrow text-paper/80">OneShetland for businesses</p>
            <h1 className="mt-4 font-display text-[2.6rem] font-bold leading-[1.03] sm:text-5xl lg:text-6xl">
              Grow your business across Shetland, in one place.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper/85">
              Hundreds of Shetland businesses are already listed on OneShetland. Find yours, claim it <strong className="text-paper">free</strong>, and
              add offers, loyalty and bookings when you&apos;re ready. Made in Shetland — cancel a paid plan any time.
            </p>
            <div className="mt-7 max-w-xl" id="find-your-business">
              <OwnerStrip />
              <BusinessFinder />
            </div>
            <p className="mt-4 text-sm text-paper/70">
              Claiming costs nothing. We check every claim by hand to keep the Directory trustworthy, and email you the outcome.{" "}
              <a href="#plans" className="font-semibold text-paper underline underline-offset-4">See plans</a>
            </p>
          </div>
          <div className="hidden md:block">
            <PhoneFrame src="/business/local-phone.png" alt="OneShetland Local, showing offers and bookable businesses" accent={LOCAL} className="max-w-[240px]" />
          </div>
        </div>
      </section>

      {/* ── What a listing gives you ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <p className="eyebrow" style={{ color: DIR }}>One listing, found in many places</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Be easy to find across Shetland.</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              OneShetland is the community app and website for the islands — what&apos;s on, shopping, jobs, notices and more. Your listing is in the
              Directory and in Local, and your offers, events and jobs appear alongside it. You decide how much to add, and the basics are free.
            </p>
            <a
              href={FINDER_ANCHOR}
              className="mt-8 inline-flex rounded-pill px-6 py-3 text-base font-bold text-paper shadow-soft transition hover:brightness-110"
              style={{ background: DIR }}
            >
              Find your business
            </a>
          </div>

          <div
            className="rounded-2xl border p-8 shadow-soft sm:p-10"
            style={{ borderColor: `color-mix(in srgb, ${DIR} 25%, transparent)`, background: `color-mix(in srgb, ${DIR} 6%, white)` }}
          >
            <p className="eyebrow" style={{ color: DIR }}>Free to claim</p>
            <p className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Your listing, in your hands.</p>
            <p className="mt-3 leading-relaxed text-ink-soft">
              Claim the listing that&apos;s already there and update your details, photos and hours. Add offers, loyalty, bookings and tickets when
              they make sense for you — upgrade, downgrade or cancel from your dashboard.
            </p>
            <div className="mt-7 grid grid-cols-3 gap-3 text-center">
              {[["Free", "to claim"], ["Yours", "to manage"], ["Any time", "cancel a paid plan"]].map(([big, small]) => (
                <div key={small} className="rounded-xl bg-paper/70 px-2 py-4">
                  <p className="font-display text-2xl font-bold text-ink">{big}</p>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">{small}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Everywhere your business shows up ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow" style={{ color: LOCAL }}>One listing, everywhere</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Everywhere your business shows up</h2>
          <p className="mt-3 text-lg text-ink-soft">
            OneShetland is where the islands go for what&apos;s on, where to shop and who to hire.
            Your listing works across it.
          </p>
        </div>

        <div className="mt-12 space-y-14">
          {SHOWCASE.map((s, i) => (
            <div
              key={s.title}
              className={`grid items-center gap-8 md:grid-cols-2 md:gap-12 ${i % 2 === 1 ? "md:[&>div:first-child]:order-2" : ""}`}
            >
              <div className="rounded-2xl bg-sand/40 p-8 sm:p-10">
                {s.device === "phone" ? (
                  <PhoneFrame src={s.src} alt={s.title} accent={s.accent} />
                ) : (
                  <LaptopFrame src={s.src} alt={s.title} accent={s.accent} />
                )}
              </div>
              <div>
                <span className="inline-block h-1.5 w-10 rounded-full" style={{ background: s.accent }} />
                <h3 className="mt-4 font-display text-2xl font-bold text-ink">{s.title}</h3>
                <p className="mt-3 text-lg leading-relaxed text-ink-soft">{s.benefit}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {ALSO.map((a) => (
            <div key={a.title} className="rounded-2xl border border-line bg-paper p-6 shadow-soft">
              <span className="inline-block h-1.5 w-10 rounded-full" style={{ background: a.accent }} />
              <h3 className="mt-3 font-display text-xl font-bold text-ink">{a.title}</h3>
              <p className="mt-2 text-ink-soft">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plans ──────────────────────────────────────────────────────────── */}
      <section id="plans" className="scroll-mt-20 bg-sand/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="eyebrow" style={{ color: DIR }}>Plans</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Start free. Upgrade when you&apos;re ready.</h2>
            <p className="mt-3 text-lg text-ink-soft">
              Claiming a listing is free, and every plan includes a public listing. Paid plans add ways to sell. The price shown is the price charged.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {PLAN_ORDER.map((tier) => {
              const featured = tier === "premium";
              const accent = tier === "free" ? DIR : LOCAL;
              return (
                <div
                  key={tier}
                  className={`relative flex flex-col rounded-2xl border bg-paper p-7 shadow-soft ${featured ? "border-transparent ring-2" : "border-line"}`}
                  style={featured ? { boxShadow: `0 18px 40px ${LOCAL}22`, ["--tw-ring-color" as string]: LOCAL } : undefined}
                >
                  {featured && (
                    <span className="absolute -top-3 left-7 rounded-pill px-3 py-1 text-xs font-bold text-paper" style={{ background: LOCAL }}>
                      Recommended
                    </span>
                  )}
                  <h3 className="font-display text-2xl font-bold text-ink">{TIER_LABELS[tier]}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{TIER_PITCH[tier].headline}</p>
                  <p className="mt-4 font-display text-4xl font-bold" style={{ color: accent }}>
                    {TIER_PRICE[tier]}
                  </p>

                  <div className="mt-5 rounded-xl bg-sand/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">What you get</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{TIER_PITCH[tier].blurb}</p>
                  </div>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {includedThrough(tier).map((f) => (
                      <li key={f.label} className="flex items-start gap-2.5 text-sm text-ink">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {ROW_LABEL[f.label] ?? f.label}
                      </li>
                    ))}
                    {tier === "free" && (
                      <li className="flex items-start gap-2.5 text-sm text-ink-faint">
                        <span className="mt-0.5">·</span> Verified badge once your claim is approved
                      </li>
                    )}
                  </ul>

                  <PlanButton plan={tier} featured={featured} accent={LOCAL} />
                  {tier === "premium" && (
                    <p className="mt-1 text-center text-xs text-ink-muted">Or £290 a year — ten months for twelve, and we post you a tap-to-stamp tile.</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-6 max-w-3xl text-sm text-ink-soft">
            Bookings on Pro cost {BOOKING_FEE_PENCE}p each, capped at {BOOKING_CAP_UNITS} a month ({gbp(BOOKING_CAP_PENCE)}), so a Pro month never costs more than
            Premium. Selling tickets has a small per-ticket fee on every plan. Free listings include a cover photo and up to {FREE_GALLERY_LIMIT} gallery photos.
          </p>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="bg-sand/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="eyebrow" style={{ color: DIR }}>How it works</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Up and running in minutes</h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { n: "1", t: "Find and claim your listing", d: "Search for your business and claim it — free. We check each claim by hand. Not listed? Add it instead." },
              { n: "2", t: "Fill it in", d: "Add your hours, story and photos. Offers, loyalty and bookings are there when you upgrade." },
              { n: "3", t: "Upgrade when you’re ready", d: "Move up to Pro or Premium from your dashboard. You see the price and confirm before anything is charged." },
            ].map((step) => (
              <div key={step.n} className="rounded-2xl border border-line bg-paper p-7 shadow-soft">
                <span className="grid h-11 w-11 place-items-center rounded-pill font-display text-lg font-bold text-paper" style={{ background: LOCAL }}>
                  {step.n}
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-ink">{step.t}</h3>
                <p className="mt-2 text-ink-soft">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / FAQ ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow" style={{ color: LOCAL }}>Good to know</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Made locally, no lock-in</h2>
            <ul className="mt-6 space-y-3 text-ink-soft">
              {[
                "Payments handled securely by Stripe.",
                "Built and run in Shetland.",
                "Cancel anytime — no contracts.",
                "You see the full price and confirm it before any payment.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={LOCAL} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            {[
              { q: "Is claiming my listing really free?", a: "Yes. Claiming costs nothing and you can stay on the free plan for as long as you like. We check each claim by hand to keep the Directory trustworthy, and email you when there’s an outcome." },
              { q: "What’s free?", a: `A public listing — your story, a cover photo and up to ${FREE_GALLERY_LIMIT} gallery photos, hours, contacts and a map pin, and a verified badge once your claim is approved. You can also post jobs and shifts and list events (ticket sales carry a small per-ticket fee) at no monthly cost.` },
              { q: "Can I cancel?", a: "Yes. Upgrade, downgrade or cancel a paid plan any time from your business dashboard. You keep your free listing." },
              { q: "How do customers find me?", a: "Through the Directory and Local search, category and area filters and your own listing page. Premium listings also carry a ★ Featured badge and are shown first in places like the Directory’s featured row." },
              { q: "Why can I only pay here on the web?", a: "Subscriptions and add-ons are managed on the website. The app is for running your listing day to day." },
            ].map((f) => (
              <div key={f.q} className="rounded-2xl border border-line bg-paper p-6 shadow-soft">
                <h3 className="font-display text-lg font-bold text-ink">{f.q}</h3>
                <p className="mt-2 text-ink-soft">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Just starting out — cottage industries (secondary beat) ────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-4">
        <div
          className="rounded-2xl border p-8 shadow-soft sm:p-10"
          style={{ borderColor: `color-mix(in srgb, ${LOCAL} 22%, transparent)`, background: `color-mix(in srgb, ${LOCAL} 5%, white)` }}
        >
          <div className="grid items-center gap-8 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="eyebrow" style={{ color: LOCAL }}>Just starting out?</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">A kitchen-table business is welcome too.</h2>
              <p className="mt-3 leading-relaxed text-ink-soft">
                No shopfront, no website, no tech know-how needed. A free listing gets you found
                from day one, and the same tools the bigger businesses use — offers, bookings,
                loyalty, tickets — are there when you&apos;re ready to grow into them.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {["Knitters", "Bakers", "Crofters", "Makers & crafters", "A café", "Home hairdresser", "Photographers", "Growers"].map((t) => (
                  <li key={t} className="rounded-pill bg-sand px-3 py-1.5 text-sm font-semibold text-ink-soft">{t}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <a
                href={FINDER_ANCHOR}
                className="inline-flex rounded-pill px-6 py-3 text-base font-bold text-paper shadow-soft transition hover:brightness-110"
                style={{ background: LOCAL }}
              >
                Find or add your business — free
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-navy px-5 py-20 text-paper">
        <div
          className="absolute inset-0 opacity-90"
          style={{ background: `radial-gradient(100% 100% at 50% 0%, ${LOCAL}44, transparent 60%)` }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Put your business on the island&apos;s map.</h2>
          <p className="mt-4 text-lg text-paper/85">Claiming is free. Add offers, loyalty and bookings whenever you like.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={FINDER_ANCHOR}
              className="rounded-pill px-6 py-3 text-base font-bold text-paper shadow-lift transition hover:brightness-110"
              style={{ background: LOCAL }}
            >
              Find and claim your listing
            </a>
            <Link
              href="/directory/new"
              className="rounded-pill border border-paper/30 bg-paper/10 px-5 py-3 text-base font-semibold text-paper transition hover:bg-paper/20"
            >
              Add a business that isn&apos;t listed
            </Link>
          </div>
        </div>
      </section>
    </OwnerProvider>
  );
}

/* ── Add-on card ────────────────────────────────────────────────────────────── */
