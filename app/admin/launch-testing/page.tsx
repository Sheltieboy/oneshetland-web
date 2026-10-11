import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-data.server";
import { loadAdminOverview } from "@/lib/launch-testing/data.server";
import { stateOfAttempt, type CellState, type Gate, type Summary } from "@/lib/launch-testing/readiness";
import { PLATFORMS, PLATFORM_LABEL, appliesTo, describeWebContext, platformsFor, isPlatform } from "@/lib/launch-testing/platform";
import type { Platform } from "@/lib/launch-testing/types";
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
const GATE: Record<Gate, { label: string; cls: string }> = {
  ready: { label: "READY", cls: "border-emerald-400 bg-emerald-50 text-emerald-900" },
  incomplete: { label: "INCOMPLETE", cls: "border-amber-400 bg-amber-50 text-amber-900" },
  not_ready: { label: "NOT READY", cls: "border-rose-400 bg-rose-50 text-rose-900" },
};
const SHORT: Record<Platform, string> = { web: "Web", ios: "iOS", android: "And" };

export default async function Page({ searchParams }: { searchParams: Promise<{ programme?: string; view?: string }> }) {
  await requireAdmin();
  const { programme: slug, view } = await searchParams;
  const o = await loadAdminOverview(slug);
  const p = o.programme;
  const matrix = o.matrix;
  const view_: Platform | "overall" = isPlatform(view) ? view : "overall";
  const href = (v: string) => `/admin/launch-testing?${p ? `programme=${p.slug}&` : ""}view=${v}`;

  return (
    <>
      <AdminHeader title="Launch testing" sub="Real people checking the live website and apps. Advisory only — this never blocks a deployment or a store release." />
      <AdminTabs programme={p?.slug} />
      {!p || !matrix || !o.readiness ? (
        <Empty>No test programme was found. If the Launch Test Centre migration has not been applied yet, apply it first.</Empty>
      ) : (() => {
        const r = o.readiness; const sum: Summary = view_ === "overall" ? r.overall : r.platforms[view_];
        const shown: Platform[] = view_ === "overall" ? [...PLATFORMS] : [view_];
        const nameOf = (uid: string) => { const t = o.testers.find((x) => x.user_id === uid); return t?.display_name || t?.full_name || t?.email?.split("@")[0] || "Tester"; };
        const assignedTo = (pl: Platform) => matrix.testers.filter((u) => platformsFor(u.platforms).includes(pl));
        const columns = view_ === "overall" ? matrix.testers : assignedTo(view_);
        return (
          <div className="space-y-6">
            {o.programmes.length > 1 && (
              <div className="flex flex-wrap gap-2 text-sm">{o.programmes.map((x) => <Link key={x.id} href={`/admin/launch-testing?programme=${x.slug}`} className={"rounded-pill border px-3 py-1 font-semibold " + (x.id === p.id ? "border-navy bg-navy text-white" : "border-line text-ink")}>{x.name}</Link>)}</div>
            )}
            <div>
              <h2 className="font-display text-xl font-bold text-ink">{p.name}</h2>
              <p className="text-sm text-ink-muted">Status: {p.status} · Website: live OneShetland website · iOS {p.expected_ios_build ?? "—"} · Android {p.expected_android_version ?? "—"}</p>
            </div>

            <div className={"rounded-card border-2 p-4 " + GATE[r.overall.gate].cls} role="status">
              <p className="text-xs font-bold uppercase tracking-widest">Is OneShetland ready across Website, iPhone and Android? (advisory)</p>
              <p className="font-display text-3xl font-bold">{GATE[r.overall.gate].label}</p>
              <p className="mt-1 text-sm">{r.overall.gateReason}</p>
            </div>

            <ul className="grid gap-3 md:grid-cols-3" aria-label="Readiness by platform">
              {PLATFORMS.map((pl) => { const s = r.platforms[pl]; return (
                <li key={pl}>
                  <Link href={href(pl)} className={"block rounded-card border-2 p-4 " + GATE[s.gate].cls + (view_ === pl ? " ring-2 ring-navy" : "")}>
                    <span className="flex items-baseline justify-between"><span className="font-display text-lg font-bold">{PLATFORM_LABEL[pl]}</span><span className="text-xs font-black tracking-wide">{GATE[s.gate].label}</span></span>
                    <span className="mt-1 block text-sm">{s.passed}/{s.checks} mandatory checks passed · {s.testers} tester{s.testers === 1 ? "" : "s"}</span>
                    <span className="mt-1 block text-xs">{s.openIssues} issue · {s.blocked} blocked · {s.incomplete} incomplete</span>
                  </Link>
                </li>); })}
            </ul>

            <nav aria-label="View" className="flex flex-wrap gap-2 text-sm">
              {(["overall", ...PLATFORMS] as const).map((v) => (
                <Link key={v} href={href(v)} aria-current={view_ === v ? "page" : undefined}
                  className={"rounded-pill border px-4 py-1.5 font-bold " + (view_ === v ? "border-navy bg-navy text-white" : "border-line text-ink")}>{v === "overall" ? "Overall" : PLATFORM_LABEL[v]}</Link>
              ))}
            </nav>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <StatCard label={view_ === "overall" ? "Active testers" : `${PLATFORM_LABEL[view_]} testers`} value={sum.testers} />
              <StatCard label="Mandatory checks" value={sum.checks} />
              <div className="rounded-card border border-line bg-paper p-4 shadow-soft"><p className="font-display text-3xl font-bold text-ink">{sum.passed} / {sum.checks}</p><p className="mt-0.5 text-sm text-ink-muted">Passed</p></div>
              <StatCard label="Open issues" value={sum.openIssues} alert />
              <StatCard label="Blocked" value={sum.blocked} />
              <StatCard label="Incomplete" value={sum.incomplete} />
            </div>
            <p className="text-sm text-ink-soft">{view_ === "overall" ? "Assigned testers: " + PLATFORMS.map((pl) => `${PLATFORM_LABEL[pl]} ${assignedTo(pl).map((u) => nameOf(u.user_id)).join(", ") || "none"}`).join(" · ")
              : `${PLATFORM_LABEL[view_]} testers: ${assignedTo(view_).map((u) => nameOf(u.user_id)).join(", ") || "none assigned yet"}`}</p>

            <Card className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="py-2 pr-3">Test{view_ === "overall" ? " (W = Website, iOS, And = Android)" : ""}</th>
                    {columns.map((u) => { const t = o.testers.find((x) => x.user_id === u.user_id); return <th key={u.user_id} className="px-2 py-2 text-center normal-case" title={t?.email ?? ""}>{nameOf(u.user_id)}</th>; })}
                  </tr>
                </thead>
                <tbody>
                  {matrix.tests.filter((t) => shown.some((pl) => appliesTo(t, pl))).map((t) => (
                    <tr key={t.id} className="border-t border-line">
                      <td className="py-2 pr-3 text-ink">{o.tests.find((x) => x.id === t.id)?.title}{t.mandatory ? "" : <span className="ml-1 text-xs text-ink-muted">(optional)</span>}
                        {t.platform !== "all" && <span className="ml-1 rounded-pill bg-sand px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-muted">{PLATFORM_LABEL[t.platform]} only</span>}</td>
                      {columns.map((u) => (
                        <td key={u.user_id} className="px-2 py-1 text-center">
                          <span className="inline-flex gap-1">
                            {shown.map((pl) => {
                              const s = matrix.cells[pl][t.id][u.user_id]; const g = GLYPH[s];
                              if (s === "na" && view_ === "overall") return <span key={pl} className="inline-block min-w-8 rounded px-1 py-1 text-xs text-ink-faint" title={`${PLATFORM_LABEL[pl]}: not applicable`} aria-label={`${PLATFORM_LABEL[pl]}: not applicable`}>–</span>;
                              const rows = o.latest.filter((l) => l.test_id === t.id && l.user_id === u.user_id && l.platform === pl);
                              const pick = rows.find((l) => stateOfAttempt(l) !== "passed") ?? rows[0];
                              const ctx = pick?.browser ? ` (${describeWebContext({ browser: pick.browser, device_class: pick.device_class, viewport: pick.viewport ?? null })})` : "";
                              const label = `${PLATFORM_LABEL[pl]}: ${g.label}${ctx}`;
                              const cell = <span className={"inline-block min-w-8 rounded px-1 py-1 text-base font-black " + g.cls} title={label} aria-label={label}>
                                {view_ === "overall" && <span className="mr-0.5 text-[9px] font-bold uppercase text-ink-muted">{SHORT[pl]}</span>}{g.g}</span>;
                              return pick ? <Link key={pl} href={`/admin/launch-testing/attempts/${pick.attempt_id}`}>{cell}</Link> : <span key={pl}>{cell}</span>;
                            })}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {columns.length === 0 && <p className="mt-3 text-sm text-ink-muted">No tester is assigned here yet.</p>}
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">{(["not_started", "in_progress", "passed", "issue", "blocked", "recheck", "na"] as CellState[]).map((s) => <span key={s}><span className={"font-black " + GLYPH[s].cls}>{GLYPH[s].g}</span> {GLYPH[s].label}</span>)}</p>
            </Card>
            <ProgrammeForm programme={p} />
          </div>
        );
      })()}
    </>
  );
}
