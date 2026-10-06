"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/admin/AdminUI";
import { runWorkflowAction } from "@/lib/launch-partners/workflow-actions";
import { isWaitingStep, type Workflow, type WorkflowStep } from "@/lib/launch-partners/workflow";

/** Smooth scroll to a section on this page — no route change; instant when the visitor prefers reduced motion. Focus moves to the section heading. */
function jumpTo(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const h = document.getElementById(`${sectionId}-h`);
  if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  try { window.history.replaceState(null, "", `#${sectionId}`); } catch { /* the address bar is a convenience */ }
}

const GLYPH: Record<WorkflowStep["state"], string> = { complete: "✓", current: "→", attention: "!", future: "○" };
const SR: Record<WorkflowStep["state"], string> = { complete: "Done: ", current: "Next: ", attention: "Needs attention: ", future: "" };
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-1";

function StepLink({ step, className, children }: { step: WorkflowStep; className: string; children: React.ReactNode }) {
  if (!step.available && step.state !== "current" && step.state !== "attention") {
    return <span aria-disabled="true" className={className + " cursor-not-allowed opacity-50"}>{children}<span className="sr-only"> — not available yet</span></span>;
  }
  if (step.target.kind === "href") return <Link href={step.target.href} className={className + " " + FOCUS}>{children}</Link>;
  const id = step.target.id;
  return <a href={`#${id}`} onClick={(e) => { e.preventDefault(); jumpTo(id); }} className={className + " " + FOCUS}>{children}</a>;
}

/**
 * The Launch workflow: where this partner is and what to do next. It shows facts derived on the server from the campaign
 * (see lib/launch-partners/workflow.ts) — it keeps no state of its own. A sticky rail on wide screens; below that, a bar that sticks to the bottom of the screen while the page is in view and stops at the end of the content (so it never covers the site footer).
 */
export function WorkflowRail({ id, workflow }: { id: string; workflow: Workflow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cur = workflow.current;
  const waiting = isWaitingStep(workflow);

  async function act(step: WorkflowStep) {
    if (!step.action) { if (step.target.kind === "section") jumpTo(step.target.id); return; }
    setBusy(true); setErr(null);
    const r = await runWorkflowAction(id, step.action);
    setBusy(false);
    if (!r.ok) setErr(r.error);
    router.refresh();   // the page's own sections re-read the real state; the scroll position is kept
  }

  const primary = (step: WorkflowStep, compact = false) => {
    const label = busy ? "Working…" : step.cta ?? step.label;
    const cls = (compact ? "px-4 py-2 " : "mt-2 w-full px-3 py-1.5 ") + "rounded-pill bg-rose-600 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50 " + FOCUS;
    if (step.target.kind === "href" && !step.action) return <Link href={step.target.href} className={cls + " inline-block text-center"}>{label}</Link>;
    return <button type="button" onClick={() => act(step)} disabled={busy} className={cls}>{label}{!step.action && " ↓"}</button>;
  };

  return (
    <>
      {/* ── wide screens: the sticky rail ── */}
      <aside aria-label="Launch workflow" data-workflow="rail" className="hidden xl:block">
        <div className="sticky top-20 rounded-2xl border border-line bg-paper p-3.5 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow text-ink-muted">Launch workflow</p>
            <StatusPill label={workflow.statusLabel} tone={workflow.statusTone} />
          </div>
          <p aria-live="polite" className="mt-2 text-sm font-bold text-ink">{workflow.headline}</p>
          <ol className="mt-2.5 space-y-0.5">
            {workflow.steps.map((s) => {
              const active = s.id === cur?.id;
              if (active) {
                return (
                  <li key={s.id} aria-current="step" className={"rounded-xl border-2 p-2.5 " + (s.state === "attention" ? "border-amber-400 bg-amber-50" : "border-rose-300 bg-rose-50")}>
                    <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><span aria-hidden="true" className={s.state === "attention" ? "text-amber-700" : "text-rose-600"}>{GLYPH[s.state]}</span><span className="sr-only">{SR[s.state]}</span>{s.label}</p>
                    {s.note && <p className="mt-0.5 text-xs text-ink-soft">{s.note}</p>}
                    {!waiting && primary(s)}
                  </li>
                );
              }
              return (
                <li key={s.id}>
                  <StepLink step={s} className={"flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs " + (s.state === "complete" ? "text-ink-muted hover:bg-sand" : s.state === "attention" ? "font-semibold text-amber-800 hover:bg-amber-50" : "text-ink-soft hover:bg-sand")}>
                    <span aria-hidden="true" className={"w-3 shrink-0 text-center font-bold " + (s.state === "complete" ? "text-emerald-600" : s.state === "attention" ? "text-amber-700" : "text-ink-faint")}>{GLYPH[s.state]}</span>
                    <span className="sr-only">{SR[s.state]}</span>{s.label}
                  </StepLink>
                </li>
              );
            })}
          </ol>
          {err && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">{err}</p>}
        </div>
      </aside>

      {/* ── narrower screens: a bottom bar with the stage and the next action ── */}
      <div role="region" aria-label="Launch workflow" data-workflow="bar" className="sticky bottom-3 z-40 mt-5 rounded-2xl border border-line bg-paper/95 px-3.5 py-2.5 shadow-lift backdrop-blur xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2"><StatusPill label={workflow.statusLabel} tone={workflow.statusTone} /></p>
            <p aria-live="polite" className="mt-0.5 truncate text-sm font-bold text-ink">{workflow.headline}</p>
            {err && <p role="alert" className="truncate text-xs font-semibold text-rose-700">{err}</p>}
          </div>
          {cur && !waiting && <div className="shrink-0">{primary(cur, true)}</div>}
        </div>
      </div>
    </>
  );
}
