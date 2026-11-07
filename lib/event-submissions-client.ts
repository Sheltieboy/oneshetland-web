/**
 * event-submissions-client.ts — the ONE door to the community-event database functions (migrations 20261230*).
 *
 * Works with any Supabase client (browser or server): every function takes the client as its first argument and only uses `.rpc()`, `.from()`
 * and `.storage`, so tests drive it with a fake. Nothing here reads the environment or the clock.
 *
 * Every call returns a Result and never throws:
 *   { ok: true, data } | { ok: false, error: { kind, message, field? } }
 * `message` is always safe to show to a person. Unknown or technical database messages are replaced by a calm sentence.
 *
 * THE FUNCTIONS MAY NOT EXIST YET (the migrations are not applied in production). A missing function or table maps to kind "unavailable",
 * which screens show as "not available yet", never as a crash.
 */
import { posterFileName, posterProblem } from "./event-submission-validate";
import type { UtcOccurrence } from "./event-dates-builder";

export type ErrLike = { message?: string; code?: string; hint?: string | null; details?: string | null; status?: number } | null;
export type Reply = { data: unknown; error: ErrLike; status?: number };
export type Sb = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<Reply>;
  from: (table: string) => any;           // eslint-disable-line @typescript-eslint/no-explicit-any
  storage?: any;                          // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type ErrorKind =
  | "unavailable"   // the function / table does not exist (yet)
  | "closed"        // the master switch is off
  | "signin"        // not signed in
  | "forbidden"     // signed in, not allowed
  | "validation"    // a rule on the details; `field` says which
  | "limit"         // too many pending / too many today
  | "decided"       // already decided, cannot be withdrawn / reviewed again
  | "restore_window"// too late to undo
  | "past"          // the date has gone
  | "has_ticket_buyers" // cancelling a community event that people have bought OneShetland tickets for: staff must help (refunds, telling buyers)
  | "notfound"
  | "network"
  | "unknown";

export type ClientError = { kind: ErrorKind; message: string; field?: string };
export type Result<T> = { ok: true; data: T } | { ok: false; error: ClientError };

export const MSG = {
  unavailable: "This isn't available yet. Please check back soon.",
  closed: "We aren't taking event submissions just yet. Thank you for your patience.",
  signin: "Please sign in to continue.",
  forbidden: "You can't do that.",
  network: "We couldn't reach OneShetland. Please check your connection and try again. Nothing has been changed.",
  unknown: "Something went wrong on our side. Nothing has been changed. Please try again in a moment.",
  notfound: "We couldn't find that.",
  /** The same words as the database's own message (hint has_ticket_buyers), so either source reads the same. */
  hasTicketBuyers: "People have bought tickets for this event through OneShetland, so we need to help you tell them and arrange refunds. Please contact OneShetland.",
} as const;

const LIMIT_HINTS = new Set(["pending_limit", "daily_limit", "global_limit"]);

/** A missing database function or table (PostgREST: PGRST202 / PGRST205, HTTP 404; Postgres: 42883 / 42P01). */
export function isMissingObject(err: ErrLike, status?: number): boolean {
  if (!err && status !== 404) return false;
  const code = err?.code ?? "";
  const msg = `${err?.message ?? ""} ${err?.details ?? ""}`.toLowerCase();
  return status === 404 || err?.status === 404 || code === "PGRST202" || code === "PGRST205" || code === "42883" || code === "42P01"
    || /could not find the (function|table)|does not exist|schema cache/.test(msg);
}

