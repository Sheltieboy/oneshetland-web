"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SHIFT_CATEGORY_LABELS } from "@/lib/jobs-data";

const SHIFTS = "#e8a020";

type Initial = {
  bio: string; experience_summary: string; skills: string; qualifications: string;
  hourly_rate_min: string; hourly_rate_max: string;
  is_open_to_work: boolean; open_to_categories: string[];
} | null;

export function ShiftWorkerProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [experience, setExperience] = useState(initial?.experience_summary ?? "");
  const [skills, setSkills] = useState(initial?.skills ?? "");
  const [quals, setQuals] = useState(initial?.qualifications ?? "");
  const [rateMin, setRateMin] = useState(initial?.hourly_rate_min ?? "");
  const [rateMax, setRateMax] = useState(initial?.hourly_rate_max ?? "");
  const [open, setOpen] = useState(initial?.is_open_to_work ?? false);
  const [cats, setCats] = useState<string[]>(initial?.open_to_categories ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleCat = (key: string) =>
    setCats((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true); setSaved(false);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      // Writes the UNIFIED worker_profiles row (shared with Jobs). `bio` maps to
      // the canonical `summary` column.
      const { error: dbErr } = await sb.from("worker_profiles").upsert({
        user_id: user.id,
        summary: bio.trim() || null,
        experience_summary: experience.trim() || null,
        skills: list(skills),
        qualifications: list(quals),
        hourly_rate_min: rateMin ? parseFloat(rateMin) : null,
        hourly_rate_max: rateMax ? parseFloat(rateMax) : null,
        is_open_to_work: open,
        open_to_categories: cats,
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
        <label className="block text-sm font-semibold text-ink">About you</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="A short intro employers see when you apply for a shift." className="auth-input mt-1.5 resize-none" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">Experience</label>
        <textarea value={experience} onChange={(e) => setExperience(e.target.value)} rows={4} placeholder="Relevant experience — roles, venues, years." className="auth-input mt-1.5 resize-none" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">Skills</label>
        <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Comma separated — e.g. Bar, Food hygiene, Cash handling" className="auth-input mt-1.5" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">Qualifications</label>
        <input value={quals} onChange={(e) => setQuals(e.target.value)} placeholder="Comma separated — e.g. First aid, PA licence, Driving licence" className="auth-input mt-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-ink">Pay expected — from (£/hr)</label>
          <input value={rateMin} onChange={(e) => setRateMin(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="12" className="auth-input mt-1.5" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink">to (£/hr)</label>
          <input value={rateMax} onChange={(e) => setRateMax(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="16" className="auth-input mt-1.5" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">Open to these kinds of shift</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(SHIFT_CATEGORY_LABELS).map(([key, label]) => {
            const on = cats.includes(key);
            return (
              <button type="button" key={key} onClick={() => toggleCat(key)}
                className={"rounded-pill border px-3 py-1.5 text-sm font-semibold transition " + (on ? "text-paper" : "border-line-strong text-ink-soft hover:bg-sand")}
                style={on ? { background: SHIFTS, borderColor: SHIFTS } : undefined}>
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="h-5 w-5" style={{ accentColor: SHIFTS }} />
        <span className="text-sm text-ink-soft">I&apos;m open to work — show me to employers looking for shift workers</span>
      </label>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Profile saved ✓</p>}

      <button type="submit" disabled={busy} className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40" style={{ background: SHIFTS }}>
        {busy ? "Saving…" : "Save shift profile"}
      </button>
    </form>
  );
}
