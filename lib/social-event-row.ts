/**
 * social-event-row.ts - the one place /api/social-image reads an event for its "event spotlight" card.
 *
 * A card promotes an event, so only a PUBLISHED, VISIBLE event gets one. A cancelled event is still readable by its link
 * (events_cancelled_public_read, product decision 7 Nov 2026) so its page can say "Cancelled"; this read must not rely on row security
 * alone, or anyone could ask for a "tickets & details" card for it. A draft, postponed, archived or cancelled event answers "not found".
 * Capability-tolerant (lib/events-schema.ts): the same filters apply before and after the Events & Activities migration.
 */
import { selectTolerant } from "@/lib/events-schema";
import type { RunOccurrence } from "@/lib/event-runs";
import { publicClient } from "@/lib/supabase/public";

export type SpotlightRow = Record<string, unknown> & {
  title: string; starts_at: string; venue: string | null; locality: string | null; cover_url: string | null; ends_at?: string | null; id?: string;
  source?: string | null; organiser_name?: string | null; organiser_business_id?: string | null; organiser_hub_id?: string | null; occurrences?: RunOccurrence[] | null;
};

export async function getSpotlightEvent(id: string): Promise<SpotlightRow | null> {
  const sb = publicClient();
  const { data } = await selectTolerant<SpotlightRow>((extra) =>
    sb
      .from("events")
      .select("id, title, starts_at, ends_at, venue, locality, cover_url, price_text, organiser_business_id, organiser_hub_id" + extra)
      .eq("id", id)
      .eq("status", "published")
      .eq("is_hidden", false)
      .maybeSingle(),
  );
  return data ?? null;
}
