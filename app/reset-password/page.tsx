"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logCompliance } from "@/lib/compliance";

/**
 * Four states, and they are not allowed to blur into each other.
 *
 *   checking   working out which of the three below applies
 *   recovery   a reset link was presented AND it verified — "Resetting password for X"
 *   session    no reset link, but somebody is signed in    — "Change password for X"
 *   invalid    a reset link was presented and failed, or there is nothing to act on
 *
 * The line between `recovery` and `invalid` used to be drawn by "is there a
 * session?", which was wrong in a way that took a production reproduction to
 * see: open a CONSUMED reset link for user B in a browser already signed in as
 * user A, and getSession() answered yes — about A — so the page offered a
 * password form, said whose it was nowhere, and would have changed A's
 * password.
 *
 * So the rule is now: if the URL carried recovery material, the outcome
 * depends ONLY on whether that material verified. A pre-existing session is
 * never a substitute for a reset link. A stays signed in — their session is
 * not this page's business — they simply don't get a form.
 */
type Status = "checking" | "recovery" | "session" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [status, setStatus] = useState<Status>("checking");
  /** The reason it failed, when Supabase gives us one worth repeating. */
  const [why, setWhy] = useState<string | null>(null);
  /**
   * Whose password is about to change. From getUser(), which verifies with the
   * auth server, and therefore from the same session updateUser() acts on.
   * Never from the URL, a form or storage: an identity that could disagree
   * with the account being changed would be worse than showing none.
   */
  const [identity, setIdentity] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    let active = true;

    /** The verified account for the current session, or null. */
    async function verifiedEmail(): Promise<string | null> {
      const { data } = await sb.auth.getUser();
      return data.user?.email ?? null;
    }

    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

      // Supabase reports a dead link in the hash. Say what it actually said
      // rather than inventing a reason — "expired" and "already used" send
      // somebody down very different paths.
      const hashError = hash.get("error_description") || hash.get("error");
      const hashToken = hash.get("access_token");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const code = url.searchParams.get("code");

      /**
       * Did this URL claim to be a reset link at all? All four shapes count:
       * our own token_hash emails, legacy ?code= links still sitting in
       * inboxes, the hash-fragment tokens Supabase's own default emails use —
       * which the mobile app still relies on — and a hash carrying an error.
       */
      const isRecoveryLink = !!tokenHash || !!code || !!hashToken || !!hashError;

      let failure: string | null = hashError;
      let verified = false;

      if (tokenHash) {
        const { error } = await sb.auth.verifyOtp({
          token_hash: tokenHash,
          type: (type as "recovery") || "recovery",
        });
        if (error) failure = error.message;
        else verified = true;
      } else if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) failure = error.message;
        else verified = true;
      } else if (hashToken && !hashError) {
        // detectSessionInUrl consumes these on the client's own schedule, so
        // give it a moment, then ask whether it actually worked.
        for (let i = 0; i < 20 && !verified; i++) {
          const { data } = await sb.auth.getSession();
          if (data.session) { verified = true; break; }
          await new Promise((r) => setTimeout(r, 50));
        }
        if (!verified) failure = failure ?? "This recovery link could not be verified.";
      }

      // Don't leave a single-use token sitting in the address bar or in
      // history once it's been spent.
      if (tokenHash || code || url.hash) {
        window.history.replaceState({}, "", url.pathname);
      }

      if (!active) return;

      if (isRecoveryLink) {
        // The only thing that matters is whether the link verified. Whoever
        // else may be signed in this browser is irrelevant.
        if (!verified) {
          setStatus("invalid");
          setWhy(failure);
          return;
        }
        const email = await verifiedEmail();
        if (!active) return;
        setIdentity(email);
        setStatus("recovery");
        return;
      }

      // No reset link at all. Someone signed in who reaches this page directly
      // is doing an ordinary password change — a real thing they may do, but
      // not a reset, and it must not be labelled as one.
      const email = await verifiedEmail();
      if (!active) return;
      if (email) {
        setIdentity(email);
        setStatus("session");
        return;
      }
      setStatus("invalid");
      setWhy(failure);
    })();

    return () => {
      active = false;
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

  const isChange = status === "session";
  const canSetPassword = status === "recovery" || status === "session";

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <div className="rounded-xl border border-line bg-paper p-8 shadow-soft sm:p-10">
        <p className="eyebrow text-teal">{isChange ? "Account" : "Reset password"}</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-navy">
          {isChange ? "Change your password" : "Choose a new password"}
        </h1>

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
        ) : canSetPassword ? (
          <>
            {/* Whose password this is. From the verified session, so it cannot
                disagree with the account updateUser() will change. */}
            <p className="mt-4 rounded-lg bg-sand px-4 py-3 text-sm text-ink-soft">
              {isChange ? "Change password for" : "Resetting password for"}
              <span className="mt-0.5 block font-semibold text-ink" data-testid="reset-identity">
                {identity ?? "your account"}
              </span>
            </p>
            <form onSubmit={submit} className="mt-5 space-y-3">
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
          </>
        ) : null}
      </div>
    </section>
  );
}
