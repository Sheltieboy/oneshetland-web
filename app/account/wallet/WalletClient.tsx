"use client";

import { useEffect, useState, useCallback } from "react";
import { gbp } from "@/lib/stripe";
import { fetchWalletBalance } from "@/lib/local-commerce-client";
import { fetchWalletTransactions, type WalletTransaction, type WalletTxType } from "@/lib/wallet-data";
import { WalletTopUpModal } from "@/components/local/WalletTopUpModal";
import { PayAtTillCard } from "@/components/local/PayAtTillCard";

const LOCAL = "#7c3aed";

const TYPE_BADGE: Record<WalletTxType, { label: string; cls: string }> = {
  topup: { label: "Top-up", cls: "bg-emerald-50 text-emerald-700" },
  spend: { label: "Payment", cls: "bg-rose-50 text-rose-700" },
  cashback: { label: "Cashback", cls: "bg-violet-50 text-violet-700" },
  refund: { label: "Refund", cls: "bg-amber-50 text-amber-700" },
};

function txTitle(tx: WalletTransaction): string {
  if (tx.type === "spend") return tx.business?.name ?? "Payment";
  return TYPE_BADGE[tx.type]?.label ?? tx.type;
}

export function WalletClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<WalletTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [b, t] = await Promise.all([fetchWalletBalance(), fetchWalletTransactions()]);
      setBalance(b);
      setTxs(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your wallet.");
      setTxs([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      {/* Balance card */}
      <div
        className="rounded-xl p-6 text-paper shadow-soft"
        style={{ background: LOCAL }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-paper/70">Available balance</p>
        <p className="mt-1 font-display text-4xl font-bold">
          {balance === null ? "…" : gbp(balance)}
        </p>
        <button
          onClick={() => setModalOpen(true)}
          className="mt-4 rounded-pill bg-white/20 px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-white/30"
        >
          Top up wallet
        </button>
        <p className="mt-3 text-sm text-paper/75">
          Add credit to spend at participating Shetland businesses.
        </p>
      </div>

      {/* Pay at till */}
      <PayAtTillCard balancePence={balance} onPaid={() => void load()} />

      {/* Transactions */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Recent activity</h2>

        {error && (
          <p className="mb-3 rounded-card border border-line bg-paper px-4 py-3 text-sm text-rose-600">{error}</p>
        )}

        {txs === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-card border border-line bg-sand" />
            ))}
          </div>
        ) : txs.length === 0 ? (
          <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
            <p className="font-display font-bold text-ink">No transactions yet</p>
            <p className="mt-1 text-sm text-ink-muted">Top up your wallet to start spending around Shetland.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {txs.map((tx) => {
              const isCredit = tx.amount_pence > 0;
              const badge = TYPE_BADGE[tx.type] ?? { label: tx.type, cls: "bg-sand text-ink-soft" };
              return (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 rounded-card border border-line bg-paper px-4 py-3 shadow-soft"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{txTitle(tx)}</span>
                      <span className={"shrink-0 rounded-pill px-2 py-0.5 text-xs font-bold " + badge.cls}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {new Date(tx.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {tx.description ? ` · ${tx.description}` : ""}
                    </p>
                  </div>
                  <span
                    className={"shrink-0 font-display font-bold " + (isCredit ? "text-emerald-600" : "text-ink")}
                  >
                    {isCredit ? "+" : "−"}
                    {gbp(Math.abs(tx.amount_pence))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <WalletTopUpModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          // Refresh balance + history after a top-up.
          void load();
        }}
        accent={LOCAL}
        isLoggedIn={isLoggedIn}
        signInHref="/sign-in?next=/account/wallet"
        currentBalancePence={balance ?? undefined}
      />
    </div>
  );
}
