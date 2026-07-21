import Link from "next/link";
import Image from "next/image";
import { SECTIONS } from "@/lib/sections";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-navy text-paper">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-paper p-1.5">
                <Image src="/brand/logo-mark-keyed.png" alt="" width={32} height={32} unoptimized className="h-8 w-8" />
              </span>
              <span className="font-display text-xl font-semibold tracking-tight">OneShetland</span>
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

        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-paper/15 pt-6 text-sm text-paper/70">
          <Link href="/loyalty" className="hover:text-paper">Shop Local Shetland</Link>
          <Link href="/business" className="hover:text-paper">For businesses</Link>
          <Link href="/terms" className="hover:text-paper">Terms</Link>
          <Link href="/privacy" className="hover:text-paper">Privacy</Link>
          <Link href="/community-guidelines" className="hover:text-paper">Community guidelines</Link>
          <Link href="/driver-agreement" className="hover:text-paper">Driver agreement</Link>
          <Link href="/restricted-goods" className="hover:text-paper">Restricted goods</Link>
        </nav>

        <div className="mt-4 flex flex-col items-start justify-between gap-3 text-sm text-paper/55 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} OneShetland · a Darren Fullerton Consultancy Ltd platform</p>
          <p>Get the app — same account, in your pocket.</p>
        </div>
      </div>
    </footer>
  );
}
