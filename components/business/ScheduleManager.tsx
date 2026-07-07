"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ } from "@/lib/business-data";
import {
  DAYS_OF_WEEK,
  formatTime,
  createAvailabilityRule,
  deleteAvailabilityRule,
  createOverride,
  deleteOverride,
  type BookAvailabilityRule,
  type BookSlotOverride,
  type BookOverrideType,
} from "@/lib/book-manage-schedule";

type Service = { id: string; name: string };

const INTERVALS = [15, 30, 45, 60];
const OVERRIDE_META: Record<BookOverrideType, { label: string; chip: string }> = {
  last_min: { label: "Last-min slot", chip: "text-emerald-700 border-emerald-200 bg-emerald-50" },
  open: { label: "Extra open hours", chip: "text-ink border-line bg-sand" },
  closed: { label: "Closure", chip: "text-rose-700 border-rose-200 bg-rose-50" },
};

const field = "w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint";

function fmtRange(starts: string, ends: string): string {
  const s = new Date(starts);
  const e = new Date(ends);
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
  if (s.toDateString() === e.toDateString()) {
    return `${s.toLocaleDateString("en-GB", dateOpts)} · ${s.toLocaleTimeString("en-GB", timeOpts)}–${e.toLocaleTimeString("en-GB", timeOpts)}`;
  }
  return `${s.toLocaleDateString("en-GB", dateOpts)} ${s.toLocaleTimeString("en-GB", timeOpts)} → ${e.toLocaleDateString("en-GB", dateOpts)} ${e.toLocaleTimeString("en-GB", timeOpts)}`;
}

/** A local datetime ("YYYY-MM-DDTHH:MM" from a datetime-local input) → ISO. */
function localToIso(v: string): string {
  return new Date(v).toISOString();
}

