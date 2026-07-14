"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CONFETTI = ["#d4921a", "#12B3D6", "#10B981", "#7C3AED", "#E0722A", "#032F4C"];

/**
 * Live-refreshes the My-tickets page and, when one of the holder's tickets is
 * scanned (status → 'used'), plays a "you're in — enjoy!" celebration. Uses the
 * UPDATE payload's old/new status (needs REPLICA IDENTITY FULL) to fire only on
 * the actual transition, not on every change.
 */
export function TicketsRealtime({ userId }: { userId: string }) {
  const router = useRouter();
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`my-tickets-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "event_tickets", filter: `holder_id=eq.${userId}` },
        (payload) => {
          const next = (payload.new as { status?: string } | null)?.status;
          const prev = (payload.old as { status?: string } | null)?.status;
          if (next === "used" && prev !== "used") {
            setCelebrate(true);
            window.setTimeout(() => setCelebrate(false), 5000);
          }
          router.refresh();
        },
      )
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [userId, router]);

  if (!celebrate) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black/10"
      style={{ animation: "ticket-fade-inout 5s ease forwards" }}
      aria-hidden
    >
      {Array.from({ length: 48 }).map((_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${(i * 7 + (i % 5) * 3) % 100}%`,
            top: "-12vh",
            width: 9,
            height: 14,
            background: CONFETTI[i % CONFETTI.length],
            borderRadius: 2,
            animation: `ticket-confetti-fall ${2.4 + (i % 6) * 0.35}s ${(i % 10) * 0.06}s ease-in forwards`,
          }}
        />
      ))}
      <div
        className="rounded-3xl bg-paper px-9 py-7 text-center shadow-lift"
        style={{ animation: "ticket-pop 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) both" }}
      >
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-4xl text-emerald-600">✓</div>
        <p className="mt-3 font-display text-2xl font-bold text-ink">You&apos;re in!</p>
        <p className="mt-1 text-ink-soft">Checked in — enjoy the event 🎉</p>
      </div>
    </div>
  );
}
