/**
 * The send gates, as the Admin screen shows them — ADVISORY ONLY.
 *
 * Sending itself happens in the Supabase Edge Function `send-launch-invitation` (oneshetland-delivers), which re-reads
 * the saved draft, the recipient and the invitation from the database and re-evaluates every gate itself, reserves the
 * send in the database, and is the only code that holds the mail provider's key. This module exists so the Admin
 * screen can tell Darren, before he presses Send, exactly what is still missing. Nothing here can send anything; the web
 * app has no mail transport, no provider key, and no way to reach the provider.
 *
 * The gate logic is the same as the function's (golden vectors in tests/fixtures keep the two in lock-step).
 *
 * A send happens only if EVERY gate passes:
 *   • the caller is an administrator (the function checks)
 *   • the contact email is present and well-formed
 *   • the SAVED draft is complete (subject, body, a real personalised opening — not the prompt)
 *   • the campaign is Ready to invite and has not already been sent
 *   • the invitation is valid, non-expired, and belongs to this very business
 *   • the private link is present (it is shown once and never stored)
 *   • the administrator explicitly confirmed, and the recipient and subject they confirmed are what is saved
 */
import { checkEmail } from "./email.ts";

export type GateFailure =
  | "do_not_contact" | "not_confirmed" | "already_sent" | "not_ready" | "contact_missing" | "contact_invalid" | "draft_incomplete"
  | "invitation_invalid" | "invitation_expired" | "link_missing" | "recipient_changed" | "subject_changed";

export interface SendInput {
  campaign: { id: string; slug: string; businessName: string; stage: string; sentAt: string | null; contactEmail: string | null; subject: string | null; opening: string | null; body: string | null;
    /** Launch Partner outreach to this business (or this contact address) has been stopped. */ outreachStopped?: boolean };
  invitation: { status: string; expiresAt: string | null; tokenValidForThisBusiness: boolean };
  /** The private link, built from the token Darren just generated. */
  invitationUrl: string | null;
  confirmation: { confirm: boolean; recipient: string; subject: string } | null;
}

export const GATE_MESSAGE: Record<GateFailure, string> = {
  do_not_contact: "Launch Partner outreach to this business has been stopped (do not contact), so nothing was sent.",
  not_confirmed: "Confirm the send first.",
  already_sent: "This invitation email has already been recorded as sent.",
  not_ready: "Mark the campaign Ready to invite first.",
  contact_missing: "Add the contact's email address.",
  contact_invalid: "The contact's email address doesn't look right.",
  draft_incomplete: "Finish and save the email draft first (subject, message, and your own personalised opening).",
  invitation_invalid: "There is no valid invitation for this business.",
  invitation_expired: "The invitation has expired. Generate a new one.",
  link_missing: "The private link is only available right after you generate the invitation. Generate a new invitation to send it.",
  recipient_changed: "The recipient changed since you confirmed. Review and confirm again.",
  subject_changed: "The subject changed since you confirmed. Review and confirm again.",
};

const emailShape = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Every gate that is not satisfied. Empty means a send is allowed. */
export function evaluateSendGates(i: SendInput, deps: { now: () => Date }): GateFailure[] {
  const f: GateFailure[] = [];
  const c = i.campaign;
  if (c.outreachStopped) f.push("do_not_contact");                       // first: nothing below can make a stopped business sendable
  if (!i.confirmation?.confirm) f.push("not_confirmed");
  if (c.sentAt) f.push("already_sent");
  if (c.stage !== "ready_to_invite") f.push("not_ready");
  if (!c.contactEmail?.trim()) f.push("contact_missing"); else if (!emailShape.test(c.contactEmail.trim())) f.push("contact_invalid");
  if (!checkEmail({ subject: c.subject, body: c.body, opening: c.opening, contactEmail: c.contactEmail }).ok && c.contactEmail?.trim()) f.push("draft_incomplete");
  const inv = i.invitation;
  const live = ["open", "claim pending", "claimed"].includes(inv.status);
  if (!live || !inv.tokenValidForThisBusiness) f.push(inv.expiresAt && new Date(inv.expiresAt) <= deps.now() ? "invitation_expired" : "invitation_invalid");
  else if (inv.expiresAt && new Date(inv.expiresAt) <= deps.now()) f.push("invitation_expired");
  if (!i.invitationUrl) f.push("link_missing");
  if (i.confirmation?.confirm) {
    if (c.contactEmail && i.confirmation.recipient.trim().toLowerCase() !== c.contactEmail.trim().toLowerCase()) f.push("recipient_changed");
    if (c.subject && i.confirmation.subject !== c.subject) f.push("subject_changed");
  }
  return f;
}
