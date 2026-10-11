"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestRetestAction, reviewAttemptAction } from "@/lib/launch-testing/actions";
import type { ReviewState } from "@/lib/launch-testing/types";

export const REVIEW_LABEL: Record<ReviewState, string> = {
  open: "Open", reviewed: "Reviewed", fix_pending: "Fix pending", ready_for_retest: "Ready for retest", resolved: "Resolved",
};

export function ReviewPanel({ attemptId, status, state, note }: { attemptId: string; status: string; state: ReviewState | null; note: string | null }) {
  const router = useRouter();
  const [next, setNext] = useState<ReviewState>(state ?? "open");
  const [text, setText] = useState(note ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, run] = useTransition();
  const reviewable = status === "issue" || status === "blocked";
  function save() { setMsg(null); run(async () => { const r = await reviewAttemptAction(attemptId, next, text); setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error }); if (r.ok) router.refresh(); }); }
  function retest() { setMsg(null); run(async () => { const r = await requestRetestAction(attemptId, text); setMsg(r.ok ? { ok: true, text: "The tester will be asked to re-check." } : { ok: false, text: r.error }); if (r.ok) router.refresh(); }); }
  return (
    <section className="rounded-card border border-line bg-paper p-4">
      <h2 className="font-display text-lg font-bold text-ink">Issue workflow</h2>
      {reviewable ? (
        <label className="mt-3 block text-sm font-semibold text-ink">State
          <select value={next} onChange={(e) => setNext(e.target.value as ReviewState)} className="mt-1 w-full rounded-lg border border-line px-3 py-2">
            {(Object.keys(REVIEW_LABEL) as ReviewState[]).map((s) => <option key={s} value={s}>{REVIEW_LABEL[s]}</option>)}
          </select>
        </label>
      ) : <p className="mt-2 text-sm text-ink-muted">This result passed, so there is nothing to review. You can still ask for a re-check.</p>}
      <label className="mt-3 block text-sm font-semibold text-ink">Note <span className="font-normal text-ink-muted">(shown to the tester if you ask for a re-check)</span>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" /></label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {reviewable && <button type="button" onClick={save} disabled={pending} className="rounded-pill bg-navy px-5 py-2 text-sm font-bold text-white disabled:opacity-60">Save state</button>}
        <button type="button" onClick={retest} disabled={pending} className="rounded-pill border-2 border-violet-600 px-5 py-2 text-sm font-bold text-violet-700 disabled:opacity-60">Ask for a re-check</button>
        {msg && <span role="status" className={"text-sm " + (msg.ok ? "text-emerald-700" : "text-rose-700")}>{msg.text}</span>}
      </div>
      <p className="mt-3 text-xs text-ink-muted">Asking for a re-check keeps this result exactly as it is. The tester starts a new attempt beside it; if it passes, this one is marked resolved.</p>
    </section>
  );
}
