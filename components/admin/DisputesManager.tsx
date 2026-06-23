"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";

type Row = { id: string; arrived_at: string | null; collected_at: string | null; waiting_fee_pence: number | null; created_at: string };

export function DisputesManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(id: string, confirmed: boolean) {
    setBusy(id);
    try {
      const patch = confirmed ? { customer_confirmed: true } : { customer_confirmed: false, waiting_fee_pence: 0 };
      await createClient().from("waiting_events").update(patch).eq("id", id);
      setList((l) => l.filter((r) => r.id !== id));
      router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {list.map((r) => {
        const wait = r.arrived_at && r.collected_at ? Math.round((new Date(r.collected_at).getTime() - new Date(r.arrived_at).getTime()) / 60000) : null;
        return (
          <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">Waiting fee dispute</p>
              <p className="text-sm text-ink-muted">{wait != null ? `${wait} min wait · ` : ""}£{((r.waiting_fee_pence ?? 0) / 100).toFixed(2)} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => resolve(r.id, true)} disabled={busy === r.id} className="rounded-pill bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">Confirm fee</button>
              <button onClick={() => resolve(r.id, false)} disabled={busy === r.id} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40">Waive fee</button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
