/**
 * header.ts — the site header's Fetch chip (Fetch v2, Step 14A; web only, pure). Summarises the member's live Fetches from
 * fetch_v2_my_requests() in the shared vocabulary (requesterStatus), so the header says what the Fetch page says. Never an address.
 */
import type { RequestSummary } from "@/lib/fetch-api";
import { requesterStatus, type Tone } from "./present.ts";

const LIVE = ["pending", "matched", "collected", "undeliverable"];
const PROGRESS: Record<string, number> = { undeliverable: 0, collected: 1, matched: 2, pending: 3 };

export type HeaderSummary = { label: string; tone: Tone; count: number; href: string } | null;

/** The Fetch that most needs the member's eye: anything needing attention first, then the most progressed. */
export function headerSummary(rows: RequestSummary[]): HeaderSummary {
  const live = rows.filter((r) => LIVE.includes(r.status));
  if (!live.length) return null;
  const withStatus = live.map((r) => ({ r, st: requesterStatus({ status: r.status, payment_status: r.payment_status, cancel_requested_at: r.cancel_requested ? "asked" : null }) }));
  withStatus.sort((a, b) => Number(b.st.tone === "attention") - Number(a.st.tone === "attention") || (PROGRESS[a.r.status] ?? 9) - (PROGRESS[b.r.status] ?? 9));
  const top = withStatus[0];
  return { label: top.st.label, tone: top.st.tone, count: live.length, href: live.length === 1 ? `/fetch/requests/${top.r.id}` : "/fetch" };
}
