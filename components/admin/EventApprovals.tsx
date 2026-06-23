"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";

type Row = { id: string; title: string; starts_at: string; venue: string | null; hub?: { name: string; logo_url: string | null } | null };

export function EventApprovals({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);

  async function approve(id: string) {
    setBusy(id);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      await sb.from("events").update({ calendar_approved: true, calendar_approved_by: user?.id ?? null }).eq("id", id);
      setList((l) => l.filter((r) => r.id !== id));
      router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-sand">
                {r.hub?.logo_url ? <img src={r.hub.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="font-display font-bold text-ink-faint">{(r.hub?.name ?? "?").slice(0, 1)}</span>}
              </div>
              <div>
                <p className="font-display font-bold text-ink">{r.title}</p>
                <p className="text-sm text-ink-muted">{r.hub?.name ?? "Hub"} · {new Date(r.starts_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{r.venue ? ` · ${r.venue}` : ""}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/whats-on/${r.id}`} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">Preview</Link>
              <button onClick={() => approve(r.id)} disabled={busy === r.id} className="rounded-pill bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">Approve</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