/** Database error -> something safe to show. Only plain-English rule messages (errcode P0001) are passed through. */
export function mapError(err: ErrLike, status?: number): ClientError {
  if (isMissingObject(err, status)) return { kind: "unavailable", message: MSG.unavailable };
  const code = err?.code ?? "";
  const hint = (err?.hint ?? "") || undefined;
  const message = (err?.message ?? "").trim();
  if (hint === "closed") return { kind: "closed", message: MSG.closed };
  if (code === "42501" || code === "PGRST301" || status === 401 || status === 403) {
    if (/sign in/i.test(message) || code === "PGRST301" || status === 401) return { kind: "signin", message: MSG.signin };
    return { kind: "forbidden", message: /^[A-Z][^<>{}]{3,160}$/.test(message) ? message : MSG.forbidden };
  }
  if (code === "P0002") return { kind: "notfound", message: MSG.notfound };
  if (hint === "has_ticket_buyers") return { kind: "has_ticket_buyers", message: MSG.hasTicketBuyers, field: hint };
  if (code === "P0001" && message) {
    const kind: ErrorKind = hint && LIMIT_HINTS.has(hint) ? "limit" : hint === "not_pending" || hint === "decided" ? "decided"
      : hint === "restore_window" ? "restore_window" : hint === "past" ? "past" : "validation";
    return { kind, message, ...(hint ? { field: hint } : {}) };
  }
  if (!err && !status) return { kind: "unknown", message: MSG.unknown };
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message) || status === 0) return { kind: "network", message: MSG.network };
  return { kind: "unknown", message: MSG.unknown };
}

async function call<T>(sb: Sb, fn: string, args: Record<string, unknown> | undefined, parse: (data: unknown) => T | null): Promise<Result<T>> {
  let reply: Reply;
  try { reply = await sb.rpc(fn, args); }
  catch (e) { return { ok: false, error: mapError({ message: e instanceof Error ? e.message : String(e) }) }; }
  if (reply.error || (reply.status && reply.status >= 400)) return { ok: false, error: mapError(reply.error, reply.status) };
  const parsed = parse(reply.data);
  if (parsed === null) return { ok: false, error: { kind: "unknown", message: MSG.unknown } };
  return { ok: true, data: parsed };
}

async function read<T>(build: () => PromiseLike<Reply>, parse: (data: unknown) => T): Promise<Result<T>> {
  let reply: Reply;
  try { reply = await build(); }
  catch (e) { return { ok: false, error: mapError({ message: e instanceof Error ? e.message : String(e) }) }; }
  if (reply.error || (reply.status && reply.status >= 400)) return { ok: false, error: mapError(reply.error, reply.status) };
  return { ok: true, data: parse(reply.data) };
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => !!obj(x)) as Record<string, unknown>[] : []);
const occList = (v: unknown): UtcOccurrence[] =>
  rows(v).flatMap((o) => (typeof o.starts_at === "string" ? [{ starts_at: o.starts_at, ...(typeof o.ends_at === "string" ? { ends_at: o.ends_at } : {}), ...(typeof o.note === "string" ? { note: o.note } : {}) }] : []));

/* ── master switch ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** Are member submissions open? "unavailable" when the function does not exist yet. Staff may still submit while it is closed (the database allows it). */
export function submissionsOpen(sb: Sb): Promise<Result<boolean>> {
  return call(sb, "event_submissions_open", undefined, (d) => (typeof d === "boolean" ? d : null));
}

/**
 * Is the signed-in account on the tester allowlist (switch value 'testers')? Anything unexpected is "no": the function missing (migration not applied),
 * a network or permission error, a signed-out caller. It only ever WIDENS access for an allowlisted account, never for anyone else.
 */
export async function isSubmissionTester(sb: Sb): Promise<boolean> {
  const r = await call(sb, "event_submissions_tester", undefined, (d) => (typeof d === "boolean" ? d : null));
  return r.ok && r.data === true;
}

/* ── submissions ───────────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type SubmissionStatus = "pending" | "approved" | "changes_requested" | "rejected" | "withdrawn";
const STATUSES: SubmissionStatus[] = ["pending", "approved", "changes_requested", "rejected", "withdrawn"];
export const isSubmissionStatus = (s: unknown): s is SubmissionStatus => typeof s === "string" && (STATUSES as string[]).includes(s);

/** Send a checked payload. A retry with the same request_id returns the first submission's id. */
export function submitEvent(sb: Sb, payload: Record<string, unknown>): Promise<Result<{ id: string }>> {
  return call(sb, "submit_event_submission", { payload }, (d) => (typeof d === "string" && d ? { id: d } : null));
}

