/**
 * fetch-admin-contact.ts — the "Email applicant" mail draft on the administrator's Fetch driver applications screen.
 *
 * Pure and server-side. The applicant's account email comes only from the administrator-only database function admin_driver_applicant_contacts(); this module turns it
 * into a `mailto:` link so the administrator can write and send the message themselves. Nothing is sent from here, and the address is used nowhere else (no API route,
 * no public page, no other driver's screen).
 */
const SAFE_ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const SUBJECT = "Your OneShetland Fetch driver application";

/** First name for the greeting: letters, spaces, hyphens and apostrophes only, never more than 40 characters; empty if there is nothing usable. */
export function firstNameOf(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  return first.replace(/[^\p{L}'’-]/gu, "").slice(0, 40);
}

/** A pre-addressed draft with a subject and a greeting, or null when the address is missing or not a plain email address. */
export function applicantMailto(email: string | null | undefined, fullName: string | null | undefined): string | null {
  const to = (email ?? "").trim();
  if (!to || to.length > 254 || !SAFE_ADDRESS.test(to)) return null;
  const name = firstNameOf(fullName);
  const body = `${name ? `Hi ${name},` : "Hello,"}\r\n\r\n`;
  return `mailto:${to.replace(/[?&#%]/g, encodeURIComponent)}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
}

/** Joins the administrator-only contact list onto application rows as `contactHref` (the raw address is not kept on the row). */
export function withContactLinks<T extends { id: string; profile?: { full_name?: string | null } | null }>(rows: T[], contacts: { driver_id: string; email: string | null }[] | null): (T & { contactHref: string | null })[] {
  const byId = new Map((contacts ?? []).map((c) => [c.driver_id, c.email]));
  return rows.map((r) => ({ ...r, contactHref: applicantMailto(byId.get(r.id), r.profile?.full_name ?? null) }));
}
