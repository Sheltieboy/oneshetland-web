"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-24 text-center">
      <div className="text-5xl">⚓</div>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">Something went agley</h1>
      <p className="mt-2 text-ink-soft">Sorry — something went wrong at our end. Try again, and if it keeps happening let us know at <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a>.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-pill bg-navy px-5 py-2.5 text-sm font-semibold text-paper transition hover:brightness-110">Try again</button>
        <Link href="/" className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-sand">Back to home</Link>
      </div>
    </div>
  );
}
