"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to realtime changes for one delivery request (the request row and
 * its waiting events) and refreshes the server-rendered detail page whenever
 * anything changes — so the status timeline, driver info and fees stay live,
 * exactly like the app's request-detail subscription.
 */
export function RequestLive({ requestId }: { requestId: string }) {
  const router = useRouter();
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`fetch-request-${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_requests", filter: `id=eq.${requestId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "waiting_events", filter: `request_id=eq.${requestId}` }, () => router.refresh())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [requestId, router]);
  return <p className="text-center text-xs text-ink-faint">🔴 Live — this page updates automatically</p>;
}
