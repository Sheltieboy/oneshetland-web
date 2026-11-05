"use client";

import { useEffect } from "react";
import { getAnalyticsConsent, CONSENT_EVENT } from "@/lib/analytics";
import { enableGa4, disableGa4 } from "@/lib/ga4";

/**
 * GoogleAnalytics — GA4 behind the existing analytics consent.
 *
 * Page views: GA4 Enhanced Measurement already records every Next.js
 * client-side navigation (history change) by itself, with the correct title. We
 * tested sending our own page_view on each route change as well and got two hits
 * per navigation, so we do NOT. We send exactly one: the first page_view after
 * consent is granted (a hard load, or the moment the visitor accepts), because
 * gtag is configured with send_page_view:false. Everything after that is GA's.
 *
 * Mounted once in the root layout (inside HideOnPrivateRoutes, so private launch
 * preview links are never measured). Renders nothing. One effect
 * runs only on mount; consent changes (banner, Notification preferences, other
 * tabs) are picked up live.
 */
export function GoogleAnalytics() {
  useEffect(() => {
    if (getAnalyticsConsent()) enableGa4(window.location.pathname);
    else disableGa4();

    const onChange = () => {
      if (getAnalyticsConsent()) enableGa4(window.location.pathname);
      else disableGa4();
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CONSENT_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return null;
}
