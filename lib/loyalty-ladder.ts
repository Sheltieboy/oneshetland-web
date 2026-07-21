/**
 * Reward-ladder helpers — the web mirror of the app's ladderState (oneshetland-
 * delivers/lib/local-api.ts). A stamp programme may carry `reward_tiers`: rungs
 * the customer unlocks at rising stamp counts (accumulate model — stamps keep
 * counting; each tier is claimed as it's passed; the card resets at the top).
 * Null/empty tiers = single-reward mode, so every caller stays backward-compatible.
 */

export type RewardTier = { stamps: number; reward: string };

export function normalizeTiers(raw: unknown): RewardTier[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => ({ stamps: Number((t as RewardTier)?.stamps), reward: String((t as RewardTier)?.reward ?? "").trim() }))
    .filter((t) => Number.isFinite(t.stamps) && t.stamps > 0)
    .sort((a, b) => a.stamps - b.stamps);
}

export interface LadderState {
  tiers: RewardTier[];
  top: number;
  ready: RewardTier | null;   // reached but unclaimed — redeem this now
  next: RewardTier | null;    // the next rung still to reach
}

export function ladderState(
  rewardTiers: unknown,
  stampsCollected: number,
  redeemedUpto: number,
): LadderState | null {
  const tiers = normalizeTiers(rewardTiers);
  if (tiers.length === 0) return null;
  const top = tiers[tiers.length - 1].stamps;
  const ready = tiers.find((t) => t.stamps <= stampsCollected && t.stamps > redeemedUpto) ?? null;
  const next = tiers.find((t) => t.stamps > stampsCollected) ?? null;
  return { tiers, top, ready, next };
}
