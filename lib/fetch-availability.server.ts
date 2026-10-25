import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchEnabledFor } from "@/lib/fetch-availability";

/**
 * Is Fetch available to the visitor rendering this request? Asked once per request (React cache) with the cookie-bound client, so
 * the database answers for the signed-in user (or anon). Fails closed — see lib/fetch-availability.ts.
 *
 * The /fetch routes themselves are gated earlier, in proxy.ts. This is for Fetch content that appears on OTHER pages (the header's
 * delivery chip, the For You feed), which must disappear too.
 */
export const isFetchAvailable = cache(async (): Promise<boolean> => {
  try {
    return await fetchEnabledFor(await createClient());
  } catch {
    return false;
  }
});
