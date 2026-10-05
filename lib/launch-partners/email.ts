/**
 * The invitation email — PREPARED here, never sent from here.
 *
 * Nothing in this module (or anywhere in the web app today) sends the email: Darren reads it, edits it, copies it
 * and sends it himself. The one call to action is the private invitation link, which does not exist until an
 * invitation is generated — until then the draft carries a placeholder, and the preview says so.
 */
export const LINK_PLACEHOLDER = "{{INVITATION_LINK}}";

export interface EmailDraft { subject: string; body: string }

export interface EmailInput {
  businessName: string;
  contactName?: string | null;
  /** Darren's own words about why he chose them. Optional; a sensible default is used. */
  why?: string | null;
  /** Used for the default "why" when none is given. */
  positioning?: string | null;
}

const WHY: Record<string, string> = {
  shop: "You make something genuinely Shetland, and I think more locals and visitors should be able to find it in one place.",
  book: "You're exactly the kind of local place people look for — and I'd love them to be able to find and book you in one place.",
};

export function defaultWhy(positioning?: string | null): string {
  const p = (positioning ?? "").toLowerCase();
  return /book|reserve|table|eat|drink/.test(p) ? WHY.book : WHY.shop;
}

export function composeInvitationEmail(i: EmailInput): EmailDraft {
  const name = i.businessName.trim();
  const hello = i.contactName?.trim() ? `Hi ${i.contactName.trim().split(/\s+/)[0]},` : "Hello,";
  return {
    subject: `I've made a private OneShetland preview for ${name}`,
    body: [
      hello,
      "",
      `I've made a private OneShetland preview for ${name}.`,
      "",
      `${(i.why?.trim() || defaultWhy(i.positioning))}`,
      "",
      "OneShetland is a locally-built home for Shetland businesses — a Directory, a Shop, bookings, offers and rewards, all in one place. I've put together an example of how your business could look there, using only what's already public.",
      "",
      "A few things worth knowing:",
      "• It's private. Only you can see it, through the link below.",
      "• Nothing is live or public. Nothing has been published about you.",
      "• Launch partners get complimentary Premium access, so you can set everything up properly.",
      "• You can look around first — you only claim your business if you want to.",
      "• Nothing goes live until you review it and approve it yourself.",
      "",
      `Take a look when you have a moment: ${LINK_PLACEHOLDER}`,
      "",
      "If it isn't for you, just say — no problem at all.",
      "",
      "Darren",
      "Darren Fullerton, OneShetland",
    ].join("\n"),
  };
}

export interface EmailCheck { ok: boolean; problems: string[] }

/** Is the draft fit to be sent by hand? (It can never be sent from the app.) */
export function checkEmail(e: { subject?: string | null; body?: string | null; contactEmail?: string | null }): EmailCheck {
  const problems: string[] = [];
  if (!e.subject?.trim()) problems.push("Add a subject.");
  if (!e.body?.trim()) problems.push("Write the message.");
  else {
    if (!e.body.includes(LINK_PLACEHOLDER)) problems.push(`The message needs ${LINK_PLACEHOLDER} where the private link goes.`);
    // A real link must never be saved into a draft: it would sit in the database in the clear.
    if (/[?&]invite=[A-Za-z0-9_-]{20,}/.test(e.body) || /\b[0-9a-f]{64}\b/.test(e.body)) problems.push("The draft contains what looks like a real invitation link. Use the placeholder; paste the real link only when you send.");
  }
  if (!e.contactEmail?.trim()) problems.push("Add the contact's email address.");
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.contactEmail.trim())) problems.push("That email address doesn't look right.");
  return { ok: problems.length === 0, problems };
}

/** What the email reads like, with the placeholder shown as the link will appear. */
export const renderPreview = (e: EmailDraft, linkLabel = "[your private invitation link — created when you're ready to send]"): EmailDraft => ({
  subject: e.subject, body: e.body.split(LINK_PLACEHOLDER).join(linkLabel),
});
