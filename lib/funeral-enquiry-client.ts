/**
 * funeral-enquiry-client.ts — how the browser sends an anonymous "Contact us about this announcement" enquiry.
 *
 * It does NOT call the database. It posts to the submit-funeral-enquiry Edge Function, which verifies the Turnstile token with Cloudflare, applies per-client
 * limits and only then files the enquiry. This module is pure (fetch is injected) so every outcome can be tested without a network.
 * Nothing about the visitor is stored in the browser; the message and contact are sent once and not logged.
 */
export const ENQUIRY_ACTION = "funeral-enquiry";

export function enquiryEndpoint(base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""): string {
  return `${base.replace(/\/+$/, "")}/functions/v1/submit-funeral-enquiry`;
}

/** Local checks only, so the person sees a problem before anything is sent; the server checks again and is the authority. */
export function enquiryProblem(message: string, contact: string): string | null {
  if (message.trim().length < 5) return "Please say what you need (at least five characters).";
  if (message.trim().length > 1000) return "Please keep your message under 1000 characters.";
  if (contact.trim().length < 5) return "Please give a telephone number or email address so we can reach you.";
  return null;
}

export type EnquiryOutcome =
  | { ok: true }
  | { ok: false; code: string; message: string; retryAfter?: number; resetCheck: boolean; keepForm: true };

const FALLBACK = "We could not send your message just now. Please try again in a few minutes, or contact us by telephone.";

export async function sendFuneralEnquiry(
  a: { id: string; kind: string; message: string; contact: string; name?: string; relationship?: string; token: string | null; website?: string },
  fetchImpl: typeof fetch = fetch,
  endpoint: string = enquiryEndpoint(),
): Promise<EnquiryOutcome> {
  const local = enquiryProblem(a.message, a.contact);
  if (local) return { ok: false, code: "invalid_input", message: local, resetCheck: false, keepForm: true };
  if (!a.token) return { ok: false, code: "verification_required", message: "Please complete the security check, then send.", resetCheck: false, keepForm: true };
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        announcement_id: a.id, kind: a.kind, message: a.message.trim(), contact: a.contact.trim(),
        contact_name: a.name?.trim() || undefined, relationship: a.relationship?.trim() || undefined, turnstile_token: a.token, website: a.website || undefined,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string; retry_after?: number };
    if (res.ok && j.ok) return { ok: true };
    // A security token is single use: after ANY failed attempt the widget must be reset. The form contents are never cleared.
    return { ok: false, code: j.error ?? "unavailable", message: j.message ?? FALLBACK, retryAfter: j.retry_after, resetCheck: true, keepForm: true };
  } catch {
    return { ok: false, code: "network", message: "We could not reach the server. Please check your connection and try again.", resetCheck: true, keepForm: true };
  }
}
