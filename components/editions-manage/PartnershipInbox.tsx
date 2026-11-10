"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getHubItemOptions, getJoinable, getOfferOptions, getOwnItems, requestToJoin, respondToPartnership, saveHubItems, saveOffers, type OwnItem,
} from "@/app/account/editions/actions";
import { MAX_HUB_ITEMS, PARTNER_KIND_LABEL, offerBadge, ownerStateText, type HubItemOption, type JoinableEdition, type MyPartnership, type OfferOption, type PartnerKind } from "@/lib/editions/partners";
import { dateRangeLabel } from "@/lib/editions/rules";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { EmptyState, Field, Notice, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "./kit";
import { useAction } from "./use-action";

const TONE = { good: "green", wait: "amber", ask: "blue", off: "gray" } as const;

/**
 * What an owner sees: every Edition that has invited, or been asked by, their business, event or activity. Plain words, one clear decision per card,
 * and the reassurance that matters most (you stay in control, you can leave at any time) sitting right next to the buttons.
 */
export function PartnershipInbox({ partnerships, businessId, businessName, billingHref, hub }: {
  partnerships: MyPartnership[]; businessId?: string | null; businessName?: string | null; billingHref?: string | null;
  /** When this inbox is a Hub's: the Hub that may ask to join Editions (its committee answers for it). */
  hub?: { id: string; name: string } | null;
}) {
  const invites = partnerships.filter((p) => p.state === "pending" && p.initiated_by === "organiser");
  const taking = partnerships.filter((p) => p.state === "approved");
  const waiting = partnerships.filter((p) => p.state === "pending" && p.initiated_by === "entity");
  const past = partnerships.filter((p) => p.state !== "pending" && p.state !== "approved");
  const [offersFor, setOffersFor] = useState<string | null>(null);

  return (
    <div className="space-y-9">
      <div className="max-w-2xl text-ink-soft">
        <p>Festivals, trails and seasonal events can feature local businesses, Hubs and activities. You decide whether to take part, <strong className="font-semibold text-ink">what is shown</strong>, and for how long. Your listing, offers and plan stay exactly as you manage them.</p>
      </div>

      <section aria-labelledby="inv-h">
        <h2 id="inv-h" className="font-display text-2xl font-bold text-ink">Invitations{invites.length ? ` (${invites.length})` : ""}</h2>
        {invites.length === 0 ? <div className="mt-3"><EmptyState>No invitations right now. When an organiser invites you, it appears here.</EmptyState></div> : (
          <ul className="mt-4 space-y-4">
            {invites.map((p) => <li key={p.link_id}><InvitationCard p={p} onAccepted={(id) => setOffersFor(p.kind === "business" || p.kind === "hub" ? id : null)} /></li>)}
          </ul>
        )}
      </section>

      <section aria-labelledby="tp-h">
        <h2 id="tp-h" className="font-display text-2xl font-bold text-ink">Taking part{taking.length ? ` (${taking.length})` : ""}</h2>
        {taking.length === 0 ? <div className="mt-3"><EmptyState>You are not part of any Edition yet.</EmptyState></div> : (
          <ul className="mt-4 space-y-4">
            {taking.map((p) => <li key={p.link_id}><TakingPartCard p={p} businessId={businessId ?? p.subject_business_id} billingHref={billingHref ?? null} openOffers={offersFor === p.link_id} /></li>)}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <section aria-labelledby="w-h">
          <h2 id="w-h" className="font-display text-2xl font-bold text-ink">Waiting for the organiser</h2>
          <ul className="mt-4 space-y-3">{waiting.map((p) => <li key={p.link_id}><WaitingRow p={p} /></li>)}</ul>
        </section>
      )}

      {businessId && <JoinPanel subject={{ kind: "business", id: businessId, name: businessName ?? "your business" }} existing={new Set(partnerships.filter((p) => p.state === "pending" || p.state === "approved").map((p) => p.edition_id))} />}
      {hub && <JoinPanel subject={{ kind: "hub", id: hub.id, name: hub.name }} existing={new Set(partnerships.filter((p) => p.kind === "hub" && p.subject_id === hub.id && (p.state === "pending" || p.state === "approved")).map((p) => p.edition_id))} />}

      {past.length > 0 && (
        <details className="rounded-card border border-line bg-paper px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Earlier ({past.length})</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {past.map((p) => { const t = ownerStateText(p); return (
              <li key={p.link_id} className="flex flex-wrap items-center justify-between gap-2"><span className="text-ink">{p.subject_name} <span className="text-ink-muted">· {p.edition_title}</span></span><Pill label={t.label} tone={TONE[t.tone]} /></li>
            ); })}
          </ul>
        </details>
      )}
    </div>
  );
}

