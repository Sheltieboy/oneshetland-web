"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/admin/AdminUI";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { resumeOutreachAction, stopOutreachAction } from "@/app/admin/launch-partners/actions";
import { runGuarded } from "@/lib/launch-partners/invitation-replace";
import { Section, inputCls } from "./fields";
import type { OutreachBlock, PipelineRow } from "@/lib/launch-partners/status";

export const OUTREACH_REASON_LABEL: Record<OutreachBlock["reason"], string> = {
  requested: "They asked not to be contacted again",
  bounced: "The address bounced / is undeliverable",
  complaint: "They complained",
  incorrect_contact: "Wrong or duplicate contact",
  admin: "Admin decision",
};
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }) : "");

/**
 * "Do not contact" for Launch Partner outreach. It records the decision in the database, where the SEND itself enforces it: a stale page, a
 * second tab or a direct call cannot get an invitation out for a business (or a contact address) that has been stopped. It touches nothing else —
 * no listing, claim, plan or account email — and removing it is deliberate (a reason is required and recorded). The internal note is for
 * administrators only and is never shown to the recipient or the owner.
 */
export function OutreachStopSection({ row, businessName }: { row: PipelineRow; businessName: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [reason, setReason] = useState<OutreachBlock["reason"]>("requested");
  const [note, setNote] = useState("");
  const [lift, setLift] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const o = row.outreach ?? null;

  async function go(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setErr(null);
    const g = await runGuarded(fn);
    setBusy(false);
    if (!g.ok) { setErr(g.error); router.refresh(); return false; }
    if (!g.value.ok) { setErr((g.value as { error: string }).error); return false; }
    router.refresh(); return true;
  }

  return (
    <Section id="outreach" title="Do not contact" sub="Stop Launch Partner outreach to this business. It affects launch invitation emails only — nothing else about the business, its claim, its plan or any account email changes.">
      {o ? (
        <div role="region" aria-label="Launch Partner outreach stopped" className="space-y-2 rounded-xl border-2 border-rose-300 bg-rose-50 p-4">
          <div className="flex flex-wrap items-center gap-2"><StatusPill label="Launch Partner outreach stopped" tone="red" /></div>
          <p className="text-sm text-rose-900">
            {o.scope === "business"
              ? <>No Launch Partner invitation can be sent to <strong>{businessName}</strong>, whoever the contact is.</>
              : <>This <strong>contact address</strong> was stopped through another business, so no Launch Partner invitation can be sent to it from here either.</>}
            {" "}The send is refused by the server, so an old page or a second tab cannot get past it.
          </p>
          <dl className="grid gap-x-6 gap-y-1 text-sm text-rose-900 sm:grid-cols-2">
            <div><dt className="inline font-semibold">Why: </dt><dd className="inline">{OUTREACH_REASON_LABEL[o.reason] ?? o.reason}</dd></div>
            <div><dt className="inline font-semibold">Recorded: </dt><dd className="inline">{when(o.since)}{o.by ? ` · by ${o.by}` : ""}</dd></div>
            {o.note && <div className="sm:col-span-2"><dt className="inline font-semibold">Internal note (never shown to them): </dt><dd className="inline">{o.note}</dd></div>}
          </dl>
          {o.scope === "business" ? (
            <details className="rounded-lg border border-rose-300 bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold text-rose-900">Remove this suppression…</summary>
              <div className="mt-2 space-y-2">
                <p className="text-sm text-ink-soft">Only do this if it was added in error, or they have asked to hear from you again. It is recorded in the history with your reason.</p>
                <label className="block text-sm font-semibold text-ink-soft">Reason (required)
                  <textarea value={lift} onChange={(e) => setLift(e.target.value)} maxLength={500} rows={2} className={inputCls + " mt-1 w-full"} placeholder="e.g. Added to the wrong business by mistake" />
                </label>
                <button disabled={busy || lift.trim().length < 3} onClick={async () => { if (await confirm({ title: "Allow Launch Partner outreach again?", body: `This lets Launch Partner invitations be sent to ${businessName} again. Only continue if they asked not to be contacted by mistake, or have asked to hear from you. Your reason is recorded.`, confirmLabel: "Remove suppression", danger: true })) { if (await go(() => resumeOutreachAction(row.id, lift, { confirm: true }))) setLift(""); } }} className="rounded-pill border border-rose-300 px-4 py-1.5 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-40">Remove suppression</button>
              </div>
            </details>
          ) : (
            <p className="text-sm text-rose-900">To lift it, open the business it was recorded against: <Link href={`/admin/launch-partners/for-business/${o.business_id}`} className="font-semibold underline underline-offset-2">open that launch partner →</Link></p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">If they replied asking not to hear from you again (the invitation tells them they can just reply), record it here. From then on the server refuses any Launch Partner invitation to this business and to the contact address on file.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-ink-soft">Why
              <select value={reason} onChange={(e) => setReason(e.target.value as OutreachBlock["reason"])} className={inputCls + " mt-1 w-full"}>
                {(Object.keys(OUTREACH_REASON_LABEL) as OutreachBlock["reason"][]).map((k) => <option key={k} value={k}>{OUTREACH_REASON_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-ink-soft">Internal note (optional — never shown to them)
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={inputCls + " mt-1 w-full"} placeholder="e.g. Replied by email on 7 Oct" />
            </label>
          </div>
          <button disabled={busy} onClick={async () => { if (await confirm({ title: "Stop Launch Partner outreach?", body: `OneShetland will refuse to send any further Launch Partner invitation to ${businessName} or to the contact address on file. Their listing, claim, plan and account emails are not touched. Removing this later is deliberate and needs a reason.`, confirmLabel: "Stop outreach", danger: true })) { if (await go(() => stopOutreachAction(row.id, { reason, note }, { confirm: true }))) setNote(""); } }} className="rounded-pill border border-rose-300 px-5 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-40">Stop Launch Partner outreach</button>
        </div>
      )}
      {err && <p role="alert" className="text-sm font-semibold text-rose-700">{err}</p>}
    </Section>
  );
}
