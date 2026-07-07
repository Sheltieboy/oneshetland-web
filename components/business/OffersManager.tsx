"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BIZ, formatOfferDiscount, daysRemaining, type DiscountType, type LocalOffer } from "@/lib/business-data";
import { deactivateOffer } from "@/lib/business-client";

export function OffersManager({ businessId, offers }: { businessId: string; offers: LocalOffer[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", description: "", discount_type: "percent" as DiscountType, discount_value: "", valid_until: "", max_redemptions: "", terms: "" });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function create() {
    setError(null);
    if (!f.title.trim()) return setError("Give the offer a title.");
    if (!f.valid_until) return setError("Choose an end date.");
    setBusy(true);
    try {
      const sb = createClient();
      const { error: e } = await sb.from("local_offers").insert({
        business_id: businessId, title: f.title.trim(), description: f.description.trim() || null,
        discount_type: f.discount_type, discount_value: f.discount_value ? Number(f.discount_value) : null,
        valid_from: new Date().toISOString(), valid_until: new Date(f.valid_until).toISOString(),
        terms: f.terms.trim() || null, max_redemptions: f.max_redemptions ? Number(f.max_redemptions) : null, is_active: true,
      });
      if (e) throw e;
      setCreating(false); setF({ title: "", description: "", discount_type: "percent", discount_value: "", valid_until: "", max_redemptions: "", terms: "" }); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create offer."); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("End this offer?")) return;
    try { await deactivateOffer(id); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); }
  }

  const field = "w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint";

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {!creating ? (
        <button onClick={() => setCreating(true)} className="rounded-pill px-5 py-2.5 text-sm font-semibold text-white shadow-soft" style={{ background: BIZ }}>+ New offer</button>
      ) : (
        <div className="space-y-3 rounded-card border border-line bg-paper p-5 shadow-soft">
          <input className={field} placeholder="Offer title — e.g. 20% off coffee" value={f.title} onChange={(e) => set("title", e.target.value)} />
          <textarea className={field + " min-h-[70px]"} placeholder="Description (optional)" value={f.description} onChange={(e) => set("description", e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <select className={field} value={f.discount_type} onChange={(e) => set("discount_type", e.target.value)}>
              <option value="percent">% off</option><option value="fixed">£ off</option><option value="freebie">Freebie</option><option value="bogo">2 for 1</option><option value="other">Other</option>
            </select>
            {(f.discount_type === "percent" || f.discount_type === "fixed") && (
              <input className={field} type="number" step="any" placeholder={f.discount_type === "percent" ? "20" : "5.00"} value={f.discount_value} onChange={(e) => set("discount_value", e.target.value)} />
            )}
          </div>
          <div><label className="mb-1 block text-sm font-semibold text-ink-soft">Valid until</label><input className={field} type="date" value={f.valid_until} onChange={(e) => set("valid_until", e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-semibold text-ink-soft">Max redemptions (optional)</label><input className={field} type="number" min="1" step="1" placeholder="Leave blank for unlimited" value={f.max_redemptions} onChange={(e) => set("max_redemptions", e.target.value)} /></div>
          <textarea className={field + " min-h-[60px]"} placeholder="Terms (optional)" value={f.terms} onChange={(e) => set("terms", e.target.value)} />
          <div className="flex gap-2">
            <button onClick={create} disabled={busy} className="flex-1 rounded-pill py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BIZ }}>{busy ? "Creating…" : "Create offer"}</button>
            <button onClick={() => setCreating(false)} className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">Cancel</button>
          </div>
        </div>
      )}

      {offers.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-paper/60 px-5 py-8 text-center text-sm text-ink-muted">No active offers. Create one to appear in Local.</p>
      ) : (
        <div className="space-y-3">
          {offers.map((o) => (
            <div key={o.id} className="flex items-start justify-between gap-3 rounded-card border border-line bg-paper p-4 shadow-soft">
              <div className="min-w-0">
                <p className="font-bold text-ink">{o.title}</p>
                <p className="text-sm text-ink-muted">{formatOfferDiscount(o)} · {o.redemption_count}{o.max_redemptions ? `/${o.max_redemptions}` : ""} claim{o.redemption_count === 1 ? "" : "s"} · {daysRemaining(o.valid_until)}d left</p>
              </div>
              {o.is_active && <button onClick={() => remove(o.id)} className="shrink-0 rounded-pill border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">End</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