function EditionLine({ p }: { p: MyPartnership }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow text-ink-muted">{PARTNER_KIND_LABEL[p.kind]}: {p.subject_name}{p.label ? ` · ${p.label}` : ""}</p>
      <h3 className="mt-0.5 font-display text-xl font-bold leading-snug text-ink [overflow-wrap:anywhere]">{p.edition_title}</h3>
      <p className="mt-0.5 text-sm text-ink-soft">{dateRangeLabel(p.edition_starts_on, p.edition_ends_on)} · from {p.organiser_name}</p>
      {p.edition_summary && <p className="mt-2 max-w-[62ch] text-[0.98rem] text-ink-soft">{p.edition_summary}</p>}
    </div>
  );
}

function InvitationCard({ p, onAccepted }: { p: MyPartnership; onAccepted: (id: string) => void }) {
  const router = useRouter();
  const act = useAction();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  return (
    <article className="rounded-card border border-sky-200 bg-sky-50/50 p-5 shadow-soft">
      <EditionLine p={p} />
      {p.message && <blockquote className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-[0.98rem] text-ink [overflow-wrap:anywhere]">&ldquo;{p.message}&rdquo;</blockquote>}
      <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
        <li><span aria-hidden="true">✓ </span>You choose what is shown, and nothing appears until you say yes.</li>
        <li><span aria-hidden="true">✓ </span>You can step back at any time and it disappears straight away.</li>
        <li><span aria-hidden="true">✓ </span>Taking part never changes your listing, plan or offers.</li>
      </ul>
      {!declining ? (
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button type="button" className={btnPrimary} disabled={act.pending}
            onClick={() => act.run(() => respondToPartnership(p.link_id, "approve"), { onOk: () => { onAccepted(p.link_id); router.refresh(); } })}>
            {act.pending ? "Saving…" : "Yes, take part"}
          </button>
          <button type="button" className={btnSecondary} onClick={() => setDeclining(true)}>No thanks</button>
        </div>
      ) : (
        <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); act.run(() => respondToPartnership(p.link_id, "decline", note), { onOk: () => router.refresh() }); }}>
          <Field label="Add a note for the organiser (optional)" htmlFor={`n-${p.link_id}`}><input id={`n-${p.link_id}`} className={inputCls} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: not this year, thank you" /></Field>
          <div className="flex gap-2.5"><button type="submit" className={btnPrimary} disabled={act.pending}>Decline invitation</button><button type="button" className={btnSecondary} onClick={() => setDeclining(false)}>Back</button></div>
        </form>
      )}
      <Notice msg={act.msg} />
    </article>
  );
}

