"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAnalyticsConsent, setAnalyticsConsent } from "@/lib/analytics";
import type { NotificationPrefs } from "@/lib/account-data.server";

// Mirrors the app's lib/notification-prefs.ts (NOTIFICATION_GROUPS + NOTIFICATION_MODULES).
// Keep in sync when modules change.
type GroupKey = "work" | "local" | "money" | "community" | "play" | "business";

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "work", label: "Getting things done" },
  { key: "local", label: "Local life" },
  { key: "money", label: "Money & payments" },
  { key: "community", label: "Community" },
  { key: "play", label: "Games & language" },
  { key: "business", label: "For businesses" },
];

type ModuleKey = Exclude<keyof NotificationPrefs, "enabled" | "quiet_hours_start" | "quiet_hours_end">;

const MODULES: { key: ModuleKey; group: GroupKey; label: string; desc: string }[] = [
  { key: "fetch_enabled", group: "work", label: "Fetch deliveries", desc: "Your delivery progress and driver updates" },
  { key: "shifts_enabled", group: "work", label: "Shifts", desc: "Matching shifts, applications, check-ins" },
  { key: "jobs_enabled", group: "work", label: "Jobs", desc: "Applications and updates on jobs you applied for" },
  { key: "bookings_enabled", group: "local", label: "Bookings", desc: "Confirmations, reminders and changes" },
  { key: "loyalty_enabled", group: "local", label: "Loyalty & rewards", desc: "Stamps collected and rewards ready" },
  { key: "offers_enabled", group: "local", label: "Offers & deals", desc: "New time-limited deals near you" },
  { key: "events_enabled", group: "local", label: "What's On", desc: "Tickets, reminders, cancellations" },
  { key: "cruise_enabled", group: "local", label: "Cruise ships", desc: "Ships arriving in Shetland (off by default)" },
  { key: "wallet_enabled", group: "money", label: "Wallet & payments", desc: "Top-ups, payments, cashback and gifts" },
  { key: "hubs_enabled", group: "community", label: "Hubs", desc: "Announcements from hubs you belong to" },
  { key: "community_enabled", group: "community", label: "Community & stories", desc: "Replies and reactions on your stories and boats" },
  { key: "notices_enabled", group: "community", label: "Notices & safety", desc: "Community notices, including urgent alerts" },
  { key: "spik_enabled", group: "play", label: "Spik", desc: "Wird o' da day and streak reminders" },
  { key: "games_enabled", group: "play", label: "Games", desc: "Daily games and leaderboard nudges" },
  { key: "business_enabled", group: "business", label: "My business", desc: "New bookings, sales, payments and approvals" },
];

