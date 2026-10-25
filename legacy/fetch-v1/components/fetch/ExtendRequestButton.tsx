"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** "Keep looking" — pushes a still-pending request's expiry out by 24h so it
 *  doesn't lapse, and clears the reminder flag so it can nudge again later. */
export function ExtendRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function extend() {
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: e } = await sb.from("delivery_requests")
        .update({ expires_at: expires, reminder_sent_at: null })
        .eq("id", requestId).eq("status", "pending");
      if (e) throw e;
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not extend.");
    } finally { setBusy(false); }
  }

  if (done) return <p className="text-center text-sm font-medium text-green-700">✓ Kept open for another day.</p>;
  return (
    <div>
      <button onClick={extend} disabled={busy}
        className="w-full rounded-pill border border-line-strong py-2.5 text-sm font-semibold text-ink transition hover:bg-sand disabled:opacity-40">
        {busy ? "…" : "Keep looking · +24h"}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
