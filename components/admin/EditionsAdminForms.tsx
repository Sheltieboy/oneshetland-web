"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  decideOrganiserAction, grantEntitlementAction, linkHubAction, markTestAction, moderateEditionAction, voidEntitlementAction, type Result,
} from "@/app/admin/editions/actions";
import { ADMIN_ONLY_DECISIONS, FEATURE_LABEL, GRANT_FEATURES, GRANT_PRESETS, decisionsFor, type OrganiserDecision } from "@/app/admin/editions/helpers";

const field = "auth-input w-full";
const btn = "min-h-11 rounded-pill border border-line-strong px-4 text-sm font-bold text-ink-soft transition hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50";
const btnPrimary = "min-h-11 rounded-pill bg-navy px-5 text-sm font-bold text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50";
const btnDanger = "min-h-11 rounded-pill bg-rose-600 px-5 text-sm font-bold text-white transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:opacity-50";

/** Runs a server action, shows its outcome in a live region, refreshes the page on success. */
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Result>, done: string, after?: () => void) => start(async () => {
    setMsg(null);
    try {
      const r = await fn();
      if (r.ok) { setMsg({ ok: true, text: done }); after?.(); router.refresh(); } else setMsg({ ok: false, text: r.error });
    } catch { setMsg({ ok: false, text: "Something went wrong. Please try again." }); }
  });
  const note = <p role="status" aria-live="polite" className={"min-h-5 text-sm " + (msg ? (msg.ok ? "text-emerald-800" : "text-rose-700") : "")}>{msg?.text}</p>;
  return { pending, run, note };
}
const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) => <label htmlFor={htmlFor} className="mb-1 block text-sm font-bold text-ink">{children}</label>;

const DECISION_LABEL: Record<OrganiserDecision, string> = { verify: "Verify", reject: "Reject", reinstate: "Reinstate", suspend: "Suspend" };

/** Verify / reject / reinstate (administrators) and suspend (staff). Administrator-only buttons are not rendered for anyone else; the database refuses anyway. */
export function DecideOrganiserForm({ organiserId, status, reserved, isAdmin }: { organiserId: string; status: string; reserved: boolean; isAdmin: boolean }) {
  const { pending, run, note } = useRun();
  const [text, setText] = useState("");
  const options = decisionsFor(status).filter((d) => isAdmin || !ADMIN_ONLY_DECISIONS.includes(d));
  if (!options.length) return <p className="text-sm text-ink-muted">No decision is available for an organiser in this state{isAdmin ? "" : " for your role"}.</p>;
  const needsNote = reserved && options.includes("verify");
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="decision-note">Note{needsNote ? " (required, 10+ characters, for a reserved-name organiser)" : " (kept in the audit log; the organiser may see it)"}</Label>
        <textarea id="decision-note" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className={field} />
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((d) => (
          <button key={d} type="button" disabled={pending} className={d === "verify" || d === "reinstate" ? btnPrimary : d === "suspend" || d === "reject" ? btnDanger : btn}
            onClick={() => { if (d === "verify" && needsNote && text.trim().length < 10) return void run(async () => ({ ok: false, error: "A reserved-name organiser needs a written verification note of at least 10 characters." }), ""); run(() => decideOrganiserAction({ organiserId, decision: d, note: text }), `${DECISION_LABEL[d]} recorded.`, () => setText("")); }}>
            {DECISION_LABEL[d]}
          </button>
        ))}
      </div>
      {note}
    </div>
  );
}

export function LinkHubForm({ organiserId, current }: { organiserId: string; current: string | null }) {
  const { pending, run, note } = useRun();
  const [hub, setHub] = useState(current ?? "");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => linkHubAction({ organiserId, hubId: hub }), "Hub linked."); }}>
      <Label htmlFor="hub-id">Hub id (UUID)</Label>
      <div className="flex flex-wrap gap-2">
        <input id="hub-id" value={hub} onChange={(e) => setHub(e.target.value)} className={field + " max-w-md"} placeholder="00000000-0000-0000-0000-000000000000" spellCheck={false} />
        <button type="submit" disabled={pending || !hub.trim()} className={btn}>Link hub</button>
      </div>
      {note}
    </form>
  );
}

