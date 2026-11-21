import "server-only";
/**
 * invites.server.ts — the server-side door to the Phase 2 invitation and claim functions.
 *
 * Every call goes through the ordinary authenticated Supabase client, so the database function
 * decides for itself who is allowed and writes its own audit line. No service key is used anywhere in
 * this feature. The two calls a recipient makes before they have an account run as `anon`, which the
 * migration grants EXECUTE on exactly three functions: read the invitation, count a fetch, decline.
 */
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { AssistedKind } from "@/lib/assisted/shape";
import { claimCookieName, isSlug, isToken, type InviteClaimView, type InviteOpen, type InviteStatus } from "@/lib/assisted/invites";

const message = (e: unknown): string => {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (/42501|Only an administrator/i.test(m)) return "Only an administrator can do that.";
  return m.trim() || "Something went wrong. Please try again.";
};

/* ── the recipient's side ─────────────────────────────────────────────────── */

/** The token for this invitation, from the HttpOnly cookie proxy.ts set. Never from the address. */
export async function tokenFor(slug: string): Promise<string | null> {
  if (!isSlug(slug)) return null;
  const t = (await cookies()).get(claimCookieName(slug))?.value;
  return isToken(t) ? t : null;
}

/**
 * The one door into an invitation. Null for every failure — no cookie, wrong token, revoked,
 * superseded, expired, declined, unknown slug — so the page can render ONE calm "no longer active"
 * answer that distinguishes nothing.
 */
export async function openInvitation(slug: string): Promise<{ token: string; view: InviteOpen } | null> {
  const token = await tokenFor(slug);
  if (!token) return null;
  const sb = await createClient();
  const { data, error } = await sb.rpc("assisted_invite_open", { p_slug: slug, p_token: token });
  if (error || !data || typeof data !== "object") return null;
  return { token, view: data as InviteOpen };
}

/**
 * Count the FETCH. Deliberately fire-and-forget and deliberately not called a view: a request for
 * the address may well be an email security scanner. It consumes nothing.
 */
export async function recordFetch(slug: string, token: string): Promise<void> {
  try {
    const sb = await createClient();
    await sb.rpc("assisted_invite_record_fetch", { p_slug: slug, p_token: token });
  } catch { /* counting a fetch must never break the page */ }
}

/** Where the signed-in caller stands with this invitation. */
export async function claimView(slug: string, token: string): Promise<InviteClaimView | null> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("assisted_invite_claim_state", { p_slug: slug, p_token: token });
  if (error || !data || typeof data !== "object") return null;
  return data as InviteClaimView;
}

export type SubmitInput = { name: string; email: string; phone?: string | null; role?: string | null; evidence?: string | null };

export async function submitClaim(slug: string, token: string, i: SubmitInput):
  Promise<{ ok: true; state: string } | { ok: false; error: string }> {
  try {
    const { data, error } = await (await createClient()).rpc("submit_assisted_claim", {
      p_slug: slug, p_token: token,
      p_contact_name: i.name, p_contact_email: i.email,
      p_contact_phone: i.phone ?? null, p_role: i.role ?? null, p_evidence: i.evidence ?? null,
    });
    if (error) return { ok: false, error: message(error) };
    return { ok: true, state: (data as { state?: string } | null)?.state ?? "pending" };
  } catch (e) { return { ok: false, error: message(e) }; }
}

export async function declineInvitation(slug: string, token: string, reason: string | null):
  Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await (await createClient()).rpc("assisted_invite_decline", {
      p_slug: slug, p_token: token, p_reason: reason,
    });
    if (error) return { ok: false, error: message(error) };
    return { ok: !!(data as { ok?: boolean } | null)?.ok };
  } catch (e) { return { ok: false, error: message(e) }; }
}

/* ── the administrator's side ─────────────────────────────────────────────── */

export type InviteRow = {
  slug: string; subject_kind: AssistedKind; subject_id: string; subject_name: string | null; subject_path: string | null;
  invited_name: string | null; invited_email: string | null;
  created_at: string; expires_at: string;
  sent_at: string | null; send_count: number; sent_via: string | null;
  fetch_count: number; first_fetched_at: string | null; last_fetched_at: string | null;
  revoked_at: string | null; revoked_reason: string | null; declined_at: string | null; decline_reason: string | null;
  claim_id: string | null; claim_status: string | null; claimant_name: string | null; claimant_email: string | null;
  status: InviteStatus; do_not_contact: boolean;
};

export async function listInvites(kind?: AssistedKind, subjectId?: string): Promise<InviteRow[]> {
  try {
    const { data, error } = await (await createClient()).rpc("admin_assisted_invite_list", {
      p_kind: kind ?? null, p_subject_id: subjectId ?? null,
    });
    if (error) return [];
    return (data ?? []) as InviteRow[];
  } catch { return []; }
}

/**
 * Issue an invitation. The raw token comes back ONCE, here, and is never stored — so the link can
 * only be built in the same response that created it. If the administrator loses it, they issue
 * another, which supersedes this one.
 */
export async function issueInvite(
  kind: AssistedKind, subjectId: string,
  invitedName: string | null, invitedEmail: string | null, days: number, overrideDeclined = false,
): Promise<
  | { issued: true; slug: string; token: string; expires_at: string; superseded: number }
  | { issued: false; reason: "previously_declined" }
  | { issued: false; reason: "error"; error: string }
