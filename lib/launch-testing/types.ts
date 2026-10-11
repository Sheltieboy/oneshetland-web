/** Shapes shared by the Launch Test Centre (tester and admin sides). Mirrors migration 20261125000000_launch_test_centre. */
export type Platform = "ios" | "android";
export type MoneyType = "none" | "wallet" | "real_card" | "donation";
export type AttemptStatus = "in_progress" | "passed" | "issue" | "blocked";
export type ReviewState = "open" | "reviewed" | "fix_pending" | "ready_for_retest" | "resolved";
export type Priority = "critical" | "high" | "normal";

export interface Programme {
  id: string; slug: string; name: string; description: string | null;
  status: "draft" | "active" | "completed";
  expected_ios_build: string | null; expected_android_version: string | null;
}

export interface LaunchTest {
  id: string; programme_id: string; slug: string; category: string; title: string; purpose: string;
  steps: string[]; expected_outcome: string; priority: Priority; mandatory: boolean;
  platform: "all" | Platform; sort_order: number; active: boolean;
  target_url: string | null; target_note: string | null;
  money_test_type: MoneyType; expected_max_spend_pence: number | null; help_text: string | null;
  effort_minutes: number | null;
}

export interface Session {
  id: string; programme_id: string; user_id: string; platform: Platform;
  app_build: string | null; device_model: string | null; started_at: string; completed_at: string | null;
}

export interface Attempt {
  id: string; programme_id: string; test_id: string; session_id: string; user_id: string;
  status: AttemptStatus; started_at: string; completed_at: string | null;
  tester_note: string | null; issue_description: string | null; money_acknowledged_at: string | null;
  retest_of: string | null; review_state: ReviewState | null; admin_note: string | null;
  reviewed_at: string | null; retest_requested: boolean; retest_requested_at: string | null; created_at: string;
}

export interface Attachment { id: string; attempt_id: string; storage_path: string; mime_type: string; size_bytes: number; created_at: string }

/** An administrator's view of one tester (the email comes from a function only administrators can run). */
export interface AdminTester {
  tester_id: string; user_id: string; enabled: boolean; platforms: Platform[]; admin_notes: string | null;
  created_at: string; email: string | null; full_name: string | null; display_name: string | null;
}

/** The latest attempt for one test × tester × phone type (launch_test_admin_latest). */
export interface LatestAttempt {
  attempt_id: string; test_id: string; user_id: string; platform: Platform; app_build: string | null;
  status: AttemptStatus; review_state: ReviewState | null; retest_requested: boolean;
  started_at: string; completed_at: string | null; attempts_total: number;
}
