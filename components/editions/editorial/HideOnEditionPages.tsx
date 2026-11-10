"use client";

import { usePathname } from "next/navigation";

/**
 * An Edition (and an organiser's own pages) end in ONE footer: the Edition's own, which carries the organiser's identity, links to the Edition's secondary pages, a
 * tasteful "Powered by OneShetland" and OneShetland's legal links. So the full OneShetland site footer is not drawn beneath it. Everywhere else, including the Editions
 * index, the site footer is exactly as before.
 */
export const EDITION_OWN_FOOTER = /^\/(editions\/[^/]+|organisers\/[^/]+)(\/|$)/;

export function HideOnEditionPages({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (EDITION_OWN_FOOTER.test(pathname)) return null;
  return <>{children}</>;
}
