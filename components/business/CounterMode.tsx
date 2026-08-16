"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type BusinessCode } from "@/lib/business-data";
import { refreshBusinessCode } from "@/lib/business-client";
import { HelpTip } from "@/components/help/HelpTip";

/**
 * CounterMode — the web twin of the app's Counter mode (app/local-counter.tsx).
 *
 * Manage is for the owner; this is for whoever is actually serving. A shop can
 * leave it open on a laptop or tablet at the counter all day: the till code big
 * enough to read across a counter, and one route to the till for scanning a
 * member card.
 *
 * The staff PIN is stored per-business in localStorage — deliberately local to
 * the screen in front of you, exactly as the app keeps it in SecureStore. It
 * stops a staff member wandering from the counter into takings and payouts; it
 * is not an account credential, and clearing site data clears it.
 */

const PIN_KEY = (businessId: string) => `counter_pin_${businessId}`;
const ACCENT = "#7c3aed";

export function CounterMode({
  businessId,
  businessName,
  initial,
}: {
  businessId: string;
  businessName: string;
  initial: BusinessCode | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(initial?.current_code ?? null);
  const [expiresAt, setExpiresAt] = useState<number | null>(
    initial ? new Date(initial.expires_at).getTime() : null,
  );
  const [pin, setPin] = useState<string | null>(null);
  const [asking, setAsking] = useState<null | "set" | "exit">(null);
  const [entry, setEntry] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => { setPin(localStorage.getItem(PIN_KEY(businessId))); }, [businessId]);

  const rotate = useCallback(async () => {
    try {
      const fresh = await refreshBusinessCode(businessId);
      setCode(fresh.current_code);
      setExpiresAt(new Date(fresh.expires_at).getTime());
    } catch { /* the old code stays up; the next tick retries */ }
  }, [businessId]);

  useEffect(() => {
    void rotate();
    const t = setInterval(() => void rotate(), 60_000);
    return () => clearInterval(t);
  }, [rotate]);

  // Drives the visible countdown only.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const leave = useCallback(() => {
    router.push(`/business/${businessId}/manage`);
  }, [router, businessId]);

  function tryLeave() {
    if (!pin) { leave(); return; }
    setEntry(""); setPinError(null); setAsking("exit");
  }

  function submitPin() {
    if (!/^\d{4}$/.test(entry)) { setPinError("Four digits."); return; }
    if (asking === "set") {
      localStorage.setItem(PIN_KEY(businessId), entry);
      setPin(entry); setAsking(null); setEntry("");
      return;
    }
    if (entry !== pin) { setPinError("That's not the PIN."); setEntry(""); return; }
    setAsking(null); setEntry("");
    leave();
  }

  function clearPin() {
    localStorage.removeItem(PIN_KEY(businessId));
    setPin(null);
  }

  const secondsLeft = expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0B0620] text-white">
      <header className="flex items-center gap-4 px-6 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">{businessName}</p>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/55">
            Counter mode
            <HelpTip topic="till-code" tone="dark" label="Help with the till code" />
          </p>
        </div>
        <button
          onClick={tryLeave}
          className="rounded-pill bg-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/25"
        >
          {pin ? "🔒 " : ""}Exit
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-xs font-black tracking-[0.2em] text-white/50">TILL CODE</p>
        <p className="mt-2 font-mono text-6xl font-black tracking-[0.15em] tabular-nums sm:text-7xl">
          {code ?? "——————"}
        </p>
        <p className="mt-3 text-sm text-white/60">
          {secondsLeft > 0
            ? `Customers enter this in their wallet to pay · refreshes in ${secondsLeft}s`
            : "Refreshing…"}
        </p>

        <a
          href={`/business/${businessId}/manage/loyalty`}
          className="mt-10 w-full max-w-md rounded-xl px-8 py-6 font-display text-2xl font-bold shadow-soft transition hover:brightness-110"
          style={{ background: ACCENT }}
        >
          Scan a member card
        </a>
        <p className="mt-3 text-xs text-white/50">Stamps, points, rewards, offers and card payments</p>
      </div>

      <footer className="pb-6 text-center">
        {pin ? (
          <button onClick={clearPin} className="text-xs font-semibold text-white/60 underline">Remove staff PIN</button>
        ) : (
          <button onClick={() => { setEntry(""); setPinError(null); setAsking("set"); }} className="text-xs font-semibold text-white/60 underline">
            Set a staff PIN to lock this screen
          </button>
        )}
      </footer>

      {asking && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-black/60 p-6">
          <div className="w-full max-w-sm rounded-card bg-paper p-6 text-ink">
            <h2 className="font-display text-lg font-bold">
              {asking === "set" ? "Choose a 4-digit PIN" : "Enter the staff PIN"}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {asking === "set"
                ? "Staff will need this to leave Counter mode. It's stored in this browser only."
                : "Counter mode is locked."}
            </p>
            <input
              autoFocus
              inputMode="numeric"
              type="password"
              maxLength={4}
              value={entry}
              onChange={(e) => { setEntry(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") submitPin(); }}
              className="mt-4 w-full rounded-xl border border-line bg-paper px-4 py-3 text-center font-mono text-3xl font-bold tracking-[0.4em] outline-none"
            />
            {pinError && <p className="mt-2 text-sm font-semibold text-rose-600">{pinError}</p>}
            <div className="mt-4 flex gap-3">
              <button onClick={() => { setAsking(null); setEntry(""); }} className="flex-1 rounded-pill border border-line px-4 py-3 text-sm font-semibold">
                Cancel
              </button>
              <button onClick={submitPin} className="flex-1 rounded-pill px-4 py-3 text-sm font-semibold text-white" style={{ background: ACCENT }}>
                {asking === "set" ? "Save PIN" : "Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
