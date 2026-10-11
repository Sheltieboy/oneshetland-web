/**
 * readiness.ts — what each tester's result means, and whether OneShetland looks ready to launch ON EACH PLATFORM.
 *
 * Pure, so tests can run it under plain node. The database records facts (the latest attempt per test × tester × platform); the rules live
 * here, in one place:
 *
 *   cell        ✓ passed · ! issue (unresolved) · ? blocked · ◐ in progress · ○ not started · ↻ re-check needed · – not applicable
 *   platform    a cell is (test × tester × PLATFORM). A pass on one platform never fills a cell on another.
 *   gate        NOT READY   a mandatory cell holds an unresolved issue
 *               INCOMPLETE  no mandatory issue, but a mandatory cell is not yet a pass (untested, in progress, blocked, or an issue marked
 *                           resolved that has not been re-checked), or a platform has no tester assigned, or there is nothing to judge yet
 *               READY       every applicable mandatory cell has passed and none holds an unresolved issue
 *   overall     OneShetland is READY only when EVERY launch platform (web, ios, android) is READY. One platform's pass can never make it READY.
 *
 * The gate is ADVISORY. Nothing here can stop a deployment or a store release.
 */
import type { AttemptStatus, LatestAttempt, Platform } from "./types.ts";
import { PLATFORMS, PLATFORM_LABEL, appliesTo, platformsFor } from "./platform.ts";

export type CellState = "not_started" | "in_progress" | "passed" | "issue" | "blocked" | "recheck" | "na";
export type Gate = "ready" | "incomplete" | "not_ready";

export interface TestInfo { id: string; mandatory: boolean; active: boolean; platform: "all" | Platform }
/** `platforms`: what the administrator assigned (empty = every platform). */
export interface TesterInfo { user_id: string; enabled: boolean; platforms: Platform[] }

export function stateOfAttempt(a: Pick<LatestAttempt, "status" | "review_state">): CellState {
  switch (a.status) {
    case "passed": return "passed";
    case "in_progress": return "in_progress";
    case "blocked": return "blocked";
    case "issue": return a.review_state === "resolved" ? "recheck" : "issue";
  }
}

/** Does this test apply to this tester on this platform? */
export const applies = (tester: TesterInfo, test: TestInfo, platform: Platform) => platformsFor(tester.platforms).includes(platform) && appliesTo(test, platform);

export function cellState(tester: TesterInfo, test: TestInfo, platform: Platform, latest: LatestAttempt[]): CellState {
  if (!applies(tester, test, platform)) return "na";
  const rows = latest.filter((l) => l.test_id === test.id && l.user_id === tester.user_id && l.platform === platform);
  if (!rows.length) return "not_started";
  const states = rows.map(stateOfAttempt);
  for (const s of ["issue", "blocked", "recheck", "in_progress", "not_started", "passed"] as CellState[]) if (states.includes(s)) return s;
  return "not_started";
}

export interface Matrix {
  tests: TestInfo[]; testers: TesterInfo[];
  cells: Record<Platform, Record<string, Record<string, CellState>>>;      // cells[platform][testId][userId]
}

/** Active tests × enabled testers × platforms. Disabled testers and inactive tests take no part in the judgement. */
export function buildMatrix(tests: TestInfo[], testers: TesterInfo[], latest: LatestAttempt[]): Matrix {
  const ts = tests.filter((t) => t.active); const us = testers.filter((u) => u.enabled);
  const cells = { web: {}, ios: {}, android: {} } as Matrix["cells"];
  for (const p of PLATFORMS) for (const t of ts) { cells[p][t.id] = {}; for (const u of us) cells[p][t.id][u.user_id] = cellState(u, t, p, latest); }
  return { tests: ts, testers: us, cells };
}

export interface Summary {
  platform: Platform | "overall";
  testers: number;            // enabled testers assigned to this platform (overall: distinct enabled testers)
  mandatoryTests: number;     // mandatory tests that apply to the platform (overall: summed across platforms)
  /** Mandatory checks = mandatory test × assigned tester on this platform. Only mandatory checks count towards the gate and these figures. */
  checks: number; passed: number; openIssues: number; blocked: number;
  incomplete: number;         // not started, in progress, or an issue marked resolved but not yet re-checked
  gate: Gate; gateReason: string;
}

