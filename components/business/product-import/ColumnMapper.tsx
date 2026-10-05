"use client";

import { FIELDS, FIELD_LABELS, REQUIRED_FIELDS, type Field } from "@/lib/product-import/columns";

/**
 * Column matching, the way a merchant thinks about it: for each column in THEIR file, what is it?
 * `mapping` is field → column index (what the server wants); this view turns it round so each file column owns one
 * choice, and choosing a field that another column already holds moves it rather than duplicating it.
 */
export function ColumnMapper({ headers, sample, mapping, auto, onChange }: {
  headers: string[];
  sample: string[][];
  mapping: Record<string, number>;
  /** The mapping we guessed on our own, to say which columns were matched automatically. */
  auto: Record<string, number>;
  onChange: (m: Record<string, number>) => void;
}) {
  const fieldOf = (col: number): Field | "" => (FIELDS.find((f) => mapping[f] === col) ?? "") as Field | "";
  const autoField = (col: number): Field | undefined => FIELDS.find((f) => auto[f] === col);

  function choose(col: number, field: Field | "") {
    const next = { ...mapping };
    for (const f of FIELDS) if (next[f] === col) delete next[f];       // this column had another meaning: drop it
    if (field) next[field] = col;                                        // …and take the field from any other column
    onChange(next);
  }

  const required = REQUIRED_FIELDS.map((f) => ({ f, col: mapping[f] }));

  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Required information">
        {required.map(({ f, col }) => (
          <li key={f} className={"flex items-start gap-2 rounded-xl border px-3 py-2 text-sm " + (col === undefined ? "border-rose-300 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900")}>
            <span aria-hidden="true" className="font-black">{col === undefined ? "!" : "✓"}</span>
            <span>
              <strong>{FIELD_LABELS[f]}</strong>{" "}
              {col === undefined ? "— not matched yet. Choose which of your columns holds it below." : <>— from your column “{headers[col] || `column ${col + 1}`}”</>}
            </span>
          </li>
        ))}
      </ul>

      <ul className="divide-y divide-line rounded-xl border border-line" aria-label="Your columns">
        {headers.map((h, i) => {
          const f = fieldOf(i);
          const example = sample.map((r) => r[i]).find((v) => v && v.trim()) ?? "";
          const matchedAuto = f !== "" && autoField(i) === f;
          return (
            <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                <p className="break-words text-sm font-bold text-ink">{h || `(column ${i + 1})`}</p>
                <p className="truncate text-xs text-ink-muted">{example ? <>e.g. {example}</> : "no example in the first rows"}</p>
              </div>
              <span aria-hidden="true" className="hidden text-ink-faint sm:inline">→</span>
              <div className="flex min-w-0 basis-full flex-wrap items-center gap-2 sm:w-[24rem] sm:basis-auto sm:flex-none">
                <label htmlFor={`col-${i}`} className="sr-only">OneShetland field for “{h || `column ${i + 1}`}”</label>
                <select id={`col-${i}`} value={f} onChange={(e) => choose(i, e.target.value as Field | "")} className="w-full min-w-0 rounded-lg border border-line bg-white px-2 py-2 text-sm sm:w-56">
                  <option value="">Ignore this column</option>
                  {FIELDS.map((x) => <option key={x} value={x}>{FIELD_LABELS[x]}{REQUIRED_FIELDS.includes(x) ? " (required)" : ""}</option>)}
                </select>
                {f !== "" && <span className={"shrink-0 rounded-pill px-2 py-0.5 text-xs font-bold " + (matchedAuto ? "bg-emerald-50 text-emerald-800" : "bg-sky-50 text-sky-800")}>{matchedAuto ? "Matched for you" : "Your choice"}</span>}
                {f === "" && <span className="shrink-0 text-xs text-ink-muted">Not imported</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
