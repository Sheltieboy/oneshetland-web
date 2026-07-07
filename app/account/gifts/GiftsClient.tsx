"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMyGiftsReceived, type MyGiftReceived } from "@/lib/passes-data";

const LOCAL = "#7c3aed";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function GiftRow({ gift }: { gift: MyGiftReceived }) {
  const title = gift.kind === "unit" ? gift.unit_item_name ?? "Gift" : gift.service_name ?? "Booking";
  const isBookingPending = gift.kind === "booking" && gift.status === "claimed";

  return (
    <li className="rounded-card border border-line bg-paper p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card text-lg" style={{ background: `${LOCAL}1a` }}>
          🎁
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">{title}</span>
            {gift.status === "used" && (
              <span className="shrink-0 rounded-pill bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Used</span>
            )}
          </div>
          {gift.business_name && <p className="text-sm text-ink-muted">{gift.business_name}</p>}
          {gift.purchaser_name && (
            <p className="mt-1 text-sm text-ink-muted">
              From <span className="font-semibold text-ink">{gift.purchaser_name}</span> · claimed {fmtDate(gift.claimed_at)}
            </p>
          )}
          {gift.message && (
            <p className="mt-2 rounded-card bg-sand p-3 text-sm italic text-ink">&ldquo;{gift.message}&rdquo;</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="rounded bg-sand px-2 py-1 text-xs font-semibold text-ink-soft">{gift.code}</code>
            {isBookingPending && (
              <Link
                href={`/directory/${gift.business_id}`}
                className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper transition hover:brightness-95"
                style={{ background: LOCAL }}
              >
                Pick a time
              </Link>
            )}
            <Link href={`/g/${gift.code}`} className="text-sm font-semibold underline" style={{ color: LOCAL }}>
              Open gift
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

export function GiftsClient() {
  const [gifts, setGifts] = useState<MyGiftReceived[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setGifts(await fetchMyGiftsReceived());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your gifts.");
        setGifts([]);
      }
    })();
  }, []);

  if (error) {
    return <p className="rounded-card border border-line bg-paper px-4 py-3 text-sm text-rose-600">{error}</p>;
  }

  if (gifts === null) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-sand" />
        ))}
      </div>
    );
  }

  if (gifts.length === 0) {
    return (
      <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
        <p className="font-display font-bold text-ink">No gifts yet</p>
        <p className="mt-1 text-sm text-ink-muted">
          When someone sends you a gift through OneShetland, it&apos;ll appear here ready to claim.
        </p>
      </div>
    );
  }

  const toClaim = gifts.filter((g) => g.status === "claimed");
  const used = gifts.filter((g) => g.status === "used");

  return (
    <div className="space-y-8">
      {toClaim.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">To claim</h2>
          <ul className="space-y-2">
            {toClaim.map((g) => (
              <GiftRow key={g.id} gift={g} />
            ))}
          </ul>
        </section>
      )}
      {used.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">Already used</h2>
          <ul className="space-y-2">
            {used.map((g) => (
              <GiftRow key={g.id} gift={g} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
