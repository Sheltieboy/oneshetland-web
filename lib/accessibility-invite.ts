/**
 * accessibility-invite.ts — what the Business Suite shows about Accessible Shetland, decided in one place.
 *
 * The card is an INVITATION, never a requirement: nothing here gates anything, scores a business, or implies a standard. It reads the same
 * accessibility_profiles record the editor writes (nothing is duplicated); it never sends an email, a notification or a campaign.
 *
 * Dismissal is per PERSON, not per business, so an owner of several businesses is asked once, not once each. It is stored on their own account
 * (auth user metadata, so it follows them between devices) and, as a fallback if that write fails, on the device.
 */
export const INVITE_DISMISS_KEY = "accessible_invite_dismissed_at";
export const INVITE_DEVICE_KEY = "os.accessibleInviteDismissed.v1";

export type InviteState = "invite" | "draft" | "thanks";

/** none / draft / published, from the owner's own view of the record. A listing hidden by staff is not "thanks": the editor explains and the card stays quiet. */
export function inviteState(profile: { published: boolean } | null | undefined): InviteState {
  if (!profile) return "invite";
  return profile.published ? "thanks" : "draft";
}

/** Whether the owner has dismissed the invitation. Anything malformed means "not dismissed" (the card simply shows). */
export function isDismissed(meta: Record<string, unknown> | null | undefined): boolean {
  const v = meta?.[INVITE_DISMISS_KEY];
  return typeof v === "string" && !Number.isNaN(Date.parse(v));
}

/** The invitation is shown only while there is something to invite: no details, or an unpublished draft, and not dismissed. A published listing shows the small thank-you instead, whatever was dismissed. */
export function cardMode(state: InviteState, dismissed: boolean): "invite" | "thanks" | "none" {
  if (state === "thanks") return "thanks";
  return dismissed ? "none" : "invite";
}
