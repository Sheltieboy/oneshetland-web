/** account-data.server.ts — server reads for the Profile area. SERVER-ONLY. */

import { createClient as createServerClient } from "@/lib/supabase/server";

export interface NotificationPrefs {
  enabled: boolean; bookings_enabled: boolean; shifts_enabled: boolean; fetch_enabled: boolean;
  loyalty_enabled: boolean; offers_enabled: boolean; spik_enabled: boolean; games_enabled: boolean;
  jobs_enabled: boolean; events_enabled: boolean; cruise_enabled: boolean; wallet_enabled: boolean;
  hubs_enabled: boolean; community_enabled: boolean; notices_enabled: boolean; business_enabled: boolean;
  quiet_hours_start: string | null; quiet_hours_end: string | null;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true, bookings_enabled: true, shifts_enabled: true, fetch_enabled: true,
  loyalty_enabled: true, offers_enabled: true, spik_enabled: true, games_enabled: true,
  jobs_enabled: true, events_enabled: true, cruise_enabled: false, wallet_enabled: true,
  hubs_enabled: true, community_enabled: true, notices_enabled: true, business_enabled: true,
  quiet_hours_start: null, quiet_hours_end: null,
};

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  try {
    const sb = await createServerClient();
    const { data } = await sb.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();
    return data ? { ...DEFAULT_PREFS, ...data } : { ...DEFAULT_PREFS };
  } catch { return { ...DEFAULT_PREFS }; }
}

export async function isBusinessOwner(userId: string): Promise<boolean> {
  try {
    const sb = await createServerClient();
    const { count } = await sb.from("local_businesses").select("id", { count: "exact", head: true }).eq("owner_id", userId);
    return (count ?? 0) > 0;
  } catch { return false; }
}

export async function getMyBusinessesBasic(userId: string): Promise<{ id: string; name: string; slug: string | null; logo_url: string | null }[]> {
  try {
    const sb = await createServerClient();
    const { data } = await sb.from("local_businesses").select("id, name, slug, logo_url").eq("owner_id", userId).eq("is_active", true).order("name");
    return (data ?? []) as { id: string; name: string; slug: string | null; logo_url: string | null }[];
  } catch { return []; }
}
