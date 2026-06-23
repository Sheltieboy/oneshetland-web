/** memories-data.server.ts — auth-scoped Memories reads. SERVER-ONLY. */

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { ReactionKind } from "@/lib/memories-data";

/** The signed-in viewer's reactions on a memory. */
export async function getMyReactions(memoryId: string): Promise<ReactionKind[]> {
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];
    const { data } = await sb.from("memory_reactions").select("kind").eq("memory_id", memoryId).eq("user_id", user.id);
    return (data ?? []).map((r: { kind: ReactionKind }) => r.kind);
  } catch { return []; }
}
