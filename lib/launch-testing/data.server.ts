/**
 * data.server.ts — reads for the Launch Test Centre, always through the SIGNED-IN person's own Supabase session.
 *
 * There is no service-role client anywhere in this feature. What a person can see is decided by row-level security in the database (a tester
 * gets only their own rows, an administrator gets everything), so even a bug in this file cannot widen it. If the tables are not there yet
 * (the web is deployed before the migration), every loader answers "nothing" — the pages then show the ordinary not-found page.
 */
import { createClient } from "@/lib/supabase/server";
import { getAccount, accountName, type Account } from "@/lib/auth";
import { adminAccessFor } from "@/lib/admin-access";
import { launchAccessFor, type LaunchAccess } from "./access";
import { latestPerTest, buildMatrix, summarise, progressByPlatform, type Matrix, type Readiness, type PlatformProgress, type Progress } from "./readiness";
import { appliesTo, platformsFor } from "./platform";
import type { AdminTester, Attachment, Attempt, LatestAttempt, LaunchTest, Platform, Programme, Session } from "./types";

export const EVIDENCE_BUCKET = "launch-test-evidence";

const PROGRAMME_COLS = "id, slug, name, description, status, expected_ios_build, expected_android_version";
const TEST_COLS = "id, programme_id, slug, category, title, purpose, steps, web_steps, expected_outcome, priority, mandatory, platform, sort_order, active, target_url, target_note, money_test_type, expected_max_spend_pence, help_text, effort_minutes";
const SESSION_COLS = "id, programme_id, user_id, platform, app_build, device_model, browser, device_class, viewport, started_at, completed_at";
const ATTEMPT_COLS = "id, programme_id, test_id, session_id, user_id, status, started_at, completed_at, tester_note, issue_description, money_acknowledged_at, retest_of, review_state, admin_note, reviewed_at, retest_requested, retest_requested_at, created_at";

export type TesterContext =
  | { access: "sign_in" | "not_found" | "admin_only" }
  | { access: "tester"; account: Account; name: string; programme: Programme; platforms: Platform[] };

function logFail(label: string, e: unknown) { console.error(`[launch-testing] ${label} failed:`, e instanceof Error ? e.message : e); }

/** Decides, from the session and the database, whether this person belongs here. */
export async function resolveTesterContext(): Promise<TesterContext> {
  const account = await getAccount();
  const isAdmin = adminAccessFor(account) === "allow";
  if (!account) return { access: "sign_in" };
  let programme: Programme | null = null; let platforms: Platform[] = [];
  try {
    const sb = await createClient();
    const { data: rows, error } = await sb.from("launch_testers").select("programme_id, platforms").eq("user_id", account.id).eq("enabled", true);
    if (error) throw error;
    if (rows?.length) {
      const { data: progs, error: pe } = await sb.from("launch_test_programmes").select(PROGRAMME_COLS).in("id", rows.map((r) => r.programme_id as string)).neq("status", "draft");
      if (pe) throw pe;
      const list = (progs ?? []) as Programme[];
      programme = list.find((p) => p.status === "active") ?? list[0] ?? null;
      if (programme) platforms = ((rows.find((r) => r.programme_id === programme!.id)?.platforms ?? []) as Platform[]);
    }
  } catch (e) { logFail("resolveTesterContext", e); }
  const access: LaunchAccess = launchAccessFor({ signedIn: true, isAdmin, isEnabledTester: !!programme });
  if (access === "tester" && programme) return { access, account, name: accountName(account), programme, platforms };
  return { access: access === "tester" ? "not_found" : (access as "admin_only" | "not_found") };
}

export interface TesterHome {
  sessions: Session[]; session: Session | null; platform: Platform | null; tests: LaunchTest[]; attempts: Attempt[];
  byPlatform: PlatformProgress[]; overall: Progress; allowed: Platform[];
}

/**
 * Everything the landing page needs. `assigned` is the administrator's list (empty = all three). A platform the tester is not assigned to is
 * never selected, whatever the URL says; and each platform reads only its own session's attempts, so results never mix across platforms.
 */
