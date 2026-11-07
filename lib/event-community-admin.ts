/**
 * event-community-admin.ts — pure rules for the staff "Community events" screen and the staff event navigation. No imports beyond the date helper;
 * safe in client components. Nothing here talks to a database.
 */
import { describeOccurrence } from "./event-dates-builder";

/* ── navigation + badges ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export const COMMUNITY_EVENTS_HREF = "/admin/events/community";
export const SUBMISSIONS_HREF = "/admin/events/submissions";
export const CHANGES_HREF = "/admin/events/changes";

/** Badge keys for the new staff entries. Existing keys (pendingEvents etc.) are untouched. */
export const SUBMISSIONS_BADGE_KEY = "pendingEventSubmissions";
export const CHANGES_BADGE_KEY = "pendingEventChanges";

export type StaffNavItem = { href: string; label: string; badgeKey?: string; exact?: boolean };
/** The three community entries, in order, as they appear after "Event approvals" in the admin sidebar. */
export const STAFF_EVENT_NAV: StaffNavItem[] = [
  { href: SUBMISSIONS_HREF, label: "Event submissions", badgeKey: SUBMISSIONS_BADGE_KEY },
  { href: CHANGES_HREF, label: "Change requests", badgeKey: CHANGES_BADGE_KEY },
  { href: COMMUNITY_EVENTS_HREF, label: "Community events" },
];

const count = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

/**
 * Badge counts from the (possibly missing) queue counts. A part that is missing (database function not there, read error) simply has no key,
 * so the sidebar shows no badge for it. Never throws, never invents a zero for something unknown.
 */
export function eventQueueBadges(counts: { subs?: { pending?: unknown } | null; changes?: { pending?: unknown } | null } | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  const s = count(counts?.subs?.pending), c = count(counts?.changes?.pending);
  if (s !== null) out[SUBMISSIONS_BADGE_KEY] = s;
  if (c !== null) out[CHANGES_BADGE_KEY] = c;
  return out;
}

/**
 * Is this sidebar entry the current page? A hub "Event approvals" entry (href /admin/events, exact) is current ONLY on /admin/events itself,
 * so it does not light up beside the more specific community entries underneath it. Every other entry behaves as before.
 */
export function adminNavActive(path: string, item: { href: string; exact?: boolean }): boolean {
  if (item.exact) return path === item.href;
  return path === item.href || (item.href !== "/admin" && path.startsWith(item.href));
}

/* ── tabs, search, status chips ────────────────────────────────────────────────────────────────────────────────────────────── */

export type CommunityTab = "all" | "live" | "cancelled" | "archived";
export const COMMUNITY_TABS: { tab: CommunityTab; label: string }[] = [
  { tab: "all", label: "All" }, { tab: "live", label: "Live" }, { tab: "cancelled", label: "Cancelled" }, { tab: "archived", label: "Archived" },
];
export const isCommunityTab = (v: unknown): v is CommunityTab => typeof v === "string" && COMMUNITY_TABS.some((t) => t.tab === v);
export const parseCommunityTab = (v: unknown): CommunityTab => (isCommunityTab(v) ? v : "all");

/** The events.status value a tab filters on (null = no filter). */
export function tabStatus(tab: CommunityTab): "published" | "cancelled" | "archived" | null {
  return tab === "live" ? "published" : tab === "cancelled" ? "cancelled" : tab === "archived" ? "archived" : null;
}

export const COMMUNITY_LIMIT = 100;

