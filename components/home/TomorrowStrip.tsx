import Link from "next/link";
import { Reveal } from "@/components/home/Reveal";

export type TomorrowItem = { time: string; title: string; place: string; href: string };

/** The reason to come back: tomorrow's first few things, set as an editorial list rather than cards. */
export function TomorrowStrip({ date, items }: { date: string; items: TomorrowItem[] }) {
  if (items.length === 0) return null;
  return (
    <Reveal className="mt-10 border-t border-line pt-6 sm:mt-12 sm:pt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-2xl font-bold text-ink sm:text-3xl">Tomorrow <span className="font-medium italic text-ink-soft">{date}</span></h3>
        <Link href="/whats-on" className="text-sm font-bold text-navy underline decoration-teal decoration-2 underline-offset-4">Full calendar →</Link>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {items.map((t) => (
          <li key={t.title} className="[&:nth-child(n+3)]:hidden sm:[&:nth-child(n+3)]:block">
            <Link href={t.href} className="group flex items-baseline gap-4 py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
              <span className="w-14 shrink-0 text-sm font-bold tabular-nums text-[#b9780f]">{t.time}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-bold leading-snug text-ink group-hover:underline group-hover:decoration-amber-400 group-hover:decoration-2 group-hover:underline-offset-4 sm:text-2xl">{t.title}</span>
                <span className="block text-sm text-ink-muted">{t.place}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
