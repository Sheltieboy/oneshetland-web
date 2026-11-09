import { publicClient } from "./supabase/public.ts";
import { resilient } from "./home-resilience.ts";
import { tomorrowWindow, type TomorrowEvent } from "./home-tomorrow.ts";

/** Tomorrow's published events (anonymous read; a failure means none). Kept briefly; the activities come from the homepage listing. */
export async function getTomorrowEvents(now: Date = new Date()): Promise<TomorrowEvent[]> {
  const { startIso, endIso } = tomorrowWindow(now);
  return resilient<TomorrowEvent[]>(`home:tomorrow:${startIso.slice(0, 10)}`, { ttlMs: 120_000, staleMs: 10 * 60_000, deadlineMs: 3000, fallback: [], isEmpty: () => false }, async () => {
    const { data, error } = await publicClient().from("events").select("id, title, starts_at, venue, locality")
      .eq("status", "published").eq("is_hidden", false).or("organiser_hub_id.is.null,calendar_approved.eq.true")
      .gte("starts_at", startIso).lt("starts_at", endIso).order("starts_at", { ascending: true }).order("id", { ascending: true }).limit(8);
    return error ? [] : ((data ?? []) as TomorrowEvent[]);
  });
}
