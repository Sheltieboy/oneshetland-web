"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient as createServerClient } from "@/lib/supabase/server";

const STATUSES = ["done", "dismissed", "snoozed", "reopen"] as const;
type Status = (typeof STATUSES)[number];

/** Mark a Useful Action done, dismissed or snoozed (or reopen it). Admin only: the page guard, then the RPC's own is_admin() check. */
export async function setActionState(key: string, status: Status, snoozeDays = 7): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (typeof key !== "string" || !/^[a-z0-9_]{1,60}$/.test(key) || !STATUSES.includes(status)) return { ok: false };
  const days = Math.max(1, Math.min(90, Math.trunc(Number(snoozeDays)) || 7));
  const sb = await createServerClient();
  const { error } = await sb.rpc("admin_action_set_state", { p_key: key, p_status: status, p_snooze_days: days });
  if (error) { console.error("[admin-intel] set state failed:", error.message); return { ok: false }; }
  revalidatePath("/admin");
  revalidatePath("/admin/intelligence");
  return { ok: true };
}
