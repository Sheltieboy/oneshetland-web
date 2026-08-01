import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";

/** Admin-only reads for the Social studio (/admin/social). SERVER-ONLY. */

export interface SocialPost {
  id: string;
  kind: string;
  entity_type: string | null;
  entity_id: string | null;
  business_id: string | null;
  caption: string;
  image_url: string | null;
  link_url: string | null;
  channels: string[];
  status: "draft" | "approved" | "scheduled" | "posted" | "failed" | "skipped";
  scheduled_for: string | null;
  posted_at: string | null;
  posted_ids: Record<string, string>;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialRecipe {
  key: string;
  label: string;
  enabled: boolean;
  autopilot: boolean;
  config: Record<string, unknown>;
  last_run_at: string | null;
}

export async function listSocialPosts(): Promise<SocialPost[]> {
  await requireAdmin();
  const sb = await createClient();
  const { data } = await sb
    .from("social_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []) as SocialPost[];
}

export async function listSocialRecipes(): Promise<SocialRecipe[]> {
  await requireAdmin();
  const sb = await createClient();
  const { data } = await sb.from("social_recipes").select("*").order("key");
  return (data ?? []) as SocialRecipe[];
}
