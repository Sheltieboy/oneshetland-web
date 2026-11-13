"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MAX_PHOTOS, PHOTO_TIP, photoUrl, type MyPhoto } from "@/lib/house-swaps";
import { PHOTO_BUCKET, photoProblem, uploadOnePhoto } from "@/lib/house-swaps-photo-upload";
import { fieldCls } from "./Shell";

/** Add, describe and remove the advert's photos (up to 6). Files go straight to storage from the browser, then are registered with the advert. */
export function PhotoManager({ photos, userId }: { photos: MyPhoto[]; userId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const room = MAX_PHOTOS - photos.length;

  async function add(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true); setMsg(null);
    let added = 0, problem: string | null = null;
    const list = Array.from(files).slice(0, room);
    for (const file of list) {
      const bad = photoProblem(file);
      if (bad) { problem = `${bad} It was left out.`; continue; }
      const r = await uploadOnePhoto(file, userId, alt);
      if (r.ok) added++; else problem = r.error;
    }
    if (files.length > room) problem = problem ?? `Only ${MAX_PHOTOS} photos can be added, so some were left out.`;
    setBusy(false);
    if (input.current) input.current.value = "";
    if (added) setAlt("");
    setMsg({ ok: !problem, text: problem ?? `${added} photo${added === 1 ? "" : "s"} added. A live advert is re-checked when its photos change.` });
    if (added) router.refresh();
  }

  async function remove(p: MyPhoto) {
    setBusy(true); setMsg(null);
    const sb = createClient();
    const r = await sb.rpc("remove_my_house_swap_photo", { p_photo: p.id });
    if (r.error) setMsg({ ok: false, text: r.error.message });
    else {
      if (typeof r.data === "string" && r.data) await sb.storage.from(PHOTO_BUCKET).remove([r.data]);
      setMsg({ ok: true, text: "Photo removed." });
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="s-photos" className="rounded-card border border-line bg-paper p-5 shadow-soft sm:p-6">
      <h2 id="s-photos" className="font-display text-2xl font-bold text-ink">Photos (optional)</h2>
      <p className="mt-1 text-sm text-ink-muted">{PHOTO_TIP}</p>
      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id} className="min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(p.path)} alt={p.alt || "Your photo"} className="aspect-[4/3] w-full rounded-xl object-cover" />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-ink-muted">{p.alt || "No description"}</span>
                <button type="button" disabled={busy} onClick={() => remove(p)} className="inline-flex min-h-[44px] shrink-0 items-center px-2 text-sm font-bold text-rose-800 underline">Remove<span className="sr-only"> photo {p.alt}</span></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {room > 0 ? (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="ph-alt" className="block text-sm font-semibold text-ink">Describe the next photo (optional)</label>
            <input id="ph-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={120} placeholder="For example: Living room" className={fieldCls} />
          </div>
          <div>
            <label htmlFor="ph-file" className="block text-sm font-semibold text-ink">Add photos ({room} more allowed)</label>
            <input ref={input} id="ph-file" type="file" accept="image/*" multiple disabled={busy} onChange={(e) => add(e.target.files)} className="mt-1 block min-h-[44px] w-full text-sm file:mr-3 file:min-h-[44px] file:rounded-pill file:border file:border-line-strong file:bg-paper file:px-4 file:font-bold file:text-ink" />
          </div>
        </div>
      ) : <p className="mt-4 text-sm font-semibold text-ink-soft">You have added the maximum of {MAX_PHOTOS} photos. Remove one to add another.</p>}
      <div aria-live="polite" role="status">{busy && <p className="mt-3 text-sm font-semibold text-ink-soft">Working on it…</p>}{msg && <p className={"mt-3 rounded-lg px-3 py-2 text-sm font-semibold " + (msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900")}>{msg.text}</p>}</div>
    </section>
  );
}
