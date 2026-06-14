import Image from "next/image";
import Link from "next/link";
import { getSection, SECTION_IMAGE } from "@/lib/sections";

/**
 * The shared landing for a section. For now it renders a cinematic hero + a
 * warm "coming soon" panel; each section's real content (live from Supabase)
 * gets dropped in here phase by phase.
 */
export function SectionPage({ sectionKey }: { sectionKey: string }) {
  const s = getSection(sectionKey);
  if (!s) return null;
  const img = SECTION_IMAGE[sectionKey];

  return (
    <>
      {/* Cinematic section hero */}
      <section
        className="relative isolate overflow-hidden text-paper"
        style={{ background: s.color }}
      >
        {img ? (
          <Image src={img} alt="" fill priority className="object-cover opacity-60" />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${s.color}e6, ${s.color}73 55%, ${s.color}33)`,
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <p className="eyebrow text-paper/80">OneShetland</p>
          <h1 className="mt-3 font-display text-5xl font-bold leading-[1.02] sm:text-6xl">
            {s.label}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper/90">
            {s.blurb}
          </p>
        </div>
      </section>

      {/* Coming-soon panel */}
      <section className="mx-auto max-w-3xl px-5 py-20 sm:py-24">
        <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft sm:p-12">
          <span
            className="mx-auto grid h-14 w-14 place-items-center rounded-pill text-paper"
            style={{ background: s.color }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8" />
            </svg>
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold">
            {s.label} is coming to the web
          </h2>
          <p className="mx-auto mt-3 max-w-md text-lg text-ink-soft">
            We&apos;re bringing this section across from the app, with the same
            live information and your same account. It&apos;ll appear here soon.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-pill bg-navy px-5 py-3 font-semibold text-paper transition hover:bg-navy-dark"
            >
              Back to home
            </Link>
            <Link
              href="/#sections"
              className="rounded-pill border border-line-strong px-5 py-3 font-semibold text-ink transition hover:bg-sand"
            >
              Browse other sections
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
