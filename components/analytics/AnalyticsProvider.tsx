"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * AnalyticsProvider — fires `screen_viewed` on mount and on every route change.
 *
 * Mounted once in the root layout. Renders nothing. Analytics is consent-gated
 * (opt-in) in lib/analytics.ts, so this stays dormant until consent is granted.
 */
export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    track("screen_viewed", { props: { route: pathname } });
  }, [pathname]);

  return null;
}
