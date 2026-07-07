"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  validateEventTicket,
  fetchScannerStats,
  type CheckInResult,
  type ScannerStats,
} from "@/lib/events-client";

const EVENTS = "var(--color-events)";

const RESULT_META: Record<
  string,
  { label: string; tone: "good" | "warn" | "bad" }
> = {
  valid: { label: "✓ Admitted", tone: "good" },
  already_used: { label: "⚠ Already checked in", tone: "warn" },
  payment_incomplete: { label: "⚠ Payment incomplete", tone: "warn" },
  wrong_event: { label: "✗ Wrong event", tone: "bad" },
  cancelled: { label: "✗ Ticket cancelled", tone: "bad" },
  refunded: { label: "✗ Ticket refunded", tone: "bad" },
  not_found: { label: "✗ Ticket not found", tone: "bad" },
  invalid_token: { label: "✗ Invalid code", tone: "bad" },
};

const TONE_STYLE: Record<string, { bg: string; ring: string; fg: string }> = {
  good: { bg: "#ecfdf5", ring: "#10b981", fg: "#047857" },
  warn: { bg: "#fffbeb", ring: "#f59e0b", fg: "#b45309" },
  bad: { bg: "#fef2f2", ring: "#ef4444", fg: "#b91c1c" },
};

function statTone(result: CheckInResult): { bg: string; ring: string; fg: string } {
  const meta = RESULT_META[result.result];
  return TONE_STYLE[meta?.tone ?? "bad"];
}

export function CheckInTool({
  eventId,
  initialStats,
}: {
  eventId: string;
  initialStats: ScannerStats | null;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<CheckInResult | null>(null);
  const [stats, setStats] = useState<ScannerStats | null>(initialStats);
  const [sessionAdmitted, setSessionAdmitted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshStats = useCallback(() => {
    fetchScannerStats(eventId).then(setStats).catch(() => {});
  }, [eventId]);

  const submit = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value || busy) return;
      setBusy(true);
      setError(null);
      try {
        // A QR token is long/opaque; a backup code is the short XXXX-XXXX form.
        // Heuristic: anything matching the 8-char alphanumeric backup shape goes
        // through backup_code, otherwise treat it as a raw QR token.
        const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const isBackup = cleaned.length === 8 && value.length <= 9;
        const res = await validateEventTicket(
          eventId,
          isBackup ? { backupCode: cleaned } : { rawToken: value },
        );
        setLast(res);
        if (res.result === "valid") setSessionAdmitted((n) => n + 1);
        setCode("");
        refreshStats();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not check that ticket. Try again.");
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [eventId, busy, refreshStats],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const remaining = stats ? Math.max(0, stats.tickets_sold - stats.checked_in) : null;
  const lastMeta = last ? RESULT_META[last.result] : null;
  const lastStyle = last ? statTone(last) : null;

  return (
    <div className="space-y-6">
      {/* Live counts */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Sold" value={stats?.tickets_sold ?? "—"} accent={EVENTS} />
        <Stat label="Checked in" value={stats?.checked_in ?? "—"} accent="#10b981" />
        <Stat label="Remaining" value={remaining ?? "—"} accent="var(--color-ink-muted)" />
      </div>

      {/* Entry form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(code);
        }}
        className="rounded-[var(--radius-card)] border border-line bg-paper p-5 shadow-[var(--shadow-soft)]"
      >
        <label htmlFor="ticket-code" className="block text-sm font-semibold text-ink-soft">
          Ticket code
        </label>
        <p className="mb-3 mt-0.5 text-sm text-ink-muted">
          Type or paste the attendee&apos;s QR token, or their{" "}
          <span className="font-mono font-semibold">XXXX-XXXX</span> backup code.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            ref={inputRef}
            id="ticket-code"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX"
            disabled={busy}
            className="flex-1 rounded-[14px] border border-line-strong bg-cream px-4 py-3 font-mono text-lg tracking-widest text-ink outline-none focus:border-[color:var(--color-events)] focus:ring-2 focus:ring-[color:var(--color-events)]/25 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="rounded-[14px] px-6 py-3 text-base font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: EVENTS }}
          >
            {busy ? "Checking…" : "Check in"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm font-semibold text-[#b91c1c]">{error}</p>
        )}
      </form>

      {/* Last result */}
      {last && lastMeta && lastStyle && (
        <div
          className="rounded-[var(--radius-card)] border p-5"
          style={{ background: lastStyle.bg, borderColor: lastStyle.ring }}
          role="status"
          aria-live="polite"
        >
          <p className="text-xl font-extrabold" style={{ color: lastStyle.fg }}>
            {lastMeta.label}
          </p>
          {last.ticket_type_name && (
            <p className="mt-1 text-base font-semibold text-ink">{last.ticket_type_name}</p>
          )}
          {last.attendee_name && (
            <p className="text-sm text-ink-soft">{last.attendee_name}</p>
          )}
          {last.result === "already_used" && last.checked_in_at && (
            <p className="mt-1 text-sm text-ink-muted">
              First scanned {new Date(last.checked_in_at).toLocaleString("en-GB")}
            </p>
          )}
        </div>
      )}

      {/* Session tally */}
      <div className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-sand px-5 py-4">
        <span className="text-sm font-semibold text-ink-soft">Admitted this session</span>
        <span className="font-display text-2xl font-bold text-ink">{sessionAdmitted}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper px-4 py-4 text-center shadow-[var(--shadow-soft)]">
      <div className="font-display text-3xl font-bold" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </div>
    </div>
  );
}
