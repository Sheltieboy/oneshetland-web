import Link from "next/link";
import { moneyWarning } from "@/lib/launch-testing/money";
import type { Progress } from "@/lib/launch-testing/readiness";
import type { LaunchTest, Platform, Programme } from "@/lib/launch-testing/types";
import { SessionPicker } from "./SessionPicker";

const PLATFORM_LABEL: Record<Platform, string> = { ios: "iPhone", android: "Android" };
type Row = LaunchTest & { status: "not_started" | "in_progress" | "passed" | "issue" | "blocked"; retest: boolean };

/** The tester's landing page, as pure presentation (the page loads the data, this draws it). */
export function TesterHomeView({ programme, firstName, allowed, sessions, session, tests, progress }: {
  programme: Pick<Programme, "id" | "name" | "expected_ios_build" | "expected_android_version">; firstName: string; allowed: Platform[];
  sessions: Array<{ platform: Platform; build: string | null; device: string | null }>;
  session: { platform: Platform; build: string | null } | null; tests: Row[]; progress: Progress;
}) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">{programme.name}</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">OneShetland Launch Test Centre</h1>
        <p className="mt-3 text-ink-soft">
          Hello {firstName}. You&apos;ve been invited to help us double-check the important parts of OneShetland before launch. These are real journeys in the live app.
          Follow each short test, then come back here and tell us whether it worked.
        </p>
      </header>

      <SessionPicker
        programmeId={programme.id}
        allowed={allowed}
        expectedIos={programme.expected_ios_build}
        expectedAndroid={programme.expected_android_version}
        sessions={sessions}
        current={session?.platform ?? null}
      />

      {session && (
        <>
          <section aria-label="Your progress" className="rounded-card border border-line bg-paper p-4 shadow-soft">
            <p className="font-display text-2xl font-bold text-ink">
              {progress.completed} of {progress.total} <span className="text-base font-semibold text-ink-muted">tests done</span>
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-pill bg-sand" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}>
              <div className="h-full rounded-pill bg-emerald-500" style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-emerald-50 py-2"><dt className="text-xs text-emerald-800">Passed</dt><dd className="font-bold text-emerald-800">{progress.passed}</dd></div>
              <div className="rounded-lg bg-rose-50 py-2"><dt className="text-xs text-rose-800">Issues</dt><dd className="font-bold text-rose-800">{progress.issues}</dd></div>
              <div className="rounded-lg bg-amber-50 py-2"><dt className="text-xs text-amber-800">Blocked</dt><dd className="font-bold text-amber-800">{progress.blocked}</dd></div>
            </dl>
            {progress.recheck > 0 && <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800">We&apos;ve asked you to re-check {progress.recheck} test{progress.recheck === 1 ? "" : "s"} below.</p>}
            <p className="mt-3 text-xs text-ink-muted">Testing on {PLATFORM_LABEL[session.platform]}{session.build ? ` · ${session.build}` : ""}</p>
          </section>

          <ol className="space-y-3">
            {tests.map((t, i) => {
              const status = t.status;
              const warn = moneyWarning(t);
              const badge = {
                not_started: { text: "Not started", cls: "bg-sand text-ink-muted" },
                in_progress: { text: "In progress", cls: "bg-blue-100 text-blue-800" },
                passed: { text: "✓ Worked", cls: "bg-emerald-100 text-emerald-800" },
                issue: { text: "! Something went wrong", cls: "bg-rose-100 text-rose-800" },
                blocked: { text: "? Couldn't complete", cls: "bg-amber-100 text-amber-800" },
              }[status];
              return (
                <li key={t.id}>
                  <Link href={`/launch-testing/${t.slug}?p=${session.platform}`} className="block rounded-card border border-line bg-paper p-4 shadow-soft transition hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white" aria-hidden>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t.category}{t.mandatory ? " · Needed" : " · Optional"}{t.effort_minutes ? ` · about ${t.effort_minutes} min` : ""}</p>
                        <p className="mt-0.5 font-display text-lg font-bold leading-snug text-ink">{t.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={"rounded-pill px-2.5 py-0.5 text-xs font-bold " + badge.cls}>{badge.text}</span>
                          {t.retest && <span className="rounded-pill bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800">Please re-check this one</span>}
                          {warn && <span className="rounded-pill bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">REAL MONEY</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <p className="text-center text-xs text-ink-faint">This page is private to the people we&apos;ve invited. Thank you for helping.</p>
    </div>
  );
}
