"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOB_CATEGORIES, CONTRACT_LABELS, REMOTE_LABELS, type ContractType, type RemoteMode, type PayPeriod } from "@/lib/jobs-data";

const JOBS = "#2a8b5c";

type Biz = { id: string; name: string; logo_url: string | null };
type Existing = {
  id: string; posted_as_business_id: string | null; title: string; description: string;
  category: string; contract_type: ContractType; remote_mode: RemoteMode; location: string;
  pay_hidden: boolean; pay_min: number | null; pay_max: number | null; pay_period: PayPeriod; pay_text: string;
  relocation_support: boolean; housing_available: boolean; is_seasonal: boolean; season_label: string;
  apply_url: string; apply_email: string;
} | null;

const PERIODS: PayPeriod[] = ["hour", "day", "week", "month", "year"];
const EXPIRY = [{ label: "No close date", days: 0 }, { label: "30 days", days: 30 }, { label: "60 days", days: 60 }, { label: "90 days", days: 90 }];

export function JobPostForm({ isLoggedIn, businesses, existing }: { isLoggedIn: boolean; businesses: Biz[]; existing: Existing }) {
  const router = useRouter();
  const [bizId, setBizId] = useState(existing?.posted_as_business_id ?? businesses[0]?.id ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [contract, setContract] = useState<ContractType>(existing?.contract_type ?? "full-time");
  const [remote, setRemote] = useState<RemoteMode>(existing?.remote_mode ?? "on_site");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [payHidden, setPayHidden] = useState(existing?.pay_hidden ?? false);
  const [payMin, setPayMin] = useState(existing?.pay_min?.toString() ?? "");
  const [payMax, setPayMax] = useState(existing?.pay_max?.toString() ?? "");
  const [payPeriod, setPayPeriod] = useState<PayPeriod>(existing?.pay_period ?? "year");
  const [payText, setPayText] = useState(existing?.pay_text ?? "");
  const [relocation, setRelocation] = useState(existing?.relocation_support ?? false);
  const [housing, setHousing] = useState(existing?.housing_available ?? false);
  const [seasonal, setSeasonal] = useState(existing?.is_seasonal ?? false);
  const [seasonLabel, setSeasonLabel] = useState(existing?.season_label ?? "");
  const [expiryDays, setExpiryDays] = useState(0);
  const [applyUrl, setApplyUrl] = useState(existing?.apply_url ?? "");
  const [applyEmail, setApplyEmail] = useState(existing?.apply_email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
        <p className="font-display text-xl font-bold">Sign in to post a job</p>
        <p className="mt-2 text-ink-soft">You need a free OneShetland account to post.</p>
        <a href="/sign-in?next=/jobs/new" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-paper hover:brightness-95" style={{ background: JOBS }}>Sign in or create account</a>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="rounded-card border border-line bg-paper p-8 text-center shadow-soft">
        <p className="font-display text-xl font-bold">Add a business first</p>
        <p className="mx-auto mt-2 max-w-sm text-ink-soft">Jobs are posted by a business. Create your free business listing — it takes a minute and works right across OneShetland.</p>
        <a href="/directory/new" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-paper hover:brightness-95" style={{ background: JOBS }}>Register a business</a>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("A job title is required.");
    if (!bizId) return setError("Choose which business is hiring.");
    setError(null); setBusy(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const expires_at = expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400_000).toISOString() : null;
      const row = {
        posted_as_business_id: bizId,
        title: title.trim(),
        description: description.trim() || null,
        category: category || null,
        location: location.trim() || null,
        contract_type: contract,
        remote_mode: remote,
        pay_hidden: payHidden,
        pay_min: !payHidden && payMin ? Number(payMin) : null,
        pay_max: !payHidden && payMax ? Number(payMax) : null,
        pay_period: !payHidden ? payPeriod : null,
        pay_text: payHidden ? (payText.trim() || "Competitive") : null,
        relocation_support: relocation,
        housing_available: housing,
        is_seasonal: seasonal,
        season_label: seasonal ? (seasonLabel.trim() || null) : null,
        apply_url: applyUrl.trim() || null,
        apply_email: applyEmail.trim() || null,
      };
      if (existing) {
        const { error: dbErr } = await sb.from("jobs").update(row).eq("id", existing.id);
        if (dbErr) throw dbErr;
        router.push(`/jobs/${existing.id}`);
      } else {
        const { data, error: dbErr } = await sb.from("jobs")
          .insert({ employer_id: user.id, ...row }).select("id").single();
        if (dbErr) throw dbErr;
        router.push(`/jobs/${data.id}/applicants`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the job.");
      setBusy(false);
    }
  }

  const pill = (on: boolean) => "rounded-pill border px-4 py-1.5 text-sm font-semibold transition " + (on ? "text-paper" : "border-line bg-sand text-ink hover:border-line-strong");
  const pillStyle = (on: boolean) => on ? { background: JOBS, borderColor: JOBS } : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-card border border-line bg-paper p-6 shadow-soft sm:p-8">
      {businesses.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Posting as</p>
          <div className="flex flex-wrap gap-2">
            {businesses.map((b) => (
              <button key={b.id} type="button" onClick={() => setBizId(b.id)} className={pill(bizId === b.id)} style={pillStyle(bizId === b.id)}>{b.name}</button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-ink">Job title <span className="text-rose-500">*</span></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sous Chef, Deckhand, Care Assistant" className="auth-input mt-1.5" required />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="The role, responsibilities, who you're looking for, how to stand out…" className="auth-input mt-1.5 resize-none" />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Sector</p>
        <div className="flex flex-wrap gap-2">
          {JOB_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(category === c ? "" : c)} className={pill(category === c)} style={pillStyle(category === c)}>{c}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Contract</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CONTRACT_LABELS) as ContractType[]).map((c) => (
              <button key={c} type="button" onClick={() => setContract(c)} className={pill(contract === c)} style={pillStyle(contract === c)}>{CONTRACT_LABELS[c]}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Working</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(REMOTE_LABELS) as RemoteMode[]).map((r) => (
              <button key={r} type="button" onClick={() => setRemote(r)} className={pill(remote === r)} style={pillStyle(remote === r)}>{REMOTE_LABELS[r]}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lerwick, Yell, Scalloway" className="auth-input mt-1.5" />
      </div>

      {/* Pay */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Pay</p>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={payHidden} onChange={(e) => setPayHidden(e.target.checked)} />
            Hide salary
          </label>
        </div>
        {payHidden ? (
          <input value={payText} onChange={(e) => setPayText(e.target.value)} placeholder="e.g. Competitive, DOE" className="auth-input mt-2" />
        ) : (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={payMin} onChange={(e) => setPayMin(e.target.value)} placeholder="Min £" className="auth-input" />
              <input type="number" value={payMax} onChange={(e) => setPayMax(e.target.value)} placeholder="Max £" className="auth-input" />
            </div>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <button key={p} type="button" onClick={() => setPayPeriod(p)} className={pill(payPeriod === p)} style={pillStyle(payPeriod === p)}>per {p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={relocation} onChange={(e) => setRelocation(e.target.checked)} /> Relocation support</label>
        <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={housing} onChange={(e) => setHousing(e.target.checked)} /> Housing available</label>
        <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={seasonal} onChange={(e) => setSeasonal(e.target.checked)} /> Seasonal role</label>
      </div>
      {seasonal && (
        <input value={seasonLabel} onChange={(e) => setSeasonLabel(e.target.value)} placeholder="e.g. Summer 2026, May–Sept" className="auth-input" />
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Auto-close listing</p>
        <div className="flex flex-wrap gap-2">
          {EXPIRY.map((x) => (
            <button key={x.days} type="button" onClick={() => setExpiryDays(x.days)} className={pill(expiryDays === x.days)} style={pillStyle(expiryDays === x.days)}>{x.label}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-ink">Apply URL (optional)</label>
          <input type="url" value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://…" className="auth-input mt-1.5" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink">Apply email (optional)</label>
          <input type="email" value={applyEmail} onChange={(e) => setApplyEmail(e.target.value)} placeholder="jobs@…" className="auth-input mt-1.5" />
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <button type="submit" disabled={busy || !title.trim()} className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40" style={{ background: JOBS }}>
        {busy ? "Saving…" : existing ? "Save changes" : "Post job"}
      </button>
    </form>
  );
}
