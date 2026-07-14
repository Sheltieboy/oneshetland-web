"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const JOBS = "#2a8b5c";

type Snapshot = {
  headline: string | null;
  summary: string | null;
  skills: string[];
  qualifications: string[];
  willing_to_relocate: boolean;
} | null;

export function JobApplyPanel({
  jobId, isLoggedIn, alreadyApplied, isSaved, snapshot,
}: {
  jobId: string; isLoggedIn: boolean; alreadyApplied: boolean; isSaved: boolean; snapshot: Snapshot;
}) {
  const router = useRouter();
  const [applied, setApplied] = useState(alreadyApplied);
  const [saved, setSaved] = useState(isSaved);
  const [open, setOpen] = useState(false);
  const [cover, setCover] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="font-display font-bold text-ink">Apply for this job</p>
        <p className="mt-1 text-sm text-ink-soft">Sign in to apply in one tap and track your applications.</p>
        <a href={`/sign-in?next=/jobs/${jobId}`} className="mt-4 block rounded-pill px-4 py-2.5 text-center text-sm font-semibold text-paper transition hover:brightness-95" style={{ background: JOBS }}>
          Sign in to apply
        </a>
      </div>
    );
  }

  async function toggleSave() {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    if (saved) {
      await sb.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", jobId);
      setSaved(false);
    } else {
      await sb.from("saved_jobs").insert({ user_id: user.id, job_id: jobId });
      setSaved(true);
    }
  }

  // Best-effort AI cover-note draft — mirrors the app's ai-cover-letter invoke.
  // Body: { job_id }, response: { cover_letter }. On any failure, leave the
  // textarea editable and say nothing loud.
  async function draftAi() {
    setAiBusy(true);
    try {
      const sb = createClient();
      const { data, error: fnErr } = await sb.functions.invoke("ai-cover-letter", { body: { job_id: jobId } });
      if (fnErr) return;
      const text = (data?.cover_letter as string) ?? "";
      if (text) setCover(text);
    } catch {
      /* best-effort — leave the note as-is */
    } finally {
      setAiBusy(false);
    }
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const { data: appRow, error: dbErr } = await sb.from("job_applications").insert({
        job_id: jobId,
        applicant_id: user.id,
        cover_letter: cover.trim() || null,
        profile_snapshot: snapshot ?? {},
      }).select("id").single();
      if (dbErr) throw dbErr;
      // Notify the employer (same edge fn the app uses).
      if (appRow?.id) sb.functions.invoke("notify-job", { body: { event: "application", application_id: appRow.id } }).catch(() => {});
      setApplied(true);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit application.");
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="font-display font-bold" style={{ color: JOBS }}>✓ Application sent</p>
        <p className="mt-1 text-sm text-ink-soft">The employer can now see your profile. Track progress in your applications.</p>
        <a href="/jobs/applications" className="mt-4 block rounded-pill border border-line-strong px-4 py-2.5 text-center text-sm font-semibold text-ink hover:bg-sand">
          My applications
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <p className="font-display font-bold text-ink">Apply for this job</p>
      {!snapshot && (
        <p className="mt-1 text-xs text-ink-muted">
          Tip: <a href="/work-profile" className="font-semibold underline">complete your profile</a> so employers see your skills.
        </p>
      )}

      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-4 block w-full rounded-pill px-4 py-2.5 text-center text-sm font-semibold text-paper transition hover:brightness-95" style={{ background: JOBS }}>
          Apply now
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">Cover note (optional)</span>
            <button
              type="button"
              onClick={draftAi}
              disabled={aiBusy}
              className="inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-semibold disabled:opacity-40"
              style={{ color: JOBS, background: `${JOBS}14` }}
            >
              {aiBusy ? "Drafting…" : "✨ Draft with AI"}
            </button>
          </div>
          <textarea
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            rows={5}
            placeholder="Add a short cover note (optional) — why you're a good fit."
            className="auth-input resize-none"
          />
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
          <button onClick={submit} disabled={busy} className="block w-full rounded-pill px-4 py-2.5 text-center text-sm font-semibold text-paper transition hover:brightness-95 disabled:opacity-40" style={{ background: JOBS }}>
            {busy ? "Sending…" : "Submit application"}
          </button>
          <button onClick={() => setOpen(false)} className="block w-full text-center text-xs font-semibold text-ink-muted hover:text-ink">Cancel</button>
        </div>
      )}

      <button onClick={toggleSave} className="mt-3 block w-full rounded-pill border border-line-strong px-4 py-2.5 text-center text-sm font-semibold text-ink hover:bg-sand">
        {saved ? "★ Saved" : "☆ Save job"}
      </button>
    </div>
  );
}
