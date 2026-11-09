import Link from "next/link";
import type { ReactNode } from "react";

/**
 * ContributeCard: one invitation to add something to OneShetland, used at the end of the section it belongs to.
 * It is deliberately NOT an advert: no photograph, no promotion, no price. A tinted surface in the section's own colour, the site's concentric
 * ring motif very faintly behind it, a round icon, a question in Fraunces, one plain sentence, and one or two buttons. Every button is an
 * existing journey (the page it opens handles sign-in and eligibility itself); this component invents no route and submits nothing.
 * Pass a DEEP colour (white text on it must reach 4.5:1): amber #9a6409, jobs #1f7a4d, local #6d28d9, offers #b45309, community #6b47bf.
 */
export type ContributeAction = { label: string; href: string; primary?: boolean };

export const CONTRIBUTE_ICONS = {
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 9.5h18M12 12.5v5M9.5 15h5" /></>,
  shop: <><path d="M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5c0 1.700 1.300 2.500 2.700 2.500S9.300 11.200 9.300 9.500c0 1.700 1.300 2.500 2.700 2.500s2.700-.8 2.700-2.500c0 1.700 1.300 2.500 2.700 2.500S20 11.200 20 9.500" /><path d="M10 20v-4.500h4V20" /></>,
  work: <><rect x="3" y="7.500" width="18" height="12.500" rx="2.500" /><path d="M8.500 7.500V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.500M3 13h18M12 11v4" /></>,
  offer: <><path d="M3.500 12.500 12 4h7.500a1 1 0 0 1 1 1v7.500L12 21l-8.500-8.500Z" /><circle cx="16" cy="8" r="1.300" /><path d="M9.500 14.500 14 10" /></>,
  notice: <><path d="M4 9v6l10 4V5L4 9Z" /><path d="M14 8.500c2.500.5 4 1.800 4 3.500s-1.500 3-4 3.500M7 16.500l1.200 4" /></>,
} as const;

export function ContributeCard({ title, body, actions, color, icon, note, id }: { title: string; body: string; actions: ContributeAction[]; color: string; icon: keyof typeof CONTRIBUTE_ICONS; note?: ReactNode; id: string }) {
  return (
    <aside aria-labelledby={id} data-contribute className="relative isolate overflow-hidden rounded-3xl border p-4 sm:p-6" style={{ background: `color-mix(in srgb, ${color} 7%, #fffdf8)`, borderColor: `color-mix(in srgb, ${color} 22%, transparent)` }}>
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full opacity-60 [background:repeating-radial-gradient(circle,transparent_0_14px,var(--ring)_14px_15px)]" style={{ ["--ring" as string]: `color-mix(in srgb, ${color} 18%, transparent)` }} />
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 sm:grid-cols-[auto_1fr_auto] sm:gap-x-6 sm:gap-y-0">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-soft sm:row-span-2 sm:h-14 sm:w-14" style={{ background: color }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 sm:h-7 sm:w-7">{CONTRIBUTE_ICONS[icon]}</svg>
        </span>
        <h3 id={id} className="font-display text-[1.3rem] font-bold leading-tight text-ink sm:col-start-2 sm:self-end sm:text-2xl">{title}</h3>
        <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:self-start">
          <p className="text-[15px] leading-relaxed text-ink-soft sm:mt-1">{body}</p>
          {note && <p className="mt-1 text-[13px] leading-snug text-ink-muted">{note}</p>}
        </div>
        <div className="col-span-2 mt-1 flex flex-col gap-2 sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:flex-row sm:shrink-0">
          {actions.map((a) => (
            <Link key={a.href + a.label} href={a.href}
              className={`inline-flex min-h-11 items-center justify-center rounded-pill px-5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${a.primary ? "text-white shadow-soft hover:brightness-110" : "border bg-paper/70 text-ink hover:bg-paper"}`}
              style={a.primary ? { background: color } : { borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
