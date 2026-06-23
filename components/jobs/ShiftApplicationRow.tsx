"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type ShiftApplication, formatPay, formatShiftDate, type PayType } from "@/lib/jobs-data";

const SHIFTS = "#e8a020";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", accepted: "Confirmed", rejected: "Not selected", withdrawn: "Withdrawn",
};

export function ShiftApplicationRow({ app }: { app: ShiftApplication }) {
  const router = useRouter();
  const [status, setStatus] = useState(app.status);
  const [check, setCheck] = useState(app.check_in_status);
  const [busy, setBusy] = useState(false);

  const s = app.shift;
  const sb = () => createClient();

  async function withdraw() {
    setBusy(true);
    try { await sb().from("shift_applications").update({ status: "withdrawn" }).eq("id", app.id); setStatus("withdrawn"); router.refresh(); }
    finally { setBusy(false); }
  }
  async function setCheckStatus(next: "checked_in" | "checked_out") {
    setBusy(true);
    try {
      const stamp = next === "checked_in" ? { checked_in_at: new Date().toISOString() } : { checked_out_at: new Date().toISOString() };
      await sb().from("shift_applications").update({ check_in_status: next, ...stamp }).eq("id", app.id);
      setCheck(next); router.refresh();
    } finally { setBusy(false); }
  }

  const canCheckIn = s?.start_at ? Date.now() >= new Date(s.start_at).getTime() - 2 * 3600_000 : false;
  const closed = status === "rejected" || status === "withdrawn";

  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/shifts/${app.shift_id}`} className="font-display font-bold text-ink hover:underline">{s?.title ?? "Shift"}</Link>
          <p className="text-sm text-ink-muted">
            {s?.start_at ? formatShiftDate(s.start_at) : ""}{s?.location_text ? ` · ${s.location_text}` : ""}
          </p>
          {s?.pay_type && <p className="mt-0.5 text-sm font-semibold" style={{ color: SHIFTS }}>{formatPay(s.pay_type as PayType, s.pay_amount ?? null)}</p>}
        </div>
        <span className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: status === "accepted" ? `${SHIFTS}1a` : "var(--color-sand)", color: status === "accepted" ? SHIFTS : "var(--color-ink-muted)" }}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {/* Check-in flow for confirmed shifts */}
      {status === "accepted" && (
        <div className="mt-4 rounded-xl bg-sand/60 p-3">
          {check === "employer_confirmed" ? (
            <p className="text-sm font-semibold text-ink-soft">Shift complete ✓</p>
          ) : check === "checked_out" ? (
            <p className="text-sm text-ink-soft">Checked out — waiting for the employer to confirm.</p>
          ) : check === "checked_in" ? (
            <button onClick={() => setCheckStatus("checked_out")} disabled={busy} className="rounded-pill px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40" style={{ background: SHIFTS }}>I've finished</button>
          ) : canCheckIn ? (
            <button onClick={() => setCheckStatus("checked_in")} disabled={busy} className="rounded-pill px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40" style={{ background: SHIFTS }}>Check in to this shift</button>
          ) : (
            <p className="text-sm text-ink-soft">You're confirmed — check-in opens 2 hours before the start.</p>
          )}
        </div>
      )}

      {status === "pending" && !closed && (
        <div className="mt-3 text-right">
          <button onClick={withdraw} disabled={busy} className="rounded-pill border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand disabled:opacity-40">{busy ? "…" : "Withdraw"}</button>
        </div>
      )}
    </div>
  );
}
