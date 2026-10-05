import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getPreviewConfig } from "./registry";
import { inviteCookieName, isSlug, isToken, type InviteView } from "./invite";
import type { PreviewConfig } from "./types";
import { isReviewToken } from "./review";
import { readStoredPreview } from "@/lib/launch-partners/campaigns.server";

export interface PrivatePreview { cfg: PreviewConfig; token: string; businessId: string; /** True only for a local development REVIEW token (see review.ts). Never true in production. */ review?: boolean }

/**
 * The one door into a private preview. Returns the preview ONLY if the invitation cookie holds a token the database
 * accepts for this slug AND for the business this preview is configured for. Every failure — no cookie, wrong,
 * revoked, expired, unknown slug, mismatch — is the same null, which the page turns into an ordinary 404.
 */
export async function openPrivatePreview(slug: string): Promise<PrivatePreview | null> {
  if (!isSlug(slug)) return null;
  const code = getPreviewConfig(slug);
  const token = (await cookies()).get(inviteCookieName(slug))?.value;
  if (!isToken(token)) return null;
  // Local review of a preview you are preparing (development mode + a local secret only; see review.ts). Uses the code config.
  if (code?.directoryBusinessId && isReviewToken(slug, token)) return { cfg: code, token, businessId: code.directoryBusinessId, review: true };
  // The content comes from the campaign Admin manages (checked against the token in the database); the code config
  // is only the fallback for a preview that has not been brought into Admin yet.
  const stored = await readStoredPreview(slug, token);
  const cfg = stored ?? code;
  if (!cfg || !cfg.directoryBusinessId) return null;
  const sb = await createClient();
  const { data, error } = await sb.rpc("launch_invite_resolve", { p_slug: slug, p_token: token });
  if (error || typeof data !== "string" || data !== cfg.directoryBusinessId) return null;
  return { cfg, token, businessId: data };
}

/** Where the signed-in caller stands with this invitation. Null if it is not valid. */
export async function claimView(slug: string, token: string): Promise<InviteView | null> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("launch_invite_claim_state", { p_slug: slug, p_token: token });
  if (error || !data || typeof data !== "object") return null;
  return data as InviteView;
}
