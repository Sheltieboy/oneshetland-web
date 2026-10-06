"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/admin/AdminUI";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { markSentAction, setStageAction } from "@/app/admin/launch-partners/actions";
import { Section } from "./fields";
import { runGuarded } from "@/lib/launch-partners/invitation-replace";
import { STATUS_LABEL, STATUS_TONE, derivePipelineStatus, isClaimed, nextAction, type PipelineRow } from "@/lib/launch-partners/status";
import type { CampaignEvent } from "@/lib/launch-partners/campaigns.server";

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }) : null);
const KIND: Record<string, string> = { created: "Campaign created", updated: "Edited", stage: "Stage changed", marked_sent: "Recorded as sent (by hand)", first_viewed: "Private preview opened for the first time" };

/** Where this partner stands: the derived status, a milestone checklist from real facts, stage controls, and the audit trail. */
export function StatusSection({ row, events }: { row: PipelineRow; events: CampaignEvent[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const status = derivePipelineStatus(row);

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
    ["Products added or imported", row.product_count > 0 || row.import_batch_count > 0], ["Ready to go live (their approval)", row.setup_ready_at], ["Live", row.live_at],
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
      {err && <p role="alert" className="text-sm font-semibold text-rose-700">{err}</p>}
      {events.length > 0 && (
        <details className="rounded-xl border border-line p-4">
          <summary className="cursor-pointer text-sm font-bold text-ink">History ({events.length})</summary>
          <ul className="mt-3 space-y-1.5 text-sm">
            {events.map((e) => <li key={e.id} className="flex flex-wrap gap-x-3 text-ink-soft"><span className="text-ink-muted">{when(e.created_at)}</span><span className="font-semibold text-ink">{KIND[e.kind] ?? e.kind}</span>{e.kind === "updated" && Array.isArray((e.detail as { fields?: string[] }).fields) && <span className="text-ink-muted">{((e.detail as { fields: string[] }).fields).join(", ")}</span>}</li>)}
          </ul>
        </details>
      )}
    </Section>
  );
}
