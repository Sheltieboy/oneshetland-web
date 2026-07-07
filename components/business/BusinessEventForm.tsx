"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_CATEGORIES } from "@/lib/events-data";
import { PlaceAutocomplete, type PickedPlace } from "@/components/fetch/PlaceAutocomplete";
import {
  createBusinessEvent, updateBusinessEvent, uploadEventCover,
  type TicketMode, type EditableTicketType, type BusinessEventInput,
} from "@/lib/events-manage-client";
import type { ManageEvent } from "@/lib/events-manage";

const AGE_RESTRICTIONS = ["All ages", "12+", "16+", "18+", "Under 18 only"] as const;

const TICKET_MODES: { key: TicketMode; label: string; hint: string }[] = [
  { key: "none", label: "No tickets", hint: "Free entry or tickets not sold here" },
  { key: "oneshetland", label: "OneShetland", hint: "Sell tickets through the platform" },
  { key: "external", label: "External link", hint: "Link to your own ticket site" },
];

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialTicketMode(ev?: ManageEvent): TicketMode {
  if (!ev) return "none";
  if (ev.ticket_url) return "external";
  if (ev.has_tickets || ev.ticket_types.length > 0) return "oneshetland";
  return "none";
}

export function BusinessEventForm({
  businessId, accent, event,
}: {
  businessId: string;
  accent: string;
  /** Present in edit mode. */
  event?: ManageEvent;
}) {
  const router = useRouter();
  const isEdit = !!event;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [category, setCategory] = useState(event?.category ?? "");
  const [startsAt, setStartsAt] = useState(toLocal(event?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocal(event?.ends_at ?? null));
  const [doorsAt, setDoorsAt] = useState(toLocal(event?.doors_open_at ?? null));

  const [venue, setVenue] = useState(event?.venue ?? "");
  const [address, setAddress] = useState(event?.formatted_address ?? "");
  const [lat, setLat] = useState<number | null>(event?.lat ?? null);
  const [lng, setLng] = useState<number | null>(event?.lng ?? null);
  const [placeId, setPlaceId] = useState<string | null>(event?.place_id ?? null);
  const [locality, setLocality] = useState(event?.locality ?? "");

  const [ageRestr, setAgeRestr] = useState(event?.age_restriction ?? "All ages");
  const [refundPolicy, setRefundPolicy] = useState(event?.refund_policy ?? "");
  const [contactInfo, setContactInfo] = useState(event?.contact_info ?? "");
  const [eventNotes, setEventNotes] = useState(event?.event_notes ?? "");

  const [coverUrl, setCoverUrl] = useState<string | null>(event?.cover_url ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [ticketMode, setTicketMode] = useState<TicketMode>(initialTicketMode(event));
  const [ticketUrl, setTicketUrl] = useState(event?.ticket_url ?? "");
  const [ticketTypes, setTicketTypes] = useState<EditableTicketType[]>(
    event?.ticket_types
      .filter(t => t.is_active)
      .map(t => ({ id: t.id, name: t.name, price_pence: t.price_pence, quantity_available: t.quantity_available })) ?? [],
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPick(p: PickedPlace) {
    setVenue(p.name);
    setAddress(p.address);
    setLat(p.lat);
    setLng(p.lng);
    setPlaceId(null); // PlaceAutocomplete doesn't surface place_id; coords are what matter
  }

  function addTicketType() {
    setTicketTypes([...ticketTypes, { name: "", price_pence: 0, quantity_available: null }]);
  }
  function updateTicketType(i: number, patch: Partial<EditableTicketType>) {
    setTicketTypes(ticketTypes.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }
  function removeTicketType(i: number) {
    setTicketTypes(ticketTypes.filter((_, j) => j !== i));
  }

  async function submit(publish: boolean) {
    if (!title.trim()) return setError("Add an event title.");
    if (!startsAt) return setError("Add a start date and time.");
    if (ticketMode === "external" && !ticketUrl.trim()) return setError("Add the external ticket URL.");
    setError(null);
    setBusy(true);
    try {
      let finalCover = coverUrl;
      if (coverFile) finalCover = await uploadEventCover(coverFile);

      const input: BusinessEventInput = {
        title: title.trim(),
        description: description.trim() || null,
        category: category || null,
        status: publish ? "published" : "draft",
        venue: venue.trim() || null,
        locality: locality.trim() || null,
        lat,
        lng,
        place_id: placeId,
        formatted_address: address.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        doors_open_at: doorsAt ? new Date(doorsAt).toISOString() : null,
        cover_url: finalCover,
        age_restriction: ageRestr !== "All ages" ? ageRestr : null,
        refund_policy: refundPolicy.trim() || null,
        contact_info: contactInfo.trim() || null,
        event_notes: eventNotes.trim() || null,
        ticket_mode: ticketMode,
        ticket_url: ticketMode === "external" ? ticketUrl.trim() || null : null,
        ticket_types: ticketTypes,
      };

      let targetId: string;
      if (isEdit && event) {
        await updateBusinessEvent(businessId, event.id, input);
        targetId = event.id;
      } else {
        targetId = await createBusinessEvent(businessId, input);
      }
      router.push(`/business/${businessId}/manage/events/${targetId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the event.");
      setBusy(false);
    }
  }

  const inputCls = "auth-input";
  const labelCls = "block text-sm font-semibold text-ink";

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(true); }} className="space-y-6">
      {/* Cover */}
      <section className="space-y-2 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Cover image</h2>
        {(coverFile || coverUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverFile ? URL.createObjectURL(coverFile) : coverUrl ?? ""}
            alt=""
            className="aspect-video w-full rounded-lg object-cover"
          />
        )}
        <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} className="block text-sm text-ink-soft" />
      </section>

      {/* Basics */}
      <section className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Event details</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" className={inputCls} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the event…" rows={4} className={inputCls} />
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">Category</span>
          <div className="flex flex-wrap gap-2">
            {EVENT_CATEGORIES.map((c) => (
              <button type="button" key={c} onClick={() => setCategory(category === c ? "" : c)}
                className={"rounded-pill border px-3.5 py-1.5 text-sm font-semibold transition " + (category === c ? "text-paper" : "border-line bg-paper text-ink")}
                style={category === c ? { background: accent, borderColor: accent } : undefined}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Date & time */}
      <section className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Date &amp; time</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelCls}>Starts
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls + " mt-1"} />
          </label>
          <label className={labelCls}>Ends (optional)
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputCls + " mt-1"} />
          </label>
          <label className={labelCls}>Doors open (optional)
            <input type="datetime-local" value={doorsAt} onChange={(e) => setDoorsAt(e.target.value)} className={inputCls + " mt-1"} />
          </label>
        </div>
      </section>

      {/* Location */}
      <section className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Location</h2>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">Venue / address</span>
          <PlaceAutocomplete
            value={venue || address}
            onChange={(t) => { setVenue(t); setAddress(t); }}
            onPick={onPick}
            placeholder="Search for a venue or address…"
          />
          {(venue || address) && (
            <p className="mt-1.5 text-xs text-ink-muted">
              {venue ? <span className="font-semibold">{venue}</span> : null}
              {address && address !== venue ? <span> · {address}</span> : null}
              {lat != null && lng != null ? <span> · pinned</span> : null}
              <button type="button" onClick={() => { setVenue(""); setAddress(""); setLat(null); setLng(null); setPlaceId(null); }} className="ml-2 font-semibold text-rose-500 hover:underline">Clear</button>
            </p>
          )}
        </div>
        <input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Area (e.g. Lerwick)" className={inputCls} />
      </section>

      {/* Age restriction */}
      <section className="space-y-2 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Age restriction</h2>
        <div className="flex flex-wrap gap-2">
          {AGE_RESTRICTIONS.map((a) => (
            <button type="button" key={a} onClick={() => setAgeRestr(a)}
              className={"rounded-pill border px-3.5 py-1.5 text-sm font-semibold transition " + (ageRestr === a ? "text-paper" : "border-line bg-paper text-ink")}
              style={ageRestr === a ? { background: accent, borderColor: accent } : undefined}>
              {a}
            </button>
          ))}
        </div>
      </section>

      {/* Tickets */}
      <section className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Tickets</h2>
        <div className="flex flex-wrap gap-2">
          {TICKET_MODES.map((m) => (
            <button type="button" key={m.key} onClick={() => setTicketMode(m.key)} title={m.hint}
              className={"rounded-pill border px-4 py-1.5 text-sm font-semibold transition " + (ticketMode === m.key ? "text-paper" : "border-line bg-paper text-ink")}
              style={ticketMode === m.key ? { background: accent, borderColor: accent } : undefined}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">{TICKET_MODES.find((m) => m.key === ticketMode)?.hint}</p>

        {ticketMode === "external" && (
          <input value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} placeholder="https://…" type="url" className={inputCls} />
        )}

        {ticketMode === "oneshetland" && (
          <div className="space-y-2">
            {ticketTypes.map((t, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-line bg-sand/30 p-3">
                <input value={t.name} onChange={(e) => updateTicketType(i, { name: e.target.value })} placeholder="Ticket name (e.g. General, VIP)" className={inputCls} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-ink-muted">Price (£)
                    <input type="number" min="0" step="0.01"
                      value={t.price_pence > 0 ? (t.price_pence / 100).toFixed(2) : ""}
                      onChange={(e) => updateTicketType(i, { price_pence: Math.round(parseFloat(e.target.value || "0") * 100) })}
                      placeholder="0.00 = Free" className={inputCls + " mt-1"} />
                  </label>
                  <label className="block text-xs font-semibold text-ink-muted">Quantity (blank = unlimited)
                    <input type="number" min="1" step="1"
                      value={t.quantity_available ?? ""}
                      onChange={(e) => updateTicketType(i, { quantity_available: e.target.value ? parseInt(e.target.value, 10) : null })}
                      placeholder="Unlimited" className={inputCls + " mt-1"} />
                  </label>
                </div>
                <button type="button" onClick={() => removeTicketType(i)} className="text-xs font-semibold text-rose-500 hover:underline">Remove</button>
              </div>
            ))}
            <button type="button" onClick={addTicketType} className="w-full rounded-xl border border-dashed border-current py-2.5 text-sm font-semibold transition hover:bg-sand/30" style={{ color: accent }}>
              + Add ticket type
            </button>
            <input value={refundPolicy} onChange={(e) => setRefundPolicy(e.target.value)} placeholder="Refund policy (e.g. No refunds within 48 hours)" className={inputCls} />
          </div>
        )}
      </section>

      {/* Extra info */}
      <section className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Extra info</h2>
        <input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} placeholder="Contact info (email or phone)" className={inputCls} />
        <textarea value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} placeholder="Additional notes for attendees…" rows={3} className={inputCls} />
      </section>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => submit(false)} disabled={busy}
          className="rounded-pill border px-5 py-2.5 font-semibold disabled:opacity-50" style={{ borderColor: accent, color: accent }}>
          {busy ? "Saving…" : "Save as draft"}
        </button>
        <button type="submit" disabled={busy}
          className="rounded-pill px-5 py-2.5 font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>
          {busy ? "Saving…" : isEdit ? "Save & publish" : "Publish event"}
        </button>
      </div>
    </form>
  );
}
