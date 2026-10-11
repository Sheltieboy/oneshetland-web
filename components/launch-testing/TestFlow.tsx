"use client";
/* eslint-disable @next/next/no-img-element -- private, short-lived signed URLs and local previews: next/image cannot optimise them */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startAttemptAction, submitAttemptAction } from "@/lib/launch-testing/actions";
import { moneyWarning, requiresAck, ACK_LABEL, NEVER_SHARE_NOTICE } from "@/lib/launch-testing/money";
import { EvidenceUploader } from "./EvidenceUploader";
import type { MoneyType, Platform, ReviewState } from "@/lib/launch-testing/types";

interface TestView {
  id: string; category: string; title: string; purpose: string; steps: string[]; expected_outcome: string; mandatory: boolean;
  money_test_type: MoneyType; expected_max_spend_pence: number | null; target_url: string | null; target_note: string | null;
  help_text: string | null; effort_minutes: number | null;
}
interface LastView {
  id: string; status: "passed" | "issue" | "blocked"; tester_note: string | null; issue_description: string | null;
  retest_requested: boolean; review_state: ReviewState | null; admin_note: string | null; completed_at: string | null;
}

type Choice = "passed" | "issue" | "blocked";

export function TestFlow({ number, platform, sessionId, test, current, last, attachments }: {
  number: number; platform: Platform; sessionId: string; test: TestView; current: { id: string } | null; last: LastView | null;
  attachments: Array<{ id: string; url: string | null }>;
}) {
  const router = useRouter();
  const warn = moneyWarning(test);
  const [ack, setAck] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [note, setNote] = useState("");
  const [issue, setIssue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  function begin() {
    setError(null);
    run(async () => {
      const r = await startAttemptAction({ testId: test.id, sessionId, acknowledged: ack });
      if (!r.ok) { setError(r.error); return; }
      setChoice(null); setNote(""); setIssue("");
      router.refresh();
    });
  }

  function send() {
    if (!current || !choice) return;
    setError(null);
    if (choice !== "passed" && issue.trim().length < 3) { setError(choice === "issue" ? "Please tell us what happened." : "Please tell us what stopped you."); return; }
    run(async () => {
      const r = await submitAttemptAction({ attemptId: current.id, status: choice, note, issue });
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
    });
  }

  return (
    <article className="space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Test {number} · {test.category}{test.mandatory ? " · Needed" : " · Optional"}{test.effort_minutes ? ` · about ${test.effort_minutes} min` : ""}</p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-ink">{test.title}</h1>
      </header>

      {last?.retest_requested && !current && (
        <div role="status" className="rounded-card border-2 border-violet-300 bg-violet-50 p-4">
          <p className="font-bold text-violet-900">Please re-check this test.</p>
          {last.admin_note && <p className="mt-1 text-sm text-violet-900">“{last.admin_note}”</p>}
        </div>
      )}

      <section className="rounded-card border border-line bg-paper p-4 shadow-soft">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Why we are testing this</h2>
        <p className="mt-1 text-ink">{test.purpose}</p>
        <h2 className="mt-4 text-xs font-bold uppercase tracking-widest text-ink-muted">What to do</h2>
        <ol className="mt-2 space-y-2">
          {test.steps.map((s, i) => (
            <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand text-xs font-bold text-ink" aria-hidden>{i + 1}</span><span className="text-ink">{s}</span></li>
          ))}
        </ol>
        {test.target_note && <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-sm text-ink"><strong>For this test:</strong> {test.target_note}</p>}
        {test.target_url && <a href={test.target_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-[44px] items-center rounded-pill border-2 border-line px-4 text-sm font-bold text-teal-dark">Open the page ↗</a>}
        <p className="mt-3 text-sm text-ink-muted">Open the OneShetland app on your {platform === "ios" ? "iPhone" : "Android phone"} to do this.</p>
        <h2 className="mt-4 text-xs font-bold uppercase tracking-widest text-ink-muted">What should happen</h2>
        <p className="mt-1 text-ink">{test.expected_outcome}</p>
      </section>

      {warn && (
        <section className="rounded-card border-2 border-rose-500 bg-rose-50 p-4" aria-label="Real money warning">
          <p className="font-display text-lg font-bold text-rose-700">{warn.headline}</p>
          <p className="mt-1 text-rose-900">{warn.body}</p>
          {warn.spend && <p className="mt-1 font-bold text-rose-900">{warn.spend}</p>}
          {test.help_text && <p className="mt-2 text-sm text-rose-900">{test.help_text}</p>}
        </section>
      )}

      {/* ── not started (or finished and being re-run) ───────────────────────────────────────────────────────────── */}
      {!current && (
        <section className="space-y-3">
          {last && <LastResult last={last} attachments={attachments} />}
          {requiresAck(test) && (
            <label className="flex cursor-pointer items-start gap-3 rounded-card border border-line bg-paper p-4">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 h-6 w-6 shrink-0" />
              <span className="text-base font-semibold text-ink">{ACK_LABEL}</span>
            </label>
          )}
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button type="button" onClick={begin} disabled={pending || (requiresAck(test) && !ack)}
            className="min-h-[56px] w-full rounded-pill bg-navy px-6 text-lg font-bold text-white disabled:opacity-50">
            {pending ? "One moment…" : last ? "Run this test again" : "START TEST"}
          </button>
        </section>
      )}

      {/* ── in progress: how did it go? ──────────────────────────────────────────────────────────────────────────── */}
      {current && (
        <section className="space-y-4" aria-label="How did it go?">
          <h2 className="font-display text-2xl font-bold text-ink">How did it go?</h2>
          <p className="text-sm text-ink-muted">Go and try it in the OneShetland app, then come back and tell us.</p>
          <div className="grid gap-3">
            <button type="button" onClick={() => setChoice("passed")} aria-pressed={choice === "passed"}
              className={"min-h-[60px] rounded-card border-2 px-4 text-left text-lg font-bold " + (choice === "passed" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-600 bg-emerald-50 text-emerald-900")}>✓ Everything worked</button>
            <button type="button" onClick={() => setChoice("issue")} aria-pressed={choice === "issue"}
              className={"min-h-[60px] rounded-card border-2 px-4 text-left text-lg font-bold " + (choice === "issue" ? "border-rose-600 bg-rose-600 text-white" : "border-rose-600 bg-rose-50 text-rose-900")}>! Something went wrong</button>
            <button type="button" onClick={() => setChoice("blocked")} aria-pressed={choice === "blocked"}
              className={"min-h-[60px] rounded-card border-2 px-4 text-left text-lg font-bold " + (choice === "blocked" ? "border-amber-600 bg-amber-500 text-white" : "border-amber-500 bg-amber-50 text-amber-900")}>? I couldn&apos;t complete it</button>
          </div>

          {choice && (
            <div className="space-y-4 rounded-card border border-line bg-paper p-4 shadow-soft">
              {choice === "passed" ? (
                <label className="block text-sm font-semibold text-ink">Anything to add? <span className="font-normal text-ink-muted">(optional)</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base" />
                </label>
              ) : (
                <label className="block text-sm font-semibold text-ink">{choice === "issue" ? "What happened?" : "What stopped you?"} <span className="font-bold text-rose-700">Required</span>
                  <textarea value={issue} onChange={(e) => setIssue(e.target.value)} rows={4} maxLength={4000} required className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base"
                    placeholder={choice === "issue" ? "Tell us in your own words what you saw." : "For example: my Wallet balance was too low."} />
                </label>
              )}
              <EvidenceUploader attemptId={current.id} existing={attachments} />
              <p className="rounded-lg bg-sand px-3 py-2 text-xs text-ink-soft">{NEVER_SHARE_NOTICE}</p>
              {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <button type="button" onClick={send} disabled={pending} className="min-h-[56px] w-full rounded-pill bg-navy px-6 text-lg font-bold text-white disabled:opacity-60">
                {pending ? "Sending…" : choice === "passed" ? "Complete" : "Send"}
              </button>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

function LastResult({ last, attachments }: { last: LastView; attachments: Array<{ id: string; url: string | null }> }) {
  const map = {
    passed: { text: "✓ You said: everything worked", cls: "border-emerald-300 bg-emerald-50 text-emerald-900" },
    issue: { text: "! You said: something went wrong", cls: "border-rose-300 bg-rose-50 text-rose-900" },
    blocked: { text: "? You said: you couldn't complete it", cls: "border-amber-300 bg-amber-50 text-amber-900" },
  }[last.status];
  return (
    <div className={"rounded-card border p-4 " + map.cls}>
      <p className="font-bold">{map.text}</p>
      {last.status === "passed" ? last.tester_note && <p className="mt-1 text-sm">“{last.tester_note}”</p> : last.issue_description && <p className="mt-1 text-sm">“{last.issue_description}”</p>}
      {attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{attachments.map((a) => a.url && <img key={a.id} src={a.url} alt="Your screenshot" className="h-16 w-16 rounded-lg border border-line object-cover" />)}</div>}
      <p className="mt-2 text-xs opacity-80">Your earlier answer is kept. Running it again adds a new one beside it.</p>
    </div>
  );
}
