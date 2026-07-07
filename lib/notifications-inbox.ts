/**
 * notifications-inbox.ts (web)
 *
 * Browser-side read of notification_log — the shared in-app notification inbox
 * (same table the mobile app reads). Every push the backend sends is logged
 * here, so web users (who have no push) still get a record of what happened.
 *
 * RLS limits reads to the signed-in user's own rows; mark-read + unread-count
 * go through SECURITY DEFINER RPCs.
 */
import { createClient } from "@/lib/supabase/client";

export interface InboxNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  status: string;
  created_at: string;
  read_at: string | null;
}

const VISIBLE_STATUSES = ["sent", "no_token", "skipped_quiet"];

export async function fetchInbox(limit = 50): Promise<InboxNotification[]> {
  const { data, error } = await createClient()
    .from("notification_log")
    .select("id, category, title, body, data, status, created_at, read_at")
    .in("status", VISIBLE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InboxNotification[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { data, error } = await createClient().rpc("unread_notification_count");
  if (error) return 0;
  return (data as number | null) ?? 0;
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const { error } = await createClient().rpc("mark_notifications_read", {
    p_ids: ids && ids.length ? ids : null,
  });
  if (error) throw error;
}

// `screen` aliases — mirrors the app's SCREEN_ALIASES (lib/notifications.ts),
// mapped to the equivalent web route. Some app-only destinations fall back to
// the nearest web page (e.g. notices → /local; cruise → /cruise).
const SCREEN_ALIASES: Record<string, string> = {
  fetch: "/fetch",
  shifts: "/jobs?tab=shifts",
  jobs: "/jobs",
  spik: "/spik",
  games: "/games",
  "my-shift-applications": "/shifts/applications",
  "my-job-applications": "/jobs/applications",
  "employer-applications": "/shifts/manage",
  "local-my-cards": "/account/loyalty",
  "local-offers": "/local",
  "local-wallet": "/account/wallet",
  "local-my-passes": "/account/passes",
  "local-my-gifts": "/account/gifts",
  "local-my-bookings": "/account/bookings",
  "my-event-tickets": "/account/memberships",
  notices: "/local",
};

/** Map a notification's data payload to a web route (or null if not linkable). */
export function webNotificationRoute(data: Record<string, unknown> | null): string | null {
  if (!data) return null;

  const screen = typeof data.screen === "string" ? data.screen : null;

  // Employer applicants pipeline needs the job id.
  if (screen === "job-applicants" && typeof data.job_id === "string") return `/jobs/${data.job_id}/applicants`;
  if (screen && SCREEN_ALIASES[screen]) return SCREEN_ALIASES[screen];

  // Id-based fallbacks (most specific first) — mirrors the app's order.
  if (typeof data.shift_id === "string") return `/shifts/${data.shift_id}`;
  if (typeof data.job_id === "string") return `/jobs/${data.job_id}`;
  if (typeof data.hub_id === "string") return `/hubs/${data.hub_id}`;
  if (typeof data.order_id === "string") return "/account/memberships";
  if (typeof data.event_id === "string") return `/whats-on/${data.event_id}`;
  if (typeof data.request_id === "string") return "/fetch";
  if (typeof data.memory_id === "string") return `/memories/${data.memory_id}`;
  if (typeof data.vessel_id === "string") return `/boats/${data.vessel_id}`;
  if (typeof data.business_id === "string") return `/directory/${data.business_id}`;
  return null;
}

const MODULE_ACCENT: Record<string, string> = {
  fetch: "#E0722A", shifts: "#E8A020", jobs: "#2A8B5C", bookings: "#7C3AED",
  loyalty: "#7C3AED", offers: "#7C3AED", events: "#D4921A", cruise: "#0E7490",
  wallet: "#032F4C", hubs: "#032F4C", community: "#12B3D6", notices: "#B91C1C",
  spik: "#12B3D6", games: "#10B981", business: "#032F4C",
};

/** Accent colour for a notification, keyed on its module (category prefix). */
export function categoryAccent(category: string): string {
  return MODULE_ACCENT[category.split(".")[0]] ?? "#032F4C";
}
