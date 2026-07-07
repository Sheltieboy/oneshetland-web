/**
 * for-you.server.ts — the personalised "For you" feed on the home page.
 *
 * Aggregates the SIGNED-IN user's own activity from across the OneShetland
 * ecosystem into one normalised, priority-sorted list. SERVER-ONLY: every read
 * uses the cookie-bound server client, so it's RLS-scoped to the caller — a
 * user only ever sees their own rows.
 *
 * Design principles (mirrors lib/home-data.ts):
 *   • Every source is fetched IN PARALLEL and wrapped in `safe()` so one failing
 *     query returns [] rather than breaking the whole feed.
 *   • We query the underlying tables directly here (not the app's client-side
 *     `"use client"` fetchers such as fetchMyBookings / fetchMyLoyaltyCards),
 *     because those bind to the browser Supabase client and can't run in a
 *     Server Component. Same tables, same RLS.
 *
 * Priority bands (lower shows first):
 *   0  — live / time-sensitive (delivery in flight, booking/ticket today)
 *   10 — updates that need a look (application moved, upcoming booking)
 *   20 — engagement nudges (loyalty near reward, hub campaign, wallet)
 *   30 — light / ambient (play today's games, revisit a story)
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { levelFromXp } from "@/lib/games-data";

export type ForYouKind =
  | "fetch"
  | "booking"
  | "ticket"
  | "loyalty"
  | "wallet"
  | "job"
  | "shift"
  | "game"
  | "hub"
  | "story"
  | "boat";

export type ForYouItem = {
  id: string;
  kind: ForYouKind;
  priority: number; // lower = shown first (see bands above)
  icon: string; // maps to an inline SVG in ForYou.tsx
  title: string;
  subtitle: string;
  href: string;
  accent?: string; // section colour for a subtle accent
  /** A short "now / today" cue for time-sensitive items (rendered as a pill). */
  cue?: string;
  /** Optional business/event logo/cover to warm the card. */
  image?: string | null;
  /** Sort tiebreak within a band — higher = more recent/relevant. */
  ts?: number;
};

/* Section accent colours (mirror app/globals.css --color-* tokens). */
const ACCENT = {
  fetch: "#e0722a",
  booking: "#7c3aed",
  ticket: "#d4921a",
  loyalty: "#7c3aed",
  wallet: "#12b3d6",
  job: "#2a8b5c",
  shift: "#e8a020",
  game: "#10b981",
  hub: "#6b47bf",
  story: "#9f1239",
  boat: "#1e3a8a",
} as const;

/** Wrap a fetch so one failing source never breaks the feed. */
async function safe<T>(p: Promise<T[]>): Promise<T[]> {
  try {
    return await p;
  } catch {
    return [];
  }
}

type SB = Awaited<ReturnType<typeof createServerClient>>;

