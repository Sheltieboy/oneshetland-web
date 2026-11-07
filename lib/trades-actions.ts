"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";
import { findMatches } from "@/lib/trades-data";
import { isTradeKey, type Scale, type TradeKey, type Urgency } from "@/lib/trades";

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
): Promise<{ ok: boolean; id?: string; sentTo?: number; deliveryFailed?: boolean; error?: string }> {
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

  // Only the id is read back: the contact columns are not readable by clients.
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

  /*
   * Ranking is decided here (room first, then who answers); whether a match
   * row really exists is decided by the database. `sentTo` is ONLY the length
   * of what the database says it created — never the length of our own list.
   */
  let matches: Awaited<ReturnType<typeof findMatches>> = [];
  try {
    matches = await findMatches({
      trades,
      urgency: input.urgency,
      scale: input.scale,
      lat: input.lat,
      lng: input.lng,
      // More candidates than the cap on purpose: the database drops anyone who is unclaimed, booked up or invalid
      // and keeps the first 8 that remain, in this order. Sending only 8 would let unclaimed listings eat the slots.
      limit: 30,
    });
  } catch { matches = []; }

  let sentTo = 0;
  if (matches.length > 0) {
    const { data: created, error: rpcErr } = await sb.rpc("create_brief_matches", {
      p_brief: brief.id,
      p_business_ids: matches.map((m) => m.id),
    });
    if (rpcErr) {
      // Saved, but nobody was told. Say exactly that; never invent a count.
      revalidatePath("/get-it-done");
      return { ok: true, id: brief.id, sentTo: 0, deliveryFailed: true };
    }
    sentTo = Array.isArray(created) ? created.length : 0;
  }

  if (sentTo > 0) {
    /*
     * Tell them. Deliberately not awaited for its result: the brief is already
     * saved, and a slow or failing push must never make posting feel broken.
     */
    void Promise.resolve(sb.functions.invoke("notify-trade-lead", { body: { brief_id: brief.id } }))
      .catch(() => { /* the lead is visible in the app regardless */ });
  }

  revalidatePath("/get-it-done");
  return { ok: true, id: brief.id, sentTo };
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
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const account = await getAccount();
  if (!account) return { ok: false, error: "Please sign in." };

  const sb = await createClient();
  const { data, error } = await sb.rpc("respond_to_trade_match", {
    p_match: matchId,
    p_response: response,
    p_reason: response === "declined" ? (declineReason ?? "other") : null,
  });
  if (error) return { ok: false, error: error.message };

  const result = (data ?? {}) as { status?: string; changed?: boolean };
  revalidatePath("/business/leads");

  if (response === "interested" && result.changed === true) {
    // Tells the resident. Fire-and-forget: never fails the reply.
    void Promise.resolve(sb.functions.invoke("notify-trade-response", { body: { match_id: matchId, kind: "interested" } }))
      .catch(() => { /* visible on My jobs regardless */ });
  }
  return { ok: true, status: result.status ?? response };
}

/**
 * The resident chooses to give THIS trade their details. Nothing else ever
 * releases them.
 */
export async function shareContactWithTrade(matchId: string): Promise<{ ok: boolean; error?: string }> {
  const account = await getAccount();
  if (!account) return { ok: false, error: "Please sign in." };

  const sb = await createClient();
  const { error } = await sb.rpc("share_brief_contact", { p_match: matchId });
  if (error) return { ok: false, error: error.message };

  void Promise.resolve(sb.functions.invoke("notify-trade-response", { body: { match_id: matchId, kind: "shared" } }))
    .catch(() => { /* the trade sees it on Job leads regardless */ });
  revalidatePath("/get-it-done/mine");
  return { ok: true };
}

/** A trade reads the contact the resident chose to share (null until then). */
export async function getLeadContact(
  matchId: string,
): Promise<{ ok: boolean; contact: { name: string | null; phone: string | null; email: string | null } | null; error?: string }> {
  const account = await getAccount();
  if (!account) return { ok: false, contact: null, error: "Please sign in." };

  const sb = await createClient();
  const { data, error } = await sb.rpc("get_trade_lead_contact", { p_match: matchId });
  if (error) return { ok: false, contact: null, error: error.message };
  if (!data) return { ok: true, contact: null };
  const c = data as { name?: string | null; phone?: string | null; email?: string | null };
  return { ok: true, contact: { name: c.name ?? null, phone: c.phone ?? null, email: c.email ?? null } };
}

/** A trade opened the lead. Idempotent in the database (only moves sent -> viewed). */
export async function markLeadViewed(matchId: string): Promise<{ ok: boolean }> {
  const account = await getAccount();
  if (!account) return { ok: false };
  const sb = await createClient();
  const { error } = await sb.rpc("mark_trade_lead_viewed", { p_match: matchId });
  return { ok: !error };
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
