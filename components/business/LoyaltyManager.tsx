"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ, type LoyaltyProgram } from "@/lib/business-data";
import { upsertLoyaltyProgram } from "@/lib/business-client";

export function LoyaltyManager({ businessId, program }: { businessId: string; program: LoyaltyProgram | null }) {
  const router = useRouter();
  const [type, setType] = useState<"stamps" | "points">(program?.type ?? "stamps");
  const [stampsRequired, setStampsRequired] = useState(String(program?.stamps_required ?? 9));
  const [stampReward, setStampReward] = useState(program?.stamp_reward ?? "");
  const [perPound, setPerPound] = useState(String(program?.points_per_pound ?? 10));
  const [forPound, setForPound] = useState(String(program?.points_for_pound ?? 100));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null); setBusy(true);
    try {
      await upsertLoyaltyProgram(businessId, type === "stamps"
        ? { type, stamps_required: Number(stampsRequired) || null, stamp_reward: stampReward.trim() || null, points_per_pound: null, points_for_pound: null }
        : { type, points_per_pound: Number(perPound) || null, points_for_pound: Number(forPound) || null, stamps_required: null, stamp_reward: null });
      setSaved(true); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); }
  }

  const field = "w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint";
  const lab = "mb-1 block text-sm font-semibold text-ink-soft";

  return (
    <div className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft">
      <div className="inline-flex gap-1 rounded-pill bg-sand p-1">
        {(["stamps", "points"] as const).map((t) => (
          <button key={t} onClick={() => { setType(t); setSaved(false); }} className={"rounded-pill px-4 py-1.5 text-sm font-semibold capitalize transition " + (type === t ? "text-white" : "text-ink-soft")} style={type === t ? { background: BIZ } : undefined}>{t}</button>
        ))}
      </div>

      {type === "stamps" ? (
        <>
          <div><label className={lab}>Stamps to collect</label><input className={field} type="number" value={stampsRequired} onChange={(e) => { setStampsRequired(e.target.value); setSaved(false); }} /></div>
          <div><label className={lab}>Reward</label><input className={field} placeholder="e.g. Free coffee of your choice" value={stampReward} onChange={(e) => { setStampReward(e.target.value); setSaved(false); }} /></div>
        </>
      ) : (
        <>
          <div><label className={lab}>Points earned per £1 spent</label><input className={field} type="number" step="any" value={perPound} onChange={(e) => { setPerPound(e.target.value); setSaved(false); }} /></div>
          <div><label className={lab}>Points needed for £1 off</label><input className={field} type="number" value={forPound} onChange={(e) => { setForPound(e.target.value); setSaved(false); }} /></div>
        </>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-95 disabled:opacity-50" style={{ background: BIZ }}>{busy ? "Saving…" : saved ? "Saved ✓" : program ? "Update programme" : "Set up programme"}</button>
    </div>
  );
}
