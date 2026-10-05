"use client";

import { usePathname } from "next/navigation";

/**
 * Site chrome (header, footer, cookie banner, analytics) is not rendered on private routes. A private Launch Partner
 * Preview must show no public navigation, and its address carries the invitation token, which analytics must never
 * see. Everything else renders exactly as before.
 */
export const PRIVATE_PREFIXES = ["/launch/"];

export function HideOnPrivateRoutes({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return <>{children}</>;
}
