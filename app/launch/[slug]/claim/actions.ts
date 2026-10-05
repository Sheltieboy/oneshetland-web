"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { openPrivatePreview } from "@/lib/launch-preview/invite.server";
import { inviteCookieName, isSlug, isToken, type ClaimState } from "@/lib/launch-preview/invite";

export type ClaimResult = { ok: true; state: ClaimState } | { ok: false; error: string };

const clean = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Submit the claim. The invitation token is read from its HttpOnly cookie HERE, on the server, and handed to the
 * database function, which checks it, binds it to this account and creates the ordinary pending claim. The browser
 * never sends or sees the token. This does not make anyone an owner and does not publish or create anything.
 */
export async function submitLaunchClaim(slug: string, _prev: ClaimResult | null, form: FormData): Promise<ClaimResult> {
  if (!isSlug(slug)) return { ok: false, error: "This invitation is no longer valid." };
  const token = (await cookies()).get(inviteCookieName(slug))?.value;
  if (!isToken(token)) return { ok: false, error: "This invitation is no longer valid. Please open the link you were sent again." };
  // The preview (from the campaign Admin manages, or the code fallback) must exist for THIS invitation, and its claim
  // button must be open. The page already refuses when claiming is closed; the action refuses too, so a closed
  // preview cannot be claimed by sending the request directly.
  const open = await openPrivatePreview(slug);
  if (!open || open.review || open.cfg.claim === "holding") return { ok: false, error: "This invitation is no longer valid." };
  if (form.get("confirm") !== "on") return { ok: false, error: "Please confirm that you own or are authorised to manage this business." };

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in to continue." };

  const { data, error } = await sb.rpc("submit_launch_partner_claim", {
    p_slug: slug, p_token: token,
    p_contact_name: clean(form.get("name"), 200), p_contact_email: clean(form.get("email"), 254),
    p_contact_phone: clean(form.get("phone"), 50) || null, p_role: clean(form.get("role"), 100) || null,
    p_evidence: clean(form.get("evidence"), 2000) || null,
  });
  if (error) {
    // The database's own messages are written for people; anything unexpected gets a plain fallback.
    const known = /name and a contact email|check the details|waiting for review|no longer valid|Sign in/i.test(error.message);
    return { ok: false, error: known ? error.message : "We couldn't send your claim just now. Please try again." };
  }
  const state = (data as { state?: ClaimState } | null)?.state;
  return state ? { ok: true, state } : { ok: false, error: "We couldn't send your claim just now. Please try again." };
}
