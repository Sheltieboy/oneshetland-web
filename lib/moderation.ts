/**
 * moderation.ts — browser helpers for the app-store-required UGC safety
 * features: reporting objectionable content and blocking abusive users.
 *
 * Mirrors the mobile app's lib/moderation.ts so the existing content_reports /
 * blocked_users tables, RLS, and the /admin/reports queue all work unchanged.
 *
 * Tables: content_reports, blocked_users.
 */
import { createClient } from "@/lib/supabase/client";

export type ReportContentType =
  | "memory"
  | "memory_comment"
  | "memory_pin"
  | "vessel_comment"
  | "notice"
  | "profile"
  | "job"
  | "shift"
  | "hub_campaign"
  | "other";

export const REPORT_REASONS: { key: string; label: string }[] = [
  { key: "spam", label: "Spam or misleading" },
  { key: "harassment", label: "Harassment or bullying" },
  { key: "hate", label: "Hate speech or discrimination" },
  { key: "sexual", label: "Sexual or explicit content" },
  { key: "violence", label: "Violence or threats" },
  { key: "self_harm", label: "Self-harm" },
  { key: "illegal", label: "Illegal or dangerous" },
  { key: "other", label: "Something else" },
];

export interface ReportInput {
  contentType: ReportContentType;
  contentId: string;
  reportedUserId?: string | null; // the author, when known
  reason: string;
  details?: string | null;
}

/** File a report against a piece of content. Reporter = current user. */
export async function reportContent(input: ReportInput): Promise<void> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Please sign in to report content.");
  const { error } = await sb.from("content_reports").insert({
    reporter_id: user.id,
    content_type: input.contentType,
    content_id: input.contentId,
    reported_user_id: input.reportedUserId ?? null,
    reason: input.reason,
    details: input.details?.trim() || null,
  });
  if (error) throw error;
}

/** Block a user. Their content is hidden from you across OneShetland. */
export async function blockUser(blockedId: string): Promise<void> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Please sign in to block a user.");
  if (user.id === blockedId) throw new Error("You can't block yourself.");
  const { error } = await sb
    .from("blocked_users")
    .upsert({ blocker_id: user.id, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
  if (error) throw error;
}
