"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSession, deleteVenue, saveSession, saveVenue } from "@/app/organise/actions";
import { groupSessionsByDay, timeLabel } from "@/lib/editions/rules";
import { SESSION_KIND_LABEL, type Edition, type EditionSession, type EditionVenue } from "@/lib/editions/types";
import { SESSION_KINDS, isoToLondonLocal, sessionFields, venueFields } from "@/lib/editions/validate";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { EmptyState, Field, Notice, Pill, btnPrimary, btnSecondary, btnQuiet, inputCls } from "./kit";
import { useAction } from "./use-action";
import { ImageUpload } from "./ImageUpload";

type SDraft = {
  id: string | null; title: string; description: string; starts_local: string; ends_local: string; venue_id: string; kind: string;
  ticket_mode: "none" | "external"; ticket_url: string; price_text: string; status: string; position: number;
  image_url: string; presenters: string; business_links: string[];
};
const sBlank = (ed: Edition): SDraft => ({ id: null, title: "", description: "", starts_local: `${ed.starts_on}T10:00`, ends_local: "", venue_id: "", kind: "session", ticket_mode: "none", ticket_url: "", price_text: "", status: "scheduled", image_url: "", presenters: "", business_links: [], position: 0 });
const sFrom = (s: EditionSession, links: string[] = []): SDraft => ({
  id: s.id, title: s.title, description: s.description ?? "", starts_local: isoToLondonLocal(s.starts_at), ends_local: isoToLondonLocal(s.ends_at), venue_id: s.venue_id ?? "", kind: s.kind,
  ticket_mode: s.ticket_mode, ticket_url: s.ticket_url ?? "", price_text: s.price_text ?? "", status: s.status, position: s.position,
  image_url: s.image_url ?? "", presenters: s.presenters ?? "", business_links: links,
});

type PartnerOpt = { link_id: string; name: string };
export function ProgrammeManager({ organiserSlug, edition, sessions, venues, organiserId, partners = [], sessionLinks = {} }: { organiserSlug: string; edition: Edition; sessions: EditionSession[]; venues: EditionVenue[]; organiserId: string; partners?: PartnerOpt[]; sessionLinks?: Record<string, string[]> }) {
  return (
    <div className="space-y-10">
      <SessionEditor organiserSlug={organiserSlug} edition={edition} sessions={sessions} venues={venues} organiserId={organiserId} partners={partners} sessionLinks={sessionLinks} />
      <VenueManager organiserSlug={organiserSlug} venues={venues} />
    </div>
  );
}

