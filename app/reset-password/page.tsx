"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

  /**
   * Gate the form on a real recovery session. Four ways in, in the order we
   * try them:
   *
   *  1. `?token_hash=…&type=recovery` — what our own reset email now sends.
   *     verifyOtp hands the hash straight back to Supabase. No redirect hop,
   *     and crucially no PKCE.
   *  2. `?code=…` — the old shape, kept only for links already in inboxes.
   *     This is what was BROKEN: the link is generated server-side by the
   *     request-password-reset edge function, so no code verifier was ever
   *     created in this browser, and @supabase/ssr forces flowType 'pkce'.
   *     The exchange could not succeed, and we reported that as "expired" on
   *     the first click.
   *  3. Tokens in the URL hash (Supabase's own default emails).
   *  4. An existing session.
   */
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  /** The reason it failed, when Supabase gives us one worth repeating. */
  const [why, setWhy] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    let active = true;

    const sub = sb.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setStatus("ready");
    });

    (async () => {
      const url = new URL(window.location.href);

      // Supabase reports a dead link in the hash. Say what it actually said
      // rather than inventing a reason — "expired" and "already used" send
      // somebody down very different paths.
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const hashError = hash.get("error_description") || hash.get("error");

      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const code = url.searchParams.get("code");

      let failure: string | null = hashError;

      if (tokenHash) {
        const { error } = await sb.auth.verifyOtp({
          token_hash: tokenHash,
          type: (type as "recovery") || "recovery",
        });
        if (error) failure = error.message;
      } else if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) failure = error.message;
      }

      // Don't leave a single-use token sitting in the address bar or in
      // history once it's been spent.
      if (tokenHash || code || url.hash) {
        window.history.replaceState({}, "", url.pathname);
      }

      const { data } = await sb.auth.getSession();
      if (!active) return;
      if (data.session) { setStatus("ready"); return; }
      setStatus((s) => (s === "ready" ? "ready" : "invalid"));
      setWhy(failure);
    })();

    return () => {
      active = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

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

        {status === "checking" ? (
          <p className="mt-4 text-ink-soft">Checking your reset link…</p>
        ) : status === "invalid" ? (
          <>
            <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 font-medium text-rose-700">
              This reset link is invalid or has expired.
              {why ? <span className="mt-1 block text-sm font-normal">{why}</span> : null}
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              Reset links can only be used once, and they don&apos;t last long — if this one
              sat in your inbox a while, a fresh one will work.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-block rounded-pill bg-navy px-6 py-3 font-semibold text-paper hover:bg-navy-dark"
            >
              Request a new link
            </Link>
          </>
        ) : done ? (
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
