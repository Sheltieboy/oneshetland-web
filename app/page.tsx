import Image from "next/image";
import Link from "next/link";
import { getHomeData } from "@/lib/home-data";
import { getHeroImage } from "@/lib/hero-context";
import { HomeFeed } from "@/components/home/HomeFeed";
import { SectionGrid } from "@/components/home/SectionGrid";
import { CruiseTodayCard } from "@/components/cruise/CruiseTodayCard";

// Live community content — always fetch fresh for now.
export const dynamic = "force-dynamic";

const QUICK_CHIPS = [
  { label: "What's On", href: "/whats-on" },
  { label: "Eat & Drink", href: "/local" },
  { label: "The Fleet", href: "/boats" },
  { label: "Spik", href: "/spik" },
];

export default async function Home() {
  const [data, heroImage] = await Promise.all([getHomeData(), getHeroImage()]);

  return (
    <>
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
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <p className="eyebrow text-paper [text-shadow:_0_1px_4px_rgb(0_0_0_/_55%)]">For aa the isles</p>
          <h1 className="mt-4 max-w-3xl font-display text-[2.75rem] font-bold leading-[1.02] text-paper [text-shadow:_0_2px_12px_rgb(0_0_0_/_55%)] sm:text-6xl md:text-7xl">
            Everything Shetland,
            <br />
            in one place.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper [text-shadow:_0_1px_6px_rgb(0_0_0_/_60%)]">
            What&apos;s on, local businesses, the fishing fleet, the dialect,
            community hubs, jobs and more — one warm home for the islands.
          </p>

          {/* Quick chips */}
          <div className="mt-8 flex flex-wrap gap-2.5">
            {QUICK_CHIPS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-pill border border-paper/30 bg-paper/10 px-4 py-2 text-sm font-medium text-paper backdrop-blur-sm transition hover:bg-paper/20"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── In port today ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-5 pt-8">
        <CruiseTodayCard />
      </div>

      {/* ── Live content feed ────────────────────────────────────────────── */}
      <HomeFeed data={data} />

      {/* ── Browse-everything grid ───────────────────────────────────────── */}
      <SectionGrid />
    </>
  );
}
