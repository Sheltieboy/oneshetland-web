/**
 * My Saved (website): the pure parts. No database, no network, no React.
 *
 * WHAT IT IS. One private "keep this for later" list. A save is a reference to an item: a type, the item's id, and for a single date of an event
 * run or a single session of a Regular Activity a key. The database owns the rules (see the function contracts: save_item, unsave_item,
 * unsave_many, my_saved_flags, my_saved_list); this module only builds and checks the references the website sends, reads the `save=` return
 * instruction, and turns list rows into sections.
 *
 * KEYS (the same shapes the database enforces):
 *   business   no key
 *   job        no key
 *   event      no key (the whole event or run), or a lower-case uuid (one `event_occurrences` row)
 *   activity   no key (the whole activity), `rule:<uuid>:<YYYY-MM-DD>` (one calculated session, by its rule and the rule's ORIGINAL date,
 *              which does not change when a session moves) or `extra:<uuid>` (an extra session, by its exception row)
 *
 * SIGN-IN THEN SAVE. A signed-out tap goes to /sign-in?next=<this page>?save=<type>:<id>[:<key>]. After sign-in the page asks "Save this?" and only
 * then saves. The value is only ever used to call save_item, and it is validated here first.
 */
import { isLocalPath } from "./redirect";

export type SavedType = "job" | "event" | "activity" | "business";
export const SAVED_TYPES: readonly SavedType[] = ["job", "event", "activity", "business"];

export type SavedRef = { type: SavedType; id: string; key: string | null };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** The query parameter that carries a pending save across sign-in. */
export const SAVE_PARAM = "save";
/** The most ids one my_saved_flags / unsave_many call may carry. */
export const MAX_BATCH = 200;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** A real calendar date in YYYY-MM-DD form (2026-02-30 is refused). */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function isSavedType(v: unknown): v is SavedType {
  return typeof v === "string" && (SAVED_TYPES as readonly string[]).includes(v);
}

/* ── keys ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** One date of an event run: the `event_occurrences` id. */
export const eventDateKey = (occurrenceId: string): string => occurrenceId;
/** One calculated session of a Regular Activity. `date` is the rule's original date (SessionRow.occurrence_date). */
export const activityRuleKey = (ruleId: string, date: string): string => `rule:${ruleId}:${date}`;
/** One extra session of a Regular Activity: the exception row id. */
export const activityExtraKey = (exceptionId: string): string => `extra:${exceptionId}`;

/** The key for a session row from activity_sessions(), or null when the row cannot be saved on its own. */
export function sessionKey(s: { rule_id?: string | null; exception_id?: string | null; occurrence_date?: string | null; is_extra?: boolean | null }): string | null {
  if (s.is_extra && isUuid(s.exception_id)) return activityExtraKey(s.exception_id);
  if (isUuid(s.rule_id) && isIsoDate(s.occurrence_date)) return activityRuleKey(s.rule_id, s.occurrence_date);
  return null;
}

/** Is `key` a well-formed key for `type`? Whole-item saves have no key. */
export function isValidKey(type: SavedType, key: string | null): boolean {
  if (key === null) return true;
  if (type === "business" || type === "job") return false;
  if (type === "event") return isUuid(key);
  const m = /^rule:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (m) return isUuid(m[1]) && isIsoDate(m[2]);
  const x = /^extra:([^:]+)$/.exec(key);
  return !!x && isUuid(x[1]);
}

export function makeRef(type: SavedType, id: string, key: string | null = null): SavedRef | null {
  if (!isSavedType(type) || !isUuid(id) || !isValidKey(type, key)) return null;
  return { type, id, key };
}

/** One string per reference, for sets and maps. */
export const refKey = (r: SavedRef): string => `${r.type}|${r.id}|${r.key ?? ""}`;
export const itemKey = (type: SavedType, id: string): string => `${type}|${id}`;

/** The arguments of save_item / unsave_item. */
export const rpcArgs = (r: SavedRef) => ({ p_type: r.type, p_item: r.id, p_occurrence: r.key });

/* ── the `save=` return instruction ───────────────────────────────────────────────────────────────────────────────────────── */

export function buildSaveIntent(r: SavedRef): string {
  return `${r.type}:${r.id}${r.key ? `:${r.key}` : ""}`;
}

/** Parse and validate a `save=` value. Anything that is not exactly a well-formed reference is null. */
export function parseSaveIntent(value: unknown): SavedRef | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 160) return null;
  const first = value.indexOf(":");
  if (first < 1) return null;
  const type = value.slice(0, first);
  const rest = value.slice(first + 1);
  const second = rest.indexOf(":");
  const id = second === -1 ? rest : rest.slice(0, second);
  const key = second === -1 ? null : rest.slice(second + 1);
  if (key === "") return null;
  return makeRef(type as SavedType, id, key);
}

