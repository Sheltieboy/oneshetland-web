"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmOpts = { title?: string; body: React.ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type NotifyOpts = { title?: string; body: React.ReactNode; tone?: "info" | "error"; okLabel?: string };

type DialogState =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ kind: "notify"; resolve: () => void } & NotifyOpts)
  | null;

const Ctx = createContext<{
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  notify: (o: NotifyOpts) => Promise<void>;
} | null>(null);

const NAVY = "#032f4c";
const RED = "#b4432e";

/**
 * On-brand replacement for the browser's confirm()/alert(). Mount once near the
 * root; call `useConfirm()` / `useNotify()` anywhere below it.
 *   const confirm = useConfirm();
 *   if (!(await confirm({ body: "Delete this?", danger: true }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ kind: "confirm", resolve, ...o })), []);
  const notify = useCallback((o: NotifyOpts) => new Promise<void>((resolve) => setDialog({ kind: "notify", resolve, ...o })), []);

  const close = useCallback((result: boolean) => {
    setDialog((d) => {
      if (d) { if (d.kind === "confirm") d.resolve(result); else d.resolve(); }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [dialog, close]);

  const primaryBg = dialog
    ? (dialog.kind === "confirm" ? (dialog.danger ? RED : NAVY) : (dialog.tone === "error" ? RED : NAVY))
    : NAVY;

  return (
    <Ctx.Provider value={{ confirm, notify }}>
      {children}
      {mounted && dialog && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button aria-label="Close" className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[1px]" onClick={() => close(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-sm animate-[dlgIn_.16s_ease-out] rounded-2xl border border-line bg-paper p-6 shadow-lift">
            {dialog.title && <h2 className="font-display text-xl font-bold text-ink">{dialog.title}</h2>}
            <div className={"whitespace-pre-line text-sm leading-relaxed text-ink-soft" + (dialog.title ? " mt-1.5" : "")}>{dialog.body}</div>
            <div className="mt-5 flex justify-end gap-2">
              {dialog.kind === "confirm" && (
                <button onClick={() => close(false)} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand">
                  {dialog.cancelLabel ?? "Cancel"}
                </button>
              )}
              <button autoFocus onClick={() => close(true)}
                className="rounded-pill px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:brightness-95"
                style={{ background: primaryBg }}>
                {dialog.kind === "confirm" ? (dialog.confirmLabel ?? "Confirm") : (dialog.okLabel ?? "OK")}
              </button>
            </div>
          </div>
          <style>{"@keyframes dlgIn{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}"}</style>
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConfirm must be used within ConfirmProvider");
  return c.confirm;
}
export function useNotify() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNotify must be used within ConfirmProvider");
  return c.notify;
}
