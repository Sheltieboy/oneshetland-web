"use server";
/**
 * Assisted Publishing — the two creation actions and the two housekeeping ones.
 *
 * Each starts with requireAdmin() and then calls exactly ONE database function, which checks the
 * caller again and does its own writing. Nothing here uses a service key. A duplicate answer is
 * returned to the screen rather than thrown, because it is a question for the administrator, not an
 * error.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { createBusiness, createHub, forgetContact, setRequest, updateBusiness, updateHub } from "@/lib/assisted/client";
import { publicPath, type AssistedKind, type CreateResult } from "@/lib/assisted/shape";
import {
  decideClaim, inviteAudit, issueInvite, markSent, recordSupportPermission,
  revokeInvite, revokeSupport, supportLog, supportState, type AuditLine, type SupportEdit,
} from "@/lib/assisted/invites.server";
import { claimUrl } from "@/lib/assisted/invites";
import { copyBlock, bodyHtml, subjectLine, type InvitationFacts } from "@/lib/assisted/email";

const str = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v.trim() : "");
const nul = (v: FormDataEntryValue | null): string | null => str(v) || null;
const bool = (v: FormDataEntryValue | null): boolean => str(v) === "on" || str(v) === "true";

export async function createAssistedBusinessAction(form: FormData): Promise<CreateResult> {
  await requireAdmin();
  const name = str(form.get("name"));
  if (!name) return { created: false, reason: "error", message: "Please give the organisation’s name." };
  const address = str(form.get("address"));
  if (!address) return { created: false, reason: "error", message: "Please give an address or place." };
  const result = await createBusiness({
    name, category: str(form.get("category")) || "other", address,
    description: nul(form.get("description")), phone: nul(form.get("phone")),
    email: nul(form.get("email")), website: nul(form.get("website")),
    requestedByName: nul(form.get("requested_by_name")), requestedByEmail: nul(form.get("requested_by_email")),
    requestNote: nul(form.get("request_note")),
    publish: bool(form.get("publish")), confirmDuplicate: bool(form.get("confirm_duplicate")),
  });
  if (result.created) { revalidatePath("/admin/claims"); revalidatePath("/directory"); }
  return result;
}

export async function createAssistedHubAction(form: FormData): Promise<CreateResult> {
  await requireAdmin();
  const name = str(form.get("name"));
  if (!name) return { created: false, reason: "error", message: "Please give the organisation’s name." };
  const result = await createHub({
    name, type: str(form.get("type")) || "other",
    description: nul(form.get("description")), area: nul(form.get("area")),
    contactEmail: nul(form.get("contact_email")), contactPhone: nul(form.get("contact_phone")),
    website: nul(form.get("website")),
    requestedByName: nul(form.get("requested_by_name")), requestedByEmail: nul(form.get("requested_by_email")),
    requestNote: nul(form.get("request_note")),
    publish: bool(form.get("publish")), confirmDuplicate: bool(form.get("confirm_duplicate")),
  });
  if (result.created) { revalidatePath("/admin/hubs"); revalidatePath("/hubs"); }
  return result;
}

/** Correct an unclaimed record. NULL/absent means "leave that field alone", which the database honours. */
export async function editAssistedAction(form: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const kind = str(form.get("kind")) === "hub" ? "hub" : "business";
  const id = str(form.get("id"));
  if (!id) return { ok: false, error: "Which record?" };
  const publish = form.get("publish") === null ? undefined : bool(form.get("publish"));
  const r = kind === "hub"
    ? await updateHub(id, {
        name: str(form.get("name")) || undefined, type: str(form.get("type")) || undefined,
        description: nul(form.get("description")), area: nul(form.get("area")),
        contactEmail: nul(form.get("contact_email")), contactPhone: nul(form.get("contact_phone")),
        website: nul(form.get("website")), publish,
      })
    : await updateBusiness(id, {
        name: str(form.get("name")) || undefined, category: str(form.get("category")) || undefined,
        address: str(form.get("address")) || undefined, description: nul(form.get("description")),
        phone: nul(form.get("phone")), email: nul(form.get("email")), website: nul(form.get("website")), publish,
      });
  if (r.ok) {
    revalidatePath("/admin/hubs"); revalidatePath("/admin/claims");
    revalidatePath(kind === "hub" ? "/hubs" : "/directory");
  }
  return r;
}

