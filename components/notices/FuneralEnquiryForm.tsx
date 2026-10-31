"use client";

import { useRef, useState } from "react";
import { Turnstile, type TurnstileHandle } from "@/components/ui/Turnstile";
import { ENQUIRY_ACTION, enquiryProblem, sendFuneralEnquiry } from "@/lib/funeral-enquiry-client";
import { Field, btnPrimary, inputCls } from "@/components/notices/Fields";

const KINDS: [string, string][] = [["correction", "Something is wrong and needs correcting"], ["takedown", "Please remove this announcement"], ["enquiry", "I have a question"]];

/**
 * No account needed. The security check (Cloudflare Turnstile) is verified by OUR server, not trusted from the browser; the form posts to the
 * submit-funeral-enquiry function, which also limits each visitor so one person cannot use up anyone else's allowance. A hidden field catches simple bots.
 * Nothing is cleared when sending fails: the visitor can fix the problem and send again (the security check is simply redone).
 */
export function FuneralEnquiryForm({ id }: { id: string }) {
  const [kind, setKind] = useState("correction");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trap = useRef<HTMLInputElement>(null);
  const check = useRef<TurnstileHandle>(null);
  const problem = enquiryProblem(message, contact);

  if (sent) {
    return (
      <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
        <p className="font-bold">Thank you. We have your request.</p>
        <p className="mt-1 text-sm">We will check it and, if we need to, contact you. Nothing has been changed yet.</p>
      </div>
    );
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (trap.current?.value) { setSent(true); return; }            // a bot filled the hidden field: appear to succeed, send nothing
    setBusy(true);
    const r = await sendFuneralEnquiry({ id, kind, message, contact, name, relationship, token, website: trap.current?.value });
    setBusy(false);
    if (r.ok) { setSent(true); return; }
    setError(r.message);
    if (r.resetCheck) check.current?.reset();                      // a token is single use; the typed text stays exactly as it was
  }
  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <Field label="What would you like us to do?" htmlFor={`ek${id}`}>
        <select id={`ek${id}`} className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </Field>
      <Field label="Details" hint="Please don't include other people's private details here." htmlFor={`em${id}`}>
        <textarea id={`em${id}`} rows={4} maxLength={1000} className={inputCls} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <Field label="Telephone number or email address" hint="So that we can reach you. Never shown publicly." htmlFor={`ec${id}`}>
        <input id={`ec${id}`} autoComplete="email" className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} />
      </Field>
      <Field label="Your name" optional htmlFor={`en${id}`}><input id={`en${id}`} autoComplete="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Your relationship to the person" optional htmlFor={`er${id}`}><input id={`er${id}`} className={inputCls} value={relationship} onChange={(e) => setRelationship(e.target.value)} /></Field>
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>Leave this empty<input ref={trap} tabIndex={-1} autoComplete="off" name="website" defaultValue="" /></label>
      </div>
      <Turnstile ref={check} action={ENQUIRY_ACTION} cData={id} onToken={setToken} onError={() => setCheckFailed(true)} />
      {error && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
      <button type="submit" disabled={busy || !!problem || !token} className={btnPrimary}>{busy ? "Sending…" : "Send"}</button>
      {problem && (message || contact) ? <p className="text-sm text-ink-soft">{problem}</p> : null}
      {!problem && !token && !checkFailed ? <p className="text-sm text-ink-soft">Completing the security check…</p> : null}
      {checkFailed && <p className="text-sm text-ink-soft">The security check could not load. Please refresh the page, or contact us by telephone (see the support page).</p>}
    </form>
  );
}
