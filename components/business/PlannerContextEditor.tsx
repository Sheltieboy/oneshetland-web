"use client";

import {
  BOOKINGS, DWELL_CHOICES, GOOD_FOR, NOTE_MAX, SETTINGS,
  type PlannerContext,
} from "@/lib/planner-context";

/**
 * "Appearing in visitors' plans" — the context the day planner needs and
 * cannot infer.
 *
 * Structured first, one short line of prose second, and that ordering is the
 * whole design. Asked for a paragraph, every business writes an advert, and an
 * advert is precisely what a planner can't reason over. Chips and a number can
 * be reasoned over; "a warm welcome awaits" cannot.
 *
 * The visitor-ready switch is three-state on purpose. Not-said is not the same
 * as no: an owner who never opens this form keeps appearing exactly as today,
 * and only an explicit no takes them out.
 */
export function PlannerContextEditor({
  value,
  onChange,
}: {
  value: PlannerContext;
  onChange: (next: PlannerContext) => void;
}) {
  const set = <K extends keyof PlannerContext>(k: K, v: PlannerContext[K]) =>
    onChange({ ...value, [k]: v });

  const ready = value.planner_visitor_ready;
  const chips = value.planner_good_for ?? [];
  const noteLeft = NOTE_MAX - (value.planner_note?.length ?? 0);

  const pill = (on: boolean) =>
    "rounded-pill border px-3.5 py-1.5 text-sm font-semibold transition " +
    (on ? "border-transparent bg-purple-600 text-white" : "border-line-strong text-ink-soft hover:bg-sand");

  return (
    <div className="space-y-4 rounded-card border border-line bg-sand/30 p-4">
      <div>
        <p className="font-display font-bold text-ink">Appearing in visitors&apos; plans</p>
        <p className="mt-1 text-sm text-ink-muted">
          OneShetland builds visitors a day out — what to see, where to eat, in an order that works. This is
          what it needs to know about you. It takes a minute and it&apos;s the difference between being
          suggested and being skipped.
        </p>
      </div>

      {/* Three states, and the middle one is the default for a reason. */}
      <div>
        <span className="mb-1 block text-sm font-semibold text-ink-soft">
          Should we send visitors your way?
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => set("planner_visitor_ready", true)} className={pill(ready === true)}>
            Yes, we&apos;re worth a visit
          </button>
          <button type="button" onClick={() => set("planner_visitor_ready", false)} className={pill(ready === false)}>
            No — we&apos;re not that sort of place
          </button>
          <button type="button" onClick={() => set("planner_visitor_ready", null)} className={pill(ready == null)}>
            Not said
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          Say no if you&apos;re a trade counter, an office or anywhere a visitor turning up would be a nuisance.
          You&apos;ll still appear in the Directory either way.
        </p>
      </div>

      {ready !== false && (
        <>
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink-soft" htmlFor="dwell">
              How long do folk usually spend?
            </label>
            <select
              id="dwell"
              value={value.planner_dwell_minutes ?? ""}
              onChange={(e) => set("planner_dwell_minutes", e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none"
            >
              <option value="">Not said</option>
              {DWELL_CHOICES.map((d) => (
                <option key={d.minutes} value={d.minutes}>{d.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-faint">
              This sets the times either side of you in someone&apos;s day, so a rough answer is worth far more
              than none.
            </p>
          </div>

          <div>
            <span className="mb-1 block text-sm font-semibold text-ink-soft">Indoors or out?</span>
            <div className="flex flex-wrap gap-2">
              {SETTINGS.map((s) => (
                <button key={s.key} type="button" onClick={() => set("planner_setting", s.key)} className={pill(value.planner_setting === s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-faint">Lets us put you forward when the weather turns.</p>
          </div>

          <div>
            <span className="mb-1 block text-sm font-semibold text-ink-soft">Good for…</span>
            <div className="flex flex-wrap gap-2">
              {GOOD_FOR.map((g) => {
                const on = chips.includes(g.key);
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => set("planner_good_for", on ? chips.filter((c) => c !== g.key) : [...chips, g.key])}
                    className={pill(on)}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-sm font-semibold text-ink-soft">Do folk need to book?</span>
            <div className="flex flex-wrap gap-2">
              {BOOKINGS.map((b) => (
                <button key={b.key} type="button" onClick={() => set("planner_booking", b.key)} className={pill(value.planner_booking === b.key)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-ink-soft" htmlFor="pnote">
              One line: what does a visitor actually do here?
            </label>
            <input
              id="pnote"
              value={value.planner_note ?? ""}
              maxLength={NOTE_MAX}
              onChange={(e) => set("planner_note", e.target.value || null)}
              placeholder="e.g. Hand-knitted Fair Isle you can watch being made, and a peerie café at the back."
              className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none"
            />
            <p className="mt-1 flex justify-between gap-3 text-xs text-ink-faint">
              <span>
                Not an advert — this is read by the planner, and it works far better on plain facts than on
                adjectives.
              </span>
              <span className={noteLeft < 20 ? "font-semibold text-amber-700" : ""}>{noteLeft}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