export async function setAssistedRequestAction(input: { kind: AssistedKind; id: string; name: string | null; email: string | null; note: string | null }) {
  await requireAdmin();
  const r = await setRequest(input.kind, input.id, input.name, input.email, input.note);
  if (r.ok) { revalidatePath("/admin/hubs"); revalidatePath("/admin/claims"); }
  return r;
}

export async function forgetAssistedContactAction(input: { kind: AssistedKind; id: string }) {
  await requireAdmin();
  const r = await forgetContact(input.kind, input.id);
  if (r.ok) { revalidatePath("/admin/hubs"); revalidatePath("/admin/claims"); }
  return r;
}

/* ── Phase 2: the optional invitation, the decision, and carrying on helping ── */

const ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://oneshetland.com";

export type IssueResult =
  | {
      issued: true;
      slug: string;
      /** Shown ONCE. The database stores only a hash, so this cannot be recovered later. */
      link: string;
      expiresAt: string;
      superseded: number;
      /** Ready for the clipboard, so the invitation can go from Darren's own email. */
      copy: string;
      subject: string;
    }
  | { issued: false; reason: "previously_declined" }
  | { issued: false; reason: "error"; error: string };

/**
 * Generate an invitation. This SENDS NOTHING. It returns the private link exactly once, for the
 * administrator to copy, or to pass straight to the send action in the same screen.
 */
export async function issueAssistedInviteAction(form: FormData): Promise<IssueResult> {
  await requireAdmin();
  const kind: AssistedKind = str(form.get("kind")) === "hub" ? "hub" : "business";
  const id = str(form.get("id"));
  const name = str(form.get("subject_name"));
  const slugOrId = str(form.get("subject_slug")) || id;
  if (!id) return { issued: false, reason: "error", error: "Which record?" };
  const days = Math.max(1, Math.min(120, Number(str(form.get("days")) || "30") || 30));

  const r = await issueInvite(kind, id, nul(form.get("invited_name")), nul(form.get("invited_email")), days,
    bool(form.get("override_declined")));
  if (!r.issued) return r;

  const facts: InvitationFacts = {
    kind, name: name || "your organisation",
    publicUrl: `${ORIGIN}${publicPath({ subject_kind: kind, slug: slugOrId, subject_id: id }) ?? "/"}`,
    claimUrl: claimUrl(ORIGIN, r.slug, r.token),
    invitedName: nul(form.get("invited_name")),
    expiresAt: r.expires_at,
  };
  revalidatePath("/admin/hubs"); revalidatePath("/admin/claims");
  return {
    issued: true, slug: r.slug, link: facts.claimUrl!, expiresAt: r.expires_at, superseded: r.superseded,
    copy: copyBlock(facts), subject: subjectLine(facts),
  };
}

/**
 * Record that the invitation went out. `copied` means the administrator sent it from their own email;
 * `email` is only ever recorded by the Edge Function that actually sent one.
 */
export async function markAssistedInviteSentAction(input: { slug: string; via: "email" | "copied" }) {
  await requireAdmin();
  const r = await markSent(input.slug, input.via);
  if (r.ok) { revalidatePath("/admin/hubs"); revalidatePath("/admin/claims"); }
  return r;
}

export async function revokeAssistedInviteAction(input: { slug: string; reason: string | null }) {
  await requireAdmin();
  const r = await revokeInvite(input.slug, input.reason);
  if (r.ok) { revalidatePath("/admin/hubs"); revalidatePath("/admin/claims"); }
  return r;
}

export async function assistedInviteAuditAction(slug: string): Promise<AuditLine[]> {
  await requireAdmin();
  return inviteAudit(slug);
}

