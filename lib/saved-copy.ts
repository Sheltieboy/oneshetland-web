/**
 * My Saved: the words. The status labels are defined once (design section 5) and tests/saved-copy.test.mjs hard-codes the same table, so a change
 * here that is not a decision fails a test. Plain English; no jargon.
 */
import type { SavedItem, SavedState, SavedType } from "./saved";

export const SAVED_PAGE_TITLE = "My Saved";
export const SAVED_MENU_LABEL = "My Saved";

/** The label shown on a row for each state. null = no label. */
export const STATE_LABEL: Record<SavedState, string | null> = {
  upcoming: null,
  ok: null,
  changed: "Changed",              // a moved session reads "Moved to {time}" (see changedLabel)
  cancelled: "Cancelled",
  postponed: "Postponed. A new date will follow.",   // a postponed event the member can still read (organiser, hub admin, ticket holder)
  break: "Break: no session",
  past: "Past",
  date_gone: "This date is no longer scheduled",
  no_upcoming: "No upcoming sessions in the next 93 days",
  closed: "Closed",
  filled: "Filled",
  snapshot_expired: "Expired",
  snapshot_postponed: "Postponed. A new date will follow.",
  snapshot_ended: "Ended",
  unavailable: "No longer available",
};

export const SNAPSHOT_NOTE = "As it was when you saved it";

/** "Saved 3 Nov" (Europe/London). */
export function savedOn(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Saved";
  return `Saved ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}`;
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/London" });
const dayShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });

/** "Moved to Tue 12 Nov, 19:00" when the session is on a different day, "Changed: 19:00" for a changed time, else "Changed". */
export function changedLabel(i: Pick<SavedItem, "moved" | "starts_at">): string {
  const ok = !!i.starts_at && Number.isFinite(new Date(i.starts_at).getTime());
  if (!ok) return STATE_LABEL.changed as string;
  return i.moved ? `Moved to ${dayShort(i.starts_at as string)}, ${clock(i.starts_at as string)}` : `Changed: ${clock(i.starts_at as string)}`;
}

/** The label for a row, or null for none. */
export function labelFor(i: Pick<SavedItem, "state" | "moved" | "starts_at">): string | null {
  return i.state === "changed" ? changedLabel(i) : STATE_LABEL[i.state] ?? null;
}

/** When a row from the database has a state this build does not know, fall back to the safest wording. */
export function knownState(s: string): SavedState {
  return Object.prototype.hasOwnProperty.call(STATE_LABEL, s) ? (s as SavedState) : "unavailable";
}

/** The date line of a row: "Tue 12 Nov, 19:00" (Europe/London). */
export function whenLine(i: Pick<SavedItem, "starts_at"> & Partial<Pick<SavedItem, "ends_at" | "item_type">>): string | null {
  // A job has no start: its closing time arrives in ends_at ("Closes Fri 20 Nov").
  if (i.item_type === "job") {
    if (!i.ends_at || !Number.isFinite(new Date(i.ends_at).getTime())) return null;
    return `Closes ${dayShort(i.ends_at)}`;
  }
  if (!i.starts_at || !Number.isFinite(new Date(i.starts_at).getTime())) return null;
  return `${dayShort(i.starts_at)}, ${clock(i.starts_at)}`;
}

export const TYPE_LABEL: Record<SavedType, string> = { event: "Event", activity: "Regular activity", job: "Job", business: "Business" };

export const FILTER_LABEL = { all: "All", events: "Events", jobs: "Jobs", businesses: "Businesses" } as const;

/** The one line shown when a business is saved. */
export const BUSINESS_SAVE_LINE = "Saved privately. You won't get updates. Follow for updates.";

export const MSG = {
  saved: "Saved",
  removed: "Removed",
  undo: "Undo",
  failed: "Couldn't save that. Try again.",
  failedRemove: "Couldn't remove that. Try again.",
  limit: "You have saved 500 things. Remove some to save more.",
  notEnabled: "Saving isn't available right now.",
  loadFailed: "Couldn't load your saved items. Try again in a moment.",
} as const;

export const CONFIRM_BAR = {
  question: (noun: string) => `Save this ${noun} to My Saved?`,
  save: "Save",
  skip: "Not now",
} as const;

export const CLEAR_PAST = {
  button: "Clear past",
  title: "Clear past items?",
  body: (n: number) => `This removes ${n} past or unavailable ${n === 1 ? "item" : "items"} from My Saved. This can't be undone.`,
  confirm: "Clear past",
  done: (n: number) => `Cleared ${n} ${n === 1 ? "item" : "items"}`,
} as const;

export const EMPTY = {
  title: "Nothing saved yet",
  body: "Tap the bookmark on an event, job or business to keep it here for later. Only you can see this list.",
  filtered: "Nothing saved in this group.",
} as const;

export const SAVED_PRIVATE_NOTE = "Only you can see what you save here.";
export const MORE_NOTE = "Showing your first 1000 saves.";
