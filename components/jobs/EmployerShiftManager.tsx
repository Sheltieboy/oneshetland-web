"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatShiftDate } from "@/lib/jobs-data";

const SHIFTS = "#e8a020";

type ManagedShift = {
  id: string; title: string; start_at: string; status: string;
  positions_filled: number; positions_total: number;
  pending_count: number; total_apps: number; checked_out_count: number;
};
type Applicant = {
  id: string; shift_id: string; message: string | null;
  shiftTitle: string; shiftStart: string | null;
  workerName: string; workerArea: string | null; bio: string | null; skills: string[] | null;
};

export function EmployerShiftManager({ shifts, applications }: { shifts: ManagedShift[]; applications: Applicant[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(applications);
  const [shiftList, setShiftList] = useState(shifts);
  const [busy, setBusy] = useState<string | null>(null);

  const sb = () => createClient();

  async function decide(app: Applicant, status: "accepted" | "rejected") {
    setBusy(app.id);
    try {
      const c = sb();
      await c.from("shift_applications").update({ status, updated_at: new Date().toISOString() }).eq("id", app.id);
      if (status === "accepted") {
        const { data: shift } = await c.from("shifts").select("positions_filled, positions_total").eq("id", app.shift_id).single();
        if (shift) {
          const filled = shift.positions_filled + 1;
          await c.from("shifts").update({
            positions_filled: filled,
            ...(filled >= shift.positions_total ? { status: "filled" } : {}),
          }).eq("id", app.shift_id);
        }
      }
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      router.refresh();
    } finally { setBusy(null); }
  }

  async function cancelShift(id: string) {
    setBusy(id);
    try {
      await sb().from("shifts").update({ status: "cancelled" }).eq("id", id);
      setShiftList((prev) => prev.map((s) => (s.id === id ? { ...s, status: "cancelled" } : s)));
      router.refresh();
    } finally { setBusy(null); }
  }

  async function complete(id: string) {
    setBusy(id);
    try {
      const c = sb();
      await c.from("shifts").update({ status: "completed" }).eq("id", id);
      await c.from("shift_applications").update({ check_in_status: "employer_confirmed", employer_confirmed_at: new Date().toISOString() }).eq("shift_id", id).eq("status", "accepted");
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
      {/* Pending applications inbox */}
      <section>
        <h2 className="font-display text-2xl font-bold text-ink">Applications to review</h2>
        {apps.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No pending applications right now.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {apps.map((a) => (
              <div key={a.id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{a.shiftTitle}{a.shiftStart ? ` · ${formatShiftDate(a.shiftStart)}` : ""}</p>
                <p className="mt-1 font-display font-bold text-ink">{a.workerName}{a.workerArea ? <span className="text-sm font-normal text-ink-muted"> · {a.workerArea}</span> : null}</p>
                {a.bio && <p className="mt-1 text-sm text-ink-soft">{a.bio}</p>}
                {a.skills && a.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.skills.map((s) => <span key={s} className="rounded-pill bg-sand px-2.5 py-1 text-xs font-semibold text-ink-soft">{s}</span>)}
                  </div>
                )}
                {a.message && <div className="mt-2 rounded-xl bg-sand/60 p-3 text-sm text-ink-soft">{a.message}</div>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => decide(a, "accepted")} disabled={busy === a.id} className="rounded-pill px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40" style={{ background: SHIFTS }}>Accept</button>
                  <button onClick={() => decide(a, "rejected")} disabled={busy === a.id} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Posted shifts */}
      <section>
        <h2 className="font-display text-2xl font-bold text-ink">Your posted shifts</h2>
        <div className="mt-4 space-y-3">
          {shiftList.map((s) => {
            const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.open;
            const active = s.status === "open" || s.status === "filled";
            const canComplete = s.status === "filled" && s.checked_out_count > 0;
            return (
              <div key={s.id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/shifts/${s.id}`} className="font-display font-bold text-ink hover:underline">{s.title}</Link>
                    <p className="text-sm text-ink-muted">{formatShiftDate(s.start_at)}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">{s.positions_filled}/{s.positions_total} filled · {s.total_apps} application{s.total_apps === 1 ? "" : "s"}{s.pending_count > 0 ? ` · ${s.pending_count} to review` : ""}</p>
                  </div>
                  <span className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                </div>
                {active && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    {canComplete && <button onClick={() => complete(s.id)} disabled={busy === s.id} className="rounded-pill px-3.5 py-1.5 text-xs font-semibold text-paper disabled:opacity-40" style={{ background: "#059669" }}>Mark complete</button>}
                    <button onClick={() => cancelShift(s.id)} disabled={busy === s.id} className="rounded-pill border border-line-strong px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">Cancel shift</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
