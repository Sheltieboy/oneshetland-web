"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approvePilotAction, checkOrganiserSlugAction, decideOrganiserAction, grantEntitlementAction, grantPilotPublishAction, linkHubAction, setHubVerifiedAction, markTestAction, moderateEditionAction, revokePilotAction, setPilotSwitchAction, setupHubOrganiserAction, voidEntitlementAction, type Result,
} from "@/app/admin/editions/actions";
import { ADMIN_ONLY_DECISIONS, FEATURE_LABEL, GRANT_FEATURES, GRANT_PRESETS, decisionsFor, hubStage, slugProblem, type HubChoice, type OrganiserDecision } from "@/app/admin/editions/helpers";

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

/** Link an existing organiser to a Hub: choose the Hub by name (its id is handled here, never typed). */
export function LinkHubForm({ organiserId, current, hubs }: { organiserId: string; current: string | null; hubs: { id: string; name: string; verified: boolean }[] }) {
  const { pending, run, note } = useRun();
  const [hub, setHub] = useState(current ?? "");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => linkHubAction({ organiserId, hubId: hub }), "Hub linked."); }}>
      <Label htmlFor="hub-id">Hub</Label>
      <div className="flex flex-wrap gap-2">
        <select id="hub-id" value={hub} onChange={(e) => setHub(e.target.value)} className={field + " max-w-md"}>
          <option value="">Choose a Hub…</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}{h.verified ? " (verified)" : ""}</option>)}
        </select>
        <button type="submit" disabled={pending || !hub || hub === current} className={btn}>Link Hub</button>
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

const Chip = ({ tone, children }: { tone: "good" | "warn" | "plain"; children: React.ReactNode }) => (
  <span className={"inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-bold " + (tone === "good" ? "bg-emerald-100 text-emerald-900" : tone === "warn" ? "bg-amber-100 text-amber-900" : "bg-sand text-ink-soft")}>{children}</span>
);

/** Routine actions write their own audit note (who, what, when). This lets the administrator add a line of their own, only if they want to. */
function OptionalNote({ id, value, onChange, label = "Add a note (optional)" }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer select-none py-1 font-semibold text-ink-soft">{label}</summary>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={300} aria-label={label} className={field + " mt-1"} />
    </details>
  );
}

/** The pilot switch. Turning it on exposes nothing by itself: only organisers with a live approval become public. */
export function PilotSwitchForm({ on }: { on: boolean }) {
  const { pending, run, note } = useRun();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={() => run(() => setPilotSwitchAction({ on: !on }), on ? "Pilot switched off. Nothing is public through the pilot." : "Pilot switched on. Only approved organisers are public.")} className={(on ? btnDanger : btnPrimary) + " w-full sm:w-auto"}>{on ? "Switch the pilot off" : "Switch the pilot on"}</button>
      {note}
    </div>
  );
}

/**
 * Set up Editions for a Hub. The administrator searches and taps a Hub; its name fills in, the web address is suggested and checked, and the audit note is written
 * for them. Hubs that already have an organiser are shown but cannot be chosen. Nothing here approves the pilot, grants publishing or publishes.
 */
