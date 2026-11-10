"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { adminError, autoNote, isUuid } from "@/app/admin/editions/helpers";

/**
 * Two separate switches on a Hub. Each starts with requireAdmin() and calls exactly one database function, which checks again and writes the audit row.
 * Nothing here uses a service key. The note is written for the administrator (who, what, where); anything they add is appended.
 */
export type Result = { ok: true } | { ok: false; error: string };
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const adminName = (a: { profile: { full_name: string | null; display_name?: string | null } | null }) => a.profile?.full_name?.trim() || a.profile?.display_name?.trim() || "";
const fail = (e: unknown): Result => ({ ok: false, error: adminError(e instanceof Error ? e.message : typeof e === "string" ? e : "") });

/** The Verified badge: a trust label on the Hub page and in lists. It changes nothing else. */
export async function setHubVerifiedAction(input: { hubId: string; verified: boolean; note?: string }): Promise<Result> {
  const admin = await requireAdmin();
  if (!isUuid(input.hubId)) return { ok: false, error: "Unknown Hub." };
  try {
    const sb = await createClient();
    const { data: hub } = await sb.from("hubs").select("name").eq("id", input.hubId).maybeSingle();
    const note = autoNote(input.verified === true ? "hub_verify" : "hub_unverify", adminName(admin), str(input.note), hub?.name ?? "the Hub");
    const { error } = await sb.rpc("admin_set_hub_verified", { p_hub: input.hubId, p_verified: input.verified === true, p_note: note });
    if (error) return fail(error.message);
    revalidatePath("/admin/hubs");
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** "Events skip approval": events this Hub posts to the islands-wide calendar are approved automatically. Separate from the Verified badge. */
export async function setHubEventsAutoApproveAction(input: { hubId: string; on: boolean; note?: string }): Promise<Result> {
  const admin = await requireAdmin();
  if (!isUuid(input.hubId)) return { ok: false, error: "Unknown Hub." };
  try {
    const sb = await createClient();
    const { data: hub } = await sb.from("hubs").select("name").eq("id", input.hubId).maybeSingle();
    const note = autoNote(input.on === true ? "hub_events_on" : "hub_events_off", adminName(admin), str(input.note), hub?.name ?? "the Hub");
    const { error } = await sb.rpc("admin_set_hub_events_auto_approve", { p_hub: input.hubId, p_on: input.on === true, p_note: note });
    if (error) return fail(error.message);
    revalidatePath("/admin/hubs");
    return { ok: true };
  } catch (e) { return fail(e); }
}
