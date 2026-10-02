"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TicketQR } from "@/components/account/TicketQR";
import { SHETLAND_TZ } from "@/lib/shetland-time";
import {
  CELEBRATION_MS,
  checkedInTimeLabel,
  isUsed,
  mergeServerTickets,
  newlyUsedIds,
  pollIntervalMs,
  type LiveTicket,
} from "@/lib/ticket-live";
import {
  splitTickets,
  ticketHistoryLines,
  ticketLifecycle,
  type HistoryOrder,
  type TicketBucket,
  type TicketState,
} from "@/lib/ticket-lifecycle";

export type TicketEvent = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  venue: string | null;
  status: string | null;
};

/** One ticket as the page knows it: the row, its event, and the buyer's own order (if any). */
export type TicketItem = LiveTicket & {
  backup_code: string | null;
  attendee_name: string | null;
  ticket_type_name: string | null;
  event: TicketEvent;
  order: HistoryOrder | null;
};

/** What the live refresh returns for a ticket: only the parts that can change. */
type LiveRow = LiveTicket & { order?: HistoryOrder | null };

type Group = { key: string; event: TicketEvent; items: TicketItem[] };

const EVENTS = "#d4921a";

const PILL: Record<TicketState, { background: string; color: string }> = {
  valid: { background: "#DCFCE7", color: "#065F46" },
  postponed: { background: "#FEF3C7", color: "#92400E" },
  checked_in: { background: "#E5E7EB", color: "#6B7280" },
  refunded: { background: "#E5E7EB", color: "#374151" },
  void: { background: "#FEE2E2", color: "#991B1B" },
  event_cancelled: { background: "#FEE2E2", color: "#991B1B" },
  event_ended: { background: "#E5E7EB", color: "#6B7280" },
};

function fmt(dt: string): string {
  if (!dt) return "";
  return new Date(dt).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: SHETLAND_TZ,
  });
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: SHETLAND_TZ,
  });
}

/** Group by event, keeping the order the tickets arrived in. */
function groupByEvent(items: TicketItem[]): Group[] {
  const m = new Map<string, Group>();
  for (const it of items) {
    const g = m.get(it.event.id) ?? { key: it.event.id, event: it.event, items: [] };
    g.items.push(it);
    m.set(it.event.id, g);
  }
  return [...m.values()];
}

/**
 * TicketsLive — the holder's tickets, kept honest while the page stays open.
 *
 * The organiser scans; this card changes. It changes because a row came back
 * from `event_tickets` saying it changed, never because anything here decided
 * the scan had probably worked. Realtime is only the nudge that prompts a read:
 * every state change on screen is a value the database returned.
 *
 * Three things can prompt that read — a Realtime UPDATE on one of this holder's
 * tickets, the tab becoming visible again, and a slow interval. The interval is
 * the reason a dropped socket does not strand the customer on a stale card; it
 * runs at a minute while Realtime is connected, tightens to fifteen seconds
 * when it is not, pauses while the tab is hidden, and stops altogether once
 * nothing on the page is still scannable.
 *
 * Two tabs, Upcoming and Past, split by ticketLifecycle() — the same rule the
 * mobile app uses. A ticket is Upcoming only while it can still be used; a
 * refunded, void or checked-in ticket, or one for a cancelled or finished event,
 * is Past, and Past tickets never show a scannable code. A ticket that has just
 * been checked in stays in Upcoming for the length of its celebration, so the
 * customer sees "You're in!" before it files itself away.
 */
