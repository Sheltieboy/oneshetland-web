"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { photoProblem, removeActivityPhoto, uploadActivityPhoto } from "@/lib/activities-client";
import { safeHttps } from "@/lib/activities";
import { btnDanger, btnGhost, hint, label } from "./ui";

/**
 * The activity's main photograph. On an existing activity a change is saved straight away (choose, replace or remove) because it goes to storage,
 * not through "Save details". On a new activity the chosen file is held here and the form uploads it right after the activity is created.
 * Shows a live preview in the same 16:9 crop the public page uses; with no photo the activity keeps its colour.
 */
export function ActivityPhotoField({ activityId, coverUrl, pending, onPending }: { activityId?: string; coverUrl?: string | null; pending?: File | null; onPending?: (f: File | null) => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const preview = useMemo(() => (pending ? URL.createObjectURL(pending) : null), [pending]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    // Reads the address after the page has loaded (it cannot be known while rendering on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(window.location.search).get("photo") === "failed") setMsg({ tone: "err", text: "The activity was created but the photo didn't upload. Choose it again here." });
  }, []);

  const shown = preview ?? safeHttps(coverUrl);

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""; setMsg(null);
    if (!f) return;
    const bad = photoProblem(f);
    if (bad) { setMsg({ tone: "err", text: bad }); return; }
    if (!activityId) { onPending?.(f); return; }
    setBusy(true);
    try { await uploadActivityPhoto(activityId, f); setMsg({ tone: "ok", text: coverUrl ? "Photo replaced." : "Photo added." }); router.refresh(); }
    catch (x) { setMsg({ tone: "err", text: (x as Error).message }); } finally { setBusy(false); }
  }
  async function remove() {
    setMsg(null);
    if (!activityId) { onPending?.(null); return; }
    if (!window.confirm("Remove this photo? The activity will go back to its colour.")) return;
    setBusy(true);
    try { await removeActivityPhoto(activityId); setMsg({ tone: "ok", text: "Photo removed." }); router.refresh(); }
    catch (x) { setMsg({ tone: "err", text: (x as Error).message }); } finally { setBusy(false); }
  }

  return (
    <div data-photo-field>
      <span className={label} id="ra-photo-l">Photo <span className="font-normal text-ink-muted">(optional)</span></span>
      <div className="mt-1 grid gap-3 sm:grid-cols-[14rem_1fr] sm:items-start">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-line bg-sand">
          {shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown} alt="Preview of the activity photo" className="h-full w-full object-cover" />
            : <div className="grid h-full w-full place-items-center px-3 text-center text-xs text-ink-muted">No photo: the activity uses its colour</div>}
          {busy && <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-semibold text-ink" role="status">Uploading…</div>}
        </div>
        <div>
          <input ref={inputRef} id="ra-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choose} aria-labelledby="ra-photo-l" disabled={busy} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} disabled={busy} onClick={() => inputRef.current?.click()}>{shown ? "Replace photo" : "Choose photo"}</button>
            {shown && <button type="button" className={btnDanger} disabled={busy} onClick={() => void remove()}>Remove</button>}
          </div>
          <p className={hint}>JPEG, PNG or WebP. Landscape photos work best; it is cropped to a wide shape. {activityId ? "Changes to the photo save straight away." : "It is added when you create the activity."}</p>
          {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={"mt-1 text-sm font-semibold " + (msg.tone === "err" ? "text-rose-700" : "text-emerald-700")}>{msg.text}</p>}
        </div>
      </div>
    </div>
  );
}