function isSameDay(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}
function relativeDay(iso: string): string {
  if (isSameDay(iso)) return "today";
  const d = new Date(iso);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

/* ── The aggregator ─────────────────────────────────────────────────────────── */

/** All the signed-in user's cross-ecosystem items, priority-sorted, capped. */
export async function getForYou(userId: string): Promise<ForYouItem[]> {
  const sb = await createServerClient();

  const [
    fetchItems,
    bookingItems,
    ticketItems,
    loyaltyItems,
    walletItems,
    jobItems,
    shiftItems,
    gameItems,
    hubItems,
  ] = await Promise.all([
    safe(fetchDeliveries(sb, userId)),
    safe(fetchBookings(sb, userId)),
    safe(fetchTickets(sb, userId)),
    safe(fetchLoyalty(sb, userId)),
    safe(fetchWallet(sb, userId)),
    safe(fetchJobApps(sb, userId)),
    safe(fetchShiftApps(sb, userId)),
    safe(fetchGames(sb, userId)),
    safe(fetchHubs(sb, userId)),
  ]);

  const all = [
    ...fetchItems,
    ...bookingItems,
    ...ticketItems,
    ...loyaltyItems,
    ...walletItems,
    ...jobItems,
    ...shiftItems,
    ...gameItems,
    ...hubItems,
  ];

  all.sort((a, b) => a.priority - b.priority || (b.ts ?? 0) - (a.ts ?? 0));
  return all.slice(0, 8);
}

/* ── Fetch (delivery) ───────────────────────────────────────────────────────── */

const DELIVERY_STATUS_COPY: Record<string, { title: string; cue: string; pri: number }> = {
  pending: { title: "Finding you a driver", cue: "waiting", pri: 5 },
  matched: { title: "A driver's on the way", cue: "in progress", pri: 0 },
  collected: { title: "Your delivery's on its way", cue: "in progress", pri: 0 },
};

async function fetchDeliveries(sb: SB, userId: string): Promise<ForYouItem[]> {
  // Deliveries I requested that are still in flight (as the customer).
  const { data } = await sb
    .from("delivery_requests")
    .select("id, pickup_name, destination_area, status, created_at")
    .eq("customer_id", userId)
    .in("status", ["pending", "matched", "collected"])
    .order("created_at", { ascending: false })
    .limit(3);

  return ((data ?? []) as {
    id: string;
    pickup_name: string;
    destination_area: string | null;
    status: string;
    created_at: string;
  }[]).map((r) => {
    const copy = DELIVERY_STATUS_COPY[r.status] ?? { title: "Your Fetch request", cue: "active", pri: 5 };
    const dest = r.destination_area ? ` → ${r.destination_area}` : "";
    return {
      id: `fetch-${r.id}`,
      kind: "fetch" as const,
      priority: copy.pri,
      icon: "fetch",
      title: copy.title,
      subtitle: `${r.pickup_name}${dest}`,
      href: `/fetch/${r.id}`,
      accent: ACCENT.fetch,
      cue: copy.cue,
      ts: new Date(r.created_at).getTime(),
    };
  });
}

/* ── Bookings (appointments) ────────────────────────────────────────────────── */

async function fetchBookings(sb: SB, userId: string): Promise<ForYouItem[]> {
  const now = new Date().toISOString();
  const { data } = await sb
    .from("book_bookings")
    .select("id, starts_at, status, service:book_services(name), business:local_businesses(id, name, logo_url)")
    .eq("customer_id", userId)
    .in("status", ["confirmed", "pending_payment"])
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(3);

  return ((data ?? []) as unknown as {
    id: string;
    starts_at: string;
    status: string;
    service: { name: string } | null;
    business: { id: string; name: string; logo_url: string | null } | null;
  }[]).map((r) => {
    const today = isSameDay(r.starts_at);
    const svc = r.service?.name ?? "Appointment";
    const biz = r.business?.name ? ` · ${r.business.name}` : "";
    return {
      id: `booking-${r.id}`,
      kind: "booking" as const,
      priority: today ? 1 : 12,
      icon: "calendar",
      title: today ? `${svc} today` : svc,
      subtitle: `${relativeDay(r.starts_at)}, ${timeLabel(r.starts_at)}${biz}`,
      href: "/account/bookings",
      accent: ACCENT.booking,
      cue: today ? "today" : undefined,
      image: r.business?.logo_url ?? null,
      ts: -new Date(r.starts_at).getTime(), // soonest first
    };
  });
}

/* ── Event tickets / passes ─────────────────────────────────────────────────── */

async function fetchTickets(sb: SB, userId: string): Promise<ForYouItem[]> {
  const out: ForYouItem[] = [];

  // Day passes / class packs still with uses left (book_unit_purchases).
  const nowIso = new Date().toISOString();
  const { data: passes } = await sb
    .from("book_unit_purchases")
    .select("id, uses_remaining, expires_at, created_at, item:book_unit_items(name), business:local_businesses(name)")
    .eq("owner_id", userId)
    .gt("uses_remaining", 0)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(2);

  for (const p of (passes ?? []) as unknown as {
    id: string;
    uses_remaining: number;
    expires_at: string | null;
    created_at: string;
    item: { name: string } | null;
    business: { name: string } | null;
  }[]) {
    const name = p.item?.name ?? "Pass";
    const biz = p.business?.name ? ` · ${p.business.name}` : "";
    const uses = p.uses_remaining > 1 ? `${p.uses_remaining} uses left` : "1 use left";
    out.push({
      id: `pass-${p.id}`,
      kind: "ticket",
      priority: 18,
      icon: "ticket",
      title: name,
      subtitle: `${uses}${biz}`,
      href: "/account/passes",
      accent: ACCENT.ticket,
      ts: new Date(p.created_at).getTime(),
    });
  }

  // Upcoming event tickets the user holds (event_tickets → events).
  try {
    const { data: tix } = await sb
      .from("event_tickets")
      .select("id, event:events(id, title, starts_at, venue, cover_url)")
      .eq("holder_id", userId)
      .limit(6);

    const rows = ((tix ?? []) as unknown as {
      id: string;
      event: { id: string; title: string; starts_at: string; venue: string | null; cover_url: string | null } | null;
    }[]).filter((r) => r.event && new Date(r.event.starts_at).getTime() >= Date.now());

    // De-dupe by event: one card per upcoming event.
    const seen = new Set<string>();
    rows
      .sort((a, b) => new Date(a.event!.starts_at).getTime() - new Date(b.event!.starts_at).getTime())
      .slice(0, 2)
      .forEach((r) => {
        const ev = r.event!;
        if (seen.has(ev.id)) return;
        seen.add(ev.id);
        const today = isSameDay(ev.starts_at);
        out.push({
          id: `ticket-${ev.id}`,
          kind: "ticket",
          priority: today ? 1 : 11,
          icon: "ticket",
          title: today ? `${ev.title} — today` : ev.title,
          subtitle: `${relativeDay(ev.starts_at)}, ${timeLabel(ev.starts_at)}${ev.venue ? ` · ${ev.venue}` : ""}`,
          href: `/whats-on/${ev.id}`,
          accent: ACCENT.ticket,
          cue: today ? "today" : "your ticket",
          image: ev.cover_url,
          ts: -new Date(ev.starts_at).getTime(),
        });
      });
  } catch {
    // event_tickets table may not exist in every environment — pass silently.
  }

  return out;
}

/* ── Loyalty / stamps ───────────────────────────────────────────────────────── */

async function fetchLoyalty(sb: SB, userId: string): Promise<ForYouItem[]> {
  const { data: cards } = await sb
    .from("local_loyalty_cards")
    .select("id, business_id, program_id, stamps_collected")
    .eq("user_id", userId)
    .order("last_stamp_at", { ascending: false, nullsFirst: false })
    .limit(20);

  const rows = (cards ?? []) as { id: string; business_id: string; program_id: string; stamps_collected: number }[];
  if (!rows.length) return [];

  const programIds = [...new Set(rows.map((c) => c.program_id))];
  const businessIds = [...new Set(rows.map((c) => c.business_id))];
  const [{ data: progs }, { data: biz }] = await Promise.all([
    sb.from("local_loyalty_programs").select("id, type, stamps_required, stamp_reward").in("id", programIds),
    sb.from("local_businesses").select("id, name, logo_url").in("id", businessIds),
  ]);
  const progMap = Object.fromEntries(
    ((progs ?? []) as { id: string; type: string; stamps_required: number | null; stamp_reward: string | null }[]).map((p) => [p.id, p]),
  );
  const bizMap = Object.fromEntries(
    ((biz ?? []) as { id: string; name: string; logo_url: string | null }[]).map((b) => [b.id, b]),
  );

  const out: ForYouItem[] = [];
  for (const c of rows) {
    const prog = progMap[c.program_id];
    const b = bizMap[c.business_id];
    if (!prog || prog.type !== "stamps" || !prog.stamps_required || prog.stamps_required <= 0) continue;
    const away = prog.stamps_required - c.stamps_collected;
    // Only surface a card when it's genuinely close to (or at) a reward.
    if (away > 2) continue;
    const ready = away <= 0;
    out.push({
      id: `loyalty-${c.id}`,
      kind: "loyalty",
      priority: ready ? 15 : 20,
      icon: "stamp",
      title: ready ? "Reward ready to claim" : `${away} stamp${away === 1 ? "" : "s"} from a reward`,
      subtitle: `${b?.name ?? "A local business"}${prog.stamp_reward ? ` · ${prog.stamp_reward}` : ""}`,
      href: "/account/loyalty",
      accent: ACCENT.loyalty,
      cue: ready ? "ready" : undefined,
      image: b?.logo_url ?? null,
      ts: c.stamps_collected,
    });
  }
  // At most 2 loyalty nudges so the feed stays varied.
  return out.slice(0, 2);
}

/* ── Wallet ─────────────────────────────────────────────────────────────────── */

async function fetchWallet(sb: SB, userId: string): Promise<ForYouItem[]> {
  const { data } = await sb
    .from("local_wallet_balances")
    .select("balance_pence")
    .eq("user_id", userId)
    .maybeSingle();
  const pence = (data as { balance_pence: number } | null)?.balance_pence ?? 0;
  // Only surface a wallet with a meaningful balance (>= £5).
  if (pence < 500) return [];
  const pounds = pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
  return [
    {
      id: "wallet",
      kind: "wallet",
      priority: 22,
      icon: "wallet",
      title: `${pounds} in your wallet`,
      subtitle: "Spend it at Shetland businesses",
      href: "/account/wallet",
      accent: ACCENT.wallet,
      ts: pence,
    },
  ];
}

/* ── Jobs ───────────────────────────────────────────────────────────────────── */

// Application statuses that mean "something moved — take a look".
const JOB_MOVED: Record<string, string> = {
  viewed: "Your application was viewed",
  shortlisted: "You've been shortlisted",
  interview: "Interview stage",
  offer: "You've had an offer",
  hired: "You got the job",
  declined: "Application update",
};

async function fetchJobApps(sb: SB, userId: string): Promise<ForYouItem[]> {
  const { data } = await sb
    .from("job_applications")
    .select("id, status, applied_at, job:jobs(id, title, business:local_businesses(name, logo_url))")
    .eq("applicant_id", userId)
    .neq("status", "withdrawn")
    .order("applied_at", { ascending: false })
    .limit(4);

  return ((data ?? []) as unknown as {
    id: string;
    status: string;
    applied_at: string;
    job: { id: string; title: string; business: { name: string; logo_url: string | null } | null } | null;
  }[])
    .filter((r) => r.job)
    .slice(0, 2)
    .map((r) => {
      const moved = JOB_MOVED[r.status];
      return {
        id: `job-${r.id}`,
        kind: "job" as const,
        priority: moved ? 10 : 21,
        icon: "briefcase",
        title: moved ?? "Application in progress",
        subtitle: r.job!.title,
        href: `/jobs/${r.job!.id}`,
        accent: ACCENT.job,
        cue: moved && ["shortlisted", "interview", "offer", "hired"].includes(r.status) ? "update" : undefined,
        image: r.job!.business?.logo_url ?? null,
        ts: new Date(r.applied_at).getTime(),
      };
    });
}

/* ── Shifts ─────────────────────────────────────────────────────────────────── */

const SHIFT_MOVED: Record<string, string> = {
  accepted: "You've been accepted for a shift",
  rejected: "Shift application update",
};

async function fetchShiftApps(sb: SB, userId: string): Promise<ForYouItem[]> {
  const { data: apps } = await sb
    .from("shift_applications")
    .select("id, shift_id, status, created_at")
    .eq("worker_id", userId)
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false })
    .limit(4);

  const list = (apps ?? []) as { id: string; shift_id: string; status: string; created_at: string }[];
  if (!list.length) return [];

  const shiftIds = [...new Set(list.map((a) => a.shift_id))];
  const { data: shifts } = await sb
    .from("shifts")
    .select("id, title, start_at, location_text")
    .in("id", shiftIds);
  const map = Object.fromEntries(
    ((shifts ?? []) as { id: string; title: string; start_at: string; location_text: string | null }[]).map((s) => [s.id, s]),
  );

  return list
    .slice(0, 2)
    .map((a) => {
      const s = map[a.shift_id];
      if (!s) return null;
      const moved = SHIFT_MOVED[a.status];
      return {
        id: `shift-${a.id}`,
        kind: "shift" as const,
        priority: a.status === "accepted" ? 10 : 21,
        icon: "clock",
        title: moved ?? "Shift application pending",
        subtitle: `${s.title}${s.location_text ? ` · ${s.location_text}` : ""}`,
        href: `/shifts/${s.id}`,
        accent: ACCENT.shift,
        cue: a.status === "accepted" ? "accepted" : undefined,
        ts: new Date(a.created_at).getTime(),
      } as ForYouItem;
    })
    .filter((x): x is ForYouItem => x !== null);
}

