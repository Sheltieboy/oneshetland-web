"use client";

import { usePathname } from "next/navigation";

/**
 * Site chrome (header, footer, cookie banner, analytics) is not rendered on private routes and on the app's sign-in security check. A private Launch Partner
 * Preview must show no public navigation, and its address carries the invitation token, which analytics must never
 * see. Everything else renders exactly as before.
 */
export const PRIVATE_PREFIXES = [
  "/launch/",
  // The hosted security check opened by the iOS/Android app's sign-in (expo-web-browser auth session). It must be a minimal,
  // privacy-safe page: only the Cloudflare Turnstile check and the redirect back to the app. No header, footer, app-install
  // prompt, cookie banner or analytics here, so no optional cookie or request is made on it and no consent question is asked
  // inside an app sign-in. Ordinary website pages are unchanged and keep the cookie choice.
  "/mobile-turnstile-challenge",
];

export function HideOnPrivateRoutes({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return <>{children}</>;
}
