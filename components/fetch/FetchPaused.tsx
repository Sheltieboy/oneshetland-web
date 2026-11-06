import Link from "next/link";

/** Shown in place of every Fetch page while the database switch says Fetch is paused. Informative, calm, and it does not invite anyone into a workflow. */
export function FetchPaused() {
  return (
    <section aria-labelledby="fetch-paused-h" className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
      <p className="eyebrow text-ink-muted">OneShetland · Fetch</p>
      <h1 id="fetch-paused-h" className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">Being prepared for launch</h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
        Fetch is our community delivery service: neighbours bringing things to neighbours, the island way. We want it to be safe and dependable for everyone, so we are
        finishing it properly before opening the doors.
      </p>
      <p className="mt-4 max-w-xl text-ink-soft">Requests and driver sign-ups are paused for now. We will announce Fetch here when it is ready.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-pill bg-ink px-6 text-sm font-bold text-white">Back to the homepage</Link>
        <Link href="/whats-on" className="inline-flex min-h-11 items-center rounded-pill border border-line-strong px-6 text-sm font-bold text-ink hover:bg-sand">See what&apos;s on</Link>
      </div>
    </section>
  );
}
