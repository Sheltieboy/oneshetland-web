/**
 * activities-data.ts — server-side reads for Regular Activities.
 *
 * Every read is BOUNDED: the database refuses windows over 93 days and caps rows (the website never asks for more than 31 days / 100 rows),
 * and visitor-facing reads use the anonymous client so row security shows exactly what the public may see. A failed read returns "nothing to
 * show", never an error page: Regular Activities must not be able to take What's On down.
 */
import { activityOrganiserLabel } from "./activity-organiser";
import { publicClient } from "./supabase/public";
import { createClient } from "./supabase/server";
import { windowFor, type ListingRow, type RuleRow, type SessionRow, type When, type RegularFilters, DEFAULT_WHEN } from "./activities";

export const LISTING_LIMIT = 60;

export async function getActivityListing(f: Partial<RegularFilters> & { limit?: number }, now: Date = new Date(), strict = false): Promise<ListingRow[]> {
  try {
    const w = windowFor(f.when ?? DEFAULT_WHEN, now);
    const { data, error } = await publicClient().rpc("regular_activities_listing", {
      p_from: w.from, p_to: w.to,
      p_dow: f.days && f.days.length ? f.days : null,
      p_category: f.category ?? null, p_locality: f.locality ?? null,
      p_drop_in: f.dropIn ? true : null, p_q: f.q?.trim() ? f.q.trim().slice(0, 80) : null,
      p_limit: Math.min(f.limit ?? LISTING_LIMIT, 100),
    });
    if (error) throw error;
    return (data ?? []) as ListingRow[];
  } catch (e) {
    if (strict) throw e;      // the caller (a cached strip) prefers its last good copy to a false "nothing on"
    return [];
  }
}

/** Weekly rules for a set of listed activities in ONE query (so cards can say "Tuesdays and Thursdays, 18:00–19:00"). */
export async function getRulesFor(activityIds: string[]): Promise<Map<string, RuleRow[]>> {
  const out = new Map<string, RuleRow[]>();
  if (activityIds.length === 0) return out;
  try {
    const { data } = await publicClient().from("activity_schedule_rules").select("activity_id, day_of_week, start_time, end_time, interval_weeks, is_active").in("activity_id", activityIds.slice(0, 100)).eq("is_active", true).limit(800);
    for (const r of (data ?? []) as (RuleRow & { activity_id: string })[]) (out.get(r.activity_id) ?? out.set(r.activity_id, []).get(r.activity_id)!).push(r);
  } catch { /* cards simply omit the pattern line */ }
  return out;
}

/** The compact strip on What's On (Events): a handful of activities with a session in the chosen window. */
export const getActivityStrip = (when: When, now: Date = new Date(), limit = 6) => getActivityListing({ when, limit }, now, true);

export type ActivityDetail = {
  id: string; slug: string; title: string; description: string | null; category: string; audience: string | null; venue: string | null;
  locality: string | null; lat: number | null; lng: number | null; cover_url: string | null; price_text: string | null; booking_mode: "drop_in" | "contact" | "link";
  contact_info: string | null; booking_url: string | null; status: "draft" | "published" | "ended"; active_from: string | null; active_until: string | null;
  organiser_business_id: string | null; organiser_hub_id: string | null; is_platform_activity: boolean; admin_paused: boolean; calendar_approved: boolean;
  admin_pause_reason?: string | null;
};
export type Owner = { kind: "business" | "hub" | "platform"; id: string | null; name: string; slug: string | null };

const DETAIL_COLS = "id, slug, title, description, category, audience, venue, locality, lat, lng, cover_url, price_text, booking_mode, contact_info, booking_url, status, active_from, active_until, organiser_business_id, organiser_hub_id, is_platform_activity, admin_paused, calendar_approved";

/**
 * One activity by its slug. Read with the VISITOR'S OWN session, so a public activity shows to everybody and a draft or paused one shows only to
 * the people who manage it (and staff): the preview an organiser needs, with no extra permission code here.
 */
