"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TicketQR } from "@/components/account/TicketQR";
import {
  CELEBRATION_MS,
  checkedInTimeLabel,
  isUsed,
  mergeServerTickets,
  newlyUsedIds,
  pollIntervalMs,
  showsCode,
  ticketBadge,
  type LiveTicket,
} from "@/lib/ticket-live";

export type LiveTicketRow = LiveTicket & {
  backup_code: string | null;
  attendee_name: string | null;
  ticket_type_name: string | null;
};

export type TicketGroup = {
  key: string;
  title: string;
  when: string;
  venue: string | null;
  status: string | null;
  items: LiveTicketRow[];
};

const USED_PILL = { background: "#E5E7EB", color: "#6B7280" };
const VALID_PILL = { background: "#DCFCE7", color: "#065F46" };

function fmt(dt: string): string {
  if (!dt) return "";
  return new Date(dt).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
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
 */
export function TicketsLive({ userId, groups }: { userId: string; groups: TicketGroup[] }) {
  const seed = useMemo<LiveTicket[]>(
    () => groups.flatMap((g) => g.items.map((t) => ({ id: t.id, status: t.status, checked_in_at: t.checked_in_at }))),
    [groups],
  );
  const ids = useMemo(() => seed.map((t) => t.id), [seed]);

  const [live, setLive] = useState<LiveTicket[]>(seed);
  const [celebrating, setCelebrating] = useState<Record<string, true>>({});
  const [realtimeOk, setRealtimeOk] = useState(false);

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
  const apply = useCallback((server: LiveTicket[]) => {
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
      .select("id, status, checked_in_at")
      .eq("holder_id", userId)
      .in("id", ids);
    if (error || !data) return;
    apply(data as LiveTicket[]);
  }, [ids, userId, apply]);

  // Realtime: the nudge, not the source. Every event triggers an authoritative
  // read rather than being trusted as the new state on its own.
  useEffect(() => {
    if (ids.length === 0) return;
    const sb = createClient();
    const channel = sb
      .channel(`my-tickets-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "event_tickets", filter: `holder_id=eq.${userId}` },
        () => { void refresh(); },
      )
      .subscribe((status) => setRealtimeOk(status === "SUBSCRIBED"));
    return () => { void sb.removeChannel(channel); };
  }, [userId, ids.length, refresh]);

  // Backstop: a slow re-read, and a read whenever the customer comes back to
  // the tab. Without this a dropped socket leaves the card wrong indefinitely.
  useEffect(() => {
    const every = pollIntervalMs(realtimeOk, live);
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
  }, [realtimeOk, live, refresh]);

  const byId = useMemo(() => new Map(live.map((t) => [t.id, t])), [live]);

  return (
    <div className="space-y-5">
      {groups.map((grp) => (
        <section key={grp.key} className="rounded-card border border-line bg-paper p-5 shadow-soft">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-ink">{grp.title}</h2>
            <span className="shrink-0 text-sm text-ink-muted">
              {grp.items.length} ticket{grp.items.length === 1 ? "" : "s"}
            </span>
          </div>
          {grp.when && (
            <p className="mt-0.5 text-sm text-ink-muted">{fmt(grp.when)}{grp.venue ? ` · ${grp.venue}` : ""}</p>
          )}
          {(grp.status === "cancelled" || grp.status === "postponed") && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
              {grp.status === "cancelled"
                ? "This event has been cancelled. Refunds come from the organiser — contact us if you haven't heard from them."
                : "This event has been postponed. The organiser will confirm a new date."}
            </p>
          )}
          <div className="mt-4 space-y-2">
            {grp.items.map((row) => {
              const t = byId.get(row.id) ?? row;
              const badge = ticketBadge(t, grp.status);
              const used = isUsed(t);
              const partying = !!celebrating[row.id];
              const at = checkedInTimeLabel(t.checked_in_at);
              return (
                <div
                  key={row.id}
                  className={`relative flex items-center justify-between gap-3 rounded-xl border border-line bg-sand/40 px-4 py-3${partying ? " ticket-checkin" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{row.ticket_type_name ?? "Ticket"}</p>
                    {row.attendee_name && <p className="text-xs text-ink-muted">{row.attendee_name}</p>}
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
                    {row.backup_code && showsCode(t, grp.status) && <TicketQR code={row.backup_code} />}
                    {row.backup_code && (
                      <span className="rounded-lg bg-paper px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-ink shadow-sm">
                        {row.backup_code}
                      </span>
                    )}
                    <span
                      className="rounded-pill px-2.5 py-1 text-xs font-bold"
                      style={badge === "Valid" ? VALID_PILL : USED_PILL}
                    >
                      {badge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