export async function loadTesterHome(programme: Programme, wanted: Platform | null, assigned: Platform[]): Promise<TesterHome> {
  const sb = await createClient();
  const [s, t, a] = await Promise.all([
    sb.from("launch_test_sessions").select(SESSION_COLS).eq("programme_id", programme.id).order("updated_at", { ascending: false }),
    sb.from("launch_tests").select(TEST_COLS).eq("programme_id", programme.id).eq("active", true).order("sort_order"),
    sb.from("launch_test_attempts").select(ATTEMPT_COLS).eq("programme_id", programme.id).order("created_at", { ascending: false }),
  ]);
  for (const r of [s, t, a]) if (r.error) logFail("loadTesterHome", r.error);
  const allowed = platformsFor(assigned);
  const sessions = ((s.data ?? []) as Session[]).filter((x) => allowed.includes(x.platform));
  const allTests = (t.data ?? []) as LaunchTest[];
  const attempts = (a.data ?? []) as Attempt[];
  const platform = wanted && allowed.includes(wanted) ? wanted : allowed.length === 1 ? allowed[0] : null;
  const session = platform ? sessions.find((x) => x.platform === platform) ?? null : null;
  const tests = platform ? allTests.filter((x) => appliesTo(x, platform)) : [];
  const { platforms: byPlatform, overall } = progressByPlatform(allowed, allTests, sessions, attempts);
  return { sessions, session, platform, tests, attempts, byPlatform, overall, allowed };
}

export interface TestPage {
  test: LaunchTest; session: Session; attempts: Attempt[]; current: Attempt | null; previous: Attempt | null;
  attachments: Array<Attachment & { url: string | null }>; number: number;
}

export async function loadTestPage(programme: Programme, slug: string, wanted: Platform | null, assigned: Platform[]): Promise<TestPage | null> {
  const sb = await createClient();
  const { data: sess, error: se } = await sb.from("launch_test_sessions").select(SESSION_COLS).eq("programme_id", programme.id).order("updated_at", { ascending: false });
  if (se) { logFail("loadTestPage sessions", se); return null; }
  const allowed = platformsFor(assigned);
  const sessions = ((sess ?? []) as Session[]).filter((x) => allowed.includes(x.platform));
  const platform = wanted && allowed.includes(wanted) ? wanted : allowed.length === 1 ? allowed[0] : null;
  const session = platform ? sessions.find((x) => x.platform === platform) : undefined;
  if (!session) return null;
  const { data: tests, error: te } = await sb.from("launch_tests").select(TEST_COLS).eq("programme_id", programme.id).eq("active", true).order("sort_order");
  if (te) { logFail("loadTestPage tests", te); return null; }
  const list = (tests ?? []) as LaunchTest[];
  const test = list.find((t) => t.slug === slug);
  if (!test || !appliesTo(test, session.platform)) return null;
  const { data: att, error: ae } = await sb.from("launch_test_attempts").select(ATTEMPT_COLS).eq("test_id", test.id).eq("session_id", session.id).order("created_at", { ascending: false });
  if (ae) { logFail("loadTestPage attempts", ae); return null; }
  const attempts = (att ?? []) as Attempt[];
  const current = attempts.find((a) => a.status === "in_progress") ?? null;
  const previous = attempts.find((a) => a.status !== "in_progress") ?? null;
  const shown = current ?? previous;
  const attachments = shown ? await attachmentsFor(sb, [shown.id]) : [];
  const applicable = list.filter((t) => appliesTo(t, session.platform));
  return { test, session, attempts, current, previous, attachments, number: applicable.findIndex((t) => t.id === test.id) + 1 };
}

async function attachmentsFor(sb: Awaited<ReturnType<typeof createClient>>, attemptIds: string[]): Promise<Array<Attachment & { url: string | null }>> {
  if (!attemptIds.length) return [];
  const { data, error } = await sb.from("launch_test_attachments").select("id, attempt_id, storage_path, mime_type, size_bytes, created_at").in("attempt_id", attemptIds).order("created_at");
  if (error) { logFail("attachments", error); return []; }
  const rows = (data ?? []) as Attachment[];
  if (!rows.length) return [];
  const { data: signed } = await sb.storage.from(EVIDENCE_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600);
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ ...r, url: byPath.get(r.storage_path) ?? null }));
}

