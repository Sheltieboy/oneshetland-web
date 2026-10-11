import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-data.server";
import { loadAdminOverview } from "@/lib/launch-testing/data.server";
import { stateOfAttempt, type CellState } from "@/lib/launch-testing/readiness";
import { AdminHeader, Card, Empty, StatCard } from "@/components/admin/AdminUI";
import { AdminTabs } from "@/components/launch-testing/AdminTabs";
import { ProgrammeForm } from "@/components/launch-testing/ProgrammeForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Launch testing", robots: { index: false, follow: false } };

const GLYPH: Record<CellState, { g: string; label: string; cls: string }> = {
  not_started: { g: "○", label: "Not started", cls: "text-ink-faint" },
  in_progress: { g: "◐", label: "In progress", cls: "text-blue-600" },
  passed: { g: "✓", label: "Passed", cls: "text-emerald-600" },
  issue: { g: "!", label: "Issue", cls: "text-rose-600" },
  blocked: { g: "?", label: "Blocked", cls: "text-amber-600" },
  recheck: { g: "↻", label: "Re-check needed", cls: "text-violet-600" },
  na: { g: "–", label: "Not applicable", cls: "text-ink-faint" },
};
const GATE = {
  ready: { label: "READY", cls: "border-emerald-400 bg-emerald-50 text-emerald-900" },
  incomplete: { label: "INCOMPLETE", cls: "border-amber-400 bg-amber-50 text-amber-900" },
  not_ready: { label: "NOT READY", cls: "border-rose-400 bg-rose-50 text-rose-900" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  await requireAdmin();
  const { programme: slug } = await searchParams;
  const o = await loadAdminOverview(slug);
  const p = o.programme;
  const matrix = o.matrix;

  return (
    <>
      <AdminHeader title="Launch testing" sub="Real people checking the real app. Advisory only — this never blocks a store release." />
      <AdminTabs programme={p?.slug} />
      {!p || !matrix || !o.summary ? (
        <Empty>No test programme was found. If the Launch Test Centre migration has not been applied yet, apply it first.</Empty>
      ) : (
        <div className="space-y-6">
          {o.programmes.length > 1 && (
            <div className="flex flex-wrap gap-2 text-sm">{o.programmes.map((x) => <Link key={x.id} href={`/admin/launch-testing?programme=${x.slug}`} className={"rounded-pill border px-3 py-1 font-semibold " + (x.id === p.id ? "border-navy bg-navy text-white" : "border-line text-ink")}>{x.name}</Link>)}</div>
          )}
          <div>
            <h2 className="font-display text-xl font-bold text-ink">{p.name}</h2>
            <p className="text-sm text-ink-muted">Status: {p.status} · iOS {p.expected_ios_build ?? "—"} · Android {p.expected_android_version ?? "—"}</p>
          </div>

          <div className={"rounded-card border-2 p-4 " + GATE[o.summary.gate].cls} role="status">
            <p className="text-xs font-bold uppercase tracking-widest">Launch confidence (advisory)</p>
            <p className="font-display text-3xl font-bold">{GATE[o.summary.gate].label}</p>
            <p className="mt-1 text-sm">{o.summary.gateReason}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Active testers" value={o.summary.testers} />
            <StatCard label="Mandatory tests" value={o.summary.mandatoryTests} />
            <div className="rounded-card border border-line bg-paper p-4 shadow-soft"><p className="font-display text-3xl font-bold text-ink">{o.summary.passed} / {o.summary.applicable}</p><p className="mt-0.5 text-sm text-ink-muted">Passed</p></div>
            <StatCard label="Open issues" value={o.summary.openIssues} alert />
            <StatCard label="Blocked" value={o.summary.blocked} />
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-3">Test</th>
                  {matrix.testers.map((u) => { const t = o.testers.find((x) => x.user_id === u.user_id); return <th key={u.user_id} className="px-2 py-2 text-center normal-case" title={t?.email ?? ""}>{t?.display_name || t?.full_name || t?.email?.split("@")[0] || "Tester"}</th>; })}
                </tr>
              </thead>
              <tbody>
                {matrix.tests.map((t) => (
                  <tr key={t.id} className="border-t border-line">
                    <td className="py-2 pr-3 text-ink">{o.tests.find((x) => x.id === t.id)?.title}{t.mandatory ? "" : <span className="ml-1 text-xs text-ink-muted">(optional)</span>}</td>
                    {matrix.testers.map((u) => {
                      const s = matrix.cells[t.id][u.user_id]; const g = GLYPH[s];
                      const rows = o.latest.filter((l) => l.test_id === t.id && l.user_id === u.user_id);
                      const pick = rows.find((l) => stateOfAttempt(l) !== "passed") ?? rows[0];
                      const cell = <span className={"inline-block min-w-8 rounded px-2 py-1 text-base font-black " + g.cls} title={g.label} aria-label={g.label}>{g.g}</span>;
                      return <td key={u.user_id} className="px-2 py-1 text-center">{pick ? <Link href={`/admin/launch-testing/attempts/${pick.attempt_id}`}>{cell}</Link> : cell}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">{(["not_started", "in_progress", "passed", "issue", "blocked", "recheck", "na"] as CellState[]).map((s) => <span key={s}><span className={"font-black " + GLYPH[s].cls}>{GLYPH[s].g}</span> {GLYPH[s].label}</span>)}</p>
          </Card>
          <ProgrammeForm programme={p} />
        </div>
      )}
    </>
  );
}
