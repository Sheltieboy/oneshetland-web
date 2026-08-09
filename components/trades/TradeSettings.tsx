"use client";

import { useState, useTransition } from "react";
import { saveTradeProfile } from "@/lib/trades-actions";
import {
  AVAILABILITY, AVAILABILITY_TTL_DAYS, CREDENTIALS, CREDENTIALS_DISCLAIMER,
  TRADES, availabilityIsFresh,
} from "@/lib/trades";

/**
 * What you cover, and whether you have room.
 *
 * The availability answer is the whole product, so it's first and it's big.
 * It also expires: a trade who said "taking work on" in March and never came
 * back would otherwise keep getting jobs they can't do all summer, which is
 * how a lead system earns a reputation for wasting everybody's time.
 */

const ACCENT = "#2a8b5c";

export function TradeSettings({
  businessId,
  initial,
}: {
  businessId: string;
  initial: { trades: string[]; availability: string | null; availabilitySetAt: string | null; minJobPence: number | null; credentials: string[] };
}) {
  const [open, setOpen] = useState(!initial.availability || initial.trades.length === 0);
  const [trades, setTrades] = useState<string[]>(initial.trades);
  const [availability, setAvailability] = useState<string | null>(initial.availability);
  const [minJob, setMinJob] = useState(initial.minJobPence ? String(Math.round(initial.minJobPence / 100)) : "");
  const [credentials, setCredentials] = useState<string[]>(initial.credentials);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stale = !!initial.availability && !availabilityIsFresh(initial.availabilitySetAt);

  const pill = (on: boolean) =>
    "rounded-pill border px-3 py-1.5 text-sm font-semibold transition " +
    (on ? "border-transparent text-white" : "border-line-strong text-ink-soft hover:bg-sand");

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveTradeProfile(businessId, {
        trades,
        availability,
        minJobPence: minJob.trim() ? Math.round(Number(minJob) * 100) : null,
        credentials,
      });
      if (!res.ok) { setError(res.error ?? "Couldn't save."); return; }
      setSaved(true); setOpen(false);
    });
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-ink">What you do, and when</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {trades.length === 0
              ? "Nothing set — no jobs will reach you."
              : `${trades.length} ${trades.length === 1 ? "trade" : "trades"} · ${
                  availability ? AVAILABILITY.find((a) => a.key === availability)?.label : "availability not set"
                }`}
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-sm font-semibold underline" style={{ color: ACCENT }}>
          {open ? "Close" : "Change"}
        </button>
      </div>

      {stale && !open && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your availability is more than {AVAILABILITY_TTL_DAYS} days old, so jobs have stopped
          coming. Confirm it and they&apos;ll start again.
        </p>
      )}
      {saved && !open && <p className="mt-3 text-sm font-semibold text-emerald-700">Saved.</p>}

      {open && (
        <div className="mt-5 space-y-5">
          <div>
            <p className="font-semibold text-ink">Have you room for work?</p>
            <p className="mb-2 text-sm text-ink-muted">
              The one thing folk most want to know, and what decides whether jobs reach you.
              We&apos;ll ask again in {AVAILABILITY_TTL_DAYS} days.
            </p>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY.map((a) => (
                <button key={a.key} type="button" className={pill(availability === a.key)}
                  style={availability === a.key ? { background: ACCENT } : undefined}
                  onClick={() => setAvailability(a.key)}>
                  {a.label}
                </button>
              ))}
            </div>
            {availability && (
              <p className="mt-1.5 text-xs text-ink-faint">
                {AVAILABILITY.find((a) => a.key === availability)?.blurb}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 font-semibold text-ink">What do you cover?</p>
            <div className="flex flex-wrap gap-2">
              {TRADES.map((t) => {
                const on = trades.includes(t.key);
                return (
                  <button key={t.key} type="button" className={pill(on)}
                    style={on ? { background: ACCENT } : undefined}
                    onClick={() => setTrades((p) => on ? p.filter((k) => k !== t.key) : [...p, t.key])}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-ink" htmlFor="minjob">
              Smallest job worth your trip
            </label>
            <p className="mb-2 text-sm text-ink-muted">
              Optional, and it saves everybody a phone call. Leave blank to hear about anything.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-ink-soft">£</span>
              <input id="minjob" className="auth-input max-w-[10rem]" value={minJob}
                onChange={(e) => setMinJob(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric" placeholder="e.g. 150" />
            </div>
          </div>

          <div>
            <p className="mb-2 font-semibold text-ink">Anything you're registered for?</p>
            <div className="flex flex-wrap gap-2">
              {CREDENTIALS.map((c) => {
                const on = credentials.includes(c.key);
                return (
                  <button key={c.key} type="button" className={pill(on)}
                    style={on ? { background: ACCENT } : undefined}
                    onClick={() => setCredentials((p) => on ? p.filter((k) => k !== c.key) : [...p, c.key])}>
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-faint">{CREDENTIALS_DISCLAIMER}</p>
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

          <button onClick={save} disabled={pending}
            className="rounded-pill px-6 py-3 font-bold text-white shadow-soft disabled:opacity-60"
            style={{ background: ACCENT }}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
