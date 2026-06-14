import { createClient } from "@supabase/supabase-js";

/**
 * A plain anon Supabase client for PUBLIC, server-side reads (no user session).
 * RLS still applies — this only ever sees data the public is allowed to see.
 */
export function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
