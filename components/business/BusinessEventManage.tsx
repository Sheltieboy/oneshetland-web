"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UPDATE_KIND_LABELS, type EventStatus, type EventUpdateKind } from "@/lib/events-data";
import type { ManageEvent, EventSalesStats } from "@/lib/events-manage";
import { ticketCapacity } from "@/lib/event-ticket-utils";
import { setEventStatus, postEventUpdate, eventHasActivePaidTicket } from "@/lib/events-manage-client";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { startOrResumePayoutSetup } from "@/lib/payout-readiness";

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
  const confirm = useConfirm();
  const base = `/business/${businessId}/manage/events`;

  const [statusBusy, setStatusBusy] = useState(false);
  const status = event.status;
  // Ticket inventory when this event sells through OneShetland; otherwise the
  // venue figure, which is what the card always used to show.
  const cap = ticketCapacity(event.ticket_types, event.capacity);
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  const isPublished = status === "published";
  const isCancelled = status === "cancelled";

  // A draft with an active paid (or mixed) ticket type can't actually go
  // live until the business has a working payout route — the same rule
  // BusinessEventForm's Save & publish already enforces. This only changes
  // what Event Manage SHOWS (the publish action, the not-published banner);
  // it is a display/UX read of event.payout_ready (already resolved
  // server-side by getBusinessEvent), not a new gate — publishing itself is
  // stopped by not offering the action, and money still can't move without
  // a real payout route regardless of what this screen shows.
  const notReadyPaidDraft = status === "draft"
    && eventHasActivePaidTicket(event.ticket_types)
    && !event.payout_ready;

  // Launches the correct Stripe onboarding flow directly for this business
  // (see startOrResumePayoutSetup) instead of sending the merchant to the
  // Plan & payouts screen — the popup opens on top of this exact page, so
  // closing it already leaves the merchant here.
  async function goConnectStripe() {
    try {
      await startOrResumePayoutSetup(businessId);
    } finally {
      router.refresh();
    }
  }

  // Post-update form
  const [showForm, setShowForm] = useState(false);
  const [uTitle, setUTitle] = useState("");
  const [uBody, setUBody] = useState("");
  const [uKind, setUKind] = useState<EventUpdateKind>("info");
  const [uUrgent, setUUrgent] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uError, setUError] = useState<string | null>(null);

  async function changeStatus(next: EventStatus, confirmMsg?: string) {
    if (confirmMsg && !(await confirm({ title: "Are you sure?", body: confirmMsg, confirmLabel: "Confirm", danger: true }))) return;
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
          {/* A draft isn't publicly visible (events_public_read — a
              non-published event is is_hidden, readable only by its
              owner/admin), so what this opens for the organiser here is a
              preview only they can see, not what a customer sees. */}
          <Link href={`/events/${event.id}`} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand">
            {isPublished ? "View public page" : "Preview public page"}
          </Link>
        </div>
      </div>

      {/* Not published: paid/mixed draft, business not payout-ready. The
          status pill above still says "Draft" either way — this is the
          unmissable version, with the actual next step attached. */}
      {notReadyPaidDraft && (
        <section className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <span className="text-lg">🏦</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">Not published</p>
            <p className="text-sm text-amber-800">Connect Stripe to publish this event and start selling paid tickets.</p>
          </div>
          <button onClick={goConnectStripe} className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper" style={{ background: "#92400E" }}>
            Connect Stripe
          </button>
        </section>
      )}

      {/* Status controls */}
      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper p-4 shadow-soft">
        {status === "draft" && (
          notReadyPaidDraft ? (
            // Publishing cannot succeed yet, so this never attempts it — it
            // goes straight to the one place that actually unblocks it.
            // Reverts to the normal accent "Publish now" the moment
            // event.payout_ready reads true (a free-only draft never sets
            // notReadyPaidDraft in the first place — see its computation).
            <button onClick={goConnectStripe} className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper" style={{ background: "#92400E" }}>Connect Stripe to publish</button>
          ) : (
            <button onClick={() => changeStatus("published")} disabled={statusBusy} className="rounded-pill px-4 py-1.5 text-sm font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>Publish now</button>
          )
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
        <StatBox
          label={cap.source === "tickets" ? "Ticket capacity" : "Capacity"}
          value={cap.label}
          color="#475569"
        />
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
