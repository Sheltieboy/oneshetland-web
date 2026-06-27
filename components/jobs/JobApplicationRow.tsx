"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type JobApplication, JOB_APP_STATUS_LABELS, PIPELINE_STAGES } from "@/lib/jobs-data";

const JOBS = "#2a8b5c";
const CLOSED = new Set(["hired", "declined", "withdrawn"]);

export function JobApplicationRow({ app }: { app: JobApplication }) {
  const router = useRouter();
  const [status, setStatus] = useState(app.status);
  const [busy, setBusy] = useState(false);

  const biz = app.job?.business;
  const stageIndex = PIPELINE_STAGES.indexOf(status);
  const closed = CLOSED.has(status);

  async function withdraw() {
    setBusy(true);
    try {
      const sb = createClient();
      await sb.from("job_applications").update({ status: "withdrawn" }).eq("id", app.id);
      // Notify the employer the candidate withdrew.
      sb.functions.invoke("notify-job", { body: { event: "withdrawn", application_id: app.id } }).catch(() => {});
      setStatus("withdrawn");
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-line bg-sand">
          {biz?.logo_url ? <img src={biz.logo_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center font-display font-bold" style={{ color: JOBS }}>{(biz?.name ?? "?").slice(0, 1)}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/jobs/${app.job_id}`} className="font-display font-bold text-ink hover:underline">{app.job?.title ?? "Job"}</Link>
          <p className="text-sm text-ink-muted">{biz?.name ?? "Employer"}</p>
        </div>
        <span className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: closed ? "var(--color-sand)" : `${JOBS}14`, color: closed ? "var(--color-ink-muted)" : JOBS }}>
          {JOB_APP_STATUS_LABELS[status]}
        </span>
      </div>

      {/* Pipeline dots */}
      {!closed && (
        <div className="mt-4 flex items-center gap-1.5">
          {PIPELINE_STAGES.slice(0, 5).map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: i <= stageIndex ? JOBS : "var(--color-line-strong)" }} />
              {i < 4 && <span className="h-0.5 flex-1 rounded" style={{ background: i < stageIndex ? JOBS : "var(--color-line)" }} />}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-ink-faint">Applied {new Date(app.applied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
        {!closed && (
          <button onClick={withdraw} disabled={busy} className="rounded-pill border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand disabled:opacity-40">
            {busy ? "…" : "Withdraw"}
          </button>
        )}
      </div>
    </div>
  );
}
