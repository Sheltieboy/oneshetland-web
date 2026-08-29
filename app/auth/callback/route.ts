import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";
import { recordSignupConsent } from "@/lib/compliance.server";

export const dynamic = "force-dynamic";

/**
 * Email-confirmation / magic-link landing.
 *
 * ── Why there are two paths ───────────────────────────────────────────────
 *
 * The browser client is @supabase/ssr, which uses PKCE: `signUp()` stores a
 * code verifier in a cookie in THAT browser, and `exchangeCodeForSession`
 * needs it back. Someone who signs up on a laptop and opens the email on their
 * phone has no verifier there, so the exchange cannot succeed — measured, on a
 * real account.
 *
 * What made it a bug rather than a limitation is that Supabase has ALREADY
 * confirmed the address by then: its /verify endpoint marks the email
 * confirmed and only then redirects here. So the account was fine and the site
 * said "That confirmation link has expired", which was simply untrue.
 *
 * `token_hash` fixes it properly. `verifyOtp` verifies the token server-side
 * and returns a session with no verifier involved, so the phone gets signed in
 * — which is the point. It needs the email template to send `.TokenHash`; both
 * shapes are accepted here so the deploy can land before the template changes
 * and neither order breaks anyone.
 *
 *   ?token_hash=…&type=email  → verifyOtp  → works on ANY device
 *   ?code=…                   → PKCE       → works in the signing-up browser
 *
 * This is also the first moment a confirmed user has a session, which makes it
 * the only place the consent they gave on the sign-up form can be written to
 * the audit log — see lib/compliance.server.ts for why it can't happen at
 * sign-up time.
 */

/** Only the OTP types this route legitimately handles. */
const OTP_TYPES = ["email", "signup", "magiclink", "recovery", "invite", "email_change"] as const;
const otpType = (v: string | null): EmailOtpType | null =>
  v && (OTP_TYPES as readonly string[]).includes(v) ? (v as EmailOtpType) : null;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = otpType(searchParams.get("type"));
  const code = searchParams.get("code");

  const sb = await createClient();

  // ── 1. token_hash: verified server-side, no browser state needed ────────
  if (tokenHash && type) {
    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const { data: { user } } = await sb.auth.getUser();
      if (user) await recordSignupConsent(sb, user);
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Stripe-style honesty: Supabase told us this token is no good, so we may
    // say so. This is the ONLY branch that knows that.
    return NextResponse.redirect(`${origin}/sign-in?error=confirm_invalid&next=${encodeURIComponent(next)}`);
  }

  // ── 2. code: the PKCE exchange, which needs this browser's verifier ─────
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await sb.auth.getUser();
      if (user) await recordSignupConsent(sb, user);
      return NextResponse.redirect(`${origin}${next}`);
    }
    // We do NOT know the token is expired. The overwhelmingly likely cause is
    // that this is a different device from the one that signed up — in which
    // case the address is already confirmed and they can simply sign in.
    return NextResponse.redirect(`${origin}/sign-in?error=confirm_session&next=${encodeURIComponent(next)}`);
  }

  return NextResponse.redirect(`${origin}/sign-in?error=confirm_invalid&next=${encodeURIComponent(next)}`);
}
