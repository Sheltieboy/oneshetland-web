"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { HOUSE_SWAPS_NAV } from "@/lib/house-swaps";

/**
 * Whether House Swaps is switched on, carried to the navigation by context so the header, menu and footer signatures stay as they were.
 * Off (the default, and any failure) renders nothing at all.
 */
const Ctx = createContext(false);
export function HouseSwapsNavProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <Ctx.Provider value={enabled}>{children}</Ctx.Provider>;
}
export const useHouseSwapsNav = () => useContext(Ctx);

/** The desktop "More" dropdown row. */
export function HouseSwapsMoreLink({ onNavigate }: { onNavigate: () => void }) {
  if (!useHouseSwapsNav()) return null;
  return (
    <Link href={HOUSE_SWAPS_NAV.href} onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink hover:bg-sand">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: HOUSE_SWAPS_NAV.color }} />{HOUSE_SWAPS_NAV.label}
    </Link>
  );
}

/** A tile under the grouped sections in the mobile menu. */
export function HouseSwapsMenuTile({ onClose, className }: { onClose: () => void; className: string }) {
  if (!useHouseSwapsNav()) return null;
  return (
    <section aria-label="House Swaps" className="mt-2">
      <Link href={HOUSE_SWAPS_NAV.href} onClick={onClose} className={className}>
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: HOUSE_SWAPS_NAV.color }} /><span className="min-w-0">{HOUSE_SWAPS_NAV.label}</span>
      </Link>
    </section>
  );
}

export function HouseSwapsFooterLink() {
  if (!useHouseSwapsNav()) return null;
  return <Link href={HOUSE_SWAPS_NAV.href} className="hover:text-paper">House Swaps</Link>;
}
