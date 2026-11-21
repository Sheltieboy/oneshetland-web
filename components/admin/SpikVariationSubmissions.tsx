"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";
import { SpikPrivateNote } from "@/components/admin/SpikPrivateNote";

type Region = { id: string; name: string };

type Row = {
  id: string;
  word_id: number;
  /** null = the contributor chose "I'm not sure": an editor must choose the area before approving. */
  region_id: string | null;
  region_name: string | null;
  variant_spelling: string | null;
  pronunciation: string | null;
  word_audio_url: string | null;
  sentence_text: string | null;
  sentence_audio_url: string | null;
  contributor_name: string | null;
  show_name: boolean | null;
  status: string;
  created_at: string;
  word?: { word: string } | null;
  /** Editors-only detail from spik_word_variation_notes (null when the contributor added none). */
  private_detail?: { note: string | null; also_region_names: string[] | null; region_confidence: string | null } | null;
};

export function SpikVariationSubmissions({ rows, regions = [] }: { rows: Row[]; regions?: Region[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; msg: string } | null>(null);
  const [areaPick, setAreaPick] = useState<Record<string, string>>({});

  // Choose (or correct) the area of a pending variation, from the existing list only.
  async function setArea(id: string) {
    const regionId = areaPick[id];
    if (!regionId) return;
    setBusy(id); setErr(null);
    try {
      const { data, error } = await createClient().rpc("set_spik_word_variation_region", { p_id: id, p_region_id: regionId });
      if (error) throw error;
      setList((l) => l.map((r) => (r.id === id ? { ...r, region_id: regionId, region_name: (data as string) ?? r.region_name } : r)));
      setAreaPick((p) => { const n = { ...p }; delete n[id]; return n; });
    } catch (e) {
      setErr({ id, msg: (e as { message?: string })?.message || "Could not set the area." });
    } finally { setBusy(null); }
  }

  async function approve(id: string) {
    setBusy(id); setErr(null);
    try {
      const { error } = await createClient().rpc("approve_spik_word_variation", { p_id: id });
      if (error) throw error;
      setList((l) => l.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
      router.refresh();
    } catch (e) {
      setErr({ id, msg: (e as { message?: string })?.message || "Could not approve." });
    } finally { setBusy(null); }
  }

  async function setStatus(id: string, status: "rejected" | "pending") {
    setBusy(id); setErr(null);
    try {
      await createClient().from("spik_word_variations")
        .update({ status, reviewed_at: status === "rejected" ? new Date().toISOString() : null }).eq("id", id);
      setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));
      router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-lg font-bold text-ink">
              {r.word?.word ?? `#${r.word_id}`}
              {r.variant_spelling && r.variant_spelling !== r.word?.word && (
                <span className="ml-2 font-normal text-ink-soft">→ {r.variant_spelling}</span>
              )}
              {r.region_id ? (
                <span className="ml-2 rounded-pill bg-sky-100 px-2 py-0.5 align-middle text-xs font-bold text-sky-700">📍 {r.region_name}</span>
              ) : (
                <span className="ml-2 rounded-pill bg-amber-100 px-2 py-0.5 align-middle text-xs font-bold text-amber-800">📍 Area not chosen</span>
              )}
            </p>
            <span className="text-xs text-ink-faint">
              {(r.show_name && r.contributor_name) ? r.contributor_name : "anonymous"} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          </div>

          <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            {r.pronunciation && (
              <div className="flex gap-2"><dt className="shrink-0 font-semibold text-ink-muted">Pronunciation:</dt><dd className="text-ink">/{r.pronunciation}/</dd></div>
            )}
            {r.sentence_text && (
              <div className="flex gap-2 sm:col-span-2"><dt className="shrink-0 font-semibold text-ink-muted">Example:</dt><dd className="italic text-ink">“{r.sentence_text}”</dd></div>
            )}
          </dl>

          {(r.word_audio_url || r.sentence_audio_url) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {r.word_audio_url && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Word audio</p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={r.word_audio_url} className="mt-1 w-full" />
                </div>
              )}
              {r.sentence_audio_url && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Sentence audio</p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={r.sentence_audio_url} className="mt-1 w-full" />
                </div>
              )}
            </div>
          )}

          <SpikPrivateNote
            note={r.private_detail?.note}
            alsoRegions={r.private_detail?.also_region_names}
            confidence={r.private_detail?.region_confidence}
          />

          {r.status === "pending" && regions.length > 0 && (
            <div className={"mt-4 rounded-lg border p-3 text-sm " + (r.region_id ? "border-line" : "border-amber-300 bg-amber-50")}>
              {!r.region_id && (
                <p className="mb-2 font-semibold text-amber-900">
                  The contributor wasn&apos;t sure which area this belongs to. Choose one before approving — only that area is shown publicly.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={`area-${r.id}`} className="font-semibold text-ink-muted">{r.region_id ? "Change area:" : "Area:"}</label>
                <select
                  id={`area-${r.id}`}
                  value={areaPick[r.id] ?? r.region_id ?? ""}
                  onChange={(e) => setAreaPick((p) => ({ ...p, [r.id]: e.target.value }))}
                  className="rounded-lg border border-line bg-paper px-3 py-1.5 text-ink"
                >
                  <option value="" disabled>Choose an area…</option>
                  {regions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button
                  onClick={() => setArea(r.id)}
                  disabled={busy === r.id || !areaPick[r.id] || areaPick[r.id] === r.region_id}
                  className="rounded-pill border border-line-strong px-3 py-1 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40"
                >
                  Save area
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {r.status === "pending" && (
              <>
                <button onClick={() => approve(r.id)} disabled={busy === r.id || !r.region_id}
                  title={r.region_id ? undefined : "Choose an area first"}
                  className="rounded-pill bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">
                  {busy === r.id ? "Approving…" : "Approve"}
                </button>
                <button onClick={() => setStatus(r.id, "rejected")} disabled={busy === r.id}
                  className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40">
                  Reject
                </button>
                <a href={`/spik/${r.word_id}`} target="_blank" rel="noreferrer"
                  className="text-sm font-semibold text-ink-muted underline-offset-2 hover:underline">View word ↗</a>
              </>
            )}
            {r.status === "approved" && (
              <span className="rounded-pill bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Live ✓</span>
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
