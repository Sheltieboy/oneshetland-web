import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Internal REVIEW access — for the person preparing previews to look at them on their own machine.
 *
 * This is NOT an invitation. A real invitation is a row in the database (a SHA-256 of a random token, bound to one
 * business, revocable). A review token is HMAC(secret, slug), where the secret is in a local .env.local that is never
 * committed, and it only works when ALL of these hold:
 *   - the server is running in development mode (`next dev`); a production build can never accept one,
 *   - LAUNCH_PREVIEW_REVIEW_SECRET is set (at least 24 characters),
 *   - the token is for that exact slug.
 * Because it is derived from a local secret and never stored anywhere, it cannot be turned into — or confused with —
 * an invitation for a real business, and it opens nothing on the live site.
 */
const MIN_SECRET = 24;

export const reviewSecret = (env: Record<string, string | undefined> = process.env): string | null => {
  const s = env.LAUNCH_PREVIEW_REVIEW_SECRET;
  return typeof s === "string" && s.length >= MIN_SECRET ? s : null;
};

export const reviewEnabled = (env: Record<string, string | undefined> = process.env): boolean =>
  env.NODE_ENV === "development" && reviewSecret(env) !== null;

export const reviewToken = (slug: string, secret: string): string =>
  createHmac("sha256", secret).update(`launch-review:${slug}`).digest("hex");

export function isReviewToken(slug: string, token: string, env: Record<string, string | undefined> = process.env): boolean {
  const secret = reviewSecret(env);
  if (!reviewEnabled(env) || !secret) return false;
  const want = Buffer.from(reviewToken(slug, secret));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}
