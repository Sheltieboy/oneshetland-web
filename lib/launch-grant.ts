/**
 * launch-grant.ts — how a manually granted launch-partner plan is described to the owner.
 *
 * A launch grant is Pro or Premium with an end date and no Stripe subscription behind it. The Plan screen used to
 * read that as a paying customer: "Premium · £49.99/mo … Renews 3 April". Nothing renews and nothing is charged,
 * so the screen now says what it is. The grant rows are written only by admin_grant_launch_plan; the owner may
 * read their own business's rows.
 */

export type LaunchGrantRow = {
  tier: "pro" | "premium";
  expires_at: string;
  revoked_at?: string | null;
  superseded_at?: string | null;
};

export type LaunchGrant = { tier: "pro" | "premium"; expiresAt: string };

/**
 * The grant that is giving this business its plan right now, or null.
 *
 * A genuine subscription always wins (the grant is then history), and a lapsed, revoked or replaced grant gives
 * nothing, so none of them may be described as current access.
 */
export function liveLaunchGrant(
  rows: LaunchGrantRow[] | null | undefined,
  subscriptionConnected: boolean,
  now: Date = new Date(),
): LaunchGrant | null {
  if (subscriptionConnected) return null;
  const open = (rows ?? []).filter((r) => !r.revoked_at && !r.superseded_at && new Date(r.expires_at) > now);
  if (open.length === 0) return null;
  const latest = open.reduce((a, b) => (new Date(b.expires_at) > new Date(a.expires_at) ? b : a));
  return { tier: latest.tier, expiresAt: latest.expires_at };
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** The two strings the Plan card shows for a grant: the badge, and the line under it. */
export function launchGrantCopy(g: LaunchGrant, tierLabel: string): { badge: string; line: string } {
  return {
    badge: `${tierLabel} · Launch partner`,
    line: `Plan access until ${day(g.expiresAt)}. Included free as a launch partner — nothing renews and no payment is taken.`,
  };
}
