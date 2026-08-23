/**
 * public-read.ts — a failed public read is not an empty page.
 *
 * Twice now a signed-out outage has reached production looking like ordinary
 * emptiness. Step 8's column whitelist made anonymous reads of events, then
 * products, fail with
 *
 *     42501: permission denied for table local_businesses
 *
 * and every one of those call sites did `const { data } = await sb…` or
 * `.then(r => r.data ?? [])`, dropping `error` on the floor. What's On said
 * "no events". The shop said "no products". Nothing was logged, so nothing
 * looked wrong until somebody opened the site signed out and noticed.
 *
 * These helpers keep the safe fallback — a public page should degrade, not
 * crash — while making the failure loud in the server log. Deliberately scoped
 * to the public browsing surfaces repaired alongside this file; this is not a
 * site-wide error-handling change.
 */

type Postgrestish = { code?: string | null; message?: string | null } | null;

/** Permission/relation errors — the shape a signed-out RLS regression takes. */
const PERMISSION_CODES = new Set(["42501", "42P01", "42703"]);

/**
 * Log a public read that failed. `surface` should name the user-facing thing
 * that just silently emptied, not the function — "offers on /loyalty" beats
 * "getActiveOffers", because the log is read by whoever is staring at a blank
 * page.
 */
export function reportPublicReadFailure(surface: string, error: Postgrestish): void {
  if (!error) return;
  const code = error.code ?? "?";
  const tag = PERMISSION_CODES.has(code) ? "PERMISSION" : "FAILED";
  console.error(
    `[public-read] ${tag} — ${surface} — ${code}: ${error.message ?? "no message"}`,
  );
}

/**
 * Unwrap a PostgREST result for a public surface: log any error, then fall
 * back. The caller still gets a value it can render.
 */
export function unwrapPublic<T>(
  surface: string,
  result: { data: T | null; error?: Postgrestish },
  fallback: T,
): T {
  reportPublicReadFailure(surface, result.error ?? null);
  return result.data ?? fallback;
}
