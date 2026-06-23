"use client";

import { useState } from "react";
import { DonateModal } from "./DonateModal";

export function CampaignDonate({
  campaignId,
  hubName,
  accent,
  isCharity,
  isLoggedIn,
  signInHref,
  closed,
}: {
  campaignId: string;
  hubName: string;
  accent: string;
  isCharity: boolean;
  isLoggedIn: boolean;
  signInHref: string;
  closed: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (closed) {
    return (
      <div className="rounded-pill border border-line-strong px-5 py-3 text-center font-semibold text-ink-muted">
        This campaign is closed
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
