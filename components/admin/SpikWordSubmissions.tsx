"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";

type Row = {
  id: string; word: string; alternate_spelling: string | null; pronunciation: string | null;
  short_meaning: string | null; spik_meaning: string | null; example_sentence: string | null;
  part_of_speech: string | null; category: string | null; usage_level: string | null;
  era: string | null; tone: string | null; origin: string | null; notes: string | null;
  submitter_name: string | null; show_name: boolean | null; status: string;
  published_word_id: number | null; created_at: string;
};

const FIELDS: [keyof Row, string][] = [
  ["short_meaning", "Meaning"], ["spik_meaning", "Full meaning"], ["example_sentence", "Example"],
  ["pronunciation", "Pronunciation"], ["alternate_spelling", "Alt spelling"], ["part_of_speech", "Part of speech"],
  ["category", "Category"], ["usage_level", "Usage"], ["era", "Era"], ["tone", "Tone"], ["origin", "Origin"], ["notes", "Notes"],
];

export function SpikWordSubmissions({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; msg: string } | null>(null);

  async function approve(id: string) {
    setBusy(id); setErr(null);
    try {
      const { error } = await createClient().rpc("approve_spik_word_submission", { p_id: id });
      if (error) throw error;
      setList((l) => l.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
      router.refresh();
    } catch (e) {
      setErr({ id, msg: (e as { message?: string })?.message || "Could not publish." });
    } finally { setBusy(null); }
  }

  async function setStatus(id: string, status: "rejected" | "pending") {
    setBusy(id); setErr(null);
    try {
      await createClient().from("spik_word_submissions")
        .update({ status, reviewed_at: status === "rejected" ? new Date().toISOString() : null }).eq("id", id);
      setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));
      router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Card key={r.id}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-lg font-bold text-ink">{r.word}</p>
            <span className="text-xs text-ink-faint">
              {(r.show_name && r.submitter_name) ? r.submitter_name : "anonymous"} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          </div>

          <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            {FIELDS.filter(([k]) => r[k]).map(([k, label]) => (
              <div key={String(k)} className="flex gap-2">
                <dt className="shrink-0 font-semibold text-ink-muted">{label}:</dt>
                <dd className="text-ink">{String(r[k])}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {r.status === "pending" && (
              <>
                <button onClick={() => approve(r.id)} disabled={busy === r.id}
                  className="rounded-pill bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">
                  {busy === r.id ? "Publishing…" : "Approve & publish"}
                </button>
                <button onClick={() => setStatus(r.id, "rejected")} disabled={busy === r.id}
                  className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40">
                  Reject
                </button>
              </>
            )}
            {r.status === "approved" && (
              <span className="rounded-pill bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Published ✓{r.published_word_id ? ` · #${r.published_word_id}` : ""}
              </span>
            )}
            {r.status === "rejected" && (
              <>
                <span className="rounded-pill bg-sand px-3 py-1 text-xs font-bold text-ink-muted">Rejected</span>
                <button onClick={() => setStatus(r.id, "pending")} disabled={busy === r.id}
                  className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40">Undo</button>
              </>
            )}
          </div>
          {err?.id === r.id && <p className="mt-2 text-sm font-medium text-rose-600">{err.msg}</p>}
        </Card>
      ))}
    </div>
  );
}
