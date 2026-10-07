"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/admin/AdminUI";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { resetEmailToDefaultAction, saveEmailAction, sendInvitationEmailAction } from "@/app/admin/launch-partners/actions";
import { Field, SaveBar, Section, inputCls } from "./fields";
import { EMAIL_STATUS_LABEL, checkEmail, emailStatus, isOpeningPrompt, renderInvitationEmail, type EmailStatus } from "@/lib/launch-partners/email";
import { GATE_MESSAGE, evaluateSendGates } from "@/lib/launch-partners/send-core";
import { runGuarded } from "@/lib/launch-partners/invitation-replace";
import type { PipelineRow } from "@/lib/launch-partners/status";

const TONE: Record<EmailStatus, "gray" | "amber" | "blue" | "green"> = { contact_missing: "amber", draft_needed: "amber", draft_ready: "blue", invitation_needed: "blue", ready_to_send: "green", sent: "green" };
/** Said when a send request got no answer: it may or may not have gone, and the server will not send the same invitation twice. */
const SEND_UNKNOWN = "The request didn’t finish, so it isn’t clear whether the email went. Nothing has been resent. This page has been refreshed: if the status now shows Sent, it went — otherwise check your sent mail before trying again. The server will not send the same invitation twice.";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }) : "—");

/**
 * The outreach email: contact, subject, personalised opening, message — then the email exactly as the recipient will
 * receive it, its readiness, and (behind explicit confirmation) the send. The draft is generated when the campaign is
 * created or when you choose "Reset to default template"; it is never regenerated behind your back.
 */
