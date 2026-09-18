"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNotify } from "@/components/ui/ConfirmProvider";
import { startOrResumePayoutSetup, payoutOnboardingErrorNotify } from "@/lib/payout-readiness";

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
  const notify = useNotify();
  const [busy, setBusy] = useState(false);

  async function go() {
    // Set before startOrResumePayoutSetup's own first await (its fresh
    // readiness check), so the tap is acknowledged immediately, not once a
    // network round trip finishes. Duplicate taps are blocked by `disabled`
    // reflecting the same flag.
    if (busy) return;
    setBusy(true);
    let failure: { error: unknown } | null = null;
    try {
      await startOrResumePayoutSetup(businessId);
    } catch (e) {
      failure = { error: e };
    } finally {
      setBusy(false);
      router.refresh();
    }
    // After the reset, so the row is already back to normal when this shows.
    if (failure) await notify(payoutOnboardingErrorNotify(failure.error));
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