export async function getActivityDetail(slug: string, now: Date = new Date()) {
  try {
    const sb = await createClient();
    const { data: a } = await sb.from("regular_activities").select(DETAIL_COLS).eq("slug", slug).maybeSingle();
    if (!a) return null;
    const act = a as unknown as ActivityDetail;
    const from = windowFor("today", now).from;
    const to = new Date(Date.parse(from) + 56 * 86_400_000).toISOString();     // eight weeks, bounded
    // One read of who is looking, shared by the two things that depend on it: the follow state and the "can manage" check (skipped for visitors).
    const userP = sb.auth.getUser().then(({ data: { user } }) => user);
    const [rules, sessions, owner, follow, managerCount] = await Promise.all([
      sb.from("activity_schedule_rules").select("id, day_of_week, start_time, end_time, interval_weeks, label, venue, locality, is_active").eq("activity_id", act.id).eq("is_active", true).order("day_of_week").order("start_time"),
      sb.rpc("activity_sessions", { p_from: from, p_to: to, p_activity_id: act.id, p_limit: 120 }),
      loadOwner(act, sb),
      userP.then(async (user) => {
        if (!user) return { signedIn: false, following: false };
        const { data: f } = await sb.from("activity_follows").select("activity_id").eq("activity_id", act.id).eq("user_id", user.id).maybeSingle();
        return { signedIn: true, following: !!f };
      }),
      userP.then((user) => (user ? sb.rpc("activity_follower_count", { p_activity: act.id }) : null)),   // null unless the viewer manages this activity
    ]);
    return {
      activity: act, owner,
      rules: (rules.data ?? []) as RuleRow[],
      sessions: (sessions.data ?? []) as SessionRow[],
      ...follow,
      canManage: typeof managerCount?.data === "number",
    };
  } catch {
    return null;
  }
}

/**
 * Who runs it. Read with the VIEWER'S session, not the anonymous client: a business or hub that is not publicly listed (a newly claimed
 * business awaiting publication, say) is invisible to an anonymous read, so its own organiser previewing a draft used to see the placeholder
 * "A business". Row security still decides what anyone may see: the public sees only active owners (and a public activity requires one).
 * When a name genuinely cannot be read, the name is empty and the page says nothing rather than making one up.
 */
async function loadOwner(a: ActivityDetail, sb: Awaited<ReturnType<typeof createClient>>): Promise<Owner> {
  if (a.organiser_hub_id) {
    const { data } = await sb.from("hubs").select("id, name, slug").eq("id", a.organiser_hub_id).maybeSingle();
    return { kind: "hub", id: a.organiser_hub_id, name: activityOrganiserLabel("hub", data?.name) ?? "", slug: (data?.slug as string) ?? null };
  }
  if (a.organiser_business_id) {
    const { data } = await sb.from("local_businesses_public").select("id, name, slug").eq("id", a.organiser_business_id).maybeSingle();
    return { kind: "business", id: a.organiser_business_id, name: activityOrganiserLabel("business", data?.name) ?? "", slug: (data?.slug as string) ?? null };
  }
  // Platform-owned: no organiser claim (name "" = unknown). The page shows no "Run by" line for it.
  return { kind: "platform", id: null, name: "", slug: null };
}

/** For a business or hub page: its public activities with their next session. Bounded to a month's window. */
export async function getOwnerActivities(kind: "business" | "hub", ownerId: string, now: Date = new Date()): Promise<ListingRow[]> {
  const rows = await getActivityListing({ when: "month", limit: 100 }, now);
  return rows.filter((r) => r.owner_kind === kind && r.owner_id === ownerId);
}

/* ── Management (the signed-in organiser's own session; row security limits everything to what they manage) ───────────────────────── */
export type ManagedActivity = ActivityDetail & { created_at: string; follower_count: number | null };

type ManageKind = "business" | "hub" | "platform";
export async function getManagedActivities(kind: ManageKind, ownerId: string): Promise<ManagedActivity[]> {
  const sb = await createClient();
  const base = sb.from("regular_activities").select(`${DETAIL_COLS}, admin_pause_reason, created_at`);
  const scoped = kind === "platform" ? base.eq("is_platform_activity", true) : kind === "business" ? base.eq("organiser_business_id", ownerId) : base.eq("organiser_hub_id", ownerId);
  const { data } = await scoped.order("created_at", { ascending: false }).limit(100);
  return Promise.all(((data ?? []) as unknown as ManagedActivity[]).map(async (a) => {
    const { data: n } = await sb.rpc("activity_follower_count", { p_activity: a.id });
    return { ...a, follower_count: typeof n === "number" ? n : null };
  }));
}

