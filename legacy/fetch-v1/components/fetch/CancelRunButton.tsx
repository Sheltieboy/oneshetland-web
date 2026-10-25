"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/ConfirmProvider";

/** Driver cancels one of their own open runs. Detaches any requests they caught
 *  (still pending) back to the open pool so another run can pick them up. */
export function CancelRunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!(await confirm({ title: "Cancel run?", body: "Requests you've accepted stay with you; ones you'd caught but not started go back to the pool.", confirmLabel: "Cancel run", danger: true }))) return;
    setBusy(true);
    try {
      const sb = createClient();
      await sb.from("runs").update({ status: "cancelled" }).eq("id", runId).eq("status", "open");
      // Free up requests that were caught but not yet accepted/collected.
      await sb.from("delivery_requests").update({ run_id: null }).eq("run_id", runId).eq("status", "pending");
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <button onClick={cancel} disabled={busy}
      className="text-xs font-semibold text-red-600 transition hover:text-red-700 disabled:opacity-40">
      {busy ? "…" : "Cancel run"}
    </button>
  );
}
