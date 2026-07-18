import Link from "next/link";
import {
  TIER_LABELS,
  TIER_PRICE,
  PLAN_FEATURES,
  ADDON_META,
  PREMIUM_ADDON_KEYS,
  STANDARD_ADDON_KEYS,
  EXTRA_ADDON_MONTHLY_PENCE,
  type SubscriptionTier,
  type AddonKey,
} from "@/lib/business-data";
import { PhoneFrame, LaptopFrame } from "@/components/business/DeviceFrame";

export const metadata = {
  title: "For businesses",
  description:
    "List your Shetland business on OneShetland — free to start. Offers, loyalty, bookings, jobs and a featured spot across the islands' community app.",
};

/* Section accents: Local violet + Directory indigo. */
const LOCAL = "#7c3aed";
const DIR = "#4f46e5";

const EXTRA_ADDON_PRICE = `£${(EXTRA_ADDON_MONTHLY_PENCE / 100).toFixed(0)}/mo`;

/* ── The listing-richness ladder, mirrored from lib/listing-tiers.ts copy ──── */
const LISTING_LADDER: { tier: SubscriptionTier; unlocks: string }[] = [
  {
    tier: "free",
    unlocks:
      "Name, category and area, your logo, opening hours, one contact, a verified badge and a claim link.",
  },
  {
    tier: "pro",
    unlocks:
      "Adds your story, a cover photo, extra contacts, a map pin, and offers, loyalty, hiring and Local Wallet on your listing.",
  },
  {
    tier: "premium",
    unlocks:
      "Adds a featured badge, a photo gallery, events, a services catalogue, tickets and richer add-on sections.",
  },
];

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
    title: "Your Directory listing",
    benefit: "A proper home for your business — hours, contacts, map and story, found by anyone searching Shetland.",
    device: "phone",
    src: "/business/listing-phone.png",
    accent: DIR,
  },
  {
    title: "Local — offers, cashback & bookable",
    benefit: "Turn up in Local when folk browse shops and makers, filter for offers, cashback or businesses they can book.",
    device: "phone",
    src: "/business/local-phone.png",
    accent: LOCAL,
  },
  {
    title: "The homepage “Shop & eat local” spot",
    benefit: "Premium businesses get a featured placement right on the OneShetland home screen.",
    device: "laptop",
    src: "/business/home-desktop.png",
    accent: LOCAL,
  },
  {
    title: "Offers, stamps & loyalty",
    benefit: "Run time-limited offers and a digital stamp card — customers collect and redeem straight from their phone.",
    device: "phone",
    src: "/business/loyalty-phone.png",
    accent: LOCAL,
  },
  {
    title: "In-app bookings",
    benefit: "Take appointments and reservations without a separate system — bookings land in your dashboard.",
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
    benefit: "List what you’ve got on and sell tickets across What’s On and your own listing.",
    device: "phone",
    src: "/business/events-phone.png",
    accent: "#d4921a",
  },
  {
    title: "Fetch community delivery",
    benefit: "Let customers get your goods brought to their door the island way, through Fetch.",
    device: "phone",
    src: "/business/fetch-phone.png",
    accent: "#e0722a",
  },
  {
    title: "Community hubs",
    benefit: "Clubs, charities and groups get a branded hub — notices, members and fundraising in one place.",
    device: "laptop",
    src: "/business/hubs-desktop.png",
    accent: "#6b47bf",
  },
  {
    title: "Analytics dashboard",
    benefit: "See views, searches and redemptions so you know what’s working — right in your business dashboard.",
    device: "laptop",
    src: "/business/dashboard-desktop.png",
    accent: DIR,
  },
];

/* ── Plans ──────────────────────────────────────────────────────────────────── */
const PLAN_ORDER: SubscriptionTier[] = ["free", "pro", "premium"];
const PLAN_TAGLINE: Record<SubscriptionTier, string> = {
  free: "Get found — no cost, no catch.",
  pro: "Sell to the islands with offers, loyalty and Wallet.",
  premium: "Everything, plus a featured spot and bookings.",
};
const PLAN_CTA: Record<SubscriptionTier, string> = {
  free: "Start free",
  pro: "Choose Pro",
  premium: "Choose Premium",
};

function planLadder(tier: SubscriptionTier) {
  return LISTING_LADDER.find((l) => l.tier === tier)!.unlocks;
}
function includedThrough(tier: SubscriptionTier) {
  const rank: Record<SubscriptionTier, number> = { free: 0, pro: 1, premium: 2 };
  return PLAN_FEATURES.filter((f) => rank[f.req] <= rank[tier]);
}

