"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { fetchMyLoyaltyCards, isRewardReady, type LoyaltyCard } from "@/lib/loyalty-data";
import { getMyMemberCode } from "@/lib/member-card-client";
import { addLoyaltyCardToAppleWallet } from "@/lib/apple-wallet-client";
import { addLoyaltyCardToGoogleWallet } from "@/lib/google-wallet-client";

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
      <MemberCard />
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

      <AppleWalletButton cardId={card.id} />
    </li>
  );
}

function AppleWalletButton({ cardId }: { cardId: string }) {
  const [busy, setBusy] = useState<null | "apple" | "google">(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (which: "apple" | "google") => {
    setErr(null); setBusy(which);
    try {
      if (which === "apple") await addLoyaltyCardToAppleWallet(cardId);
      else await addLoyaltyCardToGoogleWallet(cardId);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not add the pass."); }
    finally { setBusy(null); }
  };
  const cls = "inline-flex items-center gap-2 rounded-lg border border-ink bg-ink px-3.5 py-2 text-xs font-bold text-paper transition hover:brightness-110 disabled:opacity-50";
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button onClick={() => run("apple")} disabled={busy !== null} className={cls}>
        {busy === "apple" ? "Preparing…" : " Add to Apple Wallet"}
      </button>
      <button onClick={() => run("google")} disabled={busy !== null} className={cls}>
        {busy === "google" ? "Preparing…" : "Add to Google Wallet"}
      </button>
      {err && <p className="w-full text-xs text-rose-600">{err}</p>}
    </div>
  );
}

function MemberCard() {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => { getMyMemberCode().then(setCode).catch(() => setCode(null)); }, []);
  return (
    <div
      className="overflow-hidden rounded-card p-5 text-paper shadow-soft"
      style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 60%, #0ea5e9 100%)" }}
    >
      <span className="inline-block rounded-pill bg-paper/20 px-2.5 py-1 text-[11px] font-bold tracking-wide">SHOP LOCAL SHETLAND</span>
      <div className="mt-3 flex items-center gap-4">
        <div className="shrink-0 rounded-xl bg-white p-2.5">
          {code ? <QRCodeSVG value={code} size={96} /> : <div className="h-24 w-24 animate-pulse rounded bg-black/10" />}
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">Your loyalty card</p>
          <p className="mt-0.5 text-sm text-paper/90">One card for every shop. Show this at the till to collect or redeem.</p>
          <p className="mt-2 text-[11px] font-bold tracking-widest text-paper/80">OR GIVE CODE</p>
          <p className="font-display text-2xl font-bold tracking-[0.25em]">{code ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}
