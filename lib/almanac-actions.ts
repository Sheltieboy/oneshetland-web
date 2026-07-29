"use server";

import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ArticleInput {
  id?: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  body: string;
  hero_url?: string | null;
  pillar: string;
  status: string;
  publish_at?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  linked_entities?: unknown;
  source?: unknown;
}

export async function saveArticle(input: ArticleInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  await requireAdmin();
  const sb = await createClient();

  const row = {
    slug: input.slug.trim(),
    title: input.title.trim(),
    excerpt: input.excerpt?.trim() || null,
    body: input.body,
    hero_url: input.hero_url?.trim() || null,
    pillar: input.pillar,
    status: input.status,
    // A published/scheduled article needs a publish_at; default to now if missing.
    publish_at: input.publish_at || (input.status === "draft" ? null : new Date().toISOString()),
    seo_title: input.seo_title?.trim() || null,
    seo_description: input.seo_description?.trim() || null,
    linked_entities: input.linked_entities ?? [],
    source: input.source ?? null,
  };

  const res = input.id
    ? await sb.from("content_articles").update(row).eq("id", input.id).select("id").single()
    : await sb.from("content_articles").insert(row).select("id").single();

  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath("/admin/almanac");
  revalidatePath("/almanac");
  revalidatePath(`/almanac/${row.slug}`);
  return { ok: true, id: (res.data as { id: string }).id };
}

export async function deleteArticle(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const sb = await createClient();
  const { error } = await sb.from("content_articles").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/almanac");
  revalidatePath("/almanac");
  return { ok: true };
}