function TakingPartCard({ p, businessId, billingHref, openOffers }: { p: MyPartnership; businessId: string | null; billingHref: string | null; openOffers: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const act = useAction();
  const [panel, setPanel] = useState<"offers" | "items" | "hubitems" | null>(openOffers && p.kind === "business" ? "offers" : openOffers && p.kind === "hub" ? "hubitems" : null);
  const t = ownerStateText(p);
  async function stepBack() {
    if (!(await confirm({ title: `Stop taking part in ${p.edition_title}?`, body: "You will disappear from the Edition straight away. You can be invited again later.", confirmLabel: "Stop taking part", danger: true }))) return;
    act.run(() => respondToPartnership(p.link_id, "withdraw"), { onOk: () => router.refresh() });
  }
  return (
    <article className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <EditionLine p={p} />
        <Pill label={t.label} tone={TONE[t.tone]} />
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        {p.edition_is_public && p.organiser_slug !== null ? <Link href={`/editions/${p.edition_slug}`} className="font-semibold text-ink underline underline-offset-[3px]">See how it looks on the Edition</Link> : "This Edition is not public yet. You will be shown when it is published."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {p.kind === "business" && <button type="button" className={btnSecondary} aria-expanded={panel === "offers"} onClick={() => setPanel(panel === "offers" ? null : "offers")}>{p.offers_selected ? `Offers shown: ${p.offers_selected}` : "Choose offers to show"}</button>}
        {p.kind === "hub" && <button type="button" className={btnSecondary} aria-expanded={panel === "hubitems"} onClick={() => setPanel(panel === "hubitems" ? null : "hubitems")}>{p.offers_selected ? `Showing ${p.offers_selected} item${p.offers_selected === 1 ? "" : "s"}` : "Choose what to show"}</button>}
        {businessId && p.kind === "business" && <button type="button" className={btnSecondary} aria-expanded={panel === "items"} onClick={() => setPanel(panel === "items" ? null : "items")}>Add an event or activity</button>}
        <button type="button" className={btnQuiet} disabled={act.pending} onClick={stepBack}>Stop taking part</button>
      </div>
      {panel === "offers" && p.kind === "business" && <OffersPanel linkId={p.link_id} billingHref={billingHref} onSaved={() => router.refresh()} />}
      {panel === "items" && businessId && <ItemsPanel editionId={p.edition_id} businessId={businessId} />}
      {panel === "hubitems" && p.kind === "hub" && <HubItemsPanel linkId={p.link_id} hubName={p.subject_name} onSaved={() => router.refresh()} />}
      <Notice msg={act.msg} />
    </article>
  );
}

function OffersPanel({ linkId, billingHref, onSaved }: { linkId: string; billingHref: string | null; onSaved: () => void }) {
  const load = useAction();
  const save = useAction();
  const [opts, setOpts] = useState<OfferOption[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // Load once on open. Never during render: a transition cannot start while rendering, and it would loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load.run(() => getOfferOptions(linkId), { onOk: (r) => { const o = (r as unknown as { options: OfferOption[] }).options; setOpts(o); setChosen(new Set(o.filter((x) => x.selected).map((x) => x.offer_id))); } }); }, [linkId]);
  const toggle = (id: string) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const anyIneligibleReasonPro = opts?.some((o) => o.reason?.includes("Pro or Premium"));
  return (
    <div className="mt-4 rounded-xl border border-line bg-cream/40 p-4">
      <h4 className="font-display text-lg font-bold text-ink">Which offers should visitors see here?</h4>
      <p className="text-sm text-ink-soft">Only your own live offers can be shown. Nothing is copied: if an offer ends or you switch it off, it disappears from the Edition too.</p>
      <Notice msg={load.msg} />
      {opts === null ? <p className="mt-3 text-sm text-ink-muted">Loading your offers…</p> : opts.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">You have no offers yet. Offers are created from your business page, and you can come back here to show them.</p>
      ) : (
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">Offers to show in this Edition</legend>
          {opts.map((o) => (
            <label key={o.offer_id} className={"flex items-start gap-3 rounded-lg border px-3 py-2.5 " + (o.eligible ? "border-line bg-paper" : "border-line bg-sand/50 opacity-80")}>
              <input type="checkbox" className="mt-1 h-5 w-5" disabled={!o.eligible} checked={chosen.has(o.offer_id)} onChange={() => toggle(o.offer_id)} />
              <span className="min-w-0 text-sm">
                <span className="block font-semibold text-ink">{o.title} <span className="font-normal text-ink-muted">· {offerBadge(o)}</span></span>
                {!o.eligible && o.reason && <span className="block text-ink-muted">{o.reason}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {anyIneligibleReasonPro && billingHref && <p className="mt-2 text-sm text-ink-soft">Offers appear publicly on a Pro or Premium listing. <Link href={billingHref} className="font-semibold text-ink underline underline-offset-[3px]">See plans</Link></p>}
      {opts && opts.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <button type="button" className={btnPrimary} disabled={save.pending} onClick={() => save.run(() => saveOffers(linkId, [...chosen]), { success: "Saved. Your choice is live on the Edition.", onOk: onSaved })}>{save.pending ? "Saving…" : "Save my choice"}</button>
          <span className="text-sm text-ink-muted">{chosen.size} of 6 selected</span>
        </div>
      )}
      <Notice msg={save.msg} />
    </div>
  );
}

/** A Hub chooses which of ITS OWN upcoming public events and calendar-approved activities to show under its card. Members-only events never appear here; nothing is copied. */
function HubItemsPanel({ linkId, hubName, onSaved }: { linkId: string; hubName: string; onSaved: () => void }) {
  const load = useAction();
  const save = useAction();
  const [opts, setOpts] = useState<HubItemOption[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load.run(() => getHubItemOptions(linkId), { onOk: (r) => { const o = (r as unknown as { options: HubItemOption[] }).options; setOpts(o); setChosen(new Set(o.filter((x) => x.selected).map((x) => `${x.kind}:${x.id}`))); } }); }, [linkId]);
  const toggle = (k: string) => setChosen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else if (n.size < MAX_HUB_ITEMS) n.add(k); return n; });
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : null);
  const ids = (kind: "event" | "activity") => [...chosen].filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1));
  return (
    <div className="mt-4 rounded-xl border border-line bg-cream/40 p-4">
      <h4 className="font-display text-lg font-bold text-ink">What should visitors see for {hubName}?</h4>
      <p className="text-sm text-ink-soft">Only {hubName}&rsquo;s own public events and regular activities can be shown, and nothing is copied: if one changes or ends, the Edition changes with it. Members-only events never appear.</p>
      <Notice msg={load.msg} />
      {opts === null ? <p className="mt-3 text-sm text-ink-muted">Loading your Hub&rsquo;s events and activities…</p> : opts.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">There are no upcoming public events or approved regular activities to show yet. Add them from your Hub&rsquo;s management page and come back.</p>
      ) : (
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">Events and activities to show in this Edition</legend>
          {opts.map((o) => { const k = `${o.kind}:${o.id}`; return (
            <label key={k} className="flex items-start gap-3 rounded-lg border border-line bg-paper px-3 py-2.5">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={chosen.has(k)} disabled={!chosen.has(k) && chosen.size >= MAX_HUB_ITEMS} onChange={() => toggle(k)} />
              <span className="min-w-0 text-sm"><span className="block font-semibold text-ink">{o.title} <span className="font-normal text-ink-muted">· {PARTNER_KIND_LABEL[o.kind]}{when(o.starts_at) ? ` · ${when(o.starts_at)}` : ""}{o.venue ? ` · ${o.venue}` : ""}</span></span></span>
            </label>
          ); })}
        </fieldset>
      )}
      {opts && opts.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <button type="button" className={btnPrimary} disabled={save.pending} onClick={() => save.run(() => saveHubItems(linkId, ids("event"), ids("activity")), { success: "Saved. Your choice is live on the Edition.", onOk: onSaved })}>{save.pending ? "Saving…" : "Save my choice"}</button>
          <span className="text-sm text-ink-muted">{chosen.size} of {MAX_HUB_ITEMS} selected</span>
        </div>
      )}
      <Notice msg={save.msg} />
    </div>
  );
}

