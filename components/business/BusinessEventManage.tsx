"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UPDATE_KIND_LABELS, type EventStatus, type EventUpdateKind } from "@/lib/events-data";
import type { ManageEvent, EventSalesStats } from "@/lib/events-manage";
import { setEventStatus, postEventUpdate } from "@/lib/events-manage-client";

const STATUS_CFG: Record<EventStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "Draft",     bg: "#E2E8F0", color: "#475569" },
  published: { label: "Published", bg: "#DCFCE7", color: "#15803D" },
  cancelled: { label: "Cancelled", bg: "#FEE2E2", color: "#991B1B" },
  postponed: { label: "Postponed", bg: "#FEF3C7", color: "#92400E" },
  archived:  { label: "Archived",  bg: "#E2E8F0", color: "#475569" },
};

const UPDATE_KINDS: EventUpdateKind[] = ["info", "urgent", "venue_change", "time_change", "weather", "entry_info"];

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function BusinessEventManage({
  businessId, accent, event, stats,
}: {
  businessId: string;
  accent: string;
  event: ManageEvent;
  stats: EventSalesStats;
}) {
  const router = useRouter();
  const base = `/business/${businessId}/manage/events`;

  const [statusBusy, setStatusBusy] = useState(false);
  const status = event.status;
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  const isPublished = status === "published";
  const isCancelled = status === "cancelled";

  // Post-update form
  const [showForm, setShowForm] = useState(false);
  const [uTitle, setUTitle] = useState("");
  const [uBody, setUBody] = useState("");
  const [uKind, setUKind] = useState<EventUpdateKind>("info");
  const [uUrgent, setUUrgent] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uError, setUError] = useState<string | null>(null);

  async function changeStatus(next: EventStatus, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setStatusBusy(true);
    try {
      await setEventStatus(event.id, next);
      router.refresh();
    } catch {
      /* ignore */
    } finally {
      setStatusBusy(false);
    }
  }

  async function submitUpdate() {
    if (!uTitle.trim()) return setUError("Add an update headline.");
    setUError(null);
    setPosting(true);
    try {
      await postEventUpdate({ eventId: event.id, title: uTitle.trim(), body: uBody.trim(), kind: uKind, is_urgent: uUrgent });
      setShowForm(false);
      setUTitle(""); setUBody(""); setUKind("info"); setUUrgent(false);
      router.refresh();
    } catch (e) {
      setUError(e instanceof Error ? e.message : "Could not post the update.");
    } finally {
      setPosting(false);
    }
  }

  const revenue = (stats.revenue_pence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-block rounded-full px-3 py-1 text-xs font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
        <p className="text-sm text-ink-muted">{fmtDateTime(event.starts_at)}{event.venue ? ` · ${event.venue}` : ""}</p>
        <div className="ml-auto flex gap-2">
          <Link href={`${base}/${event.id}/edit`} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand">Edit</Link>
          <Link href={`/events/${event.id}`} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand">View public page</Link>
        </div>
      </div>

      {/* Status controls */}
      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper p-4 shadow-soft">
        {status === "draft" && (
          <button onClick={() => changeStatus("published")} disabled={statusBusy} className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>Publish now</button>
        )}
        {isPublished && (
          <>
            <button onClick={() => changeStatus("draft")} disabled={statusBusy} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50">Unpublish</button>
            <button onClick={() => changeStatus("postponed", "Mark this event as postponed?")} disabled={statusBusy} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50">Postpone</button>
          </>
        )}
        {status === "postponed" && (
          <button onClick={() => changeStatus("published")} disabled={statusBusy} className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>Re-publish</button>
        )}
        {!isCancelled && status !== "archived" && (
          <button onClick={() => changeStatus("archived", "Archive this event? It will be hidden from the public.")} disabled={statusBusy} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-50">Archive</button>
        )}
        {!isCancelled && (
          <button onClick={() => changeStatus("cancelled", "Cancel this event? Ticket-holders will see it marked as cancelled.")} disabled={statusBusy} className="rounded-pill border border-rose-200 px-4 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Cancel event</button>
        )}
        {statusBusy && <span className="text-sm text-ink-muted">Saving…</span>}
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Tickets sold" value={String(stats.tickets_sold)} color={accent} />
        <StatBox label="Checked in" value={String(stats.checked_in)} color="#15803D" />
        <StatBox label="Revenue" value={revenue} color="#0369A1" />
        <StatBox label="Capacity" value={event.capacity != null ? String(event.capacity) : "∞"} color="#475569" />
      </section>
      {stats.pending_payment > 0 && (
        <p className="text-xs text-ink-muted">{stats.pending_payment} ticket{stats.pending_payment === 1 ? "" : "s"} pending payment (not yet counted in sales).</p>
      )}

      {/* Post an update */}
      <section className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Post an update</h2>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper" style={{ background: accent }}>New update</button>
          )}
        </div>
        <p className="text-sm text-ink-muted">Updates notify everyone holding a ticket for this event.</p>

        {showForm && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {UPDATE_KINDS.map((k) => (
                <button type="button" key={k} onClick={() => { setUKind(k); setUUrgent(k === "urgent"); }}
                  className={"rounded-pill border px-3.5 py-1.5 text-sm font-semibold transition " + (uKind === k ? "text-paper" : "border-line bg-paper text-ink")}
                  style={uKind === k ? { background: accent, borderColor: accent } : undefined}>
                  {UPDATE_KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <input value={uTitle} onChange={(e) => setUTitle(e.target.value)} placeholder="Update headline" className="auth-input" />
            <textarea value={uBody} onChange={(e) => setUBody(e.target.value)} placeholder="Details (optional)" rows={3} className="auth-input" />
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" checked={uUrgent} onChange={(e) => setUUrgent(e.target.checked)} />
              Mark as urgent
            </label>
            {uError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{uError}</p>}
            <div className="flex gap-2">
              <button onClick={submitUpdate} disabled={posting} className="rounded-pill px-5 py-2 text-sm font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>
                {posting ? "Posting…" : "Post update"}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-pill border border-line-strong px-5 py-2 text-sm font-semibold text-ink hover:bg-sand">Cancel</button>
            </div>
          </div>
        )}

        {/* History */}
        {event.updates.length > 0 && (
          <ul className="space-y-2 pt-1">
            {event.updates.map((u) => (
              <li key={u.id} className="flex items-start gap-3 rounded-xl border border-line bg-paper p-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: u.is_urgent ? "#dc2626" : accent }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase" style={{ color: accent }}>{UPDATE_KIND_LABELS[u.kind]}</span>
                    <span className="text-xs text-ink-muted">{new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  </div>
                  <p className="text-sm font-semibold text-ink">{u.title}</p>
                  {u.body && <p className="text-sm text-ink-muted">{u.body}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4 text-center shadow-soft">
      <p className="font-display text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-ink-muted">{label}</p>
    </div>
  );
}
