"use server";

/**
 * A Business owner starts Editions for their Business. Runs as the signed-in person: the database checks that they own the (claimed, active) Business.
 * Nothing is typed in and nothing is copied from the Business: the web address is generated. No service key.
 */
import { revalidatePath } from "next/cache";
import { ensureEditionsFor, type StartResult } from "@/lib/editions/ensure-organiser.server";

export async function startBusinessEditions(businessId: string): Promise<StartResult> {
  const r = await ensureEditionsFor("business", businessId);
  if (r.ok) { revalidatePath("/organise"); revalidatePath("/business", "layout"); }
  return r;
}