export function withdrawSubmission(sb: Sb, id: string): Promise<Result<true>> {
  return call(sb, "withdraw_event_submission", { p_id: id }, (d) => (d === "withdrawn" ? (true as const) : null));
}

export type SubmissionRow = {
  id: string; submitter_id: string; status: SubmissionStatus; organiser_name: string; title: string; description: string; category: string;
  venue: string; locality: string | null; cover_url: string | null; contact_info: string | null; ticket_url: string | null; price_text: string | null;
  occurrences: UtcOccurrence[]; review_reason: string | null; reviewed_at: string | null; event_id: string | null; created_at: string;
};
export const SUBMISSION_COLUMNS = "id, submitter_id, status, organiser_name, title, description, category, venue, locality, cover_url, contact_info, ticket_url, price_text, occurrences, review_reason, reviewed_at, event_id, created_at";

export function shapeSubmission(r: Record<string, unknown>): SubmissionRow | null {
  const id = str(r.id);
  if (!id || !isSubmissionStatus(r.status)) return null;
  return {
    id, submitter_id: str(r.submitter_id) ?? "", status: r.status, organiser_name: str(r.organiser_name) ?? "", title: str(r.title) ?? "",
    description: str(r.description) ?? "", category: str(r.category) ?? "", venue: str(r.venue) ?? "", locality: str(r.locality), cover_url: str(r.cover_url),
    contact_info: str(r.contact_info), ticket_url: str(r.ticket_url), price_text: str(r.price_text), occurrences: occList(r.occurrences),
    review_reason: str(r.review_reason), reviewed_at: str(r.reviewed_at), event_id: str(r.event_id), created_at: str(r.created_at) ?? "",
  };
}
const shapeSubmissions = (d: unknown): SubmissionRow[] => rows(d).map(shapeSubmission).filter((x): x is SubmissionRow => !!x);

/** The signed-in person's own submissions (row security shows them nobody else's). */
export function listMySubmissions(sb: Sb, userId: string): Promise<Result<SubmissionRow[]>> {
  return read(() => sb.from("event_submissions").select(SUBMISSION_COLUMNS).eq("submitter_id", userId).order("created_at", { ascending: false }).limit(100), shapeSubmissions);
}

/** A person's submission that became this live event (null if it is not theirs). */
export function getMySubmissionForEvent(sb: Sb, userId: string, eventId: string): Promise<Result<SubmissionRow | null>> {
  return read(() => sb.from("event_submissions").select(SUBMISSION_COLUMNS).eq("submitter_id", userId).eq("event_id", eventId).eq("status", "approved").limit(1),
    (d) => shapeSubmissions(d)[0] ?? null);
}

/* ── staff: submissions ────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type SubmissionCounts = { pending: number; changes_requested: number; oldest_pending_at: string | null };
export function adminSubmissionCounts(sb: Sb): Promise<Result<SubmissionCounts>> {
  return call(sb, "admin_event_submission_counts", undefined, (d) => {
    const r = obj(Array.isArray(d) ? d[0] : d);
    return r ? { pending: num(r.pending), changes_requested: num(r.changes_requested), oldest_pending_at: str(r.oldest_pending_at) } : { pending: 0, changes_requested: 0, oldest_pending_at: null };
  });
}

export type SubmissionSummary = { id: string; submitter_id: string; status: string; organiser_name: string; title: string; category: string; occurrence_count: number; first_starts_at: string | null; created_at: string };
export function adminListSubmissions(sb: Sb, status: SubmissionStatus = "pending", limit = 50): Promise<Result<SubmissionSummary[]>> {
  return call(sb, "admin_list_event_submissions", { p_status: status, p_limit: limit }, (d) => {
    if (d !== null && d !== undefined && !Array.isArray(d)) return null;
    return rows(d).flatMap((r) => (str(r.id) ? [{ id: str(r.id)!, submitter_id: str(r.submitter_id) ?? "", status: str(r.status) ?? "", organiser_name: str(r.organiser_name) ?? "", title: str(r.title) ?? "", category: str(r.category) ?? "", occurrence_count: num(r.occurrence_count), first_starts_at: str(r.first_starts_at), created_at: str(r.created_at) ?? "" }] : []));
  });
}

/** Full detail of several submissions at once (staff can read them all). */
export function adminSubmissionDetails(sb: Sb, ids: readonly string[]): Promise<Result<SubmissionRow[]>> {
  if (ids.length === 0) return Promise.resolve({ ok: true, data: [] });
  return read(() => sb.from("event_submissions").select(SUBMISSION_COLUMNS).in("id", [...ids]), shapeSubmissions);
}

