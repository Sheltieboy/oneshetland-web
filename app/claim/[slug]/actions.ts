"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSlug, type ClaimState } from "@/lib/assisted/invites";
import { tokenFor, submitClaim, declineInvitation, openInvitation } from "@/lib/assisted/invites.server";

export type ClaimResult = { ok: true; state: ClaimState } | { ok: false; error: string };
export type DeclineResult = { ok: true } | { ok: false; error: string };

const clean = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Ask to look after the record. The token is read from its HttpOnly cookie HERE, on the server, and
 * handed to the database, which checks it, binds it to this account and creates an ORDINARY PENDING
 * CLAIM. This makes nobody an owner: an administrator still has to approve it.
 */
export async function requestOwnership(slug: string, _prev: ClaimResult | null, form: FormData): Promise<ClaimResult> {
  if (!isSlug(slug)) return { ok: false, error: "This invitation is no longer valid." };
  const token = await tokenFor(slug);
  if (!token) return { ok: false, error: "This invitation is no longer valid. Please open the link you were sent again." };
  if (form.get("confirm") !== "on") {
    return { ok: false, error: "Please confirm that you help run the organisation, or are authorised to act for it." };
  }
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in to continue." };

  const r = await submitClaim(slug, token, {
    name: clean(form.get("name"), 200),
    email: clean(form.get("email"), 254),
    phone: clean(form.get("phone"), 50) || null,
    role: clean(form.get("role"), 100) || null,
    evidence: clean(form.get("evidence"), 2000) || null,
  });
  if (!r.ok) {
    const known = /name and a contact email|check the details|no longer valid|Sign in/i.test(r.error);
    return { ok: false, error: known ? r.error : "We couldn't send your request just now. Please try again." };
  }
  revalidatePath(`/claim/${slug}`);
  return { ok: true, state: r.state as ClaimState };
}

/**
 * "No thanks." Needs no account, and changes nothing public: the listing or Hub stays exactly as it
 * is and OneShetland carries on looking after it.
 */
export async function declineOwnership(slug: string, _prev: DeclineResult | null, form: FormData): Promise<DeclineResult> {
  if (!isSlug(slug)) return { ok: false, error: "This invitation is no longer valid." };
  const token = await tokenFor(slug);
  if (!token) return { ok: false, error: "This invitation is no longer valid." };
  const open = await openInvitation(slug);
  if (!open) return { ok: false, error: "This invitation is no longer valid." };
  const r = await declineInvitation(slug, token, clean(form.get("reason"), 500) || null);
  if (!r.ok) return { ok: false, error: r.error ?? "We couldn't record that just now. Please try again." };
  revalidatePath(`/claim/${slug}`);
  return { ok: true };
}
