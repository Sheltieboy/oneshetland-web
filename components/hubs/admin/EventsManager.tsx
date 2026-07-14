"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createHubEvent, updateHubEvent, deleteEvent, uploadHubMedia, type TicketMode, type WebTicketType } from "@/lib/hubs-client";

type AdminEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  venue?: string | null;
  locality?: string | null;
  category?: string | null;
  price_text?: string | null;
  hub_visibility?: string | null;
  calendar_approved?: boolean | null;
  status?: string | null;
  has_tickets?: boolean;
  ticket_url?: string | null;
  ticket_types?: { id: string; name: string; price_pence: number; quantity_available?: number | null }[];
};

const TICKET_MODES: { key: TicketMode; label: string; hint: string }[] = [
  { key: "none",         label: "No tickets",      hint: "Free entry or tickets not sold here" },
  { key: "oneshetland", label: "OneShetland",      hint: "Sell tickets through the platform" },
  { key: "external",    label: "External link",    hint: "Link to your own ticket site" },
];

const VIS = [
  { key: "islands", label: "Islands-wide", hint: "Submit to the main What's On calendar (shows once approved)" },
  { key: "hub", label: "Hub page only", hint: "Only on your hub page" },
  { key: "members", label: "Members only", hint: "Only your members can see it" },
] as const;

function eventBadge(ev: AdminEvent): { label: string; bg: string; color: string } {
  if (ev.status === "draft")     return { label: "Draft",     bg: "#E2E8F0", color: "#475569" };
  if (ev.status === "cancelled") return { label: "Cancelled", bg: "#FEE2E2", color: "#991B1B" };
  switch (ev.hub_visibility) {
    case "members": return { label: "Members only",       bg: "#F3E8FF", color: "#6D28D9" };
    case "hub":     return { label: "Hub page",           bg: "#E0F2FE", color: "#0369A1" };
    case "islands": return ev.calendar_approved
      ? { label: "Islands-wide",                bg: "#DCFCE7", color: "#15803D" }
      : { label: "Islands-wide · pending review", bg: "#FEF3C7", color: "#92400E" };
    default:        return { label: "Published",          bg: "#DCFCE7", color: "#15803D" };
  }
}

function toLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventsManager({ hubId, events, accent, hubVerified = false }: { hubId: string; events: AdminEvent[]; accent: string; hubVerified?: boolean }) {
  const router = useRouter();

  // Create form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [locality, setLocality] = useState("");
  const [category, setCategory] = useState("");
  const [priceText, setPriceText] = useState("");
  const [visibility, setVisibility] = useState<"islands" | "hub" | "members">("islands");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [ticketMode, setTicketMode] = useState<TicketMode>("none");
  const [ticketUrl, setTicketUrl] = useState("");
  const [ticketTypes, setTicketTypes] = useState<WebTicketType[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editLocality, setEditLocality] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPriceText, setEditPriceText] = useState("");
  const [editVisibility, setEditVisibility] = useState<"islands" | "hub" | "members">("islands");
  const [editTicketMode, setEditTicketMode] = useState<TicketMode>("none");
  const [editTicketUrl, setEditTicketUrl] = useState("");
  const [editTicketTypes, setEditTicketTypes] = useState<WebTicketType[]>([]);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit(ev: AdminEvent) {
    setEditingId(ev.id);
    setEditTitle(ev.title);
    setEditDate(toLocal(ev.starts_at));
    setEditEndDate(ev.ends_at ? toLocal(ev.ends_at) : "");
    setEditVenue(ev.venue ?? "");
    setEditLocality(ev.locality ?? "");
    setEditCategory(ev.category ?? "");
    setEditPriceText(ev.price_text ?? "");
    setEditVisibility((ev.hub_visibility as "islands" | "hub" | "members") ?? "islands");
    const mode: TicketMode = ev.ticket_url ? "external" : ev.has_tickets ? "oneshetland" : "none";
    setEditTicketMode(mode);
    setEditTicketUrl(ev.ticket_url ?? "");
    setEditTicketTypes(ev.ticket_types?.map(t => ({ name: t.name, price_pence: t.price_pence, quantity_available: t.quantity_available })) ?? []);
    setEditError(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return setError("Add a title and a start date/time.");
    setError(null);
    setBusy(true);
    try {
      let cover_url: string | null = null;
      if (coverFile) cover_url = await uploadHubMedia(hubId, "cover", coverFile);
      await createHubEvent(hubId, {
        title: title.trim(),
        starts_at: new Date(date).toISOString(),
        ends_at: endDate ? new Date(endDate).toISOString() : null,
        venue: venue.trim() || null,
        locality: locality.trim() || null,
        category: category.trim() || null,
        price_text: priceText.trim() || null,
        cover_url,
        hub_visibility: visibility,
        ticket_mode: ticketMode,
        ticket_url: ticketUrl.trim() || null,
        ticket_types: ticketTypes,
      });
      setTitle(""); setDate(""); setEndDate(""); setVenue(""); setLocality(""); setCategory(""); setPriceText(""); setCoverFile(null);
      setTicketMode("none"); setTicketUrl(""); setTicketTypes([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create event.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim() || !editDate) return setEditError("Add a title and a start date/time.");
    setEditError(null);
    setEditBusy(true);
    try {
      await updateHubEvent(id, {
        title: editTitle.trim(),
        starts_at: new Date(editDate).toISOString(),
        ends_at: editEndDate ? new Date(editEndDate).toISOString() : null,
        venue: editVenue.trim() || null,
        locality: editLocality.trim() || null,
        category: editCategory.trim() || null,
        price_text: editPriceText.trim() || null,
        hub_visibility: editVisibility,
        ticket_mode: editTicketMode,
        ticket_url: editTicketUrl.trim() || null,
        ticket_types: editTicketTypes,
      });
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Could not update event.");
    } finally {
      setEditBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this event? Members will still see it marked as cancelled.")) return;
    try {
      await updateHubEvent(id, { status: "cancelled" });
      router.refresh();
    } catch { /* ignore */ }
  }

  const now = Date.now();
  const upcoming = events.filter(e => new Date(e.starts_at).getTime() >= now - 6 * 3600_000);
  const past     = events.filter(e => new Date(e.starts_at).getTime() <  now - 6 * 3600_000);

  return (
    <div className="space-y-6">
      {/* Create form */}
      <form onSubmit={create} className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">New event</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" className="auth-input" />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-ink">Starts
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="auth-input mt-1" />
          </label>
          <label className="block text-sm font-semibold text-ink">Ends (optional)
            <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="auth-input mt-1" />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" className="auth-input" />
          <input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Area (e.g. Lerwick)" className="auth-input" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (optional)" className="auth-input" />
          <input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="Price text (e.g. From £10)" className="auth-input" />
        </div>
        <div>
          <span className="mb-1 block text-sm font-semibold text-ink">Visibility</span>
          <div className="flex flex-wrap gap-2">
            {VIS.map((v) => (
              <button type="button" key={v.key} onClick={() => setVisibility(v.key)} title={v.hint}
                className={"rounded-pill border px-4 py-1.5 text-sm font-semibold transition " + (visibility === v.key ? "text-paper" : "border-line bg-paper text-ink")}
                style={visibility === v.key ? { background: accent, borderColor: accent } : undefined}>
                {v.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-muted">{VIS.find((v) => v.key === visibility)?.hint}</p>
          {visibility === "islands" && !hubVerified && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Your hub isn&apos;t verified yet, so islands-wide events need a quick OK from the OneShetland team before they appear on the main What&apos;s On calendar. It&apos;ll show on your hub page in the meantime.
            </p>
          )}
        </div>
        <label className="block text-sm font-semibold text-ink">Cover image (optional)
          <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} className="mt-1 block text-sm text-ink-soft" />
        </label>
        <TicketSection mode={ticketMode} onMode={setTicketMode} url={ticketUrl} onUrl={setTicketUrl} types={ticketTypes} onTypes={setTicketTypes} accent={accent} />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-pill px-5 py-2.5 font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>
          {busy ? "Creating…" : "Create event"}
        </button>
      </form>

      {/* Event lists */}
      {events.length === 0 ? (
        <p className="text-center text-ink-muted py-6">No events yet. Create your first one above.</p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Upcoming</p>
              <ul className="space-y-2">{upcoming.map(ev => <EventRow key={ev.id} ev={ev} accent={accent} editingId={editingId} onEdit={openEdit} onCancelEdit={() => setEditingId(null)} editState={{ editTitle, setEditTitle, editDate, setEditDate, editEndDate, setEditEndDate, editVenue, setEditVenue, editLocality, setEditLocality, editCategory, setEditCategory, editPriceText, setEditPriceText, editVisibility, setEditVisibility, editTicketMode, setEditTicketMode, editTicketUrl, setEditTicketUrl, editTicketTypes, setEditTicketTypes, editBusy, editError }} onSave={saveEdit} onCancel={cancel} onDelete={async (id) => { await deleteEvent(id); router.refresh(); }} />)}</ul>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Past</p>
              <ul className="space-y-2">{past.map(ev => <EventRow key={ev.id} ev={ev} accent={accent} editingId={editingId} onEdit={openEdit} onCancelEdit={() => setEditingId(null)} editState={{ editTitle, setEditTitle, editDate, setEditDate, editEndDate, setEditEndDate, editVenue, setEditVenue, editLocality, setEditLocality, editCategory, setEditCategory, editPriceText, setEditPriceText, editVisibility, setEditVisibility, editTicketMode, setEditTicketMode, editTicketUrl, setEditTicketUrl, editTicketTypes, setEditTicketTypes, editBusy, editError }} onSave={saveEdit} onCancel={cancel} onDelete={async (id) => { await deleteEvent(id); router.refresh(); }} />)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type EditState = {
  editTitle: string; setEditTitle: (v: string) => void;
  editDate: string; setEditDate: (v: string) => void;
  editEndDate: string; setEditEndDate: (v: string) => void;
  editVenue: string; setEditVenue: (v: string) => void;
  editLocality: string; setEditLocality: (v: string) => void;
  editCategory: string; setEditCategory: (v: string) => void;
  editPriceText: string; setEditPriceText: (v: string) => void;
  editVisibility: "islands" | "hub" | "members"; setEditVisibility: (v: "islands" | "hub" | "members") => void;
  editTicketMode: TicketMode; setEditTicketMode: (v: TicketMode) => void;
  editTicketUrl: string; setEditTicketUrl: (v: string) => void;
  editTicketTypes: WebTicketType[]; setEditTicketTypes: (v: WebTicketType[]) => void;
  editBusy: boolean; editError: string | null;
};

function EventRow({ ev, accent, editingId, onEdit, onCancelEdit, editState, onSave, onCancel, onDelete }: {
  ev: AdminEvent; accent: string; editingId: string | null;
  onEdit: (ev: AdminEvent) => void; onCancelEdit: () => void;
  editState: EditState;
  onSave: (id: string) => void; onCancel: (id: string) => void; onDelete: (id: string) => void;
}) {
  const b = eventBadge(ev);
  const isEditing = editingId === ev.id;

  if (isEditing) {
    const s = editState;
    return (
      <li className="rounded-xl border border-line bg-paper p-4 shadow-soft space-y-3">
        <input value={s.editTitle} onChange={e => s.setEditTitle(e.target.value)} placeholder="Event title" className="auth-input" />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-ink">Starts
            <input type="datetime-local" value={s.editDate} onChange={e => s.setEditDate(e.target.value)} className="auth-input mt-1" />
          </label>
          <label className="block text-sm font-semibold text-ink">Ends (optional)
            <input type="datetime-local" value={s.editEndDate} onChange={e => s.setEditEndDate(e.target.value)} className="auth-input mt-1" />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={s.editVenue} onChange={e => s.setEditVenue(e.target.value)} placeholder="Venue" className="auth-input" />
          <input value={s.editLocality} onChange={e => s.setEditLocality(e.target.value)} placeholder="Area" className="auth-input" />
          <input value={s.editCategory} onChange={e => s.setEditCategory(e.target.value)} placeholder="Category" className="auth-input" />
          <input value={s.editPriceText} onChange={e => s.setEditPriceText(e.target.value)} placeholder="Price text" className="auth-input" />
        </div>
        <div className="flex flex-wrap gap-2">
          {VIS.map(v => (
            <button type="button" key={v.key} onClick={() => s.setEditVisibility(v.key)}
              className={"rounded-pill border px-4 py-1.5 text-sm font-semibold transition " + (s.editVisibility === v.key ? "text-paper" : "border-line bg-paper text-ink")}
              style={s.editVisibility === v.key ? { background: accent, borderColor: accent } : undefined}>
              {v.label}
            </button>
          ))}
        </div>
        <TicketSection mode={s.editTicketMode} onMode={s.setEditTicketMode} url={s.editTicketUrl} onUrl={s.setEditTicketUrl} types={s.editTicketTypes} onTypes={s.setEditTicketTypes} accent={accent} />
        {s.editError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{s.editError}</p>}
        <div className="flex gap-2">
          <button onClick={() => onSave(ev.id)} disabled={s.editBusy} className="rounded-pill px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>
            {s.editBusy ? "Saving…" : "Save"}
          </button>
          <button onClick={onCancelEdit} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">Cancel</button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
      <div className="min-w-0 flex-1">
        <span className="font-semibold text-ink">{ev.title}</span>
        <p className="mt-0.5 text-sm text-ink-muted">
          {new Date(ev.starts_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {ev.venue ? ` · ${ev.venue}` : ""}
        </p>
        <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: b.bg, color: b.color }}>{b.label}</span>
      </div>
      <div className="flex shrink-0 gap-2">
        {ev.status !== "cancelled" && (
          <button onClick={() => onEdit(ev)} className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink hover:bg-sand">Edit</button>
        )}
        {ev.status === "published" && new Date(ev.starts_at).getTime() > Date.now() && (
          <button onClick={() => onCancel(ev.id)} className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink hover:bg-sand">Cancel</button>
        )}
        <button onClick={() => onDelete(ev.id)} className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50">Delete</button>
      </div>
    </li>
  );
}

function TicketSection({
  mode, onMode, url, onUrl, types, onTypes, accent,
}: {
  mode: TicketMode; onMode: (m: TicketMode) => void;
  url: string; onUrl: (v: string) => void;
  types: WebTicketType[]; onTypes: (v: WebTicketType[]) => void;
  accent: string;
}) {
  function addType() {
    onTypes([...types, { name: "", price_pence: 0, quantity_available: null }]);
  }
  function updateType(i: number, patch: Partial<WebTicketType>) {
    onTypes(types.map((t, j) => j === i ? { ...t, ...patch } : t));
  }
  function removeType(i: number) {
    onTypes(types.filter((_, j) => j !== i));
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-ink">Tickets</span>
        <div className="flex flex-wrap gap-2">
          {TICKET_MODES.map((m) => (
            <button
              type="button"
              key={m.key}
              onClick={() => onMode(m.key)}
              title={m.hint}
              className={"rounded-pill border px-4 py-1.5 text-sm font-semibold transition " + (mode === m.key ? "text-paper" : "border-line bg-paper text-ink")}
              style={mode === m.key ? { background: accent, borderColor: accent } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-muted">{TICKET_MODES.find(m => m.key === mode)?.hint}</p>
      </div>

      {mode === "external" && (
        <input
          value={url}
          onChange={e => onUrl(e.target.value)}
          placeholder="https://..."
          type="url"
          className="auth-input"
        />
      )}

      {mode === "oneshetland" && (
        <div className="space-y-2">
          {types.map((t, i) => (
            <div key={i} className="rounded-xl border border-line bg-sand/30 p-3 space-y-2">
              <input
                value={t.name}
                onChange={e => updateType(i, { name: e.target.value })}
                placeholder="Ticket name (e.g. General, VIP)"
                className="auth-input"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-ink-muted">
                  Price (£)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={t.price_pence > 0 ? (t.price_pence / 100).toFixed(2) : ""}
                    onChange={e => updateType(i, { price_pence: Math.round(parseFloat(e.target.value || "0") * 100) })}
                    placeholder="0.00 = Free"
                    className="auth-input mt-1"
                  />
                </label>
                <label className="block text-xs font-semibold text-ink-muted">
                  Quantity (blank = unlimited)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={t.quantity_available ?? ""}
                    onChange={e => updateType(i, { quantity_available: e.target.value ? parseInt(e.target.value, 10) : null })}
                    placeholder="Unlimited"
                    className="auth-input mt-1"
                  />
                </label>
              </div>
              <button type="button" onClick={() => removeType(i)} className="text-xs font-semibold text-rose-500 hover:underline">
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addType}
            className="w-full rounded-xl border border-dashed border-current py-2.5 text-sm font-semibold transition hover:bg-sand/30"
            style={{ color: accent }}
          >
            + Add ticket type
          </button>
        </div>
      )}
    </div>
  );
}