/* ── Games ──────────────────────────────────────────────────────────────────── */

async function fetchGames(sb: SB, userId: string): Promise<ForYouItem[]> {
  const { data } = await sb
    .from("games_user_stats")
    .select("total_xp, current_streak_days, last_played_date")
    .eq("user_id", userId)
    .maybeSingle();

  const stats = data as { total_xp: number; current_streak_days: number; last_played_date: string | null } | null;
  const playedToday = !!stats?.last_played_date && isSameDay(stats.last_played_date);
  if (playedToday) return []; // nothing to nudge — they've already played.

  const streak = stats?.current_streak_days ?? 0;
  const level = stats ? levelFromXp(stats.total_xp) : 1;
  const title = streak > 1 ? `Keep your ${streak}-day streak alive` : "Play today's games";
  const subtitle = streak > 1 ? "A quick round keeps it going" : stats ? `You're level ${level} · a quick round awaits` : "Spik Sprint, Guess Da Wird & more";

  return [
    {
      id: "game-nudge",
      kind: "game",
      priority: 30,
      icon: "play",
      title,
      subtitle,
      href: "/games",
      accent: ACCENT.game,
      cue: streak > 1 ? `${streak}-day streak` : undefined,
      ts: streak,
    },
  ];
}

/* ── Hubs ───────────────────────────────────────────────────────────────────── */

