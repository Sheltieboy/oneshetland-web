"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { gbp } from "@/lib/stripe";
import type { Service } from "@/lib/local-data";
import { fetchAvailabilityRules, fetchUpcomingOverrides, fetchPublicBookings, createBooking } from "@/lib/book-data";
import { computeAvailableSlots, type Slot } from "@/lib/book-slots";

const WINDOW_DAYS = 14;

function dayKey(d: Date) { return d.toDateString(); }

export function BookServiceModal({
  open,
  onClose,
  service,
  businessId,
  accent,
  isLoggedIn,
  signInHref,
  userId,
  giftId,
}: {
  open: boolean;
  onClose: () => void;
  service: Service;
  businessId: string;
  accent: string;
  isLoggedIn: boolean;
  signInHref: string;
  userId: string | null;
  giftId?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"select" | "done">("select");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Slot | null>(null);

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    let live = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const now = new Date();
        const to = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);
        const [rules, overrides, bookings] = await Promise.all([
          fetchAvailabilityRules(businessId),
          fetchUpcomingOverrides(businessId, now.toISOString()),
          fetchPublicBookings(businessId, now.toISOString(), to.toISOString()),
        ]);
        const computed = computeAvailableSlots({ service, rules, overrides, bookings, from: now, to });
        if (!live) return;
        setSlots(computed);
        const firstOpen = computed.find((s) => !s.isFull);
        setSelectedDay(firstOpen ? dayKey(firstOpen.start) : null);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Could not load availability.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [open, isLoggedIn, businessId, service]);

  // The list of days (within the window) that have at least one open slot.
  const days = useMemo(() => {
    const map = new Map<string, Date>();
    for (const s of slots) {
      if (s.isFull) continue;
      const k = dayKey(s.start);
      if (!map.has(k)) map.set(k, new Date(s.start.getFullYear(), s.start.getMonth(), s.start.getDate()));
    }
    return [...map.values()].sort((a, b) => a.getTime() - b.getTime());
  }, [slots]);

  const daySlots = useMemo(
    () => slots.filter((s) => selectedDay && dayKey(s.start) === selectedDay).sort((a, b) => a.start.getTime() - b.start.getTime()),
    [slots, selectedDay],
  );

  // Gift redemptions are already paid for — never collect a deposit (mirrors the app's local-book-confirm).
  const depositPence = giftId ? 0 : service.requires_deposit ? service.deposit_pence : 0;

  async function confirm() {
    if (!selectedSlot || !userId) return;
    setBusy(true); setError(null);
    try {
      await createBooking({
        businessId,
        serviceId: service.id,
        customerId: userId,
        startsAt: selectedSlot.start.toISOString(),
        endsAt: selectedSlot.end.toISOString(),
        pricePence: service.price_pence,
        depositPence,
        notes: notes.trim() || null,
        giftId,
      });
      setBooked(selectedSlot);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm the booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Book ${service.name}`} accent={accent}>
      {!isLoggedIn ? (
        <div>
          <p className="text-ink-soft">Please sign in to book — it keeps your bookings in one place.</p>
          <Link href={signInHref} className="mt-4 inline-block rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>
            Sign in
          </Link>
        </div>
      ) : step === "done" && booked ? (
        <div className="py-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: accent }}>✓</span>
          <h3 className="mt-4 font-display text-2xl font-bold">Booking confirmed!</h3>
          <p className="mt-2 text-ink-soft">
            {service.name} ·{" "}
            {booked.start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at{" "}
            {booked.start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
          {service.price_pence > 0 && (
            <p className="mt-1 text-sm text-ink-muted">
              {depositPence > 0 ? `${gbp(depositPence)} deposit · ` : ""}Pay {gbp(service.price_pence)} at the venue.
            </p>
          )}
          <button onClick={onClose} className="mt-5 rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>Done</button>
        </div>
      ) : loading ? (
        <p className="py-8 text-center text-ink-muted">Loading available times…</p>
      ) : days.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-ink-soft">No open slots in the next {WINDOW_DAYS} days.</p>
          {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-paper p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{service.name}</span>
              <span className="font-display font-bold" style={{ color: accent }}>
                {service.price_pence === 0 ? "Price on request" : gbp(service.price_pence)}
              </span>
            </div>
            <p className="mt-0.5 text-ink-muted">{service.duration_minutes} min</p>
          </div>

          {/* Date strip */}
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Pick a day</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => {
                const k = dayKey(d);
                const on = k === selectedDay;
                return (
                  <button
                    key={k}
                    onClick={() => { setSelectedDay(k); setSelectedSlot(null); }}
                    className={"shrink-0 rounded-xl border px-3 py-2 text-center text-sm transition " + (on ? "text-paper" : "border-line bg-paper text-ink hover:border-current")}
                    style={on ? { background: accent, borderColor: accent } : { color: accent }}
                  >
                    <span className="block text-xs font-semibold">{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                    <span className="block font-display text-lg font-bold leading-tight">{d.getDate()}</span>
                    <span className="block text-[11px]">{d.toLocaleDateString("en-GB", { month: "short" })}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot grid */}
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Pick a time</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {daySlots.map((s) => {
                const on = selectedSlot?.start.getTime() === s.start.getTime();
                return (
                  <button
                    key={s.start.getTime()}
                    disabled={s.isFull}
                    onClick={() => setSelectedSlot(s)}
                    className={"rounded-lg border px-2 py-2 text-sm font-semibold transition disabled:opacity-40 " + (on ? "text-paper" : "border-line bg-paper text-ink hover:border-current")}
                    style={on ? { background: accent, borderColor: accent } : { color: accent }}
                  >
                    {s.start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    {s.lastMin && <span className="ml-0.5 text-[10px]">⚡</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">Notes (optional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 300))} rows={2} className="auth-input" placeholder="Anything the business should know…" />
          </label>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

          <button
            onClick={confirm}
            disabled={busy || !selectedSlot}
            className="w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"
            style={{ background: accent }}
          >
            {busy ? "Please wait…" : selectedSlot
              ? `Confirm · ${selectedSlot.start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${selectedSlot.start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
              : "Pick a time"}
          </button>
          <p className="text-center text-[11px] text-ink-muted">No payment taken now — settle at the venue.</p>
        </div>
      )}
    </Modal>
  );
}