export function HubSetupPicker({ hubs }: { hubs: HubChoice[] }) {
  const { pending, run, note } = useRun();
  const [q, setQ] = useState(""), [picked, setPicked] = useState<string | null>(null);
  const [editing, setEditing] = useState(false), [name, setName] = useState(""), [slug, setSlug] = useState(""), [extra, setExtra] = useState("");
  const [remote, setRemote] = useState<{ slug: string; ok: boolean; message: string } | null>(null);
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);
  const hub = hubs.find((h) => h.id === picked) ?? null;
  const shown = useMemo(() => { const n = q.trim().toLowerCase(); return n ? hubs.filter((h) => h.name.toLowerCase().includes(n)) : hubs; }, [hubs, q]);
  
  const choose = (h: HubChoice) => { setPicked(h.id); setName(h.name); setSlug(h.suggestedSlug); setEditing(false); setExtra(""); setDone(null); };

  // While the address is being edited: the format is judged at once (during render); availability is asked of the server shortly after they stop typing.
  const formatProblem = editing ? slugProblem(slug, []) : null;
  useEffect(() => {
    if (!editing || !hub || slugProblem(slug, [])) return;
    const t = setTimeout(async () => { const r = await checkOrganiserSlugAction({ slug }); setRemote({ slug, ...r }); }, 350);
    return () => clearTimeout(t);
  }, [slug, editing, hub]);
  const check = formatProblem ? { ok: false, message: formatProblem } : remote && remote.slug === slug ? remote : editing ? null : { ok: true, message: "Available." };

  const available = hubs.filter((h) => !h.organiser).length;
  const submit = () => {
    if (!hub) return;
    run(async () => {
      const r = await setupHubOrganiserAction({ hubId: hub.id, name: name.trim() || hub.name, slug, note: extra });
      if (r.ok) setDone({ id: r.organiserId, name: hub.name });
      return r;
    }, `Editions set up for ${hub.name}. It is not approved for the pilot yet.`, () => { setPicked(null); setEditing(false); setExtra(""); });
  };

  return (
    <div className="space-y-3">
      {!hubs.length ? <p className="text-sm text-ink-muted">There are no active Hubs.</p> : (
        <>
          <div>
            <Label htmlFor="hub-search">Find a Hub</Label>
            <input id="hub-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${hubs.length} Hub${hubs.length === 1 ? "" : "s"} by name`} autoComplete="off" className={field} />
            <p className="mt-1 text-xs text-ink-muted">{available ? `${available} ready to set up.` : "Every active Hub already has an organiser."}</p>
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto" aria-label="Hubs">
            {!shown.length && <li className="rounded-lg border border-dashed border-line p-3 text-sm text-ink-muted">No Hub matches “{q}”.</li>}
            {shown.map((h) => { const stage = hubStage(h); const sel = h.id === picked; return (
              <li key={h.id}>
                {h.organiser ? (
                  <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-sand/50 p-3">
                    <span className="font-bold text-ink">{h.name}</span>
                    <Chip tone={h.verified ? "good" : "plain"}>{h.verified ? "Verified" : "Not verified"}</Chip>
                    <Chip tone={h.organiser.approved ? "good" : "warn"}>{h.organiser.approved ? "Approved for the pilot" : "Already set up"}</Chip>
                    <Link href={`/admin/editions/organisers/${h.organiser.id}`} className="ml-auto text-sm font-bold text-navy hover:underline">Open organiser</Link>
                    <span className="basis-full text-xs text-ink-muted">{stage.next}</span>
                  </div>
                ) : (
                  <button type="button" aria-pressed={sel} onClick={() => choose(h)} className={"flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy " + (sel ? "border-navy bg-navy/5" : "border-line hover:bg-sand")}>
                    <span className="font-bold text-ink">{h.name}</span>
                    <Chip tone={h.verified ? "good" : "plain"}>{h.verified ? "Verified" : "Not verified"}</Chip>
                    <span className="ml-auto text-sm font-bold text-navy">{sel ? "Selected" : "Choose"}</span>
                  </button>
                )}
              </li>); })}
          </ul>
        </>
      )}

      {hub && (
        <section aria-label={`Set up Editions for ${hub.name}`} className="space-y-3 rounded-xl border border-navy/30 bg-white p-4">
          <h4 className="text-base font-extrabold text-ink">Set up Editions for {hub.name}</h4>
          {!editing ? (
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="font-semibold text-ink-soft">Organiser name</dt><dd className="text-ink">{name}</dd>
              <dt className="font-semibold text-ink-soft">Web address</dt><dd className="text-ink"><span className="break-all">/organisers/{slug}</span> <span className="whitespace-nowrap text-emerald-800">· available</span></dd>
              <dt className="font-semibold text-ink-soft">Run by</dt><dd className="text-ink">{hub.name}&apos;s owner and committee</dd>
            </dl>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="hs-name">Organiser name</Label><input id="hs-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={field} /></div>
              <div>
                <Label htmlFor="hs-slug">Web address</Label>
                <div className="flex items-center gap-1"><span className="text-sm text-ink-muted">/organisers/</span><input id="hs-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} maxLength={60} className={field} spellCheck={false} autoCapitalize="none" aria-describedby="hs-slug-state" /></div>
                <p id="hs-slug-state" role="status" aria-live="polite" className={"mt-1 min-h-5 text-sm " + (check ? (check.ok ? "text-emerald-800" : "text-rose-700") : "text-ink-muted")}>{check ? check.message : "Checking…"}</p>
              </div>
            </div>
          )}
          <button type="button" onClick={() => { if (editing) { setName(hub.name); setSlug(hub.suggestedSlug); } setEditing(!editing); }} className="text-sm font-bold text-navy hover:underline">{editing ? "Use the suggested details" : "Edit name or web address"}</button>
          <OptionalNote id="hs-note" value={extra} onChange={setExtra} />
          <ul className="space-y-1 rounded-lg bg-sand p-3 text-sm text-ink-soft">
            <li>This creates the organiser only. It does <strong>not</strong> approve the pilot, grant publishing or publish anything.</li>
            {!hub.verified && <li>This Hub is not verified yet. Verify it below before you approve the organiser for the pilot.</li>}
            <li>The audit log records who did this and when.</li>
          </ul>
          <button type="button" disabled={pending || !name.trim() || (editing && (!check || !check.ok))} onClick={submit} className={btnPrimary + " w-full sm:w-auto"}>{pending ? "Setting up…" : `Set up Editions for ${hub.name}`}</button>
        </section>
      )}
      {done && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>{done.name}</strong> is set up. Next: <Link href={`/admin/editions/organisers/${done.id}`} className="font-bold underline">open the organiser</Link> to approve it for the pilot when you are ready.</p>
      )}
      {note}
    </div>
  );
}

