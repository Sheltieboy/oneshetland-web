import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";
import { recordSignupConsent } from "@/lib/compliance.server";

export const dynamic = "force-dynamic";

/** Email-confirmation / magic-link landing. Exchanges the code for a session
 *  (cookies set by the SSR client), then redirects on.
 *
 *  This is also the first moment a confirmed user has a session, which makes it
 *  the only place the consent they gave on the sign-up form can be written to
 *  the audit log — see lib/compliance.server.ts for why it can't happen at
 *  sign-up time. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user) await recordSignupConsent(sb, user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=confirm`);
}
