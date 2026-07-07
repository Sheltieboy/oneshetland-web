/**
 * book-slots.ts (web)
 *
 * Pure slot computation — ported verbatim from the app (oneshetland-delivers
 * lib/book-slots.ts) so web and app produce identical bookable slots. No
 * Supabase calls. Timezone: everything in the device's local timezone.
 */

import type { BookAvailabilityRule, BookSlotOverride, BookBooking } from "./book-data";
import type { Service } from "./local-data";

const ONE_MINUTE = 60_000;

export interface SlotComputeInput {
  service: Service;
  rules: BookAvailabilityRule[];
  overrides: BookSlotOverride[];
  bookings: BookBooking[];
  from: Date; // window start (inclusive)
  to: Date; // window end (exclusive)
  now?: Date; // default = new Date()
  minLeadMinutes?: number; // default = 30
}

export interface Slot {
  start: Date;
  end: Date;
  lastMin: boolean;
  capacity: number;
  taken: number;
  isFull: boolean;
}

export function computeAvailableSlots(input: SlotComputeInput): Slot[] {
  const { service, rules, overrides, bookings, from, to, now = new Date(), minLeadMinutes = 30 } = input;

  const leadCutoff = new Date(now.getTime() + minLeadMinutes * ONE_MINUTE);
  const earliest = from > leadCutoff ? from : leadCutoff;

  const applicableRules = rules.filter((r) => r.service_id == null || r.service_id === service.id);
  const applicableOverrides = overrides.filter((o) => o.service_id == null || o.service_id === service.id);

  const closures = applicableOverrides.filter((o) => o.type === "closed");
  const openOverrides = applicableOverrides.filter((o) => o.type === "open" || o.type === "last_min");

  const slotMap = new Map<number, Slot>();

  const windowStart = startOfDay(from);
  const windowEnd = startOfDay(addDays(to, 1));

  for (let day = new Date(windowStart); day < windowEnd; day = addDays(day, 1)) {
    const dow = day.getDay();
    const dayRules = applicableRules.filter((r) => r.day_of_week === dow);
    for (const rule of dayRules) {
      generateSlotsInRange(
        timeOnDay(day, rule.start_time),
        timeOnDay(day, rule.end_time),
        rule.slot_interval_minutes,
        service.duration_minutes,
        service.buffer_minutes,
        false,
        slotMap,
      );
    }
  }

  for (const ov of openOverrides) {
    const ovStart = new Date(ov.starts_at);
    const ovEnd = new Date(ov.ends_at);
    if (ovEnd <= from || ovStart >= to) continue;
    generateSlotsInRange(
      ovStart,
      ovEnd,
      30,
      service.duration_minutes,
      service.buffer_minutes,
      ov.type === "last_min",
      slotMap,
    );
  }

  const blockingBookings = bookings.filter(
    (b) => (b.status === "confirmed" || b.status === "pending_payment") && b.service_id === service.id,
  );

  const bufferMs = service.buffer_minutes * ONE_MINUTE;
  const capacity = Math.max(1, service.capacity ?? 1);

  const result: Slot[] = [];
  for (const slot of slotMap.values()) {
    const cutoff = slot.lastMin ? now : earliest;
    if (slot.start < cutoff) continue;
    if (slot.end > to) continue;

    const inClosure = closures.some((c) => overlaps(slot.start, slot.end, new Date(c.starts_at), new Date(c.ends_at)));
    if (inClosure) continue;

    const slotEndWithBuf = new Date(slot.end.getTime() + bufferMs);
    const taken = blockingBookings.filter((b) =>
      overlaps(slot.start, slotEndWithBuf, new Date(b.starts_at), new Date(b.ends_at)),
    ).length;

    result.push({ ...slot, capacity, taken, isFull: taken >= capacity });
  }

  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function generateSlotsInRange(
  rangeStart: Date,
  rangeEnd: Date,
  intervalMinutes: number,
  durationMinutes: number,
  bufferMinutes: number,
  lastMin: boolean,
  out: Map<number, Slot>,
): void {
  const intervalMs = intervalMinutes * ONE_MINUTE;
  const durationMs = durationMinutes * ONE_MINUTE;
  const bufferMs = bufferMinutes * ONE_MINUTE;

  for (let t = rangeStart.getTime(); t + durationMs + bufferMs <= rangeEnd.getTime(); t += intervalMs) {
    const start = new Date(t);
    const end = new Date(t + durationMs);
    const existing = out.get(t);
    if (existing) {
      if (lastMin && !existing.lastMin) out.set(t, { start, end, lastMin: true, capacity: 1, taken: 0, isFull: false });
    } else {
      out.set(t, { start, end, lastMin, capacity: 1, taken: 0, isFull: false });
    }
  }
}

function timeOnDay(day: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const out = new Date(day);
  out.setHours(h, m || 0, 0, 0);
  return out;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
