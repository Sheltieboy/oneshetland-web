"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Facets, JobFilters } from "@/lib/job-filters";
import { filterCount } from "@/lib/job-filters";

/**
 * The single "Filters" control for Jobs. Opens a compact panel (a bottom sheet on phones, a dropdown on desktop) holding only the
 * options live jobs actually have. It is a plain GET form, so the chosen state lands in the URL and the page works shareable/bookmarked.
 * Search, category and sort stay outside the panel (they are carried through as hidden fields).
 */
export function JobFiltersPanel({ facets, filters, accent, clearHref }: { facets: Facets; filters: JobFilters; accent: string; clearHref: string }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  // The page header uses backdrop-blur, which makes `position: fixed` children anchor to the header instead of the screen —
  // so the panel is rendered in a portal on <body>, and on desktop positioned under the button from its measured rect.
  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    setAnchor(r && window.innerWidth >= 768 ? { top: r.bottom + 8, left: Math.max(12, Math.min(r.left, window.innerWidth - 416 - 12)) } : null);   // 26rem wide, kept on screen
    setOpen(true);
  };
  const n = filterCount(filters);
  const has = facets.locations.length + facets.employment.length + facets.workplace.length + facets.salary.length + facets.employers.length > 0;
  if (!has) return null;

  const box = (name: string, value: string, label: string, count: number, checked: boolean) => (
    <label key={`${name}:${value}`} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm text-ink hover:bg-sand">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="h-4 w-4 accent-[var(--jobs-accent)]" />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-ink-muted">{count}</span>
    </label>
  );
  const section = (title: string, children: React.ReactNode, note?: string) => (
    <fieldset className="border-t border-line pt-3 first:border-0 first:pt-0">
      <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</legend>
      <div className="grid gap-0.5 sm:grid-cols-2">{children}</div>
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </fieldset>
  );

  return (
    <div className="relative" style={{ ["--jobs-accent" as string]: accent }}>
      <button
        type="button"
        ref={btn}
        onClick={show}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid="filters-button"
        className={"inline-flex shrink-0 items-center gap-2 rounded-pill border px-4 py-2 text-sm font-semibold transition " + (n > 0 ? "text-paper shadow-soft" : "border-line-strong text-ink-soft hover:bg-sand")}
        style={n > 0 ? { background: accent, borderColor: accent } : undefined}
      >
        <span aria-hidden>⚙</span> {n > 0 ? `Filters (${n})` : "Filters"}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <button type="button" aria-label="Close filters" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/40 md:bg-transparent" />
          <form
            action="/jobs"
            method="get"
            role="dialog"
            aria-label="Filter jobs"
            data-testid="filters-panel"
            style={{ ["--jobs-accent" as string]: accent, ...(anchor ? { top: anchor.top, left: anchor.left } : {}) }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-line bg-paper p-5 shadow-lift md:inset-x-auto md:bottom-auto md:max-h-[70vh] md:w-[26rem] md:rounded-2xl"
          >
            {filters.q && <input type="hidden" name="q" value={filters.q} />}
            {filters.category && <input type="hidden" name="category" value={filters.category} />}
            {filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg font-bold text-ink">Filters</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-pill px-3 py-1 text-sm font-semibold text-ink-soft hover:bg-sand">Close</button>
            </div>
            <div className="space-y-3">
              {facets.locations.length > 0 && section("Location", facets.locations.map((l) => box("loc", l.value, l.value, l.count, filters.locations.includes(l.value))))}
              {facets.employment.length > 0 && section("Employment", facets.employment.map((o) => box("emp", o.key, o.label, o.count, filters.employment.includes(o.key))))}
              {facets.workplace.length > 0 && section("Workplace", facets.workplace.map((o) => box("work", o.key, o.label, o.count, filters.workplace.includes(o.key))))}
              {facets.salary.length > 0 && section("Salary", facets.salary.map((o) => box("sal", o.key, o.label, o.count, filters.salary.includes(o.key))), "Jobs with no stated salary are still shown.")}
              {facets.employers.length > 0 && section("Employer", facets.employers.map((o) => box("employer", o.value, o.value, o.count, filters.employers.includes(o.value))))}
            </div>
            <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 flex items-center justify-between gap-3 border-t border-line bg-paper px-5 py-3">
              <Link href={clearHref} className="text-sm font-semibold text-ink-soft underline" onClick={() => setOpen(false)}>Clear all</Link>
              <button type="submit" className="rounded-pill px-5 py-2 text-sm font-bold text-paper" style={{ background: accent }}>Show jobs</button>
            </div>
          </form>
        </>,
        document.body,
      )}
    </div>
  );
}