/** A title search term made safe for a pattern match: no wildcards or escape characters, trimmed, short. Empty = no search. */
export function cleanSearch(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[%\\,()*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export type ChipTone = "green" | "amber" | "red" | "gray" | "blue";
export function statusChip(status: string): { label: string; tone: ChipTone } {
  switch (status) {
    case "published": return { label: "Live", tone: "green" };
    case "cancelled": return { label: "Cancelled", tone: "red" };
    case "postponed": return { label: "Postponed", tone: "amber" };
    case "archived": return { label: "Archived", tone: "gray" };
    case "draft": return { label: "Draft", tone: "gray" };
    default: return { label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown", tone: "gray" };
  }
}

/* ── shaping rows ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type PerformanceStatus = "scheduled" | "cancelled" | "changed";
export type PerformanceView = { id: string; when: string; startsAt: string; status: PerformanceStatus; statusLabel: string; tone: ChipTone; past: boolean; note: string | null };
export type CommunityEventView = {
  id: string; title: string; status: string; chip: { label: string; tone: ChipTone };
  organiser: string; submitter: string; submissionId: string | null;
  first: string | null; next: string | null; count: number; performances: PerformanceView[];
  /** whole-event actions: cancel only a live event, restore only a cancelled one. */
  canCancelEvent: boolean; canRestoreEvent: boolean;
  publicHref: string;
};

export const NO_SUBMITTER = "A member";
export const NO_ORGANISER = "(no organiser name recorded)";
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const PERF_LABEL: Record<PerformanceStatus, { label: string; tone: ChipTone }> = { scheduled: { label: "On", tone: "green" }, cancelled: { label: "Cancelled", tone: "red" }, changed: { label: "Changed", tone: "amber" } };

export function shapePerformances(raw: unknown, nowMs: number): PerformanceView[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((o): PerformanceView[] => {
    if (!o || typeof o !== "object") return [];
    const r = o as Record<string, unknown>;
    const id = str(r.id), startsAt = str(r.starts_at);
    if (!id || !startsAt || Number.isNaN(Date.parse(startsAt))) return [];
    const status: PerformanceStatus = r.status === "cancelled" ? "cancelled" : r.status === "changed" ? "changed" : "scheduled";
    return [{ id, startsAt, when: describeOccurrence({ starts_at: startsAt, ends_at: str(r.ends_at) }), status, statusLabel: PERF_LABEL[status].label, tone: PERF_LABEL[status].tone, past: Date.parse(startsAt) <= nowMs, note: str(r.note) }];
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** One events row (as the screen's select returns it) plus the submitter's name -> what the screen shows. Returns null for an unusable row. */
export function shapeCommunityEvent(raw: unknown, submitterName: string | null | undefined, nowMs: number): CommunityEventView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;
  const status = str(r.status) ?? "";
  const performances = shapePerformances(r.occurrences, nowMs);
  const next = performances.find((p) => !p.past && p.status !== "cancelled") ?? null;
  return {
    id, title: str(r.title) ?? "(untitled)", status, chip: statusChip(status),
    organiser: str(r.organiser_name)?.trim() || NO_ORGANISER, submitter: submitterName?.trim() || NO_SUBMITTER, submissionId: str(r.submission_id),
    first: performances[0]?.when ?? null, next: next?.when ?? null, count: performances.length, performances,
    canCancelEvent: status === "published", canRestoreEvent: status === "cancelled", publicHref: `/whats-on/${id}`,
  };
}

/** Case-insensitive title filter used by the tests and as a belt-and-braces check over the loaded rows. */
export function titleMatches(title: string, q: string): boolean {
  const s = cleanSearch(q).toLowerCase();
  return !s || title.toLowerCase().includes(s);
}

/* ── actions: arguments and words ──────────────────────────────────────────────────────────────────────────────────────────── */

export type PerformanceAction = "cancel" | "restore";
/** The exact RPC call for one performance. The note is deliberately null: the database stores a performance note publicly, so staff do not write one here. */
export function performanceStatusCall(occurrenceId: string, action: PerformanceAction): { fn: "admin_set_occurrence_status"; args: { p_occurrence: string; p_status: "cancelled" | "scheduled"; p_note: null } } {
  return { fn: "admin_set_occurrence_status", args: { p_occurrence: occurrenceId, p_status: action === "cancel" ? "cancelled" : "scheduled", p_note: null } };
}
/** The exact update for the whole event: status only, and only from the state we showed (so a stale page cannot overwrite a newer change). */
export function eventStatusUpdate(action: PerformanceAction): { set: { status: "cancelled" | "published" }; onlyIfStatus: "published" | "cancelled" } {
  return action === "cancel" ? { set: { status: "cancelled" }, onlyIfStatus: "published" } : { set: { status: "published" }, onlyIfStatus: "cancelled" };
}

export const STAFF_NO_NOTIFY_LINE = "OneShetland does not send cancellation notifications to people, so nobody is told automatically. If people need to hear about it, ask the organiser to tell them.";
export const STAFF_NOTE_LINE = "There is nowhere to keep a private staff note for this yet, so none is asked for.";

export type ConfirmCopy = { title: string; body: string; confirmLabel: string; danger: boolean; success: string };
export function performanceConfirm(action: PerformanceAction, when: string): ConfirmCopy {
  return action === "cancel"
    ? { title: "Cancel this performance?", body: `${when}\n\nIt will show as Cancelled on the public event page straight away. The other dates are not affected.\n\n${STAFF_NO_NOTIFY_LINE}`, confirmLabel: "Yes, cancel this performance", danger: true, success: `Done. ${when} now shows as Cancelled on the public page.` }
    : { title: "Put this performance back on?", body: `${when}\n\nIt will show as On again on the public event page.`, confirmLabel: "Yes, put it back on", danger: false, success: `Done. ${when} is back on.` };
}
export function eventConfirm(action: PerformanceAction, title: string): ConfirmCopy {
  return action === "cancel"
    ? { title: "Cancel the whole event?", body: `${title}\n\nThe public page stays up, clearly marked Cancelled, and the event comes off the lists and calendar. Each date keeps its own status.\n\n${STAFF_NO_NOTIFY_LINE}`, confirmLabel: "Yes, cancel the whole event", danger: true, success: "Done. The event page stays up, marked Cancelled, and the event is off the lists and calendar." }
    : { title: "Put the event back on?", body: `${title}\n\nIt goes back on the lists and calendar and stops being marked Cancelled. Dates that were cancelled one by one stay cancelled.`, confirmLabel: "Yes, put the event back on", danger: false, success: "Done. The event is back on the lists and calendar." };
}

/** Link to a row on the Community events screen (title search plus an anchor, so it is found even among many). */
export function communityEventHref(eventId: string, title: string): string {
  const q = cleanSearch(title);
  return `${COMMUNITY_EVENTS_HREF}${q ? `?q=${encodeURIComponent(q)}` : ""}#ev-${eventId}`;
}
export const submissionHref = (submissionId: string): string => `${SUBMISSIONS_HREF}?status=approved#sub-${submissionId}`;