/**
 * The page address with the save instruction added (replacing any earlier one). `pathAndQuery` is `pathname + search` of the current page.
 * Returns null if the result would not be a safe local path (the caller then signs in without a return instruction).
 */
export function withSaveIntent(pathAndQuery: string, r: SavedRef): string | null {
  const hashAt = pathAndQuery.indexOf("#");
  const base = stripSaveParam(hashAt === -1 ? pathAndQuery : pathAndQuery.slice(0, hashAt));
  const out = `${base}${base.includes("?") ? "&" : "?"}${SAVE_PARAM}=${buildSaveIntent(r)}`;
  return isLocalPath(out) ? out : null;
}

/** The sign-in address for a signed-out tap on a bookmark. Uses the existing /sign-in?next= convention; lib/redirect.ts decides what is allowed. */
export function signInHrefForSave(pathAndQuery: string, r: SavedRef): string {
  const next = withSaveIntent(pathAndQuery, r);
  return next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";
}

/** The same address without any `save=` parameter (other parameters and the hash are kept). */
export function stripSaveParam(href: string): string {
  const hashAt = href.indexOf("#");
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const noHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const q = noHash.indexOf("?");
  if (q === -1) return href;
  const path = noHash.slice(0, q);
  const kept = noHash.slice(q + 1).split("&").filter((p) => p !== "" && p.split("=")[0] !== SAVE_PARAM);
  return `${path}${kept.length ? `?${kept.join("&")}` : ""}${hash}`;
}

/* ── what the database said ───────────────────────────────────────────────────────────────────────────────────────────────── */

export type SaveOutcome = "ok" | "signin" | "limit" | "off" | "error";

/**
 * Read the reply of save_item / unsave_item. SQLSTATE 42501 (or SIGN_IN_REQUIRED) means "sign in"; a business outcome comes back as
 * `{ ok:false, error }` and is never an exception; everything else is a plain failure. Anything unexpected is "error", never "ok".
 */
export function saveOutcome(reply: { data?: unknown; error?: { code?: string | null; message?: string | null } | null }): SaveOutcome {
  const err = reply.error;
  if (err) return err.code === "42501" || /SIGN_IN_REQUIRED/.test(err.message ?? "") ? "signin" : "error";
  const d = reply.data as { ok?: unknown; error?: unknown } | null | undefined;
  if (d && d.ok === true) return "ok";
  if (d && d.error === "LIMIT_REACHED") return "limit";
  if (d && d.error === "NOT_ENABLED") return "off";
  return "error";
}

/* ── flags (which of these ids has the member saved?) ─────────────────────────────────────────────────────────────────────── */

/** Turn queued ids into calls of at most `max` ids each, one type per call. */
export function planFlagBatches(pending: ReadonlyMap<SavedType, ReadonlySet<string>>, max = MAX_BATCH): { type: SavedType; ids: string[] }[] {
  const out: { type: SavedType; ids: string[] }[] = [];
  for (const [type, set] of pending) {
    const ids = [...set].filter(isUuid);
    for (let i = 0; i < ids.length; i += max) out.push({ type, ids: ids.slice(i, i + max) });
  }
  return out;
}

/** The references named by a my_saved_flags answer (rows with an unexpected shape are ignored). */
export function refsFromFlags(type: SavedType, rows: unknown): SavedRef[] {
  if (!Array.isArray(rows)) return [];
  const out: SavedRef[] = [];
  for (const r of rows) {
    const id = (r as { item_id?: unknown })?.item_id;
    const key = (r as { occurrence_key?: unknown })?.occurrence_key;
    const ref = makeRef(type, typeof id === "string" ? id : "", typeof key === "string" && key !== "" ? key : null);
    if (ref) out.push(ref);
  }
  return out;
}

