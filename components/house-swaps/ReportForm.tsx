"use client";

import { useState } from "react";
import { reportContent } from "@/app/house-swaps/actions";
import { REPORT_REASONS, LIMITS } from "@/lib/house-swaps";
import { ActionForm } from "./ActionForm";
import { btnDanger, btnSecondary, fieldCls } from "./Shell";

/** A quiet "Report" button that opens a small in-page form (reason + optional details). */
export function ReportForm({ kind, id, label = "Report this advert" }: { kind: "listing" | "thread"; id: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className={btnSecondary}>{label}</button>;
  return (
    <div className="rounded-xl border border-line bg-sand/50 p-4">
      <h3 className="font-display text-lg font-bold text-ink">{label}</h3>
      <p className="mt-1 text-sm text-ink-soft">Tell us what is wrong. Our team reads every report. The person will not be told it was you.</p>
      <ActionForm action={reportContent} refreshOnOk={false} className="mt-3 space-y-3">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <div>
          <label htmlFor={`rr-${id}`} className="block text-sm font-semibold text-ink">Reason</label>
          <select id={`rr-${id}`} name="reason" required defaultValue="" className={fieldCls}>
            <option value="" disabled>Choose a reason</option>
            {REPORT_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`rd-${id}`} className="block text-sm font-semibold text-ink">More detail (optional)</label>
          <textarea id={`rd-${id}`} name="details" rows={3} maxLength={LIMITS.report} className={fieldCls} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnDanger}>Send report</button>
          <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>Cancel</button>
        </div>
      </ActionForm>
    </div>
  );
}