export default function BusinessLandingPage() {
  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-navy text-paper">
        <div
          className="absolute inset-0 opacity-90"
          style={{ background: `radial-gradient(120% 90% at 15% 0%, ${LOCAL}55, transparent 55%), radial-gradient(120% 90% at 90% 20%, ${DIR}44, transparent 60%)` }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="eyebrow text-paper/80">OneShetland for businesses</p>
            <h1 className="mt-4 font-display text-[2.6rem] font-bold leading-[1.03] sm:text-5xl lg:text-6xl">
              Grow your business across Shetland, in one place.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper/85">
              Reach the customers already in the app the whole island uses. A free listing
              gets you found; add offers, loyalty, bookings and a featured spot to turn that
              reach into repeat custom. Made locally — cancel anytime.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/directory/new"
                className="rounded-pill px-6 py-3 text-base font-bold text-paper shadow-lift transition hover:brightness-110"
                style={{ background: LOCAL }}
              >
                Create your free listing
              </Link>
              <Link
                href="/directory"
                className="rounded-pill border border-paper/30 bg-paper/10 px-5 py-3 text-base font-semibold text-paper backdrop-blur-sm transition hover:bg-paper/20"
              >
                Already listed? Claim it
              </Link>
              <a
                href="#plans"
                className="rounded-pill px-4 py-3 text-base font-semibold text-paper/80 underline-offset-4 transition hover:text-paper hover:underline"
              >
                See plans
              </a>
            </div>
            <p className="mt-4 text-sm text-paper/60">Free to start · {TIER_PRICE.free} for a Directory listing.</p>
          </div>
          <div className="hidden md:block">
            <PhoneFrame src="/business/listing-phone.png" alt="A OneShetland business listing on a phone" accent={LOCAL} className="max-w-[240px]" />
          </div>
        </div>
      </section>

      {/* ── The reach — a captured local market already in the app ─────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <p className="eyebrow" style={{ color: DIR }}>A market that&apos;s already here</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Get in front of the folk already looking.</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              People in and around Shetland open OneShetland every day to see what&apos;s on, shop
              local and find who to hire. That&apos;s a local audience you can&apos;t buy on social —
              already in one place, already looking. Put your business where their attention is,
              then turn it into custom with offers, a loyalty card, bookings and a featured spot
              on the home screen.
            </p>
            <Link
              href="/directory"
              className="mt-8 inline-flex rounded-pill px-6 py-3 text-base font-bold text-paper shadow-soft transition hover:brightness-110"
              style={{ background: DIR }}
            >
              Claim or add your business
            </Link>
          </div>

          <div
            className="rounded-2xl border p-8 shadow-soft sm:p-10"
            style={{ borderColor: `color-mix(in srgb, ${DIR} 25%, transparent)`, background: `color-mix(in srgb, ${DIR} 6%, white)` }}
          >
            <p className="eyebrow" style={{ color: DIR }}>Your customers are already here</p>
            <p className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">The whole community, in one app.</p>
            <p className="mt-3 leading-relaxed text-ink-soft">
              One island, one app — what&apos;s on, shopping, jobs, delivery and more, all under the
              same roof. Your listing shows up across every part of it, so a customer who finds
              your café can just as easily book you, spend at you and come back.
            </p>
            <div className="mt-7 grid grid-cols-3 gap-3 text-center">
              {[["One", "island"], ["Every day", "engaged"], ["No", "ad spend"]].map(([big, small]) => (
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
            Your listing works across all of it.
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
      </section>

      {/* ── Plans ──────────────────────────────────────────────────────────── */}
      <section id="plans" className="scroll-mt-20 bg-sand/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="eyebrow" style={{ color: DIR }}>Plans</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Start free. Upgrade when you&apos;re ready.</h2>
            <p className="mt-3 text-lg text-ink-soft">
              Every plan includes a public listing. Higher tiers unlock a richer listing and more ways to sell.
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
                  <p className="mt-1 text-sm text-ink-muted">{PLAN_TAGLINE[tier]}</p>
                  <p className="mt-4 font-display text-4xl font-bold" style={{ color: accent }}>
                    {TIER_PRICE[tier]}
                  </p>

                  <div className="mt-5 rounded-xl bg-sand/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Your public listing</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{planLadder(tier)}</p>
                  </div>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {includedThrough(tier).map((f) => (
                      <li key={f.label} className="flex items-start gap-2.5 text-sm text-ink">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {f.label}
                      </li>
                    ))}
                    {tier === "free" && (
                      <li className="flex items-start gap-2.5 text-sm text-ink-faint">
                        <span className="mt-0.5">·</span> Verified badge & claim your listing
                      </li>
                    )}
                  </ul>

                  <Link
                    href={tier === "free" ? "/directory/new" : `/directory/new?plan=${tier}`}
                    className={`mt-6 rounded-pill px-5 py-3 text-center text-base font-bold transition ${featured ? "text-paper hover:brightness-110" : "border text-ink hover:bg-sand"}`}
                    style={featured ? { background: LOCAL } : { borderColor: "var(--color-line-strong)" }}
                  >
                    {PLAN_CTA[tier]}
                  </Link>
                  <p className="mt-2 text-center text-xs text-ink-muted">
                    {tier === "free" ? "Upgrade anytime from your dashboard." : "Create your listing, then pay — cancel anytime."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Add-ons ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow" style={{ color: LOCAL }}>Add-ons</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Build exactly what you need</h2>
          <p className="mt-3 text-lg text-ink-soft">
            Premium includes your first premium add-on. Each extra is {EXTRA_ADDON_PRICE}. The rest come
            free with your listing.
          </p>
        </div>

        <h3 className="mt-10 font-display text-xl font-bold text-ink">Premium add-ons</h3>
        <p className="mt-1 text-sm text-ink-muted">First one included with Premium · each additional {EXTRA_ADDON_PRICE}.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PREMIUM_ADDON_KEYS.map((key) => (
            <AddonCard key={key} addonKey={key} accent={LOCAL} tag="Premium" />
          ))}
        </div>

        <h3 className="mt-12 font-display text-xl font-bold text-ink">Included with your listing</h3>
        <p className="mt-1 text-sm text-ink-muted">Free with every plan.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STANDARD_ADDON_KEYS.map((key) => (
            <AddonCard key={key} addonKey={key} accent={DIR} tag="Free" />
          ))}
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
              { n: "1", t: "Claim or create your listing", d: "Search the Directory and claim your business, or add a new one. Free, no upfront cost." },
              { n: "2", t: "Fill it in", d: "Add your hours, story and photos, then switch on offers, loyalty and bookings." },
              { n: "3", t: "Upgrade when you’re ready", d: "Move up to Pro or Premium from your dashboard to unlock a richer listing and a featured spot." },
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
                "Prices shown exclude VAT where applicable.",
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
              { q: "What’s free?", a: "A public Directory listing — your name, category, area, logo, opening hours, one contact, a verified badge and the ability to post jobs — is free forever." },
              { q: "Can I cancel?", a: "Yes. Upgrade, downgrade or cancel anytime from your business dashboard. You keep your free listing." },
              { q: "How do customers find me?", a: "Through the Directory and Local search, category and area filters, the homepage, and — on Premium — a featured spot on the OneShetland home screen." },
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
                {["Knitters", "Bakers", "Crofters", "Makers & crafters", "A wee café", "Home hairdresser", "Photographers", "Growers"].map((t) => (
                  <li key={t} className="rounded-pill bg-sand px-3 py-1.5 text-sm font-semibold text-ink-soft">{t}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <Link
                href="/directory/new"
                className="inline-flex rounded-pill px-6 py-3 text-base font-bold text-paper shadow-soft transition hover:brightness-110"
                style={{ background: LOCAL }}
              >
                Start free — no upfront cost
              </Link>
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
          <p className="mt-4 text-lg text-paper/85">Free to start. Add offers, loyalty and bookings whenever you like.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/directory/new"
              className="rounded-pill px-6 py-3 text-base font-bold text-paper shadow-lift transition hover:brightness-110"
              style={{ background: LOCAL }}
            >
              Create your free listing
            </Link>
            <Link
              href="/directory"
              className="rounded-pill border border-paper/30 bg-paper/10 px-5 py-3 text-base font-semibold text-paper transition hover:bg-paper/20"
            >
              Claim an existing one
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ── Add-on card ────────────────────────────────────────────────────────────── */
function AddonCard({ addonKey, accent, tag }: { addonKey: AddonKey; accent: string; tag: string }) {
  const meta = ADDON_META[addonKey];
  return (
    <div className="flex gap-3.5 rounded-2xl border border-line bg-paper p-5 shadow-soft">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-base font-bold"
        style={{ background: `${accent}14`, color: accent }}
        aria-hidden
      >
        {meta.label.slice(0, 1)}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-ink">{meta.label}</h4>
          <span className="rounded-pill px-2 py-0.5 text-[10px] font-bold" style={{ background: `${accent}14`, color: accent }}>
            {tag}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{meta.description}</p>
      </div>
    </div>
  );
}
