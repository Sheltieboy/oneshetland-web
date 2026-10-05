"use client";

import { useState } from "react";
import { saveEmailAction } from "@/app/admin/launch-partners/actions";
import { Field, SaveBar, Section, inputCls } from "./fields";
import { checkEmail, composeInvitationEmail, renderPreview } from "@/lib/launch-partners/email";

/**
 * The personal invitation email — prepared and stored, NEVER sent from here. There is deliberately no Send control
 * that does anything: copy it and send it yourself, pasting the private link where the placeholder is.
 */
export function EmailSection({ id, businessName, positioning, initial }: {
  id: string; businessName: string; positioning: string | null;
  initial: { contactName: string | null; contactEmail: string | null; subject: string | null; body: string | null };
}) {
  const [contactName, setContactName] = useState(initial.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(initial.contactEmail ?? "");
  const [subject, setSubject] = useState(initial.subject ?? "");
  const [body, setBody] = useState(initial.body ?? "");
  const [copied, setCopied] = useState(false);
  const check = checkEmail({ subject, body, contactEmail });
  const prev = renderPreview({ subject, body });

  function fill() { const e = composeInvitationEmail({ businessName, contactName, positioning }); setSubject(e.subject); setBody(e.body); }
  async function save() {
    const r = await saveEmailAction(id, { contactName, contactEmail, subject, body });
    return r.ok ? null : r.error;
  }
  async function copy() { await navigator.clipboard?.writeText(`Subject: ${prev.subject}\n\n${prev.body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }

  return (
    <Section id="email" title="Email" sub="A personal note from you. Prepared here; you send it yourself.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name"><input className={inputCls} value={contactName} onChange={(e) => setContactName(e.target.value)} /></Field>
        <Field label="Contact email" hint="from their public site, or entered by you — visible to admins only"><input type="email" className={inputCls} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={fill} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">{body ? "Start again from the template" : "Write it from the template"}</button>
      </div>
      <Field label="Subject"><input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="Message" hint="keep the placeholder where the private link goes"><textarea className={inputCls + " font-mono"} rows={14} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <SaveBar onSave={save} label="Save email" />

      <div className="rounded-xl border border-line bg-cream/60 p-4" aria-label="Email preview">
        <p className="eyebrow text-ink-muted">Preview</p>
        {body ? (
          <>
            <p className="mt-2 text-sm"><span className="font-bold text-ink">To:</span> {contactEmail || "—"}</p>
            <p className="mt-1 text-sm"><span className="font-bold text-ink">Subject:</span> {prev.subject}</p>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-soft">{prev.body}</pre>
          </>
        ) : <p className="mt-2 text-sm text-ink-muted">Nothing written yet.</p>}
      </div>
      {check.problems.length > 0 && body && <ul className="list-disc pl-5 text-sm text-amber-800">{check.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled aria-disabled="true" title="Sending from OneShetland is not switched on" className="cursor-not-allowed rounded-pill bg-sand px-5 py-2 text-sm font-semibold text-ink-faint">Send — not enabled</button>
        <button type="button" onClick={copy} disabled={!body} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand disabled:opacity-40">{copied ? "Copied" : "Copy message"}</button>
        <p className="text-xs text-ink-muted">Sending is off in this version. Nothing here emails anyone.</p>
      </div>
    </Section>
  );
}