export function TicketsLive({ userId, tickets }: { userId: string; tickets: TicketItem[] }) {
  const seed = useMemo<LiveRow[]>(
    () => tickets.map((t) => ({ id: t.id, status: t.status, checked_in_at: t.checked_in_at, order: t.order })),
    [tickets],
  );
  const ids = useMemo(() => seed.map((t) => t.id), [seed]);

  const [live, setLive] = useState<LiveRow[]>(seed);
  const [celebrating, setCelebrating] = useState<Record<string, true>>({});
  const [tab, setTab] = useState<TicketBucket>("upcoming");
  // Proven by delivery, not by subscribe status: a channel reports SUBSCRIBED
  // even for a table Realtime cannot deliver from at all.
  const [realtimeProven, setRealtimeProven] = useState(false);
  // "Has the event ended?" is a question about the clock, so it is asked again:
  // a page left open across the end of an event files the ticket under Past itself.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(h);
  }, []);

  // Callbacks read the latest rows without being rebuilt on every change, so
  // the subscription is opened once rather than torn down on each update.
  const liveRef = useRef(live);
  liveRef.current = live;
  const reducedRef = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => { reducedRef.current = e.matches; };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  /** Fold a server read in, and celebrate only what actually just changed. */
  const apply = useCallback((server: LiveRow[]) => {
    const before = liveRef.current;
    const merged = mergeServerTickets(before, server);
    const fresh = newlyUsedIds(before, merged);
    liveRef.current = merged;
    setLive(merged);
    if (fresh.length === 0 || reducedRef.current) return;
    setCelebrating((c) => {
      const next = { ...c };
      for (const id of fresh) next[id] = true;
      return next;
    });
    const timer = window.setTimeout(() => {
      setCelebrating((c) => {
        const next = { ...c };
        for (const id of fresh) delete next[id];
        return next;
      });
    }, CELEBRATION_MS);
    timers.current.push(timer);
  }, []);

  const refresh = useCallback(async () => {
    if (ids.length === 0) return;
    const sb = createClient();
    const { data, error } = await sb
      .from("event_tickets")
      // The order rides along so a refund that lands while the page is open shows
      // its amount and date, not just a new status.
      .select("id, status, checked_in_at, order:event_ticket_orders(buyer_id, status, total_pence, tickets_count, paid_at, refunded_at, stripe_payment_intent_id)")
      .eq("holder_id", userId)
      .in("id", ids);
    if (error || !data) return;
    apply(data as unknown as LiveRow[]);
  }, [ids, userId, apply]);

  // Realtime: the nudge, not the source. Every event triggers an authoritative
  // read rather than being trusted as the new state on its own. Receiving one
  // is also the ONLY thing that proves delivery works — the subscribe status is
  // deliberately not consulted, because it reports SUBSCRIBED regardless.
  useEffect(() => {
    if (ids.length === 0) return;
    const sb = createClient();
    const channel = sb
      .channel(`my-tickets-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "event_tickets", filter: `holder_id=eq.${userId}` },
        () => { setRealtimeProven(true); void refresh(); },
      )
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [userId, ids.length, refresh]);

  const byId = useMemo(() => new Map(live.map((t) => [t.id, t])), [live]);

  /** The ticket as it is NOW: the page's row with the live status and order laid over it. */
  const current = useMemo<TicketItem[]>(
    () => tickets.map((t) => {
      const l = byId.get(t.id);
      return l ? { ...t, status: l.status, checked_in_at: l.checked_in_at, order: l.order ?? t.order } : t;
    }),
    [tickets, byId],
  );

  // One rule for both tabs. A ticket being celebrated is held in Upcoming as the
  // valid ticket it was a moment ago, and drops to Past when the celebration ends.
  const pick = useCallback(
    (t: TicketItem) => (celebrating[t.id]
      ? { status: "valid", checked_in_at: null, event: t.event }
      : { status: t.status, checked_in_at: t.checked_in_at, event: t.event }),
    [celebrating],
  );
  const { upcoming, past } = useMemo(() => splitTickets(current, pick, now), [current, pick, now]);

  // Backstop: a re-read on a timer, and whenever the customer comes back to the
  // tab. Fast until Realtime has actually delivered something, so a silently
  // dead socket costs ten seconds rather than a minute. Only Upcoming tickets can
  // still change by being scanned, so a page of only Past tickets stops polling.
  useEffect(() => {
    const every = pollIntervalMs(realtimeProven, upcoming);
    if (every === null) return;
    const tick = () => { if (document.visibilityState === "visible") void refresh(); };
    const handle = window.setInterval(tick, every);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(handle);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [realtimeProven, upcoming, refresh]);

  const shown = tab === "upcoming" ? upcoming : past;
  const groups = useMemo(() => groupByEvent(shown), [shown]);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="My tickets" className="flex gap-1 border-b border-line">
        {(["upcoming", "past"] as const).map((k) => {
          const count = k === "upcoming" ? upcoming.length : past.length;
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              id={`tickets-tab-${k}`}
              aria-selected={on}
              aria-controls="tickets-panel"
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold ${on ? "text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
              style={on ? { borderColor: EVENTS } : undefined}
            >
              {k === "upcoming" ? "Upcoming" : "Past"}
              <span className="ml-1.5 text-xs font-semibold text-ink-muted">{count}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="tickets-panel" aria-labelledby={`tickets-tab-${tab}`} className="space-y-5">
        {groups.length === 0 ? (
          <div className="rounded-card border border-line bg-paper p-10 text-center shadow-soft">
            <p className="font-display text-lg font-bold text-ink">
              {tab === "upcoming" ? "No upcoming tickets" : "No past tickets"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
              {tab === "upcoming"
                ? "When you buy tickets to a Shetland event, they'll appear here."
                : "Tickets you've used, refunded, or that were for events that have finished will appear here."}
            </p>
            {tab === "upcoming" && (
              <Link href="/whats-on" className="mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-paper" style={{ background: EVENTS }}>
                Browse What&apos;s On
              </Link>
            )}
          </div>
        ) : (
          groups.map((grp) => (
            <section key={`${tab}-${grp.key}`} className="rounded-card border border-line bg-paper p-5 shadow-soft">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-ink">{grp.event.title}</h2>
                <span className="shrink-0 text-sm text-ink-muted">
                  {grp.items.length} ticket{grp.items.length === 1 ? "" : "s"}
                </span>
              </div>
              {grp.event.starts_at && (
                <p className="mt-0.5 text-sm text-ink-muted">{fmt(grp.event.starts_at)}{grp.event.venue ? ` · ${grp.event.venue}` : ""}</p>
              )}
              {tab === "upcoming" && (grp.event.status === "cancelled" || grp.event.status === "postponed") && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                  {grp.event.status === "cancelled"
                    ? "This event has been cancelled. Refunds come from the organiser — contact us if you haven't heard from them."
                    : "This event has been postponed. The organiser will confirm a new date."}
                </p>
              )}
              <div className="mt-4 space-y-2">
                {grp.items.map((t) => {
                  const life = ticketLifecycle(pick(t), now);
                  if (!life) return null;
                  const partying = !!celebrating[t.id];
                  const used = isUsed(t);
                  const at = checkedInTimeLabel(t.checked_in_at);
                  const lines = life.bucket === "past" ? ticketHistoryLines(t.order, userId, fmtDay) : null;
                  return (
                    <div
                      key={t.id}
                      className={`relative rounded-xl border border-line bg-sand/40 px-4 py-3${partying ? " ticket-checkin" : ""}${life.bucket === "past" ? " opacity-90" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {t.ticket_type_name ?? "Ticket"}
                            {lines?.quantity ? <span className="font-normal text-ink-muted"> · {lines.quantity}</span> : null}
                          </p>
                          {t.attendee_name && <p className="text-xs text-ink-muted">{t.attendee_name}</p>}
                          {used && (
                            <p
                              className={`mt-0.5 text-xs font-semibold ${partying ? "text-emerald-600" : "text-ink-muted"}`}
                              aria-live="polite"
                            >
                              {partying ? "You're in!" : at ? `Checked in ${at}` : "Checked in"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {partying && (
                            <span
                              className="ticket-burst grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-600"
                              aria-hidden
                            >
                              ✓
                            </span>
                          )}
                          {/* A scannable code only for a ticket that can still be used. */}
                          {t.backup_code && life.showCode && <TicketQR code={t.backup_code} />}
                          {t.backup_code && life.showCode && (
                            <span className="rounded-lg bg-paper px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-ink shadow-sm">
                              {t.backup_code}
                            </span>
                          )}
                          <span className="rounded-pill px-2.5 py-1 text-xs font-bold" style={PILL[life.state]}>
                            {life.label}
                          </span>
                        </div>
                      </div>
                      {lines && (lines.paid || lines.refund) && (
                        <div className="mt-2 space-y-0.5 border-t border-line pt-2 text-xs">
                          {lines.paid && <p className="text-ink-muted">{lines.paid}</p>}
                          {lines.refund && <p className="font-semibold text-ink">{lines.refund}</p>}
                          {life.state === "refunded" && <p className="text-ink-muted">This ticket is no longer valid.</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
