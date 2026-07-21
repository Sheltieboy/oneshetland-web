"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMyLoyaltyCard, type MyLoyaltyCard } from "@/lib/local-commerce-client";
import { RedeemDialog } from "@/components/local/RedeemDialog";
import type { Loyalty } from "@/lib/local-data";

/**
 * The signed-in user's own progress with this business's loyalty programme —
 * web mirror of the app detail screen's loyalty card. Shown inline in the
 * loyalty section only when the user already holds a card; otherwise renders
 * nothing (the generic programme display stays).
 */
export function LoyaltyProgress({
  businessId,
  loyalty,
  isLoggedIn,
}: {
  businessId: string;
  loyalty: Loyalty;
  isLoggedIn: boolean;
}) {
  const [card, setCard] = useState<MyLoyaltyCard | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    let live = true;
    fetchMyLoyaltyCard(businessId)
      .then((c) => { if (live) setCard(c); })
      .catch(() => {});
    return () => { live = false; };
  }, [businessId, isLoggedIn]);

  if (!card) return null;

  const needed = loyalty.stamps_required ?? 10;
  const stamps = Math.min(card.stamps_collected ?? 0, needed);
  const rewardReady = loyalty.type !== "points" && (card.stamps_collected ?? 0) >= needed;

  return (
    <div className="mt-4 rounded-xl border border-paper/30 bg-black/10 p-4">
      <p className="text-sm font-semibold text-paper/90">Your progress</p>
      {loyalty.type === "points" ? (
        <p className="mt-1 font-display text-2xl font-bold text-paper">
          {card.points_balance ?? 0} <span className="text-base font-semibold text-paper/80">points</span>
        </p>
      ) : (
        <>
          <p className="mt-1 font-display text-2xl font-bold text-paper">
            {stamps} <span className="text-base font-semibold text-paper/80">/ {needed} stamps</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Array.from({ length: needed }).map((_, i) => (
              <span
                key={i}
                className="grid h-6 w-6 place-items-center rounded-full border-2 text-[10px] font-bold"
                style={
                  i < stamps
                    ? { background: "#fff", borderColor: "#fff", color: "rgba(0,0,0,0.55)" }
                    : { borderColor: "rgba(255,255,255,0.6)" }
                }
              >
                {i < stamps ? "✓" : ""}
              </span>
            ))}
          </div>
        </>
      )}
      {rewardReady && (
        <button
          onClick={() => setRedeeming(true)}
          className="mt-3 block w-full rounded-pill bg-paper py-2.5 text-sm font-bold text-ink transition hover:brightness-95"
        >
          🎉 Redeem your reward
        </button>
      )}
      <Link
        href="/account/loyalty"
        className="mt-3 inline-block text-sm font-semibold text-paper underline-offset-2 hover:underline"
      >
        View my loyalty cards →
      </Link>
      {redeeming && (
        <RedeemDialog
          kind="reward"
          refId={card.id}
          accent="#4F46E5"
          onClose={() => setRedeeming(false)}
          onDone={() => setCard((c) => (c ? { ...c, stamps_collected: 0 } : c))}
        />
      )}
    </div>
  );
}
