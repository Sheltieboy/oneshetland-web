/* eslint-disable @next/next/no-img-element -- private, short-lived signed URLs and local previews: next/image cannot optimise them */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-data.server";
import { loadAttemptDetail } from "@/lib/launch-testing/data.server";
import { LIVE_WEBSITE_LABEL, PLATFORM_LABEL, describeWebContext } from "@/lib/launch-testing/platform";
import { AdminHeader, Card, StatusPill } from "@/components/admin/AdminUI";
import { ReviewPanel, REVIEW_LABEL } from "@/components/launch-testing/ReviewPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Launch testing · result", robots: { index: false, follow: false } };

const TONE = { passed: "green", issue: "red", blocked: "amber", in_progress: "blue" } as const;
const WORD = { passed: "Worked", issue: "Something went wrong", blocked: "Couldn't complete", in_progress: "In progress" } as const;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const d = await loadAttemptDetail(id);
  if (!d) notFound();
  const { attempt: a, test, session, tester, history, attachments, platformBySession } = d;
  const name = tester?.display_name || tester?.full_name || tester?.email || "Tester";

  return (
    <>
      <AdminHeader title={test.title} sub={`${name}${tester?.email ? ` · ${tester.email}` : ""}`} />
      <Link href="/admin/launch-testing" className="mb-4 inline-block text-sm font-semibold text-ink-soft hover:underline">← Results</Link>
      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={WORD[a.status]} tone={TONE[a.status]} />
            {a.review_state && <StatusPill label={`Issue: ${REVIEW_LABEL[a.review_state]}`} tone="purple" />}
            {a.retest_requested && <StatusPill label="Re-check requested" tone="blue" />}
            {test.money_test_type !== "none" && <StatusPill label={`Real money · ${test.money_test_type}`} tone="red" />}
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-ink-muted">Platform: </dt><dd className="inline font-semibold text-ink">{session ? PLATFORM_LABEL[session.platform] : "—"}</dd></div>
            <div><dt className="inline text-ink-muted">{session?.platform === "web" ? "Site: " : "Device: "}</dt><dd className="inline text-ink">{session?.platform === "web"
              ? [LIVE_WEBSITE_LABEL, describeWebContext({ browser: session.browser, device_class: session.device_class, viewport: session.viewport })].filter(Boolean).join(" · ")
              : [session?.app_build, session?.device_model].filter(Boolean).join(" · ") || "—"}</dd></div>
            <div><dt className="inline text-ink-muted">Started: </dt><dd className="inline text-ink">{fmt(a.started_at)}</dd></div>
            <div><dt className="inline text-ink-muted">Finished: </dt><dd className="inline text-ink">{fmt(a.completed_at)}</dd></div>
            <div><dt className="inline text-ink-muted">Real-money acknowledged: </dt><dd className="inline text-ink">{a.money_acknowledged_at ? fmt(a.money_acknowledged_at) : "n/a"}</dd></div>
          </dl>
          {a.issue_description && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-widest text-ink-muted">{a.status === "blocked" ? "What stopped them" : "What happened"}</p><p className="mt-1 whitespace-pre-wrap text-ink">{a.issue_description}</p></div>}
          {a.tester_note && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Their note</p><p className="mt-1 whitespace-pre-wrap text-ink">{a.tester_note}</p></div>}
          {attachments.filter((x) => x.attempt_id === a.id).length > 0 && (
            <div className="mt-4"><p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Screenshots</p>
              <div className="mt-2 flex flex-wrap gap-3">{attachments.filter((x) => x.attempt_id === a.id).map((x) => x.url && (
                <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer" className="block"><img src={x.url} alt="Tester's screenshot" className="h-40 rounded-lg border border-line object-contain" /></a>))}</div>
              <p className="mt-1 text-xs text-ink-muted">Private links that expire after an hour.</p></div>
          )}
        </Card>

        <ReviewPanel attemptId={a.id} status={a.status} state={a.review_state} note={a.admin_note} />

        <Card>
          <h2 className="font-display text-lg font-bold text-ink">History for this tester on this test (all platforms, each labelled)</h2>
          <ol className="mt-3 space-y-2">
            {history.map((h) => (
              <li key={h.id} className={"rounded-lg border p-3 text-sm " + (h.id === a.id ? "border-navy bg-sand/50" : "border-line")}>
                <div className="flex flex-wrap items-center gap-2"><StatusPill label={WORD[h.status]} tone={TONE[h.status]} />{platformBySession[h.session_id] && <span className="rounded-pill bg-sand px-2 py-0.5 text-xs font-bold text-ink">{PLATFORM_LABEL[platformBySession[h.session_id]]}</span>}<span className="text-ink-muted">{fmt(h.completed_at ?? h.started_at)}</span>
                  {h.id !== a.id && <Link href={`/admin/launch-testing/attempts/${h.id}`} className="font-semibold text-teal-dark underline">Open</Link>}
                  {h.retest_of && <span className="text-xs text-ink-muted">re-check</span>}</div>
                {(h.issue_description || h.tester_note) && <p className="mt-1 whitespace-pre-wrap text-ink-soft">{h.issue_description || h.tester_note}</p>}
                {h.admin_note && <p className="mt-1 text-xs text-violet-700">You noted: {h.admin_note}</p>}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