/** One managed activity with everything the editor needs. Null unless the signed-in user can manage it (row security decides). */
export async function getManagedActivity(kind: ManageKind, ownerId: string, activityId: string, now: Date = new Date()) {
  const sb = await createClient();
  const base = sb.from("regular_activities").select(`${DETAIL_COLS}, admin_pause_reason`).eq("id", activityId);
  const scoped = kind === "platform" ? base.eq("is_platform_activity", true) : kind === "business" ? base.eq("organiser_business_id", ownerId) : base.eq("organiser_hub_id", ownerId);
  const { data: a } = await scoped.maybeSingle();
  if (!a) return null;
  const from = windowFor("today", now).from;
  const to = new Date(Date.parse(from) + 56 * 86_400_000).toISOString();
  const [rules, exceptions, breaks, sessions, followers] = await Promise.all([
    sb.from("activity_schedule_rules").select("id, day_of_week, start_time, end_time, interval_weeks, label, venue, locality, is_active, anchor_date").eq("activity_id", activityId).order("day_of_week").order("start_time"),
    sb.from("activity_exceptions").select("id, rule_id, occurrence_date, kind, new_starts_at, new_ends_at, new_venue, new_locality, note").eq("activity_id", activityId),
    sb.from("activity_breaks").select("id, start_date, end_date, reason").eq("activity_id", activityId).order("start_date"),
    sb.rpc("activity_sessions", { p_from: from, p_to: to, p_activity_id: activityId, p_limit: 200 }),
    sb.rpc("activity_follower_count", { p_activity: activityId }),
  ]);
  return {
    activity: a as unknown as ActivityDetail,
    rules: (rules.data ?? []) as (RuleRow & { id: string; anchor_date: string })[],
    exceptions: (exceptions.data ?? []) as ExceptionRow[],
    breaks: (breaks.data ?? []) as BreakRow[],
    sessions: (sessions.data ?? []) as SessionRow[],
    followerCount: typeof followers.data === "number" ? (followers.data as number) : null,
  };
}
export type ExceptionRow = { id: string; rule_id: string | null; occurrence_date: string | null; kind: "cancelled" | "changed" | "extra"; new_starts_at: string | null; new_ends_at: string | null; new_venue: string | null; new_locality: string | null; note: string | null };
export type BreakRow = { id: string; start_date: string; end_date: string; reason: string | null };

/**
 * Where an old event link should go now, or null. An event that was converted into a session of a Regular Activity is mapped in
 * activity_legacy_events (written only by the conversion scripts). The activity must be PUBLIC, otherwise the old link keeps behaving as it did.
 */
export async function legacyEventRedirect(eventId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  try {
    const sb = publicClient();
    const { data: m } = await sb.from("activity_legacy_events").select("activity_id, occurrence_date").eq("event_id", eventId).maybeSingle();
    if (!m) return null;
    const { data: a } = await sb.from("regular_activities").select("slug").eq("id", m.activity_id as string).maybeSingle();   // public rows only
    if (!a) return null;
    return `/whats-on/regular/${a.slug as string}${m.occurrence_date ? `?session=${m.occurrence_date as string}` : ""}`;
  } catch {
    return null;
  }
}

/**
 * The homepage's Regular Activities: activities with a live session from NOW to 14 days ahead (the window starts at this instant, so a session
 * that has already finished today never counts), plus their weekly rules in ONE more query. Strict: a failure throws so the homepage keeps its
 * last good copy (see lib/home-resilience.ts) instead of showing "nothing on".
 */
export async function getHomeActivities(now: Date = new Date()): Promise<{ rows: ListingRow[]; rules: Record<string, RuleRow[]> }> {
  const { data, error } = await publicClient().rpc("regular_activities_listing", {
    p_from: now.toISOString(), p_to: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
    p_dow: null, p_category: null, p_locality: null, p_drop_in: null, p_q: null, p_limit: 60,
  });
  if (error) throw error;
  const rows = ((data ?? []) as ListingRow[]).filter((r) => r.sessions_in_window > 0);
  const rules = Object.fromEntries(await getRulesFor(rows.map((r) => r.id)));
  return { rows, rules };
}
