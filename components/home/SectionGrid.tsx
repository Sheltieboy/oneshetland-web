import Image from "next/image";
import Link from "next/link";
import { SECTIONS, SECTION_IMAGE, type Section } from "@/lib/sections";

export function SectionGrid() {
  return (
    <section id="sections" className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
      <p className="eyebrow text-ink-muted">Browse everything</p>
      <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl">
        Find your corner of Shetland
      </h2>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        Ten sections, one account. Browse freely — sign in to buy tickets, join a
        hub, post a job or pick up where you left off on the app.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <SectionCard key={s.key} s={s} img={SECTION_IMAGE[s.key]} />
        ))}
      </div>
    </section>
  );
}

function SectionCard({ s, img }: { s: Section; img?: string }) {
  return (
    <Link
      href={s.href}
      // The card lights up in its OWN section colour on hover: a coloured ring
      // (via a box-shadow ring using the section colour) + the existing lift.
      // Ring colour is set as a CSS var so the Tailwind ring picks it up.
      style={{ "--ring": s.color } as React.CSSProperties}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-paper shadow-soft ring-2 ring-transparent transition duration-300 hover:-translate-y-1 hover:shadow-lift hover:ring-[var(--ring)]"
    >
      <div className="relative h-40 overflow-hidden" style={{ background: s.color }}>
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
          style={{ background: `linear-gradient(to top, ${s.color}d9, ${s.color}26 55%, transparent)` }}
        />
        <h3 className="absolute inset-x-0 bottom-0 p-4 font-display text-2xl font-bold text-paper drop-shadow-sm">
          {s.label}
        </h3>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-ink-soft">{s.blurb}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: s.color }}>
          Explore {s.label}
          <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </Link>
  );
}
