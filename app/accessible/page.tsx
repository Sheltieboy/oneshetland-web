import Link from "next/link";
import type { Metadata } from "next";
import { listPublishedAccessibility } from "@/lib/accessibility-data";
import { RESOURCE_SECTIONS } from "@/lib/accessibility-resources";
import { AccessibleBrowse } from "@/components/accessibility/AccessibleBrowse";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Accessible Shetland",
  description: "Practical information about access, facilities and assistance in Shetland, shared by the places themselves, with links to the organisations who know most.",
};

export default async function AccessibleShetlandPage() {
  const items = await listPublishedAccessibility();
  return (
    <div>
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-300">Accessible Shetland</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl">Plan your visit on your own terms.</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/90">Accessible Shetland brings practical information about access, facilities and assistance together in one place, helping you decide what works for you. We’re building this with Shetland’s businesses, organisations and community. More information will be added as people get involved.</p>
          <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-3">
            <a href="#planning" className="inline-flex min-h-11 items-center rounded-pill bg-white px-5 text-sm font-bold text-ink">Planning a visit</a>
            <a href="#exploring" className="inline-flex min-h-11 items-center rounded-pill border border-white/70 px-5 text-sm font-bold text-white">Exploring Shetland</a>
            <a href="#help" className="inline-flex min-h-11 items-center rounded-pill border border-white/70 px-5 text-sm font-bold text-white">Help us build it</a>
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-14 px-5 py-12">
        <section aria-labelledby="how" className="rounded-card border border-line bg-paper p-5 sm:p-6">
          <h2 id="how" className="font-display text-xl font-bold">How to read this</h2>
          <ul className="mt-3 space-y-2 text-ink">
            <li><strong>Specific facts, not labels.</strong> We show things like “step-free entrance” or “hearing loop”, never a single “accessible” badge, because what works depends on you.</li>
            <li><strong>Who said so.</strong> Each listing says whether the details come from the owner, an official source, or were independently checked. We have not checked anything unless it says so.</li>
            <li><strong>Missing is not “no”.</strong> If something is not listed, it has not been shared. Please ask before you travel; details can change.</li>
          </ul>
        </section>

        <section id="planning" aria-labelledby="planning-h" className="scroll-mt-20">
          <h2 id="planning-h" className="font-display text-3xl font-bold">Planning a visit</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">Getting here and getting around. These organisations run the services, so they hold the up-to-date detail on assistance and how much notice they need. We link to them rather than copying.</p>
          <div className="mt-6 space-y-8">
            {RESOURCE_SECTIONS.filter((s) => s.id === "travel" || s.id === "visiting").map((s) => <ResourceBlock key={s.id} id={s.id} title={s.title} blurb={s.blurb} items={s.items} />)}
          </div>
        </section>

        <section id="exploring" aria-labelledby="exploring-h" className="scroll-mt-20">
          <h2 id="exploring-h" className="font-display text-3xl font-bold">Exploring Shetland</h2>
          {items.length > 0 ? (
            <>
              <p className="mt-2 max-w-2xl text-ink-soft">Places, events and groups that have shared access details themselves. This list grows as more people add information.</p>
              <div className="mt-6"><AccessibleBrowse items={items} /></div>
            </>
          ) : (
            <p className="mt-2 max-w-2xl text-ink-soft">Local businesses, events and groups can now share access details here. As they do, you’ll be able to browse and filter them in this section, and see the same details on their own pages. In the meantime the guides above are the best place to start.</p>
          )}
        </section>

        <section aria-labelledby="support-h">
          <h2 id="support-h" className="font-display text-3xl font-bold">Local support and helpful information</h2>
          <div className="mt-6 space-y-8">
            {RESOURCE_SECTIONS.filter((s) => s.id === "support" || s.id === "info").map((s) => <ResourceBlock key={s.id} id={s.id} title={s.title} blurb={s.blurb} items={s.items} />)}
          </div>
          <p className="mt-6 max-w-2xl text-sm text-ink-soft">These links go to other organisations’ websites. Listing them does not mean they are involved with OneShetland or endorse it. Their information is theirs, and may change.</p>
        </section>

        <section id="help" aria-labelledby="help-h" className="scroll-mt-20 rounded-card border-2 border-ink bg-white p-6 sm:p-8">
          <h2 id="help-h" className="font-display text-3xl font-bold">Help us build it</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            <div><h3 className="font-bold">Run a business, group or event?</h3><p className="mt-1 text-sm text-ink-soft">Tell people what to expect: steps, parking, toilets, quiet times, how you can help. It’s free, you choose what to say, and you can save a draft. Find it under “Help people plan their visit” in your management area.</p><Link href="/account" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">Go to my account</Link></div>
            <div><h3 className="font-bold">Spotted something wrong?</h3><p className="mt-1 text-sm text-ink-soft">On any listing with access details, choose “Suggest a correction”. A person reads every suggestion before anything changes. Please describe the place, never yourself.</p></div>
            <div><h3 className="font-bold">Represent an organisation?</h3><p className="mt-1 text-sm text-ink-soft">If your organisation helps people with access or assistance in Shetland and would like to be listed, or a link here is out of date, please tell us.</p><Link href="/support" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">Contact us</Link></div>
          </div>
          <p className="mt-6 text-sm text-ink-soft">We never ask for or show anyone’s health or disability information.</p>
        </section>
      </div>
    </div>
  );
}

function ResourceBlock({ id, title, blurb, items }: { id: string; title: string; blurb: string; items: { title: string; href: string; by: string; about: string }[] }) {
  return (
    <div aria-labelledby={`r-${id}`}>
      <h3 id={`r-${id}`} className="font-display text-xl font-bold">{title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{blurb}</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((r) => (
          <li key={r.href} className="rounded-card border border-line bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{r.by}</p>
            <a href={r.href} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block font-display text-base font-bold underline underline-offset-2">{r.title}<span className="sr-only"> (opens the {r.by} website in a new tab)</span></a>
            <p className="mt-1 text-sm text-ink-soft">{r.about}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
