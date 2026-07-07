"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logCompliance, TERMS_VERSION, PRIVACY_VERSION } from "@/lib/compliance";
import { safeNext } from "@/lib/redirect";

function SignUpInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError("Please enter your name.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    if (!agree) return setError("Please confirm you're 18+ and accept the terms.");

    setBusy(true);
    const sb = createClient();
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await sb.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          marketing_opt_in: marketing,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          age_confirmed: true,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }

    // If phone provided and we have a session (confirmation off), persist it + log consent.
    if (data.session && data.user) {
      if (phone.trim()) {
        await sb.from("profiles").update({ phone: phone.trim() }).eq("id", data.user.id);
      }
      await logCompliance({ eventType: "terms.accepted", documentVersion: TERMS_VERSION, metadata: { screen: "sign-up" } });
      await logCompliance({ eventType: "privacy.accepted", documentVersion: PRIVACY_VERSION, metadata: { screen: "sign-up" } });
      await logCompliance({ eventType: "age.confirmed", metadata: { screen: "sign-up" } });
      await logCompliance({ eventType: marketing ? "marketing.opted_in" : "marketing.opted_out", metadata: { screen: "sign-up" } });
      router.replace(next);
      router.refresh();
      return;
    }

    // Existing account: with email confirmation on, Supabase returns success but
    // an empty `identities` array (to avoid leaking which emails are registered).
    // Don't show a fake "check your inbox" — steer them to sign in instead.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setBusy(false);
      setError("That email already has a OneShetland account. Please sign in instead.");
      return;
    }

    // Email confirmation required.
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
        <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft sm:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal/15 text-2xl">📬</span>
          <h1 className="mt-5 font-display text-3xl font-bold text-navy">Check your inbox</h1>
          <p className="mt-3 text-ink-soft">
            We&apos;ve sent a confirmation link to <span className="font-semibold">{email.trim().toLowerCase()}</span>.
            Tap it to finish setting up your account.
          </p>
          <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="mt-6 inline-block rounded-pill bg-navy px-6 py-3 font-semibold text-paper hover:bg-navy-dark">
            Go to sign in
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <div className="rounded-xl border border-line bg-paper p-8 shadow-soft sm:p-10">
        <p className="eyebrow text-teal">Join OneShetland</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-navy">Create an account</h1>
        <p className="mt-3 text-ink-soft">One account across the app and the website.</p>

        <form onSubmit={submit} className="mt-7 space-y-3">
          <Field label="Full name">
            <input required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="auth-input" placeholder="Your name" />
          </Field>
          <Field label="Email">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="auth-input" placeholder="you@example.com" />
          </Field>
          <Field label="Phone (optional)">
            <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="auth-input" placeholder="07…" />
          </Field>
          <Field label="Password">
            <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="auth-input" placeholder="At least 8 characters" />
          </Field>
          <Field label="Confirm password">
            <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="auth-input" placeholder="Re-enter password" />
          </Field>

          <label className="flex items-start gap-3 pt-1">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 accent-teal" />
            <span className="text-sm text-ink-soft">
              I&apos;m 18 or over and accept the{" "}
              <Link href="/terms" className="font-semibold text-teal-dark hover:underline">Terms</Link> and{" "}
              <Link href="/privacy" className="font-semibold text-teal-dark hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 h-5 w-5 accent-teal" />
            <span className="text-sm text-ink-soft">
              Email me occasional OneShetland news, offers and updates. Optional — change it any time.
            </span>
          </label>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

          <button type="submit" disabled={busy}
            className="w-full rounded-pill bg-navy px-5 py-3 font-semibold text-paper transition hover:bg-navy-dark disabled:opacity-50">
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-semibold text-teal-dark hover:underline">Sign in</Link>
        </p>
      </div>
    </section>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpInner />
    </Suspense>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}
