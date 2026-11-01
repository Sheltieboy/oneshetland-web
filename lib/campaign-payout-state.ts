/**
 * campaign-payout-state.ts — what a fundraiser says when its hub cannot be paid.
 *
 * One rule, hub_payout_ready(), applied in three places: a database trigger when a campaign is published or
 * reopened, and the card and wallet donation routes when money moves. This file is the DISPLAY of that rule:
 *   · the hub admin creating or reopening a campaign is told to finish payout setup first;
 *   · a donor opening a live campaign whose hub has lost payout readiness is told donations are temporarily
 *     unavailable and is given no Donate action.
 * It decides nothing about money. Copy lives here so a test can run it.
 */
export type CampaignPayoutNotice = { title: string; body: string; cta?: string };

export const CAMPAIGN_PUBLISH_BLOCKED: CampaignPayoutNotice = {
  title: "Set up payouts to publish a campaign",
  body: "Donations are paid straight to your Hub's connected payout account, so a campaign can only go live once that is set up. Your existing campaigns, donations and history are not affected.",
  cta: "Set up payouts",
};

export const DONATIONS_UNAVAILABLE: CampaignPayoutNotice = {
  title: "Donations temporarily unavailable",
  body: "This campaign can't accept donations at the moment. Nothing has been charged. Please check back soon.",
};

/**
 * Whether the Donate action is offered. `payoutReady` is null when the answer could not be read; that keeps the
 * button (the server still refuses an unpayable donation, and a flaky read must not hide a working campaign).
 * Only a definite `false` withdraws it.
 */
export function donationActionAvailable(campaignOpen: boolean, payoutReady: boolean | null): boolean {
  return campaignOpen && payoutReady !== false;
}

/** The database refusal (hint hub_payout_not_ready) as one sentence for the admin; anything else passes through. */
export function campaignWriteMessage(e: unknown, fallback: string): string {
  const err = e as { message?: string; hint?: string } | null | undefined;
  const text = `${err?.message ?? ""} ${err?.hint ?? ""}`;
  if (/hub_payout_not_ready|Finish setting up payouts before publishing/i.test(text)) {
    return "Finish setting up payouts before publishing a campaign.";
  }
  return err?.message || fallback;
}
