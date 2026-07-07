"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CONTRACT_LABELS, formatJobPay, type JobStatus } from "@/lib/jobs-data";
import type { BusinessJob } from "@/lib/jobs-data.server";
import { JOBS } from "@/components/jobs/JobsUI";

function statusTone(s: JobStatus, hidden: boolean): { label: string; color: string; bg: string } {
  if (hidden) return { label: "Hidden", color: "#475569", bg: "#E2E8F0" };
  if (s === "filled") return { label: "Filled", color: "#15803D", bg: "#DCFCE7" };
  if (s === "closed") return { label: "Closed", color: "#991B1B", bg: "#FEE2E2" };
  return { label: "Open", color: "#15803D", bg: "#DCFCE7" };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function BusinessJobsManager({ jobs }: { jobs: BusinessJob[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(job: BusinessJob, next: JobStatus, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setError(null);
    setBusyId(job.id);
    try {
      const sb = createClient();
      const { error: e } = await sb.from("jobs").update({ status: next }).eq("id", job.id);
      if (e) throw e;
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the job.");
    } finally {
      setBusyId(null);
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-paper/60 px-6 py-12 text-center">
        <span className="text-4xl">💼</span>
        <p className="mt-3 font-display text-lg font-bold text-ink">No jobs yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Post your first role to start taking applications.</p>
        <Link href="/jobs/new" className="mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-paper transition hover:brightness-95" style={{ background: JOBS }}>
          Post a job
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {jobs.map((job) => {
        const tone = statusTone(job.status, job.is_hidden);
        const busy = busyId === job.id;
        return (
          <div key={job.id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-ink">{job.title}</p>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {CONTRACT_LABELS[job.contract_type] ?? job.contract_type} · {formatJobPay(job)}
                </p>
              </div>
              <span className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: tone.bg, color: tone.color }}>
                {tone.label}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span>{job.application_count} applicant{job.application_count === 1 ? "" : "s"}</span>
              <span>·</span>
              <span>Posted {fmtDate(job.posted_at)}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link href={`/jobs/${job.id}/applicants`} className="rounded-pill px-3.5 py-1.5 text-xs font-semibold text-paper transition hover:brightness-95" style={{ background: JOBS }}>
                Applicants
              </Link>
              <Link href={`/jobs/new?jobId=${job.id}`} className="rounded-pill border border-line-strong px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-sand">
                Edit
              </Link>
              {job.status === "open" ? (
                <>
                  <button
                    onClick={() => setStatus(job, "filled", `Mark "${job.title}" as filled? It will stop taking new applications.`)}
                    disabled={busy}
                    className="rounded-pill border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Mark filled"}
                  </button>
                  <button
                    onClick={() => setStatus(job, "closed", "Close this job? It will stop taking new applications.")}
                    disabled={busy}
                    className="rounded-pill border border-rose-300 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Close"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setStatus(job, "open")}
                  disabled={busy}
                  className="rounded-pill border border-line-strong px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Reopen"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
