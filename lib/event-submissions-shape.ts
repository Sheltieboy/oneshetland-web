/**
 * event-submissions-shape.ts — turns database rows into what the contributor and staff screens show. Pure; no network.
 */
import { describeOccurrence } from "./event-dates-builder";
import type { UtcOccurrence } from "./event-dates-builder";
import { eventOrganiser } from "./event-organiser";
import { eventLabelForCategory } from "./event-categories";
import { STATUS_LABEL, STATUS_EXPLAINER, type SubmissionStatusName } from "./contributor-copy";

export const FIELD_LABEL: Record<string, string> = {
  title: "Event name", description: "Description", venue: "Place", cover_url: "Poster", ticket_url: "Ticket link", price_text: "Price", contact_info: "Contact details", occurrences: "Dates",
};

export type ChangeLine = { field: string; label: string; before: string; after: string; needsLook: boolean; added?: string[]; removed?: string[]; changed?: string[] };

const asOccs = (v: unknown): UtcOccurrence[] =>
  Array.isArray(v) ? v.flatMap((o) => (o && typeof o === "object" && typeof (o as UtcOccurrence).starts_at === "string" ? [o as UtcOccurrence] : [])) : [];
const text = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const sameTime = (a: string, b: string) => Date.parse(a) === Date.parse(b);

/** Fields that always wait for a staff look (the database never applies these straight away). */
export const ALWAYS_LOOKED_AT = new Set(["title", "cover_url", "price_text"]);

/** The change request's payload against what it was -> readable lines, in a fixed order. */
export function describeChange(payload: Record<string, unknown>, before: Record<string, unknown> = {}): ChangeLine[] {
  const out: ChangeLine[] = [];
  for (const field of Object.keys(FIELD_LABEL)) {
    if (!(field in payload)) continue;
    const needsLook = ALWAYS_LOOKED_AT.has(field);
    if (field === "occurrences") {
      const now = asOccs(payload.occurrences), was = asOccs(before.occurrences);
      const added = now.filter((n) => !was.some((w) => sameTime(w.starts_at, n.starts_at)));
      const removed = was.filter((w) => !now.some((n) => sameTime(w.starts_at, n.starts_at)));
      const changed = now.filter((n) => was.some((w) => sameTime(w.starts_at, n.starts_at) && (text(w.ends_at) !== text(n.ends_at) || text(w.note) !== text(n.note))));
      out.push({
        field, label: FIELD_LABEL[field], needsLook, before: was.map(describeOccurrence).join("; ") || "(none listed)", after: now.map(describeOccurrence).join("; "),
        added: added.map(describeOccurrence), removed: removed.map(describeOccurrence), changed: changed.map(describeOccurrence),
      });
    } else {
      out.push({ field, label: FIELD_LABEL[field], needsLook, before: text(before[field]) || "(empty)", after: text(payload[field]) || "(removed)" });
    }
  }
  return out;
}

export type SubmissionView = {
  id: string; title: string; organiser: string; categoryLabel: string; statusLabel: string; statusExplainer: string; tone: "green" | "amber" | "red" | "gray" | "blue";
  credit: string; dates: string[]; canWithdraw: boolean; canManage: boolean; reason: string | null;
};
const TONE: Record<SubmissionStatusName, SubmissionView["tone"]> = { pending: "blue", approved: "green", changes_requested: "amber", rejected: "red", withdrawn: "gray" };

export function viewSubmission(s: { id: string; status: SubmissionStatusName; title: string; organiser_name: string; category: string; occurrences: UtcOccurrence[]; review_reason: string | null; event_id: string | null }): SubmissionView {
  return {
    id: s.id, title: s.title, organiser: s.organiser_name, categoryLabel: eventLabelForCategory(s.category) ?? s.category,
    statusLabel: STATUS_LABEL[s.status], statusExplainer: STATUS_EXPLAINER[s.status], tone: TONE[s.status],
    credit: publicCredit(s.organiser_name), dates: s.occurrences.map(describeOccurrence), canWithdraw: s.status === "pending" || s.status === "changes_requested",
    canManage: s.status === "approved" && !!s.event_id, reason: s.status === "pending" || s.status === "approved" ? null : s.review_reason,
  };
}

/** "3 days ago" style age for the staff queue (clock passed in). */
export function ageLabel(iso: string | null, now: number): string {
  if (!iso) return "";
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "less than an hour ago";
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} days ago`;
}

export type QueueBadge = { pending: number; changes: number; total: number; hasAny: boolean };
/** The small badge on /admin/events. A missing count (function not there) is simply not counted. */
export function queueBadge(subs: { pending: number } | null, changes: { pending: number } | null): QueueBadge {
  const p = subs?.pending ?? 0, c = changes?.pending ?? 0;
  return { pending: p, changes: c, total: p + c, hasAny: p + c > 0 };
}

export type AdminLabelInput = {
  source?: string | null; organiser_name?: string | null; is_platform_event?: boolean | null;
  business?: { name?: string | null } | null; hub?: { name?: string | null } | null;
};
export const CURATED_LABEL = "Curated listing (added by staff)";
export const OFFICIAL_LABEL = "OneShetland-organised";

/**
 * How staff lists label an event: by its TRUE classification (eventOrganiser), never by is_platform_event.
 * Platform ownership only says who owns the row; 120 live platform-owned events are third-party listings curated by staff.
 */
export function adminEventLabel(e: AdminLabelInput | null | undefined): string {
  const o = eventOrganiser(e ?? null);
  if (o?.kind === "community") return `Community event \u00b7 ${o.name}`;
  if (o?.kind === "business") return `Business \u00b7 ${o.name}`;
  if (o?.kind === "hub") return `Hub \u00b7 ${o.name}`;
  if (o?.kind === "official") return OFFICIAL_LABEL;
  if (o?.kind === "named") return `Curated listing \u00b7 ${o.name}`;
  return e?.is_platform_event ? CURATED_LABEL : "No organiser shown";
}

/** The credit the public will see for a community event: exactly the organiser name the contributor typed. */
export const publicCredit = (organiserName: string): string => `Shown to the public as: ${organiserName.trim() || "Community organiser"}`;
