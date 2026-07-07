/** boats-data.server.ts — auth-scoped Da Boats reads. SERVER-ONLY. */

import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * The user ids the signed-in viewer has blocked. Mirrors the app's
 * lib/moderation.ts → fetchBlockedIds: read blocked_users for the current
 * user so their blocked authors' comments can be filtered out server-side
 * (the app filters client-side via fetchBlockedIds). Empty set when logged out.
 */
export async function getBlockedUserIds(): Promise<Set<string>> {
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Set();
    const { data } = await sb.from("blocked_users").select("blocked_id").eq("blocker_id", user.id);
    return new Set((data ?? []).map((r: { blocked_id: string }) => r.blocked_id));
  } catch { return new Set(); }
}

/** The signed-in viewer's votes on a set of edit proposals: id → 'confirm'|'dispute'. */
export async function getMyEditVotes(proposalIds: string[]): Promise<Record<string, "confirm" | "dispute">> {
  if (!proposalIds.length) return {};
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return {};
    const { data } = await sb.from("vessel_edit_votes").select("proposal_id, vote").eq("user_id", user.id).in("proposal_id", proposalIds);
    return Object.fromEntries((data ?? []).map((v: { proposal_id: string; vote: "confirm" | "dispute" }) => [v.proposal_id, v.vote]));
  } catch { return {}; }
}
