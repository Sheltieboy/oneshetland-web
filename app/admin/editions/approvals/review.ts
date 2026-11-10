/** Pure rules for the Edition approvals queue and review screen (no I/O, unit-tested). The database stays the authority for every rule here. */

export const QUEUE_TABS = [
  { key: "waiting", label: "Waiting", empty: "Nothing is waiting for review. Well done." },
  { key: "changes", label: "Changes requested", empty: "No Edition is waiting for its organiser to make changes." },
  { key: "decided", label: "Decided (last 30 days)", empty: "No decisions in the last 30 days." },
  { key: "edited", label: "Recently edited", empty: "No approved Edition has been edited since approval in the last 30 days." },
] as const;
export type QueueTab = (typeof QUEUE_TABS)[number]["key"];
export const parseQueueTab = (v: string | string[] | undefined): QueueTab => {
  const s = Array.isArray(v) ? v[0] : v;
  return QUEUE_TABS.find((t) => t.key === s)?.key ?? "waiting";
};

export type Decision = "approve" | "changes" | "reject";
export const DECISIONS: Decision[] = ["approve", "changes", "reject"];
export const DECISION_DONE: Record<Decision, string> = { approve: "approved", changes: "sent back for changes", reject: "rejected" };

/** Why a decision cannot be recorded yet, in words, or null. Approving needs a note only for the first Edition of an organiser whose name is on the reserved list. */
export function decisionNoteProblem(decision: string, note: string | null | undefined, opts: { firstReserved?: boolean } = {}): string | null {
  const n = String(note ?? "").trim();
  if (decision === "approve") return opts.firstReserved && n.length < 10 ? "This name matches a reserved list. Write a note of at least 10 characters saying how you checked." : null;
  if (decision === "changes") return n.length < 5 ? "Tell the organiser what to fix (at least 5 characters)." : null;
  if (decision === "reject") return n.length < 5 ? "Tell the organiser why you are rejecting it (at least 5 characters)." : null;
  return "Choose a decision.";
}

/** "Waiting 3 days" / "Waiting since today". */
export function waitingText(days: number | null | undefined): string {
  const d = Math.max(0, Math.floor(Number(days) || 0));
  return d === 0 ? "Waiting since today" : d === 1 ? "Waiting 1 day" : `Waiting ${d} days`;
}

export type Check = { key: string; label: string; required: boolean; ok: boolean; hint?: string | null };
/** Keys the database adds for staff only (not shown to the organiser). */
export const STAFF_CHECK_KEYS = ["reserved", "history", "first"] as const;
export function checkGroups(checks: Check[] | null | undefined): { required: Check[]; recommended: Check[]; staff: Check[] } {
  const list = Array.isArray(checks) ? checks : [];
  const isStaff = (c: Check) => (STAFF_CHECK_KEYS as readonly string[]).includes(c.key);
  return { required: list.filter((c) => !isStaff(c) && c.required), recommended: list.filter((c) => !isStaff(c) && !c.required), staff: list.filter(isStaff) };
}
/** The hint is only useful when the check did not pass (the database words it as the problem). */
export const checkHint = (c: Check): string => (!c.ok && c.hint ? c.hint : "");

export const HISTORY_LABEL: Record<string, string> = {
  submitted: "Submitted for review", withdrawn: "Withdrawn by the organiser", approved: "Approved", changes_requested: "Changes requested", rejected: "Rejected",
  material_change: "Changed after approval, sent back for review", identity_verified: "Organiser identity checked",
};
export const historyLabel = (action: string): string => HISTORY_LABEL[action] ?? action.replace(/_/g, " ");

const FIELD_LABEL: Record<string, string> = { title: "Title", kind: "Kind", starts_on: "Start date", ends_on: "End date" };
export type Change = { from: unknown; to: unknown };
/** Material-change before/after values as readable lines. Dates are shown as written; nothing is invented. */
export function changeLines(changes: Record<string, Change> | null | undefined): { field: string; from: string; to: string }[] {
  if (!changes || typeof changes !== "object") return [];
  return Object.entries(changes).filter(([, v]) => v && typeof v === "object").map(([k, v]) => ({ field: FIELD_LABEL[k] ?? k.replace(/_/g, " "), from: String(v.from ?? "(none)"), to: String(v.to ?? "(none)") }));
}

/** How long a Hub or Business has existed, in words. */
export function ageText(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const days = Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return "";
  if (days < 1) return "created today";
  if (days < 60) return `${days} day${days === 1 ? "" : "s"} old`;
  const months = Math.floor(days / 30.4);
  if (months < 24) return `${months} months old`;
  return `${Math.floor(months / 12)} years old`;
}

/** The public address staff open to preview, as visitors will see it. */
export const previewPath = (slug: string) => `/editions/${encodeURIComponent(slug)}`;