/** Approve ONE organiser for the pilot with one tap. Withdrawing asks for confirmation first because it ends public access at once. */
export function PilotApprovalForm({ organiserId, approved }: { organiserId: string; approved: boolean }) {
  const { pending, run, note } = useRun();
  const [why, setWhy] = useState(""), [confirm, setConfirm] = useState(false);
  if (!approved) return (
    <div className="space-y-2">
      <OptionalNote id="pilot-note" value={why} onChange={setWhy} />
      <button type="button" disabled={pending} onClick={() => run(() => approvePilotAction({ organiserId, note: why }), "Approved for the pilot.", () => setWhy(""))} className={btnPrimary + " w-full sm:w-auto"}>Approve for the pilot</button>
      {note}
    </div>
  );
  return (
    <div className="space-y-2">
      {!confirm ? <button type="button" onClick={() => setConfirm(true)} className={btn + " w-full sm:w-auto"}>Withdraw pilot approval…</button> : (
        <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="text-sm font-semibold text-rose-900">This ends public access to this organiser and its Editions straight away. The team keeps its drafts.</p>
          <OptionalNote id="pilot-note" value={why} onChange={setWhy} label="Add a reason (optional)" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => revokePilotAction({ organiserId, reason: why }), "Pilot approval withdrawn. Public access has ended.", () => { setWhy(""); setConfirm(false); })} className={btnDanger}>Yes, withdraw approval</button>
            <button type="button" onClick={() => setConfirm(false)} className={btn}>Keep it approved</button>
          </div>
        </div>
      )}
      {note}
    </div>
  );
}

/** 90-day publish entitlement for an approved pilot organiser; use it again in the last 30 days to renew. */
export function PilotGrantForm({ editionId }: { editionId: string }) {
  const { pending, run, note } = useRun();
  const [why, setWhy] = useState("");
  return (
    <div className="space-y-2">
      <OptionalNote id="pg-why" value={why} onChange={setWhy} />
      <button type="button" disabled={pending} onClick={() => run(() => grantPilotPublishAction({ editionId, reason: why }), "Pilot publishing granted for 90 days.", () => setWhy(""))} className={btnPrimary + " w-full sm:w-auto"}>Grant or renew 90 days of pilot publishing</button>
      {note}
    </div>
  );
}

/** Verify (or remove verification from) one Hub. Verification is a trust label the platform already uses, so it asks for one deliberate confirmation. */
export function HubVerifyForm({ hubId, verified, hubName }: { hubId: string; verified: boolean; hubName?: string }) {
  const { pending, run, note } = useRun();
  const [why, setWhy] = useState(""), [open, setOpen] = useState(false);
  const label = hubName ?? "this Hub";
  return (
    <div className="space-y-2">
      {!open ? <button type="button" onClick={() => setOpen(true)} className={(verified ? btn : btnPrimary) + " w-full sm:w-auto"}>{verified ? "Remove verification…" : `Verify ${label}…`}</button> : (
        <div className={"space-y-2 rounded-lg border p-3 " + (verified ? "border-rose-200 bg-rose-50" : "border-amber-300 bg-amber-50")}>
          <p className={"text-sm font-semibold " + (verified ? "text-rose-900" : "text-amber-900")}>
            {verified ? `${label} will lose its verified tick, and anything it has in the pilot stops being public. Events it already has are not changed.` : `Only verify ${label} once you have checked its committee. A verified Hub gets a tick across OneShetland, and its islands-wide events are calendar-approved without review.`}
          </p>
          <OptionalNote id={`hv-${hubId}`} value={why} onChange={setWhy} label="Add what you checked (optional)" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => setHubVerifiedAction({ hubId, verified: !verified, note: why }), verified ? "Verification removed." : "Hub verified.", () => { setWhy(""); setOpen(false); })} className={verified ? btnDanger : btnPrimary}>{verified ? "Yes, remove verification" : "Yes, verify"}</button>
            <button type="button" onClick={() => setOpen(false)} className={btn}>Cancel</button>
          </div>
        </div>
      )}
      {note}
    </div>
  );
}
