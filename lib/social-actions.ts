"use server";

import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Admin write actions for the Social studio (/admin/social). */

type Result = { ok: boolean; error?: string };

async function patchPost(id: string, patch: Record<string, unknown>): Promise<Result> {
  await requireAdmin();
  const sb = await createClient();
  const { error } = await sb.from("social_posts").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/social");
  return { ok: true };
}

/** Save caption/schedule edits without changing status. */
export async function saveSocialPost(id: string, caption: string, scheduledFor: string | null): Promise<Result> {
  if (!caption.trim()) return { ok: false, error: "Caption can't be empty" };
  return patchPost(id, { caption: caption.trim(), scheduled_for: scheduledFor });
}

/** Approve — the publisher will pick it up when its schedule passes. */
export async function approveSocialPost(id: string, caption: string, scheduledFor: string | null): Promise<Result> {
  if (!caption.trim()) return { ok: false, error: "Caption can't be empty" };
  return patchPost(id, { caption: caption.trim(), scheduled_for: scheduledFor, status: "approved", error: null });
}

/** Skip — keeps the row (and its dedupe claim) but it will never post. */
export async function skipSocialPost(id: string): Promise<Result> {
  return patchPost(id, { status: "skipped" });
}

/** Pull an approved/failed/skipped post back to draft for another look. */
export async function revertSocialPost(id: string): Promise<Result> {
  return patchPost(id, { status: "draft", error: null });
}

/** Delete outright — frees the (kind, entity_id) slot so the composer may recreate it. */
export async function deleteSocialPost(id: string): Promise<Result> {
  await requireAdmin();
  const sb = await createClient();
  const { error } = await sb.from("social_posts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/social");
  return { ok: true };
}

export async function toggleSocialRecipe(key: string, enabled: boolean): Promise<Result> {
  await requireAdmin();
  const sb = await createClient();
  const { error } = await sb.from("social_recipes").update({ enabled }).eq("key", key);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/social");
  return { ok: true };
}
