import type { ReactNode } from "react";

/**
 * The official sources for getting to an event. Used on public event pages while the journey planner is switched off
 * (see lib/transport-flags.ts). Every link goes to the operator's own, current page; we show no times of our own.
 */
export const TRANSPORT_LINKS = [
  { key: "bus", title: "Bus timetables", note: "ZetTrans: the current Shetland bus timetables", href: "https://www.zettrans.org.uk/travel/public-transport/bus", icon: "bus" },
  { key: "planner", title: "Journey planner", note: "Traveline Scotland: plan a trip door to door", href: "https://www.travelinescotland.com/", icon: "route" },
  { key: "ferry", title: "Inter-island ferry timetables", note: "Shetland Islands Council: Yell, Unst, Whalsay, Bressay and more", href: "https://www.shetland.gov.uk/ferries/timetable", icon: "ferry" },
  { key: "status", title: "Live ferry status", note: "Shetland Islands Council: is your ferry running?", href: "https://www.shetland.gov.uk/homepage/73/ferry-status", icon: "signal", live: true },
  { key: "northlink", title: "NorthLink timetables", note: "Aberdeen, Kirkwall and Lerwick sailings", href: "https://www.northlinkferries.co.uk/book/routes-times-and-prices/timetables/", icon: "ship" },
  { key: "northlink-updates", title: "NorthLink service updates", note: "Delays, cancellations and weather notices", href: "https://www.northlinkferries.co.uk/opsnews/", icon: "bell" },
] as const;

const PATHS: Record<string, ReactNode> = {
  bus: <path d="M5 16V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10M5 16h14M5 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M16 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M5 11h14M9 15h.01M15 15h.01" />,
  route: <path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />,
  ferry: <path d="M3 17c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0M5 14l1-6h12l1 6M12 8V4M9 4h6" />,
  signal: <path d="M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0M12 12h.01M12 12v7" />,
  ship: <path d="M4 16l1.5-6h13L20 16M3 19c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M9 10V6h6v4M12 6V3" />,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />,
};

/** A calm, reassuring panel: no times, no claims, just the right official pages. */
export function GettingThereLinks() {
  return (
    <section aria-labelledby="plan-journey-h" className="mt-10" data-getting-there-links>
      <h2 id="plan-journey-h" className="font-display text-2xl font-bold">Planning your journey?</h2>
      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-paper shadow-soft">
        <div className="border-b border-line bg-sand/50 px-4 py-3.5 sm:px-5">
          <p className="text-sm text-ink-soft">
            Find the latest timetables and travel updates directly from Shetland&apos;s transport operators.
          </p>
        </div>
        <ul className="grid gap-px bg-line sm:grid-cols-2">
          {TRANSPORT_LINKS.map((l) => (
            <li key={l.key} className="bg-paper">
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-h-[64px] items-center gap-3 px-4 py-3 transition hover:bg-sand/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-5 motion-reduce:transition-none"
              >
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-teal)_14%,#fff)] text-navy-light">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{PATHS[l.icon]}</svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-ink group-hover:underline">
                    {l.title}
                    {"live" in l && l.live && <span className="rounded-pill bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-900">Official live status</span>}
                  </span>
                  <span className="block text-sm text-ink-soft">{l.note}</span>
                </span>
                <span aria-hidden className="text-ink-muted">↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="border-t border-line bg-sand/40 px-4 py-2.5 text-xs text-ink-muted sm:px-5">
          Times and sailings can change, especially in bad weather, so it&apos;s always worth a quick check before you set off.
        </p>
      </div>
    </section>
  );
}