export function EmailSection({ row, slug, businessName, initial, sessionLink }: {
  row: PipelineRow; slug: string; businessName: string;
  initial: { contactName: string | null; contactEmail: string | null; subject: string | null; opening: string | null; body: string | null };
  /** Present only right after the invitation was generated in this page session. The database never keeps it. */
  sessionLink: { url: string; expiresAt: string } | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [f, setF] = useState({ contactName: initial.contactName ?? "", contactEmail: initial.contactEmail ?? "", subject: initial.subject ?? "", opening: initial.opening ?? "", body: initial.body ?? "" });
  const [saved, setSaved] = useState(f);
  const [view, setView] = useState<"html" | "text">("html");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const inv = row.invite;
  const invLive = ["open", "claim pending", "claimed"].includes(inv.status);
  const status = emailStatus({ sentAt: row.sent_at, contactEmail: saved.contactEmail, subject: saved.subject, body: saved.body, opening: saved.opening, stage: row.stage, invitation: { status: inv.status, expiresAt: inv.expires_at } });
  const check = checkEmail({ subject: f.subject, body: f.body, opening: f.opening, contactEmail: f.contactEmail });

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const rendered = useMemo(() => renderInvitationEmail({
    subject: f.subject, body: f.body, opening: f.opening, businessName,
    invitationUrl: sessionLink?.url ?? null,
    maskedUrl: !sessionLink && invLive ? `${origin}/launch/${slug}?invite=[the real link is shown once, when you generate the invitation]` : null,
    invitationExpiresAt: sessionLink?.expiresAt ?? (invLive ? inv.expires_at : null),      // the invitation's real expiry, exactly as the sent email will state it
  }), [f.subject, f.body, f.opening, businessName, sessionLink, invLive, origin, slug, inv.expires_at]);

  // What stands between this draft and a send, from the SAVED values (the server re-checks everything itself).
  const blockers = evaluateSendGates({
    campaign: { id: row.id, slug, businessName, stage: row.stage, sentAt: row.sent_at, contactEmail: saved.contactEmail, subject: saved.subject, opening: saved.opening, body: saved.body, outreachStopped: !!row.outreach },
    invitation: { status: inv.status, expiresAt: inv.expires_at, tokenValidForThisBusiness: !!sessionLink && invLive },
    invitationUrl: sessionLink?.url ?? null, confirmation: { confirm: true, recipient: saved.contactEmail, subject: saved.subject },
  }, { now: () => new Date() });
  const canSend = blockers.length === 0 && !dirty && !busy;

  async function save() {
    const g = await runGuarded(() => saveEmailAction(row.id, f));
    if (!g.ok) return g.error;
    if (g.value.ok) { setSaved(f); router.refresh(); return null; }
    return g.value.error;
  }

  async function reset() {
    if (!(await confirm({ title: "Reset to the default template?", body: <>This <strong>replaces</strong> the current subject, personalised opening and message with the standard template for {businessName}. Any edits you have made to them will be lost. Your contact details are kept.</>, confirmLabel: "Replace my draft", danger: true }))) return;
    setBusy(true); setMsg(null);
    const g = await runGuarded(() => resetEmailToDefaultAction(row.id));
    setBusy(false);
    if (!g.ok) { setMsg({ ok: false, text: g.error }); router.refresh(); return; }
    const r = g.value;
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    const next = { ...f, subject: r.subject, opening: r.opening, body: r.body };
    setF(next); setSaved(next); setMsg({ ok: true, text: "Reset to the default template." }); router.refresh();
  }

  async function send() {
    if (!sessionLink) return;
    const ok = await confirm({
      title: "Send the invitation email?",
      body: (
        <dl className="space-y-2 text-sm">
          <div><dt className="font-bold text-ink">Business</dt><dd>{businessName}</dd></div>
          <div><dt className="font-bold text-ink">Recipient</dt><dd className="break-all">{saved.contactEmail}</dd></div>
          <div><dt className="font-bold text-ink">Subject</dt><dd>{saved.subject}</dd></div>
          <div><dt className="font-bold text-ink">Invitation expires</dt><dd>{when(sessionLink.expiresAt)}</dd></div>
          <p className="pt-1 text-ink-muted">This sends a real email containing the private link. It cannot be unsent.</p>
        </dl>
      ),
      confirmLabel: "Send invitation email", danger: true,
    });
    if (!ok) return;
    setBusy(true); setMsg(null);
    const path = sessionLink.url.slice(sessionLink.url.indexOf("/launch/"));
    const g = await runGuarded(() => sendInvitationEmailAction(row.id, path, { confirm: true, recipient: saved.contactEmail, subject: saved.subject }), 90_000);
    setBusy(false);
    // A request that never answered says NOTHING about whether the email went: do not claim either way, never invite a blind second click.
    if (!g.ok) { setMsg({ ok: false, text: SEND_UNKNOWN }); router.refresh(); return; }
    const r = g.value;
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: r.recorded ? `Sent to ${r.recipient}.` : `Sent to ${r.recipient}, but recording it failed — mark it sent by hand.` }); router.refresh();
  }

  return (
    <Section id="email" title="Email" sub="A personal note from you. Prepared here from the standard template; sent only when you choose to.">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={EMAIL_STATUS_LABEL[status]} tone={TONE[status]} />
        {row.sent_at && <span className="text-sm text-ink-muted">Sent {when(row.sent_at)}</span>}
        {dirty && <span className="text-sm font-semibold text-amber-700">Unsaved changes</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name"><input className={inputCls} value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} /></Field>
        <Field label="Contact email" hint="from their public site, or entered by you — visible to admins only"><input type="email" className={inputCls} value={f.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} /></Field>
      </div>
      <Field label="Subject"><input className={inputCls} value={f.subject} onChange={(e) => set({ subject: e.target.value })} /></Field>
      <Field label="Personalised opening" hint="one or two lines, in your own words — why you chose them">
        <textarea className={inputCls} rows={2} value={f.opening} onChange={(e) => set({ opening: e.target.value })} />
      </Field>
      {isOpeningPrompt(f.opening) && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">This line is a prompt, not a message. Replace it with your own sentence — sending is blocked until you do.</p>}
      <Field label="Message" hint="the standard template; keep {{PERSONALISED_OPENING}} and {{INVITATION_CTA}} where they should appear">
        <textarea className={inputCls + " font-mono"} rows={16} value={f.body} onChange={(e) => set({ body: e.target.value })} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SaveBar onSave={save} label="Save email" />
        <button type="button" onClick={reset} disabled={busy || !!row.sent_at} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand disabled:opacity-40">Reset to default template</button>
      </div>
      {msg && <p role="status" className={"text-sm font-semibold " + (msg.ok ? "text-emerald-700" : "text-rose-700")}>{msg.text}</p>}
      {check.problems.length > 0 && <ul className="list-disc pl-5 text-sm text-amber-800">{check.problems.map((p) => <li key={p}>{p}</li>)}</ul>}

      <div className="rounded-xl border border-line bg-cream/60 p-4" aria-label="Email preview">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow text-ink-muted">Preview email</p>
          <div className="flex gap-1.5" role="tablist" aria-label="Preview format">
            {(["html", "text"] as const).map((k) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={"rounded-pill px-3 py-1 text-xs font-bold " + (view === k ? "bg-ink text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>{k === "html" ? "Email" : "Plain text"}</button>)}
          </div>
        </div>
        <p className="mt-2 text-sm"><span className="font-bold text-ink">To:</span> {f.contactEmail || "—"}</p>
        <p className="mt-1 text-sm"><span className="font-bold text-ink">Subject:</span> {rendered.subject || "—"}</p>
        {view === "html"
          ? <iframe title="The email as the recipient will receive it" sandbox="" srcDoc={rendered.html} className="mt-3 h-[560px] w-full rounded-xl border border-line bg-white" />
          : <pre className="mt-3 max-h-[560px] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-white p-4 font-sans text-sm leading-relaxed text-ink-soft">{rendered.text}</pre>}
        {!sessionLink && !invLive && <p className="mt-3 text-sm text-ink-muted"><strong className="text-ink">Invitation not generated yet.</strong> The button and link are inserted when you generate the invitation, and shown here.</p>}
        {!sessionLink && invLive && <p className="mt-3 text-sm text-ink-muted">An invitation exists, but its link is shown only once, when generated. To send, generate a fresh invitation in this session.</p>}
      </div>

      <div className="space-y-2 rounded-xl border border-line p-4">
        <button type="button" onClick={send} disabled={!canSend} className="rounded-pill bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:bg-sand disabled:text-ink-faint">{busy ? "Working…" : "Send invitation email"}</button>
        {row.sent_at ? <p className="text-sm text-ink-muted">Already recorded as sent.</p> : dirty ? <p className="text-sm text-amber-800">Save your changes first — only the saved draft can be sent.</p>
          : blockers.length > 0 ? <ul className="list-disc pl-5 text-sm text-ink-muted">{[...new Set(blockers)].map((g) => <li key={g}>{GATE_MESSAGE[g]}</li>)}</ul>
          : <p className="text-sm text-ink-muted">Everything is in place. You will be asked to confirm the recipient, subject and expiry before anything is sent.</p>}
        <p className="text-xs text-ink-muted">Sending never happens automatically. It needs a contact, a saved draft, a valid invitation, and your explicit confirmation.</p>
      </div>
    </Section>
  );
}
