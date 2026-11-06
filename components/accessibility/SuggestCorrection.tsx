"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useCanEdit } from "./OwnerEdit";
import { submitReport } from "@/lib/accessibility-client";
import type { SubjectType } from "@/lib/accessibility";

/** A short form for "this is wrong" or "you could add this". Signed-in people only (it stops spam); everything is read by a person before anything changes. */
export function SuggestCorrection({ type, id, noun }: { type: SubjectType; id: string; noun: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"incorrect" | "add">("incorrect");
  const [msg, setMsg] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  const uid = useId();
  const { signedIn } = useCanEdit(type, id);
  if (state === "done") return <p role="status" className="text-sm font-semibold text-emerald-900">Thank you. A person will read your suggestion before anything changes.</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} aria-expanded="false" className="inline-flex min-h-11 items-center rounded-pill border border-line-strong px-4 text-sm font-semibold">Suggest a correction</button>;
  if (!signedIn) return <p className="text-sm">To stop spam, please <Link href={`/sign-in?next=${encodeURIComponent(typeof window === "undefined" ? "/accessible" : window.location.pathname)}`} className="font-semibold underline">sign in</Link> to send a suggestion. Please do not include anything about your own health or disability.</p>;
  async function send(e: React.FormEvent) {
    e.preventDefault(); setState("busy"); setErr(null);
    try { await submitReport(type, id, kind, msg); setState("done"); } catch (x) { setErr((x as Error).message); setState("idle"); }
  }
  return (
    <form onSubmit={send} className="w-full rounded-card border border-line-strong bg-white p-4" aria-label="Suggest a correction">
      <fieldset>
        <legend className="text-sm font-bold">What would you like to tell us about this {noun}?</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <label className="flex min-h-11 items-center gap-2"><input type="radio" name={`k-${uid}`} checked={kind === "incorrect"} onChange={() => setKind("incorrect")} /> Something here is wrong</label>
          <label className="flex min-h-11 items-center gap-2"><input type="radio" name={`k-${uid}`} checked={kind === "add"} onChange={() => setKind("add")} /> Something could be added</label>
        </div>
      </fieldset>
      <label htmlFor={`m-${uid}`} className="mt-3 block text-sm font-semibold">Your suggestion</label>
      <textarea id={`m-${uid}`} required minLength={10} maxLength={1000} rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} aria-describedby={`h-${uid}`} className="mt-1 w-full rounded-lg border border-line-strong p-3 text-base" />
      <p id={`h-${uid}`} className="mt-1 text-xs text-ink-soft">At least 10 characters. Please describe the place, not yourself: do not include health or disability details. Your name is not shown to the owner.</p>
      {err && <p role="alert" className="mt-2 text-sm font-semibold text-rose-800">{err}</p>}
      <div className="mt-3 flex gap-3">
        <button type="submit" disabled={state === "busy" || msg.trim().length < 10} className="min-h-11 rounded-pill bg-ink px-5 text-sm font-bold text-white disabled:opacity-50">{state === "busy" ? "Sending…" : "Send suggestion"}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-pill px-4 text-sm font-semibold underline">Cancel</button>
      </div>
    </form>
  );
}
