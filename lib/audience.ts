/**
 * Audience — "I live here" vs "I'm visiting". Web twin of the app's
 * lib/audience.ts.
 *
 * A RANKING HINT and nothing more: it reorders the homepage and nothing else.
 * No section is hidden, nothing is gated, and no permission reads it.
 *
 * This file is deliberately client-safe — types and constants only. The
 * server-side read lives in audience.server.ts because it uses next/headers,
 * which cannot be imported into a client component (importing it here breaks
 * the whole page, not just the chip).
 */

export type Audience = "resident" | "visiting";

export const AUDIENCE_COOKIE = "os_audience";

export const AUDIENCE_LABEL: Record<Audience, string> = {
  resident: "Living here",
  visiting: "Visiting Shetland",
};

export function parseAudience(v: string | undefined | null): Audience | null {
  return v === "visiting" || v === "resident" ? v : null;
}
