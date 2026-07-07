"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";
import { BOATS } from "@/lib/boats-data";

type Row = {
  id: string; image_url: string | null; title: string | null; approval_status: string; created_at: string;
  vessel?: { id: string; canonical_name: string; primary_lk_number: string | null } | null;
  submitter?: { full_name: string | null } | null;
};

function vesselTitle(v: Row["vessel"]): string {
  if (!v) return "Unlinked photo";
  return v.primary_lk_number ? `${v.primary_lk_number} ${v.canonical_name}` : v.canonical_name;
}

export function VesselPhotoApprovals({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, status: "approved" | "rejected") {
    setBusy(id);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      const now = new Date().toISOString();
      await sb.from("media_assets").update({
        approval_status: status,
        reviewed_by: user?.id ?? null,
        reviewed_at: now,
        approved_at: status === "approved" ? now : null,
      }).eq("id", id);
      // Once decided the row leaves the pending queue.
      setList((l) => l.filter((r) => r.id !== id));
      router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-sand">
              {r.image_url ? <img src={r.image_url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-xs text-ink-faint">No image</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-ink">
                {r.vessel ? <Link href={`/boats/${r.vessel.id}`} className="hover:underline" style={{ color: BOATS }}>{vesselTitle(r.vessel)}</Link> : vesselTitle(r.vessel)}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                Submitted by {r.submitter?.full_name ?? "a member"} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              {r.title && <p className="mt-1 text-sm text-ink-soft">{r.title}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => decide(r.id, "approved")} disabled={busy === r.id} className="rounded-pill bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">Approve</button>
              <button onClick={() => decide(r.id, "rejected")} disabled={busy === r.id} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40">Reject</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
