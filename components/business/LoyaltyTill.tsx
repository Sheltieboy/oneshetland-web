"use client";

import { useState } from "react";
import { tillLookup, tillAction, type TillLookup } from "@/lib/member-card-client";

/**
 * LoyaltyTill — staff enter (or scan into the box) a customer's ONE member code,
 * see their status at this business, then add a stamp / points / give a reward /
 * apply an offer. Web mirror of the app's local-till screen.
 */
export function LoyaltyTill({ businessId, accent }: { businessId: string; accent: string }) {
  const [code, setCode] = useState("");
  const [data, setData] = useState<TillLookup | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  async function lookup() {
    const c = code.toUpperCase().trim();
    if (c.length < 6) return;
    setBusy(true); setToast(null);
    try { setData(await tillLookup(c, businessId)); }
    catch (e) { setToast({ ok: false, text: e instanceof Error ? e.message : "Not found" }); setData(null); }
    finally { setBusy(false); }
  }

  async function act(action: "stamp" | "points" | "redeem_reward" | "redeem_offer", extra: { amountPence?: number; offerId?: string } = {}) {
    setBusy(true); setToast(null);
    try {
      const res = await tillAction(action, code.toUpperCase().trim(), { businessId, ...extra });
      setToast({ ok: true, text: res.message });
      setData(await tillLookup(code.toUpperCase().trim(), businessId));
    } catch (e) { setToast({ ok: false, text: e instanceof Error ? e.message : "Failed" }); }
    finally { setBusy(false); }
  }

  function reset() { setData(null); setCode(""); setAmount(""); setToast(null); }

  const program = data?.program;
  const card = data?.card;
  const btn = "flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50";

  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <h2 className="font-display text-xl font-bold text-ink">Loyalty till</h2>
      <p className="mt-1 text-sm text-ink-soft">Enter the customer&apos;s member code to add a stamp, add points or give a reward.</p>

      {!data ? (
        <div className="mt-4 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            onKeyDown={(e) => { if (e.key === "Enter") lookup(); }}
            placeholder="MEMBER CODE"
            className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 font-bold uppercase tracking-[0.2em] text-ink shadow-soft outline-none placeholder:tracking-normal placeholder:text-ink-faint"
          />
          <button onClick={lookup} disabled={code.length < 6 || busy} className="shrink-0 rounded-pill px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50" style={{ background: accent }}>
            {busy ? "…" : "Find"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-line bg-sand p-4 text-center">
            <p className="font-display text-lg font-bold text-ink">{data.customer.name}</p>
            <p className="text-sm font-semibold text-ink-soft">
              {program
                ? program.type === "points"
                  ? `${card?.points_balance ?? 0} points`
                  : `${card?.stamps_collected ?? 0}${program.reward_tiers.length ? ` / ${program.reward_tiers[program.reward_tiers.length - 1].stamps}` : ` / ${program.stamps_required ?? 0}`} stamps`
                : "No loyalty card here yet"}
            </p>
            {data.ready_reward && (
              <span className="mt-2 inline-block rounded-pill bg-emerald-600 px-3 py-1 text-xs font-bold text-white">🎁 Reward ready: {data.ready_reward.reward}</span>
            )}
          </div>

          {toast && <p className={"text-center text-sm font-semibold " + (toast.ok ? "text-emerald-600" : "text-rose-600")}>{toast.text}</p>}

          {program?.type === "stamps" && (
            <button onClick={() => act("stamp")} disabled={busy} className={btn} style={{ background: accent }}>Add a stamp</button>
          )}
          {program?.type === "points" && (
            <div className="flex gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="£ spent" className="w-28 rounded-lg border border-line bg-paper px-3 text-ink shadow-soft outline-none" />
              <button onClick={() => act("points", { amountPence: Math.round(parseFloat(amount) * 100) })} disabled={busy || !(parseFloat(amount) > 0)} className={btn} style={{ background: accent }}>Add points</button>
            </div>
          )}
          {data.ready_reward && (
            <button onClick={() => act("redeem_reward")} disabled={busy} className={btn} style={{ background: "#16a34a" }}>Give reward: {data.ready_reward.reward}</button>
          )}
          {data.offers.filter((o) => !o.claimed).map((o) => (
            <button key={o.id} onClick={() => act("redeem_offer", { offerId: o.id })} disabled={busy} className={btn} style={{ background: "#d97706" }}>Apply offer: {o.title} ({o.badge})</button>
          ))}

          <button onClick={reset} className="w-full py-2 text-sm font-bold text-ink-soft hover:text-ink">Next customer</button>
        </div>
      )}
    </div>
  );
}
