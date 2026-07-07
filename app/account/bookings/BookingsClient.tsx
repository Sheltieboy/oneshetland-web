"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { gbp } from "@/lib/stripe";
import { fetchMyBookings, cancelBooking, type MyBooking, type BookingStatus } from "@/lib/book-data";

const LOCAL = "#7c3aed";

const STATUS_BADGE: Record<BookingStatus, { label: string; cls: string }> = {
  pending_payment: { label: "Awaiting payment", cls: "bg-amber-50 text-amber-700" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-sand text-ink-muted" },
  no_show: { label: "No-show", cls: "bg-rose-50 text-rose-700" },
  completed: { label: "Completed", cls: "bg-sand text-ink-soft" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function BookingsClient() {
  const [bookings, setBookings] = useState<MyBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchMyBookings();
      setBookings(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your bookings.");
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const u: MyBooking[] = [];
    const p: MyBooking[] = [];
    for (const b of bookings ?? []) {
      const isUpcoming = new Date(b.starts_at).getTime() >= now && b.status !== "cancelled";
      (isUpcoming ? u : p).push(b);
    }
    // Upcoming: nearest first. Past: most recent first.
    u.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    p.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    return { upcoming: u, past: p };
  }, [bookings]);

  const handleCancel = useCallback(
    async (id: string) => {
      setCancellingId(id);
      setError(null);
      try {
        await cancelBooking(id);
        setConfirmId(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not cancel that booking.");
      } finally {
        setCancellingId(null);
      }
    },
    [load],
  );

  if (bookings === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-sand" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-card border border-line bg-paper px-4 py-3 text-sm text-rose-600">{error}</p>
      )}

      <Section title="Upcoming" emptyText="You have no upcoming bookings.">
        {upcoming.map((b) => (
          <BookingRow
            key={b.id}
            booking={b}
            cancellable
            confirming={confirmId === b.id}
            cancelling={cancellingId === b.id}
            onAskCancel={() => setConfirmId(b.id)}
            onAbortCancel={() => setConfirmId(null)}
            onConfirmCancel={() => handleCancel(b.id)}
          />
        ))}
      </Section>

      <Section title="Past" emptyText="Bookings you've completed or cancelled will show here.">
        {past.map((b) => (
          <BookingRow key={b.id} booking={b} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold text-ink">{title}</h2>
      {children.length === 0 ? (
        <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
          <p className="text-sm text-ink-muted">{emptyText}</p>
        </div>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  );
}

function BookingRow({
  booking,
  cancellable = false,
  confirming = false,
  cancelling = false,
  onAskCancel,
  onAbortCancel,
  onConfirmCancel,
}: {
  booking: MyBooking;
  cancellable?: boolean;
  confirming?: boolean;
  cancelling?: boolean;
  onAskCancel?: () => void;
  onAbortCancel?: () => void;
  onConfirmCancel?: () => void;
}) {
  const badge = STATUS_BADGE[booking.status] ?? { label: booking.status, cls: "bg-sand text-ink-soft" };
  const isCancelled = booking.status === "cancelled";
  const canCancel = cancellable && booking.status === "confirmed";

  return (
    <li
      className={
        "rounded-card border border-line bg-paper p-4 shadow-soft " + (isCancelled ? "opacity-60" : "")
      }
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display font-bold text-ink">
              {booking.service?.name ?? "Booking"}
            </span>
            <span className={"shrink-0 rounded-pill px-2 py-0.5 text-xs font-bold " + badge.cls}>
              {badge.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-soft">{booking.business?.name ?? "Business"}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {formatDate(booking.starts_at)} · {formatTime(booking.starts_at)}–{formatTime(booking.ends_at)}
            {booking.price_pence > 0 ? ` · ${gbp(booking.price_pence)}` : ""}
          </p>
          {booking.notes ? (
            <p className="mt-2 rounded-card bg-sand px-3 py-2 text-sm italic text-ink-soft">{booking.notes}</p>
          ) : null}
        </div>
      </div>

      {canCancel && (
        <div className="mt-3 border-t border-line pt-3">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-soft">Cancel this booking?</span>
              <button
                onClick={onConfirmCancel}
                disabled={cancelling}
                className="rounded-pill bg-rose-600 px-4 py-1.5 text-sm font-semibold text-paper transition hover:bg-rose-700 disabled:opacity-60"
              >
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button
                onClick={onAbortCancel}
                disabled={cancelling}
                className="rounded-pill border border-line px-4 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-sand"
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              onClick={onAskCancel}
              className="rounded-pill border border-line px-4 py-1.5 text-sm font-semibold transition hover:bg-sand"
              style={{ color: LOCAL }}
            >
              Cancel booking
            </button>
          )}
        </div>
      )}
    </li>
  );
}
