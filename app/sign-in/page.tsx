import Link from "next/link";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-20">
      <div className="rounded-xl border border-line bg-paper p-8 shadow-soft sm:p-10">
        <p className="eyebrow text-teal">Welcome back</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-navy">Sign in</h1>
        <p className="mt-3 text-ink-soft">
          Your OneShetland account works across the app and the website — same
          login, same wallet, same memberships.
        </p>

        <div className="mt-7 space-y-3 opacity-60">
          <input
            disabled
            placeholder="you@example.com"
            className="w-full rounded-xl border border-line bg-sand/40 px-4 py-3 text-ink placeholder:text-ink-faint"
          />
          <input
            disabled
            type="password"
            placeholder="Password"
            className="w-full rounded-xl border border-line bg-sand/40 px-4 py-3 text-ink placeholder:text-ink-faint"
          />
          <button
            disabled
            className="w-full cursor-not-allowed rounded-pill bg-navy px-5 py-3 font-semibold text-paper"
          >
            Sign in
          </button>
        </div>

        <p className="mt-5 rounded-xl bg-sand/60 px-4 py-3 text-center text-sm text-ink-soft">
          Sign-in is coming with the next phase. For now, use the OneShetland app
          — it&apos;s the same account.
        </p>

        <Link
          href="/"
          className="mt-6 block text-center text-sm font-semibold text-teal-dark hover:underline"
        >
          ← Back to home
        </Link>
      </div>
    </section>
  );
}