function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onChange} disabled={disabled} aria-pressed={on} aria-label={label}
      className={"relative h-6 w-11 shrink-0 rounded-pill transition disabled:opacity-40 " + (on ? "bg-navy" : "bg-line-strong")}>
      <span className={"absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all " + (on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function NotificationPrefsForm({ userId, initial }: { userId: string; initial: NotificationPrefs }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [savedAt, setSavedAt] = useState<number>(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Analytics consent is stored client-side (localStorage), mirroring the app.
  const [analyticsOn, setAnalyticsOn] = useState(false);
  useEffect(() => { setAnalyticsOn(getAnalyticsConsent()); }, []);
  const toggleAnalytics = () => {
    const next = !analyticsOn;
    setAnalyticsConsent(next);
    setAnalyticsOn(next);
  };

  async function persist(next: NotificationPrefs) {
    setPrefs(next);
    try {
      await createClient().from("notification_preferences").upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      setSavedAt(Date.now());
    } catch { /* non-fatal */ }
  }
  const set = (k: keyof NotificationPrefs, v: NotificationPrefs[keyof NotificationPrefs]) => persist({ ...prefs, [k]: v });
  const setGroup = (keys: ModuleKey[], on: boolean) => {
    const patch: Partial<NotificationPrefs> = {};
    keys.forEach((k) => { (patch as Record<string, boolean>)[k] = on; });
    persist({ ...prefs, ...patch });
  };

  const quietOn = !!(prefs.quiet_hours_start || prefs.quiet_hours_end);

  return (
    <div className="space-y-6">
      {/* Master */}
      <div className="flex items-center justify-between rounded-card border border-line bg-paper p-5 shadow-soft">
        <div>
          <p className="font-display font-bold text-ink">All notifications</p>
          <p className="text-sm text-ink-muted">{prefs.enabled ? "On — managed by the toggles below" : "Everything muted"}</p>
        </div>
        <Toggle on={prefs.enabled} onChange={() => set("enabled", !prefs.enabled)} label="All notifications" />
      </div>

      {/* By feature — broad category, expand to fine-tune */}
      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-ink-faint">By feature</p>
        <div className="space-y-3">
          {GROUPS.map((g) => {
            const mods = MODULES.filter((m) => m.group === g.key);
            const anyOn = mods.some((m) => prefs[m.key] as boolean);
            const allOn = mods.every((m) => prefs[m.key] as boolean);
            const isOpen = !!open[g.key];
            return (
              <div key={g.key} className={"rounded-card border border-line bg-paper shadow-soft " + (prefs.enabled ? "" : "opacity-50")}>
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))} disabled={!prefs.enabled} className="flex flex-1 items-center gap-3 text-left">
                    <span className="font-semibold text-ink">{g.label}</span>
                    <span className="text-xs text-ink-muted">{allOn ? "All on" : anyOn ? "Some on" : "All off"}</span>
                    <span className={"ml-auto text-ink-faint transition-transform " + (isOpen ? "rotate-180" : "")} aria-hidden>▾</span>
                  </button>
                  <Toggle on={prefs.enabled && anyOn} disabled={!prefs.enabled} onChange={() => setGroup(mods.map((m) => m.key), !anyOn)} label={g.label} />
                </div>
                {isOpen && (
                  <div className="border-t border-line">
                    {mods.map((m) => (
                      <div key={m.key} className="flex items-center justify-between gap-4 border-b border-line bg-cream/40 px-5 py-3 pl-8 last:border-0">
                        <div>
                          <p className="font-medium text-ink">{m.label}</p>
                          <p className="text-sm text-ink-muted">{m.desc}</p>
                        </div>
                        <Toggle on={prefs.enabled && (prefs[m.key] as boolean)} disabled={!prefs.enabled} onChange={() => set(m.key, !(prefs[m.key] as boolean))} label={m.label} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quiet hours */}
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-ink">Quiet hours</p>
            <p className="text-sm text-ink-muted">Mute non-urgent pushes overnight</p>
          </div>
          <Toggle on={quietOn} disabled={!prefs.enabled} onChange={() => persist({ ...prefs, quiet_hours_start: quietOn ? null : "22:00", quiet_hours_end: quietOn ? null : "07:00" })} label="Quiet hours" />
        </div>
        {quietOn && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm text-ink-soft">From <input type="time" value={prefs.quiet_hours_start ?? "22:00"} onChange={(e) => set("quiet_hours_start", e.target.value)} className="auth-input ml-1 inline-block w-32" /></label>
            <label className="text-sm text-ink-soft">to <input type="time" value={prefs.quiet_hours_end ?? "07:00"} onChange={(e) => set("quiet_hours_end", e.target.value)} className="auth-input ml-1 inline-block w-32" /></label>
          </div>
        )}
      </div>

      {/* Privacy — analytics consent */}
      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-ink-faint">Privacy</p>
        <div className="flex items-center justify-between rounded-card border border-line bg-paper p-5 shadow-soft">
          <div>
            <p className="font-display font-bold text-ink">Share anonymous usage data</p>
            <p className="text-sm text-ink-muted">Helps us improve OneShetland. No ads, never sold.</p>
          </div>
          <Toggle on={analyticsOn} onChange={toggleAnalytics} label="Share anonymous usage data" />
        </div>
      </div>

      {savedAt > 0 && <p className="text-sm font-semibold text-emerald-600">Saved ✓</p>}
    </div>
  );
}
