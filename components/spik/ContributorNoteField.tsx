"use client";

import { CONTRIBUTOR_NOTE_HINT, CONTRIBUTOR_NOTE_LABEL, CONTRIBUTOR_NOTE_MAX } from "@/lib/spik-data";

/**
 * ContributorNoteField — the optional, PRIVATE "Additional information about this word" box used by
 * all three Spik contribution forms. What is typed here goes to the Spik editors only: it is stored in
 * an admin-only column/table and is never published or shown back on the site.
 */
export function ContributorNoteField({
  value,
  onChange,
  id = "contributor-note",
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const left = CONTRIBUTOR_NOTE_MAX - value.length;
  return (
    <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
      <label className="font-semibold text-ink" htmlFor={id}>
        {CONTRIBUTOR_NOTE_LABEL} <span className="text-xs font-normal text-ink-faint">· optional</span>
      </label>
      <p id={`${id}-hint`} className="mt-0.5 text-xs leading-relaxed text-ink-muted">{CONTRIBUTOR_NOTE_HINT}</p>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, CONTRIBUTOR_NOTE_MAX))}
        maxLength={CONTRIBUTOR_NOTE_MAX}
        rows={4}
        aria-describedby={`${id}-hint ${id}-count`}
        placeholder="…"
        className="mt-3 w-full rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-ink outline-none focus:border-spik"
      />
      <p id={`${id}-count`} className={"mt-1 text-right text-xs " + (left < 100 ? "text-rose-600" : "text-ink-faint")}>
        {left} characters left
      </p>
    </div>
  );
}
