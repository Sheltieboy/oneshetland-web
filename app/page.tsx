import Image from "next/image";
import Link from "next/link";
import { SECTIONS, type Section } from "@/lib/sections";

const HERO_IMG: Record<string, string> = {
  "whats-on": "/heroes/events.jpg",
  local: "/heroes/local.jpeg",
  directory: "/heroes/directory.jpg",
  boats: "/heroes/da-boats.jpg",
  jobs: "/heroes/jobs.webp",
  fetch: "/heroes/fetch.jpeg",
  memories: "/heroes/memories.jpg",
};

export default function Home() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-navy text-paper">
        <Image
          src="/heroes/da-boats.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/75 to-navy/30" />
        <div className="relative mx-auto max-w-6xl px-5 py-28 sm:py-36">
          <p className="eyebrow text-teal">For aa the isles</p>
          <h1 className="mt-4 max-w-3xl font-display text-[2.75rem] font-black leading-[1.02] sm:text-6xl md:text-7xl">
            Everything Shetland,
            <br />
            in one place.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/85">
            What&apos;s on, local businesses, the fishing fleet, the dialect,
            community hubs, jobs and more — one warm home for the islands, on
            every device.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="#sections"
              className="rounded-pill bg-teal px-6 py-3.5 font-semibold text-navy shadow-soft transition hover:bg-teal-dark"
            >
              Explore the isles
            </Link>
            <Link
              href="/sign-in"
              className="rounded-pill border border-paper/35 px-6 py-3.5 font-semibold text-paper transition hover:bg-paper/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Sections grid ────────────────────────────────────────────────── */}
      <section id="sections" className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <p className="eyebrow text-ink-muted">Browse</p>
        <h2 className="mt-2 max-w-2xl font-display text-4xl font-black leading-tight sm:text-5xl">
          Find your corner of Shetland
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-ink-soft">
          Ten sections, one account. Browse freely — sign in to buy tickets,
          join a hub, post a job or pick up where you left off on the app.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <SectionCard key={s.key} s={s} img={HERO_IMG[s.key]} />
          ))}
        </div>
      </section>
    </>
  );
}

function SectionCard({ s, img }: { s: Section; img?: string }) {
  return (
    <Link
      href={s.href}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-paper shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative h-44 overflow-hidden" style={{ background: s.color }}>
        {img ? (
          <Image
            src={img}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${s.color}e6, ${s.color}33 60%, ${s.color}11)`,
          }}
        />
        <h3 className="absolute inset-x-0 bottom-0 p-4 font-display text-2xl font-black text-paper drop-shadow-sm">
          {s.label}
        </h3>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-ink-soft">{s.blurb}</p>
        <span
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: s.color }}
        >
          Explore {s.label}
          <span aria-hidden className="transition group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
