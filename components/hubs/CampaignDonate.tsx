"use client";

import { useState } from "react";
import { DonateModal } from "./DonateModal";
import { DONATIONS_UNAVAILABLE, donationActionAvailable } from "@/lib/campaign-payout-state";

export function CampaignDonate({
  campaignId,
  hubName,
  accent,
  isCharity,
  isLoggedIn,
  signInHref,
  closed,
  ended = false,
  payoutReady = null,
}: {
  campaignId: string;
  hubName: string;
  accent: string;
  isCharity: boolean;
  isLoggedIn: boolean;
  signInHref: string;
  closed: boolean;
  ended?: boolean;
  /** campaign_payout_ready(): false withdraws the Donate action; null (unknown) keeps it — the server still decides. */
  payoutReady?: boolean | null;
}) {
  const [open, setOpen] = useState(false);
  // A campaign past its end date is no longer accepting money — the backend
  // refuses it, so the page should stop asking rather than invite a 409.
  if (closed || ended) {
    return (
      <div className="rounded-pill border border-line-strong px-5 py-3 text-center font-semibold text-ink-muted">
        {closed ? "This campaign is closed" : "This campaign has ended"}
      </div>
    );
  }
  if (!donationActionAvailable(true, payoutReady)) {
    return (
      <div role="status" className="rounded-xl border border-line-strong bg-sand px-5 py-4 text-center">
        <p className="font-semibold text-ink">{DONATIONS_UNAVAILABLE.title}</p>
        <p className="mt-1 text-sm text-ink-soft">{DONATIONS_UNAVAILABLE.body}</p>
      </div>
    );
  }
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-pill px-5 py-3.5 font-semibold text-paper shadow-soft transition hover:brightness-95"
        style={{ background: accent }}
      >
        Donate
      </button>
      <DonateModal
        open={open}
        onClose={() => setOpen(false)}
        campaignId={campaignId}
        hubName={hubName}
        accent={accent}
        isCharity={isCharity}
        isLoggedIn={isLoggedIn}
        signInHref={signInHref}
      />
    </>
  );
}
