"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { FETCH_ACCENT, btnPrimary, btnSecondary, field, label } from "@/components/fetch/v2/ui";
import type { FetchResult } from "@/lib/fetch-api";

/**
 * A button that opens a dialog saying exactly what will happen, optionally asks for a reason or a choice, then runs one server action.
 * The dialog shows the server's answer — success or its refusal in plain English — and only then refreshes the page.
 */
export function ActionDialog({ trigger, title, body, confirm, run, choices, reason, danger, onDone, triggerClass }: {
  trigger: string; title: string; body: React.ReactNode; confirm: string;
  run: (input: { reason: string; choice: string }) => Promise<FetchResult<unknown>>;
  choices?: { label: string; options: { value: string; label: string }[] };
  reason?: { label: string; required?: boolean; max?: number };
  danger?: boolean; onDone?: (r: FetchResult<unknown>) => string | void; triggerClass?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [choice, setChoice] = useState("");
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const missing = (reason?.required && text.trim().length < 3) || (choices && !choice);

  async function go() {
    setBusy(true); setResult(null);
    try {
      const r = await run({ reason: text.trim(), choice });
      const custom = onDone?.(r);
      setResult(r.ok ? { ok: true, msg: custom || "Done." } : { ok: false, msg: r.message });
      if (r.ok) router.refresh();
    } catch {
      setResult({ ok: false, msg: "We couldn't reach OneShetland. Nothing has changed — please try again." });
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setResult(null); }} className={triggerClass ?? btnSecondary}>{trigger}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} accent={FETCH_ACCENT}>
        <div className="space-y-3 text-sm text-ink-soft">
          <div>{body}</div>
          {choices && (
            <label className={label}>{choices.label}
              <select value={choice} onChange={(e) => setChoice(e.target.value)} className={field}>
                <option value="">Choose…</option>
                {choices.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          )}
          {reason && (
            <label className={label}>{reason.label}{reason.required ? "" : " (optional)"}
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={reason.max ?? 1000} className={field} />
            </label>
          )}
          {result && <p role={result.ok ? "status" : "alert"} className={`font-semibold ${result.ok ? "text-emerald-700" : "text-rose-700"}`}>{result.msg}</p>}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>{result?.ok ? "Close" : "Not now"}</button>
            {!result?.ok && (
              <button type="button" onClick={go} disabled={busy || !!missing} className={btnPrimary}
                style={{ background: danger ? "#be123c" : FETCH_ACCENT }}>{busy ? "Please wait…" : confirm}</button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