export type ReviewDecision = "approve" | "reject" | "changes_requested";
export function adminReviewSubmission(sb: Sb, id: string, decision: ReviewDecision, reason?: string): Promise<Result<{ status: string; event_id: string | null; duplicate: boolean }>> {
  const r = (reason ?? "").trim();
  if (decision !== "approve" && !r) return Promise.resolve({ ok: false, error: { kind: "validation", message: "Please write a short reason for the member.", field: "reason" } });
  if (r.length > 500) return Promise.resolve({ ok: false, error: { kind: "validation", message: "Please keep the reason to 500 characters or fewer.", field: "reason" } });
  return call(sb, "admin_review_event_submission", { p_id: id, p_decision: decision, p_reason: r || null }, (d) => {
    const o = obj(d);
    return o && str(o.status) ? { status: str(o.status)!, event_id: str(o.event_id), duplicate: o.duplicate === true } : null;
  });
}

/**
 * After a staff review SUCCEEDED: ask the server to email the contributor about that decision. The function re-verifies everything (staff,
 * the reviewer, a recent decision, one email per decision, deleted accounts, opt-outs), so this only reports what actually happened.
 * Never throws and never affects the review itself: a failure just means no email was confirmed.
 */
export async function notifyEventDecision(sb: Sb, submissionId: string): Promise<{ emailed: boolean }> {
  try {
    const fns = (sb as unknown as { functions?: { invoke: (n: string, o: { body: unknown }) => Promise<{ data?: unknown; error?: unknown }> } }).functions;
    if (!fns) return { emailed: false };
    const { data, error } = await fns.invoke("notify-event-submission", { body: { submission_id: submissionId } });
    return { emailed: !error && (data as { emailed?: number } | null)?.emailed === 1 };
  } catch { return { emailed: false }; }
}

/* ── contributor: self-service ─────────────────────────────────────────────────────────────────────────────────────────────── */

export type OccurrenceRow = { id: string; event_id: string; starts_at: string; ends_at: string | null; status: "scheduled" | "cancelled" | "changed"; note: string | null };
export type EventRow = { id: string; title: string; description: string | null; venue: string | null; locality: string | null; status: string; starts_at: string | null; ends_at: string | null; ticket_url: string | null; contact_info: string | null; price_text: string | null; cover_url: string | null; organiser_name: string | null; is_dated_run: boolean };
export type LogRow = { id: number; occurrence_id: string | null; actor_kind: string; action: string; detail: Record<string, unknown>; created_at: string };
export type ChangeRow = { id: string; status: string; kind: string; payload: Record<string, unknown>; before: Record<string, unknown>; review_reason: string | null; created_at: string };

const EVENT_COLUMNS = "id, title, description, venue, locality, status, starts_at, ends_at, ticket_url, contact_info, price_text, cover_url, organiser_name, is_dated_run";

/** Is the signed-in person a trusted organiser? Missing function or any error => the caller treats it as "unknown" (null) and keeps the cautious wording. */
export async function myOrganiserTrusted(sb: Sb): Promise<boolean | null> {
  const r = await call(sb, "my_event_organiser_trusted", undefined, (d) => (typeof d === "boolean" ? d : null));
  return r.ok ? r.data : null;
}

export type ContributorView = {
  submission: SubmissionRow;
  /** null when the database does not show the event to its contributor (it is hidden, for example once cancelled). */
  event: EventRow | null;
  occurrences: OccurrenceRow[];
  log: LogRow[] | null;          // null = history not available
  changes: ChangeRow[] | null;   // null = not available
  /** true / false from the database, null = unknown (function missing): say nothing in advance. */
  trusted: boolean | null;
};

