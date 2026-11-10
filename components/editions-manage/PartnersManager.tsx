"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { findActivities, findBusinesses, invitePartner, partnerAction, setPartnerDisplay } from "@/app/organise/actions";
import {
  PARTNER_KIND_LABEL, categoryLabel, organiserStateText, suggestedInvite,
  type FindActivity, type FindBusiness, type PartnerKind, type PartnerRow,
} from "@/lib/editions/partners";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { EmptyState, Field, Notice, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "./kit";
import { useAction } from "./use-action";

type Picked = { kind: PartnerKind; id: string; name: string };
const TONE = { good: "green", wait: "amber", ask: "blue", off: "gray" } as const;

/**
 * The organiser's Partners screen. Three plain steps: find a local business (or event or activity), write a short invitation, send it.
 * The owner answers on their side; nothing is shown publicly until they say yes.
 */
export function PartnersManager({ organiserSlug, editionSlug, organiserName, editionTitle, dateLabel, rows, canManage }: {
  organiserSlug: string; editionSlug: string; organiserName: string; editionTitle: string; dateLabel: string; rows: PartnerRow[]; canManage: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [mode, setMode] = useState<"business" | "activity">("business");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ biz: FindBusiness[]; act: FindActivity[] } | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const search = useAction();
  const send = useAction();
  const act = useAction();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onQuery(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) { setFound(null); return; }
    timer.current = setTimeout(() => {
      search.run(async () => (mode === "business" ? findBusinesses(organiserSlug, editionSlug, v) : findActivities(organiserSlug, editionSlug, v)), {
        onOk: (r) => setFound(mode === "business" ? { biz: (r as unknown as { rows: FindBusiness[] }).rows, act: [] } : { biz: [], act: (r as unknown as { rows: FindActivity[] }).rows }),
      });
    }, 250);
  }
  function choose(p: Picked) {
    setPicked(p);
    setMessage(suggestedInvite({ organiser: organiserName, edition: editionTitle, dateLabel, kind: p.kind, subject: p.name }));
    send.setMsg(null);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    send.run(() => invitePartner(organiserSlug, editionSlug, { kind: picked.kind, subject: picked.id, label, message }), {
      success: "Invitation sent. We will show them on your Edition as soon as they say yes.",
      onOk: () => { setPicked(null); setQ(""); setFound(null); setLabel(""); setMessage(""); router.refresh(); },
    });
  }
  async function doAct(r: PartnerRow, action: "approve" | "decline" | "cancel" | "remove") {
    const copy = {
      decline: { title: `Say no to ${r.subject_name}?`, body: "They will see that you declined. They can ask again after 30 days.", confirmLabel: "Say no" },
      cancel: { title: "Cancel this invitation?", body: `${r.subject_name} will no longer see it.`, confirmLabel: "Cancel invitation" },
      remove: { title: `Remove ${r.subject_name}?`, body: "They are taken off your Edition straight away. They can still ask to join again.", confirmLabel: "Remove" },
    } as const;
    if (action !== "approve" && !(await confirm({ ...copy[action], danger: true }))) return;
    act.run(() => partnerAction(organiserSlug, editionSlug, r.link_id, action), { onOk: () => router.refresh() });
  }

  const requests = rows.filter((r) => r.state === "pending" && r.initiated_by === "entity");
  const waiting = rows.filter((r) => r.state === "pending" && r.initiated_by === "organiser");
  const taking = rows.filter((r) => r.state === "approved");
  const past = rows.filter((r) => r.state !== "pending" && r.state !== "approved");

  const card = "rounded-card border border-line bg-paper p-5 shadow-soft";
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-ink-soft">
        Invite local businesses, events and regular activities to be part of this Edition. <strong className="font-semibold text-ink">They stay in charge of their own listing</strong>:
        each owner says yes or no, chooses what to show, and can step back at any time. You never edit their page.
      </p>

      {requests.length > 0 && (
        <section aria-labelledby="req-h" className="rounded-card border border-sky-200 bg-sky-50/60 p-5">
          <h2 id="req-h" className="font-display text-xl font-bold text-ink">Asking to join ({requests.length})</h2>
          <ul className="mt-3 space-y-3">
            {requests.map((r) => (
              <li key={r.link_id} className="rounded-xl border border-line bg-paper p-4">
                <p className="font-semibold text-ink">{r.subject_name} <span className="ml-1 text-sm font-normal text-ink-muted">{PARTNER_KIND_LABEL[r.kind]}</span></p>
                {r.message && <p className="mt-1 text-sm text-ink-soft">&ldquo;{r.message}&rdquo;</p>}
                {canManage && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btnPrimary} disabled={act.pending} onClick={() => doAct(r, "approve")}>Welcome them</button>
                    <button type="button" className={btnSecondary} disabled={act.pending} onClick={() => doAct(r, "decline")}>Not this time</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
        <section aria-labelledby="inv-h" className={card}>
          <h2 id="inv-h" className="font-display text-xl font-bold text-ink">Invite someone</h2>
          <div role="tablist" aria-label="What to invite" className="mt-3 inline-flex rounded-pill border border-line-strong bg-paper p-1">
            {(["business", "activity"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setFound(null); setQ(""); setPicked(null); }}
                className={"rounded-pill px-4 py-1.5 text-sm font-semibold transition " + (mode === m ? "bg-navy text-paper" : "text-ink-soft hover:text-ink")}>
                {m === "business" ? "A local business" : "An event or activity"}
              </button>
            ))}
          </div>
          {!picked ? (
            <div className="mt-4">
              <Field label={mode === "business" ? "Search the OneShetland directory" : "Search events and regular activities"} htmlFor="p-q" hint="Type at least two letters.">
                <input id="p-q" className={inputCls} value={q} onChange={(e) => onQuery(e.target.value)} autoComplete="off" placeholder={mode === "business" ? "For example Harbour Café" : "For example quiz night"} />
              </Field>
              <div aria-live="polite" className="mt-3">
                {search.pending && <p className="text-sm text-ink-muted">Searching…</p>}
                {found && found.biz.length === 0 && found.act.length === 0 && !search.pending && <p className="text-sm text-ink-soft">No matches. Check the spelling, or the business may not be listed yet.</p>}
                <ul className="space-y-2">
                  {found?.biz.map((b) => {
                    const state = b.link_state;
                    return (
                      <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{b.name}</p>
                          <p className="text-sm text-ink-soft">{[categoryLabel(b.category), b.address].filter(Boolean).join(" · ")}</p>
                          {!b.claimed && <p className="mt-1 text-sm text-amber-800">Not claimed yet: nobody can answer for this business. Ask them to claim their listing on OneShetland first.</p>}
                        </div>
                        {state ? <Pill label={state === "approved" ? "Already taking part" : "Invitation waiting"} tone="gray" />
                          : <button type="button" className={btnSecondary} disabled={!b.claimed} onClick={() => choose({ kind: "business", id: b.id, name: b.name })}>Invite</button>}
                      </li>
                    );
                  })}
                  {found?.act.map((a) => (
                    <li key={`${a.kind}-${a.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{a.title} <span className="text-sm font-normal text-ink-muted">{PARTNER_KIND_LABEL[a.kind]}</span></p>
                        <p className="text-sm text-ink-soft">{[a.owner_name, a.venue, a.starts_at ? new Date(a.starts_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : null].filter(Boolean).join(" · ")}</p>
                      </div>
                      {a.link_state ? <Pill label={a.link_state === "approved" ? "Already included" : "Invitation waiting"} tone="gray" />
                        : <button type="button" className={btnSecondary} onClick={() => choose({ kind: a.kind, id: a.id, name: a.title })}>Invite</button>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
              <p className="text-ink">Inviting <strong>{picked.name}</strong> to {editionTitle}.</p>
              <Field label="Their role (optional)" htmlFor="p-label" hint="Shown above their name. For example Festival café, Official venue or Trail stop."><input id="p-label" className={inputCls} maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
              <Field label="Your message" htmlFor="p-msg" hint="They will read this before they decide. Edit it so it sounds like you."><textarea id="p-msg" className={`${inputCls} min-h-32`} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
              <Notice msg={send.msg} />
              <div className="flex gap-2.5">
                <button type="submit" className={btnPrimary} disabled={send.pending}>{send.pending ? "Sending…" : "Send invitation"}</button>
                <button type="button" className={btnSecondary} onClick={() => setPicked(null)}>Choose someone else</button>
              </div>
            </form>
          )}
          {!picked && <Notice msg={send.msg} />}
        </section>
      )}

      <section aria-labelledby="tp-h">
        <h2 id="tp-h" className="font-display text-xl font-bold text-ink">Taking part ({taking.length})</h2>
        {taking.length === 0 ? <div className="mt-3"><EmptyState>Nobody has said yes yet.</EmptyState></div> : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
            {taking.map((r) => <PartnerLine key={r.link_id} r={r} canManage={canManage} onRemove={() => doAct(r, "remove")} onLabel={(l, p) => act.run(() => setPartnerDisplay(organiserSlug, editionSlug, r.link_id, l, p), { onOk: () => router.refresh() })} />)}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <section aria-labelledby="wt-h">
          <h2 id="wt-h" className="font-display text-xl font-bold text-ink">Waiting for an answer ({waiting.length})</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
            {waiting.map((r) => (
              <li key={r.link_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0"><p className="font-semibold text-ink">{r.subject_name}</p><p className="text-sm text-ink-muted">{PARTNER_KIND_LABEL[r.kind]} · {organiserStateText(r).hint}</p></div>
                <div className="flex items-center gap-3"><Pill label="Invitation sent" tone="amber" />{canManage && <button type="button" className={btnQuiet} disabled={act.pending} onClick={() => doAct(r, "cancel")}>Cancel</button>}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <details className="rounded-card border border-line bg-paper px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Earlier answers ({past.length})</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {past.map((r) => { const t = organiserStateText(r); return (
              <li key={r.link_id} className="flex flex-wrap items-center justify-between gap-2"><span className="text-ink">{r.subject_name} <span className="text-ink-muted">· {PARTNER_KIND_LABEL[r.kind]}</span></span><span className="flex items-center gap-2">{r.response_note && <span className="text-ink-muted">&ldquo;{r.response_note}&rdquo;</span>}<Pill label={t.label} tone={TONE[t.tone]} /></span></li>
            ); })}
          </ul>
        </details>
      )}
      <Notice msg={act.msg} />
    </div>
  );
}

function PartnerLine({ r, canManage, onRemove, onLabel }: { r: PartnerRow; canManage: boolean; onRemove: () => void; onLabel: (label: string, position: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(r.label ?? "");
  const [pos, setPos] = useState(r.sort_order);
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{r.subject_name} <span className="text-sm font-normal text-ink-muted">· {PARTNER_KIND_LABEL[r.kind]}{r.label ? ` · ${r.label}` : ""}</span></p>
          <p className="text-sm text-ink-muted">
            {r.kind === "business" ? (r.offers_selected > 0 ? `${r.offers_selected} offer${r.offers_selected === 1 ? "" : "s"} shown` : "No offers chosen by the business") : r.kind === "event" && !r.in_window ? "Outside this Edition's dates, so it is not shown." : "Shown on your Edition."}
          </p>
        </div>
        {canManage && <div className="flex items-center gap-3"><button type="button" className={btnQuiet} onClick={() => setEditing((v) => !v)}>{editing ? "Close" : "Edit heading"}</button><button type="button" className={btnQuiet} onClick={onRemove}>Remove</button></div>}
      </div>
      {editing && (
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); onLabel(label, pos); setEditing(false); }}>
          <Field label="Heading" htmlFor={`l-${r.link_id}`}><input id={`l-${r.link_id}`} className={inputCls} maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <Field label="Order" htmlFor={`o-${r.link_id}`}><input id={`o-${r.link_id}`} type="number" min={0} className={inputCls} value={pos} onChange={(e) => setPos(Number(e.target.value))} /></Field>
          <button type="submit" className={btnPrimary}>Save</button>
        </form>
      )}
    </li>
  );
}
