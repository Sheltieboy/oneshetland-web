import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./rules";
import { isUuid } from "./validate";

export type StartResult = { ok: true; slug: string; created: boolean } | { ok: false; error: string };

/**
 * Start Editions for a Business or a Hub the signed-in person runs. The Editions profile is created automatically from the parent (its name, its web address and its team all
 * come from the Business or Hub); nobody registers, names or addresses one. Runs as the signed-in person, so the database decides whether they own the Business or run the Hub.
 * Idempotent: asking again for a parent that already has Editions simply returns it. No service key.
 */
export async function ensureEditionsFor(kind: "hub" | "business", parentId: string): Promise<StartResult> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again to continue." };
  if (kind !== "hub" && kind !== "business") return { ok: false, error: "That could not be found." };
  if (!isUuid(parentId)) return { ok: false, error: kind === "hub" ? "That Hub could not be found." : "That Business could not be found." };
  const { data, error } = await sb.rpc("edition_ensure_organiser", { p_kind: kind, p_parent: parentId });
  if (error) return { ok: false, error: friendlyError(error.message) };
  const r = data as { slug?: unknown; created?: unknown } | null;
  if (!r || typeof r.slug !== "string") return { ok: false, error: "Something went wrong. Please try again." };
  return { ok: true, slug: r.slug, created: r.created === true };
}
