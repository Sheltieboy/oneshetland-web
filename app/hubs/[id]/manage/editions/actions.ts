"use server";

/**
 * A Hub's administrators set up Editions for their Hub. Runs as the signed-in person: the database checks that they are the Hub's owner or an ACTIVE committee member (live),
 * that the Hub has no organiser yet, and (while Editions is not open to everyone) that they are a platform administrator. No service key, and nothing is copied from the Hub.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/editions/rules";
import { isUuid } from "@/lib/editions/validate";
import { isValidOrganiserSlug } from "@/lib/editions/hub-brand";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function createHubEditionsOrganiser(hubId: string, slug: string): Promise<Result<{ slug: string }>> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again to continue." };
  const s = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (!isUuid(hubId)) return { ok: false, error: "That Hub could not be found." };
  if (!isValidOrganiserSlug(s)) return { ok: false, error: "Choose a web address of 3 to 60 letters, numbers and hyphens." };
  const { error } = await sb.rpc("create_edition_organiser_for_hub", { p_hub: hubId, p_slug: s, p_name: null });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/organise");
  revalidatePath("/hubs", "layout");
  return { ok: true, slug: s };
}
