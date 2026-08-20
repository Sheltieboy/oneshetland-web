/**
 * checkout-attempt.ts — one id per logical ticket checkout.
 *
 * WHY THIS EXISTS
 * Retrying a ticket checkout used to create a second order and a second
 * capacity reservation: nothing tied two requests together as the same attempt.
 * The server now keys on (buyer_id, client_request_id), so a retry resolves to
 * the order the first call created and reserves nothing.
 *
 * WHERE IT MUST BE CALLED FROM
 * The checkout COMPONENT, once, when the buyer starts a purchase — and NOT from
 * inside the API function. Minting a fresh id per HTTP attempt would give every
 * retry a new key and silently remove the whole protection, which is exactly
 * the failure this is meant to prevent.
 *
 * ⚠️ Mirrored in oneshetland-delivers/lib/checkout-attempt.ts — there is no
 * shared package, so change both together. The app's copy carries a longer note
 * about its random source: React Native there has no crypto polyfill, whereas
 * every browser this site supports provides crypto.randomUUID natively.
 */

/**
 * A new checkout attempt id. Call once per purchase the buyer starts — never
 * once per network request.
 */
export function newCheckoutAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Every browser with Web Crypto has randomUUID; this is only reached on a
  // very old one, and getRandomValues is still a proper CSPRNG.
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error("This browser cannot start a secure checkout. Please update it and try again.");
}
