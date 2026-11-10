"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewEditionAction } from "@/app/admin/editions/approvals/actions";
import { decisionNoteProblem, type Decision } from "@/app/admin/editions/approvals/review";
import { Label, btn, btnDanger, btnPrimary, field } from "@/components/admin/EditionsAdminForms";

/**
 * The decision area. Approve is one tap (a note is optional, except for the first Edition of an organiser whose name is on the reserved list). Request changes needs a note
 * saying what to fix. Reject needs a note and one confirmation. After deciding, the administrator goes back to the queue with a confirmation.
 */
export function EditionDecision({ editionId, title, firstReserved, firstEdition }: { editionId: string; title: string; firstReserved: boolean; firstEdition: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const decide = (decision: Decision) => {
    const problem = decisionNoteProblem(decision, note, { firstReserved: decision === "approve" && firstReserved && firstEdition });
    if (problem) { setError(problem); box.current?.focus(); return; }
    setError(null);
    start(async () => {
      try {
        const r = await reviewEditionAction({ editionId, decision, note });
        if (r.ok) router.push(`/admin/editions/approvals?done=${decision}&title=${encodeURIComponent(title.slice(0, 80))}`);
        else setError(r.error);
      } catch { setError("Something went wrong. Please try again."); }
    });
  };
  const needNote = firstReserved && firstEdition;
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="review-note">{needNote ? "Note (required for approval: this name is on the reserved list)" : "Note (optional for approval; needed to request changes or reject)"}</Label>
        <textarea id="review-note" ref={box} rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={field} aria-describedby="review-note-help" placeholder="What should they fix?" />
        <p id="review-note-help" className="mt-1 text-xs text-ink-muted">The organiser sees your note when you request changes or reject. {needNote ? "Say how you checked who they are." : "Approving also records that you checked who runs it."}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={pending} onClick={() => decide("approve")} className={btnPrimary + " w-full sm:w-auto"}>{pending ? "Saving…" : "Approve"}</button>
        <button type="button" disabled={pending} onClick={() => decide("changes")} className={btn + " w-full sm:w-auto"}>Request changes</button>
        {!confirmReject && <button type="button" disabled={pending} onClick={() => { const p = decisionNoteProblem("reject", note); if (p) { setError(p); box.current?.focus(); } else { setError(null); setConfirmReject(true); } }} className={btn + " w-full text-rose-700 sm:w-auto"}>Reject…</button>}
      </div>
      {confirmReject && (
        <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="text-sm font-semibold text-rose-900">Reject this Edition? The organiser is told why and it will not go public.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={pending} onClick={() => decide("reject")} className={btnDanger + " w-full sm:w-auto"}>Yes, reject it</button>
            <button type="button" onClick={() => setConfirmReject(false)} className={btn + " w-full sm:w-auto"}>Cancel</button>
          </div>
        </div>
      )}
      <p role="alert" aria-live="polite" className={"min-h-5 text-sm " + (error ? "text-rose-700" : "")}>{error}</p>
    </div>
  );
}
