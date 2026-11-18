"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MORE_NAV, primaryNav } from "@/lib/sections";
import { HouseSwapsMoreLink } from "@/components/house-swaps/NavFlag";
import { FetchStatusIndicator } from "@/components/fetch/FetchStatusIndicator";
import { NotificationBell } from "@/components/site/NotificationBell";
import { BasketPill } from "@/components/shop/BasketPill";
import { SiteSearch } from "@/components/search/SiteSearch";
import { MobileMenu } from "@/components/site/MobileMenu";
import { useSaved } from "@/components/saved/context";
import { SAVED_MENU_LABEL } from "@/lib/saved-copy";
import { brandMark } from "@/lib/festive";

type HeaderUser = { name: string; avatarUrl: string | null } | null;
type FetchStatus = { userId: string; status: string | null; count: number } | null;

export function SiteHeader({ user = null, fetchStatus = null, addEvent = false, editionsEnabled = false, festive = false }: { user?: HeaderUser; fetchStatus?: FetchStatus; addEvent?: boolean; editionsEnabled?: boolean; festive?: boolean }) {
  // Editions appears in the bar only while the public switch is on (lib/sections.ts decides where); Cruise lives in "More" either way.
  const nav = primaryNav(editionsEnabled);
  const savedOn = useSaved().enabled;   // My Saved menu entry: only when the feature is on
  // The mobile menu is open only on the page it was opened on, so any navigation closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState(false);
  const pathname = usePathname();
  const open = openAt === pathname;
  const setOpen = useCallback((v: boolean | ((o: boolean) => boolean)) => setOpenAt((cur) => ((typeof v === "function" ? v(cur === pathname) : v) ? pathname : null)), [pathname]);
  const closeMenu = useCallback(() => setOpenAt(null), []);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-line/70 bg-cream/85 backdrop-blur-md">
      {/* THE HEADER'S WIDTH, and why 1440.
          max-w-7xl caps this row at 1280px at EVERY viewport above 1280, so a wider screen never gave the bar more room. The
          fullest signed-in header — the wordmark, the nav, search, a basket with items, "For businesses", a Fetch delivery pill
          at its longest label, the notification bell and an account name at its 8rem cap — measures 1372px, so it overflowed
          its own row by 112px even at 1536px, and off-screen at 1280. Raising the breakpoint alone could not fix that.
          So from 1440px the row may reach 1440px (1400px of content, 28px clear of the 1372px worst case), and below it the
          menu button takes over. 1440 is the first step that clears 1372 + the row's 40px of side padding.
          The same 1440 appears on the nav and the menu button below, and in components/site/MobileMenu.tsx — all five together,
          or the bar and the button can both be hidden at once. tests/editions-nav.test.mjs holds them to it. */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5 min-[1440px]:max-w-[90rem]">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          {/* The ring mark, or its festive version between mid-November and 5 January. The date is decided
              on the server in the root layout and arrives as a prop: see lib/festive.ts. */}
          <Image src={brandMark(festive)} alt="OneShetland" width={40} height={40} priority unoptimized className="h-10 w-10" />
          <span className="font-display text-xl font-semibold tracking-tight text-navy">
            OneShetland
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 min-[1440px]:flex">
          {nav.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className="whitespace-nowrap rounded-pill px-3 py-2 text-[0.9rem] font-medium text-ink-soft transition-colors hover:bg-sand hover:text-ink"
            >
              {s.label}
            </Link>
          ))}
          {MORE_NAV.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMore((m) => !m)}
                aria-expanded={more}
                className="flex items-center gap-1 whitespace-nowrap rounded-pill px-3 py-2 text-[0.9rem] font-medium text-ink-soft transition-colors hover:bg-sand hover:text-ink"
              >
                More
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={"transition-transform " + (more ? "rotate-180" : "")}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {more && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMore(false)} />
                  <div className="absolute left-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lift">
                    {MORE_NAV.map((s) => (
                      <Link
                        key={s.key}
                        href={s.href}
                        onClick={() => setMore(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink hover:bg-sand"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </Link>
                    ))}
                    <HouseSwapsMoreLink onNavigate={() => setMore(false)} />
                  </div>
                </>
              )}
            </div>
          )}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Sits outside the signed-in cluster below (which is hidden on small
              screens) so the way back to the basket survives at every width. */}
          <button type="button" aria-label="Search" aria-expanded={search} onClick={() => { setOpenAt(null); setSearch((v) => !v); }}
            className="grid h-11 w-11 place-items-center rounded-pill text-ink-soft transition-colors hover:bg-sand hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy">
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </button>
          <BasketPill />
          {/* Deliberately still xl (1280px), not 1440: between 1280 and 1440 the inline nav folds into the menu button, and
              with 669px of nav gone there is ample room, so there is no reason to take this away from anyone who had it. */}
          <Link
            href="/business"
            className="hidden whitespace-nowrap rounded-pill px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-sand hover:text-ink xl:inline-flex"
          >
            For businesses
          </Link>
          {fetchStatus && (
            <FetchStatusIndicator userId={fetchStatus.userId} initialStatus={fetchStatus.status} initialCount={fetchStatus.count} />
          )}
          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
            <NotificationBell />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                aria-expanded={menu}
                className="flex items-center gap-2 rounded-pill border border-line-strong py-1.5 pl-1.5 pr-3 text-sm font-semibold text-ink transition-colors hover:bg-sand"
              >
                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-navy text-xs font-bold text-paper">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="max-w-[8rem] truncate">{user.name}</span>
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lift">
                    <Link href="/account" onClick={() => setMenu(false)} className="block px-4 py-2.5 text-sm font-medium text-ink hover:bg-sand">
                      My account
                    </Link>
                    {savedOn && (
                      <Link href="/account/saved" onClick={() => setMenu(false)} className="block px-4 py-2.5 text-sm font-medium text-ink hover:bg-sand">
                        {SAVED_MENU_LABEL}
                      </Link>
                    )}
                    <form action="/auth/sign-out" method="post">
                      <button type="submit" className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-sand">
                        Sign out
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
            </div>
          ) : (
            <Link
              href={`/sign-in?next=${encodeURIComponent(pathname)}`}
              className="hidden rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sand sm:inline-flex"
            >
              Join / Sign in
            </Link>
          )}
          <button
            ref={toggleRef}
            type="button"
            aria-label={open ? "Close menu" : "Menu"}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => { setSearch(false); setOpen((o) => !o); }}
            className="grid h-11 w-11 place-items-center rounded-pill border border-line-strong text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy min-[1440px]:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              {open ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu: a scrolling, grouped sheet (components/site/MobileMenu.tsx) */}
      {open && <MobileMenu onClose={closeMenu} user={user} signInHref={`/sign-in?next=${encodeURIComponent(pathname)}`} headerRef={headerRef} toggleRef={toggleRef} addEvent={addEvent} editionsEnabled={editionsEnabled} />}
      {search && (
        <div className="border-t border-line/70 bg-cream" onKeyDown={(e) => { if (e.key === "Escape") setSearch(false); }}>
          <div className="mx-auto max-w-3xl px-5 py-3"><SiteSearch autoFocus onNavigate={() => setSearch(false)} /></div>
        </div>
      )}
    </header>
  );
}
