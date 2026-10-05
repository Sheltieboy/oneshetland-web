"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buildReport } from "@/lib/product-import/report";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ACCENT, Badge, download, rowsLabel, type BatchDetail, type BatchRow } from "./shared";

type PublishResult = { id: string; title: string; ok: boolean; reason?: string };

export function ResultStep({ businessId, detail, canPublish, onChanged, onNewImport }: {
  businessId: string;
  detail: BatchDetail;
  canPublish: boolean;
  onChanged: () => Promise<void> | void;
  onNewImport: () => void;
}) {
  const confirm = useConfirm();
  const { batch, items } = detail;
  const base = `/api/business/${businessId}/product-import`;
  const undone = batch.status === "undone";

  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.filter((i) => i.publish === "ready").map((i) => i.product!.id)));
  const [ack, setAck] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"publish" | "undo" | null>(null);
  const [pubMsg, setPubMsg] = useState<{ tone: "ok" | "err"; text: string; code?: string } | null>(null);
  const [pubResults, setPubResults] = useState<PublishResult[]>([]);
  const [undoBlockers, setUndoBlockers] = useState<{ title: string; reason: string }[] | null>(null);
  const [undoMsg, setUndoMsg] = useState<string | null>(null);

  const applied = items.filter((i) => i.status === "applied");
  const failed = items.filter((i) => i.status === "failed");
  const created = applied.filter((i) => i.action === "create").length;
  const updated = applied.filter((i) => i.action === "update").length;
  const imgProblems = items.filter((i) => i.imageProblems.length > 0 || i.image_status === "failed" || i.image_status === "partial");
  const publishable = items.filter((i) => i.product && i.status === "applied");
  const daysLeft = Math.max(0, Math.ceil((new Date(batch.undo_expires_at).getTime() - Date.now()) / 86_400_000));
  const canUndo = (batch.status === "complete" || batch.status === "complete_with_errors") && daysLeft > 0;

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAck = (id: string) => setAck((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const chosen = useMemo(() => publishable.filter((i) => selected.has(i.product!.id) && (i.publish === "ready" || (i.publish === "needs_review" && ack.has(i.product!.id)))), [publishable, selected, ack]);

  async function publish() {
    if (!chosen.length) return;
    setBusy("publish"); setPubMsg(null); setPubResults([]);
    try {
      const res = await fetch(`${base}/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: chosen.map((i) => i.product!.id), acknowledgePolicy: [...ack] }),
      });
      const data = await res.json();
      if (!res.ok) { setPubMsg({ tone: "err", text: data.error ?? "Couldn't publish.", code: data.code }); return; }
      setPubResults(data.results);
      const ok = data.results.filter((r: PublishResult) => r.ok).length;
      const bad = data.results.length - ok;
      setPubMsg({ tone: bad ? "err" : "ok", text: `${ok} product${ok === 1 ? "" : "s"} published${bad ? `, ${bad} could not be` : ""}.` });
      await onChanged();
    } catch { setPubMsg({ tone: "err", text: "Couldn't reach OneShetland. Check your connection and try again." }); }
    finally { setBusy(null); }
  }

  async function undo() {
    const go = await confirm({
      title: "Undo this import?",
      body: <>This removes the {created} product{created === 1 ? "" : "s"} this import added{updated ? <> and puts back the {updated} it changed (fields you have edited since are kept)</> : null}. It only works if none of them has been published, ordered or edited since.</>,
      confirmLabel: "Undo import", danger: true,
    });
    if (!go) return;
    setBusy("undo"); setUndoBlockers(null); setUndoMsg(null);
    try {
      const res = await fetch(`${base}/batches/${batch.id}/undo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setUndoMsg(data.error ?? "Couldn't undo."); return; }
      if (data.ok === false) { setUndoBlockers(data.blockers ?? []); return; }
      setUndoMsg(`Undone: ${data.deleted ?? 0} product${data.deleted === 1 ? "" : "s"} removed${data.reverted_fields ? `, ${data.reverted_fields} field${data.reverted_fields === 1 ? "" : "s"} restored` : ""}.`);
      await onChanged();
    } catch { setUndoMsg("Couldn't reach OneShetland. Try again."); }
    finally { setBusy(null); }
  }

  const reportItems = items.map((i) => ({ rows: i.row_numbers, title: i.title ?? "", ref: i.ext_ref, sku: i.sku, action: i.action, status: i.status, errors: i.errors, warnings: i.warnings, imageProblems: i.imageProblems }));
  const hasProblems = failed.length > 0 || imgProblems.length > 0 || items.some((i) => i.action === "error" || i.action === "skip");

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-line bg-white p-5 shadow-soft">
        <p className="font-display text-xl font-bold text-navy" role="status">
          {undone ? "This import was undone" : batch.status === "complete_with_errors" ? "Import finished — some things need a look" : "Import finished"}
        </p>
        {!undone && (
          <p className="mt-1.5 text-sm text-ink-soft">
            {created} new product{created === 1 ? "" : "s"} added as <strong>drafts</strong>{updated ? `, ${updated} updated` : ""}
            {failed.length ? `, ${failed.length} could not be imported` : ""}. <strong>Nothing is live yet.</strong>
          </p>
        )}
        {hasProblems && !undone && (
          <button onClick={() => download("oneshetland-import-report.csv", buildReport(reportItems, { onlyProblems: true }))}
            className="mt-3 rounded-pill border border-line bg-white px-3 py-1 text-xs font-bold text-ink-soft hover:bg-sand">⤓ Download the problem rows (CSV)</button>
        )}
      </div>

      {failed.length > 0 && !undone && (
        <section className="rounded-card border border-rose-200 bg-rose-50 p-4">
          <p className="font-bold text-rose-800">Could not be imported</p>
          <ul className="mt-2 space-y-1.5 text-sm text-rose-800">
            {failed.map((i) => <li key={i.id}><strong>{i.title}</strong> <span className="text-rose-700/80">({rowsLabel(i.row_numbers)})</span> — {i.errors.map((e) => e.message).join("; ")}</li>)}
          </ul>
          <p className="mt-2 text-xs text-rose-700">The rest of the import was not affected. Fix these in your file and import it again; products already added won&rsquo;t be duplicated.</p>
        </section>
      )}

      {imgProblems.length > 0 && !undone && (
        <section className="rounded-card border border-amber-200 bg-amber-50 p-4">
          <p className="font-bold text-amber-900">Some photos could not be copied</p>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-900">
            {imgProblems.map((i) => <li key={i.id}><strong>{i.title}</strong> — {i.imageProblems.length ? i.imageProblems.join("; ") : "no photo was added"}.</li>)}
          </ul>
          <p className="mt-2 text-xs text-amber-800">Those products stay drafts until they have a photo. Add one by hand in Products, or fix the image address and import the file again.</p>
        </section>
      )}

      {!undone && (
        <section className="rounded-card border border-line bg-white p-5 shadow-soft" aria-labelledby="publish-h">
          <h2 id="publish-h" className="font-display text-lg font-bold text-navy">Publish</h2>
          <p className="mt-1 text-sm text-ink-soft">Choose which drafts to put on sale. Publishing runs the same checks as pressing Show on a product you added by hand: selling terms, your plan, Stripe payouts, a photo, and the Selling Policy.</p>
          {!canPublish && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Publishing products needs a Premium plan. Your drafts are saved — publish them once your plan is active.{" "}
              <Link href={`/business/${businessId}/manage/billing`} className="font-bold underline underline-offset-2">See plans →</Link>
            </p>
          )}
          {publishable.length === 0 ? <p className="mt-3 text-sm text-ink-muted">No products were added or changed.</p> : (
            <ul className="mt-3 space-y-2">
              {publishable.map((i) => <PublishRow key={i.id} i={i} checked={selected.has(i.product!.id)} acked={ack.has(i.product!.id)} onToggle={() => toggle(i.product!.id)} onAck={() => toggleAck(i.product!.id)} businessId={businessId} result={pubResults.find((r) => r.id === i.product!.id)} />)}
            </ul>
          )}
          {pubMsg && (
            <p role="status" className={`mt-3 text-sm font-semibold ${pubMsg.tone === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
              {pubMsg.text}{pubMsg.code === "payout_not_ready" && <> <Link href={`/business/${businessId}/manage/billing`} className="underline underline-offset-2">Connect Stripe →</Link></>}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={publish} disabled={busy !== null || chosen.length === 0 || !canPublish}
              className="rounded-pill px-5 py-2.5 text-sm font-bold text-white shadow-soft disabled:opacity-50" style={{ background: ACCENT }}>
              {busy === "publish" ? "Publishing…" : chosen.length ? `Publish ${chosen.length} selected` : "Publish selected"}
            </button>
            <Link href={`/business/${businessId}/manage/products`} className="rounded-pill border border-line px-4 py-2 text-sm font-bold text-ink-soft hover:bg-sand">Go to Products</Link>
          </div>
        </section>
      )}

      <section className="rounded-card border border-line bg-white p-5 shadow-soft" aria-labelledby="undo-h">
        <h2 id="undo-h" className="font-display text-lg font-bold text-navy">Undo</h2>
        {undone ? (
          <p className="mt-1 text-sm text-ink-soft">This import was undone{batch.undone_at ? ` on ${new Date(batch.undone_at).toLocaleDateString("en-GB")}` : ""}. Its drafts were removed.</p>
        ) : canUndo ? (
          <>
            <p className="mt-1 text-sm text-ink-soft">Changed your mind? You can undo this import for another {daysLeft} day{daysLeft === 1 ? "" : "s"}, as long as nothing it created has been published, ordered or edited.</p>
            <button onClick={undo} disabled={busy !== null} className="mt-3 rounded-pill border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
              {busy === "undo" ? "Undoing…" : "Undo this import"}
            </button>
          </>
        ) : <p className="mt-1 text-sm text-ink-muted">The 7-day undo window for this import has ended.</p>}
        {undoMsg && <p role="status" className="mt-3 text-sm font-semibold text-ink-soft">{undoMsg}</p>}
        {undoBlockers && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">
            <p className="font-bold">This import can&rsquo;t be undone, and nothing was changed.</p>
            <ul className="mt-1 list-disc pl-5">{undoBlockers.map((b, k) => <li key={k}><strong>{b.title}</strong> — {b.reason}</li>)}</ul>
            <p className="mt-1 text-xs">You can still delete or edit individual products in Products.</p>
          </div>
        )}
      </section>

      <button onClick={onNewImport} className="rounded-pill border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft hover:bg-sand">Import another file</button>
    </div>
  );
}

function PublishRow({ i, checked, acked, onToggle, onAck, businessId, result }: {
  i: BatchRow; checked: boolean; acked: boolean; onToggle: () => void; onAck: () => void; businessId: string; result?: PublishResult;
}) {
  const p = i.product!;
  const sel = i.publish === "ready" || i.publish === "needs_review";
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        {sel ? <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Select ${p.title}`} /> : <span className="w-4" />}
        <p className="min-w-0 flex-1 break-words text-sm font-semibold text-ink">{p.title}</p>
        {i.publish === "live" && <Badge tone="green">Live</Badge>}
        {i.publish === "ready" && <Badge tone="blue">Ready to publish</Badge>}
        {i.publish === "needs_photo" && <Badge tone="amber">Needs a photo</Badge>}
        {i.publish === "needs_review" && <Badge tone="amber">Policy check</Badge>}
        {i.publish === "blocked" && <Badge tone="rose">Not allowed</Badge>}
      </div>
      {i.publish === "needs_photo" && <p className="mt-1 text-xs text-ink-muted">Add a photo in <Link className="underline" href={`/business/${businessId}/manage/products`}>Products</Link> to publish it.</p>}
      {i.publish === "blocked" && <p className="mt-1 text-xs text-rose-700">This looks like something the Selling Policy doesn&rsquo;t allow. Edit it or delete it in Products.</p>}
      {i.publish === "needs_review" && checked && (
        <label className="mt-1.5 flex items-start gap-2 text-xs text-amber-900">
          <input type="checkbox" className="mt-0.5" checked={acked} onChange={onAck} />
          <span>I&rsquo;ve checked this follows the <Link href="/selling-policy" target="_blank" className="underline">Selling Policy</Link> (it mentions something that is sometimes restricted).</span>
        </label>
      )}
      {result && <p className={`mt-1 text-xs font-semibold ${result.ok ? "text-emerald-700" : "text-rose-700"}`}>{result.ok ? "Published." : result.reason}</p>}
    </li>
  );
}
