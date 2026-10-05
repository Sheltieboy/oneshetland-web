/**
 * Sending the invitation email — the gates, and nothing else.
 *
 * Pure and dependency-free: the mail transport is INJECTED. Tests pass a recording stub, so no test can reach a real
 * mailbox; the production transport (send.server.ts) exists only when it is explicitly configured, and without it
 * every send ends at "not configured" before any network call.
 *
 * A send happens only if EVERY gate passes:
 *   • the caller is an administrator (checked by the action before this runs)
 *   • the contact email is present and well-formed
 *   • the SAVED draft is complete (subject, body, a real personalised opening — not the prompt)
 *   • the campaign is Ready to invite and has not already been sent
 *   • the invitation is valid, non-expired, and belongs to this very business (checked in the database)
 *   • the private link is present (it is shown once and never stored)
 *   • the administrator explicitly confirmed, and the recipient and subject they confirmed are what is saved
 *   • a transport is configured
 */
import { checkEmail, renderInvitationEmail } from "./email.ts";

export type GateFailure =
  | "not_confirmed" | "already_sent" | "not_ready" | "contact_missing" | "contact_invalid" | "draft_incomplete"
  | "invitation_invalid" | "invitation_expired" | "link_missing" | "recipient_changed" | "subject_changed" | "not_configured";

export interface MailMessage { from: string; replyTo: string; to: string; subject: string; text: string; html: string; metadata: Record<string, string> }
export interface MailTransport { send(m: MailMessage): Promise<{ id: string }> }

export interface SendInput {
  campaign: { id: string; slug: string; businessName: string; stage: string; sentAt: string | null; contactEmail: string | null; subject: string | null; opening: string | null; body: string | null };
  invitation: { status: string; expiresAt: string | null; tokenValidForThisBusiness: boolean };
  /** The private link, built from the token Darren just generated. */
  invitationUrl: string | null;
  confirmation: { confirm: boolean; recipient: string; subject: string } | null;
}
export interface SendDeps { transport: MailTransport | null; from: string; now: () => Date }

export const GATE_MESSAGE: Record<GateFailure, string> = {
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
  not_configured: "Sending from OneShetland isn't configured yet, so nothing was sent.",
};

const emailShape = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Every gate that is not satisfied. Empty means a send is allowed. */
export function evaluateSendGates(i: SendInput, deps: Pick<SendDeps, "transport" | "now">): GateFailure[] {
  const f: GateFailure[] = [];
  const c = i.campaign;
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
  if (!deps.transport) f.push("not_configured");
  return f;
}

export type SendOutcome = { ok: true; messageId: string; recipient: string } | { ok: false; failures: GateFailure[]; message: string };

export async function sendInvitationEmail(i: SendInput, deps: SendDeps): Promise<SendOutcome> {
  const failures = evaluateSendGates(i, deps);
  if (failures.length || !deps.transport) return { ok: false, failures, message: failures.map((x) => GATE_MESSAGE[x]).join(" ") };
  const c = i.campaign;
  const rendered = renderInvitationEmail({ subject: c.subject!, body: c.body!, opening: c.opening, businessName: c.businessName, invitationUrl: i.invitationUrl });
  if (!rendered.hasInvitation) return { ok: false, failures: ["link_missing"], message: GATE_MESSAGE.link_missing };
  const res = await deps.transport.send({
    from: deps.from, replyTo: deps.from, to: c.contactEmail!.trim(), subject: rendered.subject, text: rendered.text, html: rendered.html,
    // Never the token or the link: metadata is stored by the mail provider.
    metadata: { kind: "launch_partner_invitation", campaign: c.slug },
  });
  return { ok: true, messageId: res.id, recipient: c.contactEmail!.trim() };
}
