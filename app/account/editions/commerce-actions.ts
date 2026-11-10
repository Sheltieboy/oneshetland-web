"use server";

/** Business-owner money actions (R4): apply to a membership, answer an invitation, cancel, withdraw, claim a member benefit, step back from an Edition. As the signed-in user. */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/editions/rules";
import { isUuid } from "@/lib/editions/validate";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const SIGN_IN = "Please sign in again to continue.";
const bad = (error: string) => ({ ok: false as const, error });
async function authed() { const sb = await createClient(); const { data: { user } } = await sb.auth.getUser(); return user ? sb : null; }
const refresh = () => { revalidatePath("/account/editions"); revalidatePath("/business", "layout"); revalidatePath("/editions", "layout"); revalidatePath("/organise", "layout"); };
const msg = (e: string) => (/this organiser cannot take payments|organiser_cannot_collect/.test(e) ? "This organiser cannot take payments right now. Try again later." : friendlyError(e));

export async function applyToTier(tierId: string, businessId: string, interval: string, message?: string): Promise<Result<{ id: string }>> {
  const sb = await authed(); if (!sb) return bad(SIGN_IN);
  if (!isUuid(tierId) || !isUuid(businessId)) return bad("That membership could not be found.");
  const m = (message ?? "").trim(); if (m.length > 500) return bad("The message must be 500 characters or fewer.");
  const { data, error } = await sb.rpc("edition_membership_apply", { p_tier: tierId, p_business: businessId, p_interval: interval === "annual" ? "annual" : interval === "monthly" ? "monthly" : null, p_message: m || null });
  if (error) return bad(msg(error.message));
  refresh(); return { ok: true, id: String(data) };
}
export async function respondToMembershipInvite(membershipId: string, accept: boolean, note?: string): Promise<Result> {
  const sb = await authed(); if (!sb) return bad(SIGN_IN);
  if (!isUuid(membershipId) || typeof accept !== "boolean") return bad("That invitation could not be found.");
  const { error } = await sb.rpc("edition_membership_respond", { p_membership: membershipId, p_accept: accept, p_note: (note ?? "").trim().slice(0, 300) || null });
  if (error) return bad(msg(error.message));
  refresh(); return { ok: true };
}
export async function withdrawMembershipApplication(membershipId: string): Promise<Result> {
  const sb = await authed(); if (!sb) return bad(SIGN_IN);
  if (!isUuid(membershipId)) return bad("That application could not be found.");
  const { error } = await sb.rpc("edition_membership_withdraw", { p_membership: membershipId });
  if (error) return bad(msg(error.message));
  refresh(); return { ok: true };
}
export async function cancelMembership(membershipId: string): Promise<Result<{ status: string }>> {
  const sb = await authed(); if (!sb) return bad(SIGN_IN);
  if (!isUuid(membershipId)) return bad("That membership could not be found.");
  const { data, error } = await sb.rpc("edition_membership_cancel", { p_membership: membershipId });
  if (error) return bad(msg(error.message));
  refresh(); return { ok: true, status: String(data) };
}
export async function claimMemberBenefit(linkId: string): Promise<Result> {
  const sb = await authed(); if (!sb) return bad(SIGN_IN);
  if (!isUuid(linkId)) return bad("That Edition could not be found.");
  const { error } = await sb.rpc("edition_participation_claim_benefit", { p_link: linkId });
  if (error) return bad(msg(error.message));
  refresh(); return { ok: true };
}
export async function withdrawFromEdition(linkId: string): Promise<Result<{ outcome: string }>> {
  const sb = await authed(); if (!sb) return bad(SIGN_IN);
  if (!isUuid(linkId)) return bad("That Edition could not be found.");
  const { data, error } = await sb.rpc("edition_participation_withdraw", { p_link: linkId });
  if (error) return bad(msg(error.message));
  refresh(); return { ok: true, outcome: String(data) };
}
