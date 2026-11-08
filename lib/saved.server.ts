import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Is My Saved switched on for the person making this request? Reads saved_enabled() once per request (the layout and the My Saved page share
 * the answer). Fails CLOSED: any error, or an answer that is not exactly `true`, means off, so nothing about My Saved can appear by accident.
 * The database decides (the `saved.enabled` setting; staff always see it).
 */
export const getSavedEnabled = cache(async (): Promise<boolean> => {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("saved_enabled");
    return !error && data === true;
  } catch {
    return false;
  }
});
