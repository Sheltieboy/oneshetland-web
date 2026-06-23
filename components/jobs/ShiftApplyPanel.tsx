"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SHIFTS = "#e8a020";

type App = { id: string; status: string; check_in_status: string | null } | null;

export function ShiftApplyPanel({
  shiftId, isLoggedIn, startAt, isFull, application,
}: {
  shiftId: string; isLoggedIn: boolean; startAt: string; isFull: boolean; application: App;
}) {
  const router = useRouter();
  const [app, setApp] = useState<App>(application);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sb = () => createClient();

  if (!isLoggedIn) {
    return (
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="font-display font-bold text-ink">Available for this shift?</p>
        <p className="mt-1 text-sm text-ink-soft">Sign in to register your interest.</p>
        <a href={`/sign-in?next=/shifts/${shiftId}`} className="mt-4 block rounded-pill px-4 py-2.5 text-center text-sm font-semibold text-paper transition hover:brightness-95" style={{ background: SHIFTS }}>
          Sign in
        </a>
      </div>
    );
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      const c = sb();
      const { data: { user } } = await c.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const { data, error: dbErr } = await c.from("shift_applications")
        .insert({ shift_id: shiftId, worker_id: user.id, message: message.trim() || null })
        .select("id, status, check_in_status").single();
      if (dbErr) throw dbErr;
      setApp(data as App);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit interest.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!app) return;
    setBusy(true);
    try {
      await sb().from("shift_applications").update({ status: "withdrawn" }).eq("id", app.id);
      setApp({ ...app, status: "withdrawn" });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function setCheck(status: "checked_in" | "checked_out") {
    if (!app) return;
    setBusy(true);
    try {
      const stamp = status === "checked_in" ? { checked_in_at: new Date().toISOString() } : { checked_out_at: new Date().toISOString() };
      await sb().from("shift_applications").update({ check_in_status: status, ...stamp }).eq("id", app.id);
      setApp({ ...app, check_in_status: status });
      router.refresh();
    } finally { setBusy(false); }
  }

  // Existing application states
  if (app && app.status !== "withdrawn") {
    if (app.status === "accepted") {
      const canCheckIn = Date.now() >= new Date(startAt).getTime() - 2 * 3600_000;
      return (
        <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
          <p className="font-display font-bold" style={{ color: SHIFTS }}>✓ You're confirmed</p>
          {app.check_in_status === "employer_confirmed" ? (
            <p className="mt-2 text-sm text-ink-soft">Shift complete — thanks for working!</p>
          ) : app.check_in_status === "checked_out" ? (
            <p className="mt-2 text-sm text-ink-soft">Checked out — awaiting employer confirmation.</p>
          ) : app.check_in_status === "checked_in" ? (
            <button onClick={() => setCheck("checked_out")} disabled={busy} className="mt-3 block w-full rounded-pill px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-40" style={{ background: SHIFTS }}>
              I've finished
            </button>
          ) : canCheckIn ? (
            <button onClick={() => setCheck("checked_in")} disabled={busy} className="mt-3 block w-full rounded-pill px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-40" style={{ background: SHIFTS }}>
              Check in to this shift
            </button>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Check-in opens 2 hours before the shift starts.</p>
          )}
        </div>
      );
    }
    if (app.status === "rejected") {
      return (
        <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
          <p className="font-display font-bold text-ink">Not selected this time</p>
          <p className="mt-1 text-sm text-ink-soft">This shift went to another worker — keep an eye out for more.</p>
        </div>
      );
    }
    // pending
    return (
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="font-display font-bold" style={{ color: SHIFTS }}>Interest submitted</p>
        <p className="mt-1 text-sm text-ink-soft">The employer will be in touch if you're selected.</p>
        <button onClick={withdraw} disabled={busy} className="mt-4 block w-full rounded-pill border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40">
          Withdraw interest
        </button>
      </div>
    );
  }

  if (isFull) {
    return (
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="font-display font-bold text-ink">This shift is full</p>
        <p className="mt-1 text-sm text-ink-soft">All positions have been filled.</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <p className="font-display font-bold text-ink">Available for this shift?</p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-4 block w-full rounded-pill px-4 py-2.5 text-sm font-semibold text-paper transition hover:brightness-95" style={{ background: SHIFTS }}>
          Register interest
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Add a message (optional) — availability, relevant experience…" className="auth-input resize-none" />
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
          <button onClick={submit} disabled={busy} className="block w-full rounded-pill px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-40" style={{ background: SHIFTS }}>
            {busy ? "Sending…" : "Submit interest"}
          </button>
          <button onClick={() => setOpen(false)} className="block w-full text-center text-xs font-semibold text-ink-muted hover:text-ink">Cancel</button>
        </div>
      )}
    </div>
  );
}
