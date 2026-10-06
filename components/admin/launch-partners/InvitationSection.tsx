"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/admin/AdminUI";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { issueInvitationAction, revokeInvitationAction, setClaimModeAction } from "@/app/admin/launch-partners/actions";
import { Section, inputCls } from "./fields";
import { replacementPlan, runGuarded, type ReplacementPlan } from "@/lib/launch-partners/invitation-replace";
import type { PipelineRow } from "@/lib/launch-partners/status";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }) : "—");
const TONE = { none: "gray", open: "blue", "claim pending": "amber", claimed: "green", revoked: "red", expired: "gray" } as const;

/**
 * The private invitation. Generating it creates a link and NOTHING else — no email is sent. The link is shown once
 * (the database keeps only a hash) and is never saved in the draft. Claiming stays closed on the preview until you open it.
 */
export function InvitationSection({ row, claimMode, onLink }: { row: PipelineRow; claimMode: "live" | "holding"; /** The private link and its expiry, in memory only, right after generation (null when cleared). */ onLink?: (l: { url: string; expiresAt: string } | null) => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** The replacement waiting for an explicit yes/no, shown in the page itself (not a pop-up that can be missed or dismissed by a stray key). */
  const [pending, setPending] = useState<ReplacementPlan | null>(null);
  const inv = row.invite;
  const usable = inv.status === "open" || inv.status === "claim pending" || inv.status === "claimed";
  const canGenerate = row.is_test || row.stage === "ready_to_invite" || row.stage === "sent";

  /** Click on "Generate": ask first when something would be revoked; otherwise go straight ahead. */
  function generate() {
    setErr(null);
    const plan = replacementPlan({ emailed: !!row.sent_at, usable });
    if (plan.confirm) { setPending(plan); return; }
    void issue(plan);
  }
  /** The ONLY place the server is asked to issue. `plan.replaceSent` is passed only for an invitation that was emailed. */
  async function issue(plan: ReplacementPlan) {
    setPending(null); setBusy(true); setErr(null); setLink(null);
    const r = await runGuarded(() => issueInvitationAction(row.id, days, { replaceSent: plan.replaceSent }));
    setBusy(false); // whatever happened, the button is released
    if (!r.ok) { setErr(r.error); router.refresh(); return; }
    if (!r.value.ok) { setErr(r.value.error); router.refresh(); return; }
    const url = `${window.location.origin}${r.value.path}`;
    setLink(url); onLink?.({ url, expiresAt: r.value.expiresAt }); router.refresh();
  }
  async function revoke() {
    if (!(await confirm({ title: "Revoke this invitation?", body: "The link stops working immediately. A claim already sent is not affected.", confirmLabel: "Revoke", danger: true }))) return;
    setBusy(true); setErr(null);
    const g = await runGuarded(() => revokeInvitationAction(row.id));
    setBusy(false);
    if (!g.ok) { setErr(g.error); router.refresh(); return; }
    if (!g.value.ok) setErr(g.value.error); else { setLink(null); onLink?.(null); router.refresh(); }
  }
  async function toggleClaim() {
    setBusy(true); setErr(null);
    const g = await runGuarded(() => setClaimModeAction(row.id, claimMode === "live" ? "holding" : "live"));
    setBusy(false);
    if (!g.ok) { setErr(g.error); router.refresh(); return; }
    if (!g.value.ok) setErr(g.value.error); else router.refresh();
  }

  return (
    <Section id="invitation" title="Invitation" sub="A private link to the preview. Generating it sends nothing to anyone.">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={inv.status === "none" ? "Not issued" : inv.status === "claim pending" ? "Used for a claim" : inv.status[0].toUpperCase() + inv.status.slice(1)} tone={TONE[inv.status]} />
        {inv.created_at && <span className="text-sm text-ink-muted">Issued {day(inv.created_at)}{inv.expires_at ? ` · expires ${day(inv.expires_at)}` : ""}</span>}
      </div>
      {!canGenerate && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Mark this partner <strong>Ready to invite</strong> (in Status, below) before generating its invitation.</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-ink-soft">Valid for (days)
          <input type="number" min={1} max={120} value={days} onChange={(e) => setDays(Math.min(120, Math.max(1, Number(e.target.value) || 30)))} className={inputCls + " w-24"} />
        </label>
        <button onClick={generate} disabled={busy || !canGenerate || !!pending} className="rounded-pill bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">{busy ? "Working…" : usable ? "Generate a new private invitation" : "Generate private invitation"}</button>
        {usable && <button onClick={revoke} disabled={busy} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">Revoke</button>}
      </div>
      {pending?.confirm && (
        <div role="alertdialog" aria-labelledby="replace-title" aria-describedby="replace-body" className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4">
          <p id="replace-title" className="text-sm font-bold text-rose-900">{pending.confirm.title}</p>
          <p id="replace-body" className="mt-1 text-sm text-rose-900">{pending.confirm.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button autoFocus onClick={() => setPending(null)} className="rounded-pill border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">{pending.confirm.cancelLabel}</button>
            <button onClick={() => void issue(pending)} className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95">{pending.confirm.confirmLabel}</button>
          </div>
        </div>
      )}
      {err && <p role="alert" className="text-sm font-semibold text-rose-700">{err}</p>}
      {link && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3" role="status">
          <p className="text-sm font-bold text-amber-900">Copy this link now — it will not be shown again.</p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-xs" aria-label="Invitation link" />
          <button onClick={() => navigator.clipboard?.writeText(link)} className="mt-2 rounded-pill border border-amber-400 px-4 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100">Copy</button>
        </div>
      )}
      <div className="rounded-xl bg-cream/70 p-4 text-sm text-ink-soft">
        <p className="font-bold text-ink">What the link does</p>
        <p className="mt-1">Opens <code className="rounded bg-sand px-1">/launch/{row.slug}</code> privately. The token is moved into a cookie and removed from the address bar, so it isn&rsquo;t left in history, referrers or analytics. Opening it records that it was viewed (not a claim, not consent). Only a hash of the token is stored.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
        <div>
          <p className="text-sm font-bold text-ink">Claim button on the preview: {claimMode === "live" ? "Open" : "Closed (holding)"}</p>
          <p className="text-xs text-ink-muted">Closed, the button explains claiming isn&rsquo;t open yet. It can only be opened while an invitation is live. Claiming never publishes anything.</p>
        </div>
        <button onClick={toggleClaim} disabled={busy || (claimMode === "holding" && !usable)} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand disabled:opacity-40">{claimMode === "live" ? "Close claiming" : "Open claiming"}</button>
      </div>
    </Section>
  );
}
