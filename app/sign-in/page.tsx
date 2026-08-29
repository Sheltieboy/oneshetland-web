"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/redirect";

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * What the confirmation link actually told us.
   *
   * It used to say "That confirmation link has expired" for every failure,
   * including the common one: signing up on a laptop and opening the email on
   * a phone. Supabase confirms the address before redirecting here, so in that
   * case the account was already fine and the message was simply untrue.
   * Nothing here claims a link expired unless the server was told so.
   */
  const confirmState = params.get("error") ?? (params.get("confirmed") === "1" ? "ok" : null);
  const [error, setError] = useState<string | null>(
    confirmState === "confirm_invalid"
      ? "That confirmation link is no longer valid. Request a new one below."
      : confirmState === "confirm" // older links still in inboxes
        ? "Your email may already be confirmed — try signing in below."
        : null,
  );
  const [notice, setNotice] = useState<string | null>(
    confirmState === "confirm_session"
      ? "Your email may already be confirmed. If you opened the link on a different device from the one you signed up on, we can't sign you in automatically — try signing in below."
      : null,
  );

  // A resend, offered only where it is the actual remedy. Supabase answers the
  // same way whether or not the address has an unconfirmed account, so this
  // cannot be used to find out who has one.
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  async function resendConfirmation() {
    if (!email.trim()) { setError("Enter your email address first, then tap resend."); return; }
    setResending(true); setError(null);
    try {
      await createClient().auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
    } catch { /* deliberately not surfaced — see above */ }
    setResending(false);
    setResent(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setBusy(false);
      if (error.message.includes("Invalid login credentials")) {
        setError("Email address or password is incorrect. Please try again.");
      } else if (error.message.includes("Email not confirmed")) {
        setError("Please confirm your email address first — check your inbox for the link.");
      } else {
        setError(error.message);
      }
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <div className="rounded-xl border border-line bg-paper p-8 shadow-soft sm:p-10">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5" aria-label="OneShetland home">
          <Image src="/brand/logo-mark-keyed.png" alt="OneShetland" width={36} height={36} unoptimized className="h-9 w-9" />
          <span className="font-display text-xl font-bold text-navy">OneShetland</span>
        </Link>
        <p className="eyebrow text-teal">Welcome back</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-navy">Sign in</h1>
        <p className="mt-3 text-ink-soft">
          Your OneShetland account works across the app and the website — same
          login, same wallet, same memberships.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-line bg-cream/40 px-4 py-3 text-ink outline-none focus:border-teal"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-line bg-cream/40 px-4 py-3 text-ink outline-none focus:border-teal"
          />
          {notice && !error && (
            <p className="rounded-lg bg-sand px-3 py-2 text-sm font-medium text-ink-soft">{notice}</p>
          )}
          {resent && (
            <p className="rounded-lg bg-teal/10 px-3 py-2 text-sm font-medium text-ink">
              If that address needs confirming, a new link is on its way.
            </p>
          )}
          {(confirmState === "confirm_invalid" || confirmState === "confirm_session") && !resent && (
            <button
              type="button"
              onClick={() => void resendConfirmation()}
              disabled={resending}
              className="w-full rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand disabled:opacity-50"
            >
              {resending ? "Sending…" : "Send a new confirmation email"}
            </button>
          )}
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-pill bg-navy px-5 py-3 font-semibold text-paper transition hover:bg-navy-dark disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-sm font-semibold text-teal-dark hover:underline">
            Forgot your password?
          </Link>
        </div>

        <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-soft">
          New to OneShetland?{" "}
          <Link href="/sign-up" className="font-semibold text-teal-dark hover:underline">
            Create an account
          </Link>
        </p>
      </div>
      <p className="mt-5 px-4 text-center text-xs text-ink-muted">
        Members must be 18 or over. By signing in you agree to our{" "}
        <Link href="/terms" className="underline hover:text-ink">Terms</Link> and{" "}
        <Link href="/privacy" className="underline hover:text-ink">Privacy Policy</Link>.
      </p>
    </section>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}
