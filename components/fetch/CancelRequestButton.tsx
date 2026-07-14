"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Requester cancel (allowed while pending or matched). Notifies the driver if matched. */
export function CancelRequestButton({ requestId, isMatched }: { requestId: string; isMatched: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!confirm(isMatched
      ? "A driver has already accepted this. They'll be notified. Cancel anyway?"
      : "Cancel this request? No driver will be sent.")) return;
    setBusy(true); setError(null);
    try {
      const sb = createClient();
      if (isMatched) {
        // A driver already accepted → cancel-payment releases the card
        // pre-authorisation hold, then marks the request cancelled.
        const { data, error: e } = await sb.functions.invoke("cancel-payment", { body: { request_id: requestId } });
        if (e) throw e;
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
        try { await sb.functions.invoke("notify-drivers", { body: { request_id: requestId, event: "cancelled" } }); } catch { /* non-fatal */ }
      } else {
        // Not yet matched → no hold to release.
        const { error: e } = await sb.from("delivery_requests").update({ status: "cancelled" }).eq("id", requestId);
        if (e) throw e;
      }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not cancel."); } finally { setBusy(false); }
  }

  return (
    <div>
      <button onClick={cancel} disabled={busy}
        className="w-full rounded-pill border border-red-300 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-40">
        {busy ? "Cancelling…" : "Cancel this request"}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
