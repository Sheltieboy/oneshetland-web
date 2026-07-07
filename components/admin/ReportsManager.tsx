"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, StatusPill } from "@/components/admin/AdminUI";

type Row = {
  id: string;
  reporter_id: string | null;
  content_type: string;
  content_id: string | null;
  reported_user_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reporter?: { full_name: string | null; location_area: string | null } | null;
};

const TONE: Record<string, "amber" | "blue" | "red" | "green" | "gray"> = {
  open: "amber", reviewing: "blue", actioned: "red", dismissed: "gray",
};

const TYPE_ICON: Record<string, string> = {
  listing: "🏷️", review: "⭐", event: "📅", memory: "📷", message: "💬",
  comment: "💭", hub_post: "📣", profile: "👤", boat: "⛵",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ReportsManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(r: Row, status: "reviewing" | "actioned" | "dismissed") {
    setBusy(r.id);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      const { error } = await sb.from("content_reports").update({
        status,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      }).eq("id", r.id);
      if (error) throw error;
      setList((l) => l.map((x) => (x.id === r.id ? { ...x, status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() } : x)));
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update report.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-display font-bold text-ink">
                  {TYPE_ICON[r.content_type] ?? "🚩"} <span className="capitalize">{r.content_type.replace(/_/g, " ")}</span>
                </p>
                <StatusPill label={r.status} tone={TONE[r.status] ?? "gray"} />
              </div>
              <p className="mt-1 text-sm font-semibold text-ink-soft">Reason: <span className="font-normal">{r.reason}</span></p>
              {r.details && <p className="mt-1 max-w-prose text-sm text-ink-soft">&ldquo;{r.details}&rdquo;</p>}
              <p className="mt-1 text-xs text-ink-muted">
                {r.content_id && <>Content ID: <span className="font-mono">{r.content_id}</span> · </>}
                {r.reported_user_id && <>Reported user: <span className="font-mono">{r.reported_user_id}</span> · </>}
                Reported by {r.reporter?.full_name ?? "—"}{r.reporter?.location_area ? ` · ${r.reporter.location_area}` : ""}
              </p>
              <p className="mt-1 text-xs text-ink-faint">{fmtDate(r.created_at)}{r.reviewed_at ? ` · reviewed ${fmtDate(r.reviewed_at)}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.status !== "reviewing" && (
                <button onClick={() => setStatus(r, "reviewing")} disabled={busy === r.id}
                  className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40">Reviewing</button>
              )}
              {r.status !== "actioned" && (
                <button onClick={() => setStatus(r, "actioned")} disabled={busy === r.id}
                  className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">Actioned</button>
              )}
              {r.status !== "dismissed" && (
                <button onClick={() => setStatus(r, "dismissed")} disabled={busy === r.id}
                  className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand disabled:opacity-40">Dismiss</button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