/** Approve or reject a claim. The database does the handover and writes the audit line. */
export async function decideAssistedClaimAction(input: { kind: AssistedKind; claimId: string; decision: "approve" | "reject"; note: string | null }) {
  await requireAdmin();
  const r = await decideClaim(input.kind, input.claimId, input.decision, input.note);
  if (r.ok) {
    revalidatePath("/admin/hubs"); revalidatePath("/admin/claims");
    revalidatePath(input.kind === "hub" ? "/hubs" : "/directory");
  }
  return r;
}

/** Carrying on helping after a claim: read the state, write down a permission, or end one. */
export async function assistedSupportStateAction(input: { kind: AssistedKind; id: string }) {
  await requireAdmin();
  return supportState(input.kind, input.id);
}

export async function recordAssistedSupportAction(input: { kind: AssistedKind; id: string; days: number; note: string }) {
  await requireAdmin();
  const r = await recordSupportPermission(input.kind, input.id, input.days, input.note);
  if (r.ok) { revalidatePath("/admin/hubs"); revalidatePath("/admin/claims"); }
  return r;
}

export async function endAssistedSupportAction(input: { kind: AssistedKind; id: string; reason: string | null }) {
  await requireAdmin();
  const r = await revokeSupport(input.kind, input.id, input.reason);
  if (r.ok) { revalidatePath("/admin/hubs"); revalidatePath("/admin/claims"); }
  return r;
}

export async function assistedSupportLogAction(input: { kind: AssistedKind; id: string }): Promise<SupportEdit[]> {
  await requireAdmin();
  return supportLog(input.kind, input.id);
}

/** The HTML an administrator would be sending, so the screen can show it before anything goes out. */
export async function assistedInvitationPreviewAction(input: {
  kind: AssistedKind; name: string; publicUrl: string; claimUrl: string | null; invitedName: string | null; expiresAt: string;
}): Promise<{ subject: string; html: string }> {
  await requireAdmin();
  const facts: InvitationFacts = { ...input };
  return { subject: subjectLine(facts), html: bodyHtml(facts) };
}

/**
 * SEND the invitation by email — by asking the Supabase Edge Function `send-assisted-invitation` to do
 * it. The web app has NO mail transport and NO provider key.
 *
 * This action carries exactly three things: the invitation's slug, the token (which exists only in
 * the response that generated it and is never stored), and what the administrator confirmed. There is
 * no field for a recipient, a subject or a body — the function reads the recipient from the
 * invitation row and renders the words itself, re-checks every gate, reserves the send in the
 * database so it cannot happen twice, sends, and only then reports success.
 */
export async function sendAssistedInviteEmailAction(
  input: { link: string; confirm: boolean; recipient: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string; uncertain?: true }> {
  await requireAdmin();
  const m = /\/claim\/([a-z0-9-]+)\?invite=([A-Za-z0-9_-]{40,128})$/.exec(input.link ?? "");
  if (!m) {
    return { ok: false, error: "The link is only available in the moment you generate the invitation. Generate a new one to send it." };
  }
  const sb = await createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  const { data, error } = await sb.functions.invoke("send-assisted-invitation", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { slug: m[1], token: m[2], confirm: { confirm: input.confirm === true, recipient: input.recipient } },
  });
  // A non-2xx answer says nothing about the email, and the function reports success only after the
  // send is recorded, so this can never be mistaken for "sent".
  if (error) return { ok: false, error: "It could not be sent just now, and nothing was recorded as sent. Please try again in a moment." };
  const r = data as { ok?: boolean; id?: string; messages?: string[]; error?: string; uncertain?: true } | null;
  if (r?.ok === true && r.id) {
    revalidatePath("/admin/hubs"); revalidatePath("/admin/claims");
    return { ok: true, id: r.id };
  }
  revalidatePath("/admin/hubs"); revalidatePath("/admin/claims");
  return { ok: false, error: r?.messages?.[0] ?? r?.error ?? "It could not be sent, and nothing was recorded as sent.", uncertain: r?.uncertain };
}
