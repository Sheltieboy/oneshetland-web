"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/business-server";
import { getOwnerLaunchSetup } from "@/lib/launch-partners/owner-setup.server";
import { buildOwnerProfile, profileOf, sameProfile, type OwnerEdit, type OwnerProfile } from "@/lib/launch-partners/owner-setup";
import { parsePageDraft } from "@/lib/launch-partners/validate";
import { overlayProfile } from "@/lib/launch-partners/owner-setup";

/**
 * The owner's two launch-setup actions. Both run as the signed-in owner and go ONLY through the audited database functions
 * (launch_partner_owner_save_profile / launch_partner_owner_approve), which re-check, in the database, that this user owns THIS
 * business through an approved launch-partner claim. Neither publishes anything: a save is a private, append-only version, and an
 * approval is a record that the owner agreed to that version. Nothing here writes to the business, its products or its listing.
 */
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const refused = "Only the owner of this launch-partner business can do that.";
const clean = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

async function context(businessId: string) {
  await requireBusinessOwner(businessId, { returnPath: `/business/${businessId}/manage/launch-setup` });
  const ctx = await getOwnerLaunchSetup(businessId);
  return ctx;
}

export async function saveLaunchSetupAction(businessId: string, edit: OwnerEdit): Promise<Result<{ versionId: string }>> {
  try {
    const ctx = await context(businessId);
    if (!ctx.campaignId || !ctx.draft || !ctx.prepared) return { ok: false, error: refused };
    if (!["review", "edited"].includes(ctx.launch.state)) return { ok: false, error: ctx.launch.state === "approved" ? "You’ve already approved this setup." : "Your launch setup isn’t open for editing." };
    const built = buildOwnerProfile(ctx.prepared, edit);
    if (!built.ok) return built;
    // The page that results must pass the same validator as any page draft (https / own-path addresses, sizes).
    const whole = parsePageDraft(overlayProfile(ctx.prepared, built.profile));
    if (!whole.ok) return { ok: false, error: whole.error };
    if (ctx.latestProfile && sameProfile(ctx.latestProfile, built.profile)) return { ok: false, error: "There’s nothing new to save." };
    const sb = await createClient();
    const { data, error } = await sb.rpc("launch_partner_owner_save_profile", { p_business_id: businessId, p_profile: built.profile, p_note: null });
    if (error) return { ok: false, error: error.message.includes("Only the approved owner") ? refused : "Your changes couldn’t be saved just now. Nothing was lost — try again." };
    revalidatePath(`/business/${businessId}/manage`);
    return { ok: true, versionId: data as string };
  } catch (e) { return { ok: false, error: clean(e) }; }
}

/**
 * Approve the setup AS THE OWNER SEES IT. The approved snapshot is exactly what is on their screen: the prepared page with their own
 * saved edits. If that is not already a saved version (they never edited anything), it is saved first, then approved — so the approval
 * always points at a real, readable version.
 */
export async function approveLaunchSetupAction(businessId: string): Promise<Result<{ approvedAt: string }>> {
  try {
    const ctx = await context(businessId);
    if (!ctx.campaignId || !ctx.draft) return { ok: false, error: refused };
    if (ctx.launch.state === "approved") return { ok: false, error: "You’ve already approved this setup." };
    if (!["review", "edited"].includes(ctx.launch.state)) return { ok: false, error: "Your launch setup isn’t open for approval." };
    const sb = await createClient();
    const shown: OwnerProfile = profileOf(ctx.draft);
    let versionId = ctx.versions.find((v) => v.kind === "owner_edit")?.id ?? null;
    if (!versionId || !ctx.latestProfile || !sameProfile(ctx.latestProfile, shown)) {
      const { data, error } = await sb.rpc("launch_partner_owner_save_profile", { p_business_id: businessId, p_profile: shown, p_note: "Saved as shown, to be approved" });
      if (error) return { ok: false, error: error.message.includes("Only the approved owner") ? refused : "Your setup couldn’t be approved just now. Nothing was changed — try again." };
      versionId = data as string;
    }
    const { data: a, error: e2 } = await sb.rpc("launch_partner_owner_approve", { p_business_id: businessId, p_version_id: versionId });
    if (e2) return { ok: false, error: e2.message.includes("Only the approved owner") ? refused : "Your setup couldn’t be approved just now. Nothing was changed — try again." };
    revalidatePath(`/business/${businessId}/manage`); revalidatePath(`/business/${businessId}/manage/launch-setup`);
    return { ok: true, approvedAt: (a as { approved_at: string }).approved_at };
  } catch (e) { return { ok: false, error: clean(e) }; }
}
