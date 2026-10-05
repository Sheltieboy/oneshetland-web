/**
 * The launch-partner invitation email — one reusable template, an HTML + plain-text renderer, and the readiness rules.
 *
 * PREPARED here, SENT only through the gated action in send-core.ts (never from this module).
 *
 * The stored draft is {subject, opening, body}. The body is the template with the BUSINESS NAME already filled in and
 * two tokens left in place:
 *     {{PERSONALISED_OPENING}}   replaced at render time by the separate, editable opening
 *     {{INVITATION_CTA}}         replaced at render time by the call to action (or a "not generated yet" note)
 * A draft is created once — when a campaign is first prepared — or when Darren explicitly resets it. It is never
 * regenerated because campaign data changed, so his edits are never overwritten.
 *
 * The invitation link exists only in memory, only after Darren deliberately generates it, and appears only in the
 * rendered email. It is never stored in a draft; a draft containing one is refused.
 */

export const TOKEN_OPENING = "{{PERSONALISED_OPENING}}";
export const TOKEN_CTA = "{{INVITATION_CTA}}";
export const TOKEN_BUSINESS = "{{BUSINESS_NAME}}";
/** The token older drafts used for the link. Still understood (treated as the call to action). */
export const LINK_PLACEHOLDER = "{{INVITATION_LINK}}";

export const CTA_LABEL = "View your private preview →";
export const CTA_FALLBACK_LINE = "If the button does not work, copy and paste this link:";
export const CTA_TEXT_LABEL = "View your private preview:";
export const NO_INVITATION_TITLE = "Invitation not generated yet";
export const NO_INVITATION_NOTE = "The “View your private preview →” button, and a copy-and-paste link beneath it, are inserted here when you generate the invitation.";

export interface EmailDraft { subject: string; opening: string; body: string }

/** The clear prompt left where a researched opening does not exist. Sending is refused while it remains. */
export const OPENING_PROMPT_START = "[Your short personal opening";
export const openingPrompt = (name: string): string => `${OPENING_PROMPT_START} — why you chose ${name}, in your own words. Replace this line before sending.]`;
export const isOpeningPrompt = (s: string | null | undefined): boolean => !!s && s.includes(OPENING_PROMPT_START);

const TEMPLATE_BODY = [
  "Hello,",
  "",
  "I’ve made a private OneShetland preview for {{BUSINESS_NAME}}.",
  "",
  TOKEN_OPENING,
  "",
  "I’ve put together an example of how {{BUSINESS_NAME}} could look on OneShetland, using only information already publicly available.",
  "",
  "A few important things before you look:",
  "",
  "• It’s completely private — only someone with your invitation link can see it.",
  "• Nothing is live or published.",
  "• You don’t need to join or claim anything just to have a look.",
  "• If you do want to take part, launch partners get complimentary Premium access, and I’ll help you get set up.",
  "• You stay in control — nothing goes live until you review it and approve it yourself.",
  "",
  TOKEN_CTA,
  "",
  "If you like it, you can claim the business from the preview and take it from there. And if it’s not for you, absolutely no problem.",
  "",
  "Darren",
  "Darren Fullerton",
  "OneShetland",
].join("\n");

const fill = (s: string, name: string) => s.split(TOKEN_BUSINESS).join(name);

/**
 * The default draft for a campaign: business name substituted, the campaign's own researched opening where one exists
 * (otherwise a clear prompt — never an invented claim), the call-to-action token, and Darren's sign-off.
 */
export function defaultEmailDraft(i: { businessName: string; opening?: string | null }): EmailDraft {
  const name = i.businessName.trim();
  const opening = i.opening?.trim() || openingPrompt(name);
  return { subject: `I made a private OneShetland preview for ${name}`, opening, body: fill(TEMPLATE_BODY, name) };
}

