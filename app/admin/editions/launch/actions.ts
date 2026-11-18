"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { adminError } from "../helpers";
import { validateSwitch } from "./switches";

export type Result = { ok: true } | { ok: false; error: string };

/**
 * Set one of the two launch switches. requireAdmin() first, then as the signed-in administrator: admin_set_editions_switch checks again, accepts
 * only these two keys and only true/false, and records every change in the Editions audit log. No service key.
 *
 * Turning public visibility on is the single most consequential action in Editions, so the screen asks for confirmation first and this never
 * takes a key or a value it has not been given explicitly.
 */
export async function setLaunchSwitch(key: string, on: boolean): Promise<Result> {
  await requireAdmin();
  const v = validateSwitch(key, on);
  if (!v.ok) return v;
  const sb = await createClient();
  const { error } = await sb.rpc("admin_set_editions_switch", { p_key: v.key, p_value: v.value });
  if (error) return { ok: false, error: adminError(error.message) };
  // The header reads the public switch on every request, and the Editions list and the public pages all depend on it.
  revalidatePath("/", "layout");
  revalidatePath("/admin/editions/launch");
  return { ok: true };
}
