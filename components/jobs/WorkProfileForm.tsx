"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SHIFT_CATEGORY_LABELS, URGENCY_CONFIG, type Urgency } from "@/lib/jobs-data";

const JOBS = "#2a8b5c";
const SHIFTS = "#e8a020";

const URGENCY_KEYS = Object.keys(URGENCY_CONFIG) as Urgency[];

type Initial = {
  headline: string; summary: string; skills: string; qualifications: string;
  desired_pay_text: string; willing_to_relocate: boolean; is_diaspora: boolean;
  experience_summary: string; hourly_rate_min: string; hourly_rate_max: string;
  alertActive: boolean; alertCategories: string[]; alertUrgency: string[]; alertMinPay: string;
} | null;

export function WorkProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  // About you
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [skills, setSkills] = useState(initial?.skills ?? "");
  const [quals, setQuals] = useState(initial?.qualifications ?? "");
  // For jobs
  const [pay, setPay] = useState(initial?.desired_pay_text ?? "");
  const [relocate, setRelocate] = useState(initial?.willing_to_relocate ?? false);
  const [diaspora, setDiaspora] = useState(initial?.is_diaspora ?? false);
  // For shifts
  const [experience, setExperience] = useState(initial?.experience_summary ?? "");
  const [rateMin, setRateMin] = useState(initial?.hourly_rate_min ?? "");
  const [rateMax, setRateMax] = useState(initial?.hourly_rate_max ?? "");
  // Shift alerts
  const [alertActive, setAlertActive] = useState(initial?.alertActive ?? false);
  const [alertCats, setAlertCats] = useState<string[]>(initial?.alertCategories ?? []);
  const [alertUrgency, setAlertUrgency] = useState<string[]>(initial?.alertUrgency ?? []);
  const [alertMinPay, setAlertMinPay] = useState(initial?.alertMinPay ?? "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (key: string) =>
    setter((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  const toggleCat = toggle(setAlertCats);
  const toggleUrgency = toggle(setAlertUrgency);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true); setSaved(false);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

      // Unified worker_profiles row — jobs fields + shift fields in one write.
      const { error: dbErr } = await sb.from("worker_profiles").upsert({
        user_id: user.id,
        headline: headline.trim() || null,
        summary: summary.trim() || null,
        skills: list(skills),
        qualifications: list(quals),
        desired_pay_text: pay.trim() || null,
        willing_to_relocate: relocate,
        is_diaspora: diaspora,
        experience_summary: experience.trim() || null,
        hourly_rate_min: rateMin ? parseFloat(rateMin) : null,
        hourly_rate_max: rateMax ? parseFloat(rateMax) : null,
      }, { onConflict: "user_id" });
      if (dbErr) throw dbErr;

      // Shift alert preferences live in their own row (one per user).
      const { error: alertErr } = await sb.from("shift_alerts").upsert({
        user_id: user.id,
        is_active: alertActive,
        categories: alertCats,
        urgency: alertUrgency,
        min_pay: alertMinPay ? parseFloat(alertMinPay) : null,
      }, { onConflict: "user_id" });
      if (alertErr) throw alertErr;

      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  const sectionCard = "space-y-5 rounded-card border border-line bg-paper p-6 shadow-soft sm:p-8";
  const sectionHead = (title: string, blurb: string, color: string) => (
    <div>
      <h2 className="font-display text-xl font-bold" style={{ color }}>{title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{blurb}</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1 — About you */}
      <section className={sectionCard}>
        {sectionHead("About you", "The basics every employer sees.", JOBS)}
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
      </section>

      {/* 2 — For jobs */}
      <section className={sectionCard}>
        {sectionHead("For jobs", "Shown when you apply for a job.", JOBS)}
        <div>
          <label className="block text-sm font-semibold text-ink">Pay expectation (optional)</label>
          <input value={pay} onChange={(e) => setPay(e.target.value)} placeholder="e.g. £13/hr, negotiable" className="auth-input mt-1.5" />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={relocate} onChange={(e) => setRelocate(e.target.checked)} /> Willing to relocate</label>
          <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={diaspora} onChange={(e) => setDiaspora(e.target.checked)} /> I'm a Shetlander living away</label>
        </div>
      </section>

      {/* 3 — For shifts */}
      <section className={sectionCard}>
        {sectionHead("For shifts", "Shown when you apply for a short shift.", SHIFTS)}
        <div>
          <label className="block text-sm font-semibold text-ink">Experience</label>
          <textarea value={experience} onChange={(e) => setExperience(e.target.value)} rows={4} placeholder="Relevant experience — roles, venues, years." className="auth-input mt-1.5 resize-none" />
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
      </section>

      {/* 4 — Notify me of matching shifts (shift_alerts) */}
      <section className={sectionCard}>
        {sectionHead("Notify me of matching shifts", "Get a nudge when a shift matching your preferences is posted.", SHIFTS)}
        <label className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
          <input type="checkbox" checked={alertActive} onChange={(e) => setAlertActive(e.target.checked)} className="h-5 w-5" style={{ accentColor: SHIFTS }} />
          <span className="text-sm text-ink-soft">Alerts on — notify me about new matching shifts</span>
        </label>
        <div>
          <label className="block text-sm font-semibold text-ink">Categories</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(SHIFT_CATEGORY_LABELS).map(([key, label]) => {
              const on = alertCats.includes(key);
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
        <div>
          <label className="block text-sm font-semibold text-ink">Urgency</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {URGENCY_KEYS.map((key) => {
              const on = alertUrgency.includes(key);
              return (
                <button type="button" key={key} onClick={() => toggleUrgency(key)}
                  className={"rounded-pill border px-3 py-1.5 text-sm font-semibold transition " + (on ? "text-paper" : "border-line-strong text-ink-soft hover:bg-sand")}
                  style={on ? { background: SHIFTS, borderColor: SHIFTS } : undefined}>
                  {URGENCY_CONFIG[key].label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink">Minimum pay (£/hr)</label>
          <input value={alertMinPay} onChange={(e) => setAlertMinPay(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="e.g. 14" className="auth-input mt-1.5" />
        </div>
      </section>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Profile saved ✓</p>}

      <button type="submit" disabled={busy} className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40" style={{ background: JOBS }}>
        {busy ? "Saving…" : "Save work profile"}
      </button>
    </form>
  );
}
