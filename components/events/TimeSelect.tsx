"use client";

import { HOUR_OPTIONS, minuteOptions, splitTime, timeAfterHour, timeAfterMinute } from "@/lib/event-dates-builder";
import { inputCls } from "@/components/events/submit-ui";

/**
 * A time as two native selects (hour 00-23, minute in 10s). Value is the same "HH:MM" string (or "") the dates builder stores.
 * A stored minute that is not a multiple of 10 (e.g. 19:05) is kept as an extra "05 (current)" option and never rounded.
 */
export function TimeSelect({ idBase, legend, value, onChange, optional = false, errorId }: {
  idBase: string; legend: string; value: string; onChange: (v: string) => void; optional?: boolean; errorId?: string;
}) {
  const { hour, minute } = splitTime(value);
  const invalid = errorId ? true : undefined;
  const cls = `${inputCls} min-h-12 px-3 ${errorId ? "border-rose-600" : ""}`;
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="block p-0 text-base font-semibold">{legend}</legend>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${idBase}-hour`} className="sr-only">{legend}, hour</label>
          <select id={`${idBase}-hour`} className={cls} value={hour} aria-invalid={invalid} aria-describedby={errorId} onChange={(e) => onChange(timeAfterHour(value, e.target.value))}>
            <option value="">{optional ? "No end time" : "Hour"}</option>
            {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idBase}-minute`} className="sr-only">{legend}, minute</label>
          <select id={`${idBase}-minute`} className={cls} value={minute} disabled={!hour} aria-invalid={invalid} aria-describedby={errorId} onChange={(e) => onChange(timeAfterMinute(value, e.target.value))}>
            {!hour && <option value="">Min</option>}
            {minuteOptions(value).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </fieldset>
  );
}
