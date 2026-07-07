"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SHIFTS = "#E8A020";

type Initial = { business_name: string; description: string } | null;

export function EmployerProfileForm({ initial, fallbackName }: { initial: Initial; fallbackName: string }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(initial?.business_name ?? fallbackName ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaved(false);
    if (!businessName.trim()) { setError("Please enter a business or trading name."); return; }
    setBusy(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const { error: dbErr } = await sb.from("shift_employer_profiles").upsert({
        id: user.id,
        business_name: businessName.trim(),
        description: description.trim() || null,
        is_verified: false,
        logo_url: null,
      }, { onConflict: "id" });
      if (dbErr) throw dbErr;
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your business profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-card border border-line bg-paper p-6 shadow-soft sm:p-8">
      <div className="flex items-start gap-3 rounded-lg border-l-4 px-4 py-3" style={{ borderColor: SHIFTS, background: `${SHIFTS}14` }}>
        <p className="text-sm text-ink-soft">This is what workers see on your shift listings. A clear business name and short description helps people trust your postings.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">Business / trading name</label>
        <p className="text-sm text-ink-muted">The name shown on all your shift cards.</p>
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Lerwick Hotel, Shetland Fish Ltd…" className="auth-input mt-1.5" />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">About your business</label>
        <p className="text-sm text-ink-muted">Optional. A line or two about what your business does — helps workers decide if it&apos;s the right fit.</p>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="e.g. Family-run hotel in the heart of Lerwick, operating since 1978. We offer flexible shifts across hospitality and kitchen roles." className="auth-input mt-1.5 resize-none" />
      </div>

      <div className="rounded-lg bg-sand/60 px-4 py-3 text-sm text-ink-muted">
        Verified badges are awarded manually. Contact OneShetland to request verification for your business.
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Business profile saved ✓</p>}

      <button type="submit" disabled={busy} className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40" style={{ background: SHIFTS }}>
        {busy ? "Saving…" : "Save business profile"}
      </button>
    </form>
  );
}