/** Everything the contributor page needs. Each part degrades on its own: a missing history table hides only the history. */
export async function loadContributorView(sb: Sb, userId: string, eventId: string): Promise<Result<ContributorView | null>> {
  const sub = await getMySubmissionForEvent(sb, userId, eventId);
  if (!sub.ok) return sub;
  if (!sub.data) return { ok: true, data: null };
  const [ev, occ, log, ch, trusted] = await Promise.all([
    read(() => sb.from("events").select(EVENT_COLUMNS).eq("id", eventId).limit(1), (d) => {
      const r = rows(d)[0];
      return r && str(r.id) ? ({ id: str(r.id)!, title: str(r.title) ?? "", description: str(r.description), venue: str(r.venue), locality: str(r.locality), status: str(r.status) ?? "", starts_at: str(r.starts_at), ends_at: str(r.ends_at), ticket_url: str(r.ticket_url), contact_info: str(r.contact_info), price_text: str(r.price_text), cover_url: str(r.cover_url), organiser_name: str(r.organiser_name), is_dated_run: r.is_dated_run === true } satisfies EventRow) : null;
    }),
    read(() => sb.from("event_occurrences").select("id, event_id, starts_at, ends_at, status, note").eq("event_id", eventId).order("starts_at", { ascending: true }).limit(100),
      (d) => rows(d).flatMap((o) => (str(o.id) && str(o.starts_at) ? [{ id: str(o.id)!, event_id: eventId, starts_at: str(o.starts_at)!, ends_at: str(o.ends_at), status: (["scheduled", "cancelled", "changed"].includes(String(o.status)) ? o.status : "scheduled") as OccurrenceRow["status"], note: str(o.note) }] : []))),
    read(() => sb.from("event_change_log").select("id, occurrence_id, actor_kind, action, detail, created_at").eq("event_id", eventId).order("id", { ascending: false }).limit(30),
      (d) => rows(d).map((l) => ({ id: num(l.id), occurrence_id: str(l.occurrence_id), actor_kind: str(l.actor_kind) ?? "", action: str(l.action) ?? "", detail: obj(l.detail) ?? {}, created_at: str(l.created_at) ?? "" }))),
    read(() => sb.from("event_change_requests").select("id, status, kind, payload, before, review_reason, created_at").eq("event_id", eventId).order("created_at", { ascending: false }).limit(20),
      (d) => rows(d).map((c) => ({ id: str(c.id) ?? "", status: str(c.status) ?? "", kind: str(c.kind) ?? "", payload: obj(c.payload) ?? {}, before: obj(c.before) ?? {}, review_reason: str(c.review_reason), created_at: str(c.created_at) ?? "" }))),
    myOrganiserTrusted(sb),
  ]);
  return {
    ok: true,
    data: { submission: sub.data, event: ev.ok ? ev.data : null, occurrences: occ.ok ? occ.data : [], log: log.ok ? log.data : null, changes: ch.ok ? ch.data : null, trusted },
  };
}

type Done = { duplicate: boolean; status: string; event_cancelled?: boolean };
const done = (d: unknown): Done | null => { const o = obj(d); return o ? { duplicate: o.duplicate === true, status: str(o.status) ?? "", event_cancelled: o.event_cancelled === true } : null; };

export const reportPerformanceCancelled = (sb: Sb, occurrenceId: string, note?: string) =>
  call(sb, "report_performance_cancelled", { p_occurrence: occurrenceId, p_note: note?.trim() || null }, done);
export const reportPerformanceRestored = (sb: Sb, occurrenceId: string) => call(sb, "report_performance_restored", { p_occurrence: occurrenceId }, done);
export const reportEventCancelled = (sb: Sb, eventId: string, note?: string) => call(sb, "report_event_cancelled", { p_event: eventId, p_note: note?.trim() || null }, done);
export const reportEventRestored = (sb: Sb, eventId: string) => call(sb, "report_event_restored", { p_event: eventId }, done);
export const setPerformanceNote = (sb: Sb, occurrenceId: string, note: string) =>
  call(sb, "set_performance_note", { p_occurrence: occurrenceId, p_note: note.trim() || null }, (d) => obj(d));

