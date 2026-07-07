"use client";

/**
 * book-manage-schedule.ts
 *
 * Owner-side write ops for OneShetland Book scheduling — weekly availability
 * rules + one-off slot overrides. Mirrors the app's book-api.ts schedule CRUD.
 * Uses the browser Supabase client; owner RLS scopes every write to the
 * business the signed-in user owns.
 *
 * Read helpers (fetchAvailabilityRules / fetchUpcomingOverrides) + the shared
 * types live in lib/book-data.ts and are re-exported here for convenience so a
 * caller only needs this one module.
 */

import { createClient } from "@/lib/supabase/client";
import type { BookOverrideType } from "@/lib/book-data";

export {
  fetchAvailabilityRules,
  fetchUpcomingOverrides,
  type BookAvailabilityRule,
  type BookSlotOverride,
  type BookOverrideType,
} from "@/lib/book-data";

/* ── Days / formatting helpers ───────────────────────────────────────────────── */

export const DAYS_OF_WEEK = [
  { idx: 0, short: "Sun", long: "Sunday" },
  { idx: 1, short: "Mon", long: "Monday" },
  { idx: 2, short: "Tue", long: "Tuesday" },
  { idx: 3, short: "Wed", long: "Wednesday" },
  { idx: 4, short: "Thu", long: "Thursday" },
  { idx: 5, short: "Fri", long: "Friday" },
  { idx: 6, short: "Sat", long: "Saturday" },
] as const;

/** "09:00" — strips seconds and any TZ junk. */
export function formatTime(t: string): string {
  return t.slice(0, 5);
}

/* ── Availability rules (weekly hours) ───────────────────────────────────────── */

export type AvailabilityRuleInput = {
  service_id?: string | null;
  day_of_week: number; // 0 = Sun, 6 = Sat
  start_time: string; // 'HH:MM'
  end_time: string; // 'HH:MM'
  slot_interval_minutes?: number;
};

export async function createAvailabilityRule(businessId: string, input: AvailabilityRuleInput): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("book_availability_rules").insert({
    business_id: businessId,
    service_id: input.service_id ?? null,
    day_of_week: input.day_of_week,
    start_time: input.start_time,
    end_time: input.end_time,
    slot_interval_minutes: input.slot_interval_minutes ?? 30,
  });
  if (error) throw error;
}

/** Soft-delete: deactivate so historical slots stay intact. */
export async function deleteAvailabilityRule(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("book_availability_rules").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

/* ── Slot overrides (one-off open / closed / last-min) ───────────────────────── */

export type OverrideInput = {
  service_id?: string | null;
  starts_at: string; // ISO
  ends_at: string; // ISO
  type: BookOverrideType;
  notes?: string | null;
};

export async function createOverride(businessId: string, input: OverrideInput): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("book_slot_overrides").insert({
    business_id: businessId,
    service_id: input.service_id ?? null,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    type: input.type,
    notes: input.notes ?? null,
  });
  if (error) throw error;
}

export async function deleteOverride(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("book_slot_overrides").delete().eq("id", id);
  if (error) throw error;
}
