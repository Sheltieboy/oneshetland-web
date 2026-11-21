/**
 * email.ts — the words of an assisted-publishing invitation.
 *
 * This is NOT a send path. The web app has no mail transport and no provider key; sending happens in
 * the Supabase Edge Function `send-assisted-invitation`, which re-reads everything from the database.
 * This module renders the message so that (a) the administrator can copy it into their own email, and
 * (b) the Edge Function and the Admin screen show the same words.
 *
 * The TONE is the point. Somebody is being told that a page about their organisation already exists.
 * That can read as presumptuous, so every paragraph has one job: say what we did, say it is already
 * public, say claiming it is optional and free, say what they would get, and say we will carry on
 * helping if they would rather we did.
 *
 * The link exists only in memory, only in the response that generated the token. It is never stored.
 */

import type { AssistedKind } from "./shape";
import { whatYouCouldManage } from "./invites.ts";

export interface InvitationFacts {
  kind: AssistedKind;
  /** The organisation, as the page names it. */
  name: string;
  /** The public address of the page we made, e.g. https://oneshetland.com/hubs/voe-rowing-club */
  publicUrl: string;
  /** The private claiming address, with its token. Null before the invitation is generated. */
  claimUrl: string | null;
  /** Who we are writing to, if we know. */
  invitedName?: string | null;
  /** How long they have. */
  expiresAt: string;
}

export const CTA_LABEL = "Take over this page →";
export const CTA_FALLBACK_LINE = "If the button does not work, copy and paste this link:";
export const NO_LINK_NOTE = "The claiming link is inserted here when you generate the invitation.";

const dateWords = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "a few weeks";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
};

const noun = (kind: AssistedKind) => (kind === "hub" ? "page" : "listing");

export function subjectLine(f: InvitationFacts): string {
  return `${f.name} is on OneShetland — would you like to look after the ${noun(f.kind)}?`;
}

/** The plain-text message. The HTML version is rendered from exactly these paragraphs. */
export function bodyLines(f: InvitationFacts): string[] {
  const greeting = f.invitedName?.trim() ? `Hello ${f.invitedName.trim()},` : "Hello,";
  return [
    greeting,
    "",
    `I'm Darren, and I run OneShetland — a Shetland website and app that brings local businesses, events, things to do and community organisations into one place.`,
    "",
    `I've added a ${noun(f.kind)} for ${f.name} so that people looking for you can find you. It is already there, and you can see it here:`,
    "",
    f.publicUrl,
    "",
    `I wrote it from information that is already publicly available. Nothing is hidden behind a sign-in, and you did not need to do anything for it to exist.`,
    "",
    `If you'd like to look after it yourself, you can. It is free, and it is entirely up to you:`,
    "",
    ...whatYouCouldManage(f.kind).map((l) => `• ${l}`),
    "",
    `To take it over, you'd create a OneShetland account — there's no charge — and ask for it. I check that you're connected to ${f.name} before handing it over, which is why it isn't simply a case of clicking a link.`,
    "",
    f.claimUrl ? `${CTA_LABEL.replace(" →", "")}:\n${f.claimUrl}` : NO_LINK_NOTE,
    "",
    `This link works until ${dateWords(f.expiresAt)}.`,
    "",
    `And if you'd rather not have an account, that's completely fine. The ${noun(f.kind)} stays exactly as it is and I'll keep it up to date myself — just reply and tell me anything that's wrong or missing, and I'll change it.`,
    "",
    `If you'd prefer the ${noun(f.kind)} taken down altogether, say so and I'll remove it.`,
    "",
    "Darren",
    "Darren Fullerton",
    "OneShetland",
  ];
}

export const bodyText = (f: InvitationFacts): string => bodyLines(f).join("\n");

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A deliberately plain HTML email: no tracking pixel, no remote image, no click-wrapped link. */
export function bodyHtml(f: InvitationFacts): string {
  const paras: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      paras.push(`<ul style="margin:0 0 16px;padding-left:20px">${bullets.map((b) => `<li style="margin:0 0 6px">${escapeHtml(b)}</li>`).join("")}</ul>`);
      bullets = [];
    }
  };
  for (const line of bodyLines(f)) {
    if (!line.trim()) { flush(); continue; }
    if (line.startsWith("• ")) { bullets.push(line.slice(2)); continue; }
    flush();
    if (line === f.publicUrl || (f.claimUrl && line.includes(f.claimUrl))) continue;   // rendered below as links
    paras.push(`<p style="margin:0 0 16px">${escapeHtml(line)}</p>`);
  }
  flush();
  const cta = f.claimUrl
    ? `<p style="margin:0 0 8px"><a href="${escapeHtml(f.claimUrl)}" style="display:inline-block;background:#6b47bf;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">${escapeHtml(CTA_LABEL)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#555">${escapeHtml(CTA_FALLBACK_LINE)}<br><span style="word-break:break-all">${escapeHtml(f.claimUrl)}</span></p>`
    : `<p style="margin:0 0 16px;font-size:13px;color:#555">${escapeHtml(NO_LINK_NOTE)}</p>`;
  return [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1a1a1a;max-width:620px">`,
    paras.join("\n"),
    `<p style="margin:0 0 16px"><a href="${escapeHtml(f.publicUrl)}" style="color:#6b47bf">${escapeHtml(f.publicUrl)}</a></p>`,
    cta,
    `</div>`,
  ].join("\n");
}

/** Everything the administrator needs on the clipboard to send it from their own email. */
export function copyBlock(f: InvitationFacts): string {
  return [`Subject: ${subjectLine(f)}`, "", bodyText(f)].join("\n");
}

export type EmailGate = "no_link" | "no_recipient" | "bad_recipient" | "do_not_contact" | "not_live" | "already_sent";

export const EMAIL_GATE_MESSAGE: Record<EmailGate, string> = {
  no_link: "The link is only available in the moment you generate the invitation. Generate a new one to send it.",
  no_recipient: "Add the address to send it to.",
  bad_recipient: "That address does not look right.",
  do_not_contact: "We have been asked not to contact this address, so nothing was sent.",
  not_live: "This invitation is not live any more. Generate a new one.",
  already_sent: "This invitation has already been emailed. Use Resend if you mean to send it again.",
};

const emailShape = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Everything standing in the way of a send, in the order it matters. The Edge Function evaluates the
 * same list again from the database; this exists so the Admin screen can say what is missing first.
 */
export function emailGates(i: {
  claimUrl: string | null; recipient: string | null; status: string; doNotContact: boolean; resend: boolean;
}): EmailGate[] {
  const f: EmailGate[] = [];
  if (i.doNotContact) f.push("do_not_contact");
  if (!i.claimUrl) f.push("no_link");
  if (!i.recipient?.trim()) f.push("no_recipient");
  else if (!emailShape.test(i.recipient.trim())) f.push("bad_recipient");
  if (["revoked", "declined", "expired", "approved"].includes(i.status)) f.push("not_live");
  if (!i.resend && i.status === "sent") f.push("already_sent");
  return f;
}
