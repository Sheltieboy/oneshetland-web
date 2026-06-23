"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Empty, StatusPill } from "@/components/admin/AdminUI";

type Req = { id: string; status: string; requested_at: string; reviewer_notes: string | null; business?: { name: string; category: string | null } | null };
type Alert = { id: string; business_name: string | null; message: string | null; type: string | null; is_active: boolean; starts_at: string | null; expires_at: string | null };
const TONE: Record<string, "amber" | "green" | "blue" | "red" | "gray"> = { requested: "amber", approved: "green", active: "blue", rejected: "red", suspended: "gray" };

export function AlertsManager({ requests, alerts }: { requests: Req[]; alerts: Alert[] }) {
  const router = useRouter();
  const [reqs, setReqs] = useState(requests);
  const [live, setLive] = useState(alerts);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  async function review(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      await sb.from("business_alert_access").update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null, reviewer_notes: note[id] || null }).eq("id", id);
      setReqs((l) => l.map((r) => (r.id === id ? { ...r, status: decision } : r)));
      router.refresh();
    } finally { setBusy(null); }
  }
  async function forceEnd(id: string) {
    setBusy(id);
    try {
      await createClient().from("partner_alerts").update({ is_active: false, expires_at: new Date().toISOString() }).eq("id", id);
      setLive((l) => l.map((a) => (a.id === id ? { ...a, is_active: false } : a)));
      router.refresh();
    } finally { setBusy(null); }
  }

  const now = Date.now();
  const liveNow = live.filter((a) => a.is_active && (!a.expires_at || new Date(a.expires_at).getTime() > now));

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Access requests</h2>
        {reqs.length === 0 ? <Empty>No access requests.</Empty> : (
          <div className="space-y-3">
            {reqs.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display font-bold text-ink">{r.business?.name ?? "Business"}</p>
                    <p className="text-sm text-ink-muted">{r.business?.category ?? ""} · requested {new Date(r.requested_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                  </div>
                  <StatusPill label={r.status} tone={TONE[r.status] ?? "gray"} />
                </div>
                {r.status === "requested" && (
                  <div className="mt-3 space-y-2">
                    <input value={note[r.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))} placeholder="Internal note (optional)" className="auth-input text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => review(r.id, "approved")} disabled={busy === r.id} className="rounded-pill bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">Approve</button>
                      <button onClick={() => review(r.id, "rejected")} disabled={busy === r.id} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">Reject</button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Live now</h2>
        {liveNow.length === 0 ? <Empty>No live alerts.</Empty> : (
          <div className="space-y-3">
            {liveNow.map((a) => (
              <Card key={a.id} className="border-rose-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">{a.business_name ?? "Business"} <StatusPill label={a.type ?? "alert"} tone="red" /></p>
                    <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{a.message}</p>
                    {a.expires_at && <p className="mt-1 text-xs text-ink-faint">Ends {new Date(a.expires_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                  </div>
                  <button onClick={() => forceEnd(a.id)} disabled={busy === a.id} className="shrink-0 rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">Force end</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
