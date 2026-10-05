"use client";

import type { Plan, PlanItem } from "@/lib/product-import/plan";

/* Types mirrored from the API (JSON). Kept here so the client never imports server-only modules. */

export type Step = "upload" | "columns" | "review" | "importing" | "result";

export type Inspection = {
  filename: string;
  delimiter: "," | ";";
  headers: string[];
  rowCount: number;
  preset: "oneshetland" | "shopify" | "woocommerce" | "square" | "generic";
  presetInfo: { id: string; label: string; imports: string[]; ignores: string[] };
  suggestedMapping: Record<string, number>;
  sample: string[][];
};

export type PlanResponse = { plan: Plan; preset: Inspection["preset"]; mapping: Record<string, number>; signature: string };

export type BatchRow = {
  id: string; item_index: number; row_numbers: number[]; action: PlanItem["action"]; status: "pending" | "applied" | "failed" | "skipped" | "undone";
  title: string | null; ext_ref: string | null; sku: string | null; product_id: string | null;
  errors: { message: string }[]; warnings: { message: string }[]; result: { created?: boolean; updated?: boolean; changed_fields?: string[]; locked_skipped?: string[] } | null;
  image_status: "none" | "pending" | "processing" | "done" | "partial" | "failed";
  product: { id: string; title: string; photos: number; is_active: boolean } | null;
  publish: "live" | "ready" | "needs_photo" | "needs_review" | "blocked" | "none";
  imageProblems: string[];
};
export type Batch = {
  id: string; status: "queued" | "applying" | "complete" | "complete_with_errors" | "undone" | "cancelled"; preset: string | null; filename: string | null;
  total_items: number; counts: Record<string, number>; created_at: string; completed_at: string | null; undo_expires_at: string; undone_at: string | null;
};
export type BatchDetail = { batch: Batch; items: BatchRow[] };
export type HistoryEntry = Pick<Batch, "id" | "status" | "filename" | "created_at" | "counts" | "total_items" | "undo_expires_at">;

export const STATUS_LABEL: Record<string, string> = {
  queued: "Not started", applying: "Unfinished — carry on to finish it", complete: "Finished", complete_with_errors: "Finished with problems", undone: "Undone", cancelled: "Cancelled",
};

/** Fixed zone so the server render and the browser agree (a merchant in Shetland sees UK time, not the server's). */
export const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });

/** The plain-English tallies for one import, e.g. ["3 new", "1 need attention"]. */
export function countBits(c: Record<string, number> | null | undefined): string[] {
  const k = c ?? {};
  const attention = (k.error ?? 0) + (k.failed ?? 0);
  return [k.create ? `${k.create} new` : null, k.update ? `${k.update} updated` : null, k.unchanged ? `${k.unchanged} unchanged` : null, k.skip ? `${k.skip} not imported` : null,
    attention > 0 ? `${attention} need attention` : null, k.images_failed ? `${k.images_failed} with photo problems` : null].filter((x): x is string => !!x);
}

export const pounds = (pence: number | null | undefined) => (pence == null ? "—" : `£${(pence / 100).toFixed(2)}`);

export const FIELD_NICE: Record<string, string> = {
  title: "Title", description: "Description", category: "Category", price_pence: "Price", compare_at_pence: "Compare-at price",
  stock_mode: "Stock mode", stock: "Stock", lead_time_days: "Lead time", collect_only: "Collect only", free_uk_post: "Free UK postage",
  sku: "SKU", variants: "Options", photos: "Photos",
};
const money = new Set(["price_pence", "compare_at_pence"]);
export const showValue = (field: string, v: unknown) => (v == null || v === "" ? "—" : money.has(field) ? pounds(Number(v)) : typeof v === "boolean" ? (v ? "yes" : "no") : String(v).length > 60 ? `${String(v).slice(0, 60)}…` : String(v));

export function Badge({ tone, children }: { tone: "green" | "blue" | "gray" | "amber" | "rose"; children: React.ReactNode }) {
  const cls = {
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    blue: "bg-sky-50 text-sky-800 border-sky-200",
    gray: "bg-sand text-ink-soft border-line",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  }[tone];
  return <span className={`inline-flex shrink-0 items-center rounded-pill border px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>;
}

export const ACTION_BADGE: Record<PlanItem["action"], { label: string; tone: "green" | "blue" | "gray" | "amber" | "rose" }> = {
  create: { label: "New", tone: "green" },
  update: { label: "Update", tone: "blue" },
  unchanged: { label: "Unchanged", tone: "gray" },
  skip: { label: "Not imported", tone: "amber" },
  error: { label: "Needs attention", tone: "rose" },
};

export function rowsLabel(rows: number[]): string {
  if (!rows.length) return "";
  const first = rows[0], last = rows[rows.length - 1];
  return rows.length === 1 ? `Row ${first}` : rows.length === 2 ? `Rows ${first}, ${last}` : `Rows ${first}–${last}`;
}

export function download(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ACCENT = "#4f46e5";
