"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { offerBadge, type Offer } from "@/lib/local-data";
import { fetchMyRedeemedOfferIds } from "@/lib/local-commerce-client";
import { RedeemDialog } from "@/components/local/RedeemDialog";

export function OfferClaimList({
  offers,
  accent,
  isLoggedIn,
  signInHref,
}: {
  offers: Offer[];
  accent: string;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    let live = true;
    fetchMyRedeemedOfferIds().then((ids) => { if (live) setClaimed(new Set(ids)); }).catch(() => {});
    return () => { live = false; };
  }, [isLoggedIn]);

  return (
    <div className="mt-5 space-y-3">
      {redeeming && (
        <RedeemDialog
          kind="offer"
          refId={redeeming}
          accent={accent}
          onClose={() => setRedeeming(null)}
          onDone={() => setClaimed((prev) => new Set(prev).add(redeeming))}
        />
      )}
      {offers.map((o) => {
        const isClaimed = claimed.has(o.id);
        return (
          <div key={o.id} className="flex items-start gap-4 rounded-card border border-line bg-paper p-4 shadow-soft">
            <span className="shrink-0 rounded-pill bg-local/12 px-3 py-1 text-sm font-bold text-local">{offerBadge(o)}</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg font-bold">{o.title}</h3>
              {o.description && <p className="mt-0.5 text-ink-soft">{o.description}</p>}
            </div>
            {!isLoggedIn ? (
              <Link href={signInHref} className="shrink-0 self-center rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand">
                Sign in to claim
              </Link>
            ) : isClaimed ? (
              <span className="shrink-0 self-center rounded-pill bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">✓ Claimed</span>
            ) : (
              <button
                onClick={() => setRedeeming(o.id)}
                className="shrink-0 self-center rounded-pill px-4 py-2 text-sm font-semibold text-paper transition hover:brightness-95"
                style={{ background: accent }}
              >
                Redeem
              </button>
            )}
          </div>
        );
      })}
      {isLoggedIn && claimed.size > 0 && (
        <p className="text-sm text-ink-muted">Show your claimed offer at the till to redeem.</p>
      )}
    </div>
  );
}
