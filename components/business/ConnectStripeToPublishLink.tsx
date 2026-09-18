"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startOrResumePayoutSetup } from "@/lib/payout-readiness";

/**
 * The "Connect Stripe to publish" row on a payout-blocked draft, for pages
 * that list several events at once (app/business/[id]/manage/events/page.tsx
 * is a Server Component, so this one small interactive piece is split out
 * rather than converting the whole list). Launches the correct onboarding
 * flow directly — see startOrResumePayoutSetup's own doc comment — instead
 * of linking to the general Plan & payouts screen.
 */
export function ConnectStripeToPublishLink({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    // Set before startOrResumePayoutSetup's own first await (its fresh
    // readiness check), so the tap is acknowledged immediately, not once a
    // network round trip finishes. Duplicate taps are blocked by `disabled`
    // reflecting the same flag.
    if (busy) return;
    setBusy(true);
    try {
      await startOrResumePayoutSetup(businessId);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      aria-busy={busy}
      className="flex w-full items-center gap-2 border-t border-line px-4 py-2 text-left text-xs font-bold text-amber-800 hover:underline disabled:opacity-50 disabled:no-underline"
    >
      {busy && <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden />}
      {busy ? "Opening Stripe…" : "Connect Stripe to publish"}
    </button>
  );
}
