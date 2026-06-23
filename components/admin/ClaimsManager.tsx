"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, StatusPill } from "@/components/admin/AdminUI";

type Row = {
  id: string; status: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  role: string | null; evidence: string | null; created_at: string;
  business?: { id: string; name: string; slug: string | null; category: string | null } | null;
};
const TONE: Record<string, "amber" | "green" | "red" | "gray"> = { pending: "amber", approved: "green", rejected: "red" };

export function ClaimsManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);

  function patch(id: string, status: string) { setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r))); router.refresh(); }

  async function approve(r: Row) {
    setBusy(r.id);
    try {
      const sb = createClient();
      const { error } = await sb.rpc("approve_business_claim", { p_claim_id: r.id });
      if (error) throw error;
      patch(r.id, "approved");
    } catch (e) { alert(e instanceof Error ? e.message : "Could not approve."); } finally { setBusy(null); }
  }
  async function reject(r: Row) {
    setBusy(r.id);
    try { await createClient().from("business_claims").update({ status: "rejected" }).eq("id", r.id); patch(r.id, "rejected"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-display font-bold text-ink">{r.business?.name ?? "Business"}</p>
                <StatusPill label={r.status} tone={TONE[r.status] ?? "gray"} />
              </div>
              <p className="mt-1 text-sm text-ink-muted">{r.contact_name ?? "—"}{r.contact_email ? ` · ${r.contact_email}` : ""}{r.contact_phone ? ` · ${r.contact_phone}` : ""}</p>
              {r.role && <p className="text-sm text-ink-soft">Role: {r.role}</p>}
              {r.evidence && <p className="mt-1 max-w-prose text-sm text-ink-soft">“{r.evidence}”</p>}
              <p className="mt-1 text-xs text-ink-faint">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => approve(r)} disabled={busy === r.id} className="rounded-pill bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">Approve</button>
                <button onClick={() => reject(r)} disabled={busy === r.id} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">Reject</button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
