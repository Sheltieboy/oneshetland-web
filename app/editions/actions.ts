"use server";

/** Visitor actions: save an Edition, add or remove a session or event from your plan. As the signed-in user; the database re-checks that the Edition is public. */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/editions/rules";
import { isUuid } from "@/lib/editions/validate";

type Result = { ok: true; on: boolean } | { ok: false; error: string };
const SIGN_IN = "Please sign in to save things.";

async function authed() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user ? sb : null;
}

export async function toggleSaveEdition(editionId: string, on: boolean): Promise<Result> {
  const sb = await authed();
  if (!sb) return { ok: false, error: SIGN_IN };
  if (!isUuid(editionId) || typeof on !== "boolean") return { ok: false, error: "That Edition could not be found." };
  const { data, error } = await sb.rpc("edition_save", { p_edition: editionId, p_on: on });
  if (error) return { ok: false, error: /most Editions allowed/.test(error.message) ? "You have saved the most Editions allowed. Remove one first." : friendlyError(error.message) };
  revalidatePath("/account/editions/plan");
  return { ok: true, on: data === true };
}

export async function togglePlanItem(editionId: string, kind: string, itemId: string, on: boolean): Promise<Result> {
  const sb = await authed();
  if (!sb) return { ok: false, error: SIGN_IN };
  if (!isUuid(editionId) || !isUuid(itemId) || (kind !== "session" && kind !== "event") || typeof on !== "boolean") return { ok: false, error: "That item could not be found." };
  const { data, error } = await sb.rpc("edition_plan_toggle", { p_edition: editionId, p_kind: kind, p_item: itemId, p_on: on });
  if (error) return { ok: false, error: /plan is full/.test(error.message) ? "Your plan is full. Remove something first." : friendlyError(error.message) };
  revalidatePath("/account/editions/plan");
  return { ok: true, on: data === true };
}
