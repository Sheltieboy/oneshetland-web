import "server-only";

/**
 * How Editions takes a payment. Two modes, decided on the SERVER only:
 *   'stripe'    the real path: the create-edition-checkout edge function (not deployed today) returns a client secret and Stripe.js confirms the card.
 *   'simulated' LOCAL TESTING ONLY: calls the local database simulator, which exists solely in the throwaway editions-local stack.
 * Simulation requires EDITIONS_PAYMENTS_MODE=simulated AND a loopback Supabase URL; anywhere else it silently falls back to 'stripe', which cannot
 * take money until the database commerce switch is on and the functions are deployed. There is no way to enable simulated payments in production.
 */
export const isLoopbackSupabase = (): boolean => {
  try { const h = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname; return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]"; } catch { return false; }
};
export type PaymentsMode = "stripe" | "simulated";
export const paymentsMode = (): PaymentsMode => (process.env.EDITIONS_PAYMENTS_MODE === "simulated" && isLoopbackSupabase() ? "simulated" : "stripe");
