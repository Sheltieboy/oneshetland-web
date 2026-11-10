"use client";

import { useId, type CSSProperties } from "react";
import { deriveBrand, normaliseFocus, TYPEFACE } from "@/lib/editions/brand";
import { BrandScope } from "@/components/editions/editorial/BrandScope";
import { Masthead, Plate } from "@/components/editions/editorial/Masthead";
import { isHex } from "@/lib/editions/rules";
import { Field, inputCls } from "./kit";

/** A handful of well-judged starting colours for organisers who do not have a brand colour yet. Names are plain words, never trademarks. */
export const SUGGESTED_COLOURS: { name: string; hex: string }[] = [
  { name: "Terracotta", hex: "#8a3b12" }, { name: "Moss", hex: "#5b6b4d" }, { name: "Harbour blue", hex: "#1d3f72" }, { name: "Magenta", hex: "#e6007e" },
  { name: "Deep teal", hex: "#0b6b73" }, { name: "Mustard", hex: "#b8860b" }, { name: "Plum", hex: "#6a2c5e" }, { name: "Slate", hex: "#44546a" },
];

/** One brand colour: a picker, the hex, and swatches. `inherited` (an Edition) offers to go back to the organiser's colour. */
export function ColourField({ value, onChange, inherited, hint }: { value: string; onChange: (hex: string) => void; inherited?: string | null; hint?: string }) {
  const id = useId();
  const valid = isHex(value);
  return (
    <Field label={inherited !== undefined ? "Colour for this Edition" : "Your brand colour"} htmlFor={id} hint={hint ?? "One colour is all we need. Everything else is chosen for you, and checked so text is always easy to read."}>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Pick a colour" type="color" value={valid ? value : (inherited && isHex(inherited) ? inherited : "#0b5a73")} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-paper" />
        <input id={id} className={`${inputCls} max-w-[9rem]`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={inherited ?? "#0b5a73"} maxLength={7} spellCheck={false} autoCapitalize="none" />
        {inherited !== undefined && value && <button type="button" onClick={() => onChange("")} className="text-sm font-semibold text-navy underline-offset-2 hover:underline">Use the organiser&rsquo;s colour</button>}
      </div>
      {value && !valid && <p role="alert" className="mt-1 text-xs font-medium text-rose-700">A colour looks like #8a3b12 (a # then six letters or numbers).</p>}
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Suggested colours">
        {SUGGESTED_COLOURS.map((c) => (
          <li key={c.hex}>
            <button type="button" onClick={() => onChange(c.hex)} aria-pressed={value.toLowerCase() === c.hex} title={c.name} className={`h-9 w-9 rounded-full border-2 transition ${value.toLowerCase() === c.hex ? "border-ink ring-2 ring-offset-2 ring-ink" : "border-white shadow-soft hover:scale-105"}`} style={{ background: c.hex }}>
              <span className="sr-only">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </Field>
  );
}

/** Click the photograph to choose what stays in view when it is cropped for a phone or a wide screen; two sliders do the same from the keyboard. */
export function FocusPicker({ src, value, onChange }: { src: string; value: string; onChange: (focus: string) => void }) {
  const [x, y] = normaliseFocus(value).split(" ").map((v) => parseInt(v, 10));
  const set = (nx: number, ny: number) => onChange(`${Math.round(Math.min(100, Math.max(0, nx)))}% ${Math.round(Math.min(100, Math.max(0, ny)))}%`);
  const id = useId();
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-ink">What should always stay in view?</p>
      <p className="text-xs text-ink-muted">Click the part of the photograph that matters most. Phones and wide screens crop it differently; this keeps your subject in the frame.</p>
      <div
        className="relative mt-2 cursor-crosshair overflow-hidden rounded-xl border border-line"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="block h-auto w-full select-none" draggable={false} />
        <span aria-hidden="true" className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]" style={{ left: `${x}%`, top: `${y}%` }} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${id}-x`} className="text-xs font-semibold text-ink">Left to right
          <input id={`${id}-x`} type="range" min={0} max={100} value={x} onChange={(e) => set(Number(e.target.value), y)} className="mt-1 block w-full" />
        </label>
        <label htmlFor={`${id}-y`} className="text-xs font-semibold text-ink">Top to bottom
          <input id={`${id}-y`} type="range" min={0} max={100} value={y} onChange={(e) => set(x, Number(e.target.value))} className="mt-1 block w-full" />
        </label>
      </div>
    </div>
  );
}

/** What visitors will see: the real masthead, drawn by the real design system from the values being edited. Decorative for assistive technology; the report beside it says the same in words. */
export function BrandPreview({ name, title, eyebrow, tagline, logo, cover, focus, color, dateLabel }: {
  name: string; title?: string; eyebrow?: string; tagline?: string | null; logo: string | null; cover: string | null; focus: string; color: string | null; dateLabel?: string;
}) {
  const brand = deriveBrand(color);
  return (
    <div aria-hidden="true" {...({ inert: true } as object)}>
      <BrandScope brand={brand} className="ed-preview">
        <Masthead as="p" title={title || name || "Your name"} eyebrow={eyebrow} line={tagline} dateLabel={dateLabel} ghost={(title || name || "?").trim().slice(0, 1).toUpperCase()} cover={cover} focus={focus}
          plate={<Plate name={name || "Your organisation"} logo={logo} label="Presented by" />} short />
        <div className="ed-preview-strip"><b>Aa</b><span className="ed-small" style={{ alignSelf: "center" }}>The same page, tinted and typeset for you.</span></div>
      </BrandScope>
    </div>
  );
}

/** The derived palette, the typeface chosen, and the accessibility checks, in plain language. */
export function BrandReport({ color }: { color: string | null }) {
  const b = deriveBrand(color);
  const chips: { label: string; hex: string; dark?: boolean }[] = [
    { label: "Paper", hex: b.tone.ground }, { label: "Your colour", hex: b.tone.brand }, { label: "Text accent", hex: b.tone.accent }, { label: "Deep tone", hex: b.tone.deep }, { label: "Glow", hex: b.tone.glow }, { label: "Second tone", hex: b.tone.alt },
  ];
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-semibold text-ink">Chosen for you</p>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Colours derived from yours">
          {chips.map((c) => (
            <li key={c.label} className="flex items-center gap-2 rounded-pill border border-line bg-paper py-1 pl-1 pr-3">
              <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: c.hex } as CSSProperties} aria-hidden="true" />
              <span className="text-xs text-ink-soft">{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <p><span className="font-semibold text-ink">Typeface: {TYPEFACE.name}.</span> <span className="text-ink-soft">{TYPEFACE.blurb}. Your colour, photograph and logo make it yours.</span></p>
      <ul className="space-y-1" aria-label="Readability checks">
        {b.checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-ink-soft">
            <span aria-hidden="true" className={c.pass ? "text-emerald-700" : "text-rose-700"}>{c.pass ? "✓" : "✗"}</span>
            <span><span className="font-medium text-ink">{c.label}:</span> {c.pass ? "easy to read" : "hard to read"} <span className="text-ink-muted">({c.ratio}:1, needs 4.5)</span></span>
          </li>
        ))}
      </ul>
      {b.notes.map((n) => <p key={n} className="rounded-lg bg-sand/60 px-3 py-2 text-xs text-ink-soft">{n}</p>)}
    </div>
  );
}