function ItemsPanel({ editionId, businessId }: { editionId: string; businessId: string }) {
  const load = useAction();
  const send = useAction();
  const [items, setItems] = useState<OwnItem[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load.run(() => getOwnItems(businessId), { onOk: (r) => setItems((r as unknown as { items: OwnItem[] }).items) }); }, [businessId]);
  return (
    <div className="mt-4 rounded-xl border border-line bg-cream/40 p-4">
      <h4 className="font-display text-lg font-bold text-ink">Add one of your events or regular activities</h4>
      <p className="text-sm text-ink-soft">The organiser will be asked to include it. It appears only once they say yes, and you can withdraw it at any time.</p>
      <Notice msg={load.msg} />
      {items === null ? <p className="mt-3 text-sm text-ink-muted">Loading…</p> : items.length === 0 ? <p className="mt-3 text-sm text-ink-soft">You have no upcoming events or published regular activities.</p> : (
        <ul className="mt-3 space-y-2">
          {items.map((i) => (
            <li key={`${i.kind}-${i.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2.5 text-sm">
              <span className="min-w-0 font-semibold text-ink">{i.title} <span className="font-normal text-ink-muted">· {PARTNER_KIND_LABEL[i.kind]}{i.starts_at ? ` · ${new Date(i.starts_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}` : ""}</span></span>
              {sent.has(i.id) ? <Pill label="Asked" tone="amber" /> : <button type="button" className={btnSecondary} disabled={send.pending} onClick={() => send.run(() => requestToJoin(editionId, i.kind, i.id), { onOk: () => setSent((s) => new Set(s).add(i.id)) })}>Ask to include</button>}
            </li>
          ))}
        </ul>
      )}
      <Notice msg={send.msg} />
    </div>
  );
}

function WaitingRow({ p }: { p: MyPartnership }) {
  const router = useRouter();
  const act = useAction();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3">
      <div className="min-w-0"><p className="font-semibold text-ink">{p.subject_name} <span className="font-normal text-ink-muted">· {PARTNER_KIND_LABEL[p.kind]}</span></p><p className="text-sm text-ink-soft">{p.edition_title}: waiting for {p.organiser_name} to answer.</p></div>
      <button type="button" className={btnQuiet} disabled={act.pending} onClick={() => act.run(() => respondToPartnership(p.link_id, "cancel"), { onOk: () => router.refresh() })}>Cancel request</button>
      <Notice msg={act.msg} />
    </div>
  );
}

function JoinPanel({ subject, existing }: { subject: { kind: PartnerKind; id: string; name: string }; existing: Set<string> }) {
  const router = useRouter();
  const [list, setList] = useState<JoinableEdition[] | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const load = useAction();
  const send = useAction();
  function toggle() {
    const next = !open; setOpen(next);
    if (next && list === null) load.run(async () => ({ ok: true as const, rows: await getJoinable() }), { onOk: (r) => setList((r as unknown as { rows: JoinableEdition[] }).rows) });
  }
  return (
    <section aria-labelledby={`join-h-${subject.kind}`}>
      <h2 id={`join-h-${subject.kind}`} className="font-display text-2xl font-bold text-ink">{subject.kind === "hub" ? `Find an Edition for ${subject.name} to join` : "Find an Edition to join"}</h2>
      <p className="mt-1 max-w-2xl text-ink-soft">See what is coming up and ask to be part of it. The organiser decides, and you stay in control of what is shown.</p>
      <button type="button" className={`${btnSecondary} mt-3`} aria-expanded={open} onClick={toggle}>{open ? "Hide upcoming Editions" : "Show upcoming Editions"}</button>
      {open && (
        <div className="mt-4">
          <Notice msg={load.msg} />
          {list === null ? <p className="text-sm text-ink-muted">Loading…</p> : list.length === 0 ? <EmptyState>No Editions are open right now. Check back soon.</EmptyState> : (
            <ul className="space-y-3">
              {list.map((e) => (
                <li key={e.edition_id} className="rounded-card border border-line bg-paper p-4">
                  <p className="font-display text-lg font-bold text-ink">{e.title}</p>
                  <p className="text-sm text-ink-soft">{dateRangeLabel(e.starts_on, e.ends_on)} · {e.organiser_name}</p>
                  {e.summary && <p className="mt-1 text-sm text-ink-soft">{e.summary}</p>}
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <Link href={`/editions/${e.slug}`} className={btnQuiet}>View Edition</Link>
                    {existing.has(e.edition_id) ? <Pill label="Already involved" tone="gray" /> : (
                      <>
                        <Field label={`Message to the organiser (optional)`} htmlFor={`m-${e.edition_id}`}><input id={`m-${e.edition_id}`} className={inputCls} maxLength={500} value={msg} onChange={(ev) => setMsg(ev.target.value)} placeholder={`Why ${subject.name} would suit this`} /></Field>
                        <button type="button" className={btnPrimary} disabled={send.pending} onClick={() => send.run(() => requestToJoin(e.edition_id, subject.kind, subject.id, msg), { success: "Request sent. The organiser will answer you here.", onOk: () => router.refresh() })}>Ask to join</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Notice msg={send.msg} />
        </div>
      )}
    </section>
  );
}