export function SessionEditor({ organiserSlug, edition, sessions, venues, organiserId, partners = [], sessionLinks = {} }: { organiserSlug: string; edition: Edition; sessions: EditionSession[]; venues: EditionVenue[]; organiserId: string; partners?: PartnerOpt[]; sessionLinks?: Record<string, string[]> }) {
  const router = useRouter();
  const confirm = useConfirm();
  const save = useAction();
  const del = useAction();
  const [draft, setDraft] = useState<SDraft | null>(null);
  const venueName = (id: string | null) => venues.find((v) => v.id === id)?.name;
  const days = groupSessionsByDay(sessions);
  const set = <K extends keyof SDraft>(k: K, v: SDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const v = sessionFields(draft, edition);
    if (!v.ok) return save.setMsg({ ok: false, text: v.error });
    save.run(() => saveSession(organiserSlug, edition.slug, draft.id, draft), { success: "Session saved.", onOk: (r) => { setDraft((d) => (d ? { ...d, id: r.id } : d)); router.refresh(); } });
  }
  async function remove(s: EditionSession) {
    if (!(await confirm({ title: `Delete "${s.title}"?`, body: "This session is removed from the programme.", confirmLabel: "Delete session", danger: true }))) return;
    del.run(() => deleteSession(organiserSlug, edition.slug, s.id), { onOk: () => { if (draft?.id === s.id) setDraft(null); router.refresh(); } });
  }

  return (
    <section aria-labelledby="sess-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sess-h" className="font-display text-xl font-bold text-ink">Sessions</h2>
        <button type="button" className={btnPrimary} onClick={() => { setDraft(sBlank(edition)); save.setMsg(null); }}>Add session</button>
      </div>

      {draft && (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft" noValidate>
          <h3 className="font-display text-lg font-bold text-ink">{draft.id ? "Edit session" : "New session"}</h3>
          <Field label="Title" htmlFor="s-title"><input id="s-title" className={inputCls} value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={140} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="s-start" hint="UK time."><input id="s-start" type="datetime-local" className={inputCls} value={draft.starts_local} onChange={(e) => set("starts_local", e.target.value)} required /></Field>
            <Field label="Ends" htmlFor="s-end" hint="Optional."><input id="s-end" type="datetime-local" className={inputCls} value={draft.ends_local} min={draft.starts_local} onChange={(e) => set("ends_local", e.target.value)} /></Field>
            <Field label="Type" htmlFor="s-kind"><select id="s-kind" className={inputCls} value={draft.kind} onChange={(e) => set("kind", e.target.value)}>{SESSION_KINDS.map((k) => <option key={k} value={k}>{SESSION_KIND_LABEL[k]}</option>)}</select></Field>
            <Field label="Venue" htmlFor="s-venue" hint={venues.length ? undefined : "Add a venue below first, or leave this empty."}>
              <select id="s-venue" className={inputCls} value={draft.venue_id} onChange={(e) => set("venue_id", e.target.value)}><option value="">No venue</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
            </Field>
          </div>
          <Field label="Description" htmlFor="s-desc" hint="Shown on the session's own page. You can use **bold**, *italic*, ## headings, bullet lists and links."><textarea id="s-desc" className={inputCls} rows={6} value={draft.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} /></Field>
          <ImageUpload label="Photograph (optional)" organiserId={organiserId} kind="session-image" value={draft.image_url} onChange={(u) => set("image_url", u)} hint="Shown at the top of the session's page. Use a photograph of this session or of Shetland, not one that belongs to someone else." />
          <Field label="Presented by" htmlFor="s-pres" hint="Optional. For example a chef, a speaker or a host."><input id="s-pres" className={inputCls} value={draft.presenters} onChange={(e) => set("presenters", e.target.value)} maxLength={200} /></Field>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Participating businesses</legend>
            <p className="mt-1 text-xs text-ink-muted">Optional. Only businesses that have agreed to take part in this Edition can be named, and a business disappears from the page if it withdraws.</p>
            {partners.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No businesses have joined this Edition yet.</p> : (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {partners.map((p) => (
                  <label key={p.link_id} className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={draft.business_links.includes(p.link_id)} onChange={(e) => set("business_links", e.target.checked ? [...draft.business_links, p.link_id] : draft.business_links.filter((x) => x !== p.link_id))} />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tickets" htmlFor="s-tm"><select id="s-tm" className={inputCls} value={draft.ticket_mode} onChange={(e) => set("ticket_mode", e.target.value as "none" | "external")}><option value="none">No tickets needed</option><option value="external">Link to a ticket page</option></select></Field>
            {draft.ticket_mode === "external" && <Field label="Ticket link" htmlFor="s-tu" hint="Must start with https://"><input id="s-tu" className={inputCls} inputMode="url" value={draft.ticket_url} onChange={(e) => set("ticket_url", e.target.value)} placeholder="https://" /></Field>}
            <Field label="Price note" htmlFor="s-price" hint="For example Free or From £8."><input id="s-price" className={inputCls} value={draft.price_text} onChange={(e) => set("price_text", e.target.value)} maxLength={60} /></Field>
          </div>
          <Field label="Status" htmlFor="s-status" hint="Mark a session cancelled or changed so visitors are told.">
            <select id="s-status" className={inputCls + " sm:max-w-xs"} value={draft.status} onChange={(e) => set("status", e.target.value)}><option value="scheduled">Scheduled</option><option value="changed">Changed</option><option value="cancelled">Cancelled</option></select>
          </Field>
          <Notice msg={save.msg} />
          <div className="flex flex-wrap gap-2.5">
            <button type="submit" disabled={save.pending} className={btnPrimary}>{save.pending ? "Saving…" : "Save session"}</button>
            <button type="button" className={btnSecondary} onClick={() => setDraft(null)}>Close</button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-5">
        {days.length === 0 ? <EmptyState>No sessions yet. Add the first one so people can plan.</EmptyState> : days.map((d) => (
          <div key={d.day}>
            <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-ink-muted">{d.label}</h3>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
              {d.items.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink"><span className="tabular-nums text-ink-soft">{timeLabel(s.starts_at)}{s.ends_at ? `–${timeLabel(s.ends_at)}` : ""}</span> {s.title}
                      {s.status !== "scheduled" && <Pill label={s.status === "cancelled" ? "Cancelled" : "Changed"} tone={s.status === "cancelled" ? "red" : "amber"} />}</p>
                    <p className="text-xs text-ink-muted">{SESSION_KIND_LABEL[s.kind]}{venueName(s.venue_id) ? ` · ${venueName(s.venue_id)}` : ""}{s.ticket_mode === "external" ? " · Ticket link" : ""}</p>
                  </div>
                  <div className="flex gap-3"><button type="button" className={btnQuiet} onClick={() => { setDraft(sFrom(s, sessionLinks[s.id] ?? [])); save.setMsg(null); }}>Edit</button><button type="button" className="text-sm font-semibold text-rose-700 hover:underline" onClick={() => remove(s)}>Delete</button></div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Notice msg={del.msg} />
      </div>
    </section>
  );
}

type VDraft = { id: string | null; name: string; address: string; lat: string; lng: string; notes: string };
const vBlank: VDraft = { id: null, name: "", address: "", lat: "", lng: "", notes: "" };

/** Venues belong to the organiser and are reused across all of its Editions. */
export function VenueManager({ organiserSlug, venues }: { organiserSlug: string; venues: EditionVenue[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const save = useAction();
  const del = useAction();
  const [draft, setDraft] = useState<VDraft | null>(null);
  const set = (k: keyof VDraft, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const v = venueFields(draft);
    if (!v.ok) return save.setMsg({ ok: false, text: v.error });
    save.run(() => saveVenue(organiserSlug, draft.id, draft), { success: "Venue saved.", onOk: () => { setDraft(null); router.refresh(); } });
  }
  async function remove(v: EditionVenue) {
    if (!(await confirm({ title: `Delete "${v.name}"?`, body: "Sessions that use this venue must be changed first.", confirmLabel: "Delete venue", danger: true }))) return;
    del.run(() => deleteVenue(organiserSlug, v.id), { onOk: () => router.refresh() });
  }
  return (
    <section aria-labelledby="ven-h">
      <div className="flex items-center justify-between gap-3">
        <div><h2 id="ven-h" className="font-display text-xl font-bold text-ink">Venues</h2><p className="text-sm text-ink-soft">Shared by all of this organiser&apos;s Editions.</p></div>
        <button type="button" className={btnSecondary} onClick={() => { setDraft(vBlank); save.setMsg(null); }}>Add venue</button>
      </div>
      {draft && (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft" noValidate>
          <Field label="Venue name" htmlFor="v-name"><input id="v-name" className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required /></Field>
          <Field label="Address" htmlFor="v-addr"><input id="v-addr" className={inputCls} value={draft.address} onChange={(e) => set("address", e.target.value)} maxLength={300} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitude" htmlFor="v-lat" hint="Optional, for example 60.1553."><input id="v-lat" className={inputCls} inputMode="decimal" value={draft.lat} onChange={(e) => set("lat", e.target.value)} /></Field>
            <Field label="Longitude" htmlFor="v-lng" hint="Optional, for example -1.1494."><input id="v-lng" className={inputCls} inputMode="decimal" value={draft.lng} onChange={(e) => set("lng", e.target.value)} /></Field>
          </div>
          <Field label="Notes" htmlFor="v-notes" hint="For example parking or step-free access. Up to 500 characters."><textarea id="v-notes" className={inputCls} rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} /></Field>
          <Notice msg={save.msg} />
          <div className="flex gap-2.5"><button type="submit" disabled={save.pending} className={btnPrimary}>{save.pending ? "Saving…" : "Save venue"}</button><button type="button" className={btnSecondary} onClick={() => setDraft(null)}>Cancel</button></div>
        </form>
      )}
      <div className="mt-4">
        {venues.length === 0 ? <EmptyState>No venues yet.</EmptyState> : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">
            {venues.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0"><p className="truncate font-semibold text-ink">{v.name}</p>{v.address && <p className="truncate text-xs text-ink-muted">{v.address}</p>}</div>
                <div className="flex gap-3">
                  <button type="button" className={btnQuiet} onClick={() => { setDraft({ id: v.id, name: v.name, address: v.address ?? "", lat: v.lat?.toString() ?? "", lng: v.lng?.toString() ?? "", notes: v.notes ?? "" }); save.setMsg(null); }}>Edit</button>
                  <button type="button" className="text-sm font-semibold text-rose-700 hover:underline" onClick={() => remove(v)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2"><Notice msg={del.msg} /></div>
      </div>
    </section>
  );
}
