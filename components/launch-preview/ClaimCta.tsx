"use client";

import { useState } from "react";

/**
 * The closing call to action. For this first review it does NOT start a claim: it opens a calm holding message.
 * It makes no network request, writes nothing and publishes nothing — so pressing it is always safe.
 */
export function ClaimCta({ businessName }: { businessName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="ready-when-you-are"
        className="rounded-full bg-[#c8f169] px-7 py-4 text-base font-bold text-[#032f4c] shadow-lg transition hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      >
        Claim my private preview →
      </button>
      {open && (
        <div id="ready-when-you-are" role="status" className="mt-6 max-w-xl rounded-3xl border border-white/25 bg-white/10 p-6 text-left backdrop-blur-sm">
          <p className="font-display text-2xl font-bold text-white">Ready when you are.</p>
          <p className="mt-2 text-white/90">
            Thank you for taking a look. Nothing has been switched on yet, and pressing that button has not sent, saved or published anything.
          </p>
          <p className="mt-2 text-white/90">
            Darren will open the claim for {businessName} personally once you&apos;ve had time to look this over — just reply to the message he sent you whenever you&apos;re ready, or with any questions or changes.
            Claiming it will not publish anything either: you choose what goes live, and you press <strong>Go live</strong> yourself.
          </p>
        </div>
      )}
    </div>
  );
}
