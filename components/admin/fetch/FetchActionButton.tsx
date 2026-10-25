"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FETCH_ADMIN_ACTIONS, type ActionSpec, type FetchAdminActionId } from "@/lib/fetch-admin/actions";
import { runFetchAdminAction } from "@/app/admin/fetch/actions";

/**
 * One explicit button per audited action. Nothing happens on the page itself: the button opens a dialog that says exactly what
 * will happen, asks for a reason where the server requires one, and only then sends the request. The result shown is the server's
 * (never assumed); the page refreshes from the database afterwards.
 */
export function FetchActionButton({ action, target, compact }: { action: FetchAdminActionId; target: string; compact?: boolean }) {
  const spec: ActionSpec = FETCH_ADMIN_ACTIONS[action];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function confirm() {
    setBusy(true); setResult(null);
    try {
      const r = await runFetchAdminAction(action, { target, reason, fields });
      setResult(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    } catch {
      setResult({ ok: false, text: "The server could not be reached. Nothing was confirmed; refresh to check." });
    } finally { setBusy(false); }
  }

  const btn = spec.tone === "danger"
    ? "border border-rose-300 text-rose-700 hover:bg-rose-50"
    : "border border-line-strong text-ink hover:bg-sand";
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setResult(null); }}
        className={`rounded-pill px-3 ${compact ? "py-1 text-xs" : "py-1.5 text-sm"} font-semibold ${btn}`}>{spec.label}</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={spec.label} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-card bg-paper p-5 shadow-soft">
            <h2 className="font-display text-xl font-bold text-ink">{spec.label}</h2>
            <p className="mt-2 text-sm text-ink-soft">{spec.consequence}</p>
            {spec.fields?.map((f) => (
              <label key={f.name} className="mt-3 block text-sm font-semibold text-ink">{f.label}
                {"options" in f ? (
                  <select value={fields[f.name] ?? ""} onChange={(e) => setFields({ ...fields, [f.name]: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal">
                    <option value="">Choose…</option>
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type={f.kind === "date" ? "date" : "text"} inputMode={f.kind === "pence" ? "numeric" : undefined}
                    value={fields[f.name] ?? ""} onChange={(e) => setFields({ ...fields, [f.name]: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal" />
                )}
              </label>
            ))}
            {spec.reason !== "none" && (
              <label className="mt-3 block text-sm font-semibold text-ink">
                Reason {spec.reason === "required" ? "(required — it is recorded)" : "(optional — recorded if given)"}
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000}
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal" />
              </label>
            )}
            {result && <p role="status" className={`mt-3 text-sm font-semibold ${result.ok ? "text-emerald-700" : "text-rose-700"}`}>{result.text}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-pill border border-line px-4 py-2 text-sm font-semibold">Close</button>
              {!result?.ok && (
                <button type="button" onClick={confirm} disabled={busy || (spec.reason === "required" && reason.trim().length < 3)}
                  className={`rounded-pill px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${spec.tone === "danger" ? "bg-rose-600" : "bg-navy"}`}>
                  {busy ? "Sending…" : `Yes — ${spec.label.toLowerCase()}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
