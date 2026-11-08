/**
 * admin-intel.server.ts — reads for the Admin Intelligence dashboard and Useful Actions. SERVER-ONLY.
 * Calls the admin-gated SECURITY DEFINER RPCs as the signed-in admin (never the service role). A failure returns null,
 * which the page shows as "unavailable" rather than as zeros, so a broken read cannot look like "all clear".
 */
import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Overview, UsefulActionsPayload, Period } from "@/lib/admin-intel";

async function rpc<T>(fn: string, args: Record<string, unknown>, label: string): Promise<T | null> {
  try {
    const sb = await createServerClient();
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw error;
    return (data as T) ?? null;
  } catch (err) {
    console.error(`[admin-intel] ${label} failed:`, err);
    return null;
  }
}

export const getAdminIntelOverview = (days: Period | number = 30) => rpc<Overview>("admin_intel_overview", { p_days: days }, "overview");
export const getUsefulActions = () => rpc<UsefulActionsPayload>("admin_useful_actions", {}, "useful actions");
