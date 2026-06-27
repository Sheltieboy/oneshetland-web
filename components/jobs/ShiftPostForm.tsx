"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  SHIFT_CATEGORY_LABELS, SHIFT_PAY_TYPES, SHIFT_REQUIREMENTS, URGENCY_CONFIG,
  type PayType, type Urgency,
} from "@/lib/jobs-data";

const SHIFTS = "#e8a020";
type Biz = { id: string; name: string; logo_url: string | null };

export function ShiftPostForm({ isLoggedIn, businesses, defaultName }: { isLoggedIn: boolean; businesses: Biz[]; defaultName: string }) {
  const router = useRouter();
  const [bizId, setBizId] = useState<string>(businesses[0]?.id ?? "");
  const [employerName, setEmployerName] = useState(defaultName);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("hospitality");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("this_week");
  const [payType, setPayType] = useState<PayType>("hourly");
  const [payAmount, setPayAmount] = useState("");
  const [positions, setPositions] = useState(1);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
        <p className="font-display text-xl font-bold">Sign in to post a shift</p>
        <a href="/sign-in?next=/shifts/new" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-paper hover:brightness-95" style={{ background: SHIFTS }}>Sign in or create account</a>
      </div>
    );
  }

  function toggleReq(r: string) {
    setRequirements((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("A shift title is required.");
    if (!location.trim()) return setError("Add a location.");
    if (!startAt || !endAt) return setError("Add start and end date/time.");
    if (new Date(endAt) <= new Date(startAt)) return setError("End time must be after the start time.");
    if (!bizId && !employerName.trim()) return setError("Add the employer/business name.");
    setError(null); setBusy(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");

      // No linked business → ensure a shift employer profile for branding.
      if (!bizId) {
        await sb.from("shift_employer_profiles").upsert(
          { id: user.id, business_name: employerName.trim(), is_verified: false },
          { onConflict: "id" },
        );
      }

      const { data, error: dbErr } = await sb.from("shifts").insert({
        employer_id: user.id,
        posted_as_business_id: bizId || null,
        title: title.trim(),
        description: description.trim() || null,
        category,
        location_text: location.trim(),
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        pay_type: payType,
        pay_amount: (payType === "hourly" || payType === "fixed") && payAmount ? Number(payAmount) : null,
        positions_total: positions,
        positions_filled: 0,
        requirements,
        urgency,
        status: "open",
      }).select("id").single();
      if (dbErr) throw dbErr;
      // Alert workers whose saved alert matches (same edge fn the app uses).
      if (data?.id) sb.functions.invoke("notify-matching-workers", { body: { shift_id: data.id } }).catch(() => {});
      router.push(`/shifts/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post the shift.");
      setBusy(false);
    }
  }

  const pill = (on: boolean) => "rounded-pill border px-4 py-1.5 text-sm font-semibold transition " + (on ? "text-paper" : "border-line bg-sand text-ink hover:border-line-strong");
  const pillStyle = (on: boolean) => on ? { background: SHIFTS, borderColor: SHIFTS } : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-card border border-line bg-paper p-6 shadow-soft sm:p-8">
      {/* Employer */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Posting as</p>
        {businesses.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {businesses.map((b) => (
              <button key={b.id} type="button" onClick={() => setBizId(b.id)} className={pill(bizId === b.id)} style={pillStyle(bizId === b.id)}>{b.name}</button>
            ))}
            <button type="button" onClick={() => setBizId("")} className={pill(bizId === "")} style={pillStyle(bizId === "")}>Use my name</button>
          </div>
        ) : null}
        {(!businesses.length || bizId === "") && (
          <input value={employerName} onChange={(e) => setEmployerName(e.target.value)} placeholder="Employer / business name" className="auth-input mt-2" />
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">Shift title <span className="text-rose-500">*</span></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bar staff for the weekend, Deckhand cover" className="auth-input mt-1.5" required />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Type of work</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SHIFT_CATEGORY_LABELS).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setCategory(key)} className={pill(category === key)} style={pillStyle(category === key)}>{label}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">Location <span className="text-rose-500">*</span></label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lerwick, Scalloway harbour" className="auth-input mt-1.5" required />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-ink">Starts <span className="text-rose-500">*</span></label>
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="auth-input mt-1.5" required />
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink">Ends <span className="text-rose-500">*</span></label>
          <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="auth-input mt-1.5" required />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Urgency</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(URGENCY_CONFIG) as Urgency[]).map((u) => (
            <button key={u} type="button" onClick={() => setUrgency(u)} className={pill(urgency === u)} style={pillStyle(urgency === u)}>{URGENCY_CONFIG[u].label}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Pay</p>
        <div className="flex flex-wrap gap-2">
          {SHIFT_PAY_TYPES.map((p) => (
            <button key={p.value} type="button" onClick={() => setPayType(p.value)} className={pill(payType === p.value)} style={pillStyle(payType === p.value)}>{p.label}</button>
          ))}
        </div>
        {(payType === "hourly" || payType === "fixed") && (
          <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={payType === "hourly" ? "£ per hour" : "£ total"} className="auth-input mt-2" />
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Positions</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setPositions(n)} className={pill(positions === n)} style={pillStyle(positions === n)}>{n === 5 ? "5+" : n}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Requirements (optional)</p>
        <div className="flex flex-wrap gap-2">
          {SHIFT_REQUIREMENTS.map((r) => (
            <button key={r} type="button" onClick={() => toggleReq(r)} className={pill(requirements.includes(r))} style={pillStyle(requirements.includes(r))}>{r}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">Additional details (optional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Anything else workers should know." className="auth-input mt-1.5 resize-none" />
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <button type="submit" disabled={busy || !title.trim()} className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40" style={{ background: SHIFTS }}>
        {busy ? "Posting…" : "Post shift"}
      </button>
    </form>
  );
}
