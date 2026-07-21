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
  const [redeeming, setRedeeming] = useState<{ kind: "reward" | "points"; amount?: number } | null>(null);

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
  const per = (loyalty as unknown as { points_for_pound?: number }).points_for_pound ?? 100;
  const pointsSpendable = loyalty.type === "points" ? Math.floor((card.points_balance ?? 0) / per) * per : 0;

  // "Almost there" nudge — the single biggest driver of repeat visits.
  const stampsLeft = needed - stamps;
  const pointsToNext = per - ((card.points_balance ?? 0) % per);
  const nudge =
    loyalty.type === "points"
      ? pointsSpendable < per && (card.points_balance ?? 0) > 0
        ? `✨ Just ${pointsToNext} more ${pointsToNext === 1 ? "point" : "points"} for £1 off`
        : null
      : !rewardReady && stampsLeft > 0 && stampsLeft <= 2
        ? `✨ Just ${stampsLeft} more ${stampsLeft === 1 ? "stamp" : "stamps"}${loyalty.stamp_reward ? ` for ${loyalty.stamp_reward}` : " to your reward"}!`
        : null;

  return (
    <div className="mt-4 rounded-xl border border-paper/30 bg-black/10 p-4">
      <p className="text-sm font-semibold text-paper/90">Your progress</p>
      {loyalty.type === "points" ? (
        <>
          <p className="mt-1 font-display text-2xl font-bold text-paper">
            {card.points_balance ?? 0} <span className="text-base font-semibold text-paper/80">points</span>
          </p>
          {pointsSpendable >= per && (
            <button
              onClick={() => setRedeeming({ kind: "points", amount: pointsSpendable })}
              className="mt-3 block w-full rounded-pill bg-paper py-2.5 text-sm font-bold text-ink transition hover:brightness-95"
            >
              Redeem £{(pointsSpendable / per).toFixed(pointsSpendable % per === 0 ? 0 : 2)} off
            </button>
          )}
        </>
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
      {nudge && (
        <p className="mt-3 rounded-lg bg-paper/20 px-3 py-2 text-sm font-semibold text-paper">{nudge}</p>
      )}
      {rewardReady && (
        <button
          onClick={() => setRedeeming({ kind: "reward" })}
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
          kind={redeeming.kind}
          refId={card.id}
          amount={redeeming.amount}
          accent="#4F46E5"
          onClose={() => setRedeeming(null)}
          onDone={() => setCard((c) => {
            if (!c) return c;
            return redeeming.kind === "reward"
              ? { ...c, stamps_collected: 0 }
              : { ...c, points_balance: Math.max(0, (c.points_balance ?? 0) - (redeeming.amount ?? 0)) };
          })}
        />
      )}
    </div>
  );
}
