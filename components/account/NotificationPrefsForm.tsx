"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationPrefs } from "@/lib/account-data.server";

const FEATURES: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: "bookings_enabled", label: "Bookings", desc: "Confirmations and reminders for local bookings" },
  { key: "shifts_enabled", label: "Shifts", desc: "Shift offers, acceptances and check-in reminders" },
  { key: "fetch_enabled", label: "Fetch", desc: "Delivery status updates" },
  { key: "loyalty_enabled", label: "Loyalty", desc: "Stamps, rewards and card updates" },
  { key: "offers_enabled", label: "Offers", desc: "New deals from businesses you follow" },
  { key: "spik_enabled", label: "Spik", desc: "Word of the day and dictionary news" },
  { key: "games_enabled", label: "Games", desc: "Streak reminders and leaderboard changes" },
];

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onChange} disabled={disabled} aria-pressed={on}
      className={"relative h-6 w-11 shrink-0 rounded-pill transition disabled:opacity-40 " + (on ? "bg-navy" : "bg-line-strong")}>
      <span className={"absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all " + (on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function NotificationPrefsForm({ userId, initial }: { userId: string; initial: NotificationPrefs }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [savedAt, setSavedAt] = useState<number>(0);

  async function persist(next: NotificationPrefs) {
    setPrefs(next);
    try {
      await createClient().from("notification_preferences").upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      setSavedAt(Date.now());
    } catch { /* non-fatal */ }
  }
  const set = (k: keyof NotificationPrefs, v: NotificationPrefs[keyof NotificationPrefs]) => persist({ ...prefs, [k]: v });

  const quietOn = !!(prefs.quiet_hours_start || prefs.quiet_hours_end);

  return (
    <div className="space-y-6">
      {/* Master */}
      <div className="flex items-center justify-between rounded-card border border-line bg-paper p-5 shadow-soft">
        <div>
          <p className="font-display font-bold text-ink">All notifications</p>
          <p className="text-sm text-ink-muted">{prefs.enabled ? "On — managed by the toggles below" : "Everything muted"}</p>
        </div>
        <Toggle on={prefs.enabled} onChange={() => set("enabled", !prefs.enabled)} />
      </div>

      {/* By feature */}
      <div className="rounded-card border border-line bg-paper shadow-soft">
        <p className="border-b border-line px-5 py-3 text-xs font-bold uppercase tracking-widest text-ink-faint">By feature</p>
        {FEATURES.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 last:border-0">
            <div>
              <p className="font-semibold text-ink">{f.label}</p>
              <p className="text-sm text-ink-muted">{f.desc}</p>
            </div>
            <Toggle on={prefs.enabled && (prefs[f.key] as boolean)} disabled={!prefs.enabled} onChange={() => set(f.key, !(prefs[f.key] as boolean))} />
          </div>
        ))}
      </div>

      {/* Quiet hours */}
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-ink">Quiet hours</p>
            <p className="text-sm text-ink-muted">Mute non-urgent pushes overnight</p>
          </div>
          <Toggle on={quietOn} disabled={!prefs.enabled} onChange={() => persist({ ...prefs, quiet_hours_start: quietOn ? null : "22:00", quiet_hours_end: quietOn ? null : "07:00" })} />
        </div>
        {quietOn && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm text-ink-soft">From <input type="time" value={prefs.quiet_hours_start ?? "22:00"} onChange={(e) => set("quiet_hours_start", e.target.value)} className="auth-input ml-1 inline-block w-32" /></label>
            <label className="text-sm text-ink-soft">to <input type="time" value={prefs.quiet_hours_end ?? "07:00"} onChange={(e) => set("quiet_hours_end", e.target.value)} className="auth-input ml-1 inline-block w-32" /></label>
          </div>
        )}
      </div>

      {savedAt > 0 && <p className="text-sm font-semibold text-emerald-600">Saved ✓</p>}
    </div>
  );
}
