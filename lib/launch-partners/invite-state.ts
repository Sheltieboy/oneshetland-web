/**
 * Launch invitations — the lifetime policy, and how an invitation's state reads in Admin.
 *
 * ONE lifetime policy: INVITE_DEFAULT_DAYS (30), which lives in the email renderer's shared region (the Edge Function carries the same constant) because
 * the email states it. The Admin "Valid for" box, the issue action and the database function (admin_issue_launch_invite) all agree with it; a test reads the
 * migration to prove the database does. An administrator may still choose 1–120 days when issuing; the email then names that invitation's real expiry date.
 *
 * STATES come from what the database already records — nothing new is stored for a label. "Replaced" is simply a revoked invitation whose reason is the
 * one issuing a new invitation writes ('superseded by a new invitation'); every other revocation is "Revoked".
 *
 * Pure: no database, no framework.
 */
import { INVITE_DEFAULT_DAYS } from "./email.ts";

export { INVITE_DEFAULT_DAYS };
/** The database refuses an invitation that lasts less than an hour or more than this. */
export const INVITE_MAX_DAYS = 120;
/** What issuing a new invitation writes on the one it replaces (admin_issue_launch_invite). */
export const SUPERSEDED_REASON = "superseded by a new invitation";

export type InviteStatus = "none" | "open" | "expired" | "revoked" | "claim pending" | "claimed";
export type InviteLabel = "Not issued" | "Active" | "Expired" | "Revoked" | "Replaced" | "Used for a claim" | "Claimed";

type InviteFacts = { status: string; revoked_reason?: string | null; revoked_at?: string | null; expires_at?: string | null };

/** Closed out AFTER it had already run out: what happened first was that it expired (issuing a new one merely tidied it away). */
const expiredBeforeClosed = (i: InviteFacts): boolean => !!i.revoked_at && !!i.expires_at && new Date(i.expires_at) <= new Date(i.revoked_at);

export const isReplaced = (i: InviteFacts): boolean => i.status === "revoked" && (i.revoked_reason ?? "").startsWith("superseded") && !expiredBeforeClosed(i);

export function inviteLabel(i: InviteFacts): InviteLabel {
  if (i.status === "revoked" && expiredBeforeClosed(i)) return "Expired";
  if (isReplaced(i)) return "Replaced";
  switch (i.status) {
    case "open": return "Active";
    case "expired": return "Expired";
    case "revoked": return "Revoked";
    case "claim pending": return "Used for a claim";
    case "claimed": return "Claimed";
    default: return "Not issued";
  }
}

export const INVITE_TONE: Record<InviteLabel, "gray" | "blue" | "amber" | "green" | "red"> = {
  "Not issued": "gray", Active: "blue", Expired: "gray", Revoked: "red", Replaced: "gray", "Used for a claim": "amber", Claimed: "green",
};

/** Clamp the "Valid for" input to what the database accepts, falling back to the one canonical default. */
export const clampInviteDays = (n: unknown): number => {
  const d = Math.floor(Number(n));
  return Number.isFinite(d) && d >= 1 ? Math.min(INVITE_MAX_DAYS, d) : INVITE_DEFAULT_DAYS;
};
