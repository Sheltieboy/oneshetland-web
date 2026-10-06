"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Empty, StatusPill } from "@/components/admin/AdminUI";
import { useNotify } from "@/components/ui/ConfirmProvider";

type Row = {
  id: string; business_id?: string; status: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  role: string | null; evidence: string | null; created_at: string; source?: string | null; source_ref?: string | null;
  business?: { id: string; name: string; slug: string | null; category: string | null } | null;
};
const TONE: Record<string, "amber" | "green" | "red" | "gray"> = { pending: "amber", approved: "green", rejected: "red" };

export function ClaimsManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const notify = useNotify();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  /** Claims approved in THIS visit stay on screen with their next step, even after the server list (which only holds pending ones) refreshes. */
  const [justApproved, setJustApproved] = useState<Set<string>>(new Set());

  function patch(id: string, status: string) { setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r))); router.refresh(); }

  async function approve(r: Row) {
    setBusy(r.id);
    try {
      const sb = createClient();
      const { error } = await sb.rpc("approve_business_claim", { p_claim_id: r.id });
      if (error) throw error;
      sb.functions.invoke("notify-claim", { body: { claim_id: r.id, outcome: "approved" } }).catch(() => {});
      setJustApproved((x) => new Set(x).add(r.id));
      patch(r.id, "approved");
    } catch (e) { notify({ title: "Couldn't approve", body: e instanceof Error ? e.message : "Could not approve.", tone: "error" }); } finally { setBusy(null); }
  }
  async function reject(r: Row) {
    setBusy(r.id);
    try {
      const sb = createClient();
      // A refused write reports in `error`; without this the screen said "rejected" and told the claimant so
      // even when nothing had changed.
      const { error } = await sb.from("business_claims").update({ status: "rejected" }).eq("id", r.id);
      if (error) throw error;
      sb.functions.invoke("notify-claim", { body: { claim_id: r.id, outcome: "rejected" } }).catch(() => {});
      patch(r.id, "rejected");
    } catch (e) { notify({ title: "Couldn't reject", body: e instanceof Error ? e.message : "Could not reject.", tone: "error" }); }
    finally { setBusy(null); }
  }

  // The empty message lives HERE, not in the page: if the page swapped this component for a placeholder when the server list emptied
  // (which is exactly what happens after approving the last pending claim), the approved row and its next step would vanish.
  if (list.length === 0) return <Empty>No claims here.</Empty>;
  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-display font-bold text-ink">{r.business?.name ?? (r.source_ref ? `${r.source_ref} (unlisted business)` : "Business")}</p>
                <StatusPill label={r.status} tone={TONE[r.status] ?? "gray"} />
                {r.source === "launch_partner_invitation" && <StatusPill label={`Launch partner invitation${r.source_ref ? ` · ${r.source_ref}` : ""}`} tone="blue" />}
              </div>
              <p className="mt-1 text-sm text-ink-muted">{r.contact_name ?? "—"}{r.contact_email ? ` · ${r.contact_email}` : ""}{r.contact_phone ? ` · ${r.contact_phone}` : ""}</p>
              {r.role && <p className="text-sm text-ink-soft">Role: {r.role}</p>}
              {r.evidence && <p className="mt-1 max-w-prose text-sm text-ink-soft">“{r.evidence}”</p>}
              <p className="mt-1 text-xs text-ink-faint">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
            {r.status === "approved" && (r.business?.id ?? r.business_id) && (
              <div className="flex flex-col items-end gap-2">
                {justApproved.has(r.id) && <p role="status" className="text-sm font-semibold text-emerald-700">Approved ✓{r.source === "launch_partner_invitation" ? " — next: grant launch-partner access" : ""}</p>}
                {r.source === "launch_partner_invitation"
                  ? <>
                      <Link href={`/admin/launch-partners/for-business/${r.business?.id ?? r.business_id}`} className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95">Continue in the launch workflow →</Link>
                      <Link href={`/admin/claims?status=launch&business=${r.business?.id ?? r.business_id}&tier=premium`} className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink">or open Launch partner access directly</Link>
                    </>
                  : <Link href={`/admin/claims?status=launch&business=${r.business?.id ?? r.business_id}`} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">Launch partner access →</Link>}
              </div>
            )}
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
