"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_PHOTOS, PHOTO_TIP } from "@/lib/house-swaps";
import { photoProblem } from "@/lib/house-swaps-photo-upload";
import { fieldCls } from "./Shell";

/** One photo a member has chosen but not yet uploaded: the file, a description, and a preview URL this component owns. */
export type PendingPhoto = { id: string; file: File; alt: string; preview: string; state: "waiting" | "uploading" | "done" | "failed"; error?: string };

export function makePending(file: File): PendingPhoto {
  return { id: crypto.randomUUID(), file, alt: "", preview: URL.createObjectURL(file), state: "waiting" };
}

/**
 * Choosing photos BEFORE the advert exists. The files stay in the form's state, so they survive moving between the three steps,
 * and the form uploads them straight after the advert is saved: a photo can only be attached to an advert that exists.
 */
export function PhotoPicker({ photos, onChange, disabled }: { photos: PendingPhoto[]; onChange: (next: PendingPhoto[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const room = MAX_PHOTOS - photos.length;
  const failed = photos.filter((p) => p.state === "failed");

  // The preview URLs belong to this list; release the ones that go away.
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(photos.map((p) => p.preview));
    for (const url of seen.current) if (!now.has(url)) URL.revokeObjectURL(url);
    seen.current = now;
  }, [photos]);

  function add(files: FileList | null) {
    if (!files || !files.length) return;
    const next = [...photos];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) { problems.push(`Only ${MAX_PHOTOS} photos can be added, so "${file.name}" was left out.`); continue; }
      const bad = photoProblem(file);
      if (bad) { problems.push(bad); continue; }
      next.push(makePending(file));
    }
    if (input.current) input.current.value = "";
    setRejected(problems);
    onChange(next);
  }

  function describe(p: PendingPhoto): string {
    if (p.state === "uploading") return "Uploading…";
    if (p.state === "done") return "Added";
    if (p.state === "failed") return "Not added";
    return "Ready";   // two to a row on a phone: the word has to fit beside Remove
  }

  return (
    <section aria-labelledby="s-photos" className="rounded-card border border-line bg-paper p-5 shadow-soft sm:p-6">
      <h2 id="s-photos" className="font-display text-2xl font-bold text-ink">Photos (optional)</h2>
      <p className="mt-1 text-sm text-ink-muted">{PHOTO_TIP}</p>

      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={p.alt || `Photo ${i + 1} you chose`} className="aspect-[4/3] w-full rounded-xl object-cover" />
              <label className="mt-1 block">
                <span className="sr-only">Describe photo {i + 1}</span>
                <input
                  value={p.alt} maxLength={120} disabled={disabled} placeholder="For example: Living room"
                  onChange={(e) => onChange(photos.map((q) => (q.id === p.id ? { ...q, alt: e.target.value } : q)))}
                  className={fieldCls}
                />
              </label>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className={`truncate text-xs font-semibold ${p.state === "failed" ? "text-rose-800" : p.state === "done" ? "text-emerald-800" : "text-ink-muted"}`}>{describe(p)}</span>
                <button
                  type="button" disabled={disabled}
                  onClick={() => { setRejected([]); onChange(photos.filter((q) => q.id !== p.id)); }}
                  className="inline-flex min-h-[44px] shrink-0 items-center px-2 text-sm font-bold text-rose-800 underline disabled:opacity-50"
                >Remove<span className="sr-only"> photo {i + 1}</span></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {room > 0 ? (
        <div className="mt-4">
          <label htmlFor="ph-file" className="block text-sm font-semibold text-ink">Choose photos ({room} more allowed)</label>
          <input
            ref={input} id="ph-file" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled}
            onChange={(e) => add(e.target.files)}
            className="mt-1 block min-h-[44px] w-full text-sm file:mr-3 file:min-h-[44px] file:rounded-pill file:border file:border-line-strong file:bg-paper file:px-4 file:font-bold file:text-ink"
          />
          <p className="mt-1 text-xs text-ink-muted">JPEG, PNG or WebP, up to 5 MB each. They are uploaded when you save your advert.</p>
        </div>
      ) : (
        <p className="mt-4 text-sm font-semibold text-ink-soft">You have chosen the maximum of {MAX_PHOTOS} photos. Remove one to choose another.</p>
      )}

      <div aria-live="polite" className="mt-3 space-y-2">
        {rejected.map((r, i) => <p key={`r${i}`} className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">{r}</p>)}
        {failed.map((p) => <p key={p.id} className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">{p.error}</p>)}
      </div>
    </section>
  );
}
