"use client";

import { useState } from "react";
import { setHubEventsAutoApproveAction, setHubVerifiedAction } from "@/app/admin/hubs/actions";
import { btn, btnDanger, btnPrimary, field, useRun } from "@/components/admin/EditionsAdminForms";

/** Two controls that never share an action: the Verified badge (a trust label) and Events skip approval (calendar moderation). Each asks for one deliberate confirmation. */
export function HubSwitches({ hubId, name, verified, eventsSkipApproval }: { hubId: string; name: string; verified: boolean; eventsSkipApproval: boolean }) {
  return (
    <article className="rounded-card border border-line bg-paper p-4 shadow-soft sm:p-5" aria-label={name}>
      <h2 className="mb-4 font-display text-lg font-bold text-ink">{name}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <VerifiedControl hubId={hubId} name={name} on={verified} />
        <EventsControl hubId={hubId} name={name} on={eventsSkipApproval} />
      </div>
    </article>
  );
}

function Panel({ title, state, good, help, children }: { title: string; state: string; good: boolean; help: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-extrabold text-ink">{title}</h3>
        <span className={"rounded-pill px-2.5 py-0.5 text-xs font-bold " + (good ? "bg-emerald-100 text-emerald-900" : "bg-sand text-ink-soft")}>{state}</span>
      </div>
      <p className="text-sm text-ink-soft">{help}</p>
      {children}
    </section>
  );
}

function Optional({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer select-none py-1 font-semibold text-ink-soft">Add a note (optional)</summary>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={300} aria-label="Add a note (optional)" className={field + " mt-1"} />
    </details>
  );
}

function VerifiedControl({ hubId, name, on }: { hubId: string; name: string; on: boolean }) {
  const { pending, run, note } = useRun();
  const [open, setOpen] = useState(false), [why, setWhy] = useState("");
  return (
    <Panel title="Verified badge" state={on ? "Verified" : "Not verified"} good={on}
      help="A trust label shown on the Hub page and in lists. Give it once you have checked the Hub's committee. It does not change how the Hub's events are approved.">
      {!open ? <button type="button" onClick={() => setOpen(true)} className={(on ? btn : btnPrimary) + " w-full sm:w-auto"}>{on ? "Remove the badge…" : "Give the badge…"}</button> : (
        <div className={"space-y-2 rounded-lg border p-3 " + (on ? "border-rose-200 bg-rose-50" : "border-amber-300 bg-amber-50")}>
          <p className={"text-sm font-semibold " + (on ? "text-rose-900" : "text-amber-900")}>
            {on ? `${name} will lose its Verified badge.` : `${name} will show a Verified badge across OneShetland.`}
          </p>
          <Optional id={`hv-${hubId}`} value={why} onChange={setWhy} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} className={on ? btnDanger : btnPrimary} onClick={() => run(() => setHubVerifiedAction({ hubId, verified: !on, note: why }), on ? "Badge removed." : "Badge given.", () => { setWhy(""); setOpen(false); })}>{on ? "Yes, remove the badge" : "Yes, give the badge"}</button>
            <button type="button" onClick={() => setOpen(false)} className={btn}>Cancel</button>
          </div>
        </div>
      )}
      {note}
    </Panel>
  );
}

function EventsControl({ hubId, name, on }: { hubId: string; name: string; on: boolean }) {
  const { pending, run, note } = useRun();
  const [open, setOpen] = useState(false), [why, setWhy] = useState("");
  return (
    <Panel title="Events skip approval" state={on ? "On" : "Off"} good={on}
      help="Events this Hub posts to the islands-wide calendar are approved automatically, without review. Turn it on only for a Hub you trust to post responsibly.">
      {!open ? <button type="button" onClick={() => setOpen(true)} className={(on ? btn : btnPrimary) + " w-full sm:w-auto"}>{on ? "Turn off…" : "Turn on…"}</button> : (
        <div className={"space-y-2 rounded-lg border p-3 " + (on ? "border-rose-200 bg-rose-50" : "border-amber-300 bg-amber-50")}>
          <p className={"text-sm font-semibold " + (on ? "text-rose-900" : "text-amber-900")}>
            {on ? `Events from ${name} will need approval again before they reach the calendar.` : `From now on, events from ${name} go onto the calendar without anyone reviewing them first.`}
          </p>
          <Optional id={`he-${hubId}`} value={why} onChange={setWhy} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} className={on ? btnDanger : btnPrimary} onClick={() => run(() => setHubEventsAutoApproveAction({ hubId, on: !on, note: why }), on ? "Events now need approval." : "Events now skip approval.", () => { setWhy(""); setOpen(false); })}>{on ? "Yes, turn off" : "Yes, turn on"}</button>
            <button type="button" onClick={() => setOpen(false)} className={btn}>Cancel</button>
          </div>
        </div>
      )}
      {note}
    </Panel>
  );
}
