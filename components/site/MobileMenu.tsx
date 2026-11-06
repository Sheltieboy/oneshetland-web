"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { PRIMARY_NAV, MORE_NAV } from "@/lib/sections";
import { mobileNavGroups } from "@/lib/nav-groups";

type HeaderUser = { name: string; avatarUrl: string | null } | null;

const GROUPS = mobileNavGroups(PRIMARY_NAV, MORE_NAV);
const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/**
 * The phone/tablet menu: a full-height sheet under the header that scrolls inside itself, grouped into two-column tiles.
 *
 * It is fixed below the header and sized to the visible viewport (dvh, safe-area padding), so the last item is always reachable, and the page behind
 * it is locked while it is open. Escape closes it, focus moves in and returns to the menu button on close, and Tab stays within the menu and its
 * button. No animation. Every destination the old menu had is here (the groups are built from lib/sections.ts), plus the same account links.
 */
export function MobileMenu({ onClose, user, signInHref, headerRef, toggleRef }: {
  onClose: () => void; user: HeaderUser; signInHref: string; headerRef: RefObject<HTMLElement | null>; toggleRef: RefObject<HTMLButtonElement | null>;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  // Sit exactly under the header, wherever it is (a banner above it, a scrolled page, a rotated phone).
  useLayoutEffect(() => {
    const place = () => setTop(Math.max(0, Math.round(headerRef.current?.getBoundingClientRect().bottom ?? 64)));
    place();
    window.addEventListener("resize", place); window.visualViewport?.addEventListener("resize", place);
    return () => { window.removeEventListener("resize", place); window.visualViewport?.removeEventListener("resize", place); };
  }, [headerRef]);

  // Lock the page behind the menu; restore exactly what was there.
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const prev = { h: html.style.overflow, b: body.style.overflow, hb: html.style.overscrollBehavior };
    html.style.overflow = "hidden"; body.style.overflow = "hidden"; html.style.overscrollBehavior = "none";
    return () => { html.style.overflow = prev.h; body.style.overflow = prev.b; html.style.overscrollBehavior = prev.hb; };
  }, []);

  // Close at desktop width, where this menu is not used.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const on = () => { if (mq.matches) onClose(); };
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, [onClose]);

  // Keyboard: Escape closes; Tab cycles within the menu and its button; focus goes in on open and back to the button on close.
  useEffect(() => {
    const toggle = toggleRef.current;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE), ...(toggle ? [toggle] : [])];
      if (!els.length) return;
      const i = els.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
      else if (!e.shiftKey && (i === els.length - 1 || i === -1)) { e.preventDefault(); els[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); toggle?.focus({ preventScroll: true }); };
  }, [onClose, toggleRef]);

  const tile = "flex min-h-[48px] items-center gap-2.5 rounded-xl border border-line bg-paper px-3 py-2.5 text-[15px] font-semibold leading-tight text-ink shadow-soft transition-colors hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy active:bg-sand motion-reduce:transition-none";
  const pill = "flex min-h-[48px] items-center justify-center rounded-pill px-4 py-3 text-center text-[15px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

  // z-[105]: above the cookie banner (z-100) and app prompt so neither can cover the last menu items.
  // Rendered into <body>, not inside the header: the header's backdrop blur would make a fixed child position itself against the header instead of the screen.
  return createPortal((
    <div
      ref={panel}
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      className="fixed inset-x-0 z-[105] overflow-y-auto overscroll-contain border-t border-line/70 bg-cream xl:hidden"
      style={{ top: top ?? 64, height: `calc(100dvh - ${top ?? 64}px)`, WebkitOverflowScrolling: "touch" }}
    >
      <nav aria-label="Main" className="mx-auto w-full max-w-2xl px-4 pt-4" style={{ paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))" }}>
        {/* Account and business first: the most important actions are never at the bottom. */}
        {user ? (
          <section aria-label="Your account" className="rounded-2xl border border-line bg-paper p-3 shadow-soft">
            <Link href="/account" onClick={onClose} className="flex min-h-[48px] items-center gap-3 rounded-xl px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-navy text-sm font-bold text-paper">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0"><span className="block truncate font-semibold text-ink">{user.name}</span><span className="block text-xs text-ink-soft">My account</span></span>
            </Link>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link href="/notifications" onClick={onClose} className={pill + " border border-line-strong text-ink hover:bg-sand"}>Notifications</Link>
              <Link href="/business" onClick={onClose} className={pill + " border border-line-strong text-ink hover:bg-sand"}>For businesses</Link>
            </div>
          </section>
        ) : (
          <section aria-label="Sign in" className="grid grid-cols-2 gap-2">
            <Link href={signInHref} onClick={onClose} className={pill + " bg-navy text-paper"}>Join / Sign in</Link>
            <Link href="/business" onClick={onClose} className={pill + " border border-line-strong bg-paper text-ink hover:bg-sand"}>For businesses</Link>
          </section>
        )}

        {GROUPS.map((g, gi) => (
          <section key={g.title ?? "featured"} aria-labelledby={g.title ? `menu-g-${gi}` : undefined} aria-label={g.title ? undefined : "Popular"} className="mt-5">
            {g.title && <h2 id={`menu-g-${gi}`} className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-ink-muted">{g.title}</h2>}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {g.items.map((s) => (
                <li key={s.key}>
                  <Link
                    href={s.href}
                    onClick={onClose}
                    className={tile + (g.featured ? " min-h-[60px] text-base" : "")}
                  >
                    {g.featured
                      ? <span aria-hidden className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      : <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />}
                    <span className="min-w-0">{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {user && (
          <form action="/auth/sign-out" method="post" className="mt-6">
            <button type="submit" className={pill + " w-full bg-navy text-paper"}>Sign out</button>
          </form>
        )}
      </nav>
    </div>
  ), document.body);
}
