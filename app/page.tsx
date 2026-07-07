import Image from "next/image";
import Link from "next/link";
import { getHomeData, getHomeContent } from "@/lib/home-data";
import { getHeroImage } from "@/lib/hero-context";
import { getHomePersonal, getTodaysGame, formatPence } from "@/lib/home-extras";
import { getTodaySnapshot } from "@/lib/shetland-today";
import { HomeBento } from "@/components/home/HomeBento";
import { SectionGrid } from "@/components/home/SectionGrid";
import { ShetlandTodayCard } from "@/components/home/ShetlandTodayCard";
import { UrgentAlertBanner } from "@/components/home/UrgentAlertBanner";
import { ForYou } from "@/components/home/ForYou";
import { getAccount, accountName } from "@/lib/auth";
import { getForYou } from "@/lib/for-you.server";

// Live community content — always fetch fresh for now.
export const dynamic = "force-dynamic";

const QUICK_CHIPS = [
  { label: "What's On", href: "/whats-on" },
  { label: "Eat & Drink", href: "/local" },
  { label: "The Fleet", href: "/boats" },
  { label: "Spik", href: "/spik" },
];

export default async function Home() {
  const [data, heroImage, personal, today, homeContent, account] = await Promise.all([
    getHomeData(),
    getHeroImage(),
    getHomePersonal(),
    // Lerwick snapshot rendered on the server; the card's "Near me" toggle
    // re-fetches client-side via /api/shetland-today. Never throws.
    getTodaySnapshot().catch(() => null),
    getHomeContent(),
    getAccount(),
  ]);
  const game = getTodaysGame();

  // Personalised "For you" strip — signed-in users only. Never throws.
  const forYou = account ? await getForYou(account.id).catch(() => []) : [];

  return (
    <>
      {/* ── Urgent / partner alerts ──────────────────────────────────────── */}
      <UrgentAlertBanner alerts={data.alerts} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-navy text-paper">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          unoptimized
          className="object-cover object-center"
        />
        {/* Neutral legibility scrim — darker toward the lower-left where the
            text sits, fading to clear so the photo shows through. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-9 px-5 py-14 sm:py-16 md:grid-cols-[1fr_minmax(300px,360px)] md:gap-10 lg:gap-12 lg:py-20">
          {/* Left — wordmark message + chips */}
          <div>
            <p className="eyebrow text-paper [text-shadow:_0_1px_4px_rgb(0_0_0_/_55%)]">For aa the isles</p>
            <h1 className="mt-4 font-display text-[2.5rem] font-bold leading-[1.03] text-paper [text-shadow:_0_2px_12px_rgb(0_0_0_/_55%)] sm:text-5xl lg:text-6xl">
              Everything Shetland,
              <br />
              in one place.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper [text-shadow:_0_1px_6px_rgb(0_0_0_/_60%)]">
              What&apos;s on, local businesses, the fishing fleet, the dialect,
              community hubs, jobs and more — one warm home for the islands.
            </p>

            {/* Quick chips + wallet (signed-in) */}
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              {QUICK_CHIPS.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="rounded-pill border border-paper/30 bg-paper/10 px-4 py-2 text-sm font-medium text-paper backdrop-blur-sm transition hover:bg-paper/20"
                >
                  {c.label}
                </Link>
              ))}
              {personal.signedIn && (
                <Link
                  href="/account/wallet"
                  className="inline-flex items-center gap-1.5 rounded-pill border border-paper/40 bg-paper/20 px-4 py-2 text-sm font-bold text-paper backdrop-blur-sm transition hover:bg-paper/30"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm15 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
                  </svg>
                  Wallet · {formatPence(personal.walletPence)}
                </Link>
              )}
            </div>
          </div>

          {/* Right — frosted Shetland Today panel (weather · daylight · tides) */}
          <ShetlandTodayCard initial={today} glass />
        </div>
      </section>

      {/* ── For you — personalised, signed-in only ───────────────────────── */}
      {account && forYou.length > 0 && (
        <ForYou name={accountName(account).split(" ")[0]} items={forYou} />
      )}

      {/* ── Bento — the live homepage mosaic ─────────────────────────────── */}
      <HomeBento data={data} game={game} content={homeContent} />

      {/* ── Browse-everything grid ───────────────────────────────────────── */}
      <SectionGrid />
    </>
  );
}
