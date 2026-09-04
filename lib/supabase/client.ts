import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components / browser code.
 *
 * One instance for the life of the tab. `createBrowserClient` does not memoise
 * — two calls return two clients, each with its own GoTrue instance over the
 * same auth storage key and its own Realtime socket. A page that built a client
 * per read ended up with several auth clients competing for one storage key,
 * which supabase-js warns produces undefined behaviour: a token refresh held by
 * one instance can make another's getSession() resolve null. The Realtime
 * socket asks for its token through that same callback when it joins, so a
 * channel could join unauthenticated, see nothing through RLS, and still report
 * SUBSCRIBED.
 *
 * Server clients are unaffected and must stay per-request: they carry one
 * request's cookies and cannot be shared.
 */
function makeBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Typed off the factory rather than off createBrowserClient itself: that helper
// is generic, and naming ReturnType<typeof createBrowserClient> instantiates it
// with the bare defaults, which strips the schema types off every .from() call
// in the app.
let browserClient: ReturnType<typeof makeBrowserClient> | null = null;

export function createClient() {
  return (browserClient ??= makeBrowserClient());
}
