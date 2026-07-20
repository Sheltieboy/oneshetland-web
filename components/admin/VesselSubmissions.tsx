"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";
import { hullMaterialLabel } from "@/lib/boats-data";

type Row = {
  id: string; canonical_name: string; primary_lk_number: string | null; built_year: number | null;
  builder: string | null; yard_number: string | null; hull_material: string | null;
  country_of_build: string | null; status: string | null; former_names: string | null;
  registration_note: string | null; identity_notes: string | null; possible_duplicate_id: string | null;
  submitter_name: string | null; show_name: boolean | null; submission_status: string;
  published_vessel_id: string | null; created_at: string;
};

const FIELDS: [keyof Row, string][] = [
  ["primary_lk_number", "Reg / LK number"], ["built_year", "Built"], ["builder", "Builder / yard"],
  ["yard_number", "Yard no."], ["country_of_build", "Country"], ["status", "Status"],
  ["former_names", "Former names"], ["registration_note", "Reg note"], ["identity_notes", "Notes"],
];

export function VesselSubmissions({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; msg: string } | null>(null);

  async function approve(id: string) {
    setBusy(id); setErr(null);
    try {
      const { error } = await createClient().rpc("approve_vessel_submission", { p_id: id });
      if (error) throw error;
      setList((l) => l.map((r) => (r.id === id ? { ...r, submission_status: "approved" } : r)));
      router.refresh();
    } catch (e) {
      setErr({ id, msg: (e as { message?: string })?.message || "Could not publish." });
    } finally { setBusy(null); }
  }

  async function setStatus(id: string, submission_status: "rejected" | "pending") {
    setBusy(id); setErr(null);
    try {
      await createClient().from("vessel_submissions")
        .update({ submission_status, reviewed_at: submission_status === "rejected" ? new Date().toISOString() : null }).eq("id", id);
      setList((l) => l.map((r) => (r.id === id ? { ...r, submission_status } : r)));
      router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-lg font-bold text-ink">
              {r.primary_lk_number ? <span className="text-ink-soft">{r.primary_lk_number} </span> : null}{r.canonical_name}
            </p>
            <span className="text-xs text-ink-faint">
              {(r.show_name && r.submitter_name) ? r.submitter_name : "anonymous"} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          </div>

          {r.possible_duplicate_id && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              ⚠ Submitter flagged a possible existing match —{" "}
              <a href={`/boats/${r.possible_duplicate_id}`} target="_blank" rel="noreferrer" className="underline">check it&apos;s not a duplicate hull</a> before approving.
            </p>
          )}

          <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            {FIELDS.filter(([k]) => r[k] != null && r[k] !== "").map(([k, label]) => (
              <div key={String(k)} className="flex gap-2">
                <dt className="shrink-0 font-semibold text-ink-muted">{label}:</dt>
                <dd className="text-ink">{k === "hull_material" ? hullMaterialLabel(String(r[k])) : String(r[k])}</dd>
              </div>
            ))}
            {r.hull_material && (
              <div className="flex gap-2"><dt className="shrink-0 font-semibold text-ink-muted">Hull:</dt><dd className="text-ink">{hullMaterialLabel(r.hull_material)}</dd></div>
            )}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {r.submission_status === "pending" && (
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
            {r.submission_status === "approved" && (
              <span className="rounded-pill bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Published ✓{r.published_vessel_id ? <> · <a href={`/boats/${r.published_vessel_id}`} target="_blank" rel="noreferrer" className="underline">view</a></> : null}
              </span>
            )}
            {r.submission_status === "rejected" && (
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
