"use server";

/**
 * A Hub's owner or committee start Editions for their Hub. Runs as the signed-in person: the database checks that they are the Hub's owner or an active committee member (live).
 * Nothing is typed in and nothing is copied from the Hub: the web address is generated. No service key.
 */
import { revalidatePath } from "next/cache";
import { ensureEditionsFor, type StartResult } from "@/lib/editions/ensure-organiser.server";

export async function startHubEditions(hubId: string): Promise<StartResult> {
  const r = await ensureEditionsFor("hub", hubId);
  if (r.ok) { revalidatePath("/organise"); revalidatePath("/hubs", "layout"); }
  return r;
}