> {
  try {
    const expires = new Date(Date.now() + Math.max(1, Math.min(120, days)) * 86_400_000).toISOString();
    const { data, error } = await (await createClient()).rpc("admin_assisted_invite_issue", {
      p_kind: kind, p_subject_id: subjectId,
      p_invited_name: invitedName, p_invited_email: invitedEmail,
      p_expires_at: expires, p_override_declined: overrideDeclined,
    });
    if (error) return { issued: false, reason: "error", error: message(error) };
    const d = (data ?? {}) as { issued?: boolean; reason?: string; slug?: string; token?: string; expires_at?: string; superseded?: number };
    if (d.issued && d.slug && d.token) {
      return { issued: true, slug: d.slug, token: d.token, expires_at: d.expires_at ?? expires, superseded: d.superseded ?? 0 };
    }
    if (d.reason === "previously_declined") return { issued: false, reason: "previously_declined" };
    return { issued: false, reason: "error", error: "The invitation was not created." };
  } catch (e) { return { issued: false, reason: "error", error: message(e) }; }
}

export async function revokeInvite(slug: string, reason: string | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await (await createClient()).rpc("admin_assisted_invite_revoke", { p_slug: slug, p_reason: reason });
    if (error) return { ok: false, error: message(error) };
    return { ok: true };
  } catch (e) { return { ok: false, error: message(e) }; }
}

export async function markSent(slug: string, via: "email" | "copied"):
  Promise<{ ok: boolean; reason?: string; error?: string }> {
  try {
    const { data, error } = await (await createClient()).rpc("admin_assisted_invite_mark_sent", { p_slug: slug, p_via: via });
    if (error) return { ok: false, error: message(error) };
    const d = (data ?? {}) as { ok?: boolean; reason?: string };
    return { ok: !!d.ok, reason: d.reason };
  } catch (e) { return { ok: false, error: message(e) }; }
}

export type AuditLine = { at: string; action: string; actor: string | null; actor_name: string | null; actor_via: string | null; detail: Record<string, unknown> };

export async function inviteAudit(slug: string): Promise<AuditLine[]> {
  try {
    const { data, error } = await (await createClient()).rpc("admin_assisted_invite_audit", { p_slug: slug });
    if (error) return [];
    return (data ?? []) as AuditLine[];
  } catch { return []; }
}

export type WaitingClaim = {
  claim_kind: AssistedKind; claim_id: string; subject_id: string; subject_name: string | null; subject_path: string | null;
  claimant: string; claimant_name: string | null; claimant_email: string | null; claimant_phone: string | null;
  claimant_role: string | null; evidence: string | null; created_at: string;
  invite_slug: string | null; invite_sent_at: string | null; invite_fetch_count: number | null;
  claimant_account_email: string | null; email_matches_invite: boolean | null; private_history: string[] | null;
};

export async function waitingClaims(): Promise<WaitingClaim[]> {
  try {
    const { data, error } = await (await createClient()).rpc("admin_assisted_claims_waiting");
    if (error) return [];
    return (data ?? []) as WaitingClaim[];
  } catch { return []; }
}

export async function decideClaim(kind: AssistedKind, claimId: string, decision: "approve" | "reject", note: string | null):
  Promise<{ ok: boolean; reason?: string; found?: string[]; error?: string }> {
  try {
    const fn = kind === "hub" ? "admin_assisted_hub_claim_decide" : "admin_assisted_business_claim_decide";
    const { data, error } = await (await createClient()).rpc(fn, { p_claim_id: claimId, p_decision: decision, p_note: note });
    if (error) return { ok: false, error: message(error) };
    const d = (data ?? {}) as { ok?: boolean; reason?: string; found?: string[] };
    return { ok: !!d.ok, reason: d.reason, found: d.found };
  } catch (e) { return { ok: false, error: message(e) }; }
}

/* ── carrying on helping, after it has been claimed ───────────────────────── */

export type SupportState = { active: false } | { active: true; id: string; via: "owner" | "owner_asked_us"; expires_at: string; note: string | null; created_at: string };

export async function supportState(kind: AssistedKind, id: string): Promise<SupportState> {
  try {
    const { data, error } = await (await createClient()).rpc("assisted_support_state", { p_kind: kind, p_id: id });
    if (error || !data) return { active: false };
    return data as SupportState;
  } catch { return { active: false }; }
}

/** The OWNER turns it on, in their own session. */
export async function grantSupportAsOwner(kind: AssistedKind, id: string, days: number, note: string | null):
  Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await (await createClient()).rpc("owner_assisted_support_grant", {
      p_kind: kind, p_id: id, p_days: Math.max(1, Math.min(365, days)), p_note: note,
    });
    if (error) return { ok: false, error: message(error) };
    return { ok: true };
  } catch (e) { return { ok: false, error: message(e) }; }
}

/** Either side can end it. */
export async function revokeSupport(kind: AssistedKind, id: string, reason: string | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await (await createClient()).rpc("assisted_support_revoke", { p_kind: kind, p_id: id, p_reason: reason });
    if (error) return { ok: false, error: message(error) };
    return { ok: true };
  } catch (e) { return { ok: false, error: message(e) }; }
}

/** An administrator writing down a permission the owner gave them elsewhere. The note is compulsory. */
export async function recordSupportPermission(kind: AssistedKind, id: string, days: number, note: string):
  Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await (await createClient()).rpc("admin_assisted_support_record", {
      p_kind: kind, p_id: id, p_days: Math.max(1, Math.min(365, days)), p_note: note,
    });
    if (error) return { ok: false, error: message(error) };
    return { ok: true };
  } catch (e) { return { ok: false, error: message(e) }; }
}

export type SupportEdit = { at: string; actor: string | null; actor_name: string | null; fields: Record<string, boolean>; granted_via: string | null };

export async function supportLog(kind: AssistedKind, id: string): Promise<SupportEdit[]> {
  try {
    const { data, error } = await (await createClient()).rpc("admin_assisted_support_log", { p_kind: kind, p_id: id });
    if (error) return [];
    return (data ?? []) as SupportEdit[];
  } catch { return []; }
}
