import Link from "next/link";
import type { ReactNode } from "react";
import { pickLatest, type Announcement } from "@/lib/home-announcements";
import { Reveal } from "@/components/home/Reveal";
import { ActivityPreview, ClaimPreview, JobsPreview, SavePreview } from "@/components/home/ProductPreviews";

/**
 * Latest from OneShetland: show the product, not a banner. The lead story pairs a headline with a working miniature of the real
 * screen; the two smaller stories each carry their own miniature. It sits on the page's own paper tone between Today and Discover, so
 * the page keeps its cream, white, sand rhythm. What each card shows (photo or a product preview) is chosen in Admin.
 */
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy";

function Tag({ k, dark = false }: { k: Announcement["kind"]; dark?: boolean }) {
  return k === "know"
    ? <span className={`font-display text-lg font-bold italic ${dark ? "text-amber-300" : "text-[#8a5a0b]"}`}>Did you know?</span>
    : <span className={`inline-flex items-center gap-2 rounded-pill px-3 py-1 text-[11px] font-black uppercase tracking-wide ${dark ? "bg-white text-[#b9780f]" : "bg-teal/20 text-navy"}`}><span className={`h-2 w-2 rounded-full ${dark ? "bg-[#d4921a]" : "bg-teal-dark"}`} />What&apos;s new</span>;
}

function Visual({ a }: { a: Announcement }): ReactNode {
  switch (a.visual) {
    case "activities": return <ActivityPreview />;
    case "jobs": return <JobsPreview />;
    case "claim": return <ClaimPreview />;
    default:
      // eslint-disable-next-line @next/next/no-img-element
      return a.image ? <img src={a.image} alt="" className="h-full w-full object-cover" /> : null;
  }
}

export function LatestEditorial({ items }: { items: Announcement[] }) {
  const { lead, second } = pickLatest(items);
  if (!lead) return null;
  const hasVisual = lead.visual !== "photo" || !!lead.image;
  return (
    <section aria-labelledby="latest-h" className="border-y border-line bg-paper">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-16">
        <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-9">
          <div>
            <p className="eyebrow" style={{ color: "#0e9ab8" }}>New on OneShetland</p>
            <h2 id="latest-h" className="mt-1.5 font-display text-3xl font-bold leading-[1.05] text-ink sm:text-5xl">Latest from OneShetland</h2>
            <p className="mt-3 max-w-xl font-display text-xl italic leading-snug text-ink-soft sm:text-2xl">A few things you can do here that you might not have tried.</p>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
          {/* Lead: the headline and a working miniature of the screen it describes. */}
          <Reveal className="lg:col-span-7"><article className="relative isolate h-full overflow-hidden rounded-3xl bg-navy text-white shadow-lift">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {lead.image && <img src={lead.image} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30" />}
            <div aria-hidden className="absolute inset-0 -z-10 [background:linear-gradient(160deg,rgba(3,47,76,.94),rgba(3,47,76,.82)),radial-gradient(70%_60%_at_85%_100%,rgba(18,179,214,.35),transparent)]" />
            <div className={`p-6 sm:p-9 lg:flex lg:h-full lg:flex-col lg:items-start lg:justify-center ${hasVisual ? "lg:max-w-[54%]" : "lg:min-h-[320px] lg:max-w-[80%]"}`}>
              <Tag k={lead.kind} dark />
              <h3 className="mt-4 font-display text-4xl font-bold leading-[1.02] sm:text-5xl">{lead.title}</h3>
              {lead.body && <p className="mt-4 text-base leading-relaxed text-white/85 sm:text-lg">{lead.body}</p>}
              <Link href={lead.href} className="mt-6 inline-block rounded-pill bg-white px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{lead.cta} →</Link>
            </div>
            {hasVisual && (
              <div className="mt-2 h-[300px] overflow-hidden sm:h-[330px] lg:absolute lg:inset-y-0 lg:right-6 lg:mt-0 lg:flex lg:h-auto lg:w-[264px] lg:items-center lg:overflow-visible">
                {lead.visual === "save" ? <SavePreview /> : lead.visual === "photo" ? <div className="mx-5 h-full overflow-hidden rounded-2xl shadow-lift sm:mx-9 lg:mx-0 lg:h-[420px] lg:w-full"><Visual a={lead} /></div> : <div className="h-full w-full"><Visual a={lead} /></div>}
              </div>
            )}
          </article></Reveal>

          {/* Two smaller stories, each with its own miniature. */}
          <div className="grid gap-4 sm:gap-5 lg:col-span-5 lg:grid-rows-2">
            {second.map((a, i) => (
              <Reveal key={a.id} delay={120 + i * 100}><div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-cream shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-lift active:scale-[.99]">
                <div inert aria-hidden className="relative overflow-hidden bg-sand lg:h-[104px]">{Visual({ a })}</div>
                <div className="p-5 sm:p-6 lg:py-5">
                  <Tag k={a.kind} />
                  <h3 className="mt-1.5 font-display text-2xl font-bold leading-snug text-ink lg:text-[1.35rem]">{a.title}</h3>
                  {a.body && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft lg:text-sm">{a.body}</p>}
                  <Link href={a.href} className={`mt-3 inline-block text-sm font-bold text-navy underline decoration-teal decoration-2 underline-offset-4 after:absolute after:inset-0 after:content-[''] ${FOCUS}`}>{a.cta} →</Link>
                </div>
              </div></Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
