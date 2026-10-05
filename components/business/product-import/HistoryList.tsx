"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { STATUS_LABEL, countBits, fmtDay, fmtWhen, type HistoryEntry } from "./shared";

export type HistoryItem = HistoryEntry & {
  /** Worked out on the server, so the page never depends on the browser's clock. */
  canUndo: boolean;
};

export function HistoryList({ businessId, items }: { businessId: string; items: HistoryItem[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, { text: string; blockers?: { title: string; reason: string }[] }>>({});

  async function undo(h: HistoryItem) {
    const created = h.counts?.create ?? 0, updated = h.counts?.update ?? 0;
    const go = await confirm({
      title: "Undo this import?",
      body: <>This removes the {created} product{created === 1 ? "" : "s"} this import added{updated ? <> and puts back the {updated} it changed (fields you have edited since are kept)</> : null}. It only works if none of them has been published, ordered or edited since.</>,
      confirmLabel: "Undo import", danger: true,
    });
    if (!go) return;
    setBusy(h.id); setNotes((n) => ({ ...n, [h.id]: { text: "" } }));
    try {
      const res = await fetch(`/api/business/${businessId}/product-import/batches/${h.id}/undo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setNotes((n) => ({ ...n, [h.id]: { text: data.error ?? "Couldn't undo." } })); return; }
      if (data.ok === false) { setNotes((n) => ({ ...n, [h.id]: { text: "This import can’t be undone, and nothing was changed.", blockers: data.blockers ?? [] } })); return; }
      setNotes((n) => ({ ...n, [h.id]: { text: `Undone: ${data.deleted ?? 0} product${data.deleted === 1 ? "" : "s"} removed.` } }));
      router.refresh();
    } catch { setNotes((n) => ({ ...n, [h.id]: { text: "Couldn't reach OneShetland. Try again." } })); }
    finally { setBusy(null); }
  }

  if (items.length === 0) {
    return <p className="rounded-card border border-line bg-white p-5 text-sm text-ink-soft shadow-soft">No imports yet. When you import a file, it will be listed here so you can come back to it.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((h) => {
        const bits = h.status === "undone" ? ["Its drafts were removed"] : countBits(h.counts);
        const unfinished = h.status === "applying" || h.status === "queued";
        const note = notes[h.id];
        return (
          <li key={h.id} className="rounded-card border border-line bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold text-ink">{h.filename || "Import"}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{fmtWhen(h.created_at)} · {h.total_items} row{h.total_items === 1 ? "" : "s"} · <strong>{STATUS_LABEL[h.status] ?? h.status}</strong></p>
                {bits.length > 0 && <p className="mt-1 text-sm text-ink-soft">{bits.join(" · ")}</p>}
                {h.canUndo && <p className="mt-1 text-xs text-ink-muted">You can undo this until {fmtDay(h.undo_expires_at)}.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {unfinished
                  ? <Link href={`/business/${businessId}/manage/products/import`} className="rounded-pill border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-sand">Carry on →</Link>
                  : <Link href={`/business/${businessId}/manage/products/import/${h.id}`} className="rounded-pill border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-sand">View result →</Link>}
                {h.canUndo && (
                  <button onClick={() => undo(h)} disabled={busy !== null} className="rounded-pill border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                    {busy === h.id ? "Undoing…" : "Undo import"}
                  </button>
                )}
              </div>
            </div>
            {note?.text && <p role="status" className="mt-3 text-sm font-semibold text-ink-soft">{note.text}</p>}
            {note?.blockers && (
              <div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                <ul className="list-disc pl-5">{note.blockers.map((b, k) => <li key={k}><strong>{b.title}</strong> — {b.reason}</li>)}</ul>
                <p className="mt-1 text-xs">You can still delete or edit individual products in Products.</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
