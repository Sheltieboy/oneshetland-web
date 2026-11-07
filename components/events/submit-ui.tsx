"use client";

import { forwardRef, useId, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from "react";

/** Shared, deliberately plain building blocks for the community-event screens: big targets, visible focus, one error pattern. */

export const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";
export const inputCls = `block w-full min-h-12 rounded-xl border border-line-strong bg-paper px-4 py-3 text-lg text-ink placeholder:text-ink-muted ${focusRing}`;
export const primaryBtn = `inline-flex min-h-12 items-center justify-center rounded-pill bg-navy px-6 py-3 text-lg font-bold text-white hover:bg-navy-dark disabled:opacity-60 ${focusRing}`;
export const secondaryBtn = `inline-flex min-h-12 items-center justify-center rounded-pill border border-line-strong bg-paper px-6 py-3 text-lg font-semibold text-ink hover:bg-cream disabled:opacity-60 ${focusRing}`;
export const dangerBtn = `inline-flex min-h-12 items-center justify-center rounded-pill bg-rose-700 px-6 py-3 text-lg font-bold text-white hover:bg-rose-800 disabled:opacity-60 ${focusRing}`;
export const textBtn = `inline-flex min-h-11 items-center text-base font-semibold text-navy underline ${focusRing}`;

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} className={`${primaryBtn} ${props.className ?? ""}`} />; }
export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} className={`${secondaryBtn} ${props.className ?? ""}`} />; }

type FieldProps = { label: string; help?: string; error?: string; optional?: boolean; children: (a: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode; id?: string };

/** A label, optional help, the control, and its error - wired together with ids so screen readers read them as one. */
export function Field({ label, help, error, optional, children, id }: FieldProps) {
  const auto = useId();
  const fid = id ?? `f${auto.replace(/:/g, "")}`;
  const helpId = help ? `${fid}-help` : undefined;
  const errId = error ? `${fid}-err` : undefined;
  const describedBy = [helpId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mt-5">
      <label htmlFor={fid} className="block text-lg font-semibold text-ink">
        {label}{optional && <span className="ml-2 text-base font-normal text-ink-soft">(optional)</span>}
      </label>
      {help && <p id={helpId} className="mt-1 text-base text-ink-soft">{help}</p>}
      <div className="mt-2">{children({ id: fid, describedBy, invalid: !!error })}</div>
      {error && <p id={errId} className="mt-2 text-base font-semibold text-rose-700">{error}</p>}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(props, ref) {
  return <input ref={ref} {...props} className={`${inputCls} ${props["aria-invalid"] ? "border-rose-600" : ""} ${props.className ?? ""}`} />;
});
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(props, ref) {
  return <textarea ref={ref} {...props} className={`${inputCls} ${props["aria-invalid"] ? "border-rose-600" : ""} ${props.className ?? ""}`} />;
});

/** The list of things to fix, shown at the top and focused when a step can't continue. Each item links to its field. */
export const ErrorSummary = forwardRef<HTMLDivElement, { items: { id: string; message: string }[] }>(function ErrorSummary({ items }, ref) {
  if (items.length === 0) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="mt-5 rounded-2xl border-2 border-rose-700 bg-rose-50 p-4 outline-none">
      <h3 className="text-lg font-bold text-rose-900">{items.length === 1 ? "There is one thing to fix" : `There are ${items.length} things to fix`}</h3>
      <ul className="mt-2 list-disc pl-5">
        {items.map((i) => (
          <li key={i.id + i.message}><a href={`#${i.id}`} className={`inline-flex min-h-11 items-center text-base font-semibold text-rose-900 underline ${focusRing}`}>{i.message}</a></li>
        ))}
      </ul>
    </div>
  );
});

export function Notice({ tone = "info", children, ...rest }: { tone?: "info" | "warn" | "good"; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const c = tone === "warn" ? "border-amber-600 bg-amber-50 text-amber-950" : tone === "good" ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-line-strong bg-cream text-ink";
  return <div {...rest} className={`mt-5 rounded-2xl border p-4 text-base ${c} ${rest.className ?? ""}`}>{children}</div>;
}

export function StatusChip({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "gray" | "blue" }) {
  const m = { green: "bg-emerald-100 text-emerald-900", amber: "bg-amber-100 text-amber-900", red: "bg-rose-100 text-rose-900", gray: "bg-sand text-ink", blue: "bg-blue-100 text-blue-900" };
  return <span className={`inline-block rounded-pill px-3 py-1 text-sm font-bold ${m[tone]}`}>{label}</span>;
}
