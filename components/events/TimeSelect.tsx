"use client";

import { HOUR_OPTIONS, minuteOptions, splitTime, timeAfterHour, timeAfterMinute } from "@/lib/event-dates-builder";
import { inputCls, textBtn } from "@/components/events/submit-ui";

/**
 * A time as two native selects (hour 00-23, minute in 10s) joined by a colon. Value is the same "HH:MM" string (or "") the dates builder stores.
 * A stored minute that is not a multiple of 10 (e.g. 19:05) is kept as an extra "05 (current)" option and never rounded.
 * The optional end time is cleared with a small "Clear end time" button (shown only once an end is set), not a long label inside the select.
 */
export function TimeSelect({ idBase, legend, value, onChange, optional = false, errorId }: {
  idBase: string; legend: string; value: string; onChange: (v: string) => void; optional?: boolean; errorId?: string;
}) {
  const { hour, minute } = splitTime(value);
  const invalid = errorId ? true : undefined;
  const cls = `${inputCls} !min-h-12 !px-2 !py-2 text-center ${errorId ? "border-rose-600" : ""}`;
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="block p-0 text-base font-semibold">{legend}</legend>
      <div className="mt-1 flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${idBase}-hour`} className="sr-only">{legend}, hour</label>
          <select id={`${idBase}-hour`} className={cls} value={hour} aria-invalid={invalid} aria-describedby={errorId} onChange={(e) => onChange(timeAfterHour(value, e.target.value))}>
            <option value="">Hr</option>
            {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <span aria-hidden="true" className="text-lg font-bold text-ink">:</span>
        <div className="min-w-0 flex-1">
          <label htmlFor={`${idBase}-minute`} className="sr-only">{legend}, minute</label>
          <select id={`${idBase}-minute`} className={cls} value={minute} disabled={!hour} aria-invalid={invalid} aria-describedby={errorId} onChange={(e) => onChange(timeAfterMinute(value, e.target.value))}>
            {!hour && <option value="">--</option>}
            {minuteOptions(value).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {optional && (value
        ? <button type="button" className={textBtn} onClick={() => onChange("")}>Clear end time<span className="sr-only"> (no end time)</span></button>
        : <p className="mt-1 text-sm text-ink-soft">No end time set</p>)}
    </fieldset>
  );
}
