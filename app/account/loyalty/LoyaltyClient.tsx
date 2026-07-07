"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMyLoyaltyCards, isRewardReady, type LoyaltyCard } from "@/lib/loyalty-data";

const LOCAL = "#7c3aed";

export function LoyaltyClient() {
  const [cards, setCards] = useState<LoyaltyCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCards(await fetchMyLoyaltyCards());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your loyalty cards.");
      setCards([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (cards === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-sand" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-card border border-line bg-paper px-4 py-3 text-sm text-rose-600">{error}</p>
      )}

      {cards.length === 0 ? (
        <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
          <p className="font-display font-bold text-ink">No loyalty cards yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Visit a participating Shetland business and collect your first stamp.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <LoyaltyCardRow key={card.id} card={card} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LoyaltyCardRow({ card }: { card: LoyaltyCard }) {
  const isStamp = card.program?.type === "stamps";
  const stamps = card.stamps_collected;
  const needed = card.program?.stamps_required ?? 10;
  const ready = isRewardReady(card);
  const name = card.business?.name ?? "Local business";

  return (
    <li
      className="rounded-card border bg-paper p-4 shadow-soft"
      style={ready ? { borderColor: LOCAL, borderWidth: 2 } : undefined}
    >
      <div className="flex items-center gap-3">
        {card.business?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.business.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-card object-cover" />
        ) : (
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-card text-lg"
            style={{ background: LOCAL + "1a", color: LOCAL }}
          >
            ★
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold text-ink">{name}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {isStamp ? `${stamps} of ${needed} stamps` : `${card.points_balance} points`}
          </p>
        </div>
        {ready && (
          <span
            className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold text-white"
            style={{ background: LOCAL }}
          >
            🎁 Ready!
          </span>
        )}
      </div>

      {isStamp && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`${stamps} of ${needed} stamps collected`}>
          {Array.from({ length: needed }).map((_, i) => (
            <span
              key={i}
              className="h-5 w-5 rounded-full border"
              style={
                i < stamps
                  ? { background: LOCAL, borderColor: LOCAL }
                  : { background: "transparent", borderColor: LOCAL + "55" }
              }
            />
          ))}
        </div>
      )}

      {card.program?.stamp_reward && (
        <p className="mt-3 text-sm italic text-ink-soft">{card.program.stamp_reward}</p>
      )}
    </li>
  );
}
