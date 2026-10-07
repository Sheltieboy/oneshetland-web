"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/admin/AdminUI";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { allowRepublishAction, markSentAction, setStageAction, takeOfflineAction } from "@/app/admin/launch-partners/actions";
import { Section } from "./fields";
import { runGuarded } from "@/lib/launch-partners/invitation-replace";
import { STATUS_LABEL, STATUS_TONE, derivePipelineStatus, isClaimed, isPublishedNow, isTakenOffline, nextAction, type OutreachBlock, type PipelineRow } from "@/lib/launch-partners/status";
import { OUTREACH_REASON_LABEL } from "./OutreachStopSection";
import type { CampaignEvent } from "@/lib/launch-partners/campaigns.server";

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }) : null);
const KIND: Record<string, string> = { created: "Campaign created", updated: "Edited", stage: "Stage changed", marked_sent: "Recorded as sent (by hand)", first_viewed: "Private preview opened for the first time", version_owner_edit: "Owner edited their page", profile_approved: "Owner approved their setup", went_live: "Owner went live", went_offline: "Page taken offline", republish_allowed: "Owner allowed to go live again", outreach_stopped: "Launch Partner outreach stopped", outreach_resumed: "Launch Partner outreach allowed again" };

/** Where this partner stands: the derived status, a milestone checklist from real facts, stage controls, and the audit trail. */
export function StatusSection({ row, events }: { row: PipelineRow; events: CampaignEvent[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const status = derivePipelineStatus(row);
  const published = isPublishedNow(row);
  const offline = isTakenOffline(row);
  const releasedAfterOffline = !!row.live_at && !published && !offline;       // taken offline earlier; the hold was lifted; waiting for the owner
  const offEvent = events.find((e) => e.kind === "went_offline") ?? null;
  const [reason, setReason] = useState("");

  /** Run a stage action so the buttons can NEVER be left disabled: a refused, lost or unanswered request becomes a plain error and a refresh. */
  async function go(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setErr(null);
    const g = await runGuarded(fn);
    setBusy(false);
    if (!g.ok) { setErr(g.error); router.refresh(); return; }
    if (!g.value.ok) setErr((g.value as { error: string }).error); else router.refresh();
  }
  const milestones: [string, string | null | boolean][] = [
    ["Launch preview prepared", row.has_preview], ["Business page prepared", row.has_page_draft], ["Marked ready to invite", row.stage === "ready_to_invite" || row.stage === "sent"],
    ["Private invitation generated", row.invite.created_at], ["Invitation sent (recorded by hand)", row.sent_at], ["Preview opened", row.first_viewed_at],
    ["Claim submitted", row.claim?.created_at ?? null], ["Claim approved — they own the business", isClaimed(row)], ["Launch-partner Premium granted", row.grant ? row.grant.expires_at : null],
    ["Products added or imported", row.product_count > 0 || row.import_batch_count > 0], ["Ready to go live (their approval)", row.setup_ready_at], ["Live", published ? row.live_at : null],
    ...(row.live_at && !published ? ([["Taken offline by an administrator", offline ? (row.offline_at ?? true) : false]] as [string, string | boolean][]) : []),
  ];

  return (
    <Section id="status" title="Status" sub="Worked out from the real invitation, claim, plan and products — not typed in.">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
        <p className="text-sm text-ink-soft"><span className="font-semibold text-ink">Next:</span> {nextAction(row, status)}</p>
      </div>
      {row.view_count > 0 && <p className="text-sm text-ink-soft">Preview opened {row.view_count} time{row.view_count === 1 ? "" : "s"} · last {when(row.last_viewed_at)}. <span className="text-ink-muted">Counts a visit at most once every 30 minutes; a mail scanner opening the link can also register as a view.</span></p>}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {milestones.map(([label, v]) => (
          <li key={label} className="flex items-start gap-2 text-sm"><span aria-hidden className={v ? "text-emerald-600" : "text-ink-faint"}>{v ? "✓" : "○"}</span><span className={v ? "text-ink" : "text-ink-muted"}>{label}{typeof v === "string" && /^\d{4}-/.test(v) ? <span className="text-ink-muted"> · {when(v)}</span> : null}</span></li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {row.stage === "candidate" && <button disabled={busy} onClick={() => go(() => setStageAction(row.id, "preparing"))} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold hover:bg-sand">Start preparing</button>}
        {row.stage === "preparing" && <button disabled={busy || !row.has_preview} onClick={() => go(() => setStageAction(row.id, "ready_to_invite"))} className="rounded-pill bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">Mark ready to invite</button>}
        {row.stage === "ready_to_invite" && <button disabled={busy} onClick={() => go(() => setStageAction(row.id, "preparing"))} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold hover:bg-sand">Back to preparing</button>}
        {row.stage === "ready_to_invite" && <button disabled={busy || !(row.invite.status === "open")} title={row.invite.status === "open" ? undefined : "Generate the invitation first"} onClick={async () => { if (await confirm({ title: "Record that you sent it?", body: "This only notes that YOU sent the invitation yourself. OneShetland sends nothing.", confirmLabel: "Yes, I sent it" })) await go(() => markSentAction(row.id)); }} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold hover:bg-sand disabled:opacity-40">I&rsquo;ve sent it myself</button>}
        {row.stage !== "archived" && row.stage !== "sent" && <button disabled={busy} onClick={async () => { if (await confirm({ title: "Archive this launch partner?", body: "It leaves the active pipeline. Nothing about the business changes.", confirmLabel: "Archive" })) await go(() => setStageAction(row.id, "archived")); }} className="rounded-pill px-4 py-1.5 text-sm font-semibold text-ink-muted hover:bg-sand">Archive</button>}
        {row.stage === "archived" && <button disabled={busy} onClick={() => go(() => setStageAction(row.id, "candidate"))} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold hover:bg-sand">Restore</button>}
      </div>
      {offline && (
        <div role="region" aria-label="This page is offline" className="space-y-2 rounded-xl border-2 border-rose-300 bg-rose-50 p-4">
          <p className="text-sm font-bold text-rose-900">Page taken offline</p>
          <p className="text-sm text-rose-900">
            {when(row.offline_at) ? `Since ${when(row.offline_at)}` : "Offline"}{offEvent && (offEvent.detail as { actor_name?: string }).actor_name ? ` · by ${(offEvent.detail as { actor_name?: string }).actor_name}` : ""}.
            {offEvent && typeof (offEvent.detail as { reason?: unknown }).reason === "string" ? <> Reason: <span className="font-semibold">{(offEvent.detail as { reason: string }).reason}</span></> : null}
          </p>
          <p className="text-sm text-rose-900">The ordinary Directory listing is showing instead. The business, owner, claim, Launch Partner access and every saved version are intact. The owner sees &ldquo;Your page is currently offline&rdquo; and <strong>cannot go live again until you allow it</strong>. The reason above is for administrators only.</p>
          <button disabled={busy} onClick={async () => { if (await confirm({ title: "Allow the owner to go live again?", body: "This does not publish anything. It only lets the owner press Go live on their approved setup again, and they will be asked to confirm.", confirmLabel: "Allow" })) await go(() => allowRepublishAction(row.id)); }} className="rounded-pill bg-white px-4 py-1.5 text-sm font-semibold text-rose-900 ring-1 ring-rose-300 hover:bg-rose-100 disabled:opacity-40">Allow the owner to go live again</button>
        </div>
      )}
      {releasedAfterOffline && (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900">This page was taken offline earlier and the hold has been lifted. It is <strong>not public</strong> until the owner goes live again.</p>
      )}
      {published && row.stage !== "archived" && (
        <details className="rounded-xl border border-rose-200 p-4">
          <summary className="cursor-pointer text-sm font-bold text-rose-800">Danger zone</summary>
          <div className="mt-3 space-y-2">
            <p className="text-sm text-ink-soft">Take the published page offline if it is wrong, disputed or should not be public. The business, owner, claim, Launch Partner access and every saved version stay as they are, and nothing is deleted or emailed. You can allow the owner to publish an approved setup again later.</p>
            <label className="block text-sm font-semibold text-ink-soft">Reason (required — kept in the history, for administrators only)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm" placeholder="e.g. Owner asked for the page to be paused; ownership is being checked" />
            </label>
            <button disabled={busy || reason.trim().length < 3} onClick={async () => { if (await confirm({ title: "Take this Launch Partner page offline?", body: "The rich published page will stop being public. The business, owner, claim, Launch Partner access and saved versions will remain intact.\n\nYou can publish an approved setup again later.", confirmLabel: "Take page offline" })) { await go(() => takeOfflineAction(row.id, reason, { confirm: true })); setReason(""); } }} className="rounded-pill border border-rose-300 px-4 py-1.5 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-40">Take page offline</button>
          </div>
        </details>
      )}
      {err && <p role="alert" className="text-sm font-semibold text-rose-700">{err}</p>}
      {events.length > 0 && (
        <details className="rounded-xl border border-line p-4">
          <summary className="cursor-pointer text-sm font-bold text-ink">History ({events.length})</summary>
          <ul className="mt-3 space-y-1.5 text-sm">
            {events.map((e) => <li key={e.id} className="flex flex-wrap gap-x-3 text-ink-soft"><span className="text-ink-muted">{when(e.created_at)}</span><span className="font-semibold text-ink">{KIND[e.kind] ?? e.kind}</span>{e.kind === "updated" && Array.isArray((e.detail as { fields?: string[] }).fields) && <span className="text-ink-muted">{((e.detail as { fields: string[] }).fields).join(", ")}</span>}{e.kind === "went_live" && <span className="text-ink-muted">published version {String((e.detail as { version_id?: string }).version_id ?? "").slice(0, 8)} (approved {String((e.detail as { approved_version_id?: string }).approved_version_id ?? "").slice(0, 8)}){(e.detail as { republish?: boolean }).republish ? " · an update" : ""}</span>}{e.kind === "went_offline" && <span className="text-ink-muted">{(e.detail as { actor_name?: string }).actor_name ? `by ${(e.detail as { actor_name?: string }).actor_name} · ` : ""}reason: {String((e.detail as { reason?: string }).reason ?? "—")}</span>}{e.kind === "republish_allowed" && (e.detail as { actor_name?: string }).actor_name && <span className="text-ink-muted">by {(e.detail as { actor_name?: string }).actor_name}</span>}{e.kind === "outreach_stopped" && <span className="text-ink-muted">{(e.detail as { actor_name?: string }).actor_name ? `by ${(e.detail as { actor_name?: string }).actor_name} · ` : ""}{OUTREACH_REASON_LABEL[(e.detail as { reason?: OutreachBlock["reason"] }).reason as OutreachBlock["reason"]] ?? "reason recorded"}</span>}{e.kind === "outreach_resumed" && <span className="text-ink-muted">{(e.detail as { actor_name?: string }).actor_name ? `by ${(e.detail as { actor_name?: string }).actor_name} · ` : ""}reason: {String((e.detail as { reason?: string }).reason ?? "—")}</span>}</li>)}
          </ul>
        </details>
      )}
    </Section>
  );
}
