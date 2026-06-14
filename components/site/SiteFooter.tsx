import Link from "next/link";
import { SECTIONS } from "@/lib/sections";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-navy text-paper">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-paper text-navy">
                <span className="font-display text-lg font-black leading-none">O</span>
              </span>
              <span className="font-display text-xl font-black tracking-tight">OneShetland</span>
            </div>
            <p className="mt-4 max-w-xs text-paper/70">
              Everything Shetland, in one place — built for the islands, by the islands.
            </p>
          </div>

          <div>
            <h4 className="eyebrow text-paper/50">Explore</h4>
            <ul className="mt-3 space-y-2">
              {SECTIONS.slice(0, 5).map((s) => (
                <li key={s.key}>
                  <Link href={s.href} className="text-paper/80 hover:text-paper">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="eyebrow text-paper/50">More</h4>
            <ul className="mt-3 space-y-2">
              {SECTIONS.slice(5).map((s) => (
                <li key={s.key}>
                  <Link href={s.href} className="text-paper/80 hover:text-paper">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-paper/15 pt-6 text-sm text-paper/55 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} OneShetland</p>
          <p>Get the app — same account, in your pocket.</p>
        </div>
      </div>
    </footer>
  );
}