// ── administrators ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface AdminOverview {
  programmes: Programme[]; programme: Programme | null; tests: LaunchTest[]; testers: AdminTester[]; latest: LatestAttempt[];
  matrix: Matrix | null; readiness: Readiness | null;
}

export async function loadAdminOverview(programmeSlug?: string | null): Promise<AdminOverview> {
  const sb = await createClient();
  const empty: AdminOverview = { programmes: [], programme: null, tests: [], testers: [], latest: [], matrix: null, readiness: null };
  const { data: progs, error } = await sb.from("launch_test_programmes").select(PROGRAMME_COLS).order("created_at", { ascending: false });
  if (error) { logFail("loadAdminOverview", error); return empty; }
  const programmes = (progs ?? []) as Programme[];
  const programme = programmes.find((p) => p.slug === programmeSlug) ?? programmes.find((p) => p.status === "active") ?? programmes[0] ?? null;
  if (!programme) return { ...empty, programmes };
  const [t, tr, la] = await Promise.all([
    sb.from("launch_tests").select(TEST_COLS).eq("programme_id", programme.id).order("sort_order"),
    sb.rpc("launch_test_admin_testers", { p_programme: programme.id }),
    sb.rpc("launch_test_admin_latest", { p_programme: programme.id }),
  ]);
  for (const r of [t, tr, la]) if (r.error) logFail("loadAdminOverview part", r.error);
  const tests = (t.data ?? []) as LaunchTest[];
  const testers = (tr.data ?? []) as AdminTester[];
  const latest = (la.data ?? []) as LatestAttempt[];
  const matrix = buildMatrix(
    tests.map((x) => ({ id: x.id, mandatory: x.mandatory, active: x.active, platform: x.platform })),
    testers.map((x) => ({ user_id: x.user_id, enabled: x.enabled, platforms: x.platforms })),
    latest,
  );
  return { programmes, programme, tests, testers, latest, matrix, readiness: summarise(matrix) };
}

export interface AttemptDetail {
  attempt: Attempt; test: LaunchTest; session: Session | null; tester: AdminTester | null;
  history: Attempt[]; attachments: Array<Attachment & { url: string | null }>;
  platformBySession: Record<string, Platform>;
}

export async function loadAttemptDetail(id: string): Promise<AttemptDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sb = await createClient();
  const { data: a, error } = await sb.from("launch_test_attempts").select(ATTEMPT_COLS).eq("id", id).maybeSingle();
  if (error || !a) { if (error) logFail("loadAttemptDetail", error); return null; }
  const attempt = a as Attempt;
  const [t, s, h, tr, ss] = await Promise.all([
    sb.from("launch_tests").select(TEST_COLS).eq("id", attempt.test_id).maybeSingle(),
    sb.from("launch_test_sessions").select(SESSION_COLS).eq("id", attempt.session_id).maybeSingle(),
    sb.from("launch_test_attempts").select(ATTEMPT_COLS).eq("test_id", attempt.test_id).eq("user_id", attempt.user_id).order("created_at", { ascending: false }),
    sb.rpc("launch_test_admin_testers", { p_programme: attempt.programme_id }),
    sb.from("launch_test_sessions").select("id, platform").eq("user_id", attempt.user_id).eq("programme_id", attempt.programme_id),
  ]);
  if (!t.data) return null;
  const platformBySession = Object.fromEntries(((ss.data ?? []) as Array<{ id: string; platform: Platform }>).map((x) => [x.id, x.platform]));
  const history = (h.data ?? []) as Attempt[];
  const tester = ((tr.data ?? []) as AdminTester[]).find((x) => x.user_id === attempt.user_id) ?? null;
  const attachments = await attachmentsFor(sb, history.map((x) => x.id));
  return { attempt, test: t.data as LaunchTest, session: (s.data ?? null) as Session | null, tester, history, attachments, platformBySession };
}

export { latestPerTest };
