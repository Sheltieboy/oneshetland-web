"use client";

import { MAX_DATES, appendNextBlankRow, minuteOptions, describeOccurrence, londonToUtc, type DateRow, type RowIssue } from "@/lib/event-dates-builder";
import { TextInput, SecondaryButton, textBtn } from "@/components/events/submit-ui";
import { TimeSelect } from "@/components/events/TimeSelect";

/** The simple dates builder: one row per performance. "Add another performance" copies the last row's date and times; each row can be removed. */
export function DatesBuilder({ rows, onChange, issues, today, idBase = "dates" }: {
  rows: DateRow[]; onChange: (rows: DateRow[]) => void; issues: RowIssue[]; today: string; idBase?: string;
}) {
  const set = (i: number, patch: Partial<DateRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const issueFor = (r: DateRow, field: RowIssue["field"]) => issues.find((x) => x.rowId === r.id && (x.field === field || (field === "date" && x.field === "row")))?.message;
  const full = rows.length >= MAX_DATES;

  return (
    <div>
      <ol className="space-y-4">
        {rows.map((r, i) => {
          const p = `${idBase}-${r.id}`;
          const dErr = issueFor(r, "date"), sErr = issueFor(r, "start"), eErr = issueFor(r, "end"), nErr = issueFor(r, "note");
          // A stored odd minute shows as "05 (current)", which needs more room than a half-width phone column: stack Starts / Ends on narrow screens then.
          const oddMinute = [r.start, r.end].some((v) => minuteOptions(v).some((o) => o.current));
          const start = r.date && r.start ? londonToUtc(r.date, r.start) : null;
          return (
            <li key={r.id}>
              <fieldset className="rounded-2xl border border-line-strong bg-paper p-4">
                <legend className="px-2 text-lg font-bold text-ink">Date {i + 1}{start?.ok ? ` · ${describeOccurrence({ starts_at: start.iso })}` : ""}</legend>
                <div className="space-y-4">
                  <div>
                    <label htmlFor={`${p}-date`} className="block text-base font-semibold">Date</label>
                    <TextInput id={`${p}-date`} type="date" min={today} value={r.date} onChange={(e) => set(i, { date: e.target.value })} aria-invalid={dErr ? true : undefined} aria-describedby={dErr ? `${p}-date-err` : undefined} />
                  </div>
                  <div className={`grid gap-3 sm:grid-cols-2 sm:gap-6 ${oddMinute ? "grid-cols-1" : "grid-cols-2"}`}>
                  <TimeSelect idBase={`${p}-start`} legend="Starts" value={r.start} onChange={(v) => set(i, { start: v })} errorId={sErr ? `${p}-start-err` : undefined} />
                  <TimeSelect idBase={`${p}-end`} legend="Ends (optional)" optional value={r.end} onChange={(v) => set(i, { end: v })} errorId={eErr ? `${p}-end-err` : undefined} />
                  </div>
                </div>
                {dErr && <p id={`${p}-date-err`} className="mt-2 text-base font-semibold text-rose-700">{dErr}</p>}
                {sErr && <p id={`${p}-start-err`} className="mt-2 text-base font-semibold text-rose-700">{sErr}</p>}
                {eErr && <p id={`${p}-end-err`} className="mt-2 text-base font-semibold text-rose-700">{eErr}</p>}
                <div className="mt-4">
                  <label htmlFor={`${p}-note`} className="block text-base font-semibold">A note for this performance <span className="font-normal text-ink-soft">(optional, for example &ldquo;Matinee&rdquo;)</span></label>
                  <TextInput id={`${p}-note`} type="text" maxLength={200} value={r.note} onChange={(e) => set(i, { note: e.target.value })} aria-invalid={nErr ? true : undefined} aria-describedby={nErr ? `${p}-note-err` : undefined} />
                  {nErr && <p id={`${p}-note-err`} className="mt-2 text-base font-semibold text-rose-700">{nErr}</p>}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 empty:hidden">
                  {rows.length > 1 && (
                    <button type="button" className={textBtn} onClick={() => onChange(rows.filter((_, k) => k !== i))}>Remove this performance<span className="sr-only"> (date {i + 1})</span></button>
                  )}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <SecondaryButton disabled={full} onClick={() => onChange(appendNextBlankRow(rows))} aria-describedby={`${idBase}-add-help`}>Add another performance</SecondaryButton>
        <span id={`${idBase}-add-help`} className="text-base text-ink-soft">
          {full ? `You have reached the limit of ${MAX_DATES} performances. Remove one to add another.` : `${rows.length} of ${MAX_DATES} performances. The new one copies the last date and times, so just change what is different.`}
        </span>
      </div>
    </div>
  );
}
