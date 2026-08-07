"use client";

import { DAYS, CLOSED, parseRange, type OpeningHours, type DayKey } from "@/lib/opening-hours";

/**
 * The opening-hours editor. Writes the canonical "HH:MM-HH:MM" (or "Closed")
 * that the visitor planner can actually reason about — free text like "when
 * the boat's in" reads fine on a listing but can't answer "open at 14:20 on a
 * Tuesday", which is the whole question a planner has to settle.
 *
 * Three states per day, deliberately: open with times, explicitly Closed, or
 * blank. Blank means "not told us" and is NOT the same as closed — the planner
 * says "check times" for blank and skips a business entirely for closed.
 *
 * The copy-down button exists because most places keep the same hours five or
 * six days a week, and making someone set that seven times is how a form ends
 * up empty for 200 businesses.
 */

type Parsed = { open: string; close: string; closed: boolean; set: boolean };

function parseDay(value: string | undefined): Parsed {
  if (!value) return { open: "09:00", close: "17:00", closed: false, set: false };
  if (value.trim().toLowerCase() === CLOSED.toLowerCase()) {
    return { open: "09:00", close: "17:00", closed: true, set: true };
  }
  const r = parseRange(value);
  if (!r) return { open: "09:00", close: "17:00", closed: false, set: false }; // legacy free text
  const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { open: fmt(r.open), close: fmt(r.close), closed: false, set: true };
}

export function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: OpeningHours;
  onChange: (next: OpeningHours) => void;
}) {
  const rows = DAYS.map((d) => ({ ...d, parsed: parseDay(value[d.key]) }));

  function write(key: DayKey, next: Parsed) {
    const out = { ...value };
    if (!next.set) delete out[key];
    else if (next.closed) out[key] = CLOSED;
    else out[key] = `${next.open}-${next.close}`;
    onChange(out);
  }

  function copyDown(from: DayKey) {
    const source = value[from];
    if (!source) return;
    const out = { ...value };
    let started = false;
    for (const d of DAYS) {
      if (d.key === from) { started = true; continue; }
      if (started) out[d.key] = source;
    }
    onChange(out);
  }

  const hasLegacy = DAYS.some((d) => {
    const v = value[d.key];
    return !!v && v.trim().toLowerCase() !== CLOSED.toLowerCase() && parseRange(v) === null;
  });

  return (
    <div className="space-y-2">
      {hasLegacy && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Some days are written in words rather than times. They still show on your listing, but setting real
          times below means you turn up in visitors&apos; plans for the right part of the day.
        </p>
      )}

      {rows.map((row) => {
        const p = row.parsed;
        return (
          <div key={row.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2">
            <span className="w-24 shrink-0 text-sm font-semibold text-ink">{row.label}</span>

            {!p.set ? (
              <>
                <span className="flex-1 text-sm text-ink-faint">Not set</span>
                <button
                  type="button"
                  onClick={() => write(row.key, { ...p, set: true, closed: false })}
                  className="rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold hover:bg-sand"
                >
                  Set hours
                </button>
                <button
                  type="button"
                  onClick={() => write(row.key, { ...p, set: true, closed: true })}
                  className="rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold hover:bg-sand"
                >
                  Closed
                </button>
              </>
            ) : p.closed ? (
              <>
                <span className="flex-1 text-sm font-semibold text-ink-soft">Closed</span>
                <button
                  type="button"
                  onClick={() => write(row.key, { ...p, closed: false })}
                  className="rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold hover:bg-sand"
                >
                  Open this day
                </button>
                <button
                  type="button"
                  onClick={() => write(row.key, { ...p, set: false })}
                  className="text-xs font-semibold text-ink-faint underline"
                >
                  Clear
                </button>
              </>
            ) : (
              <>
                <input
                  type="time"
                  value={p.open}
                  onChange={(e) => write(row.key, { ...p, open: e.target.value })}
                  className="rounded-lg border border-line bg-paper px-2 py-1 text-sm"
                  aria-label={`${row.label} opening time`}
                />
                <span className="text-ink-faint">to</span>
                <input
                  type="time"
                  value={p.close}
                  onChange={(e) => write(row.key, { ...p, close: e.target.value })}
                  className="rounded-lg border border-line bg-paper px-2 py-1 text-sm"
                  aria-label={`${row.label} closing time`}
                />
                <button
                  type="button"
                  onClick={() => write(row.key, { ...p, closed: true })}
                  className="rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold hover:bg-sand"
                >
                  Closed
                </button>
                <button
                  type="button"
                  onClick={() => copyDown(row.key)}
                  className="text-xs font-semibold text-sky-700 underline"
                  title="Copy these hours to the rest of the week"
                >
                  Copy down
                </button>
              </>
            )}
          </div>
        );
      })}

      <p className="text-xs text-ink-faint">
        A day left as &ldquo;Not set&rdquo; just means you haven&apos;t said — it won&apos;t be shown as closed.
        Closing after midnight is fine: put the closing time as it reads on the door.
      </p>
    </div>
  );
}
