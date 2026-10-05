/**
 * The ONE place a real mail transport is built. It exists only when explicitly configured:
 *   POSTMARK_API_KEY       the provider token (already used by the platform's transactional email)
 *   LAUNCH_OUTREACH_FROM   e.g. "Darren Fullerton <darren@oneshetland.com>" — a sender address verified with the provider
 * Without BOTH, there is no transport, and a send stops at "not configured" before any network call.
 *
 * The message is a personal note: no open tracking, no link tracking, no marketing footer, and the provider metadata
 * never carries the invitation link or token.
 */
import type { MailMessage, MailTransport } from "./send-core";

export function outreachFrom(env: Record<string, string | undefined> = process.env): string | null {
  const f = env.LAUNCH_OUTREACH_FROM?.trim();
  return f && /<[^@\s>]+@[^@\s>]+>|^[^@\s]+@[^@\s]+$/.test(f) ? f : null;
}

export function configuredTransport(env: Record<string, string | undefined> = process.env): MailTransport | null {
  const key = env.POSTMARK_API_KEY?.trim();
  if (!key || !outreachFrom(env)) return null;
  return {
    async send(m: MailMessage) {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": key },
        body: JSON.stringify({
          From: m.from, ReplyTo: m.replyTo, To: m.to, Subject: m.subject, TextBody: m.text, HtmlBody: m.html,
          MessageStream: "outbound", TrackOpens: false, TrackLinks: "None", Metadata: m.metadata,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { MessageID?: string; ErrorCode?: number; Message?: string };
      if (!res.ok || json.ErrorCode || !json.MessageID) throw new Error(json.Message ?? "The mail provider refused the message.");
      return { id: json.MessageID };
    },
  };
}
