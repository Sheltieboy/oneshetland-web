"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMembershipType, deleteMembershipType } from "@/lib/hubs-client";
import { membershipPrice, type HubMembershipType, type MembershipPeriod } from "@/lib/hubs-data";

export function TiersManager({ hubId, tiers, accent }: { hubId: string; tiers: HubMembershipType[]; accent: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [period, setPeriod] = useState<MembershipPeriod>("year");
  const [benefits, setBenefits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the tier a name.");
    setError(null);
    setBusy(true);
    try {
      await createMembershipType(hubId, {
        name: name.trim(),
        description: description.trim() || undefined,
        price_pence: Math.round((parseFloat(price) || 0) * 100),
        period,
        benefits: benefits.trim() || undefined,
      });
      setName(""); setDescription(""); setPrice(""); setBenefits("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add tier.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-sand/50 px-4 py-3 text-sm text-ink-soft">
        Paid tiers need a connected payout account. Set one up in the OneShetland app
        (Hub → payouts); free tiers work straight away.
      </p>

      {tiers.length > 0 && (
        <ul className="space-y-2">
          {tiers.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
              <div>
                <span className="font-semibold text-ink">{t.name}</span>
                <span className="ml-2 text-sm" style={{ color: accent }}>{membershipPrice(t.price_pence, t.period)}</span>
                {t.description && <p className="text-sm text-ink-muted">{t.description}</p>}
              </div>
              <button onClick={async () => { await deleteMembershipType(t.id); router.refresh(); }}
                className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink hover:bg-sand">Remove</button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Add a tier</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tier name (e.g. Adult)" className="auth-input" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who is it for? (optional)" className="auth-input" />
        <div className="grid grid-cols-2 gap-2">
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Price £ (0 = free)" className="auth-input" />
          <select value={period} onChange={(e) => setPeriod(e.target.value as MembershipPeriod)} className="auth-input">
            <option value="year">per year</option>
            <option value="month">per month</option>
            <option value="once">one-off</option>
          </select>
        </div>
        <textarea value={benefits} onChange={(e) => setBenefits(e.target.value)} rows={3} placeholder="Benefits, one per line (optional)" className="auth-input" />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-pill px-5 py-2.5 font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>
          {busy ? "Adding…" : "Add tier"}
        </button>
      </form>
    </div>
  );
}
