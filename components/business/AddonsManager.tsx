"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BIZ, ADDON_META, PREMIUM_ADDON_KEYS, STANDARD_ADDON_KEYS, EXTRA_ADDON_MONTHLY_PENCE,
  countExtraPremiumAddons, tierMeets, type AddonKey, type BusinessAddon, type SubscriptionTier,
} from "@/lib/business-data";
import { toggleAddon, syncBusinessAddons } from "@/lib/business-client";

export function AddonsManager({ businessId, addons, tier }: { businessId: string; addons: BusinessAddon[]; tier: SubscriptionTier }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const premium = tierMeets(tier, "premium");
  const map = Object.fromEntries(addons.map((a) => [a.addon_key, a]));
  const extra = countExtraPremiumAddons(addons);

  async function flip(key: AddonKey, enabled: boolean) {
    setBusy(key); setError(null);
    try {
      await toggleAddon(businessId, key, enabled);
      // Reconcile billing (adds/removes the £10/mo add-on line item). Best-effort:
      // the toggle itself already saved; surface a note if billing didn't update.
      try { await syncBusinessAddons(businessId); } catch (e) { setError(e instanceof Error ? `Saved, but billing didn't update: ${e.message}` : "Saved, but billing didn't update."); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); } finally { setBusy(null); }
  }

  function Row({ k }: { k: AddonKey }) {
    const meta = ADDON_META[k];
    const on = !!map[k]?.enabled;
    const locked = meta.isPremium && !premium;
    return (
      <div className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
        <div className="flex min-w-0 items-start gap-3">
          <span className="text-xl">{meta.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{meta.label} {meta.isPremium && <span className="rounded-pill bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-muted">{locked ? "Premium" : "Premium add-on"}</span>}</p>
            <p className="text-xs text-ink-muted">{meta.description}</p>
          </div>
        </div>
        <button type="button" disabled={locked || busy === k} onClick={() => flip(k, !on)} className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-40" style={{ background: on ? BIZ : "var(--color-line-strong)" }}>
          <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (on ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {!premium && <p className="rounded-card border border-line bg-paper p-4 text-sm text-ink-soft shadow-soft">🧩 Upgrade to <span className="font-semibold">Premium</span> to unlock Bookings, Services, Events, Membership and Products.</p>}
      {premium && extra > 0 && <p className="rounded-card border border-line bg-paper p-4 text-sm text-ink-soft shadow-soft">1 premium add-on included · {extra} extra at £{(EXTRA_ADDON_MONTHLY_PENCE / 100).toFixed(0)}/mo each (£{((extra * EXTRA_ADDON_MONTHLY_PENCE) / 100).toFixed(0)}/mo).</p>}

      <section className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-muted">Premium add-ons</p>
        {PREMIUM_ADDON_KEYS.map((k) => <Row key={k} k={k} />)}
      </section>
      <section className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-muted">Standard features</p>
        {STANDARD_ADDON_KEYS.map((k) => <Row key={k} k={k} />)}
      </section>
    </div>
  );
}
