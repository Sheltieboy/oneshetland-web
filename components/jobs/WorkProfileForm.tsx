"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const JOBS = "#2a8b5c";

type Initial = {
  headline: string; summary: string; skills: string; qualifications: string;
  desired_pay_text: string; willing_to_relocate: boolean; is_diaspora: boolean;
} | null;

export function WorkProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [skills, setSkills] = useState(initial?.skills ?? "");
  const [quals, setQuals] = useState(initial?.qualifications ?? "");
  const [pay, setPay] = useState(initial?.desired_pay_text ?? "");
  const [relocate, setRelocate] = useState(initial?.willing_to_relocate ?? false);
  const [diaspora, setDiaspora] = useState(initial?.is_diaspora ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true); setSaved(false);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      const { error: dbErr } = await sb.from("worker_profiles").upsert({
        user_id: user.id,
        headline: headline.trim() || null,
        summary: summary.trim() || null,
        skills: list(skills),
        qualifications: list(quals),
        desired_pay_text: pay.trim() || null,
        willing_to_relocate: relocate,
        is_diaspora: diaspora,
      }, { onConflict: "user_id" });
      if (dbErr) throw dbErr;
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-card border border-line bg-paper p-6 shadow-soft sm:p-8">
      <div>
        <label className="block text-sm font-semibold text-ink">Headline</label>
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Experienced chef · 8 years hospitality" className="auth-input mt-1.5" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">About you</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} placeholder="A short summary of your experience and what you're looking for." className="auth-input mt-1.5 resize-none" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">Skills</label>
        <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Comma separated — e.g. Food hygiene, Bar, Customer service" className="auth-input mt-1.5" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">Qualifications</label>
        <input value={quals} onChange={(e) => setQuals(e.target.value)} placeholder="Comma separated — e.g. STCW, First aid, Driving licence" className="auth-input mt-1.5" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">Pay expectation (optional)</label>
        <input value={pay} onChange={(e) => setPay(e.target.value)} placeholder="e.g. £13/hr, negotiable" className="auth-input mt-1.5" />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={relocate} onChange={(e) => setRelocate(e.target.checked)} /> Willing to relocate</label>
        <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={diaspora} onChange={(e) => setDiaspora(e.target.checked)} /> I'm a Shetlander living away</label>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Profile saved ✓</p>}

      <button type="submit" disabled={busy} className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40" style={{ background: JOBS }}>
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
