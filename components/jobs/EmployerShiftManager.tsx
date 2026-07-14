"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatShiftDate } from "@/lib/jobs-data";
import { ShiftBoostModal } from "@/components/jobs/ShiftBoostModal";

const SHIFTS = "#e8a020";

type ManagedShift = {
  id: string; title: string; start_at: string; status: string;
  positions_filled: number; positions_total: number;
  pending_count: number; total_apps: number; checked_out_count: number;
  posted_as_business_id: string | null; boosted_until: string | null;
};

export function EmployerShiftManager({ shifts }: { shifts: ManagedShift[] }) {
  const router = useRouter();
  const [shiftList, setShiftList] = useState(shifts);
  const [busy, setBusy] = useState<string | null>(null);
  const [boostShift, setBoostShift] = useState<ManagedShift | null>(null);

  const sb = () => createClient();

  async function cancelShift(id: string) {
    setBusy(id);
    try {
      const c = sb();
      await c.from("shifts").update({ status: "cancelled" }).eq("id", id);
      // Tell still-in-play workers the shift is off.
      c.functions.invoke("notify-shift-status", { body: { event: "cancelled", shift_id: id } }).catch(() => {});
      setShiftList((prev) => prev.map((s) => (s.id === id ? { ...s, status: "cancelled" } : s)));
      router.refresh();
    } finally { setBusy(null); }
  }

  async function complete(id: string) {
    if (!window.confirm("Mark this shift complete? The worker will be confirmed and notified.")) return;
    setBusy(id);
    try {
      const c = sb();
      await c.from("shifts").update({ status: "completed" }).eq("id", id);
      await c.from("shift_applications").update({ check_in_status: "employer_confirmed", employer_confirmed_at: new Date().toISOString() }).eq("shift_id", id).eq("status", "accepted");
      // Notify the worker their shift is confirmed complete (was missing on web).
      c.functions.invoke("notify-shift-complete", { body: { shift_id: id } }).catch(() => {});
      setShiftList((prev) => prev.map((s) => (s.id === id ? { ...s, status: "completed" } : s)));
      router.refresh();
    } finally { setBusy(null); }
  }

  const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    open: { bg: `${SHIFTS}1a`, color: SHIFTS, label: "Open" },
    filled: { bg: "#DBEAFE", color: "#1E40AF", label: "Filled" },
    cancelled: { bg: "#F3F4F6", color: "#6B7280", label: "Cancelled" },
    completed: { bg: "#D1FAE5", color: "#065F46", label: "Completed" },
    draft: { bg: "#F3F4F6", color: "#6B7280", label: "Draft" },
  };

  return (
    <div className="space-y-10">
      {/* Posted shifts */}
      <section>
        <h2 className="font-display text-2xl font-bold text-ink">Your posted shifts</h2>
        <div className="mt-4 space-y-3">
          {shiftList.map((s) => {
            const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.open;
            const active = s.status === "open" || s.status === "filled";
            // Completable once workers have checked out, OR once the shift's start has passed.
            const canComplete = (s.status === "filled" || s.status === "open")
              && (s.checked_out_count > 0 || new Date(s.start_at).getTime() < Date.now());
            const isBoosted = !!(s.boosted_until && s.boosted_until > new Date().toISOString());
            const canBoost = s.status === "open" && !isBoosted;
            return (
              <div key={s.id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/shifts/${s.id}`} className="font-display font-bold text-ink hover:underline">{s.title}</Link>
                    <p className="text-sm text-ink-muted">{formatShiftDate(s.start_at)}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">{s.positions_filled}/{s.positions_total} filled · {s.total_apps} application{s.total_apps === 1 ? "" : "s"}{s.pending_count > 0 ? ` · ${s.pending_count} to review` : ""}</p>
                    {s.pending_count > 0 && (
                      <Link href={`/shifts/${s.id}`} className="mt-1.5 inline-block text-sm font-semibold hover:underline" style={{ color: SHIFTS }}>
                        Review {s.pending_count} applicant{s.pending_count === 1 ? "" : "s"} →
                      </Link>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                    {isBoosted && <span className="rounded-pill px-2.5 py-1 text-xs font-bold text-paper" style={{ background: SHIFTS }}>⚡ Boosted</span>}
                  </div>
                </div>
                {(active || canBoost) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    {canComplete && <button onClick={() => complete(s.id)} disabled={busy === s.id} className="rounded-pill px-3.5 py-1.5 text-xs font-semibold text-paper disabled:opacity-40" style={{ background: "#059669" }}>Mark complete</button>}
                    {canBoost && <button onClick={() => setBoostShift(s)} className="rounded-pill px-3.5 py-1.5 text-xs font-semibold text-paper hover:brightness-95" style={{ background: SHIFTS }}>⚡ Boost · £2.99</button>}
                    {active && <button onClick={() => cancelShift(s.id)} disabled={busy === s.id} className="rounded-pill border border-line-strong px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">Cancel shift</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {boostShift && (
        <ShiftBoostModal
          open={!!boostShift}
          onClose={() => setBoostShift(null)}
          shiftId={boostShift.id}
          shiftTitle={boostShift.title}
          businessId={boostShift.posted_as_business_id}
          accent={SHIFTS}
          onBoosted={(boostedUntil) =>
            setShiftList((prev) => prev.map((s) => (s.id === boostShift.id ? { ...s, boosted_until: boostedUntil } : s)))
          }
        />
      )}
    </div>
  );
}
