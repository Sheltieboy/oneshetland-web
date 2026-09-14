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

/** "Write a post" — a hand-written post through the same queue + publisher. */
export async function createCustomPost(input: {
  caption: string;
  imageUrl?: string | null;
  scheduledFor?: string | null;
  approve?: boolean;
}): Promise<Result & { id?: string }> {
  await requireAdmin();
  if (!input.caption.trim()) return { ok: false, error: "Write something first" };
  const sb = await createClient();
  const { data, error } = await sb.from("social_posts").insert({
    kind: "custom",
    caption: input.caption.trim(),
    image_url: input.imageUrl?.trim() || null,
    link_url: null,
    scheduled_for: input.scheduledFor ?? null,
    status: input.approve ? "approved" : "draft",
  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/social");
  return { ok: true, id: (data as { id: string }).id };
}

export async function toggleSocialRecipe(key: string, enabled: boolean): Promise<Result> {
  await requireAdmin();
  const sb = await createClient();
  const { error } = await sb.from("social_recipes").update({ enabled }).eq("key", key);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/social");
  return { ok: true };
}

/**
 * Autopilot — separate from `enabled`. Enabled decides whether the composer
 * drafts this recipe at all; autopilot decides whether what it drafts needs a
 * human to approve it (draft) or is already publisher-eligible (scheduled).
 * Read by social-composer at compose time — flipping this has no effect on
 * posts already queued, only on what's composed from the next run onward.
 */
export async function toggleSocialRecipeAutopilot(key: string, autopilot: boolean): Promise<Result> {
  await requireAdmin();
  const sb = await createClient();
  const { error } = await sb.from("social_recipes").update({ autopilot }).eq("key", key);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/social");
  return { ok: true };
}

/**
 * Global publisher pause. Stops social-publisher from reaching Meta at all —
 * queued/approved/scheduled posts are left exactly as they are; the composer
 * is unaffected and keeps queueing. See supabase/functions/social-publisher.
 */
export async function toggleSocialPublishingPause(paused: boolean): Promise<Result> {
  await requireAdmin();
  const sb = await createClient();
  const { error } = await sb
    .from("admin_config")
    .update({ value: paused ? "true" : "false" })
    .eq("key", "social.publishing_paused");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/social");
  return { ok: true };
}
