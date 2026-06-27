"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/redirect";

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "confirm" ? "That confirmation link has expired. Please sign in." : null,
  );
  const [busy, setBusy] = useState(false);

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
        Members must be 18 or over.
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
