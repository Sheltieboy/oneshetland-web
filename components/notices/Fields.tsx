"use client";

import { useState, type ReactNode } from "react";
import type { RpcResult } from "@/lib/notices-rpc";

export const inputCls = "min-h-[44px] w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-base text-ink placeholder:text-ink-faint focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20";
export const btnPrimary = "inline-flex min-h-[44px] items-center justify-center rounded-pill bg-navy px-5 text-sm font-bold text-paper shadow-soft transition hover:bg-navy-light disabled:opacity-50";
export const btnQuiet = "inline-flex min-h-[44px] items-center justify-center rounded-pill border border-line-strong bg-paper px-4 text-sm font-semibold text-ink-soft transition hover:bg-sand disabled:opacity-50";
export const btnDanger = "inline-flex min-h-[44px] items-center justify-center rounded-pill border border-rose-300 bg-rose-50 px-4 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50";

export function Field({ label, hint, error, optional, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">{label}{optional && <span className="ml-1.5 font-normal text-ink-muted">(optional)</span>}</label>
      {hint && <p className="mt-0.5 text-sm text-ink-muted">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && <p role="alert" className="mt-1 text-sm font-medium text-rose-700">{error}</p>}
    </div>
  );
}

export function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={"flex min-h-[44px] cursor-pointer items-start gap-3 py-1.5 " + (disabled ? "opacity-50" : "")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#032f4c]" />
      <span className="text-base text-ink">{children}</span>
    </label>
  );
}

export type ActionState = { busy: boolean; error: string | null; message: string | null };

/** Runs an action that returns { ok, data | error }; a refusal is shown in the database's own words. */
export function useAction() {
  const [state, setState] = useState<ActionState>({ busy: false, error: null, message: null });
  async function run<T>(p: () => Promise<RpcResult<T>>, okMessage: string): Promise<RpcResult<T>> {
    setState({ busy: true, error: null, message: null });
    try {
      const r = await p();
      setState(r.ok ? { busy: false, error: null, message: okMessage } : { busy: false, error: r.error, message: null });
      return r;
    } catch {
      const error = "That did not go through. Please check your connection and try again.";
      setState({ busy: false, error, message: null });
      return { ok: false, error };
    }
  }
  return { state, run, reset: () => setState({ busy: false, error: null, message: null }) };
}

export function Status({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{state.error}</p>;
  if (state.message) return <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{state.message}</p>;
  return null;
}

/** datetime-local value ("2026-11-05T11:00") -> Date in the viewer's local zone, or null. */
export function localToDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