/** Split a list into chunks (unsave_many takes at most 200). */
export function chunk<T>(items: readonly T[], size = MAX_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/* ── the list ──────────────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type SavedState =
  | "upcoming" | "ok" | "changed" | "cancelled" | "break" | "past" | "date_gone" | "no_upcoming" | "closed" | "filled"
  | "snapshot_expired" | "snapshot_postponed" | "snapshot_ended" | "unavailable";

export type SavedItem = {
  key?: string;
  item_type: SavedType;
  item_id: string;
  occurrence_key: string | null;
  saved_at: string;
  state: SavedState;
  bucket: number;
  sort_at: string | null;
  title: string | null;
  place: string | null;
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
  from_snapshot: boolean;
  slug: string | null;
  parent_readable: boolean;
  shadowed?: boolean;
  moved?: boolean;
  original_date?: string | null;
};
export type SavedListResult = { items: SavedItem[]; total: number; more: boolean };

export const itemRef = (i: SavedItem): SavedRef => ({ type: i.item_type, id: i.item_id, key: i.occurrence_key ?? null });

/** Read the answer of my_saved_list defensively: wrong shapes become an empty list, never an exception. */
export function readSavedList(data: unknown): SavedListResult {
  const d = (data ?? {}) as { items?: unknown; total?: unknown; more?: unknown };
  const items = Array.isArray(d.items)
    ? (d.items as SavedItem[]).filter((i) => i && isSavedType(i.item_type) && isUuid(i.item_id) && typeof i.state === "string")
    : [];
  return { items, total: typeof d.total === "number" ? d.total : items.length, more: d.more === true };
}

export type SavedFilter = "all" | "events" | "jobs" | "businesses";
export const SAVED_FILTERS: readonly SavedFilter[] = ["all", "events", "jobs", "businesses"];

export function matchesFilter(i: SavedItem, f: SavedFilter): boolean {
  if (f === "all") return true;
  if (f === "events") return i.item_type === "event" || i.item_type === "activity";
  if (f === "jobs") return i.item_type === "job";
  return i.item_type === "business";
}

/** Bucket numbers, as the database orders them. */
export const BUCKET = { attention: 0, dated: 1, undated: 2, past: 3 } as const;

export type SavedSections = { comingUp: SavedItem[]; saved: SavedItem[]; past: SavedItem[] };

/**
 * Hide the shadowed rows (a date that is also saved as a whole), apply the filter, and split by the bucket the database computed:
 * 0 and 1 are "Coming up", 2 is "Saved", 3 is "Past and unavailable". The database order is kept.
 */
export function sectionize(items: readonly SavedItem[], filter: SavedFilter = "all"): SavedSections {
  const out: SavedSections = { comingUp: [], saved: [], past: [] };
  for (const i of items) {
    if (i.shadowed) continue;
    if (!matchesFilter(i, filter)) continue;
    if (i.bucket <= BUCKET.dated) out.comingUp.push(i);
    else if (i.bucket === BUCKET.undated) out.saved.push(i);
    else out.past.push(i);
  }
  return out;
}

/** Undo is offered only where the old row can really come back: not for a snapshot row and not for "No longer available". */
export function canUndoRemove(i: Pick<SavedItem, "from_snapshot" | "state">): boolean {
  return !i.from_snapshot && i.state !== "unavailable" && !i.state.startsWith("snapshot_");
}

/** Where a row links to. A snapshot or unavailable row never links to current details; a gone date links to its parent if that is readable. */
export function itemHref(i: SavedItem): string | null {
  if (i.from_snapshot || i.state === "unavailable" || i.state.startsWith("snapshot_")) return null;
  if (i.state === "date_gone" && !i.parent_readable) return null;
  switch (i.item_type) {
    case "job": return `/jobs/${i.item_id}`;
    case "business": return `/directory/${i.item_id}`;
    case "event": return i.occurrence_key && i.state !== "date_gone" ? `/whats-on/${i.item_id}#performances` : `/whats-on/${i.item_id}`;
    case "activity": {
      if (!i.slug || !/^[a-z0-9][a-z0-9-]*$/i.test(i.slug)) return null;
      const m = i.occurrence_key ? /^rule:[^:]+:(\d{4}-\d{2}-\d{2})$/.exec(i.occurrence_key) : null;
      return `/whats-on/regular/${i.slug}${m && i.state !== "date_gone" ? `?session=${m[1]}` : ""}`;
    }
  }
}

/** The `?session=` value of the activity page: a valid date, or null. */
export function parseSessionParam(v: string | string[] | undefined): string | null {
  const one = Array.isArray(v) ? v[0] : v;
  return isIsoDate(one) ? one : null;
}

/* ── names for assistive technology ────────────────────────────────────────────────────────────────────────────────────────── */

export const TYPE_NOUN: Record<SavedType, string> = { job: "job", event: "event", activity: "activity", business: "business" };

/** The accessible name of a bookmark. It does not change with the saved state (aria-pressed says that). */
export function bookmarkName(title: string, dateLabel?: string | null): string {
  const t = title.trim();
  return dateLabel ? `Save ${t}, ${dateLabel}` : `Save ${t}`;
}
