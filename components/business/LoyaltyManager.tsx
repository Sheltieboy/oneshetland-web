"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ, type LoyaltyProgram } from "@/lib/business-data";
import { upsertLoyaltyProgram } from "@/lib/business-client";
import { normalizeTiers, type RewardTier } from "@/lib/loyalty-ladder";

export function LoyaltyManager({ businessId, program }: { businessId: string; program: LoyaltyProgram | null }) {
  const router = useRouter();
  const initialTiers = normalizeTiers(program?.reward_tiers);
  const [type, setType] = useState<"stamps" | "points">(program?.type ?? "stamps");
  const [stampsRequired, setStampsRequired] = useState(String(initialTiers.length > 1 ? initialTiers[0].stamps : program?.stamps_required ?? 9));
  const [stampReward, setStampReward] = useState(initialTiers.length > 1 ? initialTiers[0].reward : program?.stamp_reward ?? "");
  // Optional extra ladder rungs above the base reward.
  const [extraTiers, setExtraTiers] = useState<RewardTier[]>(initialTiers.length > 1 ? initialTiers.slice(1) : []);
  const [perPound, setPerPound] = useState(String(program?.points_per_pound ?? 10));
  const [forPound, setForPound] = useState(String(program?.points_for_pound ?? 100));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null); setBusy(true);
    try {
      if (type === "stamps") {
        const tiers = normalizeTiers([{ stamps: Number(stampsRequired), reward: stampReward.trim() }, ...extraTiers]);
        if (extraTiers.length > 0 && tiers.length !== extraTiers.length + 1) {
          setError("Each reward tier needs a different stamp count and a reward."); setBusy(false); return;
        }
        const ladder = tiers.length > 1;
        await upsertLoyaltyProgram(businessId, {
          type,
          // Headline = top rung, so single-reward readers still show something.
          stamps_required: ladder ? tiers[tiers.length - 1].stamps : Number(stampsRequired) || null,
          stamp_reward: ladder ? tiers[tiers.length - 1].reward : stampReward.trim() || null,
          reward_tiers: ladder ? tiers : null,
          points_per_pound: null, points_for_pound: null,
        });
      } else {
        await upsertLoyaltyProgram(businessId, { type, points_per_pound: Number(perPound) || null, points_for_pound: Number(forPound) || null, stamps_required: null, stamp_reward: null, reward_tiers: null });
      }
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

          {/* Reward ladder — optional higher rungs; stamps accumulate up to the top. */}
          {extraTiers.map((t, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-line bg-sand/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-soft">Reward {i + 2}</span>
                <button type="button" onClick={() => { setExtraTiers((p) => p.filter((_, j) => j !== i)); setSaved(false); }} className="text-sm font-semibold text-rose-600 hover:underline">Remove</button>
              </div>
              <div><label className={lab}>At how many stamps</label><input className={field} type="number" placeholder={String((Number(stampsRequired) || 5) * (i + 2))} value={t.stamps || ""} onChange={(e) => { const v = Number(e.target.value) || 0; setExtraTiers((p) => p.map((x, j) => (j === i ? { ...x, stamps: v } : x))); setSaved(false); }} /></div>
              <div><label className={lab}>What they get</label><input className={field} placeholder="e.g. Free lunch" value={t.reward} onChange={(e) => { const v = e.target.value; setExtraTiers((p) => p.map((x, j) => (j === i ? { ...x, reward: v } : x))); setSaved(false); }} /></div>
            </div>
          ))}
          <button type="button" onClick={() => { setExtraTiers((p) => [...p, { stamps: 0, reward: "" }]); setSaved(false); }} className="text-sm font-bold" style={{ color: BIZ }}>+ Add another reward tier</button>
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
