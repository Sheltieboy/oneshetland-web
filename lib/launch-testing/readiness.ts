/**
 * readiness.ts — what each tester's result means, and whether OneShetland looks ready to launch.
 *
 * Pure, so tests can run it under plain node. The database records facts (the latest attempt per test × tester × phone type); the rules
 * live here, in one place:
 *
 *   cell        ✓ passed · ! issue (unresolved) · ? blocked · ◐ in progress · ○ not started · ↻ re-check needed · – not applicable
 *   gate        NOT READY   a mandatory cell holds an unresolved issue
 *               INCOMPLETE  no mandatory issue, but a mandatory cell is not yet a pass (untested, in progress, blocked, or an issue marked
 *                           resolved that has not been re-checked), or there is nothing to judge yet
 *               READY       every applicable mandatory cell has passed and none holds an unresolved issue
 *
 * The gate is ADVISORY. Nothing here can stop a store release.
 */
import type { AttemptStatus, LatestAttempt, Platform } from "./types.ts";

export type CellState = "not_started" | "in_progress" | "passed" | "issue" | "blocked" | "recheck" | "na";
export type Gate = "ready" | "incomplete" | "not_ready";

export interface TestInfo { id: string; mandatory: boolean; active: boolean; platform: "all" | Platform }
export interface TesterInfo { user_id: string; enabled: boolean; platforms: Platform[]; sessionPlatforms: Platform[] }

/** Worst first. A cell shows the worst thing that is true across the phone types the tester is meant to cover. */
const SEVERITY: CellState[] = ["issue", "blocked", "recheck", "in_progress", "not_started", "passed"];

export function stateOfAttempt(a: Pick<LatestAttempt, "status" | "review_state">): CellState {
  switch (a.status) {
    case "passed": return "passed";
    case "in_progress": return "in_progress";
    case "blocked": return "blocked";
    case "issue": return a.review_state === "resolved" ? "recheck" : "issue";
  }
}

/** The phone types a tester is expected to cover for a test. null = the test does not apply to this tester at all. */
export function requiredPlatforms(tester: TesterInfo, test: TestInfo): Array<Platform | "any"> | null {
  const base: Platform[] = tester.platforms.length ? tester.platforms : tester.sessionPlatforms;
  if (!base.length) return [test.platform === "all" ? "any" : test.platform];       // nothing chosen or started yet
  const applicable = base.filter((p) => test.platform === "all" || test.platform === p);
  return applicable.length ? applicable : null;
}

export function cellState(tester: TesterInfo, test: TestInfo, latest: LatestAttempt[]): CellState {
  const req = requiredPlatforms(tester, test);
  if (!req) return "na";
  const mine = latest.filter((l) => l.test_id === test.id && l.user_id === tester.user_id);
  const states: CellState[] = req.map((p) => {
    const rows = p === "any" ? mine : mine.filter((l) => l.platform === p);
    if (!rows.length) return "not_started";
    return worst(rows.map(stateOfAttempt));
  });
  return worst(states);
}

function worst(states: CellState[]): CellState {
  for (const s of SEVERITY) if (states.includes(s)) return s;
  return "not_started";
}

export interface Matrix {
  tests: TestInfo[]; testers: TesterInfo[];
  cells: Record<string, Record<string, CellState>>;      // cells[testId][userId]
}

/** Active tests × enabled testers. Disabled testers and inactive tests take no part in the judgement. */
export function buildMatrix(tests: TestInfo[], testers: TesterInfo[], latest: LatestAttempt[]): Matrix {
  const ts = tests.filter((t) => t.active); const us = testers.filter((u) => u.enabled);
  const cells: Matrix["cells"] = {};
  for (const t of ts) { cells[t.id] = {}; for (const u of us) cells[t.id][u.user_id] = cellState(u, t, latest); }
  return { tests: ts, testers: us, cells };
}

export interface Summary {
  testers: number; mandatoryTests: number; applicable: number; passed: number; openIssues: number; blocked: number; inProgress: number; notStarted: number; recheck: number;
  gate: Gate; gateReason: string;
}

export function summarise(m: Matrix): Summary {
  let applicable = 0, passed = 0, openIssues = 0, blocked = 0, inProgress = 0, notStarted = 0, recheck = 0;
  let mandIssue = 0, mandNotPassed = 0, mandApplicable = 0;
  for (const t of m.tests) for (const u of m.testers) {
    const s = m.cells[t.id][u.user_id];
    if (s === "na") continue;
    applicable++;
    if (s === "passed") passed++; else if (s === "issue") openIssues++; else if (s === "blocked") blocked++;
    else if (s === "in_progress") inProgress++; else if (s === "recheck") recheck++; else notStarted++;
    if (t.mandatory) {
      mandApplicable++;
      if (s === "issue") mandIssue++;
      if (s !== "passed") mandNotPassed++;
    }
  }
  const mandatoryTests = m.tests.filter((t) => t.mandatory).length;
  let gate: Gate; let gateReason: string;
  if (mandIssue > 0) { gate = "not_ready"; gateReason = `${mandIssue} mandatory result${mandIssue === 1 ? "" : "s"} still ${mandIssue === 1 ? "has" : "have"} an unresolved issue.`; }
  else if (m.testers.length === 0) { gate = "incomplete"; gateReason = "No testers are enabled yet."; }
  else if (mandatoryTests === 0 || mandApplicable === 0) { gate = "incomplete"; gateReason = "There are no mandatory tests to judge yet."; }
  else if (mandNotPassed > 0) { gate = "incomplete"; gateReason = `${mandNotPassed} mandatory result${mandNotPassed === 1 ? " is" : "s are"} not yet a pass.`; }
  else { gate = "ready"; gateReason = "Every mandatory test has passed for every tester and no issue is open."; }
  return { testers: m.testers.length, mandatoryTests, applicable, passed, openIssues, blocked, inProgress, notStarted, recheck, gate, gateReason };
}

// ── the tester's own view ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type MyStatus = "not_started" | "in_progress" | "passed" | "issue" | "blocked";
export interface MyAttempt { test_id: string; status: AttemptStatus; retest_requested: boolean; created_at: string }

/** The newest attempt for each test (the tester's current standing on it). */
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