export type ChangeOutcome = { id: string; status: "pending" | "auto_approved" | string; duplicate: boolean };
/** Ask for a change. `status` tells the truth: "auto_approved" = live now, "pending" = with staff. */
export function requestChange(sb: Sb, eventId: string, payload: Record<string, unknown>, requestId: string): Promise<Result<ChangeOutcome>> {
  return call(sb, "request_event_change", { p_event: eventId, p_payload: payload, p_request: requestId }, (d) => {
    const o = obj(d);
    return o && str(o.id) ? { id: str(o.id)!, status: str(o.status) ?? "pending", duplicate: o.duplicate === true } : null;
  });
}
export const withdrawChange = (sb: Sb, id: string) => call(sb, "withdraw_event_change", { p_id: id }, (d) => (d === "withdrawn" ? (true as const) : null));

/* ── staff: change requests and trust ──────────────────────────────────────────────────────────────────────────────────────── */

export type ChangeCounts = { pending: number; auto_approved_7d: number };
export function adminChangeCounts(sb: Sb): Promise<Result<ChangeCounts>> {
  return call(sb, "admin_event_change_counts", undefined, (d) => {
    const r = obj(Array.isArray(d) ? d[0] : d);
    return r ? { pending: num(r.pending), auto_approved_7d: num(r.auto_approved_7d) } : { pending: 0, auto_approved_7d: 0 };
  });
}
export type ChangeSummary = { id: string; event_id: string; event_title: string; requester_id: string; status: string; kind: string; payload: Record<string, unknown>; created_at: string };
export function adminListChanges(sb: Sb, status: "pending" | "auto_approved" = "pending", limit = 50): Promise<Result<ChangeSummary[]>> {
  return call(sb, "admin_list_event_changes", { p_status: status, p_limit: limit }, (d) => {
    if (d !== null && d !== undefined && !Array.isArray(d)) return null;
    return rows(d).flatMap((r) => (str(r.id) ? [{ id: str(r.id)!, event_id: str(r.event_id) ?? "", event_title: str(r.event_title) ?? "", requester_id: str(r.requester_id) ?? "", status: str(r.status) ?? "", kind: str(r.kind) ?? "", payload: obj(r.payload) ?? {}, created_at: str(r.created_at) ?? "" }] : []));
  });
}
/** The "before" values for requests, which the list function does not return (staff can read the table). */
export function adminChangeBefore(sb: Sb, ids: readonly string[]): Promise<Result<Record<string, Record<string, unknown>>>> {
  if (ids.length === 0) return Promise.resolve({ ok: true, data: {} });
  return read(() => sb.from("event_change_requests").select("id, before").in("id", [...ids]), (d) => Object.fromEntries(rows(d).flatMap((r) => (str(r.id) ? [[str(r.id)!, obj(r.before) ?? {}]] : []))));
}
export function adminReviewChange(sb: Sb, id: string, decision: "approve" | "reject", reason?: string): Promise<Result<{ status: string; duplicate: boolean }>> {
  const r = (reason ?? "").trim();
  if (decision === "reject" && !r) return Promise.resolve({ ok: false, error: { kind: "validation", message: "Please write a short reason for the member.", field: "reason" } });
  if (r.length > 500) return Promise.resolve({ ok: false, error: { kind: "validation", message: "Please keep the reason to 500 characters or fewer.", field: "reason" } });
  return call(sb, "admin_review_event_change", { p_id: id, p_decision: decision, p_reason: r || null }, (d) => {
    const o = obj(d);
    return o && str(o.status) ? { status: str(o.status)!, duplicate: o.duplicate === true } : null;
  });
}
export function adminSetTrust(sb: Sb, userId: string, trusted: boolean, note?: string): Promise<Result<{ trusted: boolean }>> {
  const n = (note ?? "").trim();
  if (n.length > 300) return Promise.resolve({ ok: false, error: { kind: "validation", message: "Please keep the note to 300 characters or fewer.", field: "note" } });
  return call(sb, "admin_set_organiser_trust", { p_user: userId, p_trusted: trusted, p_note: n || null }, (d) => { const o = obj(d); return o ? { trusted: o.trusted === true } : null; });
}
export function adminTrustFor(sb: Sb, userIds: readonly string[]): Promise<Result<Record<string, { trusted: boolean; note: string | null }>>> {
  if (userIds.length === 0) return Promise.resolve({ ok: true, data: {} });
  return read(() => sb.from("event_organiser_trust").select("user_id, trusted, note").in("user_id", [...userIds]),
    (d) => Object.fromEntries(rows(d).flatMap((r) => (str(r.user_id) ? [[str(r.user_id)!, { trusted: r.trusted === true, note: str(r.note) }]] : []))));
}

