"use client";

/**
 * book-manage-items.ts — browser-side CRUD for a business owner's bookable
 * Services and Unit items (passes & packs). Mirrors the app's lib/book-api.ts
 * signatures, using the web browser Supabase client. Owner RLS gates writes to
 * the owner's own business rows.
 *
 * Tables: book_services, book_unit_items.
 */

import { createClient } from "@/lib/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BookService {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  price_pence: number; // 0 = price on request
  deposit_pence: number;
  requires_deposit: boolean;
  category: string | null;
  display_order: number;
  is_active: boolean;
  capacity: number; // simultaneous bookings the service supports (default 1)
  created_at: string;
}

export type ServiceUpsertInput = Partial<Omit<BookService, "id" | "business_id" | "created_at">> & {
  name: string;
  duration_minutes: number;
  price_pence: number;
};

export interface BookUnitItem {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price_pence: number;
  stock: number | null; // null = unlimited
  valid_days: number | null; // null = never expires
  uses_per_purchase: number; // default 1
  image_url: string | null;
  category: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UnitItemUpsertInput = Partial<Omit<BookUnitItem, "id" | "business_id" | "created_at" | "updated_at">> & {
  name: string;
  price_pence: number;
};

// ── Formatting helpers ───────────────────────────────────────────────────────

/** £25.00 / £0.00 / "Price on request" */
export function formatPence(pence: number): string {
  if (pence === 0) return "Price on request";
  return `£${(pence / 100).toFixed(2)}`;
}

/** "1h 30m" / "45m" / "2h" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Services ─────────────────────────────────────────────────────────────────

export async function fetchBusinessServices(businessId: string, includeInactive = false): Promise<BookService[]> {
  const sb = createClient();
  let q = sb
    .from("book_services")
    .select("*")
    .eq("business_id", businessId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BookService[];
}

export async function createService(businessId: string, input: ServiceUpsertInput): Promise<BookService> {
  const sb = createClient();
  const { data, error } = await sb
    .from("book_services")
    .insert({ business_id: businessId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as BookService;
}

export async function updateService(id: string, patch: Partial<ServiceUpsertInput>): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("book_services").update(patch).eq("id", id);
  if (error) throw error;
}

/** Soft-delete: deactivate so historical bookings aren't orphaned. */
export async function deleteService(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("book_services").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

// ── Unit items (passes & packs) ──────────────────────────────────────────────

export async function fetchBusinessUnitItems(businessId: string, includeInactive = false): Promise<BookUnitItem[]> {
  const sb = createClient();
  let q = sb
    .from("book_unit_items")
    .select("*")
    .eq("business_id", businessId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BookUnitItem[];
}

export async function createUnitItem(businessId: string, input: UnitItemUpsertInput): Promise<BookUnitItem> {
  const sb = createClient();
  const { data, error } = await sb
    .from("book_unit_items")
    .insert({ business_id: businessId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as BookUnitItem;
}

export async function updateUnitItem(id: string, patch: Partial<UnitItemUpsertInput>): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("book_unit_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Soft-delete — preserves history on book_unit_purchases. */
export async function deleteUnitItem(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("book_unit_items").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}
