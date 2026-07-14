"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hoursWorked } from "@/lib/jobs-data";
import { ShiftBoostModal } from "@/components/jobs/ShiftBoostModal";

const SHIFTS = "#e8a020";

/** One application on the shift, from the owner's perspective. */
export type HubApplication = {
  id: string; worker_id: string; status: string; message: string | null;
  check_in_status: string | null; checked_in_at: string | null;
  checked_out_at: string | null; employer_confirmed_at: string | null;
  workerName: string; workerArea: string | null; memberSince: string | null;
  bio: string | null; skills: string[] | null; experience: string | null;
  rateMin: number | null; rateMax: number | null; qualifications: string[] | null;
};

type HubShift = {
  id: string; title: string; status: string;
  positions_filled: number; positions_total: number; start_at: string; end_at: string;
  posted_as_business_id: string | null; boosted_until: string | null;
};

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

/** Worker-facing check-in state, phrased for the employer. */
function checkInState(a: HubApplication): { text: string; bg: string; color: string } {
  if (a.check_in_status === "employer_confirmed") return { text: "Hours confirmed ✓", bg: "#D1FAE5", color: "#065F46" };
  if (a.check_in_status === "checked_out") return { text: `Finished ${time(a.checked_out_at)} — confirm below`, bg: "#FEF3C7", color: "#92400E" };
  if (a.check_in_status === "checked_in") return { text: `Clocked in ${time(a.checked_in_at)}`, bg: "#DBEAFE", color: "#1E40AF" };
  return { text: "Confirmed — not yet clocked in", bg: "#F3F4F6", color: "#4B5563" };
}

