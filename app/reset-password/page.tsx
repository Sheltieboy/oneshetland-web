"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logCompliance } from "@/lib/compliance";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("Auth session")
          ? "This reset link has expired. Please request a new one."
          : error.message,
      );
      return;
    }
    await logCompliance({ eventType: "password.changed", metadata: { screen: "reset-password" } });
    setDone(true);
    setTimeout(() => {
      router.replace("/account");
      router.refresh();
    }, 1200);
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <div className="rounded-xl border border-line bg-paper p-8 shadow-soft sm:p-10">
        <p className="eyebrow text-teal">Reset password</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-navy">Choose a new password</h1>
        {done ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 font-medium text-emerald-700">
            Password updated — taking you to your account…
          </p>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-3">
            <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (8+ characters)" className="auth-input" />
            <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password" className="auth-input" />
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full rounded-pill bg-navy px-5 py-3 font-semibold text-paper transition hover:bg-navy-dark disabled:opacity-50">
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
