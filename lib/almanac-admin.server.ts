import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import type { Article } from "./almanac-data";

/** Admin-only reads over every article (any status). */

export async function listAllArticles(): Promise<Article[]> {
  await requireAdmin();
  const sb = await createClient();
  const { data } = await sb.from("content_articles").select("*").order("updated_at", { ascending: false });
  return (data ?? []) as Article[];
}

export async function getArticleById(id: string): Promise<Article | null> {
  await requireAdmin();
  const sb = await createClient();
  const { data } = await sb.from("content_articles").select("*").eq("id", id).maybeSingle();
  return (data as Article) ?? null;
}
