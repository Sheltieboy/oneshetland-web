import "server-only";
/**
 * event-submissions-admin.server.ts — server reads for the staff moderation pages. Every read is tolerant: a missing database function shows a calm
 * "not available yet" state, never a crash. Pure shaping lives in event-submissions-shape.ts.
 */
import { serverSb } from "@/lib/event-submissions-access.server";
import {
  adminChangeBefore, adminChangeCounts, adminListChanges, adminListSubmissions, adminSubmissionCounts, adminSubmissionDetails, adminTrustFor,
  mapError, type ChangeCounts, type ChangeSummary, type Result, type Sb, type SubmissionCounts, type SubmissionRow, type SubmissionStatus,
} from "@/lib/event-submissions-client";
import { adminEventLabel, describeChange, type ChangeLine } from "@/lib/event-submissions-shape";
import { COMMUNITY_LIMIT, cleanSearch, eventQueueBadges, shapeCommunityEvent, tabStatus, type CommunityEventView, type CommunityTab } from "@/lib/event-community-admin";

async function names(sb: Sb, ids: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {};
  try {
    const { data } = await sb.from("profiles").select("id, display_name, full_name").in("id", uniq);
    return Object.fromEntries(((data ?? []) as { id: string; display_name: string | null; full_name: string | null }[]).map((p) => [p.id, p.display_name || p.full_name || "A member"]));
  } catch { return {}; }
}

/** Counts for the badge on /admin/events. Either part may be missing. */
export async function queueCounts(): Promise<{ subs: SubmissionCounts | null; changes: ChangeCounts | null; unavailable: boolean }> {
  const sb = await serverSb();
  const [s, c] = await Promise.all([adminSubmissionCounts(sb), adminChangeCounts(sb)]);
  return { subs: s.ok ? s.data : null, changes: c.ok ? c.data : null, unavailable: !s.ok && !c.ok };
}

export type QueueItem = SubmissionRow & { submitter: string; label: string };
export async function loadSubmissionQueue(status: SubmissionStatus): Promise<Result<{ items: QueueItem[]; counts: SubmissionCounts | null }>> {
  const sb = await serverSb();
  const list = await adminListSubmissions(sb, status, 100);
  if (!list.ok) return list;
  const [details, counts, who] = await Promise.all([adminSubmissionDetails(sb, list.data.map((r) => r.id)), adminSubmissionCounts(sb), names(sb, list.data.map((r) => r.submitter_id))]);
  if (!details.ok) return details;
  const order = new Map(list.data.map((r, i) => [r.id, i]));
  const items = [...details.data].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((d) => ({ ...d, submitter: who[d.submitter_id] ?? "A member", label: adminEventLabel({ source: "community_submission", organiser_name: d.organiser_name }) }));
  return { ok: true, data: { items, counts: counts.ok ? counts.data : null } };
}

export type ChangeItem = ChangeSummary & { requester: string; label: string; lines: ChangeLine[]; trusted: boolean; trustNote: string | null };
export async function loadChangeQueue(status: "pending" | "auto_approved"): Promise<Result<{ items: ChangeItem[]; counts: ChangeCounts | null }>> {
  const sb = await serverSb();
  const list = await adminListChanges(sb, status, 100);
  if (!list.ok) return list;
  const ids = list.data.map((r) => r.id), users = list.data.map((r) => r.requester_id), events = [...new Set(list.data.map((r) => r.event_id))];
  const [before, trust, who, counts, ev] = await Promise.all([
    adminChangeBefore(sb, ids), adminTrustFor(sb, users), names(sb, users), adminChangeCounts(sb),
    (async () => { try { const { data } = await sb.from("events").select("id, source, organiser_name, is_platform_event").in("id", events); return (data ?? []) as { id: string; source: string | null; organiser_name: string | null; is_platform_event: boolean | null }[]; } catch { return []; } })(),
  ]);
  const evById = new Map(ev.map((e) => [e.id, e]));
  const items = list.data.map((c) => {
    const e = evById.get(c.event_id);
    // Change requests exist only for community events, so a row we cannot read is still labelled as one rather than guessed otherwise.
    const label = adminEventLabel(e ?? { source: "community_submission", organiser_name: null });
    const t = trust.ok ? trust.data[c.requester_id] : undefined;
    return { ...c, requester: who[c.requester_id] ?? "A member", label, lines: describeChange(c.payload, before.ok ? before.data[c.id] ?? {} : {}), trusted: t?.trusted ?? false, trustNote: t?.note ?? null };
  });
  return { ok: true, data: { items, counts: counts.ok ? counts.data : null } };
}

/**
 * Badge counts for the admin sidebar (shape: event-community-admin.eventQueueBadges). Tolerant to the end: a missing database function, a read
 * error or a thrown error just means no badge for that part.
 */
export async function eventQueueBadgeCounts(): Promise<Record<string, number>> {
  try { return eventQueueBadges(await queueCounts()); } catch { return {}; }
}

/** The Community events screen: events whose source is 'community_submission' (staff see every one, hidden or not, through their own session). */
export async function loadCommunityEvents(tab: CommunityTab, q: string): Promise<Result<CommunityEventView[]>> {
  let sb: Sb;
  try { sb = await serverSb(); } catch { return { ok: false, error: { kind: "unknown", message: "Something went wrong on our side. Please try again in a moment." } }; }
  const status = tabStatus(tab), term = cleanSearch(q);
  let reply: { data: unknown; error: { message?: string; code?: string } | null; status?: number };
  try {
    let query = sb.from("events")
      .select("id, title, status, is_hidden, organiser_name, source, submission_id, starts_at, ends_at, is_dated_run, created_at, occurrences:event_occurrences(id, starts_at, ends_at, status, note)")
      .eq("source", "community_submission");
    if (status) query = query.eq("status", status);
    if (term) query = query.ilike("title", `%${term}%`);
    reply = await query.order("created_at", { ascending: false }).limit(COMMUNITY_LIMIT);
  } catch (e) { return { ok: false, error: mapError({ message: e instanceof Error ? e.message : String(e) }) }; }
  if (reply.error || (reply.status && reply.status >= 400)) return { ok: false, error: mapError(reply.error, reply.status) };
  const raw = (Array.isArray(reply.data) ? reply.data : []) as Record<string, unknown>[];
  // The submitter comes from the linked submission (staff can read them all), then their profile name; any failure leaves the "A member" fallback.
  const subIds = [...new Set(raw.flatMap((r) => (typeof r.submission_id === "string" ? [r.submission_id] : [])))];
  const submitterOf: Record<string, string> = {};
  if (subIds.length) {
    try {
      const { data } = await sb.from("event_submissions").select("id, submitter_id").in("id", subIds);
      const subs = ((data ?? []) as { id: string; submitter_id: string }[]);
      const who = await names(sb, subs.map((s) => s.submitter_id));
      for (const s of subs) if (who[s.submitter_id]) submitterOf[s.id] = who[s.submitter_id];
    } catch { /* fallback names */ }
  }
  const now = Date.now();
  const items = raw.flatMap((r) => { const v = shapeCommunityEvent(r, typeof r.submission_id === "string" ? submitterOf[r.submission_id] : null, now); return v ? [v] : []; });
  return { ok: true, data: items };
}