/* ── staff: community events (cancel / restore) ────────────────────────────────────────────────────────────────────────────── */

/** Cancel ('cancelled') or restore ('scheduled') ONE performance through the existing staff function. The note stays empty on purpose (a performance note is public). */
export function adminSetOccurrenceStatus(sb: Sb, occurrenceId: string, status: "cancelled" | "scheduled"): Promise<Result<{ id: string; status: string }>> {
  return call(sb, "admin_set_occurrence_status", { p_occurrence: occurrenceId, p_status: status, p_note: null }, (d) => {
    const o = obj(d);
    return o && str(o.id) ? { id: str(o.id)!, status: str(o.status) ?? status } : null;
  });
}

/**
 * Cancel or restore the WHOLE event by updating events.status through the staff session (the events UPDATE policy lets staff do this; the database then
 * hides or shows it on the lists). The update only applies from the state the screen showed (published -> cancelled, cancelled -> published); if
 * nothing changed (someone else got there first, or row security refused) the answer says so instead of pretending.
 */
export function adminSetEventStatus(sb: Sb, eventId: string, to: "cancelled" | "published"): Promise<Result<{ id: string; status: string }>> {
  const from = to === "cancelled" ? "published" : "cancelled";
  return read(() => sb.from("events").update({ status: to }).eq("id", eventId).eq("status", from).select("id, status"), (d) => rows(d)[0] ?? null)
    .then((r): Result<{ id: string; status: string }> => {
      if (!r.ok) return r;
      const row = r.data;
      if (!row || !str(row.id)) return { ok: false, error: { kind: "decided", message: "Nothing was changed. The event may have been changed by someone else, or you may not have permission. Please refresh the page and look again." } };
      return { ok: true, data: { id: str(row.id)!, status: str(row.status) ?? to } };
    });
}

/* ── poster upload ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Upload a poster to the person's own folder in the event-media bucket (<user id>/events/<file>), which the storage policy allows for any
 * signed-in person, and return its public URL. The database accepts only a URL of exactly this shape.
 */
export async function uploadPoster(sb: Sb, userId: string, file: { type: string; size: number; name: string }, now: number = Date.now()): Promise<Result<string>> {
  const problem = posterProblem(file);
  if (problem) return { ok: false, error: { kind: "validation", message: problem, field: "cover_url" } };
  if (!sb.storage) return { ok: false, error: { kind: "unavailable", message: MSG.unavailable } };
  const path = `${userId}/events/${posterFileName(file.name, file.type, now)}`;
  try {
    const bucket = sb.storage.from("event-media");
    const up = await bucket.upload(path, file, { upsert: false, contentType: file.type });
    if (up.error) return { ok: false, error: { kind: "unknown", message: "We couldn't upload that picture. Please try again, or continue without it." } };
    const pub = bucket.getPublicUrl(path);
    const url = pub?.data?.publicUrl;
    return typeof url === "string" && url ? { ok: true, data: url } : { ok: false, error: { kind: "unknown", message: MSG.unknown } };
  } catch {
    return { ok: false, error: { kind: "network", message: MSG.network } };
  }
}
