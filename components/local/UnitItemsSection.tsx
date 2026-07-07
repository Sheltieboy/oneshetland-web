"use client";

import { useState } from "react";
import { money, type UnitItem } from "@/lib/local-data";
import { BuyUnitModal } from "./BuyUnitModal";
import { GiftModal } from "./GiftModal";

export function UnitItemsSection({
  items,
  accent,
  isLoggedIn,
  signInHref,
}: {
  items: UnitItem[];
  accent: string;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const [buy, setBuy] = useState<UnitItem | null>(null);
  const [gift, setGift] = useState<UnitItem | null>(null);

  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-2xl font-bold">Passes &amp; packs</h2>
      <div className="mt-5 divide-y divide-line rounded-xl border border-line bg-paper shadow-soft">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">{it.name}</h3>
              <p className="text-sm text-ink-muted">
                {it.uses_per_purchase > 1 ? `${it.uses_per_purchase} uses` : "Single use"}
                {it.valid_days ? ` · valid ${it.valid_days} days` : ""}
                {it.description ? ` · ${it.description}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-display text-lg font-bold" style={{ color: accent }}>{money(it.price_pence)}</span>
              <button
                onClick={() => setGift(it)}
                className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-sand"
              >
                Gift
              </button>
              <button
                onClick={() => setBuy(it)}
                className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper transition hover:brightness-95"
                style={{ background: accent }}
              >
                Buy
              </button>
            </div>
          </div>
        ))}
      </div>

      {buy && (
        <BuyUnitModal
          open={!!buy}
          onClose={() => setBuy(null)}
          item={buy}
          accent={accent}
          isLoggedIn={isLoggedIn}
          signInHref={signInHref}
        />
      )}
      {gift && (
        <GiftModal
          open={!!gift}
          onClose={() => setGift(null)}
          target={{ kind: "unit", id: gift.id, name: gift.name, pricePence: gift.price_pence }}
          accent={accent}
          isLoggedIn={isLoggedIn}
          signInHref={signInHref}
        />
      )}
    </section>
  );
}
