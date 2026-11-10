"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runTestOrganisationAction, type TestOrgRun } from "@/app/admin/editions/test-organisation/actions";
import { STEPS, type StepKey } from "@/app/admin/editions/helpers";

const btnPrimary = "min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50";
const btn = "min-h-9 rounded-pill border border-line-strong px-3 text-xs font-bold text-ink-soft transition hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50";
const TONE = { done: "bg-emerald-100 text-emerald-800", skipped: "bg-sand text-ink-soft", failed: "bg-rose-100 text-rose-800" } as const;
const WORD = { done: "Done", skipped: "Already done", failed: "Failed" } as const;

export function TestOrgRunner({ exists }: { exists: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [run, setRun] = useState<TestOrgRun | null>(null);
  const go = (only?: StepKey) => start(async () => {
    try { setRun(await runTestOrganisationAction(only)); router.refresh(); }
    catch { setRun({ ok: false, steps: [], error: "Something went wrong. Please try again." }); }
  });
  return (
    <div className="space-y-4">
      <button type="button" className={btnPrimary} disabled={pending} onClick={() => go()}>{pending ? "Working…" : exists ? "Run again: complete anything missing" : "Create private test organisation"}</button>
      <div role="status" aria-live="polite">
        {run?.error && <p className="text-sm text-rose-700">{run.error}</p>}
        {run && run.steps.length > 0 && (
          <>
            <p className={"mb-2 text-sm font-bold " + (run.ok ? "text-emerald-800" : "text-rose-700")}>{run.ok ? "All steps completed." : "A step failed. Nothing after it was attempted; fix the cause and run again, or repair one step."}</p>
            <ol className="divide-y divide-line rounded-card border border-line bg-paper">
              {run.steps.map((s) => (
                <li key={s.key} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 text-sm">
                  <div className="min-w-0"><p className="font-semibold text-ink">{s.label}</p>{s.detail && <p className={s.status === "failed" ? "text-rose-700" : "text-ink-muted"}>{s.detail}</p>}</div>
                  <div className="flex items-center gap-2"><span className={"rounded-pill px-2.5 py-0.5 text-xs font-bold " + TONE[s.status]}>{WORD[s.status]}</span>
                    {s.status === "failed" && <button type="button" className={btn} disabled={pending} onClick={() => go(s.key)}>Retry this step</button>}</div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
      <details className="rounded-card border border-line bg-paper p-4 text-sm">
        <summary className="cursor-pointer font-bold text-ink">Repair a single step</summary>
        <p className="mt-2 text-ink-muted">Each step checks the current state first and does nothing if it is already done.</p>
        <ul className="mt-3 flex flex-wrap gap-2">{STEPS.map((s) => <li key={s.key}><button type="button" className={btn} disabled={pending} onClick={() => go(s.key)}>{s.label.replace(/ \(.*\)$/, "")}</button></li>)}</ul>
      </details>
    </div>
  );
}
