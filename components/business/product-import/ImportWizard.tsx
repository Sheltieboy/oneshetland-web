"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toCsv } from "@/lib/product-import/csv";
import { LIMITS, REQUIRED_FIELDS, TEMPLATE_HEADERS, TEMPLATE_NOTES, TEMPLATE_ROWS, FIELD_LABELS, templateInstructions } from "@/lib/product-import/columns";
import { ReviewStep } from "./ReviewStep";
import { ColumnMapper } from "./ColumnMapper";
import { ACCENT, STATUS_LABEL, countBits, download, fmtWhen, type BatchDetail, type HistoryEntry, type Inspection, type PlanResponse, type Step } from "./shared";

class ApiError extends Error { code?: string; status: number; constructor(m: string, status: number, code?: string) { super(m); this.status = status; this.code = code; } }

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" }, { id: "columns", label: "Columns" }, { id: "review", label: "Review" }, { id: "importing", label: "Import" }, { id: "result", label: "Publish" },
];

export function ImportWizard({ businessId, history }: { businessId: string; history: HistoryEntry[] }) {
  const router = useRouter();
  const base = `/api/business/${businessId}/product-import`;
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [preset, setPreset] = useState<Inspection["preset"]>("generic");
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [planRes, setPlanRes] = useState<PlanResponse | null>(null);
  const [allowDup, setAllowDup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<{ phase: "apply" | "images"; done: number; total: number; failed: number; waiting?: boolean } | null>(null);
  const recent = history;
  const key = useRef<string>("");
  const alive = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const form = useCallback((extra: Record<string, string> = {}) => {
    const f = new FormData();
    if (file) f.append("file", file);
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    return f;
  }, [file]);

  async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try { res = await fetch(`${base}${path}`, init); } catch { throw new ApiError("Couldn't reach OneShetland. Check your connection and try again.", 0); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError((data as { error?: string }).error ?? "Something went wrong.", res.status, (data as { code?: string }).code);
    return data as T;
  }

  /* ── 1. Upload → inspect ─────────────────────────────────────────────── */
  async function choose(f: File | null | undefined) {
    if (!f) return;
    setErr(null);
    if (f.size > 2 * 1024 * 1024) return setErr(`That file is ${(f.size / 1048576).toFixed(1)} MB. The limit is 2 MB — split it into smaller files.`);
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const out = await api<Inspection>("/inspect", { method: "POST", body: fd });
      setFile(f); setInsp(out); setPreset(out.preset); setMapping(out.suggestedMapping); setPlanRes(null); setAllowDup(false);
      key.current = crypto.randomUUID();
      setStep("columns");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  /* ── 2. Columns → plan ───────────────────────────────────────────────── */
  const missing = REQUIRED_FIELDS.filter((f) => mapping[f] === undefined);
  const needsMapping = preset === "generic" || preset === "oneshetland";

  async function runPlan(opts: { allowDup?: boolean } = {}) {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const out = await api<PlanResponse>("/plan", {
        method: "POST",
        body: form({ preset, mapping: JSON.stringify(mapping), allowTitleDuplicates: (opts.allowDup ?? allowDup) ? "1" : "0" }),
      });
      setPlanRes(out); setStep("review");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  /* ── 3. Review → confirm → import ────────────────────────────────────── */
  async function confirm() {
    if (!file || !planRes) return;
    setBusy(true); setErr(null);
    try {
      const out = await api<{ batchId: string; status: string }>("/confirm", {
        method: "POST",
        body: form({ preset, mapping: JSON.stringify(mapping), allowTitleDuplicates: allowDup ? "1" : "0", signature: planRes.signature, idempotencyKey: key.current }),
      });
      await drive(out.batchId);
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae.message);
      if (ae.code === "stale_plan") await runPlan();
    } finally { setBusy(false); }
  }

  /** Apply every chunk, then copy photos, then show the result. Safe to run again after any interruption. */
  async function drive(batchId: string) {
    setErr(null); setStep("importing");
    try {
      let d = await api<BatchDetail>(`/batches/${batchId}`);
      const total = (d.batch.counts.create ?? 0) + (d.batch.counts.update ?? 0);
      let done = d.items.filter((i) => i.status === "applied" || i.status === "failed").length;
      let failed = d.items.filter((i) => i.status === "failed").length;
      setProgress({ phase: "apply", done, total, failed });
      while (alive.current && d.batch.status === "applying" && done < total) {
        const r = await api<{ applied: number; failed: number; remaining: number }>(`/batches/${batchId}/apply`, { method: "POST" });
        done += r.applied + r.failed; failed += r.failed;
        setProgress({ phase: "apply", done: Math.min(done, total), total, failed });
        if (r.remaining === 0) break;
      }
      d = await api<BatchDetail>(`/batches/${batchId}`);
      const withImages = d.items.filter((i) => i.status === "applied" && ["pending", "processing", "done", "partial", "failed"].includes(i.image_status)).length;
      let imgDone = d.items.filter((i) => i.status === "applied" && ["done", "partial", "failed"].includes(i.image_status)).length;
      if (withImages > imgDone) {
        setProgress({ phase: "images", done: imgDone, total: withImages, failed: 0 });
        while (alive.current) {
          const r = await api<{ done: boolean }>(`/batches/${batchId}/images`, { method: "POST" });
          if (r.done) break;
          imgDone += 1;
          setProgress({ phase: "images", done: Math.min(imgDone, withImages), total: withImages, failed: 0 });
        }
      }
      if (!alive.current) return;
      // A photo claimed by an interrupted run is handed back after a short wait. Don't call the import finished
      // while the database still says it is not: wait, and ask again.
      for (let wait = 0; wait < 12 && alive.current; wait++) {
        d = await api<BatchDetail>(`/batches/${batchId}`);
        if (d.batch.status !== "applying") break;
        setProgress({ phase: "images", done: d.items.filter((i) => ["done", "partial", "failed", "none"].includes(i.image_status)).length, total: d.items.filter((i) => i.status === "applied").length, failed: 0, waiting: true });
        await new Promise((r) => setTimeout(r, 10_000));
        for (let k = 0; k < 20; k++) { const r = await api<{ done: boolean }>(`/batches/${batchId}/images`, { method: "POST" }); if (r.done) break; }
      }
      if (!alive.current) return;
      showResult(batchId);
    } catch (e) {
      setErr(`${(e as Error).message} Your progress is saved — choose "Carry on" to continue where it stopped.`);
      setResumeId(batchId);
    }
  }
  const [resumeId, setResumeId] = useState<string | null>(null);

  /** The result has an address of its own, so Back, reload and the history list all land on the same page. */
  function showResult(batchId: string) { router.replace(`/business/${businessId}/manage/products/import/${batchId}`); }

  async function openBatch(h: HistoryEntry) {
    setBusy(true); setErr(null);
    try {
      setResumeId(h.id); await drive(h.id);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  function reset() { setStep("upload"); setFile(null); setInsp(null); setPlanRes(null); setErr(null); setProgress(null); setResumeId(null); setAllowDup(false); }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === stepIndex ? "step" : undefined} className={i === stepIndex ? "text-navy" : i < stepIndex ? "text-ink-soft" : "text-ink-muted"}>
            <span className={"mr-1 inline-grid h-5 w-5 place-items-center rounded-full text-[11px] " + (i <= stepIndex ? "text-white" : "bg-sand text-ink-soft")} style={i <= stepIndex ? { background: ACCENT } : undefined}>{i + 1}</span>{s.label}
          </li>
        ))}
      </ol>

      {err && <p role="alert" className="rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{err}</p>}
      {resumeId && step === "importing" && !busy && (
        <button onClick={() => { setBusy(true); drive(resumeId).finally(() => setBusy(false)); }} className="rounded-pill px-5 py-2.5 text-sm font-bold text-white" style={{ background: ACCENT }}>Carry on</button>
      )}

      {step === "upload" && (
        <>
          <section className="rounded-card border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold text-navy">1 · Choose your file</h2>
            <p className="mt-1 text-sm text-ink-soft">Upload a CSV of your products — from a spreadsheet, or an export from Shopify, WooCommerce or Square. Everything arrives as a <strong>draft</strong>; nothing goes live until you publish it.</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files?.[0]); }}
              className={"mt-4 grid place-items-center rounded-card border-2 border-dashed p-8 text-center transition " + (drag ? "bg-sand" : "bg-cream/40")} style={{ borderColor: `${ACCENT}66` }}>
              <p className="text-sm font-semibold text-ink-soft">Drop a .csv file here, or</p>
              <button onClick={() => fileInput.current?.click()} disabled={busy} className="mt-2 rounded-pill px-5 py-2.5 text-sm font-bold text-white shadow-soft disabled:opacity-50" style={{ background: ACCENT }}>
                {busy ? "Reading…" : "Choose a file"}
              </button>
              <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" aria-label="CSV file" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
              <p className="mt-3 text-xs text-ink-muted">CSV (UTF-8) · comma or semicolon · up to 2 MB and 500 rows. In Excel: Save As → “CSV UTF-8”.</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={() => download("oneshetland-products-template.csv", toCsv([TEMPLATE_HEADERS, ...TEMPLATE_ROWS]))} className="rounded-pill border border-line px-4 py-2 text-sm font-bold text-ink-soft hover:bg-sand">⤓ Download the template</button>
              <button onClick={() => download("oneshetland-products-instructions.txt", templateInstructions(), "text/plain;charset=utf-8")} className="rounded-pill border border-line px-4 py-2 text-sm font-bold text-ink-soft hover:bg-sand">⤓ How to fill it in</button>
              <span className="basis-full text-xs text-ink-muted">Two example products are included — delete them before uploading.</span>
            </div>
            <details className="mt-4 text-sm text-ink-soft">
              <summary className="cursor-pointer font-bold">What goes in each column?</summary>
              <ul className="mt-2 space-y-1.5">{TEMPLATE_NOTES.map((n) => <li key={n.field}><code className="rounded bg-sand px-1.5 py-0.5 text-xs">{n.field}</code> — {n.note}</li>)}</ul>
              <p className="mt-2 text-xs text-ink-muted">Photos are copied into your OneShetland shop (JPEG, PNG or WebP, up to {LIMITS.maxImages} per product, 5 MB each). We never link to the original site.</p>
            </details>
          </section>

          <section className="rounded-card border border-line bg-white p-5 shadow-soft">
            <p className="font-bold text-ink">Connect an existing shop</p>
            <p className="mt-0.5 text-sm text-ink-muted">Keep your Shopify, WooCommerce or Square products in step automatically. <span className="rounded-pill bg-sand px-2 py-0.5 text-xs font-bold text-ink-soft">Coming next</span></p>
          </section>

          {recent.length > 0 && (
            <section className="rounded-card border border-line bg-white p-5 shadow-soft" aria-labelledby="recent-h">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="recent-h" className="font-display text-lg font-bold text-navy">Import history</h2>
                <Link href={`/business/${businessId}/manage/products/import/history`} className="text-sm font-bold text-ink-soft underline underline-offset-2">All imports →</Link>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {recent.slice(0, 5).map((h) => {
                  const bits = countBits(h.counts);
                  const unfinished = h.status === "applying" || h.status === "queued";
                  return (
                    <li key={h.id} className="flex flex-wrap items-center gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{h.filename || "Import"}</p>
                        <p className="text-xs text-ink-muted">{fmtWhen(h.created_at)} · {h.total_items} row{h.total_items === 1 ? "" : "s"} · <strong>{STATUS_LABEL[h.status] ?? h.status}</strong></p>
                        {bits.length > 0 && <p className="mt-0.5 text-xs text-ink-soft">{bits.join(" · ")}</p>}
                      </div>
                      {unfinished
                        ? <button onClick={() => openBatch(h)} disabled={busy} className="rounded-pill border border-line px-3 py-1 text-xs font-bold text-ink-soft hover:bg-sand disabled:opacity-50">Carry on</button>
                        : <Link href={`/business/${businessId}/manage/products/import/${h.id}`} className="rounded-pill border border-line px-3 py-1 text-xs font-bold text-ink-soft hover:bg-sand">View result →</Link>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {step === "columns" && insp && (
        <section className="rounded-card border border-line bg-white p-5 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">2 · Check the columns</h2>
          <p className="mt-1 text-sm text-ink-soft"><strong>{insp.filename}</strong> — {insp.rowCount} row{insp.rowCount === 1 ? "" : "s"}, {insp.headers.length} columns{insp.delimiter === ";" ? ", semicolon-separated" : ""}.</p>

          {preset !== "generic" ? (
            <div className="mt-4 space-y-3">
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">We recognised this as: {insp.presetInfo.id === preset ? insp.presetInfo.label : preset}.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-sm font-bold text-ink">We&rsquo;ll bring across</p><ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">{insp.presetInfo.imports.map((x) => <li key={x}>{x}</li>)}</ul></div>
                {insp.presetInfo.ignores.length > 0 && <div><p className="text-sm font-bold text-ink">We will not import</p><ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">{insp.presetInfo.ignores.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              </div>
              {preset !== "oneshetland" && <button onClick={() => setPreset("generic")} className="text-sm font-bold text-ink-soft underline underline-offset-2">That&rsquo;s not right — let me match the columns myself</button>}
            </div>
          ) : null}

          {(preset === "generic" || preset === "oneshetland") && (
            <div className="mt-4">
              {(() => {
                const autoOk = REQUIRED_FIELDS.every((f) => insp.suggestedMapping[f] !== undefined);
                const body = <ColumnMapper headers={insp.headers} sample={insp.sample} mapping={mapping} auto={insp.suggestedMapping} onChange={setMapping} />;
                return preset === "oneshetland" && autoOk && missing.length === 0 ? (
                  <>
                    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">All your columns were matched automatically — you don&rsquo;t need to change anything.</p>
                    <details className="mt-3"><summary className="cursor-pointer text-sm font-bold text-ink-soft">See or change how your columns were matched</summary><div className="mt-3">{body}</div></details>
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-ink-soft">For each column in your file, choose what it is. Columns you leave as “Ignore” are not imported. We&rsquo;ve matched the ones we&rsquo;re sure about.</p>
                    {body}
                  </>
                );
              })()}
            </div>
          )}

          {insp.sample.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-bold text-ink-soft">First rows of your file</summary>
              <div className="mt-2 overflow-x-auto rounded-xl border border-line">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-cream/60"><tr>{insp.headers.map((h, i) => <th key={i} className="whitespace-nowrap px-2 py-1.5 font-bold text-ink-soft">{h || `(col ${i + 1})`}</th>)}</tr></thead>
                  <tbody>{insp.sample.map((r, i) => <tr key={i} className="border-t border-line">{insp.headers.map((_, j) => <td key={j} className="max-w-[14rem] truncate px-2 py-1.5 text-ink-soft">{r[j]}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </details>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <button onClick={reset} className="rounded-pill px-4 py-2 text-sm font-bold text-ink-muted hover:bg-sand">← Choose a different file</button>
            <button onClick={() => runPlan()} disabled={busy || (needsMapping && missing.length > 0)} className="rounded-pill px-5 py-2.5 text-sm font-bold text-white shadow-soft disabled:opacity-50" style={{ background: ACCENT }}>
              {busy ? "Checking your file…" : "Check my products →"}
            </button>
            {needsMapping && missing.length > 0 && <p className="basis-full text-right text-sm font-semibold text-rose-700" role="status">Match the required columns first: {missing.map((f) => FIELD_LABELS[f]).join(" and ")}.</p>}
          </div>
        </section>
      )}

      {step === "review" && planRes && (
        <ReviewStep plan={planRes.plan} allowDup={allowDup} busy={busy}
          onAllowDup={(v) => { setAllowDup(v); runPlan({ allowDup: v }); }}
          onConfirm={confirm} onBack={() => setStep("columns")} />
      )}

      {step === "importing" && (
        <section className="rounded-card border border-line bg-white p-6 shadow-soft" aria-live="polite">
          <h2 className="font-display text-lg font-bold text-navy">{progress?.phase === "images" ? "Copying photos…" : "Adding your products as drafts…"}</h2>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuemin={0} aria-valuemax={progress?.total ?? 0} aria-valuenow={progress?.done ?? 0}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 5}%`, background: ACCENT }} />
          </div>
          <p className="mt-2 text-sm text-ink-soft">{progress ? `${progress.done} of ${progress.total}` : "Starting"}{progress?.failed ? ` · ${progress.failed} could not be imported` : ""}</p>
          {progress?.waiting && <p className="mt-1 text-sm font-semibold text-amber-800">Waiting for photos from an earlier attempt to be released — this takes a minute or so. You don&rsquo;t need to do anything.</p>}
          <p className="mt-3 text-xs text-ink-muted">You can leave this page — the import carries on from where it stopped when you come back (you&rsquo;ll find it under “Import history”). Products are drafts; nothing is live.</p>
        </section>
      )}

      <p className="text-xs text-ink-muted">
        <Link href="/selling-policy" target="_blank" className="underline underline-offset-2">What can I sell on OneShetland?</Link>
      </p>
    </div>
  );
}
