"use client";

import Link from "next/link";
import { useState } from "react";
import { PRIMARY_NAV } from "@/lib/sections";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy text-paper shadow-soft">
            <span className="font-display text-lg font-black leading-none">O</span>
          </span>
          <span className="font-display text-xl font-black tracking-tight text-navy">
            OneShetland
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className="rounded-pill px-3.5 py-2 text-[0.95rem] font-medium text-ink-soft transition-colors hover:bg-sand hover:text-ink"
            >
              {s.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sand sm:inline-flex"
          >
            Sign in
          </Link>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-pill border border-line-strong text-navy md:hidden"
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

      {/* Mobile menu */}
      {open && (
        <nav className="border-t border-line/70 bg-cream px-5 py-3 md:hidden">
          <div className="flex flex-col">
            {PRIMARY_NAV.map((s) => (
              <Link
                key={s.key}
                href={s.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-2 py-3 text-base font-medium text-ink hover:bg-sand"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-pill bg-navy px-4 py-3 text-center text-base font-semibold text-paper"
            >
              Sign in
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
