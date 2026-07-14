"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const sb = createClient();
    // Use our own edge function so the reset email is a branded OneShetland email
    // (via Postmark), not Supabase Auth's default unbranded one. It always
    // succeeds and never reveals whether the account exists.
    await sb.functions.invoke("request-password-reset", {
      body: {
        email: email.trim().toLowerCase(),
        redirect_to: `${window.location.origin}/auth/callback?next=/reset-password`,
      },
    }).catch(() => {});
    setBusy(false);
    setSent(true);
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <div className="rounded-xl border border-line bg-paper p-8 shadow-soft sm:p-10">
        {sent ? (
          <>
            <span className="grid h-14 w-14 place-items-center rounded-full bg-teal/15 text-2xl">📬</span>
            <h1 className="mt-5 font-display text-3xl font-bold text-navy">Check your inbox</h1>
            <p className="mt-3 text-ink-soft">
              If an account exists for <span className="font-semibold">{email.trim().toLowerCase()}</span>,
              we&apos;ve sent a link to reset your password.
            </p>
            <Link href="/sign-in" className="mt-6 inline-block rounded-pill bg-navy px-6 py-3 font-semibold text-paper hover:bg-navy-dark">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="eyebrow text-teal">Reset password</p>
            <h1 className="mt-2 font-display text-4xl font-bold text-navy">Forgot password</h1>
            <p className="mt-3 text-ink-soft">Enter your email and we&apos;ll send you a reset link.</p>
            <form onSubmit={submit} className="mt-7 space-y-3">
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" className="auth-input" />
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
              <button type="submit" disabled={busy}
                className="w-full rounded-pill bg-navy px-5 py-3 font-semibold text-paper transition hover:bg-navy-dark disabled:opacity-50">
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-ink-soft">
              <Link href="/sign-in" className="font-semibold text-teal-dark hover:underline">← Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
