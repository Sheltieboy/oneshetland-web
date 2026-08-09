"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";
import { findMatches } from "@/lib/trades-data";
import {
  FREE_LEADS_PER_MONTH, hasUnlimitedLeads, isTradeKey,
  type Scale, type TradeKey, type Urgency,
} from "@/lib/trades";

export type BriefInput = {
  title: string;
  description: string;
  trades: string[];
  scale: Scale;
  urgency: Urgency;
  locationText: string;
  lat?: number | null;
  lng?: number | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
};

/**
 * Post a brief, and decide who hears about it.
 *
 * Signed-in only, like every other submission surface — an anonymous brief is
 * a phone number nobody can be held to, and the trades would stop answering
 * within a fortnight.
 *
 * The dispatch is capped at 8. It is tempting to send every brief to every
 * matching trade, and it is the single worst thing this could do: the same few
 * firms would ignore forty a month instead of four, and the person waiting
 * would get silence that felt like a promise. Eight who have room beats
 * thirty who don't.
 */
export async function postBrief(
  input: BriefInput,
): Promise<{ ok: boolean; id?: string; sentTo?: number; error?: string }> {
  const account = await getAccount();
  if (!account) return { ok: false, error: "Please sign in to post a job." };

  const trades = input.trades.filter(isTradeKey) as TradeKey[];
  if (trades.length === 0) return { ok: false, error: "Pick at least one trade." };

  const title = input.title.trim();
  const description = input.description.trim();
  const locationText = input.locationText.trim();
  if (title.length < 3) return { ok: false, error: "Give the job a short title." };
  if (description.length < 10) return { ok: false, error: "Say a bit more about the job." };
  if (locationText.length < 2) return { ok: false, error: "Where is the work?" };

  const phone = input.contactPhone.trim();
  if (phone.length < 6) return { ok: false, error: "A phone number is how a trade gets back to you." };

  const sb = await createClient();

  const { data: brief, error } = await sb
    .from("trade_briefs")
    .insert({
      author_id: account.id,
      title,
      description,
      trades,
      scale: input.scale,
      urgency: input.urgency,
      location_text: locationText,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      contact_name: input.contactName.trim() || null,
      contact_phone: phone,
      contact_email: input.contactEmail?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !brief) return { ok: false, error: error?.message ?? "Couldn't post that." };

  const matches = await findMatches({
    trades,
    urgency: input.urgency,
    scale: input.scale,
    lat: input.lat,
    lng: input.lng,
    limit: 8,
  });

  /*
   * The free tier's cap is applied HERE, at delivery, not in the ranking.
   *
   * A free listing that has had its three this month is skipped and the lead
   * goes to the next trade with room — the person waiting is never made to
   * wait longer because nobody has paid. That ordering is the whole ethic of
   * this: paid buys volume and tools, never a place in the queue.
   */
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const freeIds = matches.filter((m) => !hasUnlimitedLeads(m.tier)).map((m) => m.id);
  const usage: Record<string, number> = {};
  if (freeIds.length > 0) {
    const { data: used } = await sb
      .from("trade_brief_matches")
      .select("business_id")
      .in("business_id", freeIds)
      .gte("created_at", monthStart.toISOString());
    for (const r of (used ?? []) as { business_id: string }[]) {
      usage[r.business_id] = (usage[r.business_id] ?? 0) + 1;
    }
  }

  const deliverable = matches.filter(
    (m) => hasUnlimitedLeads(m.tier) || (usage[m.id] ?? 0) < FREE_LEADS_PER_MONTH,
  );

  if (deliverable.length > 0) {
    await sb.from("trade_brief_matches").insert(
      deliverable.map((m) => ({ brief_id: brief.id, business_id: m.id, status: "sent" })),
    );

    /*
     * Tell them. A tradesperson is up a ladder, not refreshing a dashboard —
     * a lead seen three days later is one somebody else already took, and the
     * person waiting decides OneShetland doesn't work.
     *
     * Deliberately not awaited for its result: the brief is already saved and
     * on screen, and a slow or failing push must never make posting a job feel
     * broken. Failures are logged inside the function.
     */
    void sb.functions.invoke("notify-trade-lead", { body: { brief_id: brief.id } })
      .catch(() => { /* the lead is visible in the app regardless */ });
  }

  revalidatePath("/get-it-done");
  return { ok: true, id: brief.id, sentTo: deliverable.length };
}

/**
 * A trade answers. `interested` is what releases the contact details — which
 * is why the reply happens here and not in a plain update from the client.
 *
 * A decline is a good outcome, not a failure: it frees the person to look
 * elsewhere the same day instead of waiting on a call that was never coming,
 * and the reason feeds the unmet-demand figures.
 */
export async function respondToBrief(
  matchId: string,
  response: "interested" | "declined",
  declineReason?: string,
): Promise<{ ok: boolean; contact?: { name: string | null; phone: string | null; email: string | null }; error?: string }> {
  const account = await getAccount();
  if (!account) return { ok: false, error: "Please sign in." };

  const sb = await createClient();

  // RLS already limits this to the owner's own matches; the select confirms it
  // exists and gives us the brief id to read contact from.
  const { data: match, error: mErr } = await sb
    .from("trade_brief_matches")
    .update({
      status: response,
      decline_reason: response === "declined" ? (declineReason ?? "other") : null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .select("brief_id, status")
    .single();

  if (mErr || !match) return { ok: false, error: mErr?.message ?? "Couldn't record that." };

  revalidatePath("/business/leads");
  if (response !== "interested") return { ok: true };

  const { data: brief } = await sb
    .from("trade_briefs")
    .select("contact_name, contact_phone, contact_email")
    .eq("id", match.brief_id)
    .single();

  return {
    ok: true,
    contact: {
      name: brief?.contact_name ?? null,
      phone: brief?.contact_phone ?? null,
      email: brief?.contact_email ?? null,
    },
  };
}

/**
 * The author closes their brief.
 *
 * `outcome` is asked for and it matters more than it looks: "sorted through
 * OneShetland" against "sorted elsewhere" is the only honest measure of
 * whether any of this is working, and it's worth a little friction to get it.
 */
export async function closeBrief(
  briefId: string,
  outcome: "via_oneshetland" | "elsewhere" | "gave_up" | "no_longer_needed",
): Promise<{ ok: boolean; error?: string }> {
  const account = await getAccount();
  if (!account) return { ok: false, error: "Please sign in." };

  const sb = await createClient();
  const { error } = await sb
    .from("trade_briefs")
    .update({ status: outcome === "gave_up" ? "withdrawn" : "sorted", outcome, updated_at: new Date().toISOString() })
    .eq("id", briefId)
    .eq("author_id", account.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/get-it-done");
  return { ok: true };
}

/**
 * A trade says what it does and whether it has room.
 *
 * Stamps `trade_availability_set_at` on every save, because that timestamp is
 * what stops a March answer being believed in June.
 */
export async function saveTradeProfile(
  businessId: string,
  input: { trades: string[]; availability: string | null; minJobPence: number | null; credentials: string[] },
): Promise<{ ok: boolean; error?: string }> {
  const account = await getAccount();
  if (!account) return { ok: false, error: "Please sign in." };

  const sb = await createClient();
  const { error } = await sb
    .from("local_businesses")
    .update({
      trade_categories: input.trades.filter(isTradeKey),
      trade_availability: input.availability,
      trade_availability_set_at: input.availability ? new Date().toISOString() : null,
      trade_min_job_pence: input.minJobPence,
      trade_credentials: input.credentials,
    })
    .eq("id", businessId)
    .eq("owner_id", account.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/business/leads");
  return { ok: true };
}
