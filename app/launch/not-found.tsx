import type { Metadata } from "next";
import { InviteInactive } from "@/components/launch-preview/InviteInactive";

/**
 * Every notFound() under /launch/* lands here — an expired, revoked, replaced, unknown or malformed invitation link, a slug that does not exist, a
 * preview with no valid link. ONE page, the same for all of them, with no input (nothing about the link, the preview or the business can reach it).
 * The /launch/* response headers (noindex, no-referrer, no-store — next.config.ts) apply to this response as to any other.
 */
export const metadata: Metadata = {
  title: "Invitation link",
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true, noimageindex: true },
  referrer: "no-referrer",
};

export default function LaunchNotFound() {
  return <InviteInactive variant="inactive" />;
}
