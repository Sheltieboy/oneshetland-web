/**
 * What the campaign page needs to show Launch partner access for ITS business — read with the same two admin-only database functions
 * the Business claims → Launch partner access screen already uses. It reads; it never grants. Granting stays in one place
 * (components/admin/LaunchPartnerAccess.tsx → admin_grant_launch_plan), so there is one set of rules, one confirmation and one audit trail.
 */
import { createClient } from "@/lib/supabase/server";
import type { LaunchLookupRow } from "@/lib/launch-grant";
import type { GrantListRow } from "@/components/admin/LaunchPartnerAccess";

export interface GrantContext {
  /** The business as the generic screen would look it up by id (plan, grant, claimed…). Null if it could not be read. */
  lookup: LaunchLookupRow | null;
  /** This business's most recent grant record (any status), or null if it never had one. */
  last: { status: GrantListRow["status"]; expires_at: string } | null;
}

export async function grantContext(businessId: string): Promise<GrantContext> {
  try {
    const sb = await createClient();
    const [lookup, all] = await Promise.all([
      sb.rpc("admin_launch_business_lookup", { p_query: businessId }),
      sb.rpc("admin_list_launch_plans"),
    ]);
    const row = ((lookup.data ?? []) as LaunchLookupRow[]).find((r) => r.business_id === businessId) ?? null;
    const mine = ((all.data ?? []) as GrantListRow[]).filter((g) => g.business_id === businessId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { lookup: row, last: mine[0] ? { status: mine[0].status, expires_at: mine[0].expires_at } : null };
  } catch {
    return { lookup: null, last: null };
  }
}
