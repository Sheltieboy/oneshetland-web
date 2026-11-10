"use client";

import { useCallback, useState, useTransition } from "react";

export type Msg = { ok: boolean; text: string } | null;

/**
 * Runs a server action with a pending flag and a message for the aria-live Notice.
 *   const { pending, msg, run } = useAction();
 *   run(() => saveThing(...), { success: "Saved.", onOk: (r) => router.push(...) })
 */
export function useAction() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const run = useCallback(<R extends { ok: boolean; error?: string }>(fn: () => Promise<R>, opts: { success?: string; onOk?: (r: Extract<R, { ok: true }>) => void } = {}) => {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) { if (opts.success) setMsg({ ok: true, text: opts.success }); opts.onOk?.(r as Extract<R, { ok: true }>); }
        else setMsg({ ok: false, text: r.error ?? "Something went wrong. Please try again." });
      } catch {
        setMsg({ ok: false, text: "Something went wrong. Please try again." });
      }
    });
  }, []);
  return { pending, msg, run, setMsg };
}
