import "server-only";
/**
 * event-submissions-admin.server.ts — server reads for the staff moderation pages. Every read is tolerant: a missing database function shows a calm
 * "not available yet" state, never a crash. Pure shaping lives in event-submissions-shape.ts.
 */
import { serverSb } from "@/lib/event-submissions-access.server";
import {
  adminChangeBefore, adminChangeCounts, adminListChanges, adminListSubmissions, adminSubmissionCounts, adminSubmissionDetails, adminTrustFor,
  type ChangeCounts, type ChangeSummary, type Result, type Sb, type SubmissionCounts, type SubmissionRow, type SubmissionStatus,
} from "@/lib/event-submissions-client";
import { adminEventLabel, describeChange, type ChangeLine } from "@/lib/event-submissions-shape";

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