export function ShiftOwnerHub({ shift, applications }: { shift: HubShift; applications: HubApplication[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(applications);
  const [s, setS] = useState(shift);
  const [busy, setBusy] = useState<string | null>(null);
  const [showBoost, setShowBoost] = useState(false);
  const sb = () => createClient();

  const pending = apps.filter((a) => a.status === "pending");
  const crew = apps.filter((a) => a.status === "accepted");
  const spotsLeft = Math.max(0, s.positions_total - s.positions_filled);

  const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    open: { bg: `${SHIFTS}1a`, color: SHIFTS, label: "Open" },
    filled: { bg: "#DBEAFE", color: "#1E40AF", label: "Filled" },
    cancelled: { bg: "#F3F4F6", color: "#6B7280", label: "Cancelled" },
    completed: { bg: "#D1FAE5", color: "#065F46", label: "Completed" },
    draft: { bg: "#F3F4F6", color: "#6B7280", label: "Draft" },
  };
  const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.open;

  async function decide(app: HubApplication, status: "accepted" | "rejected") {
    const ok = status === "accepted"
      ? window.confirm(`Accept ${app.workerName} for "${s.title}"? They'll be notified.`)
      : window.confirm(`Decline ${app.workerName}'s application?`);
    if (!ok) return;
    setBusy(app.id);
    try {
      const c = sb();
      await c.from("shift_applications").update({ status, updated_at: new Date().toISOString() }).eq("id", app.id);
      c.functions.invoke("notify-application-update", { body: { application_id: app.id, status } }).catch(() => {});
      const cascaded = new Set<string>();
      let filled = s.positions_filled;
      let shiftStatus = s.status;
      if (status === "accepted") {
        filled = s.positions_filled + 1;
        const nowFull = filled >= s.positions_total;
        await c.from("shifts").update({ positions_filled: filled, ...(nowFull ? { status: "filled" } : {}) }).eq("id", s.id);
        if (nowFull) {
          shiftStatus = "filled";
          const others = pending.filter((p) => p.id !== app.id);
          for (const o of others) cascaded.add(o.id);
          if (cascaded.size) {
            await c.from("shift_applications").update({ status: "rejected", updated_at: new Date().toISOString() }).in("id", [...cascaded]);
            [...cascaded].forEach((id) => c.functions.invoke("notify-application-update", { body: { application_id: id, status: "rejected", reason: "filled" } }).catch(() => {}));
          }
        }
      }
      setS((prev) => ({ ...prev, positions_filled: filled, status: shiftStatus }));
      setApps((prev) => prev.map((a) => {
        if (a.id === app.id) return { ...a, status };
        if (cascaded.has(a.id)) return { ...a, status: "rejected" };
        return a;
      }));
      router.refresh();
    } finally { setBusy(null); }
  }

  async function complete() {
    if (!window.confirm("Mark this shift complete? Your crew will be confirmed and notified.")) return;
    setBusy("complete");
    try {
      const c = sb();
      await c.from("shifts").update({ status: "completed" }).eq("id", s.id);
      await c.from("shift_applications").update({ check_in_status: "employer_confirmed", employer_confirmed_at: new Date().toISOString() }).eq("shift_id", s.id).eq("status", "accepted");
      c.functions.invoke("notify-shift-complete", { body: { shift_id: s.id } }).catch(() => {});
      setS((prev) => ({ ...prev, status: "completed" }));
      setApps((prev) => prev.map((a) => (a.status === "accepted" ? { ...a, check_in_status: "employer_confirmed", employer_confirmed_at: new Date().toISOString() } : a)));
      router.refresh();
    } finally { setBusy(null); }
  }

  async function cancelShift() {
    if (!window.confirm("Cancel this shift? Anyone still in play will be told it's off.")) return;
    setBusy("cancel");
    try {
      const c = sb();
      await c.from("shifts").update({ status: "cancelled" }).eq("id", s.id);
      c.functions.invoke("notify-shift-status", { body: { event: "cancelled", shift_id: s.id } }).catch(() => {});
      setS((prev) => ({ ...prev, status: "cancelled" }));
      router.refresh();
    } finally { setBusy(null); }
  }

  const active = s.status === "open" || s.status === "filled";
  const canComplete = active && (crew.some((a) => a.check_in_status === "checked_out") || new Date(s.start_at).getTime() < Date.now());
  const isBoosted = !!(s.boosted_until && s.boosted_until > new Date().toISOString());
  const canBoost = s.status === "open" && !isBoosted;

  return (
    <div className="space-y-5">
      {/* Status strip */}
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display font-bold text-ink">You posted this shift</p>
          <span className="rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {s.positions_filled}/{s.positions_total} filled{spotsLeft > 0 ? ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : ""}
          {pending.length > 0 ? ` · ${pending.length} to review` : ""}
        </p>
        {active && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            {canComplete && <button onClick={complete} disabled={!!busy} className="rounded-pill px-3.5 py-1.5 text-xs font-semibold text-paper disabled:opacity-40" style={{ background: "#059669" }}>Mark complete</button>}
            {active && <button onClick={cancelShift} disabled={!!busy} className="rounded-pill border border-line-strong px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">Cancel</button>}
          </div>
        )}
      </div>

      {/* Boost CTA — prominent so it doesn't get lost among the actions */}
      {canBoost && (
        <button
          onClick={() => setShowBoost(true)}
          className="flex w-full items-center gap-4 rounded-card border p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
          style={{ borderColor: `${SHIFTS}55`, background: `linear-gradient(135deg, ${SHIFTS}22, ${SHIFTS}0d)` }}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl text-paper shadow-soft" style={{ background: SHIFTS }}>⚡</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-ink">Boost this shift</p>
            <p className="mt-0.5 text-sm text-ink-soft">Get seen first — reach more local workers.</p>
          </div>
          <span className="shrink-0 rounded-pill px-4 py-2 text-sm font-bold text-paper shadow-soft" style={{ background: SHIFTS }}>£2.99</span>
        </button>
      )}

      {/* Applicants to review */}
      <section>
        <h2 className="font-display text-lg font-bold text-ink">Applicants to review{pending.length ? ` (${pending.length})` : ""}</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No applications waiting.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="rounded-card border border-line bg-paper p-4 shadow-soft">
                <p className="font-display font-bold text-ink">{a.workerName}{a.workerArea ? <span className="text-sm font-normal text-ink-muted"> · {a.workerArea}</span> : null}</p>
                {a.memberSince && <p className="text-xs text-ink-faint">On OneShetland since {new Date(a.memberSince).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</p>}
                {a.bio && <p className="mt-2 text-sm text-ink-soft"><span className="font-semibold text-ink">About: </span>{a.bio}</p>}
                {a.experience && <p className="mt-1.5 text-sm text-ink-soft"><span className="font-semibold text-ink">Experience: </span>{a.experience}</p>}
                {(a.rateMin != null || a.rateMax != null) && (
                  <p className="mt-1.5 text-sm text-ink-soft"><span className="font-semibold text-ink">Rate: </span>
                    {a.rateMin != null && a.rateMax != null ? `£${a.rateMin}–£${a.rateMax}/hr` : `£${a.rateMin ?? a.rateMax}/hr`}</p>
                )}
                {a.skills && a.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.skills.map((sk) => <span key={sk} className="rounded-pill bg-sand px-2.5 py-1 text-xs font-semibold text-ink-soft">{sk}</span>)}
                  </div>
                )}
                {a.qualifications && a.qualifications.length > 0 && (
                  <p className="mt-2 text-xs text-ink-muted"><span className="font-semibold">Qualifications: </span>{a.qualifications.join(", ")}</p>
                )}
                {a.message && <div className="mt-2 rounded-xl bg-sand/60 p-3 text-sm text-ink-soft"><span className="font-semibold text-ink">Their note: </span>{a.message}</div>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => decide(a, "accepted")} disabled={busy === a.id || spotsLeft === 0} className="rounded-pill px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40" style={{ background: SHIFTS }}>Accept</button>
                  <button onClick={() => decide(a, "rejected")} disabled={busy === a.id} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Confirmed crew + live check-in */}
      {crew.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-ink">Your crew ({crew.length})</h2>
          <div className="mt-3 space-y-2">
            {crew.map((a) => {
              const ci = checkInState(a);
              const worked = (a.check_in_status === "checked_out" || a.check_in_status === "employer_confirmed")
                ? hoursWorked(a, s.start_at, s.end_at) : null;
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper p-3 shadow-soft">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{a.workerName}{a.workerArea ? <span className="text-sm font-normal text-ink-muted"> · {a.workerArea}</span> : null}</p>
                    {worked && <p className="text-xs text-ink-faint">{worked.label} worked{worked.actual ? "" : " (scheduled)"}</p>}
                  </div>
                  <span className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-semibold" style={{ background: ci.bg, color: ci.color }}>{ci.text}</span>
                </div>
              );
            })}
          </div>
          {canComplete && crew.some((a) => a.check_in_status !== "employer_confirmed") && (
            <button onClick={complete} disabled={!!busy} className="mt-3 w-full rounded-pill px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-40" style={{ background: "#059669" }}>Confirm hours & complete shift</button>
          )}
        </section>
      )}

      {showBoost && (
        <ShiftBoostModal
          open={showBoost}
          onClose={() => setShowBoost(false)}
          shiftId={s.id}
          shiftTitle={s.title}
          businessId={s.posted_as_business_id}
          accent={SHIFTS}
          onBoosted={(boostedUntil) => setS((prev) => ({ ...prev, boosted_until: boostedUntil }))}
        />
      )}
    </div>
  );
}