export function MarkTestButton({ organiserId, editionId, label }: { organiserId: string; editionId?: string | null; label: string }) {
  const { pending, run, note } = useRun();
  const [sure, setSure] = useState(false);
  return (
    <div className="space-y-2">
      {sure
        ? <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-ink-soft">This hides it from the public for good. Continue?</span>
            <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => markTestAction({ organiserId, editionId }), "Marked as test.", () => setSure(false))}>Yes, mark as test</button>
            <button type="button" className={btn} onClick={() => setSure(false)}>Cancel</button></div>
        : <button type="button" className={btn} onClick={() => setSure(true)}>{label}</button>}
      {note}
    </div>
  );
}

export function ModerateForm({ editionId, status, suspendedReason }: { editionId: string; status: string; suspendedReason: string | null }) {
  const { pending, run, note } = useRun();
  const [reason, setReason] = useState("");
  const suspended = status === "suspended";
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => moderateEditionAction({ editionId, action: suspended ? "restore" : "suspend", reason }), suspended ? "Restored to draft." : "Suspended.", () => setReason("")); }}>
      {suspended && <p className="text-sm text-ink-soft">Suspended for: {suspendedReason || "no reason recorded"}. Restoring returns the Edition to draft; the organiser must publish it again.</p>}
      <Label htmlFor="mod-reason">Reason (required, 5+ characters; kept in the audit log)</Label>
      <textarea id="mod-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
      <button type="submit" disabled={pending || reason.trim().length < 5} className={suspended ? btnPrimary : btnDanger}>{suspended ? "Restore to draft" : "Suspend Edition"}</button>
      {note}
    </form>
  );
}

export function GrantForm({ editionId }: { editionId: string }) {
  const { pending, run, note } = useRun();
  const [feature, setFeature] = useState<string>("publish");
  const [preset, setPreset] = useState<string>("90");
  const [customEnd, setCustomEnd] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => grantEntitlementAction({ editionId, feature, preset, customEnd, reason }), "Entitlement granted.", () => setReason("")); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="g-feature">Feature</Label>
          <select id="g-feature" value={feature} onChange={(e) => setFeature(e.target.value)} className={field}>{GRANT_FEATURES.map((f) => <option key={f} value={f}>{FEATURE_LABEL[f]}</option>)}</select></div>
        <div><Label htmlFor="g-preset">Runs for</Label>
          <select id="g-preset" value={preset} onChange={(e) => setPreset(e.target.value)} className={field}>
            {GRANT_PRESETS.map((d) => <option key={d} value={d}>{d} days from now</option>)}<option value="custom">Custom end date</option></select></div>
      </div>
      {preset === "custom" && <div><Label htmlFor="g-end">End date (up to 24 months)</Label><input id="g-end" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={field + " max-w-xs"} /></div>}
      <div><Label htmlFor="g-reason">Reason (required, 5+ characters; kept in the audit log)</Label><input id="g-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={field} /></div>
      <button type="submit" disabled={pending || reason.trim().length < 5} className={btnPrimary}>Grant entitlement</button>
      {note}
    </form>
  );
}

export function VoidButton({ entitlementId, editionId }: { entitlementId: string; editionId?: string }) {
  const { pending, run, note } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button type="button" className={btn + " !min-h-9 !px-3 !text-xs"} onClick={() => setOpen(true)}>Void</button>;
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => voidEntitlementAction({ entitlementId, editionId, reason }), "Voided.", () => setOpen(false)); }}>
      <label className="sr-only" htmlFor={`v-${entitlementId}`}>Reason for voiding</label>
      <input id={`v-${entitlementId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Reason (5+ characters)" className={field} />
      <div className="flex gap-2"><button type="submit" disabled={pending || reason.trim().length < 5} className={btnDanger + " !min-h-9 !px-3 !text-xs"}>Void entitlement</button>
        <button type="button" className={btn + " !min-h-9 !px-3 !text-xs"} onClick={() => setOpen(false)}>Cancel</button></div>
      {note}
    </form>
  );
}
