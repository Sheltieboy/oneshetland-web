"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SecurityForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || email === currentEmail) return;
    setBusy(true); setEmailMsg(null);
    try {
      const { error } = await createClient().auth.updateUser({ email: email.trim() });
      setEmailMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Check both inboxes to confirm the change." });
    } finally { setBusy(false); }
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setPwMsg({ ok: false, text: "Use at least 8 characters." }); return; }
    if (pw !== pw2) { setPwMsg({ ok: false, text: "Passwords don't match." }); return; }
    setBusy(true); setPwMsg(null);
    try {
      const { error } = await createClient().auth.updateUser({ password: pw });
      if (error) setPwMsg({ ok: false, text: error.message });
      else { setPwMsg({ ok: true, text: "Password updated ✓" }); setPw(""); setPw2(""); }
    } finally { setBusy(false); }
  }

  const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) => m ? <p className={"rounded-lg px-3 py-2 text-sm font-medium " + (m.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{m.text}</p> : null;

  return (
    <div className="space-y-6">
      <form onSubmit={changeEmail} className="space-y-3 rounded-card border border-line bg-paper p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold text-ink">Email address</h2>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" />
        <Msg m={emailMsg} />
        <button type="submit" disabled={busy || email === currentEmail} className="rounded-pill bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40">Update email</button>
      </form>

      <form onSubmit={changePw} className="space-y-3 rounded-card border border-line bg-paper p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold text-ink">Password</h2>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="auth-input" autoComplete="new-password" />
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm new password" className="auth-input" autoComplete="new-password" />
        <Msg m={pwMsg} />
        <button type="submit" disabled={busy} className="rounded-pill bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40">Change password</button>
      </form>
    </div>
  );
}
