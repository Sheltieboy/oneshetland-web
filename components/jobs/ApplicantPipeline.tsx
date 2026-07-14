"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type JobApplication, type JobAppStatus, JOB_APP_STATUS_LABELS, PIPELINE_STAGES } from "@/lib/jobs-data";

const JOBS = "#2a8b5c";
const FILTERS: (JobAppStatus | "all")[] = ["all", "applied", "shortlisted", "interview", "offer", "hired", "declined"];

export function ApplicantPipeline({ applicants }: { applicants: JobApplication[] }) {
  const [apps, setApps] = useState(applicants);
  const [filter, setFilter] = useState<JobAppStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function move(appId: string, status: JobAppStatus) {
    setBusyId(appId);
    try {
      const sb = createClient();
      await sb.from("job_applications").update({ status }).eq("id", appId);
      // Notify the applicant (origin-agnostic with the app — same edge fn).
      sb.functions.invoke("notify-job", { body: { event: "status", application_id: appId, status } }).catch(() => {});
      setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
    } finally { setBusyId(null); }
  }

  const counts = apps.reduce<Record<string, number>>((m, a) => { m[a.status] = (m[a.status] ?? 0) + 1; return m; }, {});
  const visible = filter === "all" ? apps.filter((a) => a.status !== "withdrawn") : apps.filter((a) => a.status === filter);

  return (
    <div>
      <div className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const n = f === "all" ? apps.filter((a) => a.status !== "withdrawn").length : counts[f] ?? 0;
          const on = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} className={"shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition " + (on ? "text-paper" : "border border-line-strong text-ink-soft hover:bg-sand")} style={on ? { background: JOBS } : undefined}>
              {f === "all" ? "All" : JOB_APP_STATUS_LABELS[f]} {n > 0 && <span className="opacity-70">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {visible.map((a) => {
          const snap = (a.profile_snapshot ?? {}) as { headline?: string; summary?: string; skills?: string[]; qualifications?: string[]; willing_to_relocate?: boolean };
          const name = a.applicant?.display_name || a.applicant?.full_name || "Applicant";
          const idx = PIPELINE_STAGES.indexOf(a.status);
          const open = openId === a.id;
          const closed = a.status === "hired" || a.status === "declined" || a.status === "withdrawn";
          return (
            <div key={a.id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
              <button onClick={() => setOpenId(open ? null : a.id)} className="flex w-full items-start gap-3 text-left">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-line bg-sand">
                  {a.applicant?.avatar_url ? <img src={a.applicant.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center font-display font-bold" style={{ color: JOBS }}>{name.slice(0, 1)}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-ink">{name}</p>
                  {snap.headline && <p className="truncate text-sm text-ink-muted">{snap.headline}</p>}
                  <p className="text-xs text-ink-faint">Applied {new Date(a.applied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                </div>
                <span className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: `${JOBS}14`, color: JOBS }}>{JOB_APP_STATUS_LABELS[a.status]}</span>
              </button>

              {snap.skills && snap.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {snap.skills.slice(0, open ? 99 : 6).map((s) => <span key={s} className="rounded-pill bg-sand px-2.5 py-1 text-xs font-semibold text-ink-soft">{s}</span>)}
                </div>
              )}

              {open && (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  {snap.summary && <p className="text-sm text-ink-soft whitespace-pre-wrap">{snap.summary}</p>}
                  {snap.qualifications && snap.qualifications.length > 0 && (
                    <p className="text-sm text-ink-soft"><span className="font-semibold">Qualifications:</span> {snap.qualifications.join(", ")}</p>
                  )}
                  {snap.willing_to_relocate && <p className="text-sm font-semibold" style={{ color: JOBS }}>✓ Willing to relocate</p>}
                  {a.cover_letter && (
                    <div className="rounded-xl bg-sand/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Cover note</p>
                      <p className="mt-1 text-sm text-ink-soft whitespace-pre-wrap">{a.cover_letter}</p>
                    </div>
                  )}
                </div>
              )}

              {!closed && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {(["shortlisted", "interview", "offer", "hired"] as JobAppStatus[]).slice(idx >= 2 ? PIPELINE_STAGES.indexOf("shortlisted") - 2 : 0).filter((st) => PIPELINE_STAGES.indexOf(st) > idx).map((st) => (
                    <button key={st} onClick={() => move(a.id, st)} disabled={busyId === a.id} className="rounded-pill px-3.5 py-1.5 text-xs font-semibold text-paper disabled:opacity-40" style={{ background: JOBS }}>
                      {JOB_APP_STATUS_LABELS[st]}
                    </button>
                  ))}
                  <button onClick={() => move(a.id, "declined")} disabled={busyId === a.id} className="rounded-pill border border-line-strong px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">
                    Decline
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <p className="py-8 text-center text-sm text-ink-muted">No applicants in this stage.</p>}
      </div>
    </div>
  );
}
