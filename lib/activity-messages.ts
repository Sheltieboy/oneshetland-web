/**
 * activity-messages.ts — the organiser-to-follower message rules as the browser knows them, for instant feedback only.
 * The DATABASE is the authority (public.activity_message_problem / send_activity_message); this mirrors it so a person is told straight away
 * rather than after a round trip. The same test vectors are run against both.
 */
export const MESSAGE_MAX = 500;
export const FOLLOWER_CAP = 5000;

/** What the database does to the text before it is stored. */
export function cleanMessage(s: string): string {
  return s.replace(/\r/g, "").replace(/[\u0001-\u0009\u000b-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").replace(/^[ \n\t]+|[ \n\t]+$/g, "");
}

const TLD = "com|co\\.uk|uk|org|net|scot|io|me|ly|info|biz|app|dev|link|gl|xyz|tk|site|online|shop|store|page|tv|eu|ie|us|ca|au|nz|fm|to|cc|ws|top|club|live|news|email|cloud";
const DOMAIN = new RegExp(`(^|[^a-z0-9-])[a-z0-9][a-z0-9-]*\\.(${TLD})($|[^a-z0-9])`, "i");

/** The reason a message is refused, or null. Mirrors public.activity_message_problem. */
export function messageProblem(raw: string): string | null {
  const p = raw;
  if (p.replace(/[ \n\t\r]/g, "") === "") return "Write a message first.";
  if ([...p].length > MESSAGE_MAX) return `Messages can be up to ${MESSAGE_MAX} characters.`;
  if (/(https?:\/\/|ftp:\/\/|www\.)/i.test(p)) return "Links are not allowed in messages.";
  if (p.includes("@")) return "Email addresses are not allowed in messages.";
  if (DOMAIN.test(p)) return "Web addresses are not allowed in messages.";
  const squeezed = p.replace(/[ ()-]/g, "");
  if (/\d{7,}/.test(squeezed) || /(\+|(^|[^0-9])00)\s?44/.test(p) || /(^|[^0-9])0[127]\d{8,9}($|[^0-9])/.test(squeezed)) return "Phone numbers are not allowed in messages.";
  return null;
}

export type MessagingStatus = {
  eligible: boolean; reason: string | null; followers: number; next_allowed_at: string | null;
  sent_last_24h: number; organiser_sent_last_24h: number; max_chars: number; follower_cap: number;
};
export type MessageRow = { id: string; body: string; created_at: string; followers: number; recipients: number; opted_out: number; hidden_at: string | null };
export type SendResult = { id: string; followers: number; recipients: number; opted_out: number; duplicate: boolean };
export type AdminMessageRow = MessageRow & { activity_id: string; activity_title: string; activity_slug: string; author_id: string | null; hidden_by: string | null; hidden_reason: string | null };

/** Plain-English delivery line for the organiser: counts only, never names. */
export function deliveryLine(m: { followers: number; recipients: number; opted_out: number }): string {
  const n = m.recipients;
  const base = `Sent to ${n} ${n === 1 ? "follower" : "followers"}`;
  return m.opted_out > 0 ? `${base}. ${m.opted_out} ${m.opted_out === 1 ? "has" : "have"} notifications switched off and did not receive it.` : `${base}.`;
}
