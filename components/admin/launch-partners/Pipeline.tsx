"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { importExistingAction } from "@/app/admin/launch-partners/actions";
import { runGuarded } from "@/lib/launch-partners/invitation-replace";
import { PrepareLaunchPartner } from "./PrepareLaunchPartner";
import { STATUS_LABEL, STATUS_ORDER, STATUS_TONE, TAB_LABEL, countByStatus, derivePipelineStatus, nextAction, nextActionHref, pipelineCells, realRows, type PipelineRow, type PipelineStatus } from "@/lib/launch-partners/status";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }) : "—");

/** The pipeline: one card per launch partner, with where it stands and the single next thing to do. */
export function LaunchPartnersPipeline({ rows, importable, loadError }: { rows: PipelineRow[]; importable: string[]; loadError: string | null }) {
  const router = useRouter();
  const [filter, setFilter] = useState<PipelineStatus | "all" | "test">("all");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const real = realRows(rows);
  const tests = rows.filter((r) => r.is_test);
  const counts = countByStatus(real);
  const visible = filter === "test" ? tests : real.filter((r) => (filter === "all" ? derivePipelineStatus(r) !== "archived" : derivePipelineStatus(r) === filter));
  const tabs = STATUS_ORDER.filter((s) => counts[s] > 0);

  async function importExisting() {
    setImporting(true); setNote(null);
    const g = await runGuarded(() => importExistingAction(), 60_000);
    setImporting(false);
    if (!g.ok) { setNote(g.error); router.refresh(); return; }
    const r = g.value;
    if (!r.ok) setNote(r.error);
    else { setNote(`Brought in ${r.outcome.created.length} preview${r.outcome.created.length === 1 ? "" : "s"} as drafts. Nothing was published, invited or sent.`); router.refresh(); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding((v) => !v)} className="rounded-pill bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-95">{adding ? "Close" : "+ Prepare a launch partner"}</button>
        {importable.length > 0 && (
          <button onClick={importExisting} disabled={importing} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand disabled:opacity-50">
            {importing ? "Bringing in…" : `Bring in the ${importable.length} existing preview${importable.length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
      {importable.length > 0 && <p className="text-xs text-ink-muted">Researched previews not yet managed here: {importable.join(", ")}. Bringing them in creates private drafts only — no invitation, no email, no change to any listing.</p>}
      {note && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">{note}</p>}
      {loadError && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800">{loadError}</p>}

      {adding && <PrepareLaunchPartner onClose={() => setAdding(false)} />}

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pipeline stage">
          {(["all", ...tabs] as const).map((k) => {
            const n = k === "all" ? real.filter((r) => derivePipelineStatus(r) !== "archived").length : counts[k];
            const on = filter === k;
            return (
              <button key={k} role="tab" aria-selected={on} onClick={() => setFilter(k)}
                className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + (on ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>
                {k === "all" ? "All" : TAB_LABEL[k]} <span className={on ? "text-white/80" : "text-ink-faint"}>{n}</span>
              </button>
            );
          })}
          {tests.length > 0 && <button role="tab" aria-selected={filter === "test"} onClick={() => setFilter("test")} className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + (filter === "test" ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>Test <span className={filter === "test" ? "text-white/80" : "text-ink-faint"}>{tests.length}</span></button>}
          {counts.archived > 0 && <button role="tab" aria-selected={filter === "archived"} onClick={() => setFilter("archived")} className={"rounded-pill px-4 py-1.5 text-sm font-semibold " + (filter === "archived" ? "bg-rose-600 text-white" : "border border-line-strong text-ink-soft hover:bg-sand")}>Archived <span className="text-ink-faint">{counts.archived}</span></button>}
        </div>
      )}

      {rows.length === 0 && !loadError ? (
        <Empty>No launch partners yet. Use <strong>+ Prepare a launch partner</strong> to pick a Directory business, or bring in the existing previews.</Empty>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => <PartnerCard key={r.id} r={r} />)}
          {visible.length === 0 && rows.length > 0 && <li className="text-sm text-ink-muted">Nothing at this stage.</li>}
        </ul>
      )}
    </div>
  );
}

function PartnerCard({ r }: { r: PipelineRow }) {
  const status = derivePipelineStatus(r);
  const c = pipelineCells(r);
  const cells: [string, string, boolean][] = [
    ["Preview", c.preview.label, c.preview.ok], ["Page", c.page.label, c.page.ok], ["Invitation", c.invitation.label, c.invitation.ok], ["Email", c.email.label, c.email.ok],
    ["Viewed", c.viewed.label, c.viewed.ok], ["Claim", c.claim.label, c.claim.ok], ["Plan", c.plan.label, c.plan.ok], ["Products", c.products.label, c.products.ok],
  ];
  return (
    <li>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/admin/launch-partners/${r.id}`} className="font-display text-xl font-bold text-ink hover:underline">{r.name}</Link>
              <StatusPill label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
              {r.is_test && <StatusPill label="Test fixture" tone="purple" />}
              {r.outreach && <StatusPill label="Outreach stopped" tone="red" />}
              {!r.is_active && <StatusPill label="Not publicly listed" tone="gray" />}
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">{[r.positioning, r.locality].filter(Boolean).join(" · ") || "No positioning yet"}</p>
          </div>
          <Link href={`/admin/launch-partners/${r.id}`} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">Open →</Link>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
          {cells.map(([k, v, ok]) => (
            <div key={k}><dt className="eyebrow text-ink-muted">{k}</dt><dd className={"mt-0.5 font-semibold " + (ok ? "text-emerald-700" : "text-ink-faint")}>{v}</dd></div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
          <p className="text-ink-soft"><span className="font-semibold text-ink">Next:</span> <Link href={nextActionHref(r, status)} className="font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">{nextAction(r, status)} →</Link></p>
          <p className="text-xs text-ink-muted">Last activity {day(r.last_activity ?? r.sent_at)}</p>
        </div>
      </Card>
    </li>
  );
}
