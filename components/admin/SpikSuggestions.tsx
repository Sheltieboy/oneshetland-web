"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";

type Row = {
  id: string; word: string; field_label: string | null; field_name: string | null;
  current_value: string | null; suggested_value: string | null;
  submitter_name: string | null; show_name: boolean | null; status: string; created_at: string;
};

export function SpikSuggestions({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function setStatus(id: string, status: "reviewed" | "pending") {
    setBusy(id);
    try {
      await createClient().from("spik_suggestions").update({ status, reviewed_at: status === "reviewed" ? new Date().toISOString() : null }).eq("id", id);
      setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));
      router.refresh();
    } finally { setBusy(null); }
  }
  async function copy(id: string, val: string) {
    try { await navigator.clipboard.writeText(val); setCopied(id); setTimeout(() => setCopied(null), 1500); } catch { /* */ }
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Card key={r.id}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-display font-bold text-ink">{r.word} <span className="text-sm font-normal text-ink-muted">· {r.field_label ?? r.field_name}</span></p>
            <span className="text-xs text-ink-faint">{(r.show_name && r.submitter_name) ? r.submitter_name : "anonymous"} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-sand/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Current</p>
              <p className="mt-0.5 text-sm text-ink-soft">{r.current_value || "Not set"}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Suggested</p>
              <p className="mt-0.5 text-sm text-ink">{r.suggested_value}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {r.suggested_value && <button onClick={() => copy(r.id, r.suggested_value!)} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand">{copied === r.id ? "Copied!" : "Copy value"}</button>}
            {r.status === "pending" ? (
              <button onClick={() => setStatus(r.id, "reviewed")} disabled={busy === r.id} className="rounded-pill bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">Mark reviewed</button>
            ) : (
              <button onClick={() => setStatus(r.id, "pending")} disabled={busy === r.id} className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40">Undo</button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
