"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ, type ManagedBusiness } from "@/lib/business-data";
import { setAcceptsBookings } from "@/lib/business-client";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ServicesManager } from "@/components/business/ServicesManager";
import { ScheduleManager } from "@/components/business/ScheduleManager";
import type { BookAvailabilityRule, BookSlotOverride } from "@/lib/book-data";
import {
  fetchBusinessBookings,
  updateBookingStatus,
  cancelBookingAsOwner,
  formatPence,
  type OwnerBooking,
  type BookingStatus,
} from "@/lib/book-owner";

const STATUS_INFO: Record<BookingStatus, { label: string; className: string }> = {
  pending_payment: { label: "Awaiting payment", className: "bg-amber-50 text-amber-700" },
  confirmed:       { label: "Confirmed",        className: "bg-emerald-50 text-emerald-700" },
  cancelled:       { label: "Cancelled",        className: "bg-sand text-ink-muted" },
  no_show:         { label: "No-show",          className: "bg-rose-50 text-rose-700" },
  completed:       { label: "Completed",        className: "bg-sand text-ink-muted" },
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function BookingsManager({ business, servicesCount, services, rules, overrides }: {
  business: ManagedBusiness;
  servicesCount: number;
  services: { id: string; name: string }[];
  rules: BookAvailabilityRule[];
  overrides: BookSlotOverride[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  // A business is bookable only when it has something to book AND hours to book
  // it in. Both were previously on other screens with nothing linking them.
  const hasHours = rules.length > 0;
  const missing = [
    servicesCount === 0 ? "add a service" : null,
    !hasHours ? "set your hours" : null,
  ].filter(Boolean) as string[];
  const ready = missing.length === 0;

  const load = useCallback(async () => {
    try {
      const rows = await fetchBusinessBookings(business.id);
      setBookings(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [business.id]);

  useEffect(() => { load(); }, [load]);

  async function toggle(v: boolean) {
    setBusy(true); setError(null);
    try { await setAcceptsBookings(business.id, v); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update."); }
    finally { setBusy(false); }
  }

  // Partition: anything closed (cancelled/completed/no_show) or already started → Past.
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const u: OwnerBooking[] = [];
    const p: OwnerBooking[] = [];
    for (const b of bookings) {
      const closed = b.status === "cancelled" || b.status === "completed" || b.status === "no_show";
      if (closed || new Date(b.starts_at).getTime() < now) p.push(b);
      else u.push(b);
    }
    u.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    p.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    return { upcoming: u, past: p };
  }, [bookings]);

  async function act(id: string, fn: () => Promise<void>) {
    setActing(id); setError(null);
    // Optimistic: drop it from the visible action set by reloading after the write.
    try { await fn(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update booking."); }
    finally { setActing(null); }
  }

  function Row({ b }: { b: OwnerBooking }) {
    const info = STATUS_INFO[b.status];
    const isClosed = b.status === "cancelled" || b.status === "completed" || b.status === "no_show";
    const canAct = b.status === "confirmed";
    const isActing = acting === b.id;
    return (
      <div className={"rounded-card border border-line bg-paper p-4 shadow-soft " + (isClosed ? "opacity-70" : "")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink">{b.customer?.full_name ?? "Customer"}</p>
            <p className="text-sm text-ink-muted">{b.service?.name ?? "Service"}</p>
            <p className="mt-1 text-xs text-ink-muted">{fmtDateTime(b.starts_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={"rounded-pill px-2.5 py-0.5 text-[11px] font-semibold " + info.className}>{info.label}</span>
            {b.price_pence > 0 && <span className="text-sm font-semibold text-ink">{formatPence(b.price_pence)}</span>}
          </div>
        </div>
        {canAct && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            <button
              type="button" disabled={isActing}
              onClick={() => act(b.id, () => updateBookingStatus(b.id, "completed"))}
              className="rounded-pill border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >Mark complete</button>
            <button
              type="button" disabled={isActing}
              onClick={() => act(b.id, () => updateBookingStatus(b.id, "no_show"))}
              className="rounded-pill border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >Mark no-show</button>
            <button
              type="button" disabled={isActing}
              onClick={async () => { if (await confirm({ title: "Cancel this booking?", body: "The customer will be notified.", confirmLabel: "Cancel booking", danger: true })) act(b.id, () => cancelBookingAsOwner(b.id)); }}
              className="rounded-pill border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >Cancel</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {/* ── The three steps, in the order you'd actually do them ──────────── */}
      <Step
        n={1}
        title="What people can book"
        done={servicesCount > 0}
        hint={servicesCount > 0 ? `${servicesCount} service${servicesCount === 1 ? "" : "s"}` : "None yet"}
        anchor="services"
      >
        <ServicesManager businessId={business.id} />
      </Step>

      <Step
        n={2}
        title="When you're available"
        done={hasHours}
        hint={hasHours ? `${rules.length} weekly rule${rules.length === 1 ? "" : "s"}` : "No hours set"}
        anchor="availability"
      >
        <ScheduleManager businessId={business.id} services={services} rules={rules} overrides={overrides} />
      </Step>

      {/* ── 3. Go live ─────────────────────────────────────────────────────── */}
      {/* Disabled until the two above are done. Switching this on with nothing
          to book is worse than being invisible: a customer clicks through and
          finds an empty calendar. */}
      <section id="go-live" className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <StepNumber n={3} done={business.accepts_bookings} />
              Go live
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {business.accepts_bookings
                ? "Live — customers can book your services."
                : ready
                  ? "Ready. Switch on and folk can start booking."
                  : missing.length === 2
                    ? "Add a service and set your hours first."
                    : `Nearly there — ${missing[0]} first.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggle(!business.accepts_bookings)}
            disabled={busy || (!ready && !business.accepts_bookings)}
            title={!ready && !business.accepts_bookings ? "Finish steps 1 and 2 first" : undefined}
            className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: business.accepts_bookings ? BIZ : "var(--color-line-strong)" }}
          >
            <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (business.accepts_bookings ? "translate-x-5" : "translate-x-0.5")} />
          </button>
        </div>
      </section>

      {/* Upcoming */}
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Upcoming{upcoming.length > 0 ? ` (${upcoming.length})` : ""}</p>
        {loading ? (
          <p className="rounded-card border border-dashed border-line bg-paper/60 px-5 py-8 text-center text-sm text-ink-muted">Loading bookings…</p>
        ) : upcoming.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-paper/60 px-5 py-8 text-center text-sm text-ink-muted">Nothing booked yet. When customers book, they&apos;ll appear here.</p>
        ) : (
          <div className="space-y-3">{upcoming.map((b) => <Row key={b.id} b={b} />)}</div>
        )}
      </section>

      {/* Past */}
      {!loading && past.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Past ({past.length})</p>
          <div className="space-y-3">{past.map((b) => <Row key={b.id} b={b} />)}</div>
        </section>
      )}
    </div>
  );
}

/* ── Step scaffolding ───────────────────────────────────────────────────────
 * The number and tick exist so the sequence is legible at a glance. The whole
 * reason this page was rebuilt is that the order was invisible: you could do
 * the two obvious things and still be unbookable, with nothing saying why.
 */

function StepNumber({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
      style={{ background: done ? "#10B981" : "var(--color-line-strong)" }}
      aria-hidden
    >
      {done ? "✓" : n}
    </span>
  );
}

function Step({ n, title, done, hint, anchor, children }: {
  n: number;
  title: string;
  done: boolean;
  hint: string;
  anchor: string;
  children: React.ReactNode;
}) {
  return (
    <section id={anchor} className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <StepNumber n={n} done={done} />
          {title}
        </p>
        <span className={"rounded-pill px-2.5 py-0.5 text-xs font-semibold " + (done ? "bg-emerald-50 text-emerald-700" : "bg-sand text-ink-muted")}>
          {hint}
        </span>
      </div>
      {children}
    </section>
  );
}
