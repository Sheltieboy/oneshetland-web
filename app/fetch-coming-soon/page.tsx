import type { Metadata } from "next";
import Link from "next/link";

/**
 * What every /fetch route shows while Fetch is unavailable to the visitor (proxy.ts rewrites to here; the address stays /fetch…).
 * Deliberately plain: Fetch is being rebuilt, so nothing here invites anyone to request, drive or pay.
 */
export const metadata: Metadata = {
  title: "Fetch — coming soon",
  robots: { index: false, follow: false },
};

export default function FetchComingSoon() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 py-24 text-center">
      <p className="eyebrow text-fetch">Fetch</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-navy sm:text-5xl">Coming soon</h1>
      <p className="mt-4 max-w-md text-lg text-ink-soft">
        We&apos;re rebuilding Fetch, our community collection and delivery service, so it works properly across Shetland — Mainland
        and the isles. It isn&apos;t taking requests or new drivers just now.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-pill bg-navy px-6 py-3 font-semibold text-paper transition hover:bg-navy-dark"
      >
        Back to home
      </Link>
    </section>
  );
}