export function ScheduleManager({
  businessId,
  services,
  rules: initialRules,
  overrides: initialOverrides,
}: {
  businessId: string;
  services: Service[];
  rules: BookAvailabilityRule[];
  overrides: BookSlotOverride[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [overrides, setOverrides] = useState(initialOverrides);
  const [error, setError] = useState<string | null>(null);

  /* ── Weekly-rule form state ── */
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [interval, setIntervalMins] = useState(30);
  const [ruleService, setRuleService] = useState("");
  const [savingRule, setSavingRule] = useState(false);

  /* ── Override form state ── */
  const [ovType, setOvType] = useState<BookOverrideType>("closed");
  const [ovStart, setOvStart] = useState("");
  const [ovEnd, setOvEnd] = useState("");
  const [ovNotes, setOvNotes] = useState("");
  const [ovService, setOvService] = useState("");
  const [savingOv, setSavingOv] = useState(false);

  const toggleDay = (idx: number) => setDays((d) => (d.includes(idx) ? d.filter((x) => x !== idx) : [...d, idx].sort((a, b) => a - b)));

  async function addRule() {
    setError(null);
    if (days.length === 0) return setError("Pick at least one day.");
    if (end <= start) return setError("End time must be after start time.");
    setSavingRule(true);
    try {
      await Promise.all(
        days.map((d) =>
          createAvailabilityRule(businessId, {
            day_of_week: d,
            start_time: start,
            end_time: end,
            slot_interval_minutes: interval,
            service_id: ruleService || null,
          }),
        ),
      );
      router.refresh();
      // Optimistic local refresh so the list updates without a full reload flash.
      setRules((prev) => [
        ...prev,
        ...days.map((d, i) => ({
          id: `tmp-${Date.now()}-${i}`,
          business_id: businessId,
          service_id: ruleService || null,
          day_of_week: d,
          start_time: `${start}:00`,
          end_time: `${end}:00`,
          slot_interval_minutes: interval,
          is_active: true,
        })),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add hours.");
    } finally {
      setSavingRule(false);
    }
  }

  async function removeRule(id: string) {
    setError(null);
    const snapshot = rules;
    setRules((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteAvailabilityRule(id);
      router.refresh();
    } catch (e) {
      setRules(snapshot);
      setError(e instanceof Error ? e.message : "Could not remove.");
    }
  }

  async function addOverride() {
    setError(null);
    if (!ovStart || !ovEnd) return setError("Choose a start and end date/time.");
    if (localToIso(ovEnd) <= localToIso(ovStart)) return setError("End must be after start.");
    setSavingOv(true);
    try {
      await createOverride(businessId, {
        type: ovType,
        starts_at: localToIso(ovStart),
        ends_at: localToIso(ovEnd),
        notes: ovNotes.trim() || null,
        service_id: ovService || null,
      });
      setOvStart("");
      setOvEnd("");
      setOvNotes("");
      setOverrides((prev) =>
        [
          ...prev,
          {
            id: `tmp-${Date.now()}`,
            business_id: businessId,
            service_id: ovService || null,
            starts_at: localToIso(ovStart),
            ends_at: localToIso(ovEnd),
            type: ovType,
            notes: ovNotes.trim() || null,
          },
        ].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add override.");
    } finally {
      setSavingOv(false);
    }
  }

  async function removeOverride(id: string) {
    setError(null);
    const snapshot = overrides;
    setOverrides((prev) => prev.filter((o) => o.id !== id));
    try {
      await deleteOverride(id);
      router.refresh();
    } catch (e) {
      setOverrides(snapshot);
      setError(e instanceof Error ? e.message : "Could not remove.");
    }
  }

  const serviceName = (id: string | null) => (id ? services.find((s) => s.id === id)?.name ?? "Service" : null);

  return (
    <div className="space-y-8">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {/* ── Weekly hours ── */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Weekly hours</h2>
          <p className="text-sm text-ink-muted">The blocks of time that repeat every week and drive your bookable slots.</p>
        </div>

        {/* Existing rules grouped by day */}
        {rules.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-paper/60 px-5 py-8 text-center text-sm text-ink-muted">
            No weekly hours set yet. Add a block below — e.g. <span className="font-semibold">Tuesday 09:00–17:30</span>.
          </p>
        ) : (
          <div className="space-y-2">
            {DAYS_OF_WEEK.map((d) => {
              const dayRules = rules.filter((r) => r.day_of_week === d.idx);
              if (dayRules.length === 0) return null;
              return (
                <div key={d.idx} className="flex items-start gap-3 rounded-card border border-line bg-paper p-3 shadow-soft">
                  <span className="w-10 shrink-0 pt-1 text-sm font-bold text-ink">{d.short}</span>
                  <div className="flex flex-wrap gap-2">
                    {dayRules.map((r) => (
                      <span key={r.id} className="inline-flex items-center gap-2 rounded-pill border border-line-strong bg-sand px-3 py-1 text-xs font-semibold text-ink">
                        {formatTime(r.start_time)}–{formatTime(r.end_time)}
                        <span className="font-normal text-ink-muted">· {r.slot_interval_minutes}m{serviceName(r.service_id) ? ` · ${serviceName(r.service_id)}` : ""}</span>
                        <button onClick={() => removeRule(r.id)} className="text-rose-500 hover:text-rose-700" aria-label="Remove block">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add-rule form */}
        <div className="space-y-3 rounded-card border border-line bg-paper p-5 shadow-soft">
          <p className="text-sm font-semibold text-ink-soft">Add weekly hours</p>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((d) => {
              const on = days.includes(d.idx);
              return (
                <button
                  key={d.idx}
                  type="button"
                  onClick={() => toggleDay(d.idx)}
                  className={"rounded-pill border px-3 py-1.5 text-xs font-bold transition " + (on ? "border-transparent text-white" : "border-line-strong text-ink-soft hover:bg-sand")}
                  style={on ? { background: BIZ } : undefined}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-soft">Start</label>
              <input className={field} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-soft">End</label>
              <input className={field} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-soft">Slot interval</label>
              <select className={field} value={interval} onChange={(e) => setIntervalMins(Number(e.target.value))}>
                {INTERVALS.map((n) => (
                  <option key={n} value={n}>{n} min</option>
                ))}
              </select>
            </div>
          </div>
          {services.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-soft">Service (optional)</label>
              <select className={field} value={ruleService} onChange={(e) => setRuleService(e.target.value)}>
                <option value="">All services</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <button onClick={addRule} disabled={savingRule} className="rounded-pill px-5 py-2.5 text-sm font-semibold text-white shadow-soft disabled:opacity-50" style={{ background: BIZ }}>
            {savingRule ? "Adding…" : "+ Add to schedule"}
          </button>
        </div>
      </section>

      {/* ── Date overrides ── */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Date overrides</h2>
          <p className="text-sm text-ink-muted">One-off changes — holidays, sick days, extra open hours, or last-min slot drops.</p>
        </div>

        {overrides.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-paper/60 px-5 py-8 text-center text-sm text-ink-muted">No upcoming overrides.</p>
        ) : (
          <div className="space-y-2">
            {overrides.map((o) => (
              <div key={o.id} className="flex items-start justify-between gap-3 rounded-card border border-line bg-paper p-4 shadow-soft">
                <div className="min-w-0">
                  <span className={"inline-block rounded-pill border px-2.5 py-0.5 text-xs font-semibold " + OVERRIDE_META[o.type].chip}>{OVERRIDE_META[o.type].label}</span>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{fmtRange(o.starts_at, o.ends_at)}</p>
                  {serviceName(o.service_id) && <p className="text-xs text-ink-muted">{serviceName(o.service_id)}</p>}
                  {o.notes && <p className="text-xs italic text-ink-muted">{o.notes}</p>}
                </div>
                <button onClick={() => removeOverride(o.id)} className="shrink-0 rounded-pill border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">Remove</button>
              </div>
            ))}
          </div>
        )}

        {/* Add-override form */}
        <div className="space-y-3 rounded-card border border-line bg-paper p-5 shadow-soft">
          <p className="text-sm font-semibold text-ink-soft">Add a date override</p>
          <div className="flex flex-wrap gap-2">
            {(["closed", "open", "last_min"] as BookOverrideType[]).map((t) => {
              const on = ovType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOvType(t)}
                  className={"rounded-pill border px-3 py-1.5 text-xs font-bold transition " + (on ? "border-transparent text-white" : "border-line-strong text-ink-soft hover:bg-sand")}
                  style={on ? { background: BIZ } : undefined}
                >
                  {OVERRIDE_META[t].label}
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-soft">From</label>
              <input className={field} type="datetime-local" value={ovStart} onChange={(e) => setOvStart(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-soft">To</label>
              <input className={field} type="datetime-local" value={ovEnd} onChange={(e) => setOvEnd(e.target.value)} />
            </div>
          </div>
          {services.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-soft">Service (optional)</label>
              <select className={field} value={ovService} onChange={(e) => setOvService(e.target.value)}>
                <option value="">All services</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <textarea className={field + " min-h-[60px]"} placeholder="Notes (optional) — e.g. Up Helly Aa" value={ovNotes} onChange={(e) => setOvNotes(e.target.value)} maxLength={140} />
          <button onClick={addOverride} disabled={savingOv} className="rounded-pill px-5 py-2.5 text-sm font-semibold text-white shadow-soft disabled:opacity-50" style={{ background: BIZ }}>
            {savingOv ? "Saving…" : "+ Add override"}
          </button>
        </div>
      </section>
    </div>
  );
}