/* ── rendering ─────────────────────────────────────────────────────────── */

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Only a plain https (or, for local review, http) address may become a link. Anything else is not rendered as one. */
export const isLinkable = (u: string | null | undefined): u is string => !!u && /^https?:\/\/[^\s<>"']+$/.test(u);

export interface RenderInput {
  subject: string;
  body: string;
  opening?: string | null;
  businessName?: string | null;
  /** The real private link — present only right after Darren generates the invitation, and only in memory. */
  invitationUrl?: string | null;
  /** A stand-in shown when an invitation exists but its link is no longer available (it is shown once). Preview only. */
  maskedUrl?: string | null;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
  /** True when the real link was inserted (so this is the email as the recipient receives it). */
  hasInvitation: boolean;
}

function expand(body: string, i: RenderInput): string {
  const opening = (i.opening ?? "").trim();
  let out = body.split(TOKEN_BUSINESS).join(i.businessName ?? "");
  out = out.split(TOKEN_OPENING).join(opening);
  // The call-to-action token is left for the caller, which renders it differently for text and HTML.
  return out;
}

const ctaText = (url: string | null, masked: string | null): string =>
  url ? `${CTA_TEXT_LABEL} ${url}` : masked ? `${CTA_TEXT_LABEL} ${masked}` : `[${NO_INVITATION_TITLE} — the link is inserted here when you generate the invitation.]`;

export function renderInvitationEmail(i: RenderInput): RenderedEmail {
  const url = isLinkable(i.invitationUrl) ? i.invitationUrl : null;
  const masked = !url && i.maskedUrl ? i.maskedUrl : null;
  const base = expand(i.body, i);
  const cta = ctaText(url, masked);
  const text = base.split(TOKEN_CTA).join(cta).split(LINK_PLACEHOLDER).join(cta);

  const blocks = base.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const p = "margin:0 0 16px;font-size:16px;line-height:1.55;color:#14222c";
  const html = blocks.map((b) => {
    if (b === TOKEN_CTA || b === LINK_PLACEHOLDER) return ctaHtml(url, masked);
    const lines = b.split("\n");
    if (lines.every((l) => l.startsWith("• "))) {
      return `<ul style="margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.55;color:#14222c">${lines.map((l) => `<li style="margin:0 0 6px">${esc(l.slice(2))}</li>`).join("")}</ul>`;
    }
    return `<p style="${p}">${lines.map(esc).join("<br>")}</p>`;
  }).join("\n");

  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(i.subject)}</title></head>` +
    `<body style="margin:0;padding:24px 12px;background:#fbf8f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px 28px 12px">${html}</div></body></html>`;
  return { subject: i.subject, text, html: doc, hasInvitation: !!url };
}

function ctaHtml(url: string | null, masked: string | null): string {
  if (!url && !masked) {
    return `<div style="margin:0 0 20px;padding:14px 16px;border:2px dashed #d8cfbd;border-radius:12px;background:#fbf8f2;color:#3a4754;font-size:14px;line-height:1.5"><strong style="color:#14222c">${esc(NO_INVITATION_TITLE)}</strong><br>${esc(NO_INVITATION_NOTE)}</div>`;
  }
  const shown = url ?? masked!;
  const href = url ? esc(url) : "#";
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:4px 0 8px"><tr><td style="border-radius:999px;background:#032f4c"><a href="${href}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(CTA_LABEL)}</a></td></tr></table>` +
    `<p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#6b7280">${esc(CTA_FALLBACK_LINE)}<br><span style="word-break:break-all;color:#3a4754">${esc(shown)}</span></p>`;
}

/* ── readiness ─────────────────────────────────────────────────────────── */

export interface EmailCheck { ok: boolean; problems: string[] }

/** Is the SAVED draft fit to send? (Whether the invitation exists is a separate gate.) */
export function checkEmail(e: { subject?: string | null; body?: string | null; opening?: string | null; contactEmail?: string | null }): EmailCheck {
  const problems: string[] = [];
  if (!e.subject?.trim()) problems.push("Add a subject.");
  if (!e.body?.trim()) problems.push("Write the message.");
  else {
    if (!e.body.includes(TOKEN_CTA) && !e.body.includes(LINK_PLACEHOLDER)) problems.push(`The message needs ${TOKEN_CTA} where the button and link go.`);
    if (e.body.includes(TOKEN_OPENING) && !e.opening?.trim()) problems.push("Write the personalised opening.");
  }
  if (isOpeningPrompt(e.opening) || isOpeningPrompt(e.body)) problems.push("Replace the personalised-opening prompt with your own line.");
  // A real link must never be saved into a draft: it would sit in the database in the clear.
  const secret = /[?&]invite=[A-Za-z0-9_-]{20,}/;
  if (secret.test(e.body ?? "") || secret.test(e.opening ?? "") || /\b[0-9a-f]{64}\b/.test(`${e.body ?? ""} ${e.opening ?? ""}`)) problems.push("The draft contains what looks like a real invitation link. Leave the call-to-action token; the link is inserted when you generate the invitation.");
  if (!e.contactEmail?.trim()) problems.push("Add the contact's email address.");
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.contactEmail.trim())) problems.push("That email address doesn't look right.");
  return { ok: problems.length === 0, problems };
}

export type EmailStatus = "contact_missing" | "draft_needed" | "draft_ready" | "invitation_needed" | "ready_to_send" | "sent";
export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  contact_missing: "Contact missing", draft_needed: "Draft needed", draft_ready: "Draft ready", invitation_needed: "Invitation needed", ready_to_send: "Ready to send", sent: "Sent",
};

export function emailStatus(i: {
  sentAt: string | null; contactEmail: string | null; subject: string | null; body: string | null; opening: string | null;
  stage: string; invitation: { status: string; expiresAt: string | null }; now?: Date;
}): EmailStatus {
  if (i.sentAt) return "sent";
  if (!i.contactEmail?.trim()) return "contact_missing";
  const draft = checkEmail({ subject: i.subject, body: i.body, opening: i.opening, contactEmail: i.contactEmail });
  if (!draft.ok) return "draft_needed";
  const live = ["open", "claim pending", "claimed"].includes(i.invitation.status) && !(i.invitation.expiresAt && new Date(i.invitation.expiresAt) <= (i.now ?? new Date()));
  if (live) return "ready_to_send";
  return i.stage === "ready_to_invite" ? "invitation_needed" : "draft_ready";
}
