/**
 * hub-payout-notice.ts — what the membership-tiers screen says about payouts.
 *
 * It used to say one thing, always: "Paid tiers need a connected payout
 * account. Set one up in the OneShetland app (Hub → payouts)." TiersManager was
 * never given any payout state, so the warning appeared to every admin whatever
 * their hub had connected — including hubs already taking money. It also sent
 * web users to the mobile app, when the web app has that page and links to it
 * from the management screen they arrived from.
 *
 * The copy is here rather than inline so a test can run it rather than read it.
 *
 * Scope note: `ready` means THIS HUB'S OWN connected account, which is exactly
 * what create-hub-membership-intent requires today. A hub does not inherit its
 * owner's central payout account — businesses do, hubs do not — so this notice
 * must not imply otherwise until that changes.
 */
export type HubPayoutNotice = {
  title: string;
  body: string;
  cta: string;
};

export function hubPayoutNotice(ready: boolean): HubPayoutNotice {
  return ready
    ? {
        title: "Payouts ready ✓",
        body: "Membership payments will be paid to this Hub's connected payout account.",
        cta: "Manage payouts",
      }
    : {
        title: "Set up payouts to offer paid memberships",
        body: "Free tiers work straight away — you can create those now. Paid tiers need a connected payout account.",
        cta: "Set up payouts",
      };
}

/** The hub's payouts page, told where to send the admin back to. */
export function hubPayoutHref(hubIdOrSlug: string, next?: "tiers"): string {
  const base = `/hubs/${hubIdOrSlug}/manage/payouts`;
  return next ? `${base}?next=${next}` : base;
}
