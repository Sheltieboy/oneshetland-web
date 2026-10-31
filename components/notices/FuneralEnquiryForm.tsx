"use client";

import { useRef, useState } from "react";
import { sendFuneralEnquiryAction } from "@/app/notices/actions";
import { enquiryProblem } from "@/lib/notices-actions-core";
import { Field, Status, btnPrimary, inputCls, useAction } from "@/components/notices/Fields";

const KINDS: [string, string][] = [["correction", "Something is wrong and needs correcting"], ["takedown", "Please remove this announcement"], ["enquiry", "I have a question"]];

/** No account needed. A hidden field catches automated submissions; the database rate-limits per announcement, per contact and overall. */
export function FuneralEnquiryForm({ id }: { id: string }) {
  const [kind, setKind] = useState("correction");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [sent, setSent] = useState(false);
  const trap = useRef<HTMLInputElement>(null);
  const { state, run } = useAction();
  const problem = enquiryProblem(message, contact);
  if (sent) {
    return (
      <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
        <p className="font-bold">Thank you. We have your request.</p>
        <p className="mt-1 text-sm">We will check it and, if we need to, contact you. Nothing has been changed yet.</p>
      </div>
    );
  }
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (trap.current?.value) { setSent(true); return; }    // a bot filled the hidden field: appear to succeed, send nothing
      void run(async () => { const r = await sendFuneralEnquiryAction({ id, kind, message, contact, name, relationship }); if (r.ok) setSent(true); return r; }, "Sent.");
    }}>
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
      <Status state={state} />
      <button type="submit" disabled={state.busy || !!problem} className={btnPrimary}>{state.busy ? "Sending…" : "Send"}</button>
      {problem && (message || contact) ? <p className="text-sm text-ink-soft">{problem}</p> : null}
    </form>
  );
}
