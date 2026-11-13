import Link from "next/link";
import type { ReactNode } from "react";
import { HOUSE_SWAPS_DISCLAIMER, NEVER_PAY } from "@/lib/house-swaps";

/** The warm teal band shared by every House Swaps page. */
export function SwapsHeader({ title, intro, eyebrow = "House Swaps" }: { title: string; intro?: ReactNode; eyebrow?: string }) {
  return (
    <section className="text-paper" style={{ background: "linear-gradient(135deg, #032f4c 0%, #0a4a70 60%, #0e7a94 100%)" }}>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <p className="eyebrow text-paper/80">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] sm:text-5xl">{title}</h1>
        {intro && <div className="mt-4 max-w-2xl text-base leading-relaxed text-paper/90 sm:text-lg">{intro}</div>}
      </div>
    </section>
  );
}

const LINKS = [
  { href: "/house-swaps", label: "Noticeboard", key: "board" },
  { href: "/house-swaps/my", label: "My advert", key: "my" },
  { href: "/house-swaps/matches", label: "Possible matches", key: "matches" },
  { href: "/house-swaps/messages", label: "Messages", key: "messages" },
  { href: "/house-swaps/about", label: "How it works", key: "about" },
] as const;

/** Section navigation under the header. `unread` shows a count badge on Messages. */
export function SwapsNav({ current, unread = 0 }: { current: (typeof LINKS)[number]["key"]; unread?: number }) {
  return (
    <nav aria-label="House Swaps" className="border-b border-line bg-paper">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LINKS.map((l) => (
          <li key={l.key} className="shrink-0">
            <Link href={l.href} aria-current={current === l.key ? "page" : undefined}
              className={"relative inline-flex min-h-[48px] items-center gap-2 px-3 text-sm font-semibold transition " + (current === l.key ? "text-navy after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-navy" : "text-ink-soft hover:text-ink")}>
              {l.label}
              {l.key === "messages" && unread > 0 && <span className="grid min-w-[20px] place-items-center rounded-pill bg-rose-600 px-1.5 text-[11px] font-bold leading-5 text-white"><span aria-hidden>{unread}</span><span className="sr-only">{unread} unread</span></span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** `compact` (noticeboard): one visible line with the three key points; the full wording opens underneath. Everywhere else the full wording is always shown. */
export function Disclaimer({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <details aria-label="Important to know" className={`group rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 ${className}`}>
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 font-semibold marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <span>Before you swap: introductions only, both landlords must agree in writing, and never pay anyone to arrange a swap.</span>
          <span aria-hidden="true" className="shrink-0 text-xs font-bold underline group-open:hidden">Read more</span>
          <span aria-hidden="true" className="hidden shrink-0 text-xs font-bold underline group-open:inline">Hide</span>
        </summary>
        <div className="border-t border-amber-300/70 pt-3">
          <strong className="font-bold">Please read: </strong>{HOUSE_SWAPS_DISCLAIMER}
          <span className="mt-2 block font-semibold">{NEVER_PAY}</span>
        </div>
      </details>
    );
  }
  return (
    <aside aria-label="Important to know" className={`rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 ${className}`}>
      <strong className="font-bold">Please read: </strong>{HOUSE_SWAPS_DISCLAIMER}
      <span className="mt-2 block font-semibold">{NEVER_PAY}</span>
    </aside>
  );
}

export function Panel({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return <section {...rest} className={`rounded-card border border-line bg-paper p-5 shadow-soft sm:p-6 ${className}`}>{children}</section>;
}

export const btnPrimary = "inline-flex min-h-[44px] items-center justify-center rounded-pill bg-navy px-5 text-sm font-bold text-paper shadow-soft transition hover:bg-navy-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-60";
export const btnSecondary = "inline-flex min-h-[44px] items-center justify-center rounded-pill border border-line-strong bg-paper px-5 text-sm font-bold text-ink transition hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-60";
export const btnDanger = "inline-flex min-h-[44px] items-center justify-center rounded-pill border border-rose-300 bg-paper px-5 text-sm font-bold text-rose-800 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:opacity-60";
export const fieldCls = "min-h-[44px] w-full rounded-xl border border-line-strong bg-paper px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy";