/** One platform's judgement. */
export function summarisePlatform(m: Matrix, platform: Platform): Summary {
  const assigned = m.testers.filter((u) => platformsFor(u.platforms).includes(platform));
  let checks = 0, passed = 0, openIssues = 0, blocked = 0, incomplete = 0;
  for (const t of m.tests) {
    if (!t.mandatory) continue;
    for (const u of assigned) {
      const s = m.cells[platform][t.id][u.user_id];
      if (s === "na") continue;
      checks++;
      if (s === "passed") passed++; else if (s === "issue") openIssues++; else if (s === "blocked") blocked++; else incomplete++;
    }
  }
  const mandatoryTests = m.tests.filter((t) => t.mandatory && appliesTo(t, platform)).length;
  const name = PLATFORM_LABEL[platform];
  const notPassed = checks - passed;
  let gate: Gate; let gateReason: string;
  if (openIssues > 0) { gate = "not_ready"; gateReason = `${openIssues} mandatory ${name} result${openIssues === 1 ? "" : "s"} still ${openIssues === 1 ? "has" : "have"} an unresolved issue.`; }
  else if (assigned.length === 0) { gate = "incomplete"; gateReason = `No tester is assigned to ${name} yet.`; }
  else if (mandatoryTests === 0 || checks === 0) { gate = "incomplete"; gateReason = `There are no mandatory ${name} tests to judge yet.`; }
  else if (notPassed > 0) { gate = "incomplete"; gateReason = `${notPassed} mandatory ${name} result${notPassed === 1 ? " is" : "s are"} not yet a pass.`; }
  else { gate = "ready"; gateReason = `Every mandatory ${name} test has passed for every ${name} tester and no issue is open.`; }
  return { platform, testers: assigned.length, mandatoryTests, checks, passed, openIssues, blocked, incomplete, gate, gateReason };
}

export interface Readiness { overall: Summary; platforms: Record<Platform, Summary> }

/** Every platform judged on its own, then the overall state. Overall READY needs all three platforms READY. */
export function summarise(m: Matrix): Readiness {
  const platforms = { web: summarisePlatform(m, "web"), ios: summarisePlatform(m, "ios"), android: summarisePlatform(m, "android") };
  const all = PLATFORMS.map((p) => platforms[p]);
  const sum = (k: "mandatoryTests" | "checks" | "passed" | "openIssues" | "blocked" | "incomplete") => all.reduce((n, s) => n + s[k], 0);
  let gate: Gate; let gateReason: string;
  if (all.some((s) => s.gate === "not_ready")) {
    const bad = PLATFORMS.filter((p) => platforms[p].gate === "not_ready").map((p) => PLATFORM_LABEL[p]);
    gate = "not_ready"; gateReason = `${bad.join(" and ")} ${bad.length === 1 ? "has" : "have"} an unresolved mandatory issue.`;
  } else if (all.some((s) => s.gate === "incomplete")) {
    const inc = PLATFORMS.filter((p) => platforms[p].gate === "incomplete").map((p) => PLATFORM_LABEL[p]);
    gate = "incomplete"; gateReason = `${inc.join(" and ")} ${inc.length === 1 ? "is" : "are"} not finished yet. OneShetland is ready only when Website, iPhone and Android are all ready.`;
  } else { gate = "ready"; gateReason = "Website, iPhone and Android have each passed every mandatory test with no open issue."; }
  return {
    overall: { platform: "overall", testers: m.testers.length, mandatoryTests: sum("mandatoryTests"), checks: sum("checks"), passed: sum("passed"),
      openIssues: sum("openIssues"), blocked: sum("blocked"), incomplete: sum("incomplete"), gate, gateReason },
    platforms,
  };
}

// ── the tester's own view ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type MyStatus = "not_started" | "in_progress" | "passed" | "issue" | "blocked";
export interface MyAttempt { test_id: string; status: AttemptStatus; retest_requested: boolean; created_at: string }

/** The newest attempt for each test (the tester's current standing on it). Callers pass ONE platform's attempts only. */
export function latestPerTest<T extends { test_id: string; created_at: string }>(attempts: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const a of attempts) { const cur = m.get(a.test_id); if (!cur || a.created_at > cur.created_at) m.set(a.test_id, a); }
  return m;
}

export interface Progress { total: number; completed: number; passed: number; issues: number; blocked: number; recheck: number }

export function myProgress(tests: Array<{ id: string }>, latest: Map<string, MyAttempt>): Progress {
  let completed = 0, passed = 0, issues = 0, blocked = 0, recheck = 0;
  for (const t of tests) {
    const a = latest.get(t.id);
    if (!a) continue;
    if (a.retest_requested) recheck++;
    if (a.status === "in_progress") continue;
    completed++;
    if (a.status === "passed") passed++; else if (a.status === "issue") issues++; else if (a.status === "blocked") blocked++;
  }
  return { total: tests.length, completed, passed, issues, blocked, recheck };
}

/** A tester's progress on every platform they are assigned, plus an overall line. `attemptsBySession` is already filtered to the tester. */
export interface PlatformProgress { platform: Platform; progress: Progress; started: boolean }
export function progressByPlatform(
  assigned: readonly Platform[], tests: Array<{ id: string; platform: "all" | Platform; mandatory?: boolean }>,
  sessions: Array<{ id: string; platform: Platform }>, attempts: Array<MyAttempt & { session_id: string }>,
): { platforms: PlatformProgress[]; overall: Progress } {
  const out: PlatformProgress[] = [];
  const overall: Progress = { total: 0, completed: 0, passed: 0, issues: 0, blocked: 0, recheck: 0 };
  for (const p of platformsFor(assigned)) {
    const session = sessions.find((s) => s.platform === p);
    const mine = session ? attempts.filter((a) => a.session_id === session.id) : [];
    const progress = myProgress(tests.filter((t) => appliesTo(t, p)), latestPerTest(mine));
    out.push({ platform: p, progress, started: !!session });
    for (const k of Object.keys(overall) as Array<keyof Progress>) overall[k] += progress[k];
  }
  return { platforms: out, overall };
}
