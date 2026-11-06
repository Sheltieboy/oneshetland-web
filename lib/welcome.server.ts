import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * lib/welcome.server.ts — asks the `send-welcome` Edge Function to send the welcome email, once, right after someone confirms their email.
 *
 * Called from /auth/callback, which is where EVERY confirmation lands (website and mobile app alike) and the first moment the new
 * person has a session. The function decides everything that matters — it only ever writes to the account's own confirmed address, only
 * if it was confirmed in the last 24 hours, and only once per person — so this is deliberately dumb: it passes no recipient, template or
 * content, waits at most 2.5 s, and NEVER throws or delays sign-in on failure.
 *
 * Only an email-confirmation link starts it (type signup/email, or the PKCE `code` form). A magic-link sign-in, a password recovery or an
 * email-change confirmation never does.
 */
export const WELCOME_TYPES: readonly string[] = ["signup", "email"];
export const WELCOME_TIMEOUT_MS = 2500;

export function startsWelcome(otpType: string | null, viaCode: boolean): boolean {
  return viaCode || (otpType !== null && WELCOME_TYPES.includes(otpType));
}

export async function triggerWelcome(sb: SupabaseClient, otpType: string | null, viaCode: boolean): Promise<void> {
  if (!startsWelcome(otpType, viaCode)) return;
  try {
    await Promise.race([
      sb.functions.invoke("send-welcome", { body: {} }),
      new Promise((resolve) => setTimeout(resolve, WELCOME_TIMEOUT_MS)),
    ]);
  } catch { /* a missing welcome must never get in the way of signing in */ }
}
