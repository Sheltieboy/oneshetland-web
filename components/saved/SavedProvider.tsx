"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  itemKey, planFlagBatches, refKey, refsFromFlags, rpcArgs, saveOutcome,
  type SaveOutcome, type SavedRef, type SavedType,
} from "@/lib/saved";
import { BUSINESS_SAVE_LINE, MSG } from "@/lib/saved-copy";
import { SaveIntentRunner } from "@/components/saved/SaveIntentRunner";
import { Ctx, OFF, useSaved, type SavedApi, type SaveToastOptions } from "@/components/saved/context";

export { useSaved };

/**
 * Holds what this member has saved (for the bookmarks on the page), batches the "which of these have I saved?" question into one call per type
 * per short tick (at most 200 ids each), and shows the one small "Saved" message with Undo.
 *
 * When My Saved is off (`enabled` false) this renders NOTHING of its own: no markup, no request. A bookmark reads `enabled` and renders null.
 */

type Toast = { id: number; message: string; undo?: () => void };
const TICK_MS = 25;
const TOAST_MS = 7000;

export function SavedProvider({ enabled, signedIn, children }: { enabled: boolean; signedIn: boolean; children: React.ReactNode }) {
  if (!enabled) return <Ctx.Provider value={OFF}>{children}</Ctx.Provider>;
  return <Live signedIn={signedIn}>{children}</Live>;
}

function Live({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [paused, setPaused] = useState(false);
  const queue = useRef(new Map<SavedType, Set<string>>());
  const seen = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const flush = useCallback(async () => {
    timer.current = null;
    const batches = planFlagBatches(queue.current);
    queue.current = new Map();
    if (batches.length === 0) return;
    const sb = createClient();
    await Promise.all(batches.map(async ({ type, ids }) => {
      try {
        const { data, error } = await sb.rpc("my_saved_flags", { p_type: type, p_ids: ids });
        if (error) throw error;
        const refs = refsFromFlags(type, data);
        if (refs.length) setSaved((prev) => { const n = new Set(prev); for (const r of refs) n.add(refKey(r)); return n; });
      } catch {
        for (const id of ids) seen.current.delete(itemKey(type, id));   // a later bookmark may ask again
      }
    }));
  }, []);

  const track = useCallback((type: SavedType, id: string) => {
    if (!signedIn) return;
    const k = itemKey(type, id);
    if (seen.current.has(k)) return;
    seen.current.add(k);
    let set = queue.current.get(type);
    if (!set) queue.current.set(type, (set = new Set()));
    set.add(id);
    if (!timer.current) timer.current = setTimeout(() => { void flush(); }, TICK_MS);
  }, [signedIn, flush]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const mark = useCallback((ref: SavedRef, on: boolean) => {
    setSaved((prev) => { const n = new Set(prev); if (on) n.add(refKey(ref)); else n.delete(refKey(ref)); return n; });
  }, []);

  const announce = useCallback((message: string, opts?: SaveToastOptions) => {
    setToast({ id: nextId.current++, message, undo: opts?.undo });
  }, []);

  useEffect(() => {
    if (!toast || paused) return;
    const t = setTimeout(() => setToast((cur) => (cur && cur.id === toast.id ? null : cur)), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, paused]);

  const call = useCallback(async (fn: "save_item" | "unsave_item", ref: SavedRef): Promise<SaveOutcome> => {
    try {
      return saveOutcome(await createClient().rpc(fn, rpcArgs(ref)));
    } catch {
      return "error";
    }
  }, []);

  const save = useCallback<SavedApi["save"]>(async (ref, opts) => {
    mark(ref, true);                                         // optimistic
    const out = await call("save_item", ref);
    if (out !== "ok") {
      mark(ref, false);
      if (out === "limit") announce(MSG.limit);
      else if (out === "off") announce(MSG.notEnabled);
      else if (out === "error") announce(MSG.failed);
      return out;
    }
    const message = ref.type === "business" ? BUSINESS_SAVE_LINE : MSG.saved;
    announce(message, opts?.undo === false ? undefined : {
      undo: () => {
        mark(ref, false);
        void call("unsave_item", ref).then((o) => { if (o !== "ok") { mark(ref, true); announce(MSG.failedRemove); } else announce(MSG.removed); });
        opts?.onUndo?.();
      },
    });
    return out;
  }, [mark, call, announce]);

  const unsave = useCallback<SavedApi["unsave"]>(async (ref, opts) => {
    mark(ref, false);                                        // optimistic
    const out = await call("unsave_item", ref);
    if (out !== "ok") {
      mark(ref, true);
      announce(out === "error" ? MSG.failedRemove : MSG.failed);
      return out;
    }
    announce(MSG.removed, opts?.undo === false ? undefined : {
      undo: () => {
        mark(ref, true);
        void call("save_item", ref).then((o) => { if (o !== "ok") { mark(ref, false); announce(MSG.failed); } else announce(MSG.saved); });
        opts?.onUndo?.();
      },
    });
    return out;
  }, [mark, call, announce]);

  const api = useMemo<SavedApi>(() => ({
    enabled: true, signedIn,
    isSaved: (ref) => saved.has(refKey(ref)),
    track, save, unsave, announce,
  }), [signedIn, saved, track, save, unsave, announce]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {signedIn && <SaveIntentRunner />}
      {/* The one polite live region. Always mounted so a screen reader hears each message as it changes. */}
      <div
        role="status" aria-live="polite" aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex justify-center px-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {toast && (
          <div
            key={toast.id}
            onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setToast(null); }}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-paper shadow-lift"
          >
            <span>{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => { const u = toast.undo; setToast(null); u?.(); }}
                className="min-h-[44px] shrink-0 rounded-pill px-3 font-bold text-teal underline underline-offset-2 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
              >
                {MSG.undo}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
