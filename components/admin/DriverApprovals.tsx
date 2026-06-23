"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";

type Row = { id: string; vehicle_type: string | null; vehicle_reg: string | null; notes: string | null; created_at: string; profile?: { full_name: string | null; location_area: string | null } | null };

export function DriverApprovals({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, status: "approved" | "rejected") {
    setBusy(id);
    try {
      await createClient().from("driver_profiles").update({ driver_status: status }).eq("id", id);
      setList((l) => l.filter((r) => r.id !== id));
      router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display font-bold text-ink">{r.profile?.full_name ?? "Applicant"}</p>
              <p className="text-sm text-ink-muted">{r.profile?.location_area ?? "—"} · applied {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
              <p className="mt-2 text-sm text-ink-soft"><b>{r.vehicle_type ?? "Vehicle"}</b>{r.vehicle_reg ? ` · ${r.vehicle_reg}` : ""}</p>
              {r.notes && <p className="mt-1 max-w-prose text-sm text-ink-soft">{r.notes}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => decide(r.id, "approved")} disabled={busy === r.id} className="rounded-pill bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">Approve</button>
              <button onClick={() => decide(r.id, "rejected")} disabled={busy === r.id} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">Reject</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