async function fetchHubs(sb: SB, userId: string): Promise<ForYouItem[]> {
  const { data: mems } = await sb
    .from("hub_members")
    .select("hub_id, paid_until, hub:hubs(id, name, brand_color, logo_url, slug)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: false })
    .limit(10);

  const rows = (mems ?? []) as unknown as {
    hub_id: string;
    paid_until: string | null;
    hub: { id: string; name: string; brand_color: string | null; logo_url: string | null; slug: string | null } | null;
  }[];
  if (!rows.length) return [];

  const out: ForYouItem[] = [];

  // 1) Membership expiring within 30 days → renew nudge.
  const soon = Date.now() + 30 * 24 * 60 * 60 * 1000;
  for (const m of rows) {
    if (!m.hub || !m.paid_until) continue;
    const until = new Date(m.paid_until).getTime();
    if (until > Date.now() && until < soon) {
      out.push({
        id: `hub-renew-${m.hub_id}`,
        kind: "hub",
        priority: 16,
        icon: "hub",
        title: `${m.hub.name} membership expiring soon`,
        subtitle: `Renew before ${relativeDay(m.paid_until)}`,
        href: `/hubs/${m.hub.slug || m.hub.id}`,
        accent: m.hub.brand_color || ACCENT.hub,
        cue: "renew",
        image: m.hub.logo_url,
        ts: -until,
      });
    }
  }

  // 2) An active campaign from a hub they belong to.
  const hubIds = rows.map((r) => r.hub_id);
  const { data: camps } = await sb
    .from("hub_campaigns")
    .select("id, hub_id, title, goal_pence, raised_pence")
    .in("hub_id", hubIds)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  const camp = ((camps ?? []) as { id: string; hub_id: string; title: string; goal_pence: number; raised_pence: number }[])[0];
  if (camp) {
    const hub = rows.find((r) => r.hub_id === camp.hub_id)?.hub;
    const pct = camp.goal_pence > 0 ? Math.min(100, Math.round((camp.raised_pence / camp.goal_pence) * 100)) : 0;
    out.push({
      id: `hub-campaign-${camp.id}`,
      kind: "hub",
      priority: 24,
      icon: "hub",
      title: camp.title,
      subtitle: `${hub?.name ?? "Your hub"} · ${pct}% of the way there`,
      href: `/hubs/campaign/${camp.id}`,
      accent: hub?.brand_color || ACCENT.hub,
      image: hub?.logo_url ?? null,
      ts: camp.raised_pence,
    });
  }

  return out.slice(0, 2);
}
