"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { REQUEST_STATUS_PILL, type RequestStatus } from "@/lib/fetch-data";

const ORDER: RequestStatus[] = ["collected", "matched", "pending"];

/**
 * Always-on Fetch status chip in the site header. Shows the requester's most
 * progressed in-flight delivery and updates live via Supabase realtime — so a
 * customer always sees where their Fetch is, from any page on the site.
 */
export function FetchStatusIndicator({ userId, initialStatus, initialCount }: {
  userId: string; initialStatus: string | null; initialCount: number;
}) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const sb = createClient();

    async function refresh() {
      const { data } = await sb.from("delivery_requests")
        .select("status")
        .eq("customer_id", userId)
        .in("status", ["pending", "matched", "collected"]);
      const rows = (data ?? []) as { status: RequestStatus }[];
      setCount(rows.length);
      setStatus(rows.length ? rows.map((r) => r.status).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0] : null);
    }

    const channel = sb
      .channel(`fetch-header-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_requests", filter: `customer_id=eq.${userId}` }, () => void refresh())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [userId]);

  if (!status || count === 0) return null;
  const pill = REQUEST_STATUS_PILL[status as RequestStatus];

  return (
    <Link
      href="/fetch"
      title="Your Fetch delivery status"
      className="hidden items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-bold transition hover:brightness-95 sm:inline-flex"
      style={{ background: pill.bg, color: pill.text }}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: pill.text }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: pill.text }} />
      </span>
      🛵 {pill.label}{count > 1 ? ` · ${count}` : ""}
    </Link>
  );
}
