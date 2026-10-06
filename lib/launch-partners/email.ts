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

/* ── templates ─────────────────────────────────────────────────────────── */

/**
 * Outreach templates, keyed by the STATE OF ONESHETLAND, not by campaign. Which one new drafts use is a single constant.
 *
 *   prelaunch  — OneShetland has NOT launched yet (the introduction says so). Active today.
 *   live       — reserved for after launch. Deliberately has no copy yet: switching is one constant plus one template,
 *                and unedited drafts can then be refreshed (see classifyDraft / upgradeDraft) without touching edits.
 *
 * `legacy` templates are earlier defaults, kept only so a stored draft that is still exactly one of them can be
 * recognised as UNEDITED and upgraded safely. A draft that matches none of the known templates was edited by a human
 * and is never overwritten.
 */
export type EmailTemplateMode = "prelaunch" | "live";
export const ACTIVE_EMAIL_TEMPLATE: EmailTemplateMode = "prelaunch";

interface EmailTemplate { id: string; subject: (name: string) => string; body: string }

const PRELAUNCH: EmailTemplate = {
  id: "prelaunch",
  subject: (n) => `I’ve made a private OneShetland preview for ${n}`,
  body: [
    "Hello,",
    "",
    "I’m Darren, and I’m getting ready to launch OneShetland — a new locally built platform designed to bring more of Shetland into one place.",
    "",
    "It will help locals and visitors discover Shetland businesses, events, things to do, products, bookings, offers and community activity through one website and app.",
    "",
    "Before launch, I’m inviting a small number of Shetland businesses to become launch partners, and {{BUSINESS_NAME}} is one of the businesses I’d really like to include.",
    "",
    TOKEN_OPENING,
    "",
    "Rather than just emailing you a description of OneShetland, I’ve made a private preview specifically for {{BUSINESS_NAME}}, using information that is already publicly available, so you can actually see how it could work for you.",
    "",
    "A few important things before you look:",
    "",
    "• It’s completely private — only someone with your invitation link can see it.",
    "• Nothing is live or published.",
    "• You don’t need to join or claim anything just to have a look.",
    "• If you do want to take part, launch partners get complimentary Premium access, and I’ll personally help you get set up.",
    "• You stay in control — nothing goes live until you review it and approve it yourself.",
    "",
    TOKEN_CTA,
    "",
    "If you like what you see, you can claim the business from there and take it at your own pace. And if it’s not for you, absolutely no problem.",
    "",
    "Darren",
    "Darren Fullerton",
    "OneShetland",
  ].join("\n"),
};

/** The first approved default (before the pre-launch introduction). Kept ONLY to recognise untouched drafts. */
const LEGACY_V1: EmailTemplate = {
  id: "legacy-v1",
  subject: (n) => `I made a private OneShetland preview for ${n}`,
  body: [
    "Hello,", "", "I’ve made a private OneShetland preview for {{BUSINESS_NAME}}.", "", TOKEN_OPENING, "",
    "I’ve put together an example of how {{BUSINESS_NAME}} could look on OneShetland, using only information already publicly available.", "",
    "A few important things before you look:", "",
    "• It’s completely private — only someone with your invitation link can see it.",
    "• Nothing is live or published.",
    "• You don’t need to join or claim anything just to have a look.",
    "• If you do want to take part, launch partners get complimentary Premium access, and I’ll help you get set up.",
    "• You stay in control — nothing goes live until you review it and approve it yourself.", "",
    TOKEN_CTA, "",
    "If you like it, you can claim the business from the preview and take it from there. And if it’s not for you, absolutely no problem.", "",
    "Darren", "Darren Fullerton", "OneShetland",
  ].join("\n"),
};

/** Registered by mode. `live` is intentionally absent until post-launch copy is written. */
const TEMPLATES: Partial<Record<EmailTemplateMode, EmailTemplate>> = { prelaunch: PRELAUNCH };
/** Every template a stored draft could still be an untouched copy of. */
const KNOWN: EmailTemplate[] = [PRELAUNCH, LEGACY_V1];

const fill = (s: string, name: string) => s.split(TOKEN_BUSINESS).join(name);

/**
 * The default draft for a campaign: business name substituted, the campaign's own researched opening where one exists
 * (otherwise a clear prompt — never an invented claim), the call-to-action token, and Darren's sign-off. Uses the
 * ACTIVE template unless a mode is given.
 */
export function defaultEmailDraft(i: { businessName: string; opening?: string | null; mode?: EmailTemplateMode }): EmailDraft {
  const name = i.businessName.trim();
  const t = TEMPLATES[i.mode ?? ACTIVE_EMAIL_TEMPLATE];
  if (!t) throw new Error(`There is no outreach email template for "${i.mode ?? ACTIVE_EMAIL_TEMPLATE}" yet.`);
  const opening = i.opening?.trim() || openingPrompt(name);
  return { subject: t.subject(name), opening, body: fill(t.body, name) };
}

export type DraftClass = "current" | "upgradable" | "edited" | "empty";

/**
 * Is a stored draft an UNTOUCHED copy of a template? Compares subject and message (the opening is its own field and is
 * always preserved). "current" = the active template; "upgradable" = an earlier default, byte-for-byte, so safe to
 * replace; "edited" = anything else, which is a human's work and must be left alone.
 */
export function classifyDraft(stored: { subject: string | null; body: string | null }, businessName: string): DraftClass {
  if (!stored.subject?.trim() && !stored.body?.trim()) return "empty";
  const name = businessName.trim();
  const active = TEMPLATES[ACTIVE_EMAIL_TEMPLATE];
  const same = (t: EmailTemplate) => stored.subject === t.subject(name) && stored.body === fill(t.body, name);
  if (active && same(active)) return "current";
  return KNOWN.some(same) ? "upgradable" : "edited";
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

  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(i.subject)}</title></head>` +
    `<body style="margin:0;padding:24px 12px;background:#fbf8f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #ece5d6;border-radius:14px;padding:22px 28px 12px">${brandHeader()}${html}</div></body></html>`;
  return { subject: i.subject, text, html: doc, hasInvitation: !!url };
}

/**
 * The OneShetland mark and name, exactly as the live site header shows them (mark + "OneShetland" in navy). The mark is the
 * site's own logo-mark-keyed.png, resized to 120px for email (public/brand/email/logo-mark-120.png) — same artwork, a fraction
 * of the weight. It is a plain image on our own domain: no link, no query string, no tracking pixel. The name beside it is real
 * text, so the header still reads correctly when a client blocks images.
 */
export const EMAIL_LOGO_URL = "https://oneshetland.com/brand/email/logo-mark-120.png";
function brandHeader(): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 22px;border-bottom:1px solid #ece5d6"><tr>` +
    `<td width="40" style="padding:0 0 14px;width:40px;vertical-align:middle"><img src="${EMAIL_LOGO_URL}" width="40" height="40" alt="OneShetland" style="display:block;width:40px;height:40px;border:0;outline:none"></td>` +
    `<td style="padding:0 0 14px 10px;vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:24px;font-weight:600;letter-spacing:-0.2px;color:#032f4c">OneShetland</td>` +
    `</tr></table>`;
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
