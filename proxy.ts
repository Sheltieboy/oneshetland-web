import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { inviteHandoff } from "./lib/launch-preview/invite.ts";
import { isFetchPath, fetchEnabledFor, FETCH_UNAVAILABLE_PATH } from "./lib/fetch-availability.ts";

/**
 * Next 16 "proxy" (formerly middleware): keeps the Supabase auth session fresh
 * on every request so Server Components see the logged-in user.
 */
export async function proxy(request: NextRequest) {
  // Private Launch Partner Preview: /launch/{slug}?invite=<token>. Move the token out of the address into an HttpOnly
  // cookie scoped to that one preview, and redirect to the clean address — so it never reaches the address bar,
  // history, a Referer, analytics or a sign-in `next=` parameter. Validity is decided later, by the database.
  const handoff = inviteHandoff(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (handoff) {
    const clean = request.nextUrl.clone();
    clean.pathname = handoff.location;
    clean.search = "";
    const res = NextResponse.redirect(clean, { status: 303 });
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    if (handoff.cookie) {
      const { name, value, ...opts } = handoff.cookie;
      res.cookies.set(name, value, { ...opts, secure: process.env.NODE_ENV === "production" });
    }
    return res;
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the user to trigger a token refresh if needed.
  await supabase.auth.getUser();

  // Fetch is paused while Fetch v2 is built. Every /fetch route is answered by the coming-soon page unless the DATABASE's Fetch v2
  // flag admits this visitor (fetch_v2_enabled: off / admins / testers / everyone). Fails closed — an error, or a database without
  // the flag yet, means the coming-soon page. The real pages never render, so none of their loaders run.
  if (isFetchPath(request.nextUrl.pathname) && !(await fetchEnabledFor(supabase))) {
    const gated = NextResponse.rewrite(new URL(FETCH_UNAVAILABLE_PATH, request.url));
    response.cookies.getAll().forEach((c) => gated.cookies.set(c));
    gated.headers.set("Cache-Control", "private, no-store");
    gated.headers.set("X-Robots-Tag", "noindex");
    return gated;
  }

  return response;
}

export const config = {
  // Run on everything except static assets / images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
